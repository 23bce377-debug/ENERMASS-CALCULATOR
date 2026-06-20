'use client';

import React, { useState, useEffect } from 'react';
import { Download, Printer, Calendar, FileText, FileBarChart, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { generateGSTR1CSV } from '@/lib/reports/gstr1';
import { generateGSTR3BSummary, GSTR3BSummary } from '@/lib/reports/gstr3b';
import { Select } from '@/components/ui/Select';

const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September', 
  'October', 'November', 'December', 'January', 'February', 'March'
];

export default function GSTReportPage() {
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const currentFY = currentMonthIdx >= 3 ? currentYear : currentYear - 1;
  
  const [selectedFY, setSelectedFY] = useState(currentFY);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[currentMonthIdx >= 3 ? currentMonthIdx - 3 : currentMonthIdx + 9]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<GSTR3BSummary | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Derived date range for DB queries
  const getMonthDateRange = () => {
    const monthIndex = MONTHS.indexOf(selectedMonth);
    const year = monthIndex < 9 ? selectedFY : selectedFY + 1; // Apr-Dec = FY start year, Jan-Mar = FY end year
    const jsMonthIndex = monthIndex < 9 ? monthIndex + 3 : monthIndex - 9;
    
    const startDate = new Date(year, jsMonthIndex, 1);
    const endDate = new Date(year, jsMonthIndex + 1, 0, 23, 59, 59);
    
    return { 
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString() 
    };
  };

  const fetchReportData = async () => {
    setLoading(true);
    const { startDate, endDate } = getMonthDateRange();
    
    try {
      // Fetch Invoices
      const { data: invData, error: invError } = await supabase
        .from('acc_invoices')
        .select('*')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);
      
      if (invError) throw invError;

      // Fetch Vendor Payments (ITC)
      const { data: vpData, error: vpError } = await supabase
        .from('vendor_payments')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (vpError) throw vpError;

      setInvoices(invData || []);
      const newSummary = generateGSTR3BSummary(invData || [], vpData || []);
      setSummary(newSummary);
      
    } catch (err) {
      console.error('Failed to load GST data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [selectedMonth, selectedFY]);

  const handleDownloadGSTR1 = () => {
    if (!invoices.length) return alert('No invoices found for this month.');
    
    const csvContent = generateGSTR1CSV(invoices);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GSTR1_${selectedMonth}_${selectedFY}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatINR = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 print:p-0">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">GST Reporting</h1>
          <p className="text-text-muted text-sm mt-1">Generate GSTR-1 & GSTR-3B monthly summaries</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
            <Calendar size={18} className="text-text-muted ml-2" />
            <Select
              value={selectedMonth}
              onChange={(val) => setSelectedMonth(val)}
              options={MONTHS.map(m => ({ value: m, label: m }))}
              size="sm"
              className="min-w-[110px]"
            />
            <Select
              value={String(selectedFY)}
              onChange={(val) => setSelectedFY(parseInt(val))}
              options={[currentFY - 2, currentFY - 1, currentFY, currentFY + 1].map(y => ({
                value: String(y),
                label: `FY ${y.toString().slice(2)}-${(y+1).toString().slice(2)}`
              }))}
              size="sm"
              className="min-w-[130px]"
            />
          </div>
          
          <button 
            onClick={fetchReportData}
            disabled={loading}
            className="p-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-text-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-text-muted text-sm font-medium mb-1">Total Sales (Taxable)</p>
          <p className="text-2xl font-bold text-text-primary">
            {summary ? formatINR(summary.outwardSupplies.taxableValue) : '₹0'}
          </p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-text-muted text-sm font-medium mb-1">Output GST (Collected)</p>
          <p className="text-2xl font-bold text-text-primary">
            {summary ? formatINR(summary.outwardSupplies.totalTax) : '₹0'}
          </p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-text-muted text-sm font-medium mb-1">Eligible ITC (Available)</p>
          <p className="text-2xl font-bold text-success">
            {summary ? formatINR(summary.itcAvailable.totalTax) : '₹0'}
          </p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-accent shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-accent/10 rounded-bl-full" />
          <p className="text-text-muted text-sm font-medium mb-1">Net GST Payable</p>
          <p className="text-2xl font-bold text-accent">
            {summary ? formatINR(summary.netPayable.total) : '₹0'}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 print:hidden">
        <button 
          onClick={handleDownloadGSTR1}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface hover:bg-surface-hover border border-border rounded-xl transition-all shadow-sm font-medium text-text-primary"
        >
          <FileBarChart size={20} className="text-info" />
          Download GSTR-1 (CSV)
          <span className="ml-auto mr-4 text-xs bg-info/10 text-info px-2 py-1 rounded">Excel Compatible</span>
        </button>

        <button 
          onClick={() => window.print()}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface hover:bg-surface-hover border border-border rounded-xl transition-all shadow-sm font-medium text-text-primary"
        >
          <FileText size={20} className="text-accent" />
          Print GSTR-3B Summary (PDF)
          <span className="ml-auto mr-4 text-xs bg-accent/10 text-accent px-2 py-1 rounded">Filing Ready</span>
        </button>
      </div>

      {/* GSTR-3B Printable Summary Area */}
      {summary && (
        <div className="bg-white text-black p-8 rounded-xl border border-border shadow-sm mt-8 print:border-none print:shadow-none print:mt-0 print:p-0">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold uppercase tracking-wider">GSTR-3B Summary</h2>
            <p className="text-gray-500 mt-1">
              For the month of {selectedMonth} {selectedFY}-{selectedFY+1}
            </p>
          </div>

          <div className="space-y-8">
            {/* Table 3.1 */}
            <div>
              <h3 className="font-bold text-lg mb-3 border-b border-gray-300 pb-2">
                3.1 Details of Outward Supplies
              </h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 border border-gray-300">Nature of Supplies</th>
                    <th className="p-3 border border-gray-300 text-right">Taxable Value</th>
                    <th className="p-3 border border-gray-300 text-right">IGST</th>
                    <th className="p-3 border border-gray-300 text-right">CGST</th>
                    <th className="p-3 border border-gray-300 text-right">SGST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border border-gray-300">(a) Outward taxable supplies</td>
                    <td className="p-3 border border-gray-300 text-right">{formatINR(summary.outwardSupplies.taxableValue)}</td>
                    <td className="p-3 border border-gray-300 text-right">{formatINR(summary.outwardSupplies.igst)}</td>
                    <td className="p-3 border border-gray-300 text-right">{formatINR(summary.outwardSupplies.cgst)}</td>
                    <td className="p-3 border border-gray-300 text-right">{formatINR(summary.outwardSupplies.sgst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table 4 */}
            <div>
              <h3 className="font-bold text-lg mb-3 border-b border-gray-300 pb-2">
                4. Eligible ITC
              </h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 border border-gray-300">Details</th>
                    <th className="p-3 border border-gray-300 text-right">IGST</th>
                    <th className="p-3 border border-gray-300 text-right">CGST</th>
                    <th className="p-3 border border-gray-300 text-right">SGST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border border-gray-300">(A) ITC Available (whether in full or part)</td>
                    <td className="p-3 border border-gray-300 text-right">{formatINR(summary.itcAvailable.igst)}</td>
                    <td className="p-3 border border-gray-300 text-right">{formatINR(summary.itcAvailable.cgst)}</td>
                    <td className="p-3 border border-gray-300 text-right">{formatINR(summary.itcAvailable.sgst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Payable Summary */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-300">
              <h3 className="font-bold text-lg mb-4 text-center">Net Tax Payable (Offset Summary)</h3>
              <div className="flex justify-between max-w-md mx-auto text-lg">
                <div className="space-y-2">
                  <p className="text-gray-600">Net IGST:</p>
                  <p className="text-gray-600">Net CGST:</p>
                  <p className="text-gray-600">Net SGST:</p>
                  <div className="h-px bg-gray-300 w-full my-2" />
                  <p className="font-bold">Total Cash Payable:</p>
                </div>
                <div className="space-y-2 text-right">
                  <p>{formatINR(summary.netPayable.igst)}</p>
                  <p>{formatINR(summary.netPayable.cgst)}</p>
                  <p>{formatINR(summary.netPayable.sgst)}</p>
                  <div className="h-px bg-gray-300 w-full my-2" />
                  <p className="font-bold">{formatINR(summary.netPayable.total)}</p>
                </div>
              </div>
            </div>
            
            <div className="text-center text-xs text-gray-400 mt-8">
              Generated by EnerMass ERP System on {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
