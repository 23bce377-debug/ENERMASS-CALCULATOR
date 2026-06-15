'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { confirmSiteReceipt } from '@/lib/inventory/transitions';
import { Truck, CheckCircle, Package, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MobileReceiptConfirmation({ params }: { params: { movementId: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [movement, setMovement] = useState<any>(null);
  const [item, setItem] = useState<any>(null);

  // Form state
  const [actualQty, setActualQty] = useState<string>('');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: mv, error: mvErr } = await supabase
          .from('inventory_movements')
          .select('*')
          .eq('id', params.movementId)
          .single();

        if (mvErr) throw mvErr;
        if (!mv) throw new Error("Movement record not found");

        setMovement(mv);
        setActualQty(mv.quantity.toString());

        const { data: cat, error: catErr } = await supabase
          .from('catalog_items')
          .select('name, unit')
          .eq('id', mv.item_id)
          .single();
          
        if (catErr) throw catErr;
        setItem(cat);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.movementId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualQty || !receivedBy.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await confirmSiteReceipt(
        params.movementId,
        receivedBy.trim(),
        parseFloat(actualQty),
        notes.trim()
      );
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Loading dispatch details...</div>;
  }

  if (error && !movement) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <div className="bg-error/10 text-error p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (movement?.to_state !== 'in_transit' && !success) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <div className="bg-warning/10 text-warning p-4 rounded-xl flex flex-col items-center gap-3 text-center">
          <CheckCircle size={48} className="opacity-80" />
          <h2 className="text-xl font-bold">Already Processed</h2>
          <p>This material dispatch is no longer in transit. It has either been received or cancelled.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center animate-fade-in">
        <div className="bg-surface border border-border rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Receipt Confirmed!</h1>
          <p className="text-text-secondary mb-8">
            The material has been securely logged as At Site. Any discrepancies have been flagged to the project manager.
          </p>
          <button 
            onClick={() => window.close()}
            className="w-full bg-surface-hover border border-border text-text-primary font-bold py-3 rounded-xl hover:bg-border/50 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  const isShort = Number(actualQty) < Number(movement.quantity);
  const isOver = Number(actualQty) > Number(movement.quantity);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 animate-fade-in">
      <div className="max-w-md mx-auto bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-accent/10 p-6 border-b border-accent/20">
          <div className="flex items-center gap-3 mb-2 text-accent">
            <Truck size={24} />
            <h1 className="text-xl font-bold">Site Material Receipt</h1>
          </div>
          <p className="text-sm text-text-secondary">
            Please confirm the quantities physically received at the site.
          </p>
        </div>

        {/* Dispatch Details */}
        <div className="p-6 border-b border-border/50 bg-surface-hover">
          <div className="flex items-start gap-3 mb-4">
            <Package className="text-text-muted shrink-0 mt-1" />
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-bold mb-1">Item Description</p>
              <p className="text-lg font-bold text-text-primary">{item?.name || 'Unknown Item'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background p-3 rounded-lg border border-border/50">
              <p className="text-xs text-text-muted uppercase tracking-wider font-bold mb-1">Dispatched Qty</p>
              <p className="text-xl font-bold text-text-primary">
                {movement.quantity} <span className="text-sm text-text-muted font-normal">{item?.unit}</span>
              </p>
            </div>
            <div className="bg-background p-3 rounded-lg border border-border/50">
              <p className="text-xs text-text-muted uppercase tracking-wider font-bold mb-1">Vehicle No</p>
              <p className="text-sm font-bold text-text-primary mt-1">
                {movement.vehicle_number || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-error/10 text-error text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              Actual Quantity Received *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                value={actualQty}
                onChange={(e) => setActualQty(e.target.value)}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">
                {item?.unit}
              </span>
            </div>
            {isShort && (
              <p className="text-warning text-xs font-bold mt-2 flex items-center gap-1.5">
                <AlertCircle size={14} /> Short delivery will be flagged to PM
              </p>
            )}
            {isOver && (
              <p className="text-error text-xs font-bold mt-2 flex items-center gap-1.5">
                <AlertCircle size={14} /> Receiving more than dispatched
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              Received By (Your Name) *
            </label>
            <input
              type="text"
              required
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              placeholder="E.g., Rahul Sharma"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              Notes / Condition (Optional)
            </label>
            <textarea
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none h-24"
              placeholder="E.g., 2 panels have minor scratches"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !actualQty || !receivedBy.trim()}
            className="w-full bg-accent text-white font-bold py-4 rounded-xl hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20 mt-4"
          >
            {submitting ? 'Confirming Receipt...' : 'Confirm Receipt'}
          </button>
        </form>
      </div>
    </div>
  );
}
