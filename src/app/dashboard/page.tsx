import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getProjects, createProject } from './actions'
import { Plus, Folder } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ThemeToggle } from '@/components/theme-toggle'

export default async function DashboardPage() {
  const { userId } = await auth()
  const user = await currentUser()

  if (!userId || !user) {
    redirect('/sign-in')
  }

  const projects = await getProjects()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-2">
              <Folder className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Nilavu</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">{user.emailAddresses[0].emailAddress}</span>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your content generation projects
            </p>
          </div>
        </div>

        {/* Project List */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <Folder className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Get started by creating your first project to organize your data sources and summaries.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <h3 className="relative text-lg font-semibold">
                  {project.name}
                </h3>
                <p className="relative mt-2 text-sm text-muted-foreground line-clamp-2">
                  {project.description || 'No description provided'}
                </p>
                <div className="relative mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Simple Create Form for Verification */}
        <div className="mt-12 rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
          <form action={createProject} className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">Project Name</label>
              <input
                type="text"
                name="name"
                id="name"
                required
                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="My Awesome Project"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
              <input
                type="text"
                name="description"
                id="description"
                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Optional description"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create Project
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
