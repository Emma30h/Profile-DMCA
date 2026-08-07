import { createClient } from "@/lib/supabase/client";

const BUCKET = "fotos-legajos";

export async function comprimirFoto(file: File | Blob, rotacionGrados = 0): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const anchoEscalado = Math.round(img.width * scale);
      const altoEscalado = Math.round(img.height * scale);
      const invertido = rotacionGrados === 90 || rotacionGrados === 270;

      const canvas = document.createElement("canvas");
      canvas.width = invertido ? altoEscalado : anchoEscalado;
      canvas.height = invertido ? anchoEscalado : altoEscalado;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotacionGrados * Math.PI) / 180);
      ctx.drawImage(img, -anchoEscalado / 2, -altoEscalado / 2, anchoEscalado, altoEscalado);

      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo procesar la imagen"));
      }, "image/jpeg", 0.85);
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = url;
  });
}

export async function subirFotoStorage(
  file: File | Blob,
  agenteId: string,
  rotacionGrados = 0,
  path: string = `${agenteId}/foto.jpg`
): Promise<string | null> {
  try {
    const blob = await comprimirFoto(file, rotacionGrados);
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // La URL pública es siempre la misma para este agente (mismo path); sin
    // un query param que cambie, el navegador/CDN sigue sirviendo la versión
    // vieja cacheada después de reemplazar la foto.
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch {
    return null;
  }
}
