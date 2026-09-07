import { jsPDF } from 'jspdf';

const DEFAULT_TEMPLATE = {
  title: 'ACADEMIC PERFORMANCE REPORT',
  subtitle: 'Official Student Progress Record',
  schoolName: 'Electronic Educare Academy',
  schoolAddressLine: 'Main Campus, Educational District',
  schoolContactLine: 'Contact: +1 234 567 890 | email: info@educare.edu',
  accentColor: '#0f172a', // Slate 900
  showPageBorder: true,
  watermarkText: '',
  footerNote: 'This is an official computer-generated document. No signature is required unless specified.',
  signatureLabel: 'Class Teacher',
  principalLabel: 'Head of Institution',
};

const toText = (value) => String(value ?? '').trim();

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

const imageFormatFromDataUrl = (dataUrl) => {
  const m = /^data:image\/(png|jpe?g)/i.exec(String(dataUrl || ''));
  if (!m) return 'PNG';
  return m[1].toLowerCase().startsWith('jp') ? 'JPEG' : 'PNG';
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

const drawPageStructure = (doc, template, r, g, b, letterheadDataUrl) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  if (template.showPageBorder) {
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
    doc.setLineWidth(0.2);
    doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
  }

  // Header background — skipped when a school letterhead image is supplied,
  // since the letterhead becomes the header instead.
  if (!letterheadDataUrl) {
    doc.setFillColor(r, g, b);
    doc.rect(7, 7, pageWidth - 14, 35, 'F');
  }
};

const drawWatermark = (doc, template) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const watermark = toText(template.watermarkText).toUpperCase();
  if (!watermark) return;

  try {
    doc.saveGraphicsState();
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    if (typeof doc.GState === 'function') {
      doc.setGState(new doc.GState({ opacity: 0.1 }));
    }

    const textWidth = doc.getTextWidth(watermark);
    const stepX = Math.max(textWidth + 28, 110);
    const stepY = 46;
    for (let y = 64; y < pageHeight + 30; y += stepY) {
      for (let x = -20; x < pageWidth + stepX; x += stepX) {
        doc.text(watermark, x, y, { angle: 30 });
      }
    }

    doc.restoreGraphicsState();
  } catch {
    // Fallback for environments without advanced graphics state support.
    doc.setTextColor(188, 198, 212);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    const textWidth = doc.getTextWidth(watermark);
    const stepX = Math.max(textWidth + 28, 110);
    const stepY = 46;
    for (let y = 64; y < pageHeight + 30; y += stepY) {
      for (let x = -20; x < pageWidth + stepX; x += stepX) {
        doc.text(watermark, x, y, { angle: 30 });
      }
    }
  }
};

const drawHeader = (doc, template, reportCard, logoDataUrl, r, g, b, letterheadDataUrl) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerCenterX = pageWidth / 2;
  const selectedExamName = toText(reportCard.term);

  if (letterheadDataUrl) {
    // ── School letterhead as the page header ──
    try {
      doc.addImage(
        letterheadDataUrl,
        imageFormatFromDataUrl(letterheadDataUrl),
        7, 8, pageWidth - 14, 26,
        undefined,
        'FAST',
      );
    } catch { /* letterhead is optional — ignore a bad/undecodable image */ }
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.4);
    doc.line(10, 35.5, pageWidth - 10, 35.5);

    // Report title in dark ink below the letterhead
    doc.setTextColor(r, g, b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(toText(template.title).toUpperCase(), headerCenterX, 41.5, { align: 'center' });
    if (selectedExamName) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(90, 100, 115);
      doc.text(`Examination: ${selectedExamName}`, headerCenterX, 45.5, { align: 'center' });
    }
  } else {
    // School Info
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(toText(template.schoolName).toUpperCase(), headerCenterX, 17.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const addressLine = toText(template.schoolAddressLine) || 'Address not available';
    const contactLine = toText(template.schoolContactLine);
    const maxHeaderTextWidth = pageWidth - 56;
    const addressLines = doc.splitTextToSize(addressLine, maxHeaderTextWidth).slice(0, 2);
    let metaY = 23.5;
    addressLines.forEach((line) => {
      doc.text(line, headerCenterX, metaY, { align: 'center' });
      metaY += 3.6;
    });
    if (contactLine) {
      const contactLines = doc.splitTextToSize(contactLine, maxHeaderTextWidth).slice(0, 1);
      contactLines.forEach((line) => {
        doc.text(line, headerCenterX, metaY, { align: 'center' });
        metaY += 3.6;
      });
    }

    // Report Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(toText(template.title), headerCenterX, 33.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (selectedExamName) {
      doc.text(`Examination: ${selectedExamName}`, headerCenterX, 37.5, { align: 'center' });
    }

    // Logo
    if (logoDataUrl) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(12, 10, 20, 20, 2, 2, 'F');
        doc.addImage(logoDataUrl, imageFormatFromDataUrl(logoDataUrl), 13, 11, 18, 18);
      } catch {}
    }
  }

  // Student Info Box
  doc.setTextColor(30, 41, 59);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(10, 48, pageWidth - 20, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('STUDENT INFORMATION', pageWidth / 2, 54, { align: 'center' });
  doc.setLineWidth(0.1);
  doc.line((pageWidth / 2) - 21, 55, (pageWidth / 2) + 21, 55);

  doc.setFontSize(10);
  doc.text(`Name: ${toText(reportCard.studentName).toUpperCase()}`, 14, 62);
  doc.text(`Roll: ${toText(reportCard.roll || reportCard.studentCode || '-')}`, 14, 68);
  
  doc.text(`Class: ${toText(reportCard.grade || '-')}`, 100, 62);
  doc.text(`Section: ${toText(reportCard.section || '-')}`, 100, 68);
  
  doc.text(`Academic Year: ${toText(reportCard.academicYear || '-')}`, 155, 62);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 155, 68);
};

