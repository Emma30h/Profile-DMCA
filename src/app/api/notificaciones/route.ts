import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([]);

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { id: true },
  });
  if (!usuario) return NextResponse.json([]);

  const notifs = await prisma.notificacion.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, tipo: true, mensaje: true, referenciaId: true, leida: true, createdAt: true },
  });

  return NextResponse.json(
    notifs.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))
  );
}
