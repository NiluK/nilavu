import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadZone } from "@/components/upload-zone";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "@clerk/nextjs";
import { ArrowLeft, Folder } from "lucide-react";
import Link from "next/link";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
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
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-2">
                <Folder className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">{project.name}</h1>
                {project.description && (
                  <p className="text-xs text-muted-foreground">
                    {project.description}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Upload Section */}
        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Add Sources</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload documents, paste URLs, or add audio files to your project
            </p>
          </div>
          <UploadZone projectId={projectId} />
        </section>

        {/* Data Sources Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Data Sources</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {dataSources?.length || 0} sources in this project
            </p>
          </div>

          {!dataSources || dataSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Folder className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sources yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Upload your first document or add a URL to get started
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Added
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dataSources.map((source) => (
                      <tr key={source.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium">{source.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {source.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              source.status === "processed"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : source.status === "processing"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                : source.status === "failed"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                            }`}
                          >
                            {source.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(source.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
