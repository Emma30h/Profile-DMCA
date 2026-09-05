import LogoLoader from "@/components/LogoLoader";

// Se muestra automáticamente (Suspense boundary de Next) mientras el Server
// Component de la ruta (login/page.tsx, que consulta stats+rangos) resuelve
// — el layout de (auth) (fondo aurora + link "Volver") sigue montado
// alrededor, solo se reemplaza la tarjeta. Mismo patrón que
// (dashboard)/loading.tsx.
export default function Loading() {
  return (
    <div className="w-full flex items-center justify-center">
      <LogoLoader fullScreen={false} background="transparent" />
    </div>
  );
}
