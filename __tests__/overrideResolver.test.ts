/**
 * overrideResolver.test.ts — Tests for the 4-level priority chain.
 *
 * Priority (highest → lowest):
 * 1. Row-level override (manual per-row rate)
 * 2. Org rate master (org-wide rate override)
 * 3. State-specific override
 * 4. Category default (fallback)
 */

import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveRate,
  resolveEffectiveMargin,
  resolveWithPriorityChain,
} from '../src/lib/engine/overrideResolver';

describe('resolveEffectiveRate — Priority Chain', () => {
  const rateMaster = {
    'DC Cable': { rate: 12, active: true },
    'AC Cable': { rate: 25, active: false }, // inactive
  };
  const stateOverrides = {
    'DC Cable': 15,
  };

  it('row_override wins over everything', () => {
    const result = resolveEffectiveRate('DC Cable', 10, 999, rateMaster, stateOverrides);
    expect(result.rate).toBe(999);
    expect(result.source).toBe('row_override');
  });

  it('org rate_master wins over state and default', () => {
    const result = resolveEffectiveRate('DC Cable', 10, undefined, rateMaster, stateOverrides);
    expect(result.rate).toBe(12);
    expect(result.source).toBe('org_rate_master');
  });

  it('inactive rate_master entry falls through to state override', () => {
    const result = resolveEffectiveRate('AC Cable', 10, undefined, rateMaster, { 'AC Cable': 20 });
    expect(result.rate).toBe(20);
    expect(result.source).toBe('state_override');
  });

  it('state_override wins over default when no rate_master entry', () => {
    const result = resolveEffectiveRate('Earthing Kit', 10, undefined, rateMaster, { 'Earthing Kit': 8 });
    expect(result.rate).toBe(8);
    expect(result.source).toBe('state_override');
  });

  it('falls back to category_default when no overrides apply', () => {
    const result = resolveEffectiveRate('Unknown Item', 50, undefined, {}, {});
    expect(result.rate).toBe(50);
    expect(result.source).toBe('category_default');
  });

  it('rowOverride = 0 is respected (falsy check must not skip)', () => {
    const result = resolveEffectiveRate('DC Cable', 10, 0, rateMaster, stateOverrides);
    expect(result.rate).toBe(0);
    expect(result.source).toBe('row_override');
  });
});

describe('resolveEffectiveMargin — Priority Chain', () => {
  const orgMargins = { 'residential': 0.25, 'commercial': 0.20 };
  const stateMargins = { 'residential': 0.15 };

  it('org override wins over state and default', () => {
    const result = resolveEffectiveMargin('residential', 0.10, orgMargins, stateMargins);
    expect(result.marginPct).toBe(0.25);
    expect(result.source).toBe('org_override');
  });

  it('state override wins over default when no org override', () => {
    const result = resolveEffectiveMargin('residential', 0.10, {}, stateMargins);
    expect(result.marginPct).toBe(0.15);
    expect(result.source).toBe('state_override');
  });

  it('falls back to category_default', () => {
    const result = resolveEffectiveMargin('industrial', 0.18, {}, {});
    expect(result.marginPct).toBe(0.18);
    expect(result.source).toBe('category_default');
  });

  it('margin of 0 from org override is respected', () => {
    const result = resolveEffectiveMargin('residential', 0.10, { 'residential': 0 }, stateMargins);
    expect(result.marginPct).toBe(0);
    expect(result.source).toBe('org_override');
  });
});

describe('resolveWithPriorityChain', () => {
  it('returns first non-undefined value', () => {
    const result = resolveWithPriorityChain([
      { value: undefined, source: 'first' },
      { value: 42, source: 'second' },
      { value: 99, source: 'third' },
    ]);
    expect(result?.value).toBe(42);
    expect(result?.source).toBe('second');
  });

  it('returns undefined when all values are undefined', () => {
    const result = resolveWithPriorityChain([
      { value: undefined, source: 'first' },
      { value: undefined, source: 'second' },
    ]);
    expect(result).toBeUndefined();
  });

  it('returns first value when it is 0 (falsy but defined)', () => {
    const result = resolveWithPriorityChain([
      { value: 0, source: 'first' },
      { value: 99, source: 'second' },
    ]);
    expect(result?.value).toBe(0);
    expect(result?.source).toBe('first');
  });

  it('returns first value when it is empty string (falsy but defined)', () => {
    const result = resolveWithPriorityChain([
      { value: '', source: 'first' },
      { value: 'fallback', source: 'second' },
    ]);
    expect(result?.value).toBe('');
    expect(result?.source).toBe('first');
  });
});