const drawGradingScale = (doc, startY) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('GRADING SCALE:', margin, startY);
  
  doc.setFont('helvetica', 'normal');
  const scale = 'A+: 90-100% | A: 80-89% | B: 70-79% | C: 60-69% | D: 50-59% | F: <50%';
  doc.text(scale, margin + 28, startY);
};

const drawTable = (doc, headers, data, startY, widths, title, accentColor) => {
  const margin = 10;
  let currentY = startY;
  const [r, g, b] = accentColor;
  const totalWidth = widths.reduce((a, n) => a + n, 0);
  const rowHeight = 8;

  const drawVerticalGridLines = (y, height) => {
    let x = margin;
    widths.forEach((w, idx) => {
      if (idx > 0) {
        doc.line(x, y, x, y + height);
      }
      x += w;
    });
  };

  const drawHeader = () => {
    doc.setFillColor(r, g, b);
    doc.rect(margin, currentY, totalWidth, 8, 'F');
    doc.setDrawColor(191, 203, 218);
    doc.setLineWidth(0.25);
    doc.rect(margin, currentY, totalWidth, 8);
    drawVerticalGridLines(currentY, 8);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x + 2, currentY + 5.5);
      x += widths[i];
    });
    currentY += 8;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
  };

  // Table Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(r, g, b);
  doc.text(title.toUpperCase(), margin, currentY);
  currentY += 4;

  drawHeader();

  data.forEach((rowItem, rowIndex) => {
    const row = Array.isArray(rowItem) ? rowItem : rowItem?.cells || [];
    const rowType = Array.isArray(rowItem) ? 'normal' : rowItem?.type || 'normal';
    // Page break check
    if (currentY > 260) {
      doc.addPage();
      currentY = 20;
      drawHeader();
    }

    if (rowType === 'total') {
      doc.setFillColor(226, 232, 240);
      doc.rect(margin, currentY, totalWidth, rowHeight, 'F');
    } else if (rowType === 'remark') {
      doc.setFillColor(240, 253, 244);
      doc.rect(margin, currentY, totalWidth, rowHeight, 'F');
    } else if (rowIndex % 2 === 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, currentY, totalWidth, rowHeight, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, currentY, totalWidth, rowHeight, 'F');
    }

    doc.setDrawColor(191, 203, 218);
    doc.setLineWidth(0.25);
    doc.rect(margin, currentY, totalWidth, rowHeight);

    if (rowType === 'remark') {
      const xAfterSubject = margin + widths[0];
      const mergedWidth = widths[1] + widths[2] + widths[3] + widths[4];
      doc.line(xAfterSubject, currentY, xAfterSubject, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.text(toText(row[0]), margin + 2, currentY + 5.4);
      doc.text(toText(row[1]), xAfterSubject + (mergedWidth / 2), currentY + 5.4, { align: 'center' });
    } else {
      drawVerticalGridLines(currentY, rowHeight);
      let currentX = margin;
      doc.setFont(rowType === 'total' ? 'helvetica' : 'helvetica', rowType === 'total' ? 'bold' : 'normal');
      row.forEach((cell, cellIndex) => {
        const text = toText(cell);
        const clipped = doc.splitTextToSize(text, widths[cellIndex] - 3)[0];
        doc.text(clipped, currentX + 2, currentY + 5.4);
        currentX += widths[cellIndex];
      });
    }
    currentY += rowHeight;
  });

  return currentY + 5;
};

