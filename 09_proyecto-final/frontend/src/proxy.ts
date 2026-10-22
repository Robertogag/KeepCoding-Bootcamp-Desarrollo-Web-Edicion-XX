import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

const intl = createIntlMiddleware(routing);
const locales = routing.locales.join('|');
const privatePath = new RegExp(`^/(${locales})/app(?=/|$)`);
const authPath = new RegExp(`^/(${locales})/(login|register)(?=/|$)`);
const localePrefix = new RegExp(`^/(${locales})(?=/|$)`);

// La cookie de refresh nunca llega aquí (path /api/v1/auth); la marca oee_session decide la redirección.
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  const privateMatch = privatePath.exec(pathname);
  if (privateMatch && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = `/${privateMatch[1]}/login`;
    url.search = `?next=${encodeURIComponent(pathname.replace(localePrefix, '') + search)}`;
    return NextResponse.redirect(url);
  }

  const authMatch = authPath.exec(pathname);
  if (authMatch && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = `/${authMatch[1]}/app`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return intl(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
