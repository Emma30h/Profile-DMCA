// Rasteriza un nodo del DOM a PNG y lo descarga — mismo mecanismo que ya
// usa OrganigramaChart.tsx (html2canvas-pro, no el html2canvas clásico: ese
// no sabe parsear los oklch() de Tailwind v4), factorizado acá para no
// repetirlo en cada tarjeta con botón de descarga. scale:3 (vs. el 2 que
// usa el organigrama) porque estos gráficos son mucho más chicos, así que
// el costo de rasterizar en más resolución es bajo y da mejor calidad para
// usar en una presentación.
export async function descargarNodoComoImagen(node: HTMLElement, nombreArchivo: string, backgroundColor = "#ffffff"): Promise<void> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(node, { backgroundColor, scale: 3, useCORS: true });
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