const renderReportCardPage = (doc, template, reportCard, logoDataUrl, letterheadDataUrl) => {
  const mergedTemplate = { ...DEFAULT_TEMPLATE, ...(template || {}) };
  const [r, g, b] = parseHexColor(mergedTemplate.accentColor);

  drawPageStructure(doc, mergedTemplate, r, g, b, letterheadDataUrl);
  drawWatermark(doc, mergedTemplate);
  drawHeader(doc, mergedTemplate, reportCard, logoDataUrl, r, g, b, letterheadDataUrl);

  // Consolidated Summary
  const subjectsHeaders = ['SUBJECT', 'OBTAINED', 'TOTAL MARKS', 'PERCENTAGE', 'GRADE'];
  const subjectsWidths = [80, 30, 30, 25, 25];
  const baseSubjectRows = (reportCard.subjects || []).map(s => [
    s.name,
    s.obtainedMarks,
    s.totalMarks,
    `${s.percentage}%`,
    s.grade
  ]);
  const totals = reportCard.totals || {};
  const remarkLabel = totals.promoted === true ? 'PROMOTED' : totals.promoted === false ? 'NOT PROMOTED' : 'PENDING';
  const subjectsData = [
    ...baseSubjectRows,
    {
      type: 'total',
      cells: [
        'TOTAL',
        `${totals.obtainedMarks || 0}`,
        `${totals.totalMarks || 0}`,
        `${totals.percentage || 0}%`,
        `${totals.grade || '-'}`,
      ],
    },
    {
      type: 'remark',
      cells: ['REMARK', remarkLabel, '', '', ''],
    },
  ];

  let y = 85;
  y = drawTable(doc, subjectsHeaders, subjectsData, y, subjectsWidths, 'Subject-wise Performance', [r, g, b]);

  // Footer & Legend
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }
  
  drawGradingScale(doc, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(toText(mergedTemplate.footerNote), 10, pageHeight - 15);
  
  const leftX = 10;
  const rightX = doc.internal.pageSize.getWidth() - 60;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(toText(mergedTemplate.signatureLabel), leftX, pageHeight - 29);
  doc.text(toText(mergedTemplate.principalLabel), rightX, pageHeight - 29);

  doc.setFont('helvetica', 'bold');
  doc.text('__________________________', leftX, pageHeight - 25);
  doc.text('__________________________', rightX, pageHeight - 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Class Teacher', leftX, pageHeight - 21);
  doc.text('Principal', rightX, pageHeight - 21);
};

export const downloadSingleReportCardPdf = async ({ template, reportCard, fileName }) => {
  if (!reportCard) return false;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const [logoDataUrl, letterheadDataUrl] = await Promise.all([
    loadLogoDataUrl(template?.logoUrl || template?.logoUrlOverride),
    loadLogoDataUrl(template?.letterheadUrl),
  ]);
  renderReportCardPage(doc, template, reportCard, logoDataUrl, letterheadDataUrl);
  const baseName = fileName || `report_card_${toFileSafe(reportCard.studentName || 'student')}.pdf`;
  doc.save(baseName);
  return true;
};

export const downloadBulkReportCardsPdf = async ({ template, reportCards, fileName }) => {
  const items = Array.isArray(reportCards) ? reportCards : [];
  if (!items.length) return false;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const [logoDataUrl, letterheadDataUrl] = await Promise.all([
    loadLogoDataUrl(template?.logoUrl || template?.logoUrlOverride),
    loadLogoDataUrl(template?.letterheadUrl),
  ]);
  items.forEach((card, index) => {
    if (index > 0) doc.addPage();
    renderReportCardPage(doc, template, card, logoDataUrl, letterheadDataUrl);
  });
  doc.save(fileName || 'report_cards_bulk.pdf');
  return true;
};
