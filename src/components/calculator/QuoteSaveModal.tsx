'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { STATE_DATA } from '@/lib/data/masters';
import { X, CheckCircle2 } from 'lucide-react';
import type { CustomerInfo, AddressInfo, SiteInfo, SalesInfo, Quote } from '@/lib/types/quote';

interface QuoteSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (quote: Quote) => void;
}

const STEPS = ['Project', 'Address', 'Site', 'Sales'];

export function QuoteSaveModal({ isOpen, onClose, onSaved }: QuoteSaveModalProps) {
  const saveQuote = useCalculatorStore((s) => s.saveQuote);
  
  const [step, setStep] = useState(0);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', phone: '', whatsapp: '', email: '' });
  const [address, setAddress] = useState<AddressInfo>({ line1: '', line2: '', city: '', state: 'Gujarat', pin: '' });
  const [site, setSite] = useState<SiteInfo>({ meterNo: '', sanctionedLoad: '', monthlyBill: 0, roofType: 'RCC', roofArea: 0 });
  const [sales, setSales] = useState<SalesInfo>({ projectTitle: '', execName: '', notes: '', saleType: 'New' });

  // Client-side mounting for portal
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSave = () => {
    const validationError = validateQuoteBasics(customer, sales);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setFormError(null);
      const quote = saveQuote({ customer, address, site, sales });
      setSavedQuoteId(quote.quoteId);
      onSaved(quote);
    } catch (err) {
      alert('Error saving quote. Please ensure a system is selected and calculations are complete.');
    }
  };

  const handleClose = () => {
    setSavedQuoteId(null);
    setFormError(null);
    setStep(0);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-active shrink-0">
          <h2 className="text-lg font-bold text-text-primary">Save Quote</h2>
          {!savedQuoteId && (
            <button onClick={handleClose} className="p-1 rounded hover:bg-background text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {savedQuoteId ? (
            <div className="py-8 flex flex-col items-center text-center space-y-4 animate-fade-in">
              <CheckCircle2 size={64} className="text-success" />
              <div>
                <h3 className="text-xl font-bold text-text-primary mb-2">Quote Saved Successfully</h3>
                <p className="text-text-muted mb-4">You can access this quote in the Quotes section.</p>
                <div className="inline-block px-4 py-2 rounded-lg bg-background border border-border text-lg font-mono font-bold text-accent">
                  {savedQuoteId}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stepper */}
              <div className="flex items-center justify-between mb-8">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex flex-col items-center gap-2 relative z-10 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i === step ? 'bg-accent text-background ring-4 ring-accent/20' : 
                      i < step ? 'bg-accent/20 text-accent' : 'bg-background border border-border text-text-muted'
                    }`}>
                      {i + 1}
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${i <= step ? 'text-text-primary' : 'text-text-muted'}`}>
                      {s}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div className={`absolute top-4 left-1/2 w-full h-0.5 -z-10 ${i < step ? 'bg-accent/40' : 'bg-border'}`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Form Panels */}
              {formError && (
                <div className="p-2.5 rounded-lg border border-error/30 bg-error/8 text-xs text-error">
                  {formError}
                </div>
              )}

              {step === 0 && (
                <div className="space-y-4 animate-fade-in">
                  <Input label="Project Title" value={sales.projectTitle} onChange={(v) => setSales({...sales, projectTitle: v})} required />
                  <Input label="Customer Name" value={customer.name} onChange={(v) => setCustomer({...customer, name: v})} required />
                  <Input label="Phone Number" value={customer.phone} onChange={(v) => setCustomer({...customer, phone: v})} required />
                  <Input label="WhatsApp Number" value={customer.whatsapp} onChange={(v) => setCustomer({...customer, whatsapp: v})} />
                  <Input label="Email Address" value={customer.email} onChange={(v) => setCustomer({...customer, email: v})} type="email" />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <Input label="Address Line 1" value={address.line1} onChange={(v) => setAddress({...address, line1: v})} />
                  <Input label="Address Line 2" value={address.line2} onChange={(v) => setAddress({...address, line2: v})} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="City" value={address.city} onChange={(v) => setAddress({...address, city: v})} />
                    <Input label="PIN Code" value={address.pin} onChange={(v) => setAddress({...address, pin: v})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">State</label>
                    <select 
                      value={address.state} 
                      onChange={(e) => setAddress({...address, state: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent"
                    >
                      {Object.keys(STATE_DATA).map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Meter Number" value={site.meterNo} onChange={(v) => setSite({...site, meterNo: v})} />
                    <Input label="Sanctioned Load (kW)" value={site.sanctionedLoad} onChange={(v) => setSite({...site, sanctionedLoad: v})} />
                  </div>
                  <Input label="Avg Monthly Bill (₹)" type="number" value={String(site.monthlyBill || '')} onChange={(v) => setSite({...site, monthlyBill: Number(v)})} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-text-secondary">Roof Type</label>
                      <select 
                        value={site.roofType} 
                        onChange={(e) => setSite({...site, roofType: e.target.value as SiteInfo['roofType']})}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent"
                      >
                        <option value="RCC">RCC</option>
                        <option value="Metal Sheet">Metal Sheet</option>
                        <option value="Tin">Tin</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <Input label="Roof Area (sq ft)" type="number" value={String(site.roofArea || '')} onChange={(v) => setSite({...site, roofArea: Number(v)})} />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <Input label="Sales Executive" value={sales.execName} onChange={(v) => setSales({...sales, execName: v})} required />
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">Sale Type</label>
                    <div className="flex gap-2">
                      {['New', 'Upgrade', 'Referral'].map((t) => (
                        <label key={t} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer p-2 border border-border rounded-lg flex-1 hover:bg-surface-hover">
                          <input 
                            type="radio" 
                            name="saleType" 
                            checked={sales.saleType === t} 
                            onChange={() => setSales({...sales, saleType: t as SalesInfo['saleType']})} 
                            className="text-accent focus:ring-accent"
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">Additional Notes</label>
                    <textarea 
                      value={sales.notes} 
                      onChange={(e) => setSales({...sales, notes: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent min-h-20"
                      placeholder="Special requirements or observations..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-surface-active flex items-center justify-between shrink-0">
          {savedQuoteId ? (
            <button onClick={handleClose} className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-background font-bold transition-colors">
              Close
            </button>
          ) : (
            <>
              <button 
                onClick={step === 0 ? handleClose : () => setStep(step - 1)} 
                className="px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-surface-hover transition-colors font-medium text-sm"
              >
                {step === 0 ? 'Cancel' : 'Back'}
              </button>
              
              <button 
                onClick={() => {
                  if (step === 0) {
                    const validationError = validateQuoteBasics(customer, sales, true);
                    if (validationError) {
                      setFormError(validationError);
                      return;
                    }
                    setFormError(null);
                  }
                  if (step === 3) {
                    handleSave();
                    return;
                  }
                  setFormError(null);
                  setStep(step + 1);
                }} 
                className="px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-background font-bold transition-colors text-sm"
              >
                {step === 3 ? 'Create Quote PDF' : 'Next'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function validateQuoteBasics(customer: CustomerInfo, sales: SalesInfo, skipSalesCheck = false): string | null {
  if (!sales.projectTitle.trim()) return 'Project Title is required.';
  if (!customer.name.trim()) return 'Customer Name is required.';
  if (!customer.phone.trim()) return 'Phone Number is required.';
  const phoneDigits = customer.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) return 'Phone Number should be at least 10 digits.';
  if (!skipSalesCheck && !sales.execName.trim()) return 'Sales Executive name is required.';
  return null;
}

function Input({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-secondary">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent"
        placeholder={`Enter ${label.toLowerCase()}`}
      />
    </div>
  );
}

