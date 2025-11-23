import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    const token = await getToken();
    const supabase = await createClient(token);

    // Fetch project and verify ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch processed data sources with their summaries
    const { data: dataSources, error: sourcesError } = await supabase
      .from("data_sources")
      .select(`
        *,
        summaries(*)
      `)
      .eq("project_id", projectId)
      .eq("status", "processed");

    if (sourcesError || !dataSources || dataSources.length === 0) {
      return NextResponse.json({ 
        error: "No processed sources found" 
      }, { status: 400 });
    }

    // Prepare source content for analysis
    const sourceContents = dataSources.map(source => ({
      id: source.id,
      name: source.name,
      type: source.type,
      content: source.summaries?.map((s: any) => s.content).join('\n\n') || "",
      metadata: source.metadata
    }));

    // Use OpenAI to analyze and suggest parameters
    const analysisPrompt = `
You are analyzing a collection of research documents to identify key parameters that should be tracked in a synthesis matrix. 

Here are the documents:
${sourceContents.map((source, idx) => `
Document ${idx + 1}: ${source.name} (${source.type})
Content: ${source.content.substring(0, 1500)}...
`).join('\n')}

Your task:
1. Identify 5-8 key parameters that would be most valuable to track across these documents
2. For each parameter, determine what type it is (text, number, date, category)
3. Provide a brief description of why this parameter is important
4. Extract values for each parameter from each document (with confidence scores)

Focus on parameters that would help compare and contrast these sources, identify trends, or support decision-making.

Common valuable parameters include:
- Publication/creation date
- Authors/organizations
- Key metrics or measurements
- Technology/methodology used
- Geographic location
- Target audience/application
- Conclusions/outcomes

Please respond in this exact JSON format:
{
  "suggestedParameters": [
    {
      "name": "Parameter Name",
      "type": "text|number|date|category",
      "description": "Why this parameter matters",
      "importance": 0.9
    }
  ],
  "extractedValues": {
    "dataSourceId": {
      "parameterName": {
        "value": "extracted value",
        "confidence": 0.85,
        "context": "relevant snippet from source"
      }
    }
  }
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a research synthesis expert who helps organize and analyze academic and technical documents. You MUST respond with valid JSON only. Do not include any text before or after the JSON."
        },
        {
          role: "user", 
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    let analysisResult;
    try {
      analysisResult = JSON.parse(response);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", response);
      throw new Error("Invalid response format from AI");
    }

    // Store suggested parameters in the database
    const parametersToInsert = analysisResult.suggestedParameters.map((param: any, index: number) => ({
      project_id: projectId,
      name: param.name,
      type: param.type,
      description: param.description,
      is_system: true, // AI discovered
      display_order: index,
    }));

    const { data: insertedParameters, error: insertError } = await supabase
      .from("synthesis_parameters")
      .insert(parametersToInsert)
      .select();

    if (insertError) {
      console.error("Failed to insert parameters:", insertError);
      throw new Error("Failed to save parameters");
    }

    // Store extracted values
    const valuesToInsert = [];
    for (const [dataSourceId, parameterValues] of Object.entries(analysisResult.extractedValues || {})) {
      for (const [parameterName, valueData] of Object.entries(parameterValues as any)) {
        const parameter = insertedParameters?.find(p => p.name === parameterName);
        if (parameter && valueData) {
          valuesToInsert.push({
            parameter_id: parameter.id,
            data_source_id: dataSourceId,
            extracted_value: (valueData as any).value,
            confidence: (valueData as any).confidence,
            context: (valueData as any).context,
            is_verified: false,
          });
        }
      }
    }

    if (valuesToInsert.length > 0) {
      const { error: valuesError } = await supabase
        .from("synthesis_values")
        .insert(valuesToInsert);

      if (valuesError) {
        console.error("Failed to insert values:", valuesError);
      }
    }

    return NextResponse.json({
      success: true,
      parametersCreated: insertedParameters?.length || 0,
      valuesExtracted: valuesToInsert.length,
      parameters: insertedParameters,
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Analysis failed" 
    }, { status: 500 });
  }
}