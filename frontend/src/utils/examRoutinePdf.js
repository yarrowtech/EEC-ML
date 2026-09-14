import { jsPDF } from 'jspdf';

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
