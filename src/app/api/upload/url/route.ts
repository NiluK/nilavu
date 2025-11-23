import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import * as cheerio from 'cheerio';

// OpenAI client will be created inside the handler

export async function POST(request: NextRequest) {
  try {
    // Initialize OpenAI client with env check
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, url } = await request.json();

    if (!projectId || !url) {
      return NextResponse.json({ 
        error: "Project ID and URL are required" 
      }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ 
        error: "Invalid URL format" 
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

    // Check if URL already exists in this project
    const { data: existingSource } = await supabase
      .from("data_sources")
      .select("id, name")
      .eq("project_id", projectId)
      .eq("content_url", url)
      .single();

    if (existingSource) {
      return NextResponse.json({
        error: "This URL has already been added to the project",
        existingSource
      }, { status: 409 });
    }

    // Fetch and parse the webpage
    let extractedText = "";
    let title = "";
    let metadata: any = {
      originalUrl: url,
      scrapedAt: new Date().toISOString()
    };

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Nilavu Research Bot)'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract title
      title = $('title').text().trim() || 
              $('h1').first().text().trim() || 
              new URL(url).pathname.split('/').pop() || 
              'Untitled Document';

      // Remove script and style elements
      $('script, style, nav, footer, aside, .advertisement').remove();

      // Extract main content - prioritize article, main, or content containers
      let contentSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.content',
        '.post-content',
        '.entry-content',
        '.article-content',
        '.story-body',
        'body'
      ];

      let contentElement = null;
      for (const selector of contentSelectors) {
        contentElement = $(selector).first();
        if (contentElement.length > 0) break;
      }

      if (contentElement && contentElement.length > 0) {
        // Extract text content
        extractedText = contentElement.text()
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .trim();
      } else {
        // Fallback to body text
        extractedText = $('body').text()
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Extract additional metadata
      metadata.description = $('meta[name="description"]').attr('content') || '';
      metadata.author = $('meta[name="author"]').attr('content') || '';
      metadata.publishedTime = $('meta[property="article:published_time"]').attr('content') || 
                              $('meta[name="publishedDate"]').attr('content') || '';
      metadata.keywords = $('meta[name="keywords"]').attr('content') || '';
      metadata.wordCount = extractedText.split(' ').length;

    } catch (fetchError) {
      console.error("URL fetch error:", fetchError);
      return NextResponse.json({ 
        error: `Failed to fetch URL: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` 
      }, { status: 400 });
    }

    if (!extractedText || extractedText.length < 50) {
      return NextResponse.json({ 
        error: "Could not extract meaningful content from this URL" 
      }, { status: 400 });
    }

    // Create data source record
    const { data: dataSource, error: insertError } = await supabase
      .from("data_sources")
      .insert({
        project_id: projectId,
        type: "url",
        name: title,
        content_url: url,
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
    await generateSummaries(supabase, dataSource.id, extractedText, openai);

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
        status: "processed",
        extractedLength: extractedText.length
      }
    });

  } catch (error) {
    console.error("URL processing error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "URL processing failed" 
    }, { status: 500 });
  }
}

async function generateSummaries(supabase: any, dataSourceId: string, content: string, openai: OpenAI) {
  try {
    // Truncate content if too long
    const truncatedContent = content.length > 12000 ? 
      content.substring(0, 12000) + "..." : content;

    // Generate sentence-level summary (most detailed)
    const sentenceSummary = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a research analyst. Create a detailed sentence-level summary of the key points in this web content. Focus on facts, findings, and main arguments."
        },
        {
          role: "user",
          content: `Please create a detailed summary of this web content:\n\n${truncatedContent}`
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
          content: "Create a concise paragraph summary that captures the main themes and key points."
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
          content: "Create a concise, high-level summary in 2-3 sentences that captures the essence of this content."
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