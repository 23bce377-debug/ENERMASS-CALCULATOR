import QRCode from 'qrcode';

export const ENERMASS_UPI_ID = 'enermass@barodampay';
export const ENERMASS_PAYEE_NAME = 'Enermass Power Solutions Pvt. Ltd.';

export interface UpiPaymentInput {
  amount: number;
  reference: string;
  note?: string;
  payeeAddress?: string;
  payeeName?: string;
}

export interface UpiPaymentPayload {
  deepLink: string;
  amount: string;
  payeeAddress: string;
  payeeName: string;
  reference: string;
}

function sanitizeText(value: string, fallback: string): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean || fallback;
}

export function formatUpiAmount(value: number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '0.00';
  return amount.toFixed(2);
}

export function buildUpiPaymentPayload(input: UpiPaymentInput): UpiPaymentPayload {
  const amount = formatUpiAmount(input.amount);
  const payeeAddress = sanitizeText(input.payeeAddress || ENERMASS_UPI_ID, ENERMASS_UPI_ID);
  const payeeName = sanitizeText(input.payeeName || ENERMASS_PAYEE_NAME, ENERMASS_PAYEE_NAME);
  const reference = sanitizeText(input.reference, `QUOTE-${Date.now()}`);
  const note = sanitizeText(input.note || `Solar quote ${reference}`, `Solar quote ${reference}`);

  const params = [
    ['pa', payeeAddress],
    ['pn', payeeName],
    ['am', amount],
    ['cu', 'INR'],
    ['tn', note],
    ['tr', reference],
  ] as const;

  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return {
    deepLink: `upi://pay?${query}`,
    amount,
    payeeAddress,
    payeeName,
    reference,
  };
}

export async function createUpiQrDataUri(payload: UpiPaymentPayload): Promise<string> {
  return QRCode.toDataURL(payload.deepLink, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
    type: 'image/png',
  });
}
