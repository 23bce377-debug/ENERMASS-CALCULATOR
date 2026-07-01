import { describe, expect, it } from 'vitest';
import {
  buildUpiPaymentPayload,
  createUpiQrDataUri,
  ENERMASS_UPI_ID,
  formatUpiAmount,
} from '@/lib/payments/upi';

describe('UPI payment QR payload', () => {
  it('formats UPI amounts with exactly two decimals', () => {
    expect(formatUpiAmount(190388)).toBe('190388.00');
    expect(formatUpiAmount(190388.5)).toBe('190388.50');
    expect(formatUpiAmount(-10)).toBe('0.00');
  });

  it('builds an Enermass UPI deep link with encoded quote details', () => {
    const payload = buildUpiPaymentPayload({
      amount: 190388,
      reference: 'QT-20260701-1IC3',
      note: 'Solar quote QT-20260701-1IC3',
    });

    expect(payload.payeeAddress).toBe(ENERMASS_UPI_ID);
    expect(payload.deepLink).toContain('upi://pay?');
    expect(payload.deepLink).toContain('pa=enermass%40barodampay');
    expect(payload.deepLink).toContain('pn=Enermass%20Power%20Solutions%20Pvt.%20Ltd.');
    expect(payload.deepLink).toContain('am=190388.00');
    expect(payload.deepLink).toContain('cu=INR');
    expect(payload.deepLink).toContain('tn=Solar%20quote%20QT-20260701-1IC3');
    expect(payload.deepLink).toContain('tr=QT-20260701-1IC3');
  });

  it('creates a local QR data URI without external services', async () => {
    const payload = buildUpiPaymentPayload({
      amount: 1000,
      reference: 'QT-TEST',
    });

    const qr = await createUpiQrDataUri(payload);
    expect(qr).toMatch(/^data:image\/png;base64,/);
  });
});
