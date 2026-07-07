'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { STATE_DATA } from '@/lib/data/masters';
import { X, CheckCircle2, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';
import type { CustomerInfo, AddressInfo, SiteInfo, SalesInfo, Quote } from '@/lib/types/quote';
import { fetchQuotesForCurrentUser } from '@/lib/hooks/useQuotes';

interface QuoteSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (quote: Quote) => void;
  acknowledgedGuards?: string[];
  leadId?: string | null;
}

interface SalesExecutiveOption {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

const STEPS = ['Project', 'Address', 'Site', 'Sales', 'Proposal Customization'];
const DEFAULT_STATE = 'Gujarat';
const MANUAL_SALES_EXECUTIVE_ID = '__manual__';

// Last-resort, state-agnostic fallback used only when the database has no T&C
// template (global or state-specific). The authoritative source is the
// state_terms_templates table, surfaced via the store's dbStateTerms map.
const DEFAULT_TERMS = [
  "This proposal is valid for the period stated herein. Upon expiry, all quoted prices are subject to revision at the Company's sole discretion.",
  "Payment schedule: 50% advance against a confirmed purchase order, 40% prior to dispatch of material, and the balance 10% upon successful grid commissioning.",
  "Installation shall be completed within 15 working days of receipt of the advance payment. Final commissioning remains subject to DISCOM inspection and approval, which typically requires 30 to 45 days.",
  "Solar PV modules are covered by a 12-year manufacturer product warranty and a 30-year linear performance warranty.",
  "The grid-tie inverter carries a 10-year manufacturer warranty from the date of commissioning.",
  "The mounting structure is warranted for 5 years against structural integrity and galvanisation defects.",
  "The scope of supply includes one (1) year of complimentary maintenance support, comprising four (4) scheduled preventive maintenance visits from the date of commissioning.",
  "The Company shall provide liaison assistance for feasibility approval and net-metering registration. All statutory timelines remain subject to clearances from the concerned DISCOM and electrical authorities.",
  "Disbursement of the PM Surya Ghar Central Financial Assistance is administered through the National Portal and is typically credited within 60 to 90 days of net-meter commissioning.",
  "Applicable Goods and Services Tax is levied in accordance with prevailing Government of India notifications and is included in the quoted value.",
  "Any civil, electrical, or structural work beyond the agreed scope of supply shall be treated as a separately chargeable additional item."
];

const DEFAULT_WHY_SOLAR = {
  benefits: [
    "Reduce electricity bills by 70–90%",
    "25-year system lifespan",
    "Protection against rising tariffs",
    "Earn via net metering & grid export",
    "Increases property value",
    "Zero carbon emissions"
  ],
  reasons: [
    "MNRE Empanelled EPC Contractor",
    "13+ Years in Solar Energy Sector",
    "5500+ Solar Projects Commissioned",
    "25+ MW Aggregate Capacity commissioned",
    "Full DISCOM & net metering support",
    "ISO 9001:2015 certified"
  ],
  warranties: [
    "25-year panel power output warranty",
    "5–10 year inverter manufacturer warranty",
    "10-year structural warranty on MMS",
    "2-year workmanship warranty",
    "MNRE certified Tier-1 equipment",
    "BIS / IEC 61215 certified"
  ],
  promises: [
    "Dedicated project manager assigned",
    "Proactive DISCOM support",
    "Commissioning & handover report",
    "Annual performance monitoring",
    "Responsive WhatsApp & call support",
    "+91-81 380 27336"
  ]
};

function formatRoleLabel(role: string) {
  return role
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || 'Sales Executive';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function QuoteSaveModal({ isOpen, onClose, onSaved, acknowledgedGuards = [], leadId = null }: QuoteSaveModalProps) {
  const saveQuote = useCalculatorStore((s) => s.saveQuote);
  const loadQuote = useCalculatorStore((s) => s.loadQuote);
  const activeQuoteId = useCalculatorStore((s) => s.activeQuoteId);
  const itcEligible = useCalculatorStore((s) => s.itcEligible);
  const dbStateData = useCalculatorStore((s) => s.dbStateData);
  const storeSelectedState = useCalculatorStore((s) => s.selectedState);
  const setStoreSelectedState = useCalculatorStore((s) => s.setState);
  const dbStateTerms = useCalculatorStore((s) => s.dbStateTerms);
  const queryClient = useQueryClient();

  // Resolve the editable T&C for the current state: state template → global
  // default → hardcoded last-resort fallback. The master template is never mutated;
  // edits made here are snapshotted into the quote's own terms_json on save.
  const resolveStateTerms = useCallback((stateName = storeSelectedState): string[] => {
    const forState = dbStateTerms?.[stateName];
    if (forState && forState.length > 0) return forState;
    const globalDefault = dbStateTerms?.['__default__'];
    if (globalDefault && globalDefault.length > 0) return globalDefault;
    return DEFAULT_TERMS;
  }, [dbStateTerms, storeSelectedState]);

  const stateOptions = useMemo(
    () => (Object.keys(dbStateData).length > 0 ? Object.keys(dbStateData) : Object.keys(STATE_DATA))
      .map(st => ({ value: st, label: st })),
    [dbStateData]
  );

  const [step, setStep] = useState(0);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showConflict, setShowConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadingConflict, setReloadingConflict] = useState(false);

  // Form states
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', phone: '', whatsapp: '', email: '', isGstRegistered: false });
  const [address, setAddress] = useState<AddressInfo>({ line1: '', line2: '', city: '', state: storeSelectedState || DEFAULT_STATE, pin: '' });
  const [site, setSite] = useState<SiteInfo>({ meterNo: '', sanctionedLoad: '', monthlyBill: 0, roofType: 'RCC', roofArea: 0 });
  const [sales, setSales] = useState<SalesInfo>({ projectTitle: '', execName: '', notes: '', saleType: 'New' });

  // Customizable fields
  const [companyCin, setCompanyCin] = useState('U74999KL2018PTC053947');
  const [companyGstin, setCompanyGstin] = useState('32AAFCE1087R1ZA');
  const [companyPan, setCompanyPan] = useState('AAFCE1087R');
  const [companyPhone, setCompanyPhone] = useState('+91-81 380 27336');
  const [companyEmail, setCompanyEmail] = useState('info@enermass.in');
  const [companyWebsite, setCompanyWebsite] = useState('www.enermass.in');
  const [companyAddress, setCompanyAddress] = useState('First Floor, AVM Complex, Chirangara Koratty Post, Thrissur, Kerala - 680 308');
  const [ceoName, setCeoName] = useState('Mr. Manoj M S');
  const [ceoDesignation, setCeoDesignation] = useState('Chief Executive Officer');
  const [ceoSignatureUrl, setCeoSignatureUrl] = useState('');
  const [salesExecRole, setSalesExecRole] = useState('Sales Executive');
  const [salesExecPhone, setSalesExecPhone] = useState('');
  const [salesExecEmail, setSalesExecEmail] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('Enermass Power Solutions Pvt. Ltd.');
  const [bankName, setBankName] = useState('bank of Baroda, Koratty');
  const [bankAccountNo, setBankAccountNo] = useState('85080200000055');
  const [bankIfsc, setBankIfsc] = useState('BARB0KORATT');
  const [bankUpiId, setBankUpiId] = useState('enermass@barodampay');
  const [terms, setTerms] = useState<string[]>(DEFAULT_TERMS);
  const [whySolar, setWhySolar] = useState<any>(DEFAULT_WHY_SOLAR);
  const [pdfSubSection, setPdfSubSection] = useState<'ceo_sales' | 'company' | 'bank' | 'terms'>('ceo_sales');



  const syncQuoteState = useCallback((stateName: string, resetTerms = true) => {
    const nextState = stateName || DEFAULT_STATE;
    setAddress((prev) => ({ ...prev, state: nextState }));
    setStoreSelectedState(nextState);
    if (resetTerms && !activeQuoteId) {
      setTerms(resolveStateTerms(nextState));
    }
  }, [activeQuoteId, resolveStateTerms, setStoreSelectedState]);

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCeoSignatureUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };



