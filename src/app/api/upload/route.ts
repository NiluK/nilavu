import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { UnstructuredClient } from "unstructured-client";
import OpenAI from "openai";

// OpenAI and Supabase clients will be created inside the handler

export async function POST(request: NextRequest) {
  try {
    // Initialize clients with env checks
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Initialize Unstructured client
    if (!process.env.UNSTRUCTURED_API_KEY) {
      throw new Error("UNSTRUCTURED_API_KEY is not set");
    }

    const unstructuredClient = new UnstructuredClient({
      serverURL: "https://api.unstructured.io",
      apiKeyAuth: process.env.UNSTRUCTURED_API_KEY,
    });

    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const projectId = formData.get("projectId") as string;
    const file = formData.get("file") as File;

    if (!projectId || !file) {
      return NextResponse.json({ 
        error: "Project ID and file are required" 
      }, { status: 400 });
    }

    const token = await getToken();
    const supabase = await createClient(token);

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${userId}/${projectId}/${timestamp}_${sanitizedName}`;

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from('documents')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ 
        error: "Failed to upload file" 
      }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = serviceClient.storage
      .from('documents')
      .getPublicUrl(fileName);

    // Extract text content using Unstructured.io
    let extractedText = "";
    let metadata: any = {
      originalName: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString()
    };

    try {
      if (file.type === 'text/plain') {
        // Handle plain text files directly
        extractedText = new TextDecoder().decode(fileBuffer);
      } else if (file.type.startsWith('audio/')) {
        // For audio files, use OpenAI Whisper
        const audioBlob = new Blob([fileBuffer], { type: file.type });
        const audioFile = new File([audioBlob], file.name, { type: file.type });
        
        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
        });
        
        extractedText = transcription.text;
        metadata.transcribed = true;
      } else if (
        file.type === 'application/pdf' || 
        file.type.includes('word') || 
        file.type.includes('presentation') ||
        file.type.includes('document')
      ) {
        // Use Unstructured.io for document parsing
        try {
          const partitionResponse = await unstructuredClient.general.partition({
            partitionParameters: {
              files: {
                content: new Uint8Array(fileBuffer),
                fileName: file.name,
              },
              // Use default strategy for optimal processing
              languages: ["en"],
            },
          });

          if (partitionResponse && Array.isArray(partitionResponse)) {
            // partitionResponse is directly an array of elements
            const elements = partitionResponse;
            
            // Extract text from elements
            const textElements = elements
              .filter(element => element.text && element.text.trim())
              .map(element => element.text?.trim())
              .filter(text => text && text.length > 0);

            extractedText = textElements.join('\n\n');
            
            // Extract metadata
            const titles = elements
              .filter(element => element.category === 'Title')
              .map(element => element.text);
            
            metadata.unstructuredProcessed = true;
            metadata.elementCount = elements.length;
            metadata.titles = titles;
            metadata.processingStrategy = "default";
          } else {
            throw new Error('Unstructured API returned unexpected response format');
          }
        } catch (unstructuredError) {
          console.error("Unstructured.io processing error:", unstructuredError);
          extractedText = `[Document uploaded but text extraction failed: ${unstructuredError instanceof Error ? unstructuredError.message : 'Unknown error'}]`;
        }
      } else {
        // For other file types, store them but mark as not processed
        extractedText = `[${file.type} file - content not extracted. Supported types: PDF, DOCX, PPTX, TXT, MP3, M4A, WAV]`;
      }
    } catch (extractionError) {
      console.error("Text extraction error:", extractionError);
      extractedText = `[Text extraction failed: ${extractionError instanceof Error ? extractionError.message : 'Unknown error'}]`;
    }

    // Create data source record
    const { data: dataSource, error: insertError } = await supabase
      .from("data_sources")
      .insert({
        project_id: projectId,
        type: getDocumentType(file.type),
        name: file.name,
        content_url: publicUrl,
        status: "processing",
        metadata: metadata
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.json({ 
        error: "Failed to create data source record" 
      }, { status: 500 });
    }

    // Generate hierarchical summaries
    if (extractedText && extractedText.length > 50) {
      await generateSummaries(supabase, dataSource.id, extractedText, openai);
    }

    // Update status to processed
    await supabase
      .from("data_sources")
      .update({ status: "processed" })
      .eq("id", dataSource.id);

    return NextResponse.json({
      success: true,
      dataSource: {
        id: dataSource.id,
        name: dataSource.name,
        type: dataSource.type,
        status: "processed"
      }
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Upload failed" 
    }, { status: 500 });
  }
}

function getDocumentType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('word')) return 'docx';
  if (mimeType.includes('presentation')) return 'pptx';
  if (mimeType === 'text/plain') return 'txt';
  return 'document';
}

async function generateSummaries(supabase: any, dataSourceId: string, content: string, openai: OpenAI) {
  try {
    // Generate sentence-level summary (most detailed)
    const sentenceSummary = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a research analyst. Create a detailed sentence-level summary of the key points in this document. Focus on facts, findings, methodologies, and conclusions."
        },
        {
          role: "user",
          content: `Please create a detailed summary of this document:\n\n${content.substring(0, 8000)}`
        }
      ],
      temperature: 0.3,
    });

    const sentenceContent = sentenceSummary.choices[0]?.message?.content || "";

    // Insert sentence-level summary
    const { data: sentenceRecord } = await supabase
      .from("summaries")
      .insert({
        data_source_id: dataSourceId,
        content: sentenceContent,
        level: "sentence"
      })
      .select()
      .single();

    // Generate paragraph-level summary (mid-level)
    const paragraphSummary = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a research analyst. Create a concise paragraph-level summary that captures the main themes and key findings."
        },
        {
          role: "user",
          content: `Based on this detailed summary, create a shorter paragraph summary:\n\n${sentenceContent}`
        }
      ],
      temperature: 0.3,
    });

    const paragraphContent = paragraphSummary.choices[0]?.message?.content || "";

    // Insert paragraph-level summary
    const { data: paragraphRecord } = await supabase
      .from("summaries")
      .insert({
        data_source_id: dataSourceId,
        parent_id: sentenceRecord?.id,
        content: paragraphContent,
        level: "paragraph"
      })
      .select()
      .single();

    // Generate full-document summary (highest level)
    const fullSummary = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a research analyst. Create a concise, high-level summary in 2-3 sentences that captures the essence of this document."
        },
        {
          role: "user",
          content: `Create a brief executive summary:\n\n${paragraphContent}`
        }
      ],
      temperature: 0.3,
    });

    const fullContent = fullSummary.choices[0]?.message?.content || "";

    // Insert full-document summary
    await supabase
      .from("summaries")
      .insert({
        data_source_id: dataSourceId,
        parent_id: paragraphRecord?.id,
        content: fullContent,
        level: "full"
      });

  } catch (error) {
    console.error("Summary generation error:", error);
  }
}