import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/*
 * Primera barrera de acceso. Con Supabase configurado, renueva la sesión y
 * envía a «Entrar» a quien no la tenga o no sea la propietaria. La
 * autorización definitiva está en las rutas de API y en la base de datos.
 */

const PUBLIC_PATHS = ["/entrar"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isApi = pathname.startsWith("/api/");
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const isOwner = Boolean(owner && data.user?.email?.toLowerCase() === owner);

  if (!isOwner && !isPublic && !isApi) {
    const target = request.nextUrl.clone();
    target.pathname = "/entrar";
    target.search = data.user ? "?error=acceso" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(target);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|robots.txt).*)"],
};
