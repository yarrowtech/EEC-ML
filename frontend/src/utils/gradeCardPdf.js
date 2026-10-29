import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// Landscape A4 "GRADE CARD" used by the parent portal download. Layout mirrors
// the school's printed grade card: crest + school header, navy session panel,
// student details with photo, marks table, summary tiles, grade
// scale strip and the signature footer.

const NAVY = [16, 49, 97];
const NAVY_DARK = [12, 36, 74];
const GOLD = [201, 154, 72];
const GOLD_LIGHT = [247, 226, 178];
const INK = [33, 37, 41];
const MUTED = [90, 100, 115];
const LINE = [190, 205, 225];
const ROW_ALT = [234, 242, 251];
const TILE = [223, 236, 249];
const GREEN = [22, 101, 52];
const RED = [185, 28, 28];

const GRADE_SCALE = [
  ['90 – 100', 'A+', 90],
  ['80 – 89', 'A', 80],
  ['70 – 79', 'B+', 70],
  ['60 – 69', 'B', 60],
  ['50 – 59', 'C', 50],
  ['Below 50', 'D', 0],
];

const PASS_PERCENT = 33;

const text = (value) => String(value ?? '').trim();
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const gradeFor = (pct) => GRADE_SCALE.find(([, , min]) => pct >= min)[1];
const remarkFor = (pct) => {
  if (pct >= 95) return 'Outstanding';
  if (pct >= 90) return 'Excellent';
  if (pct >= 80) return 'Very Good';
  if (pct >= 70) return 'Good';
  if (pct >= 60) return 'Satisfactory';
  if (pct >= 50) return 'Fair';
  return 'Needs Improvement';
};
const overallRemarkFor = (pct) => {
  if (pct >= 85) return 'A sincere and hardworking student. Keep up the good work!';
  if (pct >= 70) return 'A good performance. Consistent effort will bring even better results.';
  if (pct >= 50) return 'A fair performance. Regular practice will help improve further.';
  return 'Needs more attention and regular practice. We are here to help.';
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const capitalize = (value) => text(value).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const formatSession = (value) => text(value).replace(/\s*[-–]\s*/, ' – ');

// Load any image URL (png/jpg/webp/svg) as a PNG/JPEG data URL jsPDF can embed.
const loadImage = async (url, format = 'image/png') => {
  const src = text(url);
  if (!src) return '';
  try {
    const res = await fetch(src);
    if (!res.ok) return '';
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 400;
      canvas.height = img.naturalHeight || 400;
      const ctx = canvas.getContext('2d');
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { data: canvas.toDataURL(format, 0.92), w: canvas.width, h: canvas.height, canvas };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return '';
  }
};

// Fit an image inside a box, preserving aspect ratio (contain) or cropping (cover).
const placeImage = (doc, image, x, y, w, h, { cover = false, type = 'PNG' } = {}) => {
  if (!image?.data) return false;
  try {
    const ratio = image.w / image.h;
    if (cover) {
      // jsPDF has no clipping for images in all builds — crop via canvas instead.
      const boxRatio = w / h;
      const canvas = document.createElement('canvas');
      let sw = image.w;
      let sh = image.h;
      let sx = 0;
      let sy = 0;
      if (ratio > boxRatio) { sw = image.h * boxRatio; sx = (image.w - sw) / 2; } else { sh = image.w / boxRatio; sy = (image.h - sh) / 4; }
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      canvas.getContext('2d').drawImage(image.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, w, h);
      return true;
    }
    let dw = w;
    let dh = w / ratio;
    if (dh > h) { dh = h; dw = h * ratio; }
    doc.addImage(image.data, type, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return true;
  } catch {
    return false;
  }
};

const setFill = (doc, c) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc, c) => doc.setDrawColor(c[0], c[1], c[2]);
const setInk = (doc, c) => doc.setTextColor(c[0], c[1], c[2]);
const font = (doc, size, style = 'normal', family = 'helvetica') => {
  doc.setFont(family, style);
  doc.setFontSize(size);
};

const fitText = (doc, value, maxWidth) => {
  let s = text(value);
  if (doc.getTextWidth(s) <= maxWidth) return s;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
};

/* --------------------------------------------------------------------------- */

const drawBackground = (doc, W, H) => {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');
  // Soft diagonal shading in the top-left, like the printed card.
  doc.setFillColor(243, 247, 252);
  doc.triangle(0, 0, 70, 0, 0, 60, 'F');

  // Bottom band: gold accent + navy strip.
  setFill(doc, GOLD);
  doc.triangle(0, H - 8, 72, H - 8, 78, H, 'F');
  doc.rect(0, H - 8, 72, 8, 'F');
  setFill(doc, NAVY_DARK);
  doc.rect(0, H - 4, W, 4, 'F');
  setFill(doc, GOLD);
  doc.rect(76, H - 4.6, W - 76, 0.6, 'F');
};

const drawCrestFallback = (doc, cx, top) => {
  // Shield crest with open book, drawn when the school has no logo.
  setFill(doc, GOLD);
  doc.roundedRect(cx - 10.5, top, 21, 20, 2, 2, 'F');
  doc.triangle(cx - 10.5, top + 18, cx + 10.5, top + 18, cx, top + 27, 'F');
  setFill(doc, NAVY);
  doc.roundedRect(cx - 9, top + 1.5, 18, 17, 1.5, 1.5, 'F');
  doc.triangle(cx - 9, top + 17, cx + 9, top + 17, cx, top + 25, 'F');
  doc.setFillColor(255, 255, 255);
  doc.triangle(cx - 6.5, top + 8, cx - 0.4, top + 9.5, cx - 0.4, top + 17, 'F');
  doc.triangle(cx - 6.5, top + 8, cx - 6.5, top + 15.5, cx - 0.4, top + 17, 'F');
  doc.triangle(cx + 6.5, top + 8, cx + 0.4, top + 9.5, cx + 0.4, top + 17, 'F');
  doc.triangle(cx + 6.5, top + 8, cx + 6.5, top + 15.5, cx + 0.4, top + 17, 'F');
  setInk(doc, [255, 255, 255]);
  font(doc, 6, 'bold');
  doc.text('* * *', cx, top + 6, { align: 'center' });
};

const drawHeader = (doc, W, ctx) => {
  const { template, logo, term, session, grade, section } = ctx;

  // Crest / logo
  if (!placeImage(doc, logo, 17, 3, 38, 27)) drawCrestFallback(doc, 36, 3);
  const motto = text(template.motto);
  if (motto) {
    setFill(doc, GOLD);
    doc.roundedRect(19, 25.5, 34, 4, 0.8, 0.8, 'F');
    setInk(doc, NAVY_DARK);
    font(doc, 5.2, 'bold');
    doc.text(fitText(doc, motto, 32), 36, 28.3, { align: 'center' });
  }
  const estd = text(template.established || template.estd);
  if (estd) {
    setInk(doc, INK);
    font(doc, 5.5, 'bold');
    doc.text(`ESTD. ${estd}`, 36, 32.5, { align: 'center' });
  }

  // School name, address, affiliation
  const cx = 148;
  setInk(doc, NAVY);
  let size = 22;
  font(doc, size, 'bold', 'times');
  const name = text(template.schoolName).toUpperCase() || 'SCHOOL';
  while (size > 12 && doc.getTextWidth(name) > 150) { size -= 0.5; doc.setFontSize(size); }
  doc.text(name, cx, 11, { align: 'center' });

  setInk(doc, INK);
  font(doc, 8.5, 'normal');
  if (text(template.schoolAddressLine)) doc.text(fitText(doc, template.schoolAddressLine, 150), cx, 15.6, { align: 'center' });
  // De-duplicate "a | a | b | b" (saved templates may carry repeated phone/email).
  const affiliation = [...new Map(text(template.affiliationLine || template.schoolContactLine)
    .split('|').map((part) => part.trim()).filter(Boolean)
    .map((part) => [part.toLowerCase(), part])).values()].join(' | ');
  if (affiliation) {
    setInk(doc, NAVY);
    font(doc, 8.2, 'normal', 'times');
    doc.text(fitText(doc, affiliation.startsWith('(') ? affiliation : `(${affiliation})`, 150), cx, 20, { align: 'center' });
  }

  // "GRADE CARD" ribbon with gold flourishes
  setDraw(doc, GOLD);
  doc.setLineWidth(0.5);
  doc.line(100, 27, 120, 27);
  doc.line(176, 27, 196, 27);
  doc.setLineWidth(0.25);
  doc.line(104, 25.8, 118, 25.8);
  doc.line(104, 28.2, 118, 28.2);
  doc.line(178, 25.8, 192, 25.8);
  doc.line(178, 28.2, 192, 28.2);
  setFill(doc, GOLD);
  doc.circle(99.5, 27, 0.9, 'F');
  doc.circle(196.5, 27, 0.9, 'F');
  doc.roundedRect(119, 21.6, 58, 10.8, 5.4, 5.4, 'F');
  setFill(doc, GOLD_LIGHT);
  doc.roundedRect(119.8, 22.3, 56.4, 9.4, 4.7, 4.7, 'F');
  setInk(doc, NAVY);
  font(doc, 17, 'bold', 'times');
  doc.text('GRADE CARD', cx, 30.2, { align: 'center' });

  setInk(doc, NAVY);
  font(doc, 9, 'bold');
  doc.setCharSpace(0.4);
  doc.text(`SCHOOL  EXAMINATION  –  ${text(term).toUpperCase() || 'ANNUAL'}`, cx, 35.4, { align: 'center' });
  doc.setCharSpace(0);

  // Navy slanted session panel (top-right)
  setFill(doc, NAVY_DARK);
  doc.triangle(228, 35.5, 249, 0, 249, 35.5, 'F');
  doc.rect(249, 0, W - 249, 35.5, 'F');
  setInk(doc, [255, 255, 255]);
  font(doc, 8.5, 'normal');
  doc.text('Academic Session', 268.5, 5.6, { align: 'center' });
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(252.5, 7.5, 33, 6.4, 1, 1, 'F');
  setInk(doc, NAVY_DARK);
  font(doc, 10, 'bold');
  doc.text(session || '—', 269, 12.3, { align: 'center' });
  setInk(doc, [255, 255, 255]);
  font(doc, 8.5, 'bold');
  [['Class', grade], ['Section', section], ['Term', term]].forEach(([label, value], i) => {
    const y = 19.6 + i * 4.9;
    doc.text(label, 256, y);
    doc.text(':', 269.5, y);
    doc.text(fitText(doc, value || '—', 20), 272, y);
  });
};

const drawStudentBox = (doc, ctx) => {
  const { card, profile, photo, session, grade, section } = ctx;
  setDraw(doc, LINE);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(6.5, 37.5, 284, 37, 2.5, 2.5, 'FD');

  // Photo frame
  setDraw(doc, [160, 180, 205]);
  doc.setLineWidth(0.4);
  doc.setFillColor(238, 243, 249);
  doc.roundedRect(18, 38.8, 28.6, 34.4, 1.5, 1.5, 'FD');
  if (!placeImage(doc, photo, 18.8, 39.6, 27, 32.8, { cover: true })) {
    setInk(doc, [150, 165, 185]);
    font(doc, 16, 'bold');
    const initials = text(card.studentName).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    doc.text(initials || 'S', 32.3, 58.5, { align: 'center' });
  }

  const left = [
    ["Student's Name", card.studentName, true],
    ['Admission No.', profile.admissionNumber || card.admissionNumber || card.studentCode],
    ['Roll No.', card.roll || profile.roll],
    ['Class & Section', [grade, section].filter(Boolean).join(' - '), true],
    ['Date of Birth', formatDate(profile.dob)],
    ['Gender', capitalize(profile.gender)],
  ];
  const right = [
    ["Father's Name", profile.father?.name],
    ["Mother's Name", profile.mother?.name],
    ['Blood Group', profile.bloodGroup],
    ['Academic Session', session],
    ['Class Teacher', card.classTeacherName],
  ];
  const rowY = (i) => 43 + i * 5.25;
  const drawCol = (rows, xLabel, xColon, xValue, maxValue) => {
    rows.forEach(([label, value, bold], i) => {
      setInk(doc, INK);
      font(doc, 8.6, 'normal');
      doc.text(label, xLabel, rowY(i));
      doc.text(':', xColon, rowY(i));
      font(doc, 8.6, bold ? 'bold' : 'normal');
      doc.text(fitText(doc, text(value) || '—', maxValue), xValue, rowY(i));
    });
  };
  drawCol(left, 56.5, 87.5, 93, 64);
  setDraw(doc, LINE);
  doc.setLineWidth(0.25);
  doc.line(162.5, 40, 162.5, 72);
  drawCol(right, 177.5, 210, 215.5, 70);
};

const drawMarksTable = (doc, ctx) => {
  const { subjects } = ctx;
  const cols = [7, 22.6, 82.7, 106.2, 134.6, 162.2, 190, 218.3, 243.8, 290];
  const top = 76;
  const headH = 10;
  const bottom = 147;
  const rowH = subjects.length ? Math.min(7.4, (bottom - top - headH) / subjects.length) : 6;
  const tableBottom = top + headH + rowH * Math.max(subjects.length, 1);
  const center = (i) => (cols[i] + cols[i + 1]) / 2;

  setFill(doc, NAVY);
  doc.rect(cols[0], top, cols[9] - cols[0], headH, 'F');
  const maxTheory = subjects.find((s) => s.theoryMax)?.theoryMax;
  const maxInternal = subjects.find((s) => s.internalMax)?.internalMax;
  const maxTotal = subjects.length && subjects.every((s) => s.total === subjects[0].total) ? subjects[0].total : '';
  const heads = [
    ['Sl. No.'], ['Subject'], ['Max.', 'Marks'],
    ['Theory', maxTheory ? `(${maxTheory})` : ''],
    ['Internal', maxInternal ? `(${maxInternal})` : ''],
    ['Total', maxTotal ? `(${maxTotal})` : ''],
    ['Percentage', '(%)'], ['Grade'], ['Remarks'],
  ];
  setInk(doc, [255, 255, 255]);
  font(doc, 8.6, 'bold');
  heads.forEach((lines, i) => {
    const parts = lines.filter(Boolean);
    const startY = parts.length === 2 ? top + 4.3 : top + 6.3;
    parts.forEach((line, j) => doc.text(line, center(i), startY + j * 3.8, { align: 'center' }));
  });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.25);
  cols.slice(1, -1).forEach((x) => doc.line(x, top, x, top + headH));

  subjects.forEach((s, idx) => {
    const y = top + headH + idx * rowH;
    if (idx % 2 === 0) setFill(doc, ROW_ALT); else doc.setFillColor(255, 255, 255);
    doc.rect(cols[0], y, cols[9] - cols[0], rowH, 'F');
    const ty = y + rowH / 2 + 1.2;
    setInk(doc, INK);
    font(doc, 8.4, 'normal');
    doc.text(String(idx + 1), center(0), ty, { align: 'center' });
    doc.text(fitText(doc, s.name, cols[2] - cols[1] - 6), cols[1] + 4, ty);
    doc.text(String(s.total), center(2), ty, { align: 'center' });
    doc.text(s.theory === '' ? '—' : String(s.theory), center(3), ty, { align: 'center' });
    doc.text(s.internal === '' ? '—' : String(s.internal), center(4), ty, { align: 'center' });
    font(doc, 8.6, 'bold');
    doc.text(String(s.obtained), center(5), ty, { align: 'center' });
    font(doc, 8.4, 'normal');
    doc.text(s.pct.toFixed(1), center(6), ty, { align: 'center' });
    font(doc, 8.6, 'bold');
    doc.text(s.grade, center(7), ty, { align: 'center' });
    font(doc, 8.4, 'normal');
    doc.text(s.remark, center(8), ty, { align: 'center' });
  });
  if (!subjects.length) {
    setInk(doc, MUTED);
    font(doc, 8.4, 'italic');
    doc.text('No subject marks published for this examination.', 148.5, top + headH + 4, { align: 'center' });
  }

  // Grid
  setDraw(doc, LINE);
  doc.setLineWidth(0.2);
  cols.slice(1, -1).forEach((x) => doc.line(x, top + headH, x, tableBottom));
  for (let i = 1; i < subjects.length; i += 1) {
    const y = top + headH + i * rowH;
    doc.line(cols[0], y, cols[9], y);
  }
  setDraw(doc, [120, 150, 190]);
  doc.setLineWidth(0.35);
  doc.rect(cols[0], top, cols[9] - cols[0], tableBottom - top);
  return tableBottom;
};

