/**
 * HTML Invoice Printer & Formatter
 * Generates an ultra-clean, standards-compliant, printable HTML invoice template
 * for Satyam Medical Stores containing store details, itemized list, GST breakdown, and totals.
 */

import { InvoiceData, numberToWordsIndian } from './invoicePdf';
import { formatCurrency } from './utils';

export function generatePrintableInvoiceHtml(data: InvoiceData): string {
  const invoiceNo = data.invoiceNo || (data.id ? `INV-${data.id.slice(-6).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
  const dateObj = data.timestamp ? new Date(data.timestamp) : new Date();
  const dateStr = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const pharmacyName = data.pharmacyName || 'SATYAM PHARMA & MEDICAL STORES';
  const pharmacyAddress = data.pharmacyAddress || '123 Healthcare Complex, Station Road, Raipur (C.G.) - 492001';
  const dlNo = data.dlNumber || '20B/21B-CG-2024-8849';
  const gstin = data.gstin || '22AAAAA0000A1Z5';
  const contact = data.contactNumber || '+91 98765 43210';
  const email = data.email || 'care@satyampharma.com';

  const isGst = data.billingType === 'gst' || data.billingType === 'tax_invoice';
  const subtotal = data.subtotal || data.totalAmount;
  const gstRateTotal = isGst ? 0.12 : 0;
  const cgstRate = gstRateTotal / 2;
  const sgstRate = gstRateTotal / 2;
  const cgstAmount = isGst ? (subtotal * cgstRate) : 0;
  const sgstAmount = isGst ? (subtotal * sgstRate) : 0;
  const totalGst = cgstAmount + sgstAmount;
  const grandTotal = isGst ? (subtotal + totalGst) : data.totalAmount;
  const totalUnits = data.items.reduce((acc, item) => acc + (item.quantity || 1), 0);

  const amountInWords = numberToWordsIndian(grandTotal);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${invoiceNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px;
      font-size: 12px;
      line-height: 1.4;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      padding: 24px;
      border-radius: 8px;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #0f172a;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    .brand-sub {
      font-size: 11px;
      color: #475569;
      margin: 2px 0;
    }
    .tax-badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .grid-2 {
      display: table;
      width: 100%;
    }
    .col {
      display: table-cell;
      vertical-align: top;
      width: 50%;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .meta-value {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    table.items-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      text-align: left;
    }
    table.items-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    table.items-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals-area {
      display: table;
      width: 100%;
      margin-top: 12px;
    }
    .gst-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      font-size: 10px;
      border-radius: 4px;
      overflow: hidden;
    }
    .gst-table th {
      background: #e2e8f0;
      font-weight: 700;
      padding: 4px 8px;
      text-align: right;
    }
    .gst-table th:first-child { text-align: left; }
    .gst-table td {
      padding: 4px 8px;
      border-bottom: 1px solid #e2e8f0;
      text-align: right;
    }
    .gst-table td:first-child { text-align: left; }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .summary-table td {
      padding: 4px 8px;
    }
    .grand-total-row {
      background: #0f172a;
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
      border-radius: 4px;
    }
    .words-box {
      margin-top: 12px;
      padding: 8px 12px;
      background: #f1f5f9;
      border-left: 4px solid #0f172a;
      font-size: 11px;
      font-style: italic;
      color: #334155;
    }
    .footer-signatures {
      display: table;
      width: 100%;
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px dashed #cbd5e1;
    }
    .footer-terms {
      margin-top: 16px;
      font-size: 9px;
      color: #64748b;
      text-align: center;
      line-height: 1.5;
    }
    @media print {
      body {
        padding: 0;
      }
      .invoice-card {
        border: none;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 800px; margin: 0 auto 12px auto; display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; padding: 10px 16px; border-radius: 8px;">
    <span style="font-weight: 700; font-size: 13px;">Print Preview • Satyam Medical Invoice</span>
    <div>
      <button onclick="window.print()" style="background: #0f172a; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer;">
        Print Invoice
      </button>
      <button onclick="window.close()" style="background: #e2e8f0; color: #334155; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; margin-left: 8px; cursor: pointer;">
        Close
      </button>
    </div>
  </div>

  <div class="invoice-card">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <h1 class="brand-title">${pharmacyName}</h1>
          <p class="brand-sub"><strong>Address:</strong> ${pharmacyAddress}</p>
          <p class="brand-sub"><strong>DL No:</strong> ${dlNo} &nbsp;|&nbsp; <strong>GSTIN:</strong> ${gstin}</p>
          <p class="brand-sub"><strong>Contact:</strong> ${contact} &nbsp;|&nbsp; <strong>Email:</strong> ${email}</p>
        </td>
        <td style="vertical-align: top; text-align: right; width: 220px;">
          <div class="tax-badge">${isGst ? 'TAX INVOICE' : 'RETAIL CASH MEMO'}</div>
          <div style="margin-top: 8px; font-size: 13px; font-weight: 800; font-family: monospace;">${invoiceNo}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">Date: <strong>${dateStr}</strong></div>
          <div style="font-size: 10px; color: #64748b;">Time: ${timeStr}</div>
          <div style="font-size: 10px; color: #0284c7; font-weight: 700; margin-top: 4px;">Payment: ${data.paymentMethod.toUpperCase()}</div>
        </td>
      </tr>
    </table>

    <!-- Customer Details -->
    <div class="meta-box">
      <div class="grid-2">
        <div class="col">
          <div class="meta-label">Customer / Patient Details</div>
          <div class="meta-value">${data.customerName || 'Walk-in Customer'}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">Mobile: ${data.customerMobile || 'Not provided'}</div>
        </div>
        <div class="col" style="padding-left: 20px;">
          <div class="meta-label">Doctor & Dispensing Info</div>
          <div class="meta-value">Dr. ${data.doctorName || 'Self / Registered Medical Practitioner'}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">Pharmacist: ${data.staffName || 'Registered Pharmacist'}</div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Medicine Description</th>
          <th class="text-center" style="width: 75px;">Batch</th>
          <th class="text-center" style="width: 70px;">HSN</th>
          <th class="text-center" style="width: 45px;">Qty</th>
          <th class="text-right" style="width: 70px;">MRP</th>
          <th class="text-right" style="width: 60px;">Rate</th>
          <th class="text-right" style="width: 80px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, idx) => {
          const itemPrice = item.price || item.rate || 0;
          const qty = item.quantity || 1;
          const lineTotal = itemPrice * qty;
          return `
            <tr>
              <td class="text-center" style="color: #64748b;">${idx + 1}</td>
              <td>
                <strong style="color: #0f172a;">${item.name || item.medicineName}</strong>
                ${item.unit ? `<span style="color: #64748b; font-size: 10px;"> (${item.unit})</span>` : ''}
              </td>
              <td class="text-center" style="font-family: monospace; font-size: 10px;">${item.batchNumber || 'GEN-01'}</td>
              <td class="text-center" style="font-size: 10px; color: #64748b;">3004</td>
              <td class="text-center" style="font-weight: 700;">${qty}</td>
              <td class="text-right">${formatCurrency(itemPrice)}</td>
              <td class="text-right">${formatCurrency(itemPrice)}</td>
              <td class="text-right" style="font-weight: 700;">${formatCurrency(lineTotal)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- Totals & Tax Breakdown -->
    <div class="totals-area">
      <div class="col" style="padding-right: 16px;">
        ${isGst ? `
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 4px;">
            GST Tax Breakdown (12%)
          </div>
          <table class="gst-table">
            <thead>
              <tr>
                <th>Tax Head</th>
                <th>Taxable Val</th>
                <th>Rate</th>
                <th>Tax Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>CGST</td>
                <td>${formatCurrency(subtotal)}</td>
                <td>6%</td>
                <td>${formatCurrency(cgstAmount)}</td>
              </tr>
              <tr>
                <td>SGST</td>
                <td>${formatCurrency(subtotal)}</td>
                <td>6%</td>
                <td>${formatCurrency(sgstAmount)}</td>
              </tr>
              <tr style="font-weight: 700; background: #f8fafc;">
                <td>Total Tax</td>
                <td>${formatCurrency(subtotal)}</td>
                <td>12%</td>
                <td>${formatCurrency(totalGst)}</td>
              </tr>
            </tbody>
          </table>
        ` : `
          <div style="font-size: 10px; color: #64748b; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            <strong>Note:</strong> Standard retail cash memo. All rates are inclusive of applicable taxes.
          </div>
        `}
      </div>

      <div class="col" style="padding-left: 16px;">
        <table class="summary-table">
          <tr>
            <td style="color: #64748b;">Total Items / Units:</td>
            <td class="text-right" style="font-weight: 700;">${data.items.length} items (${totalUnits} pcs)</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Subtotal (Taxable):</td>
            <td class="text-right" style="font-weight: 700;">${formatCurrency(subtotal)}</td>
          </tr>
          ${isGst ? `
            <tr>
              <td style="color: #64748b;">CGST (6%):</td>
              <td class="text-right">${formatCurrency(cgstAmount)}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">SGST (6%):</td>
              <td class="text-right">${formatCurrency(sgstAmount)}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="color: #64748b;">Round Off:</td>
            <td class="text-right">₹0.00</td>
          </tr>
          <tr class="grand-total-row">
            <td style="padding: 8px 10px; border-radius: 4px 0 0 4px;">Grand Total:</td>
            <td class="text-right" style="padding: 8px 10px; border-radius: 0 4px 4px 0;">${formatCurrency(grandTotal)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Amount in Words -->
    <div class="words-box">
      <strong>Amount in Words:</strong> ${amountInWords}
    </div>

    <!-- Signatures -->
    <table class="footer-signatures">
      <tr>
        <td style="width: 50%; vertical-align: bottom;">
          <div style="font-size: 11px; color: #64748b;">Customer Signature</div>
          <div style="margin-top: 30px; border-bottom: 1px dashed #94a3b8; width: 160px;"></div>
        </td>
        <td style="width: 50%; text-align: right; vertical-align: bottom;">
          <div style="font-size: 11px; font-weight: 700; color: #0f172a;">For ${pharmacyName}</div>
          <div style="margin-top: 30px; border-bottom: 1px dashed #94a3b8; width: 160px; margin-left: auto;"></div>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Authorized Pharmacist Signatory</div>
        </td>
      </tr>
    </table>

    <!-- Footer Terms -->
    <div class="footer-terms">
      Medicines once sold cannot be returned without original batch verification and cash memo. Store medicines in a cool, dry place away from direct sunlight.<br/>
      Thank you for choosing Satyam Medical Stores. We wish you a speedy recovery!
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers the clean printable HTML invoice directly in the browser
 */
export function printCleanHtmlInvoice(data: InvoiceData): void {
  const htmlContent = generatePrintableInvoiceHtml(data);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('Auto-print triggered exception:', e);
      }
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2000);
    }, 450);
  }
}
