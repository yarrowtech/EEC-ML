import React, { useEffect, useRef, useState } from 'react';
import { X, PenLine, Eraser, Trash2, Download, ZoomIn, ZoomOut, FileText, Video } from 'lucide-react';

const SKETCH_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#000000', '#ffffff'];

const isYouTube = (url = '') => /youtube\.com|youtu\.be/.test(url);
const isVideo   = (url = '') => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || isYouTube(url);

const getYouTubeEmbed = (url = '') => {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?rel=0` : url;
};

const SketchCanvas = ({ active, onClose }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [color, setColor] = useState('#ef4444');
  const [size, setSize] = useState(3);
  const [eraser, setEraser] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.lineWidth = eraser ? size * 6 : size;
    ctx.lineCap = 'round';
    ctx.strokeStyle = eraser ? 'rgba(0,0,0,1)' : color;
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { drawing.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const downloadSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'my-notes.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-2 flex-wrap">
        <div className="flex gap-1">
          {SKETCH_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setColor(c); setEraser(false); }}
              className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${color === c && !eraser ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <span className="text-white/60 text-xs">Size</span>
          {[2, 4, 8].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`h-5 w-5 flex items-center justify-center rounded-full border transition-all ${size === s ? 'border-white bg-white/20' : 'border-white/20'}`}
            >
              <div className="rounded-full bg-white" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-2">
          <button type="button" onClick={() => setEraser((e) => !e)} title="Eraser"
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${eraser ? 'bg-amber-500 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
            <Eraser className="size-3.5" />
          </button>
          <button type="button" onClick={clearCanvas} title="Clear"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10">
            <Trash2 className="size-3.5" />
          </button>
          <button type="button" onClick={downloadSketch} title="Download"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10">
            <Download className="size-3.5" />
          </button>
        </div>
        <button type="button" onClick={onClose} className="ml-auto text-white/70 hover:text-white text-xs font-semibold">
          Close Sketch
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={1200}
        height={900}
        className="flex-1 w-full cursor-crosshair"
        style={{ touchAction: 'none', background: 'transparent' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
    </div>
  );
};

const LessonViewer = ({ material, onClose }) => {
  const [sketchActive, setSketchActive] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(100);

  if (!material) return null;

  const url = material.fileUrl || material.attachmentUrl || material.url || '';
  const title = material.topicTitle || material.chapterTitle || material.name || 'Lesson';
  const isVid = isVideo(url);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 bg-slate-800 px-4 py-2.5 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700">
          {isVid ? <Video className="size-4 text-amber-400" /> : <FileText className="size-4 text-sky-400" />}
        </div>
        <p className="flex-1 truncate text-sm font-semibold text-white">{title}</p>
        <div className="flex items-center gap-2">
          {!isVid && (
            <>
              <button type="button" onClick={() => setPdfZoom((z) => Math.max(50, z - 25))}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-white/70 hover:text-white hover:bg-slate-600">
                <ZoomOut className="size-3.5" />
              </button>
              <span className="text-xs text-white/60 w-10 text-center">{pdfZoom}%</span>
              <button type="button" onClick={() => setPdfZoom((z) => Math.min(200, z + 25))}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-white/70 hover:text-white hover:bg-slate-600">
                <ZoomIn className="size-3.5" />
              </button>
              <div className="w-px h-4 bg-slate-600" />
            </>
          )}
          <button
            type="button"
            onClick={() => setSketchActive((s) => !s)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${sketchActive ? 'bg-amber-500 text-white' : 'bg-slate-700 text-white/70 hover:text-white hover:bg-slate-600'}`}
          >
            <PenLine className="size-3.5" /> {sketchActive ? 'Hide Sketch' : 'Sketch'}
          </button>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-white/70 hover:text-white hover:bg-red-600 transition-colors">
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {isVid ? (
          isYouTube(url) ? (
            <iframe
              src={getYouTubeEmbed(url)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={title}
            />
          ) : (
            <video
              src={url}
              className="w-full h-full object-contain bg-black"
              controls
              autoPlay={false}
            />
          )
        ) : url ? (
          <iframe
            src={`${url}#zoom=${pdfZoom}`}
            className="w-full h-full border-0"
            title={title}
            style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: 'top left', width: `${10000 / pdfZoom}%`, height: `${10000 / pdfZoom}%` }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">No content available</div>
        )}

        {/* Sketch overlay */}
        <SketchCanvas active={sketchActive} onClose={() => setSketchActive(false)} />
      </div>
    </div>
  );
};

export default LessonViewer;
