import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const toDataUrl = async (url) => {
  const src = String(url || '').trim();
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

// Minutes → "1 hr 30 min" / "2 hr" / "45 min" — same formatting the admin's
// exam routine PDFs use, so the student's downloaded PDF reads identically.
const formatDuration = (mins) => {
  const n = Number(mins) || 0;
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr`;
  return `${h} hr ${m} min`;
};

export const buildRoomLabel = (exam) => {
  const roomNumber = exam?.roomId?.roomNumber;
  if (roomNumber) return roomNumber;
  return String(exam?.venue || '').trim() || '—';
};

// Full venue detail (building / floor / room) for the printable routine PDF —
// buildRoomLabel() above stays room-number-only for compact on-screen chips.
export const buildFullVenueLabel = (exam) => {
  const buildingName = exam?.roomId?.floorId?.buildingId?.name;
  const floorName = exam?.roomId?.floorId?.name;
  const roomNumber = exam?.roomId?.roomNumber;
  const parts = [buildingName, floorName, roomNumber ? `Room ${roomNumber}` : null].filter(Boolean);
  if (parts.length) return parts.join(' / ');
  return String(exam?.venue || '').trim() || '—';
};

// Same visual design as the admin's "Download Routine" PDF (generateExamSchedulePdf
// / generateBatchExamSchedulePdf in ExaminationManagement.jsx) — no rounded logo
// border, "EXAMINATION ROUTINE / for / <title>" stack, underlined class/section,
// a plain navy (non-rounded) table header, duration in hours, and the principal's
// name above the signature line.
export const generateExamSchedulePdf = async (group, pdfHeader = {}) => {
  if (!group?._id) return;

  const className = group.classId?.name || group.grade || '—';
  const sectionName = group.sectionId?.name || group.section || '—';
  const title = String(group.title || 'Exam Schedule').trim();
  const subjects = Array.isArray(group.subjects) ? group.subjects : [];

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  const colors = {
    navy: [15, 41, 82],
    dark: [30, 41, 59],
    text: [51, 65, 85],
    muted: [100, 116, 139],
    lightBorder: [226, 232, 240],
  };

  // ── SCHOOL HEADER ──────────────────────────────────────────────────────
  const headerTop = y;
  const headerHeight = 30;

  const logoDataUrl = await toDataUrl(pdfHeader.logoUrl);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, headerTop, 24, 24);
    } catch {
      // Ignore logo rendering failures.
    }
  }

  const schoolName = pdfHeader.schoolName || 'School Name';
  const schoolAddress = pdfHeader.schoolAddressLine || '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...colors.navy);
  doc.text(schoolName.toUpperCase(), pageWidth / 2, headerTop + 8, { align: 'center' });

  if (schoolAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.text);
    const addressLines = doc.splitTextToSize(schoolAddress, contentWidth - 45);
    doc.text(addressLines, pageWidth / 2, headerTop + 14, { align: 'center', lineHeightFactor: 1.3 });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...colors.muted);
  doc.text('ACADEMIC SESSION', pageWidth - margin, headerTop + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...colors.dark);
  doc.text(String(group.academicYearName || '—'), pageWidth - margin, headerTop + 12, { align: 'right' });

  doc.setDrawColor(...colors.dark);
  doc.setLineWidth(0.35);
  doc.line(margin, headerTop + headerHeight, pageWidth - margin, headerTop + headerHeight);

  y = headerTop + headerHeight + 8;

  // ── EXAM TITLE ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...colors.muted);
  doc.text('EXAMINATION ROUTINE', pageWidth / 2, y, { align: 'center' });

  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...colors.muted);
  doc.text('for', pageWidth / 2, y, { align: 'center' });

  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...colors.navy);
  doc.text(title, pageWidth / 2, y, { align: 'center' });

  y += 5;

  // ── CLASS / SECTION ─────────────────────────────────────────────────────
  const badgeText = `CLASS ${className}  •  SECTION ${sectionName}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...colors.dark);
  doc.text(badgeText, pageWidth / 2, y, { align: 'center', baseline: 'middle' });

  const badgeTextWidth = doc.getTextWidth(badgeText);
  doc.setDrawColor(...colors.dark);
  doc.setLineWidth(0.35);
  doc.line((pageWidth - badgeTextWidth) / 2, y + 1.5, (pageWidth + badgeTextWidth) / 2, y + 1.5);

  y += 7;

  // ── TABLE ───────────────────────────────────────────────────────────────
  const headers = ['Date', 'Day', 'Subject', 'Time', 'Duration', 'Building', 'Floor', 'Room'];
  const colWidths = [21, 16, 37, 25, 19, 29, 18, 27];
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
  const tableX = margin;

  const rows = subjects
    .map((exam) => {
      const date = exam?.date ? new Date(exam.date) : null;
      const validDate = date && !Number.isNaN(date.getTime());
      const dateText = validDate
        ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
      const dayText = validDate ? date.toLocaleDateString('en-US', { weekday: 'short' }) : '—';
      const subjectName = exam?.subjectId?.name || exam?.subject || exam?.title || 'Subject';

      let timeText = '—';
      if (exam?.startTime && exam?.endTime) {
        timeText = `${exam.startTime} – ${exam.endTime}`;
      } else if (exam?.time) {
        timeText = String(exam.time);
      } else if (exam?.startTime) {
        timeText = String(exam.startTime);
      }

      let durationText = '—';
      if (exam?.duration !== undefined && exam?.duration !== null && exam?.duration !== '') {
        durationText = formatDuration(exam.duration);
      } else if (exam?.durationMinutes) {
        durationText = formatDuration(exam.durationMinutes);
      }

      const buildingName = exam?.roomId?.floorId?.buildingId?.name || exam?.building || '';
      const floorName = exam?.roomId?.floorId?.name || exam?.floor || '';
      const roomNumber = exam?.roomId?.roomNumber || exam?.room || '';

      return {
        rawDate: validDate ? date.getTime() : Number.MAX_SAFE_INTEGER,
        date: dateText,
        day: dayText,
        subject: subjectName,
        time: timeText,
        duration: durationText,
        building: buildingName || '—',
        floor: floorName || '—',
        room: roomNumber ? String(roomNumber) : '—',
      };
    })
    .sort((a, b) => a.rawDate - b.rawDate);

  if (!rows.length) {
    rows.push({
      date: '—', day: '—', subject: 'No subject exams scheduled', time: '—',
      duration: '—', building: '—', floor: '—', room: '—',
    });
  }

  const tableHeaderHeight = 9;

  doc.setFillColor(...colors.navy);
  doc.rect(tableX, y, tableWidth, tableHeaderHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);

  let currentX = tableX;
  headers.forEach((header, index) => {
    doc.text(header, currentX + colWidths[index] / 2, y + 5.8, { align: 'center' });
    currentX += colWidths[index];
  });

  y += tableHeaderHeight;

  const lineHeight = 3.6;

  rows.forEach((row, rowIndex) => {
    const rowData = [row.date, row.day, row.subject, row.time, row.duration, row.building, row.floor, row.room];

    const wrappedCells = rowData.map((cell, index) =>
      doc.splitTextToSize(String(cell || '—'), colWidths[index] - 4)
    );

    const maxLines = Math.max(...wrappedCells.map((lines) => lines.length));
    const rowHeight = Math.max(10, maxLines * lineHeight + 5);

    if (y + rowHeight > pageHeight - 42) {
      doc.addPage();
      y = 15;
    }

    doc.setFillColor(...(rowIndex % 2 === 0 ? [248, 250, 252] : [255, 255, 255]));
    doc.setDrawColor(...colors.lightBorder);
    doc.rect(tableX, y, tableWidth, rowHeight, 'FD');

    let separatorX = tableX;
    colWidths.forEach((width, index) => {
      separatorX += width;
      if (index < colWidths.length - 1) {
        doc.line(separatorX, y, separatorX, y + rowHeight);
      }
    });

    currentX = tableX;
    wrappedCells.forEach((lines, index) => {
      const textX = currentX + colWidths[index] / 2;

      doc.setFont('helvetica', index === 2 ? 'bold' : 'normal');
      doc.setFontSize(index === 2 ? 8 : 7);
      doc.setTextColor(...colors.text);

      lines.forEach((line, lineIndex) => {
        const totalTextHeight = lines.length * lineHeight;
        const startY = y + (rowHeight - totalTextHeight) / 2 + 3;
        doc.text(line, textX, startY + lineIndex * lineHeight, { align: 'center' });
      });

      currentX += colWidths[index];
    });

    y += rowHeight;
  });

  // ── IMPORTANT INSTRUCTIONS ─────────────────────────────────────────────
  y += 8;

  const instructions = [
    'Students must report to the examination venue at least 15 minutes before the scheduled time.',
    'Carry the valid admit card/identity card and all necessary stationery.',
    'Occupy only the assigned seat/room and follow the instructions of the invigilator.',
    'Mobile phones, smartwatches, electronic devices, notes, books, and unauthorized materials are strictly prohibited.',
    'Maintain silence, discipline, and proper conduct throughout the examination.',
  ];

  if (y < pageHeight - 35) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.dark);
    doc.text('Important Instructions', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...colors.text);

    instructions.forEach((instruction, index) => {
      const instructionY = y + 5 + index * 4;
      doc.text(`${index + 1}.`, margin, instructionY);
      doc.text(instruction, margin + 5, instructionY);
    });

    y += 5 + instructions.length * 4;
  }

  // ── FOOTER / SIGNATURE ──────────────────────────────────────────────────
  const footerY = pageHeight - 27;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.text);

  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.text(`Issued: ${generatedDate}`, margin, footerY);

  const signatureWidth = 48;
  const signatureX = pageWidth - margin - signatureWidth;

  doc.setDrawColor(...colors.dark);
  doc.setLineWidth(0.25);
  doc.line(signatureX, footerY - 8, pageWidth - margin, footerY - 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...colors.dark);

  if (pdfHeader.principalName) {
    doc.text(pdfHeader.principalName, signatureX + signatureWidth / 2, footerY - 11, { align: 'center' });
  }

  doc.text('Principal', signatureX + signatureWidth / 2, footerY - 3, { align: 'center' });

  // ── PAGE NUMBER ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...colors.muted);
  doc.text('Page 1 of 1', pageWidth / 2, pageHeight - 8, { align: 'center' });

  const safeTitle = String(title || 'exam_schedule').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const safeClass = String(className || 'class').replace(/\s+/g, '_');
  const safeSection = String(sectionName || 'section').replace(/\s+/g, '_');
  doc.save(`${safeTitle}_${safeClass}_${safeSection}.pdf`);
};

