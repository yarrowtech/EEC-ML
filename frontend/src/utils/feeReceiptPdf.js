import { jsPDF } from 'jspdf';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-IN');
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatTime = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const toSafeText = (value, fallback = '-') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const clipText = (doc, value, maxWidth) => {
  const text = toSafeText(value);
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 3 && doc.getTextWidth(`${trimmed}...`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
};

const drawKV = (doc, label, value, x, y, width) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(60, 60, 60);
  doc.text(`${label}:`, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.text(clipText(doc, value, width), x + 22, y);
};

const loadImageAsDataUrl = async (url) => {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const downloadFeeReceiptPdf = async ({
  invoice,
  student,
  payment,
  receipt,
  school,
  schoolName = 'Electronic Educare School',
  schoolSubtitle = 'Fee Payment Receipt',
  signatureLabel = 'Signature of Accountant',
}) => {
  if (!invoice || !payment) return;

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const x = 10;
  const w = pageW - 20;
  const borderBlue = [28, 84, 163];
  const headerBlue = [28, 84, 163];
  const accentYellow = [245, 199, 52];
  const lightBlue = [240, 246, 255];

  const resolvedSchoolName = school?.name || schoolName;
  const resolvedDate = receipt?.date || payment.paidOn || payment.createdAt;
  const resolvedDateTime = receipt?.transactionDate || formatDateTime(resolvedDate);
  const resolvedTime = receipt?.transactionTime || formatTime(resolvedDate);
  const resolvedPayMode = receipt?.payMode || payment.method || '-';
  const resolvedReceiptNo =
    receipt?.receiptNo || payment.transactionId || payment.gatewayPaymentId || payment._id || '';
  const resolvedSid = receipt?.sid || student?.studentCode || student?.admissionNumber || '-';
  const resolvedChildName = receipt?.childName || student?.name || '-';
  const resolvedUsername = receipt?.username || student?.username || '-';
  const resolvedSession = receipt?.session || student?.academicYear || '-';
  const resolvedParentName = receipt?.parentName || student?.guardianName || '-';
  const resolvedTxn = payment.gatewayPaymentId || payment.referenceNumber || payment.transactionId || '-';
  const notes =
    Array.isArray(receipt?.notes) && receipt.notes.length
      ? receipt.notes
      : [
          'In case of any discrepancy, contact the school fees office within 7 days.',
          'This receipt is valid only after successful realization of payment.',
          'Preserve this receipt for school and audit records.',
        ];

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setDrawColor(...borderBlue);
  doc.setLineWidth(0.5);
  doc.rect(7, 7, pageW - 14, pageH - 14);

  doc.setFillColor(...headerBlue);
  doc.setDrawColor(...borderBlue);
  doc.rect(x, 10, w, 30, 'FD');

  const logoData = await loadImageAsDataUrl(school?.logoUrl);
  if (logoData) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 13, 18, 18, 2, 2, 'F');
      doc.addImage(logoData, 'PNG', 13, 14, 16, 16);
    } catch {
      // ignore logo draw failures
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(clipText(doc, String(resolvedSchoolName).toUpperCase(), 140), pageW / 2, 18.2, {
    align: 'center',
  });
  doc.setFontSize(8.6);
  doc.setFont('helvetica', 'normal');
  const headerLine = [school?.address || '', school?.contactPhone ? `Contact: ${school.contactPhone}` : '']
    .filter(Boolean)
    .join(' | ');
  if (headerLine) {
    doc.text(clipText(doc, headerLine, 185), pageW / 2, 24.2, { align: 'center' });
  }
  doc.text(clipText(doc, schoolSubtitle, 185), pageW / 2, 28.2, { align: 'center' });

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('FEE PAYMENT RECEIPT', pageW / 2, 45, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Transaction Date: ${resolvedDateTime}`, pageW / 2, 50, {
    align: 'center',
  });

  const infoTop = 56;
  doc.setFillColor(...lightBlue);
  doc.rect(x, infoTop, w, 48, 'FD');
  doc.setDrawColor(191, 219, 254);
  doc.rect(x, infoTop, w, 48);

  drawKV(doc, 'Receipt No', resolvedReceiptNo, 14, 63, 66);
  drawKV(doc, 'Transaction ID', resolvedTxn, 108, 63, 66);
  drawKV(doc, 'Date', formatDate(resolvedDate), 14, 69, 66);
  drawKV(doc, 'Time', resolvedTime, 108, 69, 66);
  drawKV(doc, 'Child Name', resolvedChildName, 14, 75, 66);
  drawKV(doc, 'Username', resolvedUsername, 108, 75, 66);
  drawKV(doc, 'Class', invoice.className || student?.grade || '-', 14, 81, 66);
  drawKV(doc, 'Section', invoice.section || student?.section || '-', 108, 81, 66);
  drawKV(doc, 'Session', resolvedSession, 14, 87, 66);
  drawKV(doc, 'Parent Name', resolvedParentName, 108, 87, 66);
  drawKV(doc, 'SID', resolvedSid, 14, 93, 66);
  drawKV(doc, 'Pay Mode', String(resolvedPayMode).toUpperCase(), 108, 93, 66);

  const tableX = x;
  const tableY = 110;
  const tableW = w;
  const headerH = 8;
  const rowH = 9;
  const col1 = 76;
  const col2 = 54;
  const col3 = 35;

  const rowHead = clipText(
    doc,
    `${invoice.title || 'Fee Payment'}${payment.notes ? ` (${payment.notes})` : ''}`,
    col1 - 3
  );

  doc.setFillColor(...accentYellow);
  doc.rect(tableX, tableY, tableW, headerH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PARTICULARS', tableX + 2, tableY + 5.3);
  doc.text('FREQUENCY', tableX + col1 + 2, tableY + 5.3);
  doc.text('PAYABLE', tableX + col1 + col2 + 2, tableY + 5.3);
  doc.text('AMOUNT', tableX + col1 + col2 + col3 + 2, tableY + 5.3);

  doc.setFillColor(...lightBlue);
  doc.rect(tableX, tableY + headerH, tableW, rowH * 2, 'FD');
  doc.line(tableX + col1, tableY, tableX + col1, tableY + headerH + rowH * 2);
  doc.line(tableX + col1 + col2, tableY, tableX + col1 + col2, tableY + headerH + rowH * 2);
  doc.line(
    tableX + col1 + col2 + col3,
    tableY,
    tableX + col1 + col2 + col3,
    tableY + headerH + rowH * 2
  );
  doc.line(tableX, tableY + headerH + rowH, tableX + tableW, tableY + headerH + rowH);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.7);
  doc.text(rowHead, tableX + 2, tableY + headerH + 5.8);
  doc.text('ONE TIME', tableX + col1 + 2, tableY + headerH + 5.8);
  doc.text('AT PAYMENT', tableX + col1 + col2 + 2, tableY + headerH + 5.8);
  doc.text(
    `Rs. ${String(Math.round(Number(payment.amount || 0)))}`,
    tableX + col1 + col2 + col3 + 2,
    tableY + headerH + 5.8
  );

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL FEES PAID', tableX + 2, tableY + headerH + rowH + 5.8);
  doc.text(
    `Rs. ${String(Math.round(Number(payment.amount || 0)))}`,
    tableX + col1 + col2 + col3 + 2,
    tableY + headerH + rowH + 5.8
  );

  const feeHeads = Array.isArray(invoice.feeHeadsSnapshot) ? invoice.feeHeadsSnapshot : [];
  let currentY = tableY + headerH + rowH * 2 + 6;

  if (feeHeads.length) {
    doc.setFillColor(...accentYellow);
    doc.rect(tableX, currentY, tableW, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('FEE BREAKUP', pageW / 2, currentY + 5.4, { align: 'center' });

    currentY += 8;
    doc.setFillColor(...lightBlue);
    doc.rect(tableX, currentY, tableW, 8, 'FD');
    doc.setFontSize(8.7);
    doc.text('PARTICULARS', tableX + 2, currentY + 5.3);
    doc.text('AMOUNT', tableX + tableW - 24, currentY + 5.3);

    currentY += 8;
    feeHeads.slice(0, 6).forEach((head) => {
      doc.rect(tableX, currentY, tableW, 8);
      doc.line(tableX + tableW - 30, currentY, tableX + tableW - 30, currentY + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(clipText(doc, head.label || '-', tableW - 36), tableX + 2, currentY + 5.3);
      doc.text(`Rs. ${String(Math.round(Number(head.amount || 0)))}`, tableX + tableW - 28, currentY + 5.3);
      currentY += 8;
    });
  }

  const transportHead = feeHeads.find((head) => /transport/i.test(String(head?.label || '')));
  if (transportHead) {
    currentY += 4;
    const monthly = Math.round(Number(transportHead.amount || 0) / 3);
    const quarterly = Math.round(Number(transportHead.amount || 0));

    doc.setFillColor(...headerYellow);
    doc.rect(tableX, currentY, tableW, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TRANSPORTATION CHARGES (AS PER DISTANCE)', pageW / 2, currentY + 5.4, {
      align: 'center',
    });

    currentY += 8;
    doc.setFillColor(...lightYellow);
    doc.rect(tableX, currentY, tableW, 8, 'FD');
    doc.setFontSize(8.7);
    doc.text('PARTICULARS', tableX + 2, currentY + 5.3);
    doc.text('FREQUENCY', tableX + 74, currentY + 5.3);
    doc.text('MONTHLY', tableX + 130, currentY + 5.3);
    doc.text('QUARTERLY', tableX + 163, currentY + 5.3);

    currentY += 8;
    doc.rect(tableX, currentY, tableW, 8);
    doc.line(tableX + 70, currentY, tableX + 70, currentY + 8);
    doc.line(tableX + 126, currentY, tableX + 126, currentY + 8);
    doc.line(tableX + 159, currentY, tableX + 159, currentY + 8);
    doc.setFont('helvetica', 'normal');
    doc.text('TRANSPORT FEE', tableX + 2, currentY + 5.3);
    doc.text('QUARTERLY', tableX + 72, currentY + 5.3);
    doc.text(`Rs. ${String(monthly)}`, tableX + 128, currentY + 5.3);
    doc.text(`Rs. ${String(quarterly)}`, tableX + 161, currentY + 5.3);
    currentY += 8;
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.setFontSize(9);
  doc.text(`Amount Received: Rs. ${formatCurrency(payment.amount)}`, 14, currentY + 7);
  doc.text(
    `Outstanding Balance: Rs. ${formatCurrency(
      Math.max(
        0,
        Number(invoice.totalAmount || 0) -
          Number(invoice.discountAmount || 0) -
          Number(invoice.paidAmount || 0)
      )
    )}`,
    14,
    currentY + 12
  );

  currentY += 17;
  doc.setFontSize(8.7);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTE:', 14, currentY);
  doc.setFont('helvetica', 'normal');
  notes.slice(0, 3).forEach((note, idx) => {
    doc.text(`${idx + 1}. ${clipText(doc, note, 174)}`, 18, currentY + 6 + idx * 5.5);
  });

  // doc.setDrawColor(140, 140, 140);
  // doc.line(pageW - 70, currentY + 22, pageW - 20, currentY + 22);
  // doc.setFontSize(9);
  // doc.text(signatureLabel, pageW - 45, currentY + 27, { align: 'center' });

  doc.setFillColor(...lightBlue);
  doc.setDrawColor(...borderBlue);
  doc.rect(10, pageH - 20, pageW - 20, 10, 'FD');
  doc.setFontSize(8.2);
  doc.setTextColor(54, 54, 54);
  doc.text(
    `Generated on ${new Date().toLocaleString('en-IN')} | This is a computer-generated receipt.`,
    pageW / 2,
    pageH - 13.8,
    {
      align: 'center',
    }
  );

  const fileId = payment.transactionId || payment._id || Date.now();
  doc.save(`fee-receipt-${String(fileId).replace(/[^\w-]/g, '')}.pdf`);
};