const drawSummaryTiles = (doc, ctx, y) => {
  const { totals } = ctx;
  const h = 15;
  const tile = (x, w, label, value, color = NAVY, size = 15) => {
    setFill(doc, TILE);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
    setInk(doc, INK);
    font(doc, 8.4, 'bold');
    doc.text(label, x + w / 2, y + 5, { align: 'center' });
    setInk(doc, color);
    font(doc, size, 'bold');
    doc.text(value, x + w / 2, y + 11.9, { align: 'center' });
  };
  tile(7, 49, 'Total Marks Obtained', `${totals.obtained} / ${totals.total}`);
  tile(58, 43, 'Percentage', `${totals.pct.toFixed(1)}%`);
  tile(104, 43, 'Grade', totals.grade);
  tile(150, 46, 'Result', totals.passed ? 'PASS' : 'FAIL', totals.passed ? GREEN : RED);

  setFill(doc, TILE);
  doc.roundedRect(199, y, 91, h, 1.5, 1.5, 'F');
  setInk(doc, INK);
  font(doc, 8.4, 'bold');
  doc.text('Overall Remark', 244.5, y + 3.8, { align: 'center' });
  doc.setFillColor(255, 255, 255);
  setDraw(doc, [150, 175, 205]);
  doc.setLineWidth(0.25);
  doc.roundedRect(207.5, y + 5, 75, 9, 1, 1, 'FD');
  setInk(doc, INK);
  font(doc, 7.8, 'normal');
  // Prefer one sentence per line (as on the printed card) when both fit.
  const sentences = totals.remark.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()) || [];
  const lines = sentences.length === 2 && sentences.every((s) => doc.getTextWidth(s) <= 72)
    ? sentences
    : doc.splitTextToSize(totals.remark, 72).slice(0, 2);
  const startY = lines.length > 1 ? y + 8.8 : y + 10.6;
  lines.forEach((line, i) => doc.text(line, 245, startY + i * 3.6, { align: 'center' }));
  return y + h;
};

