import { describe, it, expect } from 'vitest';
import { journalEntrySchema } from '../ledger';

describe('Ledger Double-Entry Validation', () => {
  it('should accept a balanced journal entry', () => {
    const payload = {
      entry_date: '2026-06-16',
      reference_no: 'TEST-001',
      description: 'Test entry',
      lines: [
        { account_id: '11111111-1111-1111-1111-111111111111', debit: 1000, credit: 0 },
        { account_id: '22222222-2222-2222-2222-222222222222', debit: 0, credit: 1000 }
      ]
    };

    const result = journalEntrySchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should reject an unbalanced journal entry', () => {
    const payload = {
      entry_date: '2026-06-16',
      reference_no: 'TEST-002',
      description: 'Unbalanced entry',
      lines: [
        { account_id: '11111111-1111-1111-1111-111111111111', debit: 1000, credit: 0 },
        { account_id: '22222222-2222-2222-2222-222222222222', debit: 0, credit: 900 }
      ]
    };

    const result = journalEntrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject a line with both debit and credit', () => {
    const payload = {
      entry_date: '2026-06-16',
      reference_no: 'TEST-003',
      description: 'Invalid line entry',
      lines: [
        { account_id: '11111111-1111-1111-1111-111111111111', debit: 1000, credit: 1000 }
      ]
    };

    const result = journalEntrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject empty lines', () => {
    const payload = {
      entry_date: '2026-06-16',
      lines: []
    };

    const result = journalEntrySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
