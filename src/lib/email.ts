const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const APP_NAME = "Dirección Monitoreo – Cordobeses en Alerta";

async function enviarEmail(to: string, subject: string, htmlContent: string): Promise<void> {
  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_FROM_NAME ?? APP_NAME,
        email: process.env.BREVO_FROM_EMAIL!,
      },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo error ${response.status}: ${body}`);
  }
}

export async function enviarAprobacionEdicion(to: string, nombreCompleto: string, permisoHasta: Date): Promise<void> {
  const fecha = permisoHasta.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  await enviarEmail(
    to,
    `[${APP_NAME}] Solicitud de actualización aprobada`,
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Solicitud aprobada</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px">
        Hola <strong>${nombreCompleto}</strong>, tu solicitud para actualizar tus datos fue <strong style="color:#16a34a">aprobada</strong>.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="margin:0;font-size:13px;color:#15803d">
          Tenés acceso para editar tu legajo hasta el <strong>${fecha}</strong>.
        </p>
      </div>
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Ingresá a la aplicación y dirigite a "Mi Legajo" para realizar los cambios.
      </p>
    </div>
    `,
  );
}

export async function enviarRechazoEdicion(to: string, nombreCompleto: string, motivo: string): Promise<void> {
  await enviarEmail(
    to,
    `[${APP_NAME}] Solicitud de actualización rechazada`,
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Solicitud rechazada</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px">
        Hola <strong>${nombreCompleto}</strong>, tu solicitud para actualizar tus datos fue <strong style="color:#dc2626">rechazada</strong>.
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Motivo</p>
        <p style="margin:0;font-size:14px;color:#7f1d1d">${motivo}</p>
      </div>
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Si tenés dudas, comunicate con el administrador del sistema.
      </p>
    </div>
    `,
  );
}

export async function enviarPermisoVencido(to: string, nombreCompleto: string): Promise<void> {
  await enviarEmail(
    to,
    `[${APP_NAME}] Tu permiso de edición venció`,
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Permiso vencido</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px">
        Hola <strong>${nombreCompleto}</strong>, tu permiso para editar tu legajo ha vencido.
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280">
        Si necesitás realizar más cambios, podés volver a solicitar una actualización desde "Mi Legajo".
      </p>
    </div>
    `,
  );
}

export async function enviarLegajoAprobado(to: string, nombreCompleto: string): Promise<void> {
  await enviarEmail(
    to,
    `[${APP_NAME}] Tu legajo fue aprobado`,
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Legajo aprobado</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px">
        Hola <strong>${nombreCompleto}</strong>, tu legajo fue <strong style="color:#16a34a">aprobado</strong>.
        Ya podés acceder a todos tus datos desde "Mi Legajo".
      </p>
    </div>
    `,
  );
}

export async function enviarLegajoRechazado(to: string, nombreCompleto: string, motivo: string): Promise<void> {
  await enviarEmail(
    to,
    `[${APP_NAME}] Tu legajo fue rechazado`,
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Legajo rechazado</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px">
        Hola <strong>${nombreCompleto}</strong>, tu legajo fue auditado por un administrador, siendo el mismo <strong style="color:#dc2626">rechazado</strong>.
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Motivo</p>
        <p style="margin:0;font-size:14px;color:#7f1d1d">${motivo}</p>
      </div>
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Ingresá a la aplicación y dirigite a "Mi Legajo" para corregir la información.
      </p>
    </div>
    `,
  );
}

export async function enviarCodigoEliminarUsuario(to: string, codigo: string, nombreObjetivo: string): Promise<void> {
  await enviarEmail(
    to,
    `[${APP_NAME}] Código para eliminar una cuenta`,
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Confirmá la eliminación de una cuenta</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
        Pediste eliminar la cuenta de <strong>${nombreObjetivo}</strong> en <strong>${APP_NAME}</strong>.
        Usá este código para confirmarlo.
      </p>
      <div style="background:#fef2f2;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:12px;color:#7f1d1d;text-transform:uppercase;letter-spacing:0.05em">
          Código de verificación
        </p>
        <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.15em;color:#111827;font-family:monospace">
          ${codigo}
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#9ca3af">Válido por 15 minutos</p>
      </div>
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Si no fuiste vos, ignorá este correo — la cuenta no se va a eliminar.
      </p>
    </div>
    `,
  );
}

export async function enviarCodigoReset(to: string, codigo: string): Promise<void> {
  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_FROM_NAME ?? APP_NAME,
        email: process.env.BREVO_FROM_EMAIL!,
      },
      to: [{ email: to }],
      subject: `[${APP_NAME}] Código de verificación`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Cambio de contraseña</h2>
          <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
            Recibiste este correo porque solicitaste cambiar tu contraseña en <strong>${APP_NAME}</strong>.
          </p>
          <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">
              Código de verificación
            </p>
            <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.15em;color:#111827;font-family:monospace">
              ${codigo}
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#9ca3af">Válido por 15 minutos</p>
          </div>
          <p style="margin:0;font-size:12px;color:#9ca3af">
            Si no solicitaste este cambio, podés ignorar este correo.
            Tu contraseña no será modificada.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo error ${response.status}: ${body}`);
  }
}
