import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.CLERK_SECRET_KEY! // Using Clerk Secret Key? No, we need Supabase Service Key to run admin commands.
  // Wait, I don't have the Service Key. I only have ANON_KEY.
  // I cannot enable RLS or create policies with ANON_KEY.
  // The user provided "api key" in the prompt earlier. Let's check if it was the service key.
  // "api key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFndHVpcXdoaGFseXJ1Y2RqamtuIiwicm9sZSI6ImFub24i..."
  // "role": "anon" -> It is the ANON key.
  
  // I cannot execute DDL (CREATE POLICY) via the Client with Anon key.
  // I need to use the Postgres connection string to run SQL.
  // I have DATABASE_URL in .env.local.
)

// So I will use 'postgres' library to run the SQL.
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

async function main() {
  try {
    console.log('Enabling RLS on projects table...')
    await sql`ALTER TABLE projects ENABLE ROW LEVEL SECURITY;`

    console.log('Creating policies...')
    // Policy for SELECT
    await sql`
      CREATE POLICY "Users can view their own projects"
      ON projects
      FOR SELECT
      USING (
        (select auth.jwt()->>'sub') = user_id
      );
    `

    // Policy for INSERT
    await sql`
      CREATE POLICY "Users can insert their own projects"
      ON projects
      FOR INSERT
      WITH CHECK (
        (select auth.jwt()->>'sub') = user_id
      );
    `

    // Policy for UPDATE
    await sql`
      CREATE POLICY "Users can update their own projects"
      ON projects
      FOR UPDATE
      USING (
        (select auth.jwt()->>'sub') = user_id
      );
    `

    // Policy for DELETE
    await sql`
      CREATE POLICY "Users can delete their own projects"
      ON projects
      FOR DELETE
      USING (
        (select auth.jwt()->>'sub') = user_id
      );
    `

    console.log('RLS policies created successfully.')
  } catch (error) {
    console.error('Error creating policies:', error)
  } finally {
    await sql.end()
  }
}

main()
