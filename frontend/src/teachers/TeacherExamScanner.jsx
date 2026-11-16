import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Info, QrCode, RefreshCw, X } from 'lucide-react';

// Exam attendance scanner: the invigilator points the camera at the QR code on
// a student's admit card; the code is sent to POST /api/exam-attendance/scan,
// which records the student present for today's exam of their class/section.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const SAME_CODE_COOLDOWN_MS = 4000;

const fmtTime = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const beep = (ok) => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 300;
    gain.gain.value = 0.08;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + (ok ? 0.15 : 0.35));
    osc.onended = () => ctx.close();
  } catch { /* no audio */ }
  try { navigator.vibrate?.(ok ? 80 : [60, 60, 60]); } catch { /* no vibration */ }
};

const TeacherExamScanner = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const busyRef = useRef(false);
  const lastCodeRef = useRef({ code: '', at: 0 });

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null); // { kind: 'success'|'already'|'error', ... }
  const [records, setRecords] = useState([]);

  const token = () => localStorage.getItem('token');

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/exam-attendance/mine`, { headers: { Authorization: `Bearer ${token()}` }, cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.ok) setRecords(data?.data?.records || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMine(); }, [loadMine]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const submit = useCallback(async (code) => {
    busyRef.current = true;
    try {
      const res = await fetch(`${API_BASE}/api/exam-attendance/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const kind = data.alreadyMarked ? 'already' : 'success';
        beep(true);
        setResult({ kind, ...data });
        if (!data.alreadyMarked) loadMine();
      } else {
        beep(false);
        setResult({ kind: 'error', message: data.message || 'Could not record attendance.' });
      }
    } catch {
      beep(false);
      setResult({ kind: 'error', message: 'Network error — check the connection and scan again.' });
    } finally {
      busyRef.current = false;
    }
  }, [loadMine]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const scale = Math.min(1, 640 / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (found?.data) {
        const now = Date.now();
        const last = lastCodeRef.current;
        if (found.data !== last.code || now - last.at > SAME_CODE_COOLDOWN_MS) {
          lastCodeRef.current = { code: found.data, at: now };
          submit(found.data);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [submit]);

  const start = useCallback(async () => {
    setCameraError('');
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not available. Open the portal over HTTPS (or localhost) in a modern browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      setScanning(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setCameraError(err?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in the browser and try again.'
        : 'Could not open the camera.');
      stop();
    }
  }, [tick, stop]);

  // Auto-dismiss the prompt after a short while so scanning keeps flowing.
  useEffect(() => {
    if (!result) return undefined;
    const t = setTimeout(() => setResult(null), result.kind === 'error' ? 4000 : 2500);
    return () => clearTimeout(t);
  }, [result]);

  const resultStyle = {
    success: { box: 'border-emerald-200 bg-emerald-50', icon: <CheckCircle2 className="text-emerald-600" size={40} />, title: 'Attendance recorded' },
    already: { box: 'border-sky-200 bg-sky-50', icon: <Info className="text-sky-600" size={40} />, title: 'Already marked present' },
    error: { box: 'border-rose-200 bg-rose-50', icon: <AlertTriangle className="text-rose-600" size={40} />, title: 'Not recorded' },
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><QrCode size={22} className="text-indigo-600" /> Exam Attendance Scanner</h1>
          <p className="mt-0.5 text-sm text-slate-500">Scan the QR code on each student's admit card to mark them present for today's exam.</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
        <video ref={videoRef} muted playsInline className={`aspect-[4/3] w-full object-cover ${scanning ? '' : 'hidden'}`} />
        <canvas ref={canvasRef} className="hidden" />
        {scanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {!scanning && (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-300">
            <Camera size={44} />
            <p className="text-sm">Camera is off</p>
            <button type="button" onClick={start}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Start scanning
            </button>
            {cameraError && <p className="max-w-sm text-xs text-rose-300">{cameraError}</p>}
          </div>
        )}

        {result && (
          <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2">
            <div className={`flex items-start gap-3 rounded-2xl border p-4 shadow-xl ${resultStyle[result.kind].box}`}>
              {resultStyle[result.kind].icon}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">{resultStyle[result.kind].title}</p>
                {result.student ? (
                  <>
                    <p className="truncate text-sm font-semibold text-slate-800">{result.student.name}</p>
                    <p className="text-xs text-slate-600">
                      Class {result.student.grade}-{result.student.section} · Roll {result.student.roll ?? '—'} · {result.student.username}
                    </p>
                    <p className="text-xs text-slate-600">{result.exam?.subject} · {result.exam?.title}</p>
                    {result.kind === 'already' && <p className="text-xs text-sky-700">{result.message}</p>}
                    {!result.isInvigilator && <p className="mt-1 text-[11px] text-amber-700">Note: you are not the listed invigilator for this exam.</p>}
                  </>
                ) : (
                  <p className="text-sm text-slate-700">{result.message}</p>
                )}
              </div>
              <button type="button" onClick={() => setResult(null)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss"><X size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {scanning && (
        <button type="button" onClick={stop}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <CameraOff size={16} /> Stop camera
        </button>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">Scanned today <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{records.length}</span></p>
          <button type="button" onClick={loadMine} className="text-slate-400 hover:text-slate-600" aria-label="Refresh"><RefreshCw size={16} /></button>
        </div>
        {records.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No students scanned yet today.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {records.map((r) => (
              <li key={r._id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{r.studentName}</p>
                  <p className="text-xs text-slate-500">Class {r.grade}-{r.section} · Roll {r.roll ?? '—'} · {r.subject}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-emerald-600">{fmtTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TeacherExamScanner;
