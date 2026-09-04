import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerStatsPublicas } from "@/lib/statsPublicas";
import Landing from "@/components/landing/Landing";

// "/" ahora es pública (ver PUBLIC_ROUTES en proxy.ts) — un visitante sin
// sesión ve la landing institucional; uno con sesión sigue yendo directo al
// dashboard, igual que antes.
export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const stats = await obtenerStatsPublicas();
  return <Landing stats={stats} />;
}