// output: 'save' (default) downloads the file; 'blob' returns it for in-app preview.
// A4 landscape admit card: school letterhead + "ADMIT CARD" badge, student
// details with photo, examination schedule table, instructions, principal
// signature and a round school seal.
export const generateAdmitCardPdf = async ({ student = {}, group = {}, pdfHeader = {}, output = 'save' } = {}) => {
  if (!group?._id) return undefined;
  const subjects = (Array.isArray(group.subjects) ? group.subjects : [])
    .slice()
    .sort((a, b) => new Date(a?.date || 0) - new Date(b?.date || 0));
  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); // 297
  const H = doc.internal.pageSize.getHeight(); // 210
  const navy = [22, 48, 90];
  const ink = [15, 23, 42];
  const mid = [51, 65, 85];
  const line = [191, 204, 222];
  const pale = [226, 236, 250];
  const M = 7;

  const clean = (v) => String(v ?? '').trim();
  const fmtDate = (d) => {
    const x = d ? new Date(d) : null;
    if (!x || Number.isNaN(x.getTime())) return '—';
    return `${String(x.getDate()).padStart(2, '0')}-${String(x.getMonth() + 1).padStart(2, '0')}-${x.getFullYear()}`;
  };
  const dayName = (d) => {
    const x = d ? new Date(d) : null;
    return x && !Number.isNaN(x.getTime()) ? x.toLocaleDateString('en-US', { weekday: 'long' }) : '—';
  };
  const toMin = (t) => { const m = clean(t).match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const fmt12 = (mins) => {
    const h = Math.floor(mins / 60) % 24;
    return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  const timeRange = (s) => {
    const start = toMin(s?.startTime || s?.time);
    if (start === null) return clean(s?.time) || '—';
    const end = toMin(s?.endTime) ?? (Number(s?.duration) ? start + Number(s.duration) : null);
    return end === null ? fmt12(start) : `${fmt12(start)} - ${fmt12(end)}`;
  };
  const building = (s) => clean(s?.roomId?.floorId?.buildingId?.name || s?.roomId?.buildingId?.name) || '—';
  const room = (s) => clean(s?.roomId?.roomNumber || s?.venue) || '—';

  const [logo, photo] = await Promise.all([toDataUrl(pdfHeader.logoUrl), toDataUrl(student.profilePic || student.photo)]);
  const imgType = (data) => (String(data).startsWith('data:image/png') ? 'PNG' : 'JPEG');

  // Outer border
  doc.setDrawColor(...navy); doc.setLineWidth(0.8);
  doc.roundedRect(M - 3, M - 3, W - 2 * (M - 3), H - 2 * (M - 3), 3, 3, 'S');

  // ── Letterhead ──
  if (logo) { try { doc.addImage(logo, imgType(logo), M + 8, M + 1, 28, 28); } catch { /* skip */ } }
  const cx = W / 2 - 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...navy);
  doc.text(clean(pdfHeader.schoolName || 'School').toUpperCase(), cx, M + 10, { align: 'center', maxWidth: 170 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...mid);
  if (pdfHeader.schoolAddressLine) doc.text(clean(pdfHeader.schoolAddressLine).toUpperCase(), cx, M + 16.5, { align: 'center', charSpace: 0.3, maxWidth: 175 });
  if (pdfHeader.board) { doc.setFontSize(9.5); doc.setTextColor(...mid); doc.text(`Affiliated to ${clean(pdfHeader.board)}`, cx, M + 22.5, { align: 'center' }); }
  const session = clean(group.academicYearName || student.academicYear);
  if (session) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...navy);
    const label = `Academic Session: ${session}`;
    doc.text(label, cx, M + 28.5, { align: 'center' });
    const lw = doc.getTextWidth(label);
    doc.setDrawColor(...navy); doc.setLineWidth(0.3);
    doc.line(cx - lw / 2 - 34, M + 27.4, cx - lw / 2 - 4, M + 27.4);
    doc.line(cx + lw / 2 + 4, M + 27.4, cx + lw / 2 + 34, M + 27.4);
  }
  // ADMIT CARD badge
  const bx = W - M - 60; const by = M + 1;
  doc.setFillColor(...pale); doc.roundedRect(bx, by, 58, 30, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...navy);
  doc.text('ADMIT CARD', bx + 29, by + 11, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...ink);
  doc.text(clean(group.title || 'Examination').toUpperCase(), bx + 29, by + 19, { align: 'center', maxWidth: 54 });
  doc.text(`CLASS - ${clean(student.grade) || '—'}`, bx + 29, by + 25, { align: 'center' });

  // ── Student details ──
  let y = M + 36;
  const detailsH = 50; // photo + QR need this height
  doc.setDrawColor(...line); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, W - 2 * M, detailsH, 2, 2, 'S');
  const rows = [
    ['Student Name', clean(student.studentName) || '—', true],
    ['Class', clean(student.grade) ? `${clean(student.grade)}${clean(student.section) ? `-${clean(student.section)}` : ''}` : '—', true],
    ['Roll No.', clean(student.roll) || '—', true],
    ['Date of Birth', student.dob ? fmtDate(student.dob) : '—'],
    ["Father's Name", clean(student.fatherName) || '—'],
    ["Mother's Name", clean(student.motherName) || '—'],
  ];
  rows.forEach(([k, v, bold], i) => {
    const ry = y + 7.5 + i * 6.8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...ink);
    doc.text(k, M + 8, ry);
    doc.text(':', M + 60, ry);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(v, M + 70, ry, { maxWidth: 150 });
  });
  // Photo
  const pw = 24; const ph = 28; const px = W - M - pw - 7; const py = y + 2.5;
  doc.setDrawColor(...line); doc.setLineWidth(0.4); doc.rect(px - 1, py - 1, pw + 2, ph + 2, 'S');
  if (photo) {
    try { doc.addImage(photo, imgType(photo), px, py, pw, ph); } catch { /* skip */ }
  } else {
    doc.setFillColor(241, 245, 249); doc.rect(px, py, pw, ph, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...mid);
    doc.text('Affix Photo', px + pw / 2, py + ph / 2, { align: 'center' });
  }
  // QR code: identifies the student + exam for verification at the hall.
  const qrPayload = [
    clean(pdfHeader.schoolName),
    `Student: ${clean(student.studentName)}`,
    `Admission: ${clean(student.admissionNumber || student.studentId)}`,
    `Class: ${clean(student.grade)}${student.section ? `-${clean(student.section)}` : ''}`,
    `Roll: ${clean(student.roll)}`,
    `Exam: ${clean(group.title)}`,
  ].join('\n');
  try {
    const qr = await QRCode.toDataURL(qrPayload, { margin: 0, width: 240, errorCorrectionLevel: 'M' });
    const qs = 15.5;
    doc.addImage(qr, 'PNG', px + (pw - qs) / 2, py + ph + 1.8, qs, qs);
  } catch { /* QR optional */ }
  y += detailsH + 4;

  // ── Examination schedule ──
  doc.setFillColor(...pale); doc.setDrawColor(...line);
  doc.roundedRect(M, y, W - 2 * M, 8, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...ink);
  doc.text('EXAMINATION SCHEDULE', W / 2, y + 5.6, { align: 'center', charSpace: 0.5 });
  y += 9.5;
  const cols = [
    { h: 'Date', w: 34 }, { h: 'Day', w: 36 }, { h: 'Subject', w: 74 }, { h: 'Time', w: 52 },
    { h: 'Building', w: 42 }, { h: 'Room No.', w: W - 2 * M - 238 },
  ];
  const headH = 7;
  const instructionsH = 40;
  const room4Rows = H - M - instructionsH - 4 - y - headH;
  const rowH = Math.max(5, Math.min(7.2, subjects.length ? room4Rows / subjects.length : 7.2));
  doc.setFillColor(...navy); doc.rect(M, y, W - 2 * M, headH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
  let x = M;
  cols.forEach((c) => { doc.text(c.h, x + c.w / 2, y + 4.8, { align: 'center' }); x += c.w; });
  y += headH;
  const fs = Math.max(7, Math.min(9.5, rowH * 1.3));
  subjects.forEach((s, i) => {
    const cells = [fmtDate(s?.date), dayName(s?.date), clean(s?.subject) || '—', timeRange(s), building(s), room(s)];
    x = M;
    doc.setDrawColor(...line); doc.setLineWidth(0.25);
    cols.forEach((c, ci) => {
      doc.rect(x, y, c.w, rowH, 'S');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(fs); doc.setTextColor(...ink);
      const text = doc.splitTextToSize(cells[ci], c.w - 4)[0] || '';
      if (ci === 2) doc.text(text, x + 4, y + rowH / 2 + 1.2);
      else doc.text(text, x + c.w / 2, y + rowH / 2 + 1.2, { align: 'center' });
      x += c.w;
    });
    y += rowH;
    if (i === subjects.length - 1) y += 0;
  });
  if (!subjects.length) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('Schedule will be announced.', W / 2, y + 5, { align: 'center' }); y += 8;
  }

  // ── Instructions + signature + seal ──
  const iy = H - M - instructionsH;
  doc.setFillColor(240, 245, 253); doc.setDrawColor(...line);
  doc.roundedRect(M, iy, W - 2 * M, instructionsH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...ink);
  doc.text('INSTRUCTIONS FOR CANDIDATES', M + 18, iy + 8);
  // small document glyph
  doc.setDrawColor(...ink); doc.setLineWidth(0.35); doc.rect(M + 8, iy + 4, 5, 6.5, 'S');
  [6, 7.6, 9].forEach((d) => doc.line(M + 9, iy + d, M + 12, iy + d));
  const tips = [
    'This admit card must be carried to the examination hall every day.',
    'Report to the examination centre at least 30 minutes before the start time.',
    'Carry your school ID card and necessary stationery (pen, pencil, eraser, scale, etc.).',
    'Use of mobile phones, smartwatches or any electronic devices is strictly prohibited.',
    'Follow all instructions given by the invigilator and maintain discipline in the examination hall.',
  ];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(...ink);
  tips.forEach((t, i) => doc.text(`${i + 1}.  ${t}`, M + 18, iy + 14.5 + i * 5.2, { maxWidth: 150 }));
  // divider
  doc.setDrawColor(...line); doc.line(W - M - 80, iy + 5, W - M - 80, iy + instructionsH - 5);
  // signature
  const sx = W - M - 66;
  doc.setDrawColor(...ink); doc.setLineWidth(0.4); doc.line(sx, iy + 24, sx + 52, iy + 24);
  if (pdfHeader.principalName) {
    doc.setFont('times', 'italic'); doc.setFontSize(12); doc.setTextColor(...navy);
    doc.text(clean(pdfHeader.principalName), sx + 26, iy + 21, { align: 'center' });
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...ink);
  doc.text('Signature of Principal', sx + 26, iy + 29.5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...mid);
  doc.text(clean(pdfHeader.schoolName), sx + 26, iy + 34.5, { align: 'center', maxWidth: 60 });
  const safeStudent = String(student.studentName || 'student').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const safeTitle = String(group.title || 'admit_card').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  if (output === 'blob') return doc.output('blob');
  doc.save(`${safeStudent}_${safeTitle}_Admit_Card.pdf`);
  return undefined;
};
