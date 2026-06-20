import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { journalEntrySchema } from '../ledger';

const VALID_UUID_1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const VALID_UUID_2 = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

describe('Ledger Double-Entry Validation', () => {
  it('should accept a balanced journal entry', () => {
    const payload = {
      entry_date: '2026-06-16',
      reference_no: 'TEST-001',
      description: 'Test entry',
      lines: [
        { account_id: VALID_UUID_1, debit: 1000, credit: 0 },
        { account_id: VALID_UUID_2, debit: 0, credit: 1000 }
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
        { account_id: VALID_UUID_1, debit: 1000, credit: 0 },
        { account_id: VALID_UUID_2, debit: 0, credit: 900 }
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
        { account_id: VALID_UUID_1, debit: 1000, credit: 1000 }
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
