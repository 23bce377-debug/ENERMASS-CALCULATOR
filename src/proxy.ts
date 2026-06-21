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
  '/projects',
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

function unauthorizedApiResponse() {
  return NextResponse.json(
    { error: 'AuthenticationRequiredError', message: 'Please sign in to continue.', redirectTo: '/login' },
    { status: 401 }
  )
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
    return response
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
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect logged-in users away from login only after the licensed device handoff exists.
  if (user && pathname === '/login' && request.cookies.has(DEVICE_TOKEN_COOKIE_NAME)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/calculator'
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export default proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
