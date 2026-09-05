import { jsPDF } from 'jspdf';

export interface InvoiceLineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePdfData {
  invoiceId: string | number;
  customerName: string;
  amount: number;
  isPaid: boolean;
  deliveryReconciliation?: string;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  lines?: InvoiceLineItem[];
}

export function generateInvoicePdf(data: InvoicePdfData): Blob {
  const {
    invoiceId,
    customerName,
    amount,
    isPaid,
    deliveryReconciliation = 'Shipment WH1/OUT/001 (8 units) and WH2/OUT/002 (2 units) verified delivered. Invoiced amounts match fulfilled physical goods.',
    currency = 'INR',
    issueDate = '2026-09-01',
    dueDate = '2026-09-30',
    lines = [
      { description: 'Laptop Pro 14"', qty: 10, unitPrice: 44000, total: 440000 },
      { description: 'Setup Service', qty: 1, unitPrice: 82000, total: 82000 },
    ],
  } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Top Header Bar (Brand theme)
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DealFlow360', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('SALES GOVERNANCE & ODOO FINANCIAL AUDIT', margin, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`INVOICE SUMMARY #INV-${invoiceId}`, pageWidth - margin, 15, { align: 'right' });

  // 2. Document Title & Details
  let y = 36;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Invoice Detail: INV-${invoiceId}`, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Delivery reconciliation and payment registration against Odoo general ledger', margin, y + 5);

  y += 14;

  // 3. Metadata Grid Card
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  // Customer Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('BILLED TO / CUSTOMER', margin + 4, y + 6);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(customerName, margin + 4, y + 13);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Verified Enterprise Partner', margin + 4, y + 19);

  // Dates
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('ISSUE DATE', margin + 65, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(issueDate, margin + 65, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('DUE DATE', margin + 105, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(dueDate, margin + 105, y + 13);

  // Status Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('PAYMENT STATUS', pageWidth - margin - 35, y + 6);

  if (isPaid) {
    doc.setFillColor(220, 252, 231); // Green 100
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(pageWidth - margin - 35, y + 9, 31, 8, 1.5, 1.5, 'FD');
    doc.setTextColor(22, 101, 52); // Green 800
    doc.setFontSize(8);
    doc.text('PAID IN FULL', pageWidth - margin - 19.5, y + 14.5, { align: 'center' });
  } else {
    doc.setFillColor(254, 226, 226); // Red 100
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(pageWidth - margin - 35, y + 9, 31, 8, 1.5, 1.5, 'FD');
    doc.setTextColor(153, 27, 27); // Red 800
    doc.setFontSize(8);
    doc.text('UNPAID', pageWidth - margin - 19.5, y + 14.5, { align: 'center' });
  }

  y += 30;

  // 4. Milestone Progression / Stepper
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');

  const steps = [
    { label: 'Order Confirmed', done: true },
    { label: 'Shipped', done: true },
    { label: 'Invoiced', done: true },
    { label: isPaid ? 'Paid' : 'Unpaid', done: isPaid },
  ];

  const stepSpacing = contentWidth / 4;
  steps.forEach((step, idx) => {
    const stepX = margin + idx * stepSpacing + 6;
    doc.setFillColor(step.done ? 34 : 203, step.done ? 197 : 213, step.done ? 94 : 225);
    doc.circle(stepX + 2, y + 7, 2.5, 'F');

    doc.setFont('helvetica', step.done ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(step.done ? 15 : 100, step.done ? 23 : 116, step.done ? 42 : 139);
    doc.text(step.label, stepX + 7, y + 8);
  });

  y += 19;

  // 5. Delivery Reconciliation Card
  doc.setFillColor(240, 253, 250); // Teal/Emerald 50
  doc.setDrawColor(153, 246, 228);
  doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 118, 110);
  doc.text('DELIVERY RECONCILIATION AUDIT', margin + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(deliveryReconciliation, margin + 4, y + 11.5, { maxWidth: contentWidth - 8 });

  y += 24;

  // 6. Line Items Table
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(margin, y, contentWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('PRODUCT / SERVICE DESCRIPTION', margin + 4, y + 5.5);
  doc.text('QTY', margin + 100, y + 5.5, { align: 'center' });
  doc.text('UNIT PRICE', margin + 135, y + 5.5, { align: 'right' });
  doc.text('AMOUNT', pageWidth - margin - 4, y + 5.5, { align: 'right' });

  y += 8;

  let subtotal = 0;
  lines.forEach((line, idx) => {
    subtotal += line.total;
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, y, contentWidth, 8, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(line.description, margin + 4, y + 5.5);
    doc.text(String(line.qty), margin + 100, y + 5.5, { align: 'center' });
    doc.text(`${currency === 'INR' ? 'INR ' : '$'}${line.unitPrice.toLocaleString('en-IN')}`, margin + 135, y + 5.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`${currency === 'INR' ? 'INR ' : '$'}${line.total.toLocaleString('en-IN')}`, pageWidth - margin - 4, y + 5.5, { align: 'right' });

    y += 8;
  });

  // Table bottom border
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);

  y += 4;

  // 7. Totals Summary Block
  const taxAmount = amount - subtotal > 0 ? amount - subtotal : Math.round(subtotal * 0.18);
  const finalTotal = amount > 0 ? amount : subtotal + taxAmount;

  const totalBlockX = pageWidth - margin - 75;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal (Net):', totalBlockX, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${currency === 'INR' ? 'INR ' : '$'}${subtotal.toLocaleString('en-IN')}`, pageWidth - margin - 4, y + 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('GST / Tax (Reconciled):', totalBlockX, y + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${currency === 'INR' ? 'INR ' : '$'}${taxAmount.toLocaleString('en-IN')}`, pageWidth - margin - 4, y + 11, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(totalBlockX, y + 14, pageWidth - margin, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Total Invoiced:', totalBlockX, y + 21);
  doc.setFontSize(12);
  doc.setTextColor(14, 165, 233); // Brand color
  doc.text(`${currency === 'INR' ? 'INR ' : '$'}${finalTotal.toLocaleString('en-IN')}`, pageWidth - margin - 4, y + 21, { align: 'right' });

  y += 34;

  // 8. Governance & Compliance Footer Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('GOVERNANCE COMPLIANCE & AUDIT TRAIL', margin + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('1. Delivery Milestone Rule: Physically delivered items reconciled against picking receipts prior to invoice issuance.', margin + 4, y + 10.5);
  doc.text('2. General Ledger Verification: Reconciled with Odoo account.move journals with automated revenue recognition.', margin + 4, y + 15);
  doc.text(`3. Audit Timestamp: ${new Date().toISOString()} | Certified by DealFlow360 Guardian Engine`, margin + 4, y + 19.5);

  // Footer page mark
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('DealFlow360 Executive Report · Confidential & Proprietary · Generated for Acme Corp', pageWidth / 2, 290, { align: 'center' });

  // Save in browser
  doc.save(`INV-${invoiceId}-Acme-Corp-Summary.pdf`);

  return doc.output('blob');
}
