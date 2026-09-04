// Fondo liso del sistema Industry (var(--t-bg), responde al toggle de
// landing/Acceso) en vez del degradé aurora-blob anterior — comparte esta
// pantalla con /verificar-cuenta y /cambiar-contrasena, que no forman parte
// del handoff de diseño pero quedan con el mismo marco alrededor.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative h-dvh flex [align-items:safe_center] justify-center overflow-y-auto py-4 px-4 sm:px-6 sm:py-8 lg:px-8 lg:py-6"
      // color explícito: sin esto, el texto sin color propio (el h1 de
      // AuthScreen, por ejemplo) heredaba --foreground del body, que es el
      // token del tema del DASHBOARD (data-theme, casi blanco por defecto) —
      // esta pantalla usa data-tema/--t-fg, un sistema aparte que nunca pisa
      // --foreground. En modo claro quedaba texto casi blanco sobre fondo
      // gris claro, ilegible.
      style={{ background: "var(--t-bg)", color: "var(--t-fg)" }}
    >
      {children}
    </div>
  );
}
