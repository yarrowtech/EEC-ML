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

// Draws any browser-decodable image (webp/avif/svg/jpg/png) onto a canvas and
// returns a PNG data URL jsPDF can embed. `knockOutWhite` makes near-white
// pixels transparent (used for logos that ship with a white background).
const rasterize = (src, { knockOutWhite = false } = {}) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const w = img.naturalWidth || 300;
      const h = img.naturalHeight || 300;
      const scale = Math.min(1, 600 / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (knockOutWhite) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) px[i + 3] = 0;
        }
        ctx.putImageData(data, 0, 0);
      }
      resolve(canvas.toDataURL('image/png'));
    } catch {
      resolve('');
    }
  };
  img.onerror = () => resolve('');
  img.src = src;
});

const loadImageDataUrl = async (url, opts) => {
  const src = toText(url);
  if (!src) return '';
  const raw = await loadLogoDataUrl(src); // fetch → data URL avoids canvas taint
  return (await rasterize(raw || src, opts)) || '';
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
    doc.rect(7, 7, pageWidth - 14, 28, 'F');
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

const drawHeader = (doc, template, reportCard, logoDataUrl, r, g, b, letterheadDataUrl, photoDataUrl) => {
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
  } else {
    // School Info
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(toText(template.schoolName).toUpperCase(), headerCenterX, 16.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const addressLine = toText(template.schoolAddressLine) || 'Address not available';
    const contactLine = toText(template.schoolContactLine)
      .split('|')
      .map((v) => v.trim())
      .filter((v, i, all) => v && all.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
      .join(' | ');
    const maxHeaderTextWidth = pageWidth - 56;
    const addressLines = doc.splitTextToSize(addressLine, maxHeaderTextWidth).slice(0, 2);
    let metaY = 22.5;
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

    // Logo (transparent — no white box behind it)
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, imageFormatFromDataUrl(logoDataUrl), 12, 10, 20, 20);
      } catch { /* optional */ }
    }
  }

  // ── Report title + examination name, below the header ──
  doc.setTextColor(r, g, b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(toText(template.title).toUpperCase(), headerCenterX, 43, { align: 'center' });
  if (selectedExamName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(selectedExamName, headerCenterX, 48, { align: 'center' });
  }

  // ── Student information — no border, photo on the right ──
  const boxX = 10;
  const boxY = 51;
  const boxW = pageWidth - 20;
  const photoW = 22;
  const photoH = 26;
  const photoX = boxX + boxW - photoW - 4;
  const photoY = boxY + 1;
  const infoW = boxW - photoW - 6; // text area left of the photo

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  const heading = 'STUDENT INFORMATION';
  doc.text(heading, boxX + 4, boxY + 6);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.45);
  doc.line(boxX + 4, boxY + 7.4, boxX + 4 + doc.getTextWidth(heading), boxY + 7.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const col1 = boxX + 4;
  const textEnd = boxX + infoW;
  const fit = (text, x) => doc.splitTextToSize(text, textEnd - x - 2)[0] || '';
  const grade = toText(reportCard.grade);
  const section = toText(reportCard.section);
  const classLabel = [grade, section].filter(Boolean).join('-') || '-';
  const fmtDob = (v) => {
    const s = toText(v);
    if (!s) return '-';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  const sigLabel = toText(template.signatureLabel);
  const classTeacher = toText(reportCard.classTeacherName)
    || (sigLabel && sigLabel.toLowerCase() !== 'class teacher' ? sigLabel : '-');
  // Bold label, normal value; items flow left→right, clipped before the photo.
  const row = (items, y) => {
    let x = col1;
    items.forEach(([label, value]) => {
      if (x >= textEnd - 4) return;
      doc.setFont('helvetica', 'bold');
      const l = `${label}: `;
      doc.text(l, x, y);
      x += doc.getTextWidth(l);
      doc.setFont('helvetica', 'normal');
      const v = fit(String(value), x);
      doc.text(v, x, y);
      x += doc.getTextWidth(v) + 9;
    });
  };

  // Row 1: Name
  row([['Name', toText(reportCard.studentName).toUpperCase()]], boxY + 14);
  // Row 2: Session, Class, Roll, DOB
  row([
    ['Session', toText(reportCard.academicYear || '-')],
    ['Class', classLabel],
    ['Roll', toText(reportCard.roll || reportCard.studentCode || '-')],
    ['DOB', fmtDob(reportCard.dob)],
  ], boxY + 20.5);
  // Row 3: Father's name, Class teacher
  row([
    ["Father's Name", toText(reportCard.fatherName || '-').toUpperCase()],
    ['Class Teacher', classTeacher],
  ], boxY + 27);

  // Profile photo (or a neutral placeholder frame)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, imageFormatFromDataUrl(photoDataUrl), photoX, photoY, photoW, photoH, undefined, 'FAST');
    } catch { /* bad image — fall through to the frame */ }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('PHOTO', photoX + photoW / 2, photoY + photoH / 2 + 1, { align: 'center' });
    doc.setTextColor(30, 41, 59);
  }
  doc.rect(photoX, photoY, photoW, photoH, 'S');
};

