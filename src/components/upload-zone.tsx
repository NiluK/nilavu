"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, Link as LinkIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface UploadFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
}

interface UploadZoneProps {
  projectId: string;
  onUploadComplete?: () => void;
}

export function UploadZone({ projectId, onUploadComplete }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [url, setUrl] = useState("");
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substring(7),
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "audio/mpeg": [".mp3"],
      "audio/mp4": [".m4a"],
      "audio/wav": [".wav"],
      "text/plain": [".txt"],
    },
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddUrl = async () => {
    if (!url.trim()) return;
    
    setIsAddingUrl(true);
    try {
      // TODO: Implement URL upload
      console.log("Adding URL:", url);
      setUrl("");
    } catch (error) {
      console.error("Error adding URL:", error);
    } finally {
      setIsAddingUrl(false);
    }
  };

  const handleUpload = async () => {
    // TODO: Implement file upload
    console.log("Uploading files:", files);
  };

  return (
    <div className="space-y-6">
      {/* Drag and Drop Zone */}
      <Card className="p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">
            {isDragActive ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Supports: PDF, DOCX, PPTX, MP3, M4A, WAV, TXT
          </p>
        </div>
      </Card>

      {/* URL Input */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <LinkIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <Input
            type="url"
            placeholder="Paste a URL to add web content..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            className="flex-1"
          />
          <Button
            onClick={handleAddUrl}
            disabled={!url.trim() || isAddingUrl}
            size="sm"
          >
            {isAddingUrl ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Add URL"
            )}
          </Button>
        </div>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Files to Upload ({files.length})</h3>
            <Button onClick={handleUpload} size="sm">
              Upload All
            </Button>
          </div>
          <div className="space-y-2">
            {files.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {uploadFile.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(uploadFile.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
