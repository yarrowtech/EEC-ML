import { jsPDF } from 'jspdf';

// A4 School Leaving Certificate. Layout: logo top-left + school name, address
// and contacts; title; certificate meta; certifying paragraph; particulars
// table; dues/relief lines; place/date; three signature blocks; footnote.

const dmy = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB'); // dd/mm/yyyy
};

const orDash = (value) => {
  const text = String(value ?? '').trim();
  return text || '—';
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

// Word-wrapped paragraph with mixed weights. `segments` is a list of
// [text, bold?] pairs; words are laid out one by one (measuring each in its
// own weight) and wrapped at maxWidth. Returns the y below the last line.
const drawRichText = (doc, segments, x, y, maxWidth, lineHeight) => {
  const words = [];
  segments.forEach(([text, bold]) => {
    // Keep leading/trailing spaces as separate tokens so "of " + "Name" spaces correctly.
    String(text).split(/(\s+)/).filter((t) => t !== '').forEach((t) => words.push({ t, bold: Boolean(bold) }));
  });
  const widthOf = (w) => {
    doc.setFont('helvetica', w.bold ? 'bold' : 'normal');
    return doc.getTextWidth(w.t);
  };
  let line = [];
  let lineW = 0;
  const flush = () => {
    // Drop trailing spaces so wrapped lines don't end in whitespace.
    while (line.length && /^\s+$/.test(line[line.length - 1].t)) {
      lineW -= line[line.length - 1].w;
      line.pop();
    }
    let cx = x;
    line.forEach((w) => {
      doc.setFont('helvetica', w.bold ? 'bold' : 'normal');
      doc.text(w.t, cx, y);
      cx += w.w;
    });
    line = [];
    lineW = 0;
    y += lineHeight;
  };
  words.forEach((word) => {
    const w = { ...word, w: widthOf(word) };
    const isSpace = /^\s+$/.test(w.t);
    if (isSpace && line.length === 0) return; // no leading spaces on a new line
    if (!isSpace && lineW + w.w > maxWidth && line.length) flush();
    line.push(w);
    lineW += w.w;
  });
  if (line.length) flush();
  doc.setFont('helvetica', 'normal');
  return y;
};

// Guess the city from the last comma-separated address parts ("…, Kolkata, WB 700001").
const guessCity = (address = '') => {
  const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  const candidate = parts[parts.length - 2];
  return candidate.replace(/\d{6}/g, '').trim();
};

export const buildLeavingCertificatePdf = async ({ student = {}, school = {}, principalName = '', classTeacherName = '' }) => {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  const ink = [15, 23, 42];
  const muted = [71, 85, 105];
  const accent = [30, 64, 175];

  // Page border
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.2);
  doc.rect(10, 10, pageW - 20, pageH - 20);

  // ── Header: logo top-left, school name + address + contacts beside it ──
  let y = 18;
  const logo = await loadImageAsDataUrl(school.logoUrl);
  const logoSize = 24;
  const textX = logo ? marginX + logoSize + 5 : marginX;
  if (logo) {
    try {
      const fmt = /^data:image\/(png|jpe?g)/i.exec(logo)?.[1]?.toUpperCase().replace('JPG', 'JPEG') || 'PNG';
      doc.addImage(logo, fmt, marginX, y - 2, logoSize, logoSize);
    } catch {
      /* ignore an undecodable logo */
    }
  }
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const nameLines = doc.splitTextToSize(String(school.name || 'School').toUpperCase(), pageW - textX - marginX);
  doc.text(nameLines, textX, y + 5);
  y += 5 + nameLines.length * 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...muted);
  if (school.address) {
    const addr = doc.splitTextToSize(school.address, pageW - textX - marginX);
    doc.text(addr, textX, y);
    y += addr.length * 4.4;
  }
  const contacts = [school.phone ? `Phone: ${school.phone}` : '', school.email ? `Email: ${school.email}` : '']
    .filter(Boolean).join('  |  ');
  if (contacts) { doc.text(contacts, textX, y); y += 4.4; }
  if (school.website) { doc.text(`Website: ${school.website}`, textX, y); y += 4.4; }
  y = Math.max(y, 18 + logoSize + 2) + 2;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageW - marginX, y);

  // ── Title ──
  y += 9;
  doc.setTextColor(...accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SCHOOL LEAVING CERTIFICATE', pageW / 2, y, { align: 'center' });
  doc.setLineWidth(0.3);
  const titleW = doc.getTextWidth('SCHOOL LEAVING CERTIFICATE');
  doc.line(pageW / 2 - titleW / 2, y + 1.5, pageW / 2 + titleW / 2, y + 1.5);

  // ── Certificate meta ──
  y += 9;
  doc.setTextColor(...ink);
  doc.setFontSize(10);
  const issueDate = student.leavingCertificateIssuedAt || new Date();
  const meta = [
    ['Certificate No.:', orDash(student.transferCertificateNo)],
    ['Admission No.:', orDash(student.admissionNumber || student.studentCode)],
    ['Date of Issue:', dmy(issueDate)],
  ];
  meta.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, marginX + 32, y);
    y += 4.7;
  });

  // ── Certifying paragraph ──
  y += 2;
  doc.setFontSize(10.5);
  const studentName = orDash(student.name);
  const parentNames = [student.fatherName, student.motherName].map((n) => String(n || '').trim()).filter(Boolean);
  // Student and parent names are bold; the connecting words stay regular.
  const parentSegments = parentNames.length
    ? parentNames.flatMap((n, i) => (i === 0 ? [[n, true]] : [[' and '], [n, true]]))
    : [['—', true]];
  y = drawRichText(doc, [
    ['This is to certify that '], [studentName, true], [', son/daughter of '],
    ...parentSegments,
    [', was a bonafide student of '], [orDash(school.name), true],
    ['. According to the school records, the particulars of the student are as follows:'],
  ], marginX, y, contentW, 5) + 2;

  // ── Particulars table ──
  const classSection = [student.grade, student.section].filter(Boolean).join(' - ');
  const rows = [
    ['Name of Student', studentName],
    ['Admission Number', orDash(student.admissionNumber || student.studentCode)],
    ['Date of Birth', dmy(student.dob)],
    ['Class Last Studied', orDash(classSection)],
    ['Academic Year', orDash(student.academicYear)],
    ['Date of Admission', dmy(student.admissionDate)],
    ['Date of Leaving', dmy(student.leftAt || student.transferCertificateDate)],
    ['Board', orDash(school.board)],
    ['Roll Number', orDash(student.roll)],
    ["Father's Name", orDash(student.fatherName)],
    ["Mother's Name", orDash(student.motherName)],
    ['Nationality', orDash(student.nationality || 'Indian')],
    ['Category', orDash(student.category)],
    ['Whether the student passed the last examination', 'Yes'],
    ['Last Examination Passed', orDash(student.grade ? `Class ${student.grade}` : '')],
    ['Reason for Leaving', orDash(student.reasonForLeaving)],
    ['Conduct', 'Good'],
  ];
  const col1W = 82;
  const col2W = contentW - col1W;
  const rowH = 5.3;
  // header
  doc.setFillColor(...accent);
  doc.rect(marginX, y, contentW, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Particular', marginX + 2.5, y + 3.7);
  doc.text('Details', marginX + col1W + 2.5, y + 3.7);
  y += rowH;
  doc.setTextColor(...ink);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  rows.forEach(([label, value], i) => {
    const labelLines = doc.splitTextToSize(label, col1W - 5);
    const valueLines = doc.splitTextToSize(String(value), col2W - 5);
    const h = Math.max(rowH, Math.max(labelLines.length, valueLines.length) * 3.9 + 1.4);
    if (i % 2 === 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, y, contentW, h, 'F');
    }
    doc.rect(marginX, y, col1W, h);
    doc.rect(marginX + col1W, y, col2W, h);
    doc.setFont('helvetica', 'bold');
    doc.text(labelLines, marginX + 2.5, y + 3.7);
    doc.setFont('helvetica', 'normal');
    doc.text(valueLines, marginX + col1W + 2.5, y + 3.7);
    y += h;
  });

  // ── Dues / relief / wishes ──
  y += 5;
  doc.setFontSize(10);
  const leavingDate = dmy(student.leftAt || student.transferCertificateDate);
  [
    [['The student has cleared all dues and obligations towards the school, and there are no outstanding school-related liabilities as of the date of issue.']],
    [['The student is hereby relieved from the school with effect from '], [leavingDate, true], ['.']],
    [['We wish '], [studentName, true], [' every success in their future academic and professional pursuits.']],
  ].forEach((segments) => {
    y = drawRichText(doc, segments, marginX, y, contentW, 4.8) + 1.2;
  });

  // ── Place / Date ──
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('Place:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(orDash(guessCity(school.address)), marginX + 13, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', pageW - marginX - 40, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dmy(issueDate), pageW - marginX - 28, y);

  doc.contentBottom = y; // exposed for layout checks
  // ── Signatures: pinned above the footnote, with room left for signing ──
  const sigY = Math.min(Math.max(y + 20, pageH - 52), pageH - 44);
  // Two signature blocks: Class Teacher (left) and Principal (right).
  const colW = contentW / 2;
  const blocks = [
    { title: 'Class Teacher', lines: ['Signature', `Name: ${classTeacherName || '________________'}`] },
    { title: 'Principal / Head of Institution', lines: ['Signature', `Name: ${principalName || '________________'}`, 'Designation: Principal'] },
  ];
  blocks.forEach((b, i) => {
    const cx = marginX + colW * i + colW / 2;
    doc.setDrawColor(...muted);
    doc.line(cx - 28, sigY, cx + 28, sigY);
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(b.title, cx, sigY + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    b.lines.forEach((l, j) => doc.text(l, cx, sigY + 10 + j * 4.2, { align: 'center' }));
  });

  // ── Footnote ──
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, pageH - 20, pageW - marginX, pageH - 20);
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'italic');
  doc.text('Note: This certificate is issued based on the information available in the official school records.', pageW / 2, pageH - 15, { align: 'center' });

  return doc;
};

const fileName = (student) =>
  `Leaving-Certificate-${String(student?.transferCertificateNo || student?.name || 'student').replace(/[^\w-]+/g, '-')}.pdf`;

// Opens the certificate in a new tab with the print dialog triggered.
export const printLeavingCertificate = async (data) => {
  const doc = await buildLeavingCertificatePdf(data);
  doc.autoPrint();
  const url = doc.output('bloburl');
  const win = window.open(url, '_blank');
  if (!win) doc.save(fileName(data.student)); // pop-up blocked → download instead
};

export const downloadLeavingCertificate = async (data) => {
  const doc = await buildLeavingCertificatePdf(data);
  doc.save(fileName(data.student));
};
