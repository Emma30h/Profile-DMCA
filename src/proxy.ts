import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/signup", "/verificar-cuenta", "/cambiar-contrasena"];

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    url.startsWith("https://") &&
    !url.includes("[project-ref]") &&
    key.length > 20
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  // Las Server Actions POSTean a la URL actual (ej. una action llamada desde
  // /login justo después de un login recién hecho, donde Supabase ya ve al
  // usuario autenticado aunque nuestra tabla lo tenga como inactivo). Si acá
  // las redirigimos, el cliente recibe una respuesta HTML común en vez del
  // formato que espera el protocolo de Server Actions y explota con
  // "unexpected response was received from the server". Cada action ya
  // valida sesión/rol por su cuenta, así que alcanza con dejarlas pasar.
  const isServerAction = request.headers.get("next-action") !== null;

  // Si Supabase no está configurado (variables placeholder), permitir todo el tráfico
  // pero redirigir rutas protegidas a /login para que el dev vea la UI.
  if (!isSupabaseConfigured()) {
    if (!isPublicRoute && process.env.NODE_ENV === "production") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refrescar sesión si está por vencer
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isServerAction) {
    // Usuario autenticado intenta acceder a /login → redirigir al dashboard
    if (user && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Usuario no autenticado intenta acceder a ruta protegida → redirigir al login
    if (!user && !isPublicRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
