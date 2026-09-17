'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export function SessionHeartbeat() {
  const router = useRouter();
  const checkingRef = useRef(false);

  useEffect(() => {
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
          if (data.reason === 'superseded' || data.reason === 'missing_session_cookie') {
            await supabase.auth.signOut();
            router.replace('/login?reason=concurrent_session');
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
  }, [router]);

  return null;
}
