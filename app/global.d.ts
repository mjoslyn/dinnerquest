import {} from 'hono'

type Head = {
  title?: string
  description?: string
  ogTitle?: string
  ogDescription?: string
  themeClass?: string
}

declare module 'hono' {
  interface Env {
    Variables: {}
    Bindings: {
      SUPABASE_URL: string
      SUPABASE_ANON_KEY: string
      SUPABASE_SERVICE_ROLE_KEY: string
    }
  }
  interface ContextRenderer {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (content: string | Promise<string>, head?: Head): Response | Promise<Response>
  }
}
