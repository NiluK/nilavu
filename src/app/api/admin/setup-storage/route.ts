import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ 
        error: "Supabase configuration missing" 
      }, { status: 500 });
    }

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Create documents bucket
    const { data, error } = await serviceClient.storage
      .createBucket('documents', {
        public: true,
        allowedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          'audio/mpeg',
          'audio/mp4',
          'audio/wav'
        ],
        fileSizeLimit: 50 * 1024 * 1024 // 50MB
      });

    if (error && !error.message.includes('already exists')) {
      console.error("Storage bucket creation error:", error);
      return NextResponse.json({ 
        error: `Failed to create storage bucket: ${error.message}` 
      }, { status: 500 });
    }

    // List existing buckets to verify
    const { data: buckets, error: listError } = await serviceClient.storage.listBuckets();
    
    return NextResponse.json({
      success: true,
      message: error?.message.includes('already exists') 
        ? "Documents bucket already exists" 
        : "Documents bucket created successfully",
      buckets: buckets?.map(b => b.name) || []
    });

  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Setup failed" 
    }, { status: 500 });
  }
}