// Grade scale as a single full-width strip under the summary tiles.
const drawGradeScale = (doc, y) => {
  const x = 7;
  const w = 283;
  const h = 11;
  const labelW = 31;
  const cw = (w - labelW) / GRADE_SCALE.length;
  setFill(doc, NAVY);
  doc.roundedRect(x, y, labelW, h, 1.5, 1.5, 'F');
  doc.rect(x + labelW - 2, y, 2, h, 'F');
  setInk(doc, [255, 255, 255]);
  font(doc, 8.6, 'bold');
  doc.text('Grade Scale', x + labelW / 2, y + h / 2 + 1.3, { align: 'center' });
  setDraw(doc, LINE);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.rect(x + labelW, y, w - labelW, h, 'FD');
  doc.setLineWidth(0.2);
  GRADE_SCALE.forEach(([range, g], i) => {
    const cx = x + labelW + cw * i;
    if (i > 0) doc.line(cx, y, cx, y + h);
    setInk(doc, NAVY);
    font(doc, 9.5, 'bold');
    doc.text(g, cx + cw / 2, y + 4.6, { align: 'center' });
    setInk(doc, MUTED);
    font(doc, 7.6, 'normal');
    doc.text(range, cx + cw / 2, y + 8.8, { align: 'center' });
  });
  return y + h;
};

