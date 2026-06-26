import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEVICE_TOKEN_COOKIE_NAME = 'enermass_device_token'

const protectedRoutes = [
  '/calculator',
  '/dashboard',
  '/dashboards',
  '/erp',
  '/inventory',
  '/master',
  '/quotes',
  '/reports',
  '/settings',
  '/super-admin',
  '/api/bundles',
  '/api/sync',
  '/api/procurement',
  '/api/finance',
  '/api/profile',
  '/api/settings',
  '/api/super-admin',
  '/api/master',
  '/api/calculator',
  '/api/erp',
  '/api/inventory',
  '/api/admin',
]

const publicRoutes = [
  '/login',
  '/signup',
  '/device-blocked',
  '/device-reset-request',
  '/subscription-expired',
  '/api/auth',
  '/public',
]

function pathMatchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

function addSecurityHeaders(response: NextResponse) {
  // Generate a random nonce for CSP
  const array = new Uint8Array(16)
  globalThis.crypto.getRandomValues(array)
  const nonce = btoa(String.fromCharCode(...array))

  // Basic CSP: Self, strict-dynamic for scripts, allow fonts/images/connects
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://apis.google.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' blob: data: https:;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in https://ipapi.co;
    frame-ancestors 'none';
    form-action 'self';
  `.replace(/\s{2,}/g, ' ').trim()

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  return response
}

function unauthorizedApiResponse() {
  const response = NextResponse.json(
    { error: 'AuthenticationRequiredError', message: 'Please sign in to continue.', redirectTo: '/login' },
    { status: 401 }
  )
  return addSecurityHeaders(response)
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublicRoute = pathMatchesPrefix(pathname, publicRoutes)
  const isProtectedRoute = pathMatchesPrefix(pathname, protectedRoutes)
  const isApiRoute = pathname.startsWith('/api/')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-enermass-pathname', request.nextUrl.pathname)
  requestHeaders.set('x-enermass-search', request.nextUrl.search)
  requestHeaders.set('x-enermass-url', request.nextUrl.href)

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  if (!isProtectedRoute && !isPublicRoute) {
    return addSecurityHeaders(response)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && isProtectedRoute) {
    if (isApiRoute) {
      return unauthorizedApiResponse()
    }

    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return addSecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  // Redirect logged-in users away from login only after the licensed device handoff exists.
  if (user && pathname === '/login' && request.cookies.has(DEVICE_TOKEN_COOKIE_NAME)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/calculator'
    return addSecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  return addSecurityHeaders(response)
}

export default proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
