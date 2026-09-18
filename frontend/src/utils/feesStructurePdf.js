import { jsPDF } from 'jspdf';

const toText = (value) => String(value ?? '').trim();
const toAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const formatCurrency = (value) =>
  `INR ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(toAmount(value))}`;

const formatDate = (value) => {
  const raw = toText(value);
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toFileSafe = (value) =>
  toText(value)
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);

const parseHexColor = (value) => {
  const input = toText(value).replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(input)) return [15, 23, 42];
  return [
    Number.parseInt(input.slice(0, 2), 16),
    Number.parseInt(input.slice(2, 4), 16),
    Number.parseInt(input.slice(4, 6), 16),
  ];
};

const loadLogoDataUrl = async (logoUrl) => {
  const src = toText(logoUrl);
  if (!src) return '';
  try {
    const response = await fetch(src);
    if (!response.ok) return '';
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

// Draws a bordered, zebra-striped table using only core jsPDF primitives (no
// jspdf-autotable dependency, which this project doesn't install). Every
// column is centered by default; pass `align` per column to override.
const drawTable = ({ doc, startY, columns, rows, accent, onNewPage }) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const tableWidth = pageWidth - marginX * 2;
  const rowHeight = 8;
  const [r, g, b] = accent;

  let y = startY;
  const x = marginX;

  const ensureSpace = (required) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + required <= pageHeight - 14) return;
    doc.addPage();
    y = 16;
    onNewPage?.();
  };

  ensureSpace(rowHeight * 2);

  // Header row
  doc.setFillColor(r, g, b);
  doc.rect(x, y, tableWidth, rowHeight, 'F');
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.2);
  doc.rect(x, y, tableWidth, rowHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  let colX = x;
  columns.forEach((col, idx) => {
    if (idx > 0) doc.line(colX, y, colX, y + rowHeight);
    doc.text(col.label, colX + col.width / 2, y + 5.3, { align: 'center' });
    colX += col.width;
  });
  y += rowHeight;

  // Body rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  rows.forEach((row, rowIndex) => {
    ensureSpace(rowHeight + 2);
    const shade = rowIndex % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
    doc.setFillColor(...shade);
    doc.rect(x, y, tableWidth, rowHeight, 'F');
    doc.setDrawColor(218, 226, 236);
    doc.rect(x, y, tableWidth, rowHeight);
    doc.setTextColor(32, 43, 58);

    let cellX = x;
    columns.forEach((col, idx) => {
      if (idx > 0) doc.line(cellX, y, cellX, y + rowHeight);
      const value = toText(row[idx] ?? '');
      const clipped = doc.splitTextToSize(value, col.width - 4)[0] || '';
      const align = col.align || 'center';
      if (align === 'right') {
        doc.text(clipped, cellX + col.width - 2, y + 5.3, { align: 'right' });
      } else if (align === 'left') {
        doc.text(clipped, cellX + 2, y + 5.3);
      } else {
        doc.text(clipped, cellX + col.width / 2, y + 5.3, { align: 'center' });
      }
      cellX += col.width;
    });
    y += rowHeight;
  });

  return y;
};

