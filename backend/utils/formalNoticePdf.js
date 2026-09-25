/**
 * Renders a system-generated formal notice (Notification.document, template
 * 'formal_notice') as an A4 PDF — same layout as the on-screen FormalNotice
 * component: letterhead, notice no/date, heading, salutation, body, details
 * box, role section, closing, signature, footer.
 */
const PDFDocument = require('pdfkit');

const MARGIN = 56;
const INK = '#1e293b';
const MUTED = '#64748b';
const RULE = '#1e293b';

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
  const pdf = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: `${doc.heading} – ${doc.subject}`, Author: doc.school?.name || 'School' } });
  const chunks = [];
  pdf.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => pdf.on('end', () => resolve(Buffer.concat(chunks))));

  const width = pdf.page.width - MARGIN * 2;
  const school = doc.school || {};

  // ── Letterhead ──
  let y = MARGIN - 10;
  if (logo) {
    try {
      pdf.image(logo, pdf.page.width / 2 - 28, y, { fit: [56, 56], align: 'center' });
      y += 62;
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
    pdf.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor(INK)
      .text(text, MARGIN, pdf.y, { width, align: opts.align || 'justify', lineGap: 2 });
    pdf.moveDown(opts.gap ?? 0.7);
  };
  para(doc.salutation || '', { bold: true, align: 'left' });
  (doc.paragraphs || []).forEach((p) => para(p));

  // ── Details box ──
  const details = Array.isArray(doc.details) ? doc.details : [];
  if (details.length) {
    const rowH = 18;
    const boxTop = pdf.y + 4;
    const boxH = 30 + details.length * rowH;
    pdf.roundedRect(MARGIN, boxTop, width, boxH, 6).lineWidth(0.8).fillAndStroke('#f8fafc', '#cbd5e1');
    pdf.fillColor(INK).font('Helvetica-Bold').fontSize(10.5)
      .text(doc.detailsTitle || 'DETAILS', MARGIN, boxTop + 10, { width, align: 'center', characterSpacing: 1 });
    const labelX = MARGIN + width * 0.2;
    const valueX = MARGIN + width * 0.5;
    details.forEach((d, i) => {
      const rowY = boxTop + 30 + i * rowH;
      pdf.font('Helvetica').fontSize(10.5).fillColor(MUTED).text(d.label, labelX, rowY, { width: valueX - labelX - 10 });
      pdf.font('Helvetica-Bold').fillColor(d.label === 'Status' ? (d.value === 'OPEN' ? '#047857' : '#b45309') : INK)
        .text(`:  ${d.value}`, valueX - 10, rowY, { width: MARGIN + width - valueX });
    });
    pdf.fillColor(INK);
    pdf.y = boxTop + boxH + 14;
  }

  // ── Role section + closing ──
  (doc.sections || []).forEach((s) => {
    para(s.title, { bold: true, align: 'left', gap: 0.2 });
    para(s.text);
  });
  (doc.closing || []).forEach((p) => para(p));

  // ── Signature ──
  pdf.moveDown(1);
  (doc.signature || []).filter(Boolean).forEach((line, i) => {
    pdf.font(i === 0 ? 'Helvetica' : 'Helvetica-Bold').fontSize(11).fillColor(INK)
      .text(line, MARGIN, pdf.y, { width, align: 'right' });
  });

  // ── Footer ──
  if (doc.footer) {
    const footY = pdf.page.height - MARGIN - 24;
    pdf.moveTo(MARGIN, footY).lineTo(MARGIN + width, footY).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
    pdf.font('Helvetica-Oblique').fontSize(8.5).fillColor(MUTED)
      .text(doc.footer, MARGIN, footY + 8, { width, align: 'center', lineBreak: true });
  }

  pdf.end();
  return done;
};

module.exports = { renderFormalNoticePdf };
