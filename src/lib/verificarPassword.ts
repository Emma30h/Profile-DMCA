import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Verifica la contraseña de un usuario sin tocar su sesión actual: un cliente
// efímero que solo se usa para este chequeo puntual y se descarta.
export async function verificarPassword(email: string, password: string): Promise<boolean> {
  const clienteEfimero = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { error } = await clienteEfimero.auth.signInWithPassword({ email, password });
  return !error;
}
