import { prisma } from "@/lib/prisma";
import AuthScreen from "./AuthScreen";

// Login y registro viven en una sola pantalla con pestañas (antes eran
// /login y /signup por separado) — /signup ahora solo redirige acá con
// ?tab=signup para no romper links viejos.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string }>;
}) {
  const { error, tab } = await searchParams;

  const [totalAgentes, rangos] = await Promise.all([
    prisma.agente.count(),
    prisma.rango.findMany({
      select: { nombre: true, cuerpo: true },
      orderBy: { orden: "asc" },
    }),
  ]);

  return (
    <AuthScreen
      initialTab={tab === "signup" ? "signup" : "login"}
      initialError={error === "cuenta_deshabilitada" ? "Tu cuenta fue deshabilitada. Contactá a un administrador." : null}
      rangos={rangos}
      stats={{
        agentes: totalAgentes,
        // Turnos y tipos de personal: catálogos fijos (ver comentario sobre
        // Agente.turno en el schema y el enum TipoPersonal), no una cuenta
        // en vivo — a diferencia de agentes y rangos, que sí varían.
        turnos: 10,
        tipos: 4,
        rangos: rangos.length,
      }}
    />
  );
}