export const downloadFeesStructurePdf = async ({ structure = {}, school = {} }) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Colors ────────────────────────────────────────────────────────────
  const [r, g, b] = parseHexColor(school.accentColor || '#0f172a');
  const darkText = [15, 23, 42];
  const mutedText = [71, 85, 105];
  const borderColor = [203, 213, 225];

  // ── School info ───────────────────────────────────────────────────────
  const schoolName = toText(school.schoolName) || 'School';
  const schoolAddressLine = toText(school.schoolAddressLine);
  const rawContactLine = toText(school.schoolContactLine);
  const schoolContactLine = [
    ...new Set(rawContactLine.split(/[|\n]+/).map((item) => item.trim()).filter(Boolean)),
  ].join('  |  ');
  const logoUrl = toText(school.logoUrl || school.logoUrlOverride);
  const logoDataUrl = await loadLogoDataUrl(logoUrl);

  // ── Structure info ────────────────────────────────────────────────────
  const classLabel = toText(structure.className || structure.class || '-');
  const board = toText(structure.board || 'GENERAL');
  const year = toText(structure.academicYearName || structure.academicYear || '');
  const generatedOn = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const feeHeads = structure.feeHeads || [];
  const totalAmount = toAmount(
    structure.totalAmount || feeHeads.reduce((sum, item) => sum + toAmount(item?.amount), 0)
  );
  const lateFeeAmount = toAmount(structure.lateFeeAmount);

  const redrawPageBorder = () => {
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.35);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
  };

  // ── Page border ───────────────────────────────────────────────────────
  redrawPageBorder();

  // ── School header ─────────────────────────────────────────────────────
  const headerTop = 8;
  const headerHeight = 32;
  doc.setFillColor(r, g, b);
  doc.rect(8, headerTop, pageWidth - 16, headerHeight, 'F');

  // Logo — plain square (no rounded corners), generous gap before the text
  // block so a logo can never run into the school name.
  const logoSize = 16;
  const logoX = 12;
  const logoY = headerTop + (headerHeight - logoSize) / 2;
  let headerTextX = 16;

  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.rect(logoX, logoY, logoSize, logoSize, 'F');
      doc.addImage(logoDataUrl, 'PNG', logoX + 1, logoY + 1, logoSize - 2, logoSize - 2);
      headerTextX = logoX + logoSize + 6;
    } catch {
      // Ignore logo render failure — text still starts at the default margin.
    }
  }

  const headerTextWidth = pageWidth - headerTextX - 12;
  doc.setTextColor(255, 255, 255);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(schoolName.toUpperCase(), headerTextX, headerTop + 11, {
    align: 'left', maxWidth: headerTextWidth,
  });

  if (schoolAddressLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(schoolAddressLine, headerTextX, headerTop + 18, {
      align: 'left', maxWidth: headerTextWidth,
    });
  }

  if (schoolContactLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text(schoolContactLine, headerTextX, headerTop + 24, {
      align: 'left', maxWidth: headerTextWidth,
    });
  }

  // ── Main title ────────────────────────────────────────────────────────
  const titleY = headerTop + headerHeight + 13;
  const title = `FEES STRUCTURE FOR CLASS ${classLabel}`;
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, pageWidth / 2, titleY, { align: 'center' });

  const titleWidth = doc.getTextWidth(title);
  doc.setDrawColor(...darkText);
  doc.setLineWidth(0.45);
  doc.line((pageWidth - titleWidth) / 2, titleY + 2, (pageWidth + titleWidth) / 2, titleY + 2);

  // ── Information section — Class / Board / Academic Year as a real
  //    2-row table (header labels, one values row underneath). ───────────
  const infoTop = titleY + 9;
  const infoMarginX = 12;
  const infoWidth = pageWidth - infoMarginX * 2;
  const infoColWidth = infoWidth / 3;

  let currentY = drawTable({
    doc,
    startY: infoTop,
    accent: [r, g, b],
    onNewPage: redrawPageBorder,
    columns: [
      { label: 'Class', width: infoColWidth },
      { label: 'Board', width: infoColWidth },
      { label: 'Academic Year', width: infoColWidth },
    ],
    rows: [[classLabel, board, year || '-']],
  }) + 14;

  // ── Fee breakdown ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkText);
  doc.text('Fee Breakdown', pageWidth / 2, currentY, { align: 'center' });
  const feeTitleWidth = doc.getTextWidth('Fee Breakdown');
  doc.setDrawColor(...darkText);
  doc.setLineWidth(0.3);
  doc.line((pageWidth - feeTitleWidth) / 2, currentY + 1.5, (pageWidth + feeTitleWidth) / 2, currentY + 1.5);

  const feeRows = feeHeads.length
    ? feeHeads.map((head, index) => [String(index + 1), toText(head?.label || '-'), formatCurrency(head?.amount)])
    : [['-', 'No fee heads configured', '-']];

  currentY = drawTable({
    doc,
    startY: currentY + 5,
    accent: [r, g, b],
    onNewPage: redrawPageBorder,
    columns: [
      { label: 'Sl No', width: 20 },
      { label: 'Fee Breakdown', width: 105 },
      { label: 'Amount', width: 61 },
    ],
    rows: feeRows,
  }) + 10;

  // ── Installment plan ──────────────────────────────────────────────────
  if (currentY > 245) {
    doc.addPage();
    redrawPageBorder();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkText);
  doc.text('Installment Plan', pageWidth / 2, currentY, { align: 'center' });
  const installmentTitleWidth = doc.getTextWidth('Installment Plan');
  doc.setDrawColor(...darkText);
  doc.setLineWidth(0.3);
  doc.line(
    (pageWidth - installmentTitleWidth) / 2, currentY + 1.5,
    (pageWidth + installmentTitleWidth) / 2, currentY + 1.5
  );

  const installments = structure.installments || [];
  const installmentRows = installments.length
    ? installments.map((item, index) => [
        String(index + 1), toText(item?.label || '-'), formatDate(item?.dueDate), formatCurrency(item?.amount),
      ])
    : [['1', 'Lump Sum Payment', '-', formatCurrency(totalAmount)]];
  const installmentTotal = installments.length
    ? installments.reduce((sum, item) => sum + toAmount(item?.amount), 0)
    : totalAmount;

  const installmentColumns = [
    { label: 'Sl No', width: 20 },
    { label: 'Installment Name', width: 75 },
    { label: 'Due Date', width: 45 },
    { label: 'Amount', width: 46 },
  ];

  currentY = drawTable({
    doc,
    startY: currentY + 5,
    accent: [r, g, b],
    onNewPage: redrawPageBorder,
    columns: installmentColumns,
    rows: installmentRows,
  });

  // Total row — Sl No + Installment Name + Due Date merge into one centered
  // "Total Fees" label (a 3-column colspan), Amount column holds the total.
  {
    const marginX = 12;
    const totalRowHeight = 8;
    const spanWidth = installmentColumns[0].width + installmentColumns[1].width + installmentColumns[2].width;
    if (currentY + totalRowHeight > pageHeight - 14) {
      doc.addPage();
      redrawPageBorder();
      currentY = 16;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, currentY, pageWidth - marginX * 2, totalRowHeight, 'F');
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.25);
    doc.rect(marginX, currentY, pageWidth - marginX * 2, totalRowHeight);
    doc.line(marginX + spanWidth, currentY, marginX + spanWidth, currentY + totalRowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...darkText);
    doc.text('Total Fees', marginX + spanWidth / 2, currentY + 5.3, { align: 'center' });
    doc.text(
      formatCurrency(installmentTotal),
      marginX + spanWidth + installmentColumns[3].width / 2,
      currentY + 5.3,
      { align: 'center' }
    );
    currentY += totalRowHeight + 12;
  }

  // ── Late fine policy ──────────────────────────────────────────────────
  if (currentY > 267) {
    doc.addPage();
    redrawPageBorder();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkText);
  doc.text('Late Fine Policy', pageWidth / 2, currentY, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedText);
  const lateFineText = lateFeeAmount > 0
    ? `Late Fine: ${formatCurrency(lateFeeAmount)} per day after the due date until payment.`
    : 'Late Fine: No late fine configured for this fee structure.';
  doc.text(lateFineText, pageWidth / 2, currentY + 6, { align: 'center', maxWidth: pageWidth - 30 });

  // ── Footer ────────────────────────────────────────────────────────────
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text('This is a computer-generated fee structure document.', pageWidth / 2, pageHeight - 13, {
    align: 'center',
  });

  const fileName = `fees_structure_${toFileSafe(classLabel) || 'class'}_${toFileSafe(year || generatedOn) || 'download'}.pdf`;
  doc.save(fileName);
};
