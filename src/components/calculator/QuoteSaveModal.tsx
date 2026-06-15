'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { STATE_DATA } from '@/lib/data/masters';
import { X, CheckCircle2, RotateCcw } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { supabase } from '@/lib/supabase/client';
import type { CustomerInfo, AddressInfo, SiteInfo, SalesInfo, Quote } from '@/lib/types/quote';

interface QuoteSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (quote: Quote) => void;
  acknowledgedGuards?: string[];
  leadId?: string | null;
}

const STEPS = ['Project', 'Address', 'Site', 'Sales'];

export function QuoteSaveModal({ isOpen, onClose, onSaved, acknowledgedGuards = [], leadId = null }: QuoteSaveModalProps) {
  const saveQuote = useCalculatorStore((s) => s.saveQuote);
  const loadQuote = useCalculatorStore((s) => s.loadQuote);
  const activeQuoteId = useCalculatorStore((s) => s.activeQuoteId);
  const itcEligible = useCalculatorStore((s) => s.itcEligible);
  const dbStateData = useCalculatorStore((s) => s.dbStateData);
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(0);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showConflict, setShowConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  // Project select states
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Form states
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', phone: '', whatsapp: '', email: '', isGstRegistered: false });
  const [address, setAddress] = useState<AddressInfo>({ line1: '', line2: '', city: '', state: 'Gujarat', pin: '' });
  const [site, setSite] = useState<SiteInfo>({ meterNo: '', sanctionedLoad: '', monthlyBill: 0, roofType: 'RCC', roofArea: 0 });
  const [sales, setSales] = useState<SalesInfo>({ projectTitle: '', execName: '', notes: '', saleType: 'New' });

  // Client-side mounting for portal
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Fetch projects when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', session.user.id)
          .single();

        if (profile?.org_id) {
          const { data: projs, error } = await supabase
            .from('epc_projects')
            .select(`
              id,
              project_number,
              quote_id,
              quotes (
                customer_name,
                customer_phone,
                customer_whatsapp,
                customer_email,
                address_line1,
                address_line2,
                city,
                state_name,
                pincode,
                meter_number,
                sanctioned_load_kw,
                monthly_bill_inr,
                roof_type,
                roof_area_sqft,
                exec_name,
                sale_type,
                project_title,
                notes
              )
            `)
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false });

          if (!error && projs) {
            setProjects(projs);
          }
        }
      } catch (err) {
        console.error('Failed to load projects for dropdown:', err);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !leadId) return;

    const fetchLeadInfo = async () => {
      try {
        const { data: lead, error } = await supabase
          .from('crm_leads')
          .select('*')
          .eq('id', leadId)
          .single();

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
            setAddress({
              line1: survey.address_line1 || '',
              line2: survey.address_line2 || '',
              city: survey.city || '',
              state: survey.state_name || 'Gujarat',
              pin: survey.pincode || ''
            });

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
  }, [isOpen, leadId]);

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
    const validationError = validateQuoteBasics(customer, sales);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    try {
      setFormError(null);
      const salesWithItc = { ...sales, itcEligible };
      const quote = await saveQuote({ customer, address, site, sales: salesWithItc, validationAcknowledged: acknowledgedGuards, leadId }, forceOverwrite);

      // Link quote to project if selected
      if (selectedProjectId) {
        // Query the quote's DB UUID from the quotes table using its quote_number
        const { data: qData, error: qErr } = await supabase
          .from('quotes')
          .select('id')
          .eq('quote_number', quote.quoteId)
          .single();
        if (qErr) {
          console.error('[QuoteSaveModal] Error retrieving quote UUID:', qErr);
        } else if (qData?.id) {
          const { error: projErr } = await supabase
            .from('epc_projects')
            .update({ quote_id: qData.id })
            .eq('id', selectedProjectId);
          if (projErr) {
            console.error('[QuoteSaveModal] Error linking project to quote:', projErr);
          } else {
            console.log(`[QuoteSaveModal] Linked project ${selectedProjectId} to quote UUID ${qData.id}`);
          }
        }
      }

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
    setSelectedProjectId(null); // Clear selected project
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">Link to Existing ERP Project</label>
                    <Select
                      value={selectedProjectId || ''}
                      onChange={(val) => {
                        const projId = val === '' ? null : val;
                        setSelectedProjectId(projId);
                        if (projId) {
                          const proj = projects.find((p) => p.id === projId);
                          if (proj) {
                            if (proj.quotes) {
                              const q = proj.quotes;
                              setSales({
                                projectTitle: q.project_title || proj.project_number || '',
                                execName: q.exec_name || '',
                                notes: q.notes || '',
                                saleType: q.sale_type ? (q.sale_type.charAt(0).toUpperCase() + q.sale_type.slice(1)) as any : 'New',
                              });
                              setCustomer({
                                name: q.customer_name || '',
                                phone: q.customer_phone || '',
                                whatsapp: q.customer_whatsapp || '',
                                email: q.customer_email || '',
                                isGstRegistered: q.customer_is_gst_registered || false,
                              });
                              setAddress({
                                line1: q.address_line1 || '',
                                line2: q.address_line2 || '',
                                city: q.city || '',
                                state: q.state_name || 'Gujarat',
                                pin: q.pincode || '',
                              });
                              setSite({
                                meterNo: q.meter_number || '',
                                sanctionedLoad: q.sanctioned_load_kw ? String(q.sanctioned_load_kw) : '',
                                monthlyBill: q.monthly_bill_inr || 0,
                                roofType: (q.roof_type || 'RCC') as any,
                                roofArea: q.roof_area_sqft || 0,
                              });
                            } else {
                              // If project exists but no quote is linked yet
                              setSales({
                                projectTitle: proj.project_number || '',
                                execName: '',
                                notes: '',
                                saleType: 'New',
                              });
                              setCustomer({ name: '', phone: '', whatsapp: '', email: '', isGstRegistered: false });
                              setAddress({ line1: '', line2: '', city: '', state: 'Gujarat', pin: '' });
                              setSite({ meterNo: '', sanctionedLoad: '', monthlyBill: 0, roofType: 'RCC', roofArea: 0 });
                            }
                          }
                        } else {
                          // Clear all inputs when choosing "None"
                          setCustomer({ name: '', phone: '', whatsapp: '', email: '', isGstRegistered: false });
                          setAddress({ line1: '', line2: '', city: '', state: 'Gujarat', pin: '' });
                          setSite({ meterNo: '', sanctionedLoad: '', monthlyBill: 0, roofType: 'RCC', roofArea: 0 });
                          setSales({ projectTitle: '', execName: '', notes: '', saleType: 'New' });
                        }
                      }}
                      options={[
                        { value: '', label: 'None (Create New Project)' },
                        ...projects.map((p) => ({
                          value: p.id,
                          label: `${p.project_number} — ${p.quotes?.customer_name || 'No Client'}`
                        }))
                      ]}
                    />
                  </div>

                  <Input label="Project Title" value={sales.projectTitle} onChange={(v) => setSales({...sales, projectTitle: v})} required />
                  <Input label="Customer Name" value={customer.name} onChange={(v) => setCustomer({...customer, name: v})} required />
                  <Input label="Phone Number" value={customer.phone} onChange={(v) => setCustomer({...customer, phone: v})} required />
                  <Input label="WhatsApp Number" value={customer.whatsapp} onChange={(v) => setCustomer({...customer, whatsapp: v})} />
                  <Input label="Email Address" value={customer.email} onChange={(v) => setCustomer({...customer, email: v})} type="email" />

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
                  <Input label="Address Line 1" value={address.line1} onChange={(v) => setAddress({...address, line1: v})} />
                  <Input label="Address Line 2" value={address.line2} onChange={(v) => setAddress({...address, line2: v})} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="City" value={address.city} onChange={(v) => setAddress({...address, city: v})} />
                    <Input label="PIN Code" value={address.pin} onChange={(v) => setAddress({...address, pin: v})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">State</label>
                    <Select
                      value={address.state}
                      onChange={(v) => setAddress({...address, state: v})}
                      options={(Object.keys(dbStateData).length > 0 ? Object.keys(dbStateData) : Object.keys(STATE_DATA)).map(st => ({ value: st, label: st }))}
                    />
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
          ) : showConflict ? (
            <div className="flex gap-2 w-full">
              <button 
                onClick={() => setShowConflict(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-text-primary hover:bg-surface-hover transition-colors font-medium text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (activeQuoteId) {
                    loadQuote(activeQuoteId);
                  }
                  handleClose();
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-error/30 text-error hover:bg-error/10 transition-colors font-medium text-xs"
              >
                Discard & Reload
              </button>
              <button 
                onClick={() => handleSave(true)}
                disabled={saving}
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
                    handleSave();
                    return;
                  }
                  setFormError(null);
                  setStep(step + 1);
                }} 
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-background font-bold transition-colors text-sm disabled:opacity-50"
              >
                {step === 3 ? (saving ? 'Saving...' : 'Create Quote PDF') : 'Next'}
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

