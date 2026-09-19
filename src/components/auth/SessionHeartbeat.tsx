'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/activate',
  '/forgot-password',
  '/device-blocked',
  '/device-reset-request',
  '/subscription-expired',
  '/unauthorized',
  '/email-not-confirmed',
];

export function SessionHeartbeat() {
  const router = useRouter();
  const pathname = usePathname();
  const checkingRef = useRef(false);

  useEffect(() => {
    // Never run concurrent session kicks while the user is on public/auth routes
    if (PUBLIC_ROUTES.some((route) => pathname === route || pathname?.startsWith(`${route}/`))) {
      return;
    }

    let timer: NodeJS.Timeout;

    const verifySession = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          checkingRef.current = false;
          return;
        }

        const res = await fetch('/api/auth/session-check');
        const data = await res.json();

        if (res.status === 401 || data.active === false) {
          if (data.reason === 'superseded') {
            await supabase.auth.signOut();
            router.replace('/login?reason=concurrent_session');
          } else if (data.reason === 'missing_session_cookie') {
            // Attempt self-healing instead of kicking user off immediately
            try {
              await fetch('/api/auth/session-start', {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'content-type': 'application/json',
                  authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ accessToken: session.access_token }),
              });
            } catch (err) {
              console.warn('[SessionHeartbeat] Session restore error:', err);
            }
          }
        }
      } catch (err) {
        // Network glitches shouldn't immediately kick user off
        console.debug('[SessionHeartbeat] check error:', err);
      } finally {
        checkingRef.current = false;
      }
    };

    // Run check when window gains focus or tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifySession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', verifySession);

    // Periodic heartbeat every 25 seconds
    timer = setInterval(verifySession, 25000);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', verifySession);
    };
  }, [pathname, router]);

  return null;
}

