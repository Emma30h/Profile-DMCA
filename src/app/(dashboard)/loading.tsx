import LogoLoader from "@/components/LogoLoader";

// Alto real del header del dashboard (h-14 + 1px de borde, Header.tsx). Antes
// este wrapper usaba h-full, que depende de que 100% se resuelva bien a
// través de los flex anidados (Sidebar/Header/<main>) — en la práctica el
// loader quedaba pegado arriba de <main> con mucho espacio vacío abajo en vez
// de centrado en el alto visible real. calc(100dvh - ALTO_HEADER) no depende
// de esa cadena, igual que ya se hace en Landing.tsx.
const ALTO_HEADER = 57;

export default function Loading() {
  return (
    // pb-[8vh]: el centrado vertical exacto quedaba un poco bajo a la vista
    // (el ojo pesa más que el label de abajo) — el padding-bottom reduce el
    // alto "disponible" solo por abajo, así items-center corre el loader un
    // poco más arriba sin tocar su propio centrado horizontal.
    <div className="flex items-center justify-center pb-[20vh]" style={{ minHeight: `calc(100dvh - ${ALTO_HEADER}px)` }}>
      <LogoLoader fullScreen={false} background="transparent" />
    </div>
  );
}
