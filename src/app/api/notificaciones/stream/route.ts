import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { id: true, activo: true },
  });
  if (!usuario) return new Response("Not found", { status: 404 });
  if (!usuario.activo) return new Response("Forbidden", { status: 403 });

  const usuarioId = usuario.id;
  let lastSeenAt = new Date();
  let cancelled = false;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const POLL_MS = 1500;
      const MAX_MS = 44_000;
      const startedAt = Date.now();

      const poll = async () => {
        if (cancelled || Date.now() - startedAt > MAX_MS) {
          if (!cancelled) controller.close();
          return;
        }

        try {
          // Verificar si la cuenta fue deshabilitada
          const u = await prisma.usuario.findUnique({
            where: { id: usuarioId },
            select: { activo: true },
          });

          if (!u || !u.activo) {
            controller.enqueue(encoder.encode("event: forzarLogout\ndata: {}\n\n"));
            controller.close();
            return;
          }

          // Notificaciones nuevas
          const nuevas = await prisma.notificacion.findMany({
            where: { usuarioId, createdAt: { gt: lastSeenAt } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              tipo: true,
              mensaje: true,
              referenciaId: true,
              leida: true,
              createdAt: true,
            },
          });

          if (nuevas.length > 0) {
            lastSeenAt = nuevas[0].createdAt;
            const payload = JSON.stringify(
              nuevas.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))
            );
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          } else {
            controller.enqueue(encoder.encode(": ping\n\n"));
          }
        } catch {
          controller.close();
          return;
        }

        if (!cancelled) setTimeout(poll, POLL_MS);
      };

      setTimeout(poll, POLL_MS);
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