const drawFooter = (doc, ctx, H) => {
  const { qr, template, card, parentName } = ctx;
  const baseY = H - 12;

  setInk(doc, INK);
  font(doc, 7.4, 'normal');
  doc.text(`Date of Issue  :  ${formatDate(ctx.issueDate)}`, 7, baseY + 0.5);

  if (qr) {
    try { doc.addImage(qr, 'PNG', 72, H - 27, 15, 15); } catch { /* optional */ }
    font(doc, 7.6, 'normal');
    doc.text('Scan to verify', 90, baseY - 7);
    doc.text('this grade card', 90, baseY - 3.5);
  }

  // Signature line, then the signatory's name and their role.
  const signature = (x1, x2, name, role, color = INK) => {
    const cx = (x1 + x2) / 2;
    setDraw(doc, [80, 90, 110]);
    doc.setLineWidth(0.3);
    doc.line(x1, baseY - 7, x2, baseY - 7);
    setInk(doc, INK);
    font(doc, 8.2, 'bold');
    doc.text(fitText(doc, name || ' ', x2 - x1), cx, baseY - 3.3, { align: 'center' });
    setInk(doc, color);
    font(doc, 7.6, 'normal');
    doc.text(role, cx, baseY + 0.4, { align: 'center' });
  };
  signature(132, 177, card.classTeacherName, text(template.signatureLabel) || 'Class Teacher');
  signature(188, 238, card.principalName, text(template.principalLabel) || 'Headmaster / Principal', NAVY);
  signature(249, 290, parentName, "Parent's Signature");
};

