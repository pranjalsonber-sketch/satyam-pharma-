import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Download, 
  Share2, 
  X, 
  CheckCircle2, 
  Receipt, 
  FileText, 
  Smartphone, 
  Copy, 
  Check, 
  Building2, 
  User, 
  Calendar, 
  CreditCard, 
  ShieldCheck, 
  PlusCircle, 
  ExternalLink,
  Layers,
  Sparkles,
  QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerSafeLinkRedirect } from './AppAccessLinkPortal';
import { 
  InvoiceData, 
  downloadInvoicePDF, 
  printInvoicePDF, 
  generateInvoicePdfBlobUrl, 
  formatWhatsAppInvoiceText,
  numberToWordsIndian 
} from '../lib/invoicePdf';
import { printCleanHtmlInvoice, generatePrintableInvoiceHtml } from '../lib/htmlInvoicePrinter';
import { formatCurrency, cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: InvoiceData | null;
  onNewSale?: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  invoiceData,
  onNewSale,
}) => {
  const { tText, isHindi } = useLanguage();
  const [viewMode, setViewMode] = useState<'standard' | 'pdf' | 'thermal'>('standard');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && invoiceData) {
      try {
        const url = generateInvoicePdfBlobUrl(invoiceData);
        setPdfBlobUrl(url);
        return () => {
          if (url) URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.warn('Error generating PDF Blob preview:', err);
      }
    } else {
      setPdfBlobUrl(null);
    }
  }, [isOpen, invoiceData]);

  if (!isOpen || !invoiceData) return null;

  const invoiceNo = invoiceData.invoiceNo || (invoiceData.id ? `INV-${invoiceData.id.slice(-6).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
  const dateObj = invoiceData.timestamp ? new Date(invoiceData.timestamp) : new Date();
  const dateFormatted = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const pharmacyName = invoiceData.pharmacyName || 'SATYAM PHARMA & MEDICAL STORES';
  const pharmacyAddress = invoiceData.pharmacyAddress || '123 Healthcare Complex, Station Road, Raipur (C.G.) - 492001';
  const dlNo = invoiceData.dlNumber || '20B/21B-CG-2024-8849';
  const gstin = invoiceData.gstin || '22AAAAA0000A1Z5';
  const contact = invoiceData.contactNumber || '+91 98765 43210';

  const isGst = invoiceData.billingType === 'gst' || invoiceData.billingType === 'tax_invoice';
  const taxableSubtotal = invoiceData.subtotal || invoiceData.totalAmount;
  const gstRate = 0.12;
  const cgstVal = isGst ? (taxableSubtotal * (gstRate / 2)) : 0;
  const sgstVal = isGst ? (taxableSubtotal * (gstRate / 2)) : 0;
  const grandTotal = isGst ? (taxableSubtotal + cgstVal + sgstVal) : invoiceData.totalAmount;

  const handlePrint = () => {
    setIsPrinting(true);
    printCleanHtmlInvoice(invoiceData);
    setTimeout(() => setIsPrinting(false), 1200);
  };

  const handleDownload = () => {
    downloadInvoicePDF(invoiceData);
  };

  const handleWhatsAppShare = () => {
    const text = formatWhatsAppInvoiceText(invoiceData);
    const mobile = invoiceData.customerMobile?.replace(/\D/g, '');
    const url = mobile && mobile.length >= 10
      ? `https://wa.me/91${mobile.slice(-10)}?text=${text}`
      : `https://wa.me/?text=${text}`;
    triggerSafeLinkRedirect(url, 'WhatsApp Invoice Share');
  };

  const handleCopyText = () => {
    const invoiceSummary = `SATYAM PHARMA\nInvoice: ${invoiceNo}\nDate: ${dateFormatted}\nCustomer: ${invoiceData.customerName || 'Walk-in'}\nTotal: ${formatCurrency(grandTotal)}\nPaid via: ${invoiceData.paymentMethod.toUpperCase()}`;
    navigator.clipboard.writeText(invoiceSummary);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative flex flex-col max-h-[92vh] w-full max-w-4xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {tText('Sale Completed • Invoice Ready', 'बिक्री पूरी हुई • चालान तैयार')}
                </h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  {invoiceNo}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {dateFormatted} at {timeFormatted} • {invoiceData.items.length} {tText('items', 'दवाएं')} • {formatCurrency(grandTotal)}
              </p>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-700/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('standard')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                viewMode === 'standard'
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
              )}
            >
              <FileText size={13} />
              <span>{tText('Tax Invoice', 'टैक्स इनवॉइस')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('thermal')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                viewMode === 'thermal'
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
              )}
            >
              <Receipt size={13} />
              <span>{tText('Thermal Receipt', 'थर्मल रसीद')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                viewMode === 'pdf'
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
              )}
            >
              <Layers size={13} />
              <span>{tText('PDF Document', 'पीडीएफ पूर्वावलोकन')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Invoice Display */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 dark:bg-slate-950/50 flex justify-center">
          {viewMode === 'standard' && (
            <div 
              ref={printRef}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-6 text-slate-800 dark:text-slate-200"
            >
              {/* Invoice Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="text-blue-600 dark:text-blue-400" size={20} />
                    <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                      {pharmacyName}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                    {pharmacyAddress}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                    <span><strong>DL:</strong> {dlNo}</span>
                    <span>•</span>
                    <span><strong>GSTIN:</strong> {gstin}</span>
                    <span>•</span>
                    <span><strong>Ph:</strong> {contact}</span>
                  </div>
                </div>

                <div className="sm:text-right bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shrink-0">
                  <span className="inline-block rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    {isGst ? 'Tax Invoice' : 'Retail Cash Memo'}
                  </span>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">{invoiceNo}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{dateFormatted}, {timeFormatted}</p>
                </div>
              </div>

              {/* Patient & Billing Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Billed To / Patient</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                    {invoiceData.customerName || 'Walk-in Customer'}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    Mobile: {invoiceData.customerMobile || 'Not provided'}
                  </p>
                  <p className="text-slate-500">
                    Prescribing Doctor: {invoiceData.doctorName || 'Self / General'}
                  </p>
                </div>

                <div className="sm:text-right sm:border-l sm:border-slate-200 dark:sm:border-slate-700 sm:pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Summary</span>
                  <div className="mt-0.5 flex sm:justify-end items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={11} /> PAID ({invoiceData.paymentMethod.toUpperCase()})
                    </span>
                  </div>
                  <p className="text-slate-500 mt-1 text-[11px]">
                    Pharmacist: {invoiceData.staffName || 'Registered Pharmacist'}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white dark:bg-slate-800 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Medicine Description</th>
                      <th className="py-2.5 px-2 text-center">Batch</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">MRP / Unit</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invoiceData.items.map((item, idx) => {
                      const itemPrice = item.price || item.rate || 0;
                      return (
                        <tr key={item.medicineId + idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                            {item.unit && <span className="text-[10px] text-slate-400 ml-1">({item.unit})</span>}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {item.batchNumber || 'GEN-01'}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                            {formatCurrency(itemPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                            {formatCurrency(itemPrice * item.quantity)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals & Words Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="sm:col-span-7 space-y-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Amount in Words:</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 italic">
                      {numberToWordsIndian(grandTotal)}
                    </p>
                  </div>

                  <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                    <p>• Medicines once sold cannot be returned without original invoice.</p>
                    <p>• Schedule H & H1 drugs sold on valid doctor prescription only.</p>
                  </div>
                </div>

                <div className="sm:col-span-5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Gross Subtotal:</span>
                    <span className="font-mono font-medium">{formatCurrency(taxableSubtotal)}</span>
                  </div>
                  {isGst && (
                    <>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>CGST (6%):</span>
                        <span className="font-mono">{formatCurrency(cgstVal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>SGST (6%):</span>
                        <span className="font-mono">{formatCurrency(sgstVal)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700 text-sm font-black">
                    <span className="text-slate-900 dark:text-slate-100 uppercase tracking-tight">Net Payable:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono text-base">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Signatory Footer */}
              <div className="flex justify-between items-end mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <QrCode size={36} className="text-slate-400" />
                  <div>
                    <p className="font-mono text-[9px] font-bold text-slate-600 dark:text-slate-300">SATYAM-POS-VERIFIED</p>
                    <p className="text-[9px]">Scan to verify authenticity</p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="w-36 border-b border-slate-300 dark:border-slate-700 pb-1 mb-1 font-script text-xs text-slate-400 italic">
                    {invoiceData.staffName || 'Satyam Pharmacist'}
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Authorized Pharmacist
                  </p>
                  <p className="text-[9px] text-slate-400">Reg No: CG-RPH-2018-912</p>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'thermal' && (
            <div className="w-full max-w-[320px] bg-white text-slate-900 rounded-lg shadow-lg border border-slate-200 p-4 font-mono text-xs leading-tight">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h3 className="font-black text-sm uppercase">{pharmacyName}</h3>
                <p className="text-[10px]">{pharmacyAddress}</p>
                <p className="text-[10px]">DL: {dlNo}</p>
                <p className="text-[10px]">GSTIN: {gstin}</p>
                <p className="text-[10px] mt-1 font-bold">RETAIL CASH MEMO</p>
              </div>

              <div className="py-2 border-b border-dashed border-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span>INV: {invoiceNo}</span>
                  <span>{timeFormatted}</span>
                </div>
                <div>DATE: {dateFormatted}</div>
                <div>CUST: {invoiceData.customerName || 'Walk-in'}</div>
                {invoiceData.customerMobile && <div>PH: {invoiceData.customerMobile}</div>}
              </div>

              <div className="py-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-bold text-[10px] mb-1">
                  <span>ITEM</span>
                  <span>QTY x RATE</span>
                  <span>AMT</span>
                </div>
                {invoiceData.items.map((item, i) => (
                  <div key={i} className="mb-1 text-[11px]">
                    <div className="font-bold truncate">{item.name}</div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>{item.batchNumber || 'GEN'}</span>
                      <span>{item.quantity} x {formatCurrency(item.price || item.rate || 0)}</span>
                      <span className="font-bold text-slate-900">{formatCurrency((item.price || item.rate || 0) * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="py-2 border-b border-dashed border-slate-300 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>ITEMS COUNT:</span>
                  <span>{invoiceData.items.length}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-200">
                  <span>NET TOTAL:</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>MODE:</span>
                  <span>{invoiceData.paymentMethod.toUpperCase()} (PAID)</span>
                </div>
              </div>

              <div className="text-center pt-3 text-[9px] text-slate-500 space-y-1">
                <p>Thank you for choosing Satyam Pharma!</p>
                <p>Goods once sold cannot be returned without bill.</p>
                <p className="font-bold">*** GET WELL SOON ***</p>
              </div>
            </div>
          )}

          {viewMode === 'pdf' && (
            <div className="w-full h-[580px] bg-slate-900 rounded-xl overflow-hidden flex flex-col items-center justify-center">
              {pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  title="PDF Invoice Preview"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Layers size={32} className="animate-spin text-blue-500" />
                  <p className="text-xs">Generating high-resolution vector PDF...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Direct Print Button */}
            <button
              type="button"
              id="invoice-print-btn"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Printer size={15} />
              <span>{isPrinting ? tText('Printing...', 'प्रिंट हो रहा है...') : tText('Print Invoice / Bill', 'बिल प्रिंट करें')}</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              id="invoice-download-pdf-btn"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>{tText('Download PDF', 'पीडीएफ डाउनलोड')}</span>
            </button>

            {/* WhatsApp Share Button */}
            <button
              type="button"
              id="invoice-whatsapp-share-btn"
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-all cursor-pointer"
              title="Share digital receipt on customer's WhatsApp"
            >
              <Smartphone size={14} className="text-emerald-600" />
              <span>{tText('WhatsApp Bill', 'व्हाट्सएप भेजें')}</span>
            </button>

            {/* Copy Summary */}
            <button
              type="button"
              onClick={handleCopyText}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Copy text receipt to clipboard"
            >
              {isCopied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onNewSale && (
              <button
                type="button"
                id="invoice-new-sale-btn"
                onClick={() => {
                  onClose();
                  onNewSale();
                }}
                className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-slate-800 dark:hover:bg-white transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <PlusCircle size={15} />
                <span>{tText('Start New Sale', 'अगली बिक्री शुरू करें')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {tText('Close', 'बंद करें')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoiceModal;
