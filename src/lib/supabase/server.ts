import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    url.startsWith("https://") &&
    !url.includes("[project-ref]") &&
    key.length > 20
  );
}

export async function createClient() {
  if (!isSupabaseConfigured()) {
    // Retornar un cliente mock cuando Supabase no está configurado (desarrollo sin credenciales)
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ data: null, error: { message: "Supabase no configurado" } }),
        signOut: async () => ({ error: null }),
        exchangeCodeForSession: async () => ({ data: { user: null }, error: null }),
        verifyOtp: async () => ({ data: null, error: null }),
        updateUser: async () => ({ data: null, error: null }),
        resetPasswordForEmail: async () => ({ data: null, error: null }),
        signInWithOAuth: async () => ({ data: null, error: null }),
      },
    } as ReturnType<typeof createServerClient>;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // En Server Components no se pueden setear cookies; el proxy lo maneja
          }
        },
      },
    }
  );
}
