// El buscador y la lista viven en layout.tsx (así se mantienen montados al
// navegar a /personal/[id]); esta page sólo existe para que /personal sea
// una ruta válida. Sin selección, PersonalMasterShell ya muestra el estado
// vacío por su cuenta.
export default function PersonalPage() {
  return null;
}
