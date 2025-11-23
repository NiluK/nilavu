import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "@clerk/nextjs";
import { ArrowLeft, Folder, Table, Plus, Brain, TrendingUp } from "lucide-react";
import Link from "next/link";
import { SynthesisTable } from "@/components/synthesis-table";
import { TimelineView } from "@/components/timeline-view";
import { Button } from "@/components/ui/button";

interface SynthesisPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function SynthesisPage({ params }: SynthesisPageProps) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");

  const { projectId } = await params;
  const token = await getToken();
  const supabase = await createClient(token);

  // Fetch project details
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error || !project) {
    redirect("/dashboard");
  }

  // Fetch data sources for this project
  const { data: dataSources } = await supabase
    .from("data_sources")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "processed")
    .order("created_at", { ascending: false });

  // Fetch synthesis parameters
  const { data: synthesisParameters } = await supabase
    .from("synthesis_parameters")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true });

  // Fetch synthesis values
  const { data: synthesisValues } = await supabase
    .from("synthesis_values")
    .select(`
      *,
      parameter:synthesis_parameters(*),
      dataSource:data_sources(*)
    `)
    .eq("parameter.project_id", projectId);

  const processedCount = dataSources?.length || 0;
  const parametersCount = synthesisParameters?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/${projectId}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Project
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2">
                <Table className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Research Synthesis</h1>
                <p className="text-xs text-muted-foreground">
                  {project.name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <TimelineView 
              dataSources={dataSources || []}
              synthesisParameters={synthesisParameters || []}
              synthesisValues={synthesisValues || []}
            />
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Status Overview */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                <Folder className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{processedCount}</h3>
                <p className="text-sm text-muted-foreground">Processed Sources</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <Table className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{parametersCount}</h3>
                <p className="text-sm text-muted-foreground">Parameters Tracked</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900/30">
                <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">
                  {synthesisValues?.filter(v => v.confidence && v.confidence > 0.8).length || 0}
                </h3>
                <p className="text-sm text-muted-foreground">High Confidence Values</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Synthesis Table */}
        {processedCount === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <Table className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No processed sources yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mb-6">
              Upload and process some documents first to start building your synthesis matrix.
            </p>
            <Link href={`/dashboard/${projectId}`}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Sources
              </Button>
            </Link>
          </div>
        ) : (
          <SynthesisTable 
            projectId={projectId}
            dataSources={dataSources || []}
            synthesisParameters={synthesisParameters || []}
            synthesisValues={synthesisValues || []}
          />
        )}
      </main>
    </div>
  );
}