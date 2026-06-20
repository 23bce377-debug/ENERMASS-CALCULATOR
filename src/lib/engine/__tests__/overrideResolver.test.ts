import { describe, it, expect } from 'vitest';
import { resolveEffectiveRate, resolveEffectiveMargin, resolveWithPriorityChain } from '../overrideResolver';

describe('overrideResolver', () => {
  it('resolves rate row override as highest priority', () => {
    const res = resolveEffectiveRate('Panel', 10, 15, { 'Panel': { rate: 12, active: true } }, { 'Panel': 11 });
    expect(res.rate).toBe(15);
    expect(res.source).toBe('row_override');
  });

  it('resolves rate master override over category default', () => {
    const res = resolveEffectiveRate('Panel', 10, undefined, { 'Panel': { rate: 12, active: true } }, { 'Panel': 11 });
    expect(res.rate).toBe(12);
    expect(res.source).toBe('org_rate_master');
  });

  it('resolves state override over category default', () => {
    const res = resolveEffectiveRate('Panel', 10, undefined, undefined, { 'Panel': 11 });
    expect(res.rate).toBe(11);
    expect(res.source).toBe('state_override');
  });

  it('falls back to category default', () => {
    const res = resolveEffectiveRate('Panel', 10);
    expect(res.rate).toBe(10);
    expect(res.source).toBe('category_default');
  });

  it('priority chain works', () => {
    const res = resolveWithPriorityChain([
      { value: undefined, source: '1' },
      { value: 'found', source: '2' },
      { value: 'ignored', source: '3' }
    ]);
    expect(res).toEqual({ value: 'found', source: '2' });
  });

  it('priority chain returns undefined if all undefined', () => {
    const res = resolveWithPriorityChain([
      { value: undefined, source: '1' }
    ]);
    expect(res).toBeUndefined();
  });
});