/* --------------------------------------------------------------------------- */

const buildContext = async ({ template = {}, reportCard = {}, profile = {}, parentName, photoUrl, issueDate }) => {
  const subjects = (reportCard.subjects || []).map((s) => {
    const obtained = num(s.obtainedMarks);
    const total = num(s.totalMarks);
    const pct = total > 0 ? (obtained / total) * 100 : 0;
    return {
      name: text(s.name),
      obtained,
      total,
      theory: s.theoryMarks ?? '',
      internal: s.internalMarks ?? '',
      theoryMax: s.theoryMax,
      internalMax: s.internalMax,
      pct,
      grade: gradeFor(pct),
      remark: remarkFor(pct),
    };
  });
  const obtained = subjects.reduce((a, s) => a + s.obtained, 0);
  const total = subjects.reduce((a, s) => a + s.total, 0);
  const pct = total > 0 ? (obtained / total) * 100 : 0;
  const passed = subjects.length > 0 && pct >= PASS_PERCENT && subjects.every((s) => s.pct >= PASS_PERCENT);
  const session = formatSession(reportCard.academicYear || profile.academicYear);
  const term = text(reportCard.term) || 'Annual';
  const grade = text(reportCard.grade || profile.grade).replace(/^class\s*/i, '');
  const section = text(reportCard.section || profile.section);

  const qrPayload = [
    text(template.schoolName),
    `Grade Card – ${term}`,
    `Student: ${text(reportCard.studentName)}`,
    `Adm No: ${text(profile.admissionNumber || reportCard.admissionNumber || reportCard.studentCode) || '-'}`,
    `Class: ${grade}${section ? `-${section}` : ''}  Session: ${session}`,
    `Marks: ${obtained}/${total} (${pct.toFixed(1)}%)  Grade: ${gradeFor(pct)}`,
  ].join('\n');

  const [logo, photo, qr] = await Promise.all([
    loadImage(template.logoUrl || template.logoUrlOverride),
    loadImage(photoUrl, 'image/jpeg'),
    QRCode.toDataURL(qrPayload, { margin: 0, width: 240, errorCorrectionLevel: 'M' }).catch(() => ''),
  ]);

  return {
    template,
    card: reportCard,
    profile,
    parentName: text(parentName) || text(profile.father?.name) || text(profile.mother?.name),
    logo,
    photo,
    qr,
    issueDate: issueDate || new Date(),
    session,
    term,
    grade,
    section,
    subjects,
    totals: {
      obtained,
      total,
      pct,
      grade: gradeFor(pct),
      passed,
      remark: text(reportCard.overallRemark) || overallRemarkFor(pct),
    },
  };
};

export const downloadGradeCardPdf = async ({ fileName, ...input }) => {
  if (!input.reportCard) return false;
  const ctx = await buildContext(input);
  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  drawBackground(doc, W, H);
  drawHeader(doc, W, ctx);
  drawStudentBox(doc, ctx);
  const tableBottom = drawMarksTable(doc, ctx);
  const tilesBottom = drawSummaryTiles(doc, ctx, Math.max(tableBottom + 2.5, 133));
  const blockY = tilesBottom + 3;
  drawGradeScale(doc, blockY);
  drawFooter(doc, ctx, H);

  doc.save(fileName || `Grade_Card_${text(input.reportCard.studentName).replace(/\s+/g, '_') || 'Student'}.pdf`);
  return true;
};
