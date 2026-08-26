import { redirect } from "next/navigation";

// Login y registro se unificaron en una sola pantalla con pestañas en
// /login — esta ruta queda solo para no romper links/bookmarks viejos.
export default function SignupPage() {
  redirect("/login?tab=signup");
}
