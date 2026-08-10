import { prisma } from "@/lib/prisma";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

// Los 8 dígitos del medio de un CUIL (XX-DNI(8)-X) son el DNI. Se compara
// sin sacar ceros a la izquierda: es una posición fija dentro de un string
// de 11 dígitos, no un número.
function dniDeCuil(cuilDigits: string): string {
  return cuilDigits.length === 11 ? cuilDigits.slice(2, 10) : "";
}

async function buscarAgentePorVincular(
  datos: { cuil?: string | null; email: string }
): Promise<{ agente: { id: string; nombres: string; apellidos: string }; criterio: string } | null> {
  const cuil = datos.cuil?.replace(/\D/g, "") ?? "";
  if (cuil.length === 11) {
    const porCuil = await prisma.agente.findFirst({
      where: { cuil, usuarioId: null },
      select: { id: true, nombres: true, apellidos: true },
    });
    if (porCuil) return { agente: porCuil, criterio: "CUIL" };

    const dni = dniDeCuil(cuil);
    if (dni) {
      const candidatos = await prisma.agente.findMany({
        where: { usuarioId: null },
        select: { id: true, nombres: true, apellidos: true, cuil: true },
      });
      const porDni = candidatos.filter((a) => dniDeCuil(a.cuil.replace(/\D/g, "")) === dni);
      // Si matchea más de uno, los CUILs de esos legajos ya están mal entre
      // sí — no adivinamos cuál es, queda para que lo resuelva un admin.
      if (porDni.length === 1) return { agente: porDni[0], criterio: "DNI" };
    }
  }

  const emailNormalizado = datos.email.trim().toLowerCase();
  if (emailNormalizado) {
    const porEmail = await prisma.agente.findFirst({
      where: { email: { equals: emailNormalizado, mode: "insensitive" as const }, usuarioId: null },
      select: { id: true, nombres: true, apellidos: true },
    });
    if (porEmail) return { agente: porEmail, criterio: "email" };
  }

  return null;
}

// Cada cuenta nueva genera una notificación a los admins, se haya podido
// encontrar un legajo candidato o no — así se enteran de que alguien se
// registró sin tener que entrar a /configuracion/usuarios a revisar.
async function notificarAdmins(
  datos: { email: string; nombre?: string | null; apellido?: string | null },
  resultado: { agente: { id: string; nombres: string; apellidos: string }; criterio: string } | null,
  solicitudId: string | null
): Promise<void> {
  const admins = await prisma.usuario.findMany({
    where: { rol: { in: ROLES_ADMIN }, activo: true },
    select: { id: true },
  });
  if (admins.length === 0) return;

  const nombreMostrado = [datos.nombre, datos.apellido].filter(Boolean).join(" ") || datos.email;
  const mensaje = resultado
    ? `${nombreMostrado} (${datos.email}) se registró y coincide por ${resultado.criterio} con el legajo de ${resultado.agente.apellidos}, ${resultado.agente.nombres} — pendiente de tu confirmación.`
    : `${nombreMostrado} (${datos.email}) se registró y no encontramos un legajo para vincular. Asignale un rol o revisá su cuenta.`;

  await prisma.notificacion.createMany({
    data: admins.map((a) => ({
      usuarioId: a.id,
      tipo: resultado ? "VINCULACION_PENDIENTE" : "USUARIO_NUEVO",
      mensaje,
      referenciaId: resultado ? solicitudId : null,
    })),
  });
}

// Al crear la cuenta (registro), cruza el legajo cargado antes (ej. import
// de Excel) contra el CUIL declarado en el formulario de registro, después
// contra el DNI embebido en ese CUIL (por si el legajo tiene mal cargado el
// prefijo o el dígito verificador, pero el DNI del medio está bien) y, si
// tampoco matchea, contra el email — en ese orden de confiabilidad. El match
// nunca se aplica solo: crea una SolicitudVinculacion pendiente, porque el
// DNI de alguien es un dato bastante circulable como para dejar que alcance
// con conocerlo para acceder al legajo completo de otra persona (domicilio,
// salud, familia). Haya o no matcheado, se notifica a los admins.
export async function autoVincularLegajo(
  usuarioId: string,
  datos: { cuil?: string | null; email: string; nombre?: string | null; apellido?: string | null }
): Promise<boolean> {
  const resultado = await buscarAgentePorVincular(datos);

  let solicitudId: string | null = null;
  if (resultado) {
    const solicitud = await prisma.solicitudVinculacion.create({
      data: { usuarioId, agenteId: resultado.agente.id, criterio: resultado.criterio },
    });
    solicitudId = solicitud.id;
  }

  await notificarAdmins(datos, resultado, solicitudId);

  return resultado !== null;
}
