import Handlebars from 'handlebars';

// Formats a number to INR currency representation (e.g., 140000 -> ₹1,40,000)
Handlebars.registerHelper('inr', (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return '₹0';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(numValue);
});

// Formats an ISO string date to "dd MMMM yyyy" format (e.g. "2026-06-27" -> "27 June 2026")
Handlebars.registerHelper('formatDate', (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return iso;
  }
});

// Checks strict equality (e.g. {{#if (eq state "Kerala")}} ... {{/if}})
Handlebars.registerHelper('eq', (a: any, b: any) => {
  return a === b;
});

// Adds two numbers (useful for calculating 1-based indices in loops)
Handlebars.registerHelper('add', (a: number, b: number) => {
  return (a || 0) + b;
});

// Formats numbers with standard decimal places
Handlebars.registerHelper('decimal', (value: number | string, decimals = 2) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0';
  return numValue.toFixed(decimals);
});
