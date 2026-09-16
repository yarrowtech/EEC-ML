/**
 * Renders a system-generated formal notice (Notification.document, template
 * 'formal_notice') as an A4 PDF — same layout as the on-screen FormalNotice
 * component: letterhead, notice no/date, heading, salutation, body, details
 * box, optional numbered instructions, optional tables (e.g. class-wise exam
 * routine), role sections, closing, signature and footer. Long content flows
 * onto further pages; the footer is stamped on every page.
 */
const PDFDocument = require('pdfkit');

const MARGIN = 56;
const FOOTER_SPACE = 40;
const INK = '#1e293b';
const MUTED = '#64748b';
const RULE = '#1e293b';
const LINE = '#cbd5e1';

const formatLongDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

const fetchImage = async (url) => {
  if (!url) return null;
  try {
    // Cloudinary can transcode to PNG so pdfkit can always read it.
    const src = url.includes('res.cloudinary.com') && url.includes('/upload/')
      ? url.replace('/upload/', '/upload/f_png,w_240/')
      : url;
    const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
};

const renderFormalNoticePdf = async (doc) => {
  const logo = await fetchImage(doc?.school?.logoUrl);
  const pdf = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN + FOOTER_SPACE },
    bufferPages: true,
    info: { Title: `${doc.heading} – ${doc.subject}`, Author: doc.school?.name || 'School' },
  });
  const chunks = [];
  pdf.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => pdf.on('end', () => resolve(Buffer.concat(chunks))));

  const width = pdf.page.width - MARGIN * 2;
  const bottomLimit = () => pdf.page.height - (MARGIN + FOOTER_SPACE);
  const ensureSpace = (h) => {
    if (pdf.y + h > bottomLimit()) {
      pdf.addPage();
      pdf.y = MARGIN;
    }
  };
  const school = doc.school || {};

  // ── Letterhead ──
  let y = MARGIN - 10;
  if (logo) {
    try {
      pdf.image(logo, pdf.page.width / 2 - 24, y, { fit: [48, 48], align: 'center' });
      y += 52;
    } catch { /* unreadable logo — skip it */ }
  }
  pdf.fillColor(INK).font('Helvetica-Bold').fontSize(16)
    .text(String(school.name || '').toUpperCase(), MARGIN, y, { width, align: 'center' });
  pdf.font('Helvetica').fontSize(10).fillColor(MUTED);
  if (school.address) pdf.text(school.address, { width, align: 'center' });
  if (school.board) pdf.text(`Affiliated to ${school.board}`, { width, align: 'center' });
  const contact = [school.email && `Email: ${school.email}`, school.phone && `Phone: ${school.phone}`].filter(Boolean).join(' | ');
  if (contact) pdf.fontSize(9).text(contact, { width, align: 'center' });

  y = pdf.y + 10;
  pdf.moveTo(MARGIN, y).lineTo(MARGIN + width, y).lineWidth(1.5).strokeColor(RULE).stroke();
  y += 14;

  // ── Notice no / date ──
  pdf.font('Helvetica').fontSize(10).fillColor(INK);
  pdf.text(`Notice ID: ${doc.noticeNo || ''}`, MARGIN, y, { width: width / 2 });
  pdf.text(`Date: ${formatLongDate(doc.date)}`, MARGIN + width / 2, y, { width: width / 2, align: 'right' });
  y += 28;

  // ── Heading ──
  pdf.font('Helvetica-Bold').fontSize(14).text(doc.heading || 'NOTICE', MARGIN, y, { width, align: 'center', characterSpacing: 4 });
  pdf.moveDown(0.3);
  pdf.fontSize(11.5).text(doc.subject || '', { width, align: 'center', underline: true });
  pdf.moveDown(1.2);

  // ── Body ──
  const para = (text, opts = {}) => {
    pdf.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 11);
    ensureSpace(pdf.heightOfString(text, { width: width - (opts.indent || 0), lineGap: 2 }));
    pdf.fillColor(INK).text(text, MARGIN + (opts.indent || 0), pdf.y, { width: width - (opts.indent || 0), align: opts.align || 'justify', lineGap: 2 });
    pdf.moveDown(opts.gap ?? 0.7);
  };
  const centeredTitle = (text) => {
    ensureSpace(30);
    pdf.font('Helvetica-Bold').fontSize(10.5).fillColor(INK)
      .text(text, MARGIN, pdf.y, { width, align: 'center', characterSpacing: 1 });
    pdf.moveDown(0.6);
  };

  // Paragraph with **bold** segments (exam name, session, dates…).
  const richPara = (text) => {
    if (!String(text).includes('**')) { para(text); return; }
    const plain = String(text).split('**').join('');
    pdf.font('Helvetica').fontSize(11);
    ensureSpace(pdf.heightOfString(plain, { width, lineGap: 2 }));
    const parts = String(text).split('**');
    // A lone trailing "." after a bold run would wrap onto its own line in
    // pdfkit's continued mode — glue such punctuation onto the bold text.
    for (let i = 2; i < parts.length; i += 2) {
      if (/^[.,;:!?)]+$/.test(parts[i])) {
        parts[i - 1] += parts[i];
        parts[i] = '';
      }
    }
    pdf.fillColor(INK);
    pdf.x = MARGIN;
    parts.forEach((part, i) => {
      if (!part) return;
      const last = parts.slice(i + 1).every((p) => !p);
      pdf.font(i % 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(11)
        .text(part, { width, align: 'left', lineGap: 2, continued: !last });
    });
    pdf.moveDown(0.7);
  };

  para(doc.salutation || '', { bold: true, align: 'left' });
  (doc.paragraphs || []).forEach((p) => richPara(p));

  // ── Details box ──
  const details = Array.isArray(doc.details) ? doc.details : [];
  if (details.length) {
    const rowH = 15;
    const boxH = 30 + details.length * rowH;
    ensureSpace(boxH + 18);
    const boxTop = pdf.y + 4;
    pdf.roundedRect(MARGIN, boxTop, width, boxH, 6).lineWidth(0.8).fillAndStroke('#f8fafc', LINE);
    pdf.fillColor(INK).font('Helvetica-Bold').fontSize(10.5)
      .text(doc.detailsTitle || 'DETAILS', MARGIN, boxTop + 10, { width, align: 'center', characterSpacing: 1 });
    const labelX = MARGIN + width * 0.16;
    const valueX = MARGIN + width * 0.46;
    details.forEach((d, i) => {
      const rowY = boxTop + 30 + i * rowH;
      pdf.font('Helvetica').fontSize(10.5).fillColor(MUTED).text(d.label, labelX, rowY, { width: valueX - labelX - 10, lineBreak: false });
      pdf.font('Helvetica-Bold').fillColor(INK)
        .text(`:  ${d.value}`, valueX - 10, rowY, { width: MARGIN + width - valueX, lineBreak: false, ellipsis: true });
    });
    pdf.fillColor(INK);
    pdf.y = boxTop + boxH + 14;
  }

  const drawInstructions = () => {
  // ── Numbered instructions ──
  if (Array.isArray(doc.instructions) && doc.instructions.length) {
    centeredTitle(doc.instructionsTitle || 'IMPORTANT INSTRUCTIONS');
    doc.instructions.forEach((line, i) => {
      pdf.font('Helvetica').fontSize(11);
      ensureSpace(pdf.heightOfString(line, { width: width - 20 }) + 6);
      const top = pdf.y;
      pdf.fillColor(INK).text(`${i + 1}.`, MARGIN, top, { width: 18 });
      pdf.text(line, MARGIN + 20, top, { width: width - 20, align: 'justify', lineGap: 2 });
      pdf.moveDown(0.5);
    });
    pdf.moveDown(0.4);
  }

  };
  const drawTables = () => {
  // ── Tables (e.g. class-wise routine) ──
  (doc.tables || []).forEach((table) => {
    const cols = table.columns || [];
    const weights = table.widths || cols.map(() => 1);
    const total = weights.reduce((a, b) => a + b, 0);
    const colW = weights.map((w) => (w / total) * width);
    const cellPad = 3.5;
    const rowHeight = (cells, font) => {
      pdf.font(font).fontSize(9);
      return Math.max(...cells.map((c, i) => pdf.heightOfString(String(c ?? ''), { width: colW[i] - cellPad * 2 }))) + cellPad * 2;
    };
    const drawTitle = (suffix = '') => {
      if (!table.title) return;
      pdf.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(`${table.title}${suffix}`, MARGIN, pdf.y, { width });
      pdf.moveDown(0.3);
    };
    const drawRow = (cells, { header = false, zebra = false } = {}) => {
      const font = header ? 'Helvetica-Bold' : 'Helvetica';
      const h = rowHeight(cells, font);
      if (pdf.y + h > bottomLimit()) {
        pdf.addPage();
        pdf.y = MARGIN;
        if (!header) {
          // Continued on a new page: repeat the table title and header row.
          drawTitle(' (contd.)');
          drawRow(cols, { header: true });
        }
      }
      const top = pdf.y;
      if (header || zebra) pdf.rect(MARGIN, top, width, h).fill(header ? '#e2e8f0' : '#f8fafc');
      let x = MARGIN;
      cells.forEach((c, i) => {
        pdf.font(font).fontSize(9).fillColor(INK)
          .text(String(c ?? ''), x + cellPad, top + cellPad, { width: colW[i] - cellPad * 2 });
        x += colW[i];
      });
      pdf.rect(MARGIN, top, width, h).lineWidth(0.5).strokeColor(LINE).stroke();
      pdf.y = top + h;
    };

    // Keep a table on one page when it fits on a page by itself; otherwise
    // start it with at least a few rows before breaking.
    const rows = table.rows || [];
    const fullHeight = 22 + rowHeight(cols, 'Helvetica-Bold') + rows.reduce((sum, r) => sum + rowHeight(r, 'Helvetica'), 0);
    const pageSpace = bottomLimit() - MARGIN;
    ensureSpace(fullHeight <= pageSpace ? fullHeight : 110);
    drawTitle();
    drawRow(cols, { header: true });
    rows.forEach((r, i) => drawRow(r, { zebra: i % 2 === 1 }));
    pdf.moveDown(1);
  });

  };
  // A single-class routine reads best with its table straight after the details.
  if (doc.tablesFirst) { drawTables(); drawInstructions(); } else { drawInstructions(); drawTables(); }

  // ── Role sections + closing ──
  (doc.sections || []).forEach((s) => {
    // Keep a section heading on the same page as its text.
    pdf.font('Helvetica').fontSize(11);
    ensureSpace(pdf.heightOfString(s.text, { width, lineGap: 2 }) + 24);
    para(s.title, { bold: true, align: 'left', gap: 0.2 });
    para(s.text);
  });
  (doc.closing || []).forEach((p) => para(p));

  // ── Signature ──
  const signature = (doc.signature || []).filter(Boolean);
  ensureSpace(20 + signature.length * 16);
  pdf.moveDown(1);
  signature.forEach((line, i) => {
    pdf.font(i === 0 ? 'Helvetica' : 'Helvetica-Bold').fontSize(11).fillColor(INK)
      .text(line, MARGIN, pdf.y, { width, align: 'right' });
  });

  // ── Footer on every page (+ page numbers when there are several) ──
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    pdf.switchToPage(i);
    // Writing inside the bottom margin would otherwise make pdfkit add a page.
    pdf.page.margins.bottom = 0;
    const footY = pdf.page.height - MARGIN - 24;
    pdf.moveTo(MARGIN, footY).lineTo(MARGIN + width, footY).lineWidth(0.5).strokeColor(LINE).stroke();
    const text = [doc.footer, range.count > 1 ? `Page ${i + 1} of ${range.count}` : ''].filter(Boolean).join('   ·   ');
    if (text) {
      pdf.font('Helvetica-Oblique').fontSize(8.5).fillColor(MUTED)
        .text(text, MARGIN, footY + 8, { width, align: 'center', lineBreak: false });
    }
  }

  pdf.end();
  return done;
};

module.exports = { renderFormalNoticePdf };
