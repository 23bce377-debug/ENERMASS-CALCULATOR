import { useState, useEffect } from 'react';
import {
  QuoteORM,
  QuoteItemORM,
  QuoteAdditionalCostORM,
  QuoteStatusHistoryORM,
  QuoteVariantORM,
  type QuoteRow,
  type QuoteInsert,
  type QuoteUpdate,
  type QuoteItemRow,
  type QuoteItemInsert,
  type QuoteItemUpdate,
  type QuoteAdditionalCostRow,
  type QuoteAdditionalCostInsert,
  type QuoteStatusHistoryRow,
  type QuoteStatusHistoryInsert,
  type QuoteVariantRow,
  type QuoteVariantInsert,
  type QuoteVariantUpdate
} from '../../backend/orm/quote';

export function useQuotes(orgId?: string) {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [activeQuote, setActiveQuote] = useState<(QuoteRow & {
    quote_items: QuoteItemRow[];
    quote_additional_costs: QuoteAdditionalCostRow[];
    quote_variants: QuoteVariantRow[];
  }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQuotes = async (id: string) => {
    try {
      const data = await QuoteORM.getAll(id);
      setQuotes(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  };

  const fetchQuoteDetail = async (quoteId: string) => {
    setLoading(true);
    try {
      const data = await QuoteORM.getById(quoteId);
      setActiveQuote(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (orgId) {
        await fetchQuotes(orgId);
      }
      setLoading(false);
    };
    load();
  }, [orgId]);

  const createQuote = async (quote: QuoteInsert) => {
    try {
      const data = await QuoteORM.create(quote);
      setQuotes((prev) => [data, ...prev]);
      return data;
    } catch (err) {
      throw err;
    }
  };

  const updateQuote = async (id: string, updates: QuoteUpdate) => {
    try {
      const currentQuote = quotes.find((q) => q.id === id) || (activeQuote?.id === id ? activeQuote : null);
      const expectedVersion = currentQuote?.version;
      const data = await QuoteORM.update(id, updates, expectedVersion);
      setQuotes((prev) => prev.map((q) => (q.id === id ? data : q)));
      if (activeQuote?.id === id) {
        setActiveQuote((prev) => prev ? { ...prev, ...data } : null);
      }
      return data;
    } catch (err) {
      throw err;
    }
  };

  const deleteQuote = async (id: string) => {
    try {
      await QuoteORM.delete(id);
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      if (activeQuote?.id === id) {
        setActiveQuote(null);
      }
      return true;
    } catch (err) {
      throw err;
    }
  };

  // Quote Items mutations
  const createQuoteItems = async (items: QuoteItemInsert[]) => {
    try {
      const data = await QuoteItemORM.createMany(items);
      if (activeQuote) {
        setActiveQuote({
          ...activeQuote,
          quote_items: [...activeQuote.quote_items, ...data]
        });
      }
      return data;
    } catch (err) {
      throw err;
    }
  };

  const updateQuoteItem = async (itemId: string, updates: QuoteItemUpdate) => {
    try {
      const data = await QuoteItemORM.update(itemId, updates);
      if (activeQuote) {
        setActiveQuote({
          ...activeQuote,
          quote_items: activeQuote.quote_items.map(i => i.id === itemId ? data : i)
        });
      }
      return data;
    } catch (err) {
      throw err;
    }
  };

  return {
    quotes,
    activeQuote,
    loading,
    error,
    refreshQuotes: orgId ? () => fetchQuotes(orgId) : async () => {},
    fetchQuoteDetail,
    createQuote,
    updateQuote,
    deleteQuote,
    createQuoteItems,
    updateQuoteItem
  };
}