  // Client-side mounting for portal
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape' && !savedQuoteId) {
        handleClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
        );
        
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Focus first input or wrapper
      setTimeout(() => {
        if (modalRef.current) {
          const firstInput = modalRef.current.querySelector('input, select, textarea, button') as HTMLElement;
          if (firstInput) firstInput.focus();
          else modalRef.current.focus();
        }
      }, 50);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, savedQuoteId]);



  useEffect(() => {
    if (!isOpen || !leadId) return;

    const fetchLeadInfo = async () => {
      try {
        const { data: lead, error } = await supabase
          .from('crm_leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle();

        if (error) throw error;
        if (lead) {
          setCustomer({
            name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
            phone: lead.phone,
            whatsapp: lead.phone,
            email: lead.email || '',
            isGstRegistered: false
          });

          setSite((prev: any) => ({
            ...prev,
            monthlyBill: lead.monthly_bill || 0,
            roofArea: lead.roof_area_estimate || 0
          }));

          setSales((prev: any) => ({
            ...prev,
            notes: `Converted from Lead ID: ${leadId}`
          }));

          const { data: survey } = await supabase
            .from('crm_site_surveys')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (survey) {
            const surveyState = survey.state_name || storeSelectedState || DEFAULT_STATE;
            setAddress({
              line1: survey.address_line1 || '',
              line2: survey.address_line2 || '',
              city: survey.city || '',
              state: surveyState,
              pin: survey.pincode || ''
            });
            setStoreSelectedState(surveyState);
            setTerms(resolveStateTerms(surveyState));

            setSite((prev: any) => ({
              ...prev,
              meterNo: survey.meter_number || '',
              sanctionedLoad: survey.sanctioned_load_kw ? String(survey.sanctioned_load_kw) : '',
              roofType: survey.roof_type || 'RCC'
            }));
          }
        }
      } catch (err) {
        console.error('Failed to prefill lead info:', err);
      }
    };

    fetchLeadInfo();
  }, [isOpen, leadId, resolveStateTerms, setStoreSelectedState, storeSelectedState]);

  // Prefill when editing active quote
  const quotes = useCalculatorStore((s) => s.quotes);
  useEffect(() => {
    if (isOpen && activeQuoteId) {
      const activeQuote = quotes.find((q) => q.quoteId === activeQuoteId);
      if (activeQuote) {
        setCustomer(activeQuote.customer);
        setAddress(activeQuote.address);
        setStoreSelectedState(activeQuote.address.state || activeQuote.selectedState || storeSelectedState || DEFAULT_STATE);
        setSite(activeQuote.site);
        setSales(activeQuote.sales);
        setCompanyCin(activeQuote.company_cin || 'U74999KL2018PTC053947');
        setCompanyGstin(activeQuote.company_gstin || '32AAFCE1087R1ZA');
        setCompanyPan(activeQuote.company_pan || 'AAFCE1087R');
        setCompanyPhone(activeQuote.company_phone || '+91-81 380 27336');
        setCompanyEmail(activeQuote.company_email || 'info@enermass.in');
        setCompanyWebsite(activeQuote.company_website || 'www.enermass.in');
        setCompanyAddress(activeQuote.company_address || 'First Floor, AVM Complex, Chirangara Koratty Post, Thrissur, Kerala - 680 308');
        setCeoName(activeQuote.ceo_name || 'Mr. Manoj M S');
        setCeoDesignation(activeQuote.ceo_designation || 'Chief Executive Officer');
        setCeoSignatureUrl(activeQuote.ceo_signature_url || '');
        setSalesExecRole(activeQuote.sales_exec_role || 'Sales Executive');
        setSalesExecPhone(activeQuote.sales_exec_phone || '');
        setSalesExecEmail(activeQuote.sales_exec_email || '');
        setBankAccountHolder(activeQuote.bank_account_holder || 'Enermass Power Solutions Pvt. Ltd.');
        setBankName(activeQuote.bank_name || 'bank of Baroda, Koratty');
        setBankAccountNo(activeQuote.bank_account_no || '85080200000055');
        setBankIfsc(activeQuote.bank_ifsc || 'BARB0KORATT');
        setBankUpiId(activeQuote.bank_upi_id || 'enermass@barodampay');
        // Existing quote: keep its saved snapshot; otherwise load the state template.
        setTerms(activeQuote.terms_json && activeQuote.terms_json.length > 0 ? activeQuote.terms_json : resolveStateTerms(activeQuote.address.state || activeQuote.selectedState));
        setWhySolar(activeQuote.why_solar_json || DEFAULT_WHY_SOLAR);
      }
    } else if (isOpen && !activeQuoteId) {
      setCompanyCin('U74999KL2018PTC053947');
      setCompanyGstin('32AAFCE1087R1ZA');
      setCompanyPan('AAFCE1087R');
      setCompanyPhone('+91-81 380 27336');
      setCompanyEmail('info@enermass.in');
      setCompanyWebsite('www.enermass.in');
      setCompanyAddress('First Floor, AVM Complex, Chirangara Koratty Post, Thrissur, Kerala - 680 308');
      setCeoName('Mr. Manoj M S');
      setCeoDesignation('Chief Executive Officer');
      setCeoSignatureUrl('');
      setSalesExecRole('Sales Executive');
      setSalesExecPhone('');
      setSalesExecEmail('');
      setBankAccountHolder('Enermass Power Solutions Pvt. Ltd.');
      setBankName('bank of Baroda, Koratty');
      setBankAccountNo('85080200000055');
      setBankIfsc('BARB0KORATT');
      setBankUpiId('enermass@barodampay');
      setAddress((prev) => ({ ...prev, state: storeSelectedState || DEFAULT_STATE }));
      // New quote: auto-load the selected state's T&C (editable before generating).
      setTerms(resolveStateTerms());
      setWhySolar(DEFAULT_WHY_SOLAR);
    }
  }, [isOpen, activeQuoteId, resolveStateTerms, setStoreSelectedState, storeSelectedState]);

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

  const handleSave = async (forceOverwrite = false) => {
    const validationError = validateQuoteBasics(customer, sales, false, salesExecPhone, salesExecEmail);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    try {
      setFormError(null);
      const salesWithItc = { ...sales, itcEligible };
      const quote = await saveQuote({
        customer,
        address,
        site,
        sales: salesWithItc,
        validationAcknowledged: acknowledgedGuards,
        leadId,
        company_cin: companyCin,
        company_gstin: companyGstin,
        company_pan: companyPan,
        company_phone: companyPhone,
        company_email: companyEmail,
        company_website: companyWebsite,
        company_address: companyAddress,
        ceo_name: ceoName,
        ceo_designation: ceoDesignation,
        ceo_signature_url: ceoSignatureUrl,
        sales_exec_role: salesExecRole,
        sales_exec_phone: salesExecPhone,
        sales_exec_email: salesExecEmail.trim() || undefined,
        sales_exec_id: null,
        bank_account_holder: bankAccountHolder,
        bank_name: bankName,
        bank_account_no: bankAccountNo,
        bank_ifsc: bankIfsc,
        bank_upi_id: bankUpiId,
        terms_json: terms,
        why_solar_json: whySolar,
      }, forceOverwrite);

      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setSavedQuoteId(quote.quoteId);
      setShowConflict(false);
      onSaved(quote);
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message === 'CONCURRENCY_CONFLICT') {
        setShowConflict(true);
      } else {
        setFormError(err instanceof Error ? err.message : 'Error saving quote. Please check connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSavedQuoteId(null);
    setFormError(null);
    setShowConflict(false);
    setStep(0);
    onClose();
  };

  const handleDiscardAndReload = async () => {
    if (!activeQuoteId) return;
    setReloadingConflict(true);
    setFormError(null);
    try {
      const latestQuotes = await fetchQuotesForCurrentUser();
      queryClient.setQueryData(['quotes'], latestQuotes);
      useCalculatorStore.setState({ quotes: latestQuotes });
      loadQuote(activeQuoteId);
      handleClose();
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : 'Failed to reload the latest quote from the database.');
    } finally {
      setReloadingConflict(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-modal-backdrop flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div ref={modalRef} tabIndex={-1} className="w-full max-w-5xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] outline-none">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-active shrink-0">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Create Quote PDF</h2>
            <p className="text-xs text-text-muted mt-0.5">
              State, customer details, and printable terms are captured before generation.
            </p>
          </div>
          {!savedQuoteId && (
            <button onClick={handleClose} className="p-1 rounded hover:bg-background text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1">
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
          ) : showConflict ? (
            <div className="py-6 flex flex-col items-center text-center space-y-4 animate-fade-in">
              <div className="p-3 bg-warning/15 text-warning rounded-full">
                <RotateCcw size={48} className="rotate-45" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Concurrency Conflict Detected</h3>
                <p className="text-sm text-text-muted max-w-sm mb-4">
                  This quote has been modified by another user since you loaded it. Saving now will overwrite their updates.
                </p>
                <div className="text-xs text-text-muted bg-background/50 border border-border rounded-lg p-3 text-left space-y-1">
                  <p><strong>Quote ID:</strong> {activeQuoteId}</p>
                  <p><strong>Option 1:</strong> Overwrite their changes and force save your version.</p>
                  <p><strong>Option 2:</strong> Discard your changes and reload their latest version.</p>
                  <p><strong>Option 3:</strong> Cancel and go back to edit the details.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
              <aside className="lg:sticky lg:top-0 self-start rounded-xl border border-border bg-background/60 overflow-hidden">
                {STEPS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStep(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/60 last:border-b-0 transition-colors ${
                      i === step ? 'bg-accent-glow text-accent' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === step ? 'bg-accent text-background' : i < step ? 'bg-accent/20 text-accent' : 'bg-surface border border-border text-text-muted'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide">{s}</span>
                  </button>
                ))}
                <div className="p-4 border-t border-border text-xs">
                  <p className="text-text-muted">Selected state</p>
                  <p className="mt-1 font-bold text-text-primary">{address.state || storeSelectedState || DEFAULT_STATE}</p>
                </div>
              </aside>

              <div className="space-y-6 min-w-0">
                {/* Form Panels */}
                {formError && (
                  <div className="p-2.5 rounded-lg border border-error/30 bg-error/8 text-xs text-error">
                    {formError}
                  </div>
                )}

              {step === 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Project Title" value={sales.projectTitle} onChange={(e) => setSales({...sales, projectTitle: e.target.value})} required />
                    <Input label="Customer Name" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} required />
                    <Input label="Phone Number" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} required />
                    <Input label="WhatsApp Number" value={customer.whatsapp} onChange={(e) => setCustomer({...customer, whatsapp: e.target.value})} />
                    <Input label="Email Address" value={customer.email} onChange={(e) => setCustomer({...customer, email: e.target.value})} type="email" />
                  </div>

                  {itcEligible && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-hover mt-2">
                      <div>
                        <p className="text-sm font-medium text-text-primary">Customer is GST Registered</p>
                        <p className="text-xs text-text-muted">Required to claim ITC benefits.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={!!customer.isGstRegistered}
                          onChange={(e) => setCustomer({ ...customer, isGstRegistered: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <Input label="Address Line 1" value={address.line1} onChange={(e) => setAddress({...address, line1: e.target.value})} />
                  <Input label="Address Line 2" value={address.line2} onChange={(e) => setAddress({...address, line2: e.target.value})} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="City" value={address.city} onChange={(e) => setAddress({...address, city: e.target.value})} />
                    <Input label="PIN Code" value={address.pin} onChange={(e) => setAddress({...address, pin: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">State</label>
                    <Select
                      value={address.state}
                      onChange={(v) => syncQuoteState(v)}
                      options={stateOptions}
                    />
                    <p className="text-[11px] text-text-muted">
                      This state also updates the calculator/BOM state and auto-loads the matching terms template.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Meter Number" value={site.meterNo} onChange={(e) => setSite({...site, meterNo: e.target.value})} />
                    <Input label="Sanctioned Load (kW)" value={site.sanctionedLoad} onChange={(e) => setSite({...site, sanctionedLoad: e.target.value})} />
                  </div>
                  <Input label="Avg Monthly Bill (₹)" type="number" value={String(site.monthlyBill || '')} onChange={(e) => setSite({...site, monthlyBill: Number(e.target.value)})} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-text-secondary">Roof Type</label>
                      <Select
                        value={site.roofType}
                        onChange={(v) => setSite({...site, roofType: v as SiteInfo['roofType']})}
                        options={[
                          { value: 'RCC', label: 'RCC' },
                          { value: 'Metal Sheet', label: 'Metal Sheet' },
                          { value: 'Tin', label: 'Tin' },
                          { value: 'Other', label: 'Other' },
                        ]}
                      />
                    </div>
                    <Input label="Roof Area (sq ft)" type="number" value={String(site.roofArea || '')} onChange={(e) => setSite({...site, roofArea: Number(e.target.value)})} />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Sales Executive"
                      value={sales.execName}
                      onChange={(e) => {
                        setSales({ ...sales, execName: e.target.value });
                        setFormError(null);
                      }}
                      required
                    />
                    <Input
                      label="Sales Executive Phone"
                      value={salesExecPhone}
                      onChange={(e) => {
                        setSalesExecPhone(e.target.value);
                        setFormError(null);
                      }}
                      required
                    />
                    <Input
                      label="Sales Executive Email"
                      value={salesExecEmail}
                      onChange={(e) => {
                        setSalesExecEmail(e.target.value);
                        setFormError(null);
                      }}
                      type="email"
                      placeholder="name@example.com"
                    />
                  </div>
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

              {step === 4 && (
                <div className="space-y-4 animate-fade-in">
                  {/* Sub-tab navigation */}
                  <div className="flex border-b border-border text-xs mb-4 overflow-x-auto whitespace-nowrap">
                    {(['ceo_sales', 'company', 'bank', 'terms'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setPdfSubSection(tab)}
                        className={`px-3 py-2 font-semibold capitalize border-b-2 -mb-[2px] transition-colors ${
                          pdfSubSection === tab
                            ? 'border-accent text-accent'
                            : 'border-transparent text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {tab === 'ceo_sales' ? 'CEO Details' : tab === 'company' ? 'Company Profile' : tab === 'bank' ? 'Bank Details' : 'Terms & Conditions'}
                      </button>
                    ))}
                  </div>

                  {pdfSubSection === 'ceo_sales' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input label="CEO Name" value={ceoName} onChange={(e) => setCeoName(e.target.value)} />
                          <Input label="CEO Designation" value={ceoDesignation} onChange={(e) => setCeoDesignation(e.target.value)} />
                        </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-text-secondary">CEO Signature Image (Base64 file upload)</label>
                        <div className="flex gap-4 items-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleSignatureUpload}
                            className="text-xs text-text-muted file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-surface-hover file:text-text-primary hover:file:bg-surface-active cursor-pointer"
                          />
                          {ceoSignatureUrl && (
                            <button
                              type="button"
                              onClick={() => setCeoSignatureUrl('')}
                              className="text-xs text-error hover:underline"
                            >
                              Clear Signature
                            </button>
                          )}
                        </div>
                        {ceoSignatureUrl && (
                          <div className="mt-2 p-2 border border-border bg-surface-hover rounded max-w-[200px]">
                            <img src={ceoSignatureUrl} alt="CEO Signature Preview" className="max-h-12 object-contain" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {pdfSubSection === 'company' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Company CIN" value={companyCin} onChange={(e) => setCompanyCin(e.target.value)} />
                        <Input label="Company GSTIN" value={companyGstin} onChange={(e) => setCompanyGstin(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Company PAN" value={companyPan} onChange={(e) => setCompanyPan(e.target.value)} />
                        <Input label="Company Phone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Company Email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
                        <Input label="Company Website" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-text-secondary">Company Registered Address</label>
                        <textarea
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent min-h-16"
                        />
                      </div>
                    </div>
                  )}

                  {pdfSubSection === 'bank' && (
                    <div className="space-y-4">
                      <Input label="Account Holder Name" value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} />
                      <Input label="Bank Name & Branch" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Account Number" value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} />
                        <Input label="IFSC Code" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} />
                      </div>
                      <Input label="UPI ID (VPA for QR Code)" value={bankUpiId} onChange={(e) => setBankUpiId(e.target.value)} />
                    </div>
                  )}

                  {pdfSubSection === 'terms' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background/50 p-3">
                        <div>
                          <p className="text-xs font-semibold text-text-primary">
                            Terms loaded for {address.state || storeSelectedState || DEFAULT_STATE}
                          </p>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            These clauses are fetched from the master template and saved as an editable quote snapshot.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setTerms(resolveStateTerms(address.state || storeSelectedState || DEFAULT_STATE))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                          >
                            <RotateCcw size={12} />
                            Reset to Master
                          </button>
                          <button
                            type="button"
                            onClick={() => setTerms([...terms, 'Add quotation term here.'])}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/25 text-[11px] font-semibold text-accent hover:bg-accent/10"
                          >
                            <Plus size={12} />
                            Add Term
                          </button>
                        </div>
                      </div>
                      {terms.map((t, idx) => (
                        <div key={idx} className="grid grid-cols-[28px_1fr_auto] gap-2 items-start">
                          <span className="text-xs text-text-secondary font-mono mt-3 w-6 text-right">{idx + 1}.</span>
                          <textarea
                            value={t}
                            onChange={(e) => {
                              const newTerms = [...terms];
                              newTerms[idx] = e.target.value;
                              setTerms(newTerms);
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary outline-none focus:border-accent min-h-20 resize-y"
                          />
                          <button
                            type="button"
                            onClick={() => setTerms(terms.length > 1 ? terms.filter((_, termIndex) => termIndex !== idx) : terms)}
                            className="mt-1 p-2 rounded-lg border border-border text-text-muted hover:text-error hover:border-error/30"
                            aria-label={`Remove term ${idx + 1}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-surface-active flex items-center justify-between shrink-0">
          {savedQuoteId ? (
            <button onClick={handleClose} className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-background font-bold transition-colors">
              Close
            </button>
          ) : showConflict ? (
            <div className="flex gap-2 w-full">
              <button 
                onClick={() => setShowConflict(false)}
                disabled={reloadingConflict || saving}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-text-primary hover:bg-surface-hover transition-colors font-medium text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={handleDiscardAndReload}
                disabled={reloadingConflict || saving}
                className="flex-1 px-3 py-2 rounded-lg border border-error/30 text-error hover:bg-error/10 transition-colors font-medium text-xs"
              >
                {reloadingConflict ? 'Reloading...' : 'Discard & Reload'}
              </button>
              <button 
                onClick={() => handleSave(true)}
                disabled={saving || reloadingConflict}
                className="flex-1 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-background font-bold transition-colors text-xs disabled:opacity-50"
              >
                {saving ? 'Overwriting...' : 'Overwrite Changes'}
              </button>
            </div>
          ) : (
            <>
              <button 
                onClick={step === 0 ? handleClose : () => setStep(step - 1)} 
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-surface-hover transition-colors font-medium text-sm disabled:opacity-50"
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
                    const validationError = validateSalesExecutiveContact(sales, salesExecPhone, salesExecEmail);
                    if (validationError) {
                      setFormError(validationError);
                      return;
                    }
                    setFormError(null);
                  }
                  if (step === 4) {
                    handleSave();
                    return;
                  }
                  setFormError(null);
                  setStep(step + 1);
                }} 
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-background font-bold transition-colors text-sm disabled:opacity-50"
              >
                {step === 4 ? (saving ? 'Saving...' : 'Create Quote PDF') : 'Next'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function validateQuoteBasics(
  customer: CustomerInfo,
  sales: SalesInfo,
  skipSalesCheck = false,
  salesExecPhone = '',
  salesExecEmail = '',
): string | null {
  if (!sales.projectTitle.trim()) return 'Project Title is required.';
  if (!customer.name.trim()) return 'Customer Name is required.';
  if (!customer.phone.trim()) return 'Phone Number is required.';
  const phoneDigits = customer.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) return 'Phone Number should be at least 10 digits.';
  if (!skipSalesCheck) {
    return validateSalesExecutiveContact(sales, salesExecPhone, salesExecEmail);
  }
  return null;
}

function validateSalesExecutiveContact(sales: SalesInfo, salesExecPhone: string, salesExecEmail: string): string | null {
  if (!sales.execName.trim()) return 'Sales Executive name is required.';
  if (!salesExecPhone.trim()) return 'Sales Executive phone is required.';
  const phoneDigits = salesExecPhone.replace(/\D/g, '');
  if (phoneDigits.length < 10) return 'Sales Executive phone should be at least 10 digits.';
  if (salesExecEmail.trim() && !isValidEmail(salesExecEmail)) return 'Sales Executive email is invalid.';
  return null;
}



