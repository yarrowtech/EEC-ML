import React, { forwardRef } from 'react';

// Auto-generated "Certificate of Achievement" shown when the school recorded an
// achievement without uploading a certificate file. Pure HTML/CSS (no images
// besides the optional school logo) so it renders crisply and can be exported
// to PDF with html2canvas.

const certDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

const Medal = () => (
  <svg viewBox="0 0 80 120" className="h-full w-full" aria-hidden="true">
    <path d="M22 62 L10 112 L26 102 L34 116 L40 70Z" fill="#b91c1c" />
    <path d="M58 62 L70 112 L54 102 L46 116 L40 70Z" fill="#dc2626" />
    <circle cx="40" cy="44" r="34" fill="#d97706" />
    <circle cx="40" cy="44" r="29" fill="#fbbf24" />
    <circle cx="40" cy="44" r="23" fill="none" stroke="#d97706" strokeWidth="1.5" strokeDasharray="2 2" />
    <path d="M40 28l5 10 11 1.5-8 7.5 2 11-10-5.5-10 5.5 2-11-8-7.5 11-1.5z" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
  </svg>
);

const Laurel = () => (
  <svg viewBox="0 0 100 70" className="h-full w-full" aria-hidden="true">
    {[-1, 1].map((dir) => (
      <g key={dir} transform={`translate(50 0) scale(${dir} 1)`}>
        <path d="M-4 66 C-30 60 -40 36 -34 8" fill="none" stroke="#b45309" strokeWidth="2" />
        {[0, 1, 2, 3, 4].map((i) => {
          const y = 58 - i * 11;
          const x = -12 - i * 4.5 - (i > 2 ? (i - 2) * 3 : 0);
          return <ellipse key={i} cx={x} cy={y} rx="4" ry="8" fill="#d97706" transform={`rotate(${-50 + i * 8} ${x} ${y})`} />;
        })}
      </g>
    ))}
  </svg>
);

const GeneratedCertificate = forwardRef(({ schoolName, schoolLogo, studentName, title, description, category, grade, date, teacherName }, ref) => {
  const teacher = String(teacherName || '').replace(/\s*\(Class Teacher\)\s*$/i, '').trim();
  const line = description?.trim()
    ? description.trim()
    : `has been awarded “${title}”${category ? ` in ${category}` : ''}${grade ? ` in Class ${grade}` : ''}${date ? ` for the Academic Session ${new Date(date).getFullYear()}` : ''}.`;

  return (
    <div
      ref={ref}
      className="relative mx-auto aspect-[1.414/1] [container-type:inline-size] w-full max-w-[720px] overflow-hidden bg-[#b91c1c] p-[2.2%] text-[#1e293b] "
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <div style={{ background: 'linear-gradient(135deg, #fffaf0 0%, #fdf3dc 55%, #f8e9c6 100%)' }} className="relative flex h-full flex-col items-center border-[3px] border-[#d4a64a] px-[8%] pt-[4%] text-center">
        {/* Gold corner accents */}
        {['left-1 top-1', 'right-1 top-1 rotate-90', 'right-1 bottom-1 rotate-180', 'left-1 bottom-1 -rotate-90'].map((pos) => (
          <span key={pos} className={`absolute h-[9%] w-[6%] ${pos} border-l-2 border-t-2 border-[#d4a64a]`} />
        ))}

        {/* Medal */}
        <div className="absolute left-[4%] top-[6%] w-[13%]">
          <Medal />
        </div>

        <div className="flex items-center gap-2">
          {schoolLogo && <img src={schoolLogo} alt="" data-pdf-exclude="true" className="h-[1.6em] w-[1.6em] object-contain text-[2.50cqw]" />}
          <p className="text-[2.50cqw] font-bold uppercase tracking-wide text-[#8a5a12]">
            {schoolName || 'School'}
          </p>
        </div>
        <p className="mt-[1%] text-[6.11cqw] font-bold uppercase leading-none tracking-[0.06em] text-[#1f2937]">Certificate</p>
        <p className="mt-[0.5%] text-[1.81cqw] uppercase tracking-[0.2em] text-[#334155]">of Achievement</p>
        <p className="mt-[2%] text-[1.67cqw] text-[#475569]">This is to certify that</p>
        <p
          className="mt-[1%] border-b border-[#d4a64a] px-6 text-[5.56cqw] leading-tight text-[#b45309]"
          style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
        >
          {studentName}
        </p>
        <p className="mt-[2.5%] max-w-[88%] text-[1.94cqw] leading-snug text-[#334155]">{line}</p>

        {/* Footer */}
        <div className="absolute inset-x-[7%] bottom-[7%] flex items-end justify-between">
          <div className="w-[26%] text-center">
            <p className="border-b border-[#94a3b8] pb-0.5 text-[1.67cqw]">{certDate(date)}</p>
            <p className="mt-0.5 text-[1.53cqw] text-[#475569]">Date</p>
          </div>
          <div className="w-[16%]">
            <Laurel />
          </div>
          <div className="w-[26%] text-center">
            <p
              className="border-b border-[#94a3b8] pb-0.5 text-[2.78cqw] leading-none text-[#334155]"
              style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
            >
              {teacher || ' '}
            </p>
            <p className="mt-0.5 text-[1.67cqw] font-semibold">{teacher || ' '}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

GeneratedCertificate.displayName = 'GeneratedCertificate';

export default GeneratedCertificate;
