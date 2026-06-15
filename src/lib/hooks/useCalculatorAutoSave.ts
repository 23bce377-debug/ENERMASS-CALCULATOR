import { useEffect, useRef, useCallback, useState } from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { saveDraftQuote } from '@/lib/actions/draftQuotes';

export type SyncState = 'saved' | 'saving' | 'error';

export function useCalculatorAutoSave(initialDraftId: string | null) {
  const state = useCalculatorStore();
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const currentDraftId = useRef<string | null>(initialDraftId);
  
  const [syncState, setSyncState] = useState<SyncState>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const save = useCallback(async () => {
    setSyncState('saving');
    try {
      const snapshot = useCalculatorStore.getState();
      const result = await saveDraftQuote({
        draftId: currentDraftId.current,
        calculatorState: JSON.stringify(snapshot),
        systemName: snapshot.dbSystems.find(s => s.id === snapshot.selectedSystemId)?.name ?? 'Untitled System',
        systemKw: snapshot.dbSystems.find(s => s.id === snapshot.selectedSystemId)?.capacityKW ?? 0,
        estimatedTotal: snapshot.calcResult?.finalCustomerPrice ?? 0,
      });
      if (result.draftId && !currentDraftId.current) {
        currentDraftId.current = result.draftId;
      }
      setSyncState('saved');
      setLastSaved(new Date());
    } catch (e) {
      console.error("Auto-save failed:", e);
      setSyncState('error');
    }
  }, []);

  useEffect(() => {
    if (initialDraftId && !currentDraftId.current) {
      currentDraftId.current = initialDraftId;
    }
  }, [initialDraftId]);

  useEffect(() => {
    // Debounce: save 2 seconds after last change
    if (saveTimer.current) clearTimeout(saveTimer.current);
    
    // Don't save if state is basically empty (e.g., initial load)
    const snapshot = useCalculatorStore.getState();
    if (!snapshot.dbLoaded) return;
    
    setSyncState('saving');
    saveTimer.current = setTimeout(save, 2000);
    
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, save]);
  
  return { draftId: currentDraftId.current, syncState, lastSaved, forceSave: save };
}
