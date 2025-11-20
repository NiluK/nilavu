'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export async function getProjects() {
  const { userId, getToken } = await auth()
  if (!userId) redirect('/sign-in')

  const token = await getToken()
  const supabase = await createClient(token)
  
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return projects
}

export async function createProject(formData: FormData) {
  const { userId, getToken } = await auth()
  if (!userId) redirect('/sign-in')

  const name = formData.get('name') as string
  const description = formData.get('description') as string

  if (!name) {
    return { error: 'Project name is required' }
  }

  const token = await getToken()
  const supabase = await createClient(token)

  const { error } = await supabase
    .from('projects')
    .insert({
      name,
      description,
      user_id: userId,
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
