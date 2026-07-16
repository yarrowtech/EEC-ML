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

export const buildRoomLabel = (exam) => {
  const roomNumber = exam?.roomId?.roomNumber;
  if (roomNumber) return roomNumber;
  return String(exam?.venue || '').trim() || '—';
};

export const generateExamSchedulePdf = async (group, pdfHeader) => {
  if (!group?._id) return;
  const className = group.classId?.name || group.grade || '—';
  const sectionName = group.sectionId?.name || group.section || '—';
  const title = String(group.title || 'Exam Schedule').trim();

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 0;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, 5, 38, 'F');

  const logoDataUrl = await toDataUrl(pdfHeader.logoUrl);
  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 6, 24, 24, 2, 2, 'F');
      doc.addImage(logoDataUrl, 'PNG', margin + 1, 7, 22, 22);
    } catch {
      // Ignore logo rendering failures.
    }
  }

  const textX = logoDataUrl ? margin + 30 : margin + 8;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text((pdfHeader.schoolName || 'School').toUpperCase(), textX, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  if (pdfHeader.schoolAddressLine) {
    doc.text(pdfHeader.schoolAddressLine, textX, 26);
  }

  y = 46;

  doc.setFillColor(238, 242, 255);
  doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 22, 3, 3, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 22, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 27, 75);
  doc.text(title, pageWidth / 2, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(99, 102, 241);
  const meta = [`Class: ${className}`, `Section: ${sectionName}`].join('   •   ');
  doc.text(meta, pageWidth / 2, y + 11, { align: 'center' });

  y += 26;

  const headers = ['Date', 'Day', 'Subject', 'Room No.'];
  const colWidths = [30, 34, 88, 30];
  const tableW = colWidths.reduce((s, v) => s + v, 0);
  const startX = margin;
  const rowH = 9;

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(startX, y, tableW, rowH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  let x = startX;
  headers.forEach((header, index) => {
    doc.text(header, x + colWidths[index] / 2, y + 6, { align: 'center' });
    x += colWidths[index];
  });
  y += rowH;

  const rows = (group.subjects || [])
    .map((exam) => {
      const date = exam?.date ? new Date(exam.date) : null;
      const dateText = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
      const dayText = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-US', { weekday: 'long' })
        : '—';
      const subjectText = exam?.subjectId?.name || exam?.subject || exam?.title || '—';
      return [dateText, dayText, subjectText, buildRoomLabel(exam)];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  if (!rows.length) {
    rows.push(['—', '—', 'No subject exams scheduled', '—']);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  rows.forEach((row, rowIndex) => {
    if (y + rowH > 285) {
      doc.addPage();
      y = 18;
    }
    doc.setFillColor(rowIndex % 2 === 0 ? 248 : 255, rowIndex % 2 === 0 ? 250 : 255, rowIndex % 2 === 0 ? 252 : 255);
    doc.rect(startX, y, tableW, rowH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(startX, y, tableW, rowH);

    let colX = startX;
    row.forEach((cell, i) => {
      const align = i === 2 ? 'left' : 'center';
      const textXPos = align === 'left' ? colX + 2.5 : colX + colWidths[i] / 2;
      doc.setTextColor(15, 23, 42);
      doc.text(String(cell || '—'), textXPos, y + 5.7, { align });
      colX += colWidths[i];
    });
    y += rowH;
  });

  const safeTitle = String(title || 'exam_schedule').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const safeClass = String(className || 'class').replace(/\s+/g, '_');
  const safeSection = String(sectionName || 'section').replace(/\s+/g, '_');
  doc.save(`${safeTitle}_${safeClass}_${safeSection}.pdf`);
};
