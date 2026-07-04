import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { saveDraftQuote } from '@/lib/actions/draftQuotes';
import type { CalculatorState } from '@/lib/store/calculatorTypes';

export type SyncState = 'saved' | 'saving' | 'error';

const DRAFT_KEYS: Array<keyof CalculatorState> = [
  'selectedSystemId',
  'selectedState',
  'projectType',
  'selectedGoalWattage',
  'selectedPanelId',
  'panelMix',
  'selectedInverterMix',
  'selectedBatteryMix',
  'selectedStructureId',
  'structurePricingMode',
  'solarMeterId',
  'solarMeterQty',
  'netMeterId',
  'netMeterQty',
  'lightningArresterId',
  'lightningArresterQty',
  'overrides',
  'customItems',
  'disabledItemIndices',
  'additionalCosts',
  'discountType',
  'discountVal',
  'marginMode',
  'targetMarginPct',
  'targetMarginAmount',
  'gstOnOutputOverride',
  'targetMRPInclGST',
  'targetMRPPerWatt',
  'itcEligible',
  'activeVariantId',
  'activeQuoteId',
];

export function pickCalculatorDraftState(snapshot: CalculatorState) {
  return DRAFT_KEYS.reduce((draft, key) => {
    if (Object.prototype.hasOwnProperty.call(snapshot as any, key)) {
      (draft as any)[key] = snapshot[key];
    }
    return draft;
  }, {} as Partial<CalculatorState>);
}

const ACTIVE_DRAFT_TAB_KEY = 'enermass-calculator-active-draft-tab';
const ACTIVE_DRAFT_TAB_TTL_MS = 10_000;

function createTabId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function canOwnDraftAutosave(tabId: string) {
  if (typeof window === 'undefined') return true;
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(ACTIVE_DRAFT_TAB_KEY);
    const current = raw ? JSON.parse(raw) : null;
    if (
      current?.tabId &&
      current.tabId !== tabId &&
      Number.isFinite(Number(current.ts)) &&
      now - Number(current.ts) < ACTIVE_DRAFT_TAB_TTL_MS
    ) {
      return false;
    }
    window.localStorage.setItem(ACTIVE_DRAFT_TAB_KEY, JSON.stringify({ tabId, ts: now }));
    return true;
  } catch {
    return true;
  }
}

export function useCalculatorAutoSave(initialDraftId: string | null) {
  const draftSignature = useCalculatorStore((snapshot) => JSON.stringify(pickCalculatorDraftState(snapshot)));
  const dbLoaded = useCalculatorStore((snapshot) => snapshot.dbLoaded);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const currentDraftId = useRef<string | null>(initialDraftId);
  const tabId = useMemo(createTabId, []);
  
  const [syncState, setSyncState] = useState<SyncState>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const save = useCallback(async () => {
    if (!canOwnDraftAutosave(tabId)) {
      setSyncState('saved');
      return;
    }
    setSyncState('saving');
    try {
      const snapshot = useCalculatorStore.getState();
      const draftSnapshot = pickCalculatorDraftState(snapshot);
      const result = await saveDraftQuote({
        draftId: currentDraftId.current,
        calculatorState: JSON.stringify(draftSnapshot),
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
  }, [tabId]);

  useEffect(() => {
    if (initialDraftId && !currentDraftId.current) {
      currentDraftId.current = initialDraftId;
    }
  }, [initialDraftId]);

  useEffect(() => {
    const releaseOwnership = () => {
      try {
        const raw = window.localStorage.getItem(ACTIVE_DRAFT_TAB_KEY);
        const current = raw ? JSON.parse(raw) : null;
        if (current?.tabId === tabId) {
          window.localStorage.removeItem(ACTIVE_DRAFT_TAB_KEY);
        }
      } catch {}
    };

    window.addEventListener('beforeunload', releaseOwnership);
    return () => window.removeEventListener('beforeunload', releaseOwnership);
  }, [tabId]);

  useEffect(() => {
    // Debounce: save 2 seconds after the draft fields change.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    
    // Don't save if state is basically empty (e.g., initial load)
    if (!dbLoaded) return;
    if (!canOwnDraftAutosave(tabId)) {
      setSyncState('saved');
      return;
    }
    
    setSyncState('saving');
    saveTimer.current = setTimeout(save, 2000);
    
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draftSignature, dbLoaded, save, tabId]);
  
  return { draftId: currentDraftId.current, syncState, lastSaved, forceSave: save };
}
