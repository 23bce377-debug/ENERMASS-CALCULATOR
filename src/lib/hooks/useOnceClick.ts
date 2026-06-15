import { useState, useCallback } from 'react';

export function useOnceClick(fn: () => Promise<void>) {
  const [loading, setLoading] = useState(false);
  
  const handler = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fn();
    } finally {
      setLoading(false);
    }
  }, [fn, loading]);

  return { handler, loading };
}