const drawAttendance = (doc, reportCard, startY, accentColor) => {
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - 28;
  const att = reportCard.attendance || null;
  const totals = reportCard.totals || {};
  const result = totals.promoted === true ? 'PROMOTED' : totals.promoted === false ? 'NOT PROMOTED' : 'PENDING';
  const pct = att && att.percentage != null ? `${att.percentage}%` : '-';
  const cells = [
    ['TOTAL WORKING DAYS', att ? String(att.totalDays ?? '-') : '-'],
    ['DAYS PRESENT', att ? String(att.presentDays ?? '-') : '-'],
    ['ATTENDANCE', pct],
    ['RESULT', result],
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('ATTENDANCE & RESULT', margin, startY);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, startY + 1.2, margin + doc.getTextWidth('ATTENDANCE & RESULT'), startY + 1.2);

  const y = startY + 4;
  const cellW = width / cells.length;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.25);
  cells.forEach(([label, value], i) => {
    const x = margin + i * cellW;
    doc.setFillColor(229, 231, 235); // neutral gray header
    doc.rect(x, y, cellW, 7, 'F');
    doc.rect(x, y, cellW, 7, 'S');
    doc.rect(x, y, cellW, 15, 'S');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(label, x + cellW / 2, y + 4.8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(value, x + cellW / 2, y + 12.3, { align: 'center' });
  });
  doc.setTextColor(30, 41, 59);
  return y + 15 + 6;
};

const drawGradingScale = (doc, startY) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('GRADING SCALE:', margin, startY);
  
  doc.setFont('helvetica', 'normal');
  const scale = 'A+: 90-100% | A: 80-89% | B: 70-79% | C: 60-69% | D: 50-59% | F: <50%';
  doc.text(scale, margin + 28, startY);
};

const drawTable = (doc, headers, data, startY, widths, title, accentColor, rowHeight = 8) => {
  const margin = 14;
  let currentY = startY;
  const totalWidth = widths.reduce((a, n) => a + n, 0);
  const textOffset = Math.min(5.4, rowHeight * 0.68);

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
    doc.setFillColor(229, 231, 235); // neutral gray header
    doc.rect(margin, currentY, totalWidth, 8, 'F');
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.25);
    doc.rect(margin, currentY, totalWidth, 8);
    drawVerticalGridLines(currentY, 8);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x + widths[i] / 2, currentY + 5.5, { align: 'center' });
      x += widths[i];
    });
    currentY += 8;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
  };

  // Table Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(title.toUpperCase(), margin, currentY);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY + 1.2, margin + doc.getTextWidth(title.toUpperCase()), currentY + 1.2);
  currentY += 4;

  drawHeader();

  data.forEach((rowItem) => {
    const row = Array.isArray(rowItem) ? rowItem : rowItem?.cells || [];
    const rowType = Array.isArray(rowItem) ? 'normal' : rowItem?.type || 'normal';
    // Page break check
    if (currentY > 285) {
      doc.addPage();
      currentY = 20;
      drawHeader();
    }

    // Plain rows — no fill colours.
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.25);
    doc.rect(margin, currentY, totalWidth, rowHeight);

    if (rowType === 'remark') {
      const xAfterSubject = margin + widths[0];
      const mergedWidth = widths[1] + widths[2] + widths[3] + widths[4];
      doc.line(xAfterSubject, currentY, xAfterSubject, currentY + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.text(toText(row[0]), margin + widths[0] / 2, currentY + textOffset, { align: 'center' });
      doc.text(toText(row[1]), xAfterSubject + (mergedWidth / 2), currentY + textOffset, { align: 'center' });
    } else {
      drawVerticalGridLines(currentY, rowHeight);
      let currentX = margin;
      doc.setFont(rowType === 'total' ? 'helvetica' : 'helvetica', rowType === 'total' ? 'bold' : 'normal');
      row.forEach((cell, cellIndex) => {
        const text = toText(cell);
        const clipped = doc.splitTextToSize(text, widths[cellIndex] - 3)[0];
        doc.text(clipped, currentX + widths[cellIndex] / 2, currentY + textOffset, { align: 'center' });
        currentX += widths[cellIndex];
      });
    }
    currentY += rowHeight;
  });

  return currentY + 5;
};

const renderReportCardPage = (doc, template, reportCard, logoDataUrl, letterheadDataUrl, photoDataUrl) => {
  const mergedTemplate = { ...DEFAULT_TEMPLATE, ...(template || {}) };
  const [r, g, b] = parseHexColor(mergedTemplate.accentColor);
  const pageHeight = doc.internal.pageSize.getHeight();

  drawPageStructure(doc, mergedTemplate, r, g, b, letterheadDataUrl);
  drawWatermark(doc, mergedTemplate);
  drawHeader(doc, mergedTemplate, reportCard, logoDataUrl, r, g, b, letterheadDataUrl, photoDataUrl);

  // Consolidated Summary
  const subjectsHeaders = ['SUBJECT', 'OBTAINED', 'TOTAL MARKS', 'PERCENTAGE', 'GRADE'];
  const subjectsWidths = [76, 28, 28, 25, 25];
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

  // Everything must fit one A4 page: shrink subject rows when there are many.
  const tableTop = 91;
  const footerTop = pageHeight - 36;           // signature block
  const reserved = 17 + 27 + 10;               // table title/header/gap + attendance + grading scale
  const rowHeight = Math.max(4.5, Math.min(8, (footerTop - tableTop - reserved) / subjectsData.length));

  let y = drawTable(doc, subjectsHeaders, subjectsData, tableTop, subjectsWidths, 'Subject-wise Performance', [r, g, b], rowHeight);
  y = drawAttendance(doc, reportCard, y + 2, [r, g, b]);
  drawGradingScale(doc, y);
  // Signature block sits in the page footer.
  const sigTop = pageHeight - 27; // signatures pinned to the page footer

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(toText(mergedTemplate.footerNote), 10, sigTop + 15);

  const leftX = 12;
  const rightX = doc.internal.pageSize.getWidth() - 62;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(doc.splitTextToSize(toText(mergedTemplate.signatureLabel), 50)[0] || '', leftX, sigTop);
  doc.text(doc.splitTextToSize(toText(mergedTemplate.principalLabel), 50)[0] || '', rightX, sigTop);

  doc.setFont('helvetica', 'bold');
  doc.text('__________________________', leftX, sigTop + 4);
  doc.text('__________________________', rightX, sigTop + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Class Teacher', leftX, sigTop + 8);
  doc.text('Principal', rightX, sigTop + 8);
};

export const downloadSingleReportCardPdf = async ({ template, reportCard, fileName }) => {
  if (!reportCard) return false;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const [logoDataUrl, letterheadDataUrl, photoDataUrl] = await Promise.all([
    loadImageDataUrl(template?.logoUrl || template?.logoUrlOverride, { knockOutWhite: true }),
    loadLogoDataUrl(template?.letterheadUrl),
    loadImageDataUrl(reportCard.profilePic),
  ]);
  renderReportCardPage(doc, template, reportCard, logoDataUrl, letterheadDataUrl, photoDataUrl);
  const baseName = fileName || `report_card_${toFileSafe(reportCard.studentName || 'student')}.pdf`;
  doc.save(baseName);
  return true;
};

export const downloadBulkReportCardsPdf = async ({ template, reportCards, fileName }) => {
  const items = Array.isArray(reportCards) ? reportCards : [];
  if (!items.length) return false;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const [logoDataUrl, letterheadDataUrl, photos] = await Promise.all([
    loadImageDataUrl(template?.logoUrl || template?.logoUrlOverride, { knockOutWhite: true }),
    loadLogoDataUrl(template?.letterheadUrl),
    Promise.all(items.map((card) => loadImageDataUrl(card?.profilePic))),
  ]);
  items.forEach((card, index) => {
    if (index > 0) doc.addPage();
    renderReportCardPage(doc, template, card, logoDataUrl, letterheadDataUrl, photos[index]);
  });
  doc.save(fileName || 'report_cards_bulk.pdf');
  return true;
};
