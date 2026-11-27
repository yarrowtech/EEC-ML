import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Play, Pause, Square, Clock, BookOpen,
  ChevronRight, Loader2, AlertCircle, Volume2, Gauge,
  FileText, Star, ArrowLeft, History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReadingScoreCard from './ReadingScoreCard';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const DIFFICULTY_COLORS = {
  easy: 'bg-emerald-600 text-white',
  medium: 'bg-amber-600 text-white',
  hard: 'bg-red-600 text-white',
};

const TYPE_LABELS = {
  story: 'Story',
  paragraph: 'Paragraph',
  poem: 'Poem',
  article: 'Article',
  dialogue: 'Dialogue',
};
// Bar heights (%) for the footer waveform — loud in the middle, quiet at the edges
const FOOTER_WAVE = [30, 40, 35, 45, 55, 70, 60, 85, 65, 50, 75, 90, 70, 55, 80, 100, 75, 60, 85, 70, 55, 65, 90, 60, 50, 75, 95, 70, 55, 45, 60, 40, 35, 45, 30];

const Waveform = ({ active }) => (
  <div className="flex items-center gap-0.5 h-8">
    {Array.from({ length: 20 }).map((_, i) => (
      <Motion.div
        key={i}
        className="w-1 rounded-full bg-red-500"
        animate={active ? {
          height: ['4px', `${8 + Math.random() * 24}px`, '4px'],
          opacity: [0.6, 1, 0.6],
        } : { height: '4px', opacity: 0.3 }}
        transition={active ? {
          duration: 0.5 + Math.random() * 0.5,
          repeat: Infinity,
          delay: i * 0.05,
          ease: 'easeInOut',
        } : {}}
      />
    ))}
  </div>
);

// Material list card
const MaterialCard = ({ material, onStart }) => (
  <Motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    onClick={() => onStart(material)}
  >
    <div className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-base group-hover:text-indigo-700 transition-colors line-clamp-2">
            {material.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {TYPE_LABELS[material.contentType] || material.contentType}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0 mt-0.5" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {material.difficulty && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${DIFFICULTY_COLORS[material.difficulty] || 'bg-slate-600 text-white'}`}>
            {material.difficulty}
          </span>
        )}
        <span className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> {material.wordCount || 0} words
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> ~{material.estimatedReadingTime || 1} min
        </span>
        </span>
      </div>
    </div>
  </Motion.div>
);

// Reading session view
const ReadingSession = ({ material, token, onCancel }) => {
  const [phase, setPhase] = useState('preview'); // preview | recording | processing | error | results
  const [isPaused, setIsPaused] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [wordsPerMinute, setWordsPerMinute] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [assessment, setAssessment] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const recognitionRef = useRef(null);
  // live speech + voice meter
  const finalTextRef = useRef('');
  const listeningRef = useRef(false);
  const audioCtxRef = useRef(null);
  const meterRafRef = useRef(null);
  const barRefs = useRef([]);
  const syllablesRef = useRef(0); // speech bursts counted from the mic — WPM fallback
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);

  // Moves the waveform bars with the real loudness of the student's voice.
  // Below a small noise floor the bars stay flat (silence = no movement).
  const stopVoiceMeter = useCallback(() => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    audioCtxRef.current?.close?.().catch(() => {});
    audioCtxRef.current = null;
    barRefs.current.forEach((el) => { if (el) el.style.transform = 'scaleY(0.12)'; });
  }, []);

  const startVoiceMeter = useCallback((stream) => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    stopVoiceMeter();
    try {
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      ctx.resume?.().catch(() => {});
      const freq = new Uint8Array(analyser.frequencyBinCount);
      const wave = new Uint8Array(analyser.fftSize);
      const usable = Math.floor(freq.length * 0.45); // voice lives in the lower part of the spectrum
      const n = FOOTER_WAVE.length;
      const mid = (n - 1) / 2;
      const FLAT = 'scaleY(0.12)';
      let noiseFloor = 0.02;   // learns the room's background level
      let level = 0;           // smoothed loudness
      let inBurst = false;
      let lastBurstAt = 0;
      syllablesRef.current = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(wave);
        let sum = 0;
        for (let k = 0; k < wave.length; k += 1) { const x = (wave[k] - 128) / 128; sum += x * x; }
        const rms = Math.sqrt(sum / wave.length);
        level = level * 0.6 + rms * 0.4;

        // background noise tracker: drops fast to quiet levels, rises very slowly
        noiseFloor = level < noiseFloor ? noiseFloor * 0.9 + level * 0.1 : noiseFloor + (level - noiseFloor) * 0.0015;
        const threshold = Math.max(0.025, noiseFloor * 2.5);
        const speaking = !pausedRef.current && level > threshold;

        // count speech bursts (≈ syllables) for a words/min estimate
        const now = performance.now();
        if (speaking && !inBurst && level > threshold * 1.3 && now - lastBurstAt > 140) {
          inBurst = true; lastBurstAt = now; syllablesRef.current += 1;
        } else if (inBurst && level < threshold * 1.1) {
          inBurst = false;
        }

        if (!speaking) {
          for (let i = 0; i < n; i += 1) { const el = barRefs.current[i]; if (el) el.style.transform = FLAT; }
        } else {
          analyser.getByteFrequencyData(freq);
          let peak = 1;
          for (let k = 2; k < usable; k += 1) peak = Math.max(peak, freq[k]);
          const loud = Math.min(1, (level - threshold) / 0.12 + 0.25);
          for (let i = 0; i < n; i += 1) {
            const el = barRefs.current[i];
            if (!el) continue;
            const bin = 2 + Math.floor((Math.abs(i - mid) / (mid || 1)) * (usable - 3));
            const v = (freq[bin] / peak) * loud;
            el.style.transform = 'scaleY(' + (0.12 + Math.min(1, v) * 0.88).toFixed(3) + ')';
          }
        }
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* meter is decorative — recording still works */ }
  }, [stopVoiceMeter]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startLiveSpeech = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      if (final) finalTextRef.current = (finalTextRef.current + final).slice(-4000);
      setLiveTranscript(finalTextRef.current + interim);
    };
    // Browsers end recognition after a silence — restart while still recording
    rec.onend = () => {
      if (listeningRef.current && recognitionRef.current === rec) {
        try { rec.start(); } catch { /* already started */ }
      }
    };
    rec.onerror = () => {};
    listeningRef.current = true;
    try { rec.start(); } catch { /* ignore */ }
    recognitionRef.current = rec;
  }, []);

  const startRecording = useCallback(async () => {
    // ── resolve getUserMedia across browsers / legacy prefixes ─────────────
    let getMedia;
    if (navigator.mediaDevices?.getUserMedia) {
      getMedia = (c) => navigator.mediaDevices.getUserMedia(c);
    } else {
      const legacyFn = navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia;
      if (!legacyFn) {
        setErrorMsg(
          'Audio recording is not supported in this browser. ' +
          'On iPhone/iPad use Safari 14.5+; on Android use Chrome 74+.'
        );
        setPhase('error');
        return;
      }
      getMedia = (c) => new Promise((res, rej) => legacyFn.call(navigator, c, res, rej));
    }

    // ── pick the best supported MIME type ─────────────────────────────────
    const MIME_CANDIDATES = ['audio/webm', 'audio/mp4', 'audio/ogg'];
    const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || '';

    try {
      const stream = await getMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;
      finalTextRef.current = '';
      setLiveTranscript('');
      setWordsPerMinute(0);
      startVoiceMeter(stream);
      startTimeRef.current = Date.now();
      setIsPaused(false);
      setElapsed(0);
      setPhase('recording');

      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
      }, 1000);

      startLiveSpeech();
    } catch (err) {
      // Map DOMException names to actionable messages for mobile users
      const name = err?.name || '';
      let msg;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        msg =
          'Microphone access was denied. ' +
          'On iPhone: Settings → Safari → Microphone → Allow. ' +
          'On Android: tap the lock icon in the address bar → Microphone → Allow.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No microphone was found on this device. Please connect one and try again.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        msg = 'Microphone is in use by another app. Close other apps using the mic and try again.';
      } else if (name === 'SecurityError') {
        msg = 'Microphone access requires a secure connection (HTTPS). Please contact your school administrator.';
      } else if (name === 'AbortError') {
        msg = 'Microphone request was cancelled. Please try again.';
      } else {
        msg = `Could not access microphone: ${err?.message || 'unknown error'}. Please try again.`;
      }
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [startLiveSpeech, startVoiceMeter]);

  // Words per minute from what speech recognition has heard so far
  useEffect(() => {
    if (phase !== 'recording' || elapsed <= 0) return;
    const heard = liveTranscript.trim().split(/\s+/).filter(Boolean).length;
    const words = heard > 0 ? heard : syllablesRef.current / 1.5;
    setWordsPerMinute(Math.round((words / elapsed) * 60));
  }, [liveTranscript, elapsed, phase]);

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      listeningRef.current = false;
      recognitionRef.current?.stop();
      clearInterval(timerRef.current);
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      startLiveSpeech();
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
      }, 1000);
      setIsPaused(false);
    }
  };

  const finishRecording = useCallback(async () => {
    clearInterval(timerRef.current);
    listeningRef.current = false;
    recognitionRef.current?.stop();
    stopVoiceMeter();

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    await new Promise((resolve) => {
      recorder.onstop = resolve;
      if (recorder.state !== 'inactive') recorder.stop();
    });

    recorder.stream?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    setPhase('processing');
    setErrorMsg('');

    const controller = new AbortController();
    // 3-minute hard timeout — AI pipeline should finish well within this
    const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);

    try {
      const blobType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: blobType });
      if (blob.size === 0) {
        setErrorMsg('No audio was captured. Please check your microphone and try again.');
        setPhase('error');
        return;
      }

      // Derive file extension from MIME so the server's ffmpeg picks the right decoder
      const ext = blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm';
      const formData = new FormData();
      formData.append('audio', blob, `recording.${ext}`);
      formData.append('materialId', material._id);
      formData.append('audioDurationSeconds', String(elapsed));

      const resp = await fetch(`${API_BASE}/api/reading-assessment/student/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });

      if (!resp.ok) {
        let detail = 'Evaluation failed on the server.';
        try { detail = (await resp.json()).message || detail; } catch { /* raw text */ }
        throw new Error(detail);
      }

      const data = await resp.json();
      setAssessment(data.data);
      setPhase('results');
    } catch (err) {
      console.error('[ReadingEval]', err);
      const isAbort = err.name === 'AbortError';
      setErrorMsg(
        isAbort
          ? 'Evaluation timed out (3 min). The AI service may be overloaded — please try again.'
          : err.message || 'Evaluation failed. Please try again.'
      );
      setPhase('error');
    } finally {
      clearTimeout(timeoutId);
    }
  }, [material, token, elapsed, stopVoiceMeter]);

  // Restart: throw away this attempt and release the microphone
  const restartRecording = () => {
    clearInterval(timerRef.current);
    listeningRef.current = false;
    recognitionRef.current?.stop();
    stopVoiceMeter();
    const rec = mediaRecorderRef.current;
    if (rec) {
      rec.ondataavailable = null;
      if (rec.state !== 'inactive') rec.stop();
      rec.stream?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    finalTextRef.current = '';
    setPhase('preview'); setElapsed(0); setLiveTranscript(''); setWordsPerMinute(0); setAssessment(null); setIsPaused(false);
  };

  useEffect(() => () => {
    clearInterval(timerRef.current);
    listeningRef.current = false;
    recognitionRef.current?.stop();
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    audioCtxRef.current?.close?.().catch(() => {});
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // Space = start / finish (matches HTML design keyboard shortcut)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== ' ' || e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      if (phase === 'recording') finishRecording();
      else if (phase === 'preview') startRecording();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, finishRecording, startRecording]);

  if (phase === 'results' && assessment) {
    return (
      <ReadingScoreCard
        assessment={assessment}
        material={material}
        onRetry={() => {
          setPhase('preview');
          setElapsed(0);
          setLiveTranscript('');
          setAssessment(null);
        }}
        onBack={onCancel}
      />
    );
  }

  if (phase === 'processing') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-center min-h-64">
        <Motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl border border-white/50 p-8 sm:p-12 text-center w-full"
        >
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Analysing your reading…</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            We’re listening to your recording and checking your pronunciation, speed and accuracy. This can take up to a minute — please stay on this page.
          </p>
        </Motion.div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center min-h-64">
        <Motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl border border-red-100 p-8 sm:p-12 text-center w-full"
        >
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">We couldn’t check your reading</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-7">
            {errorMsg || 'Something went wrong on the server. Your recording was not lost.'}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setPhase('preview');
                setElapsed(0);
                setLiveTranscript('');
                setErrorMsg('');
                audioChunksRef.current = [];
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M3 12a9 9 0 1 0 9-9m0 0v6m0-6h-6" />
              </svg>
              Try again
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to materials
            </button>
          </div>
        </Motion.div>
      </div>
    );
  }


  return (
    <div className="max-w-3xl mx-auto">

      {/* ── Main card ── */}
      <Motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="bg-white rounded-[28px] shadow-xl border border-white/50 px-4 py-5 sm:px-8 sm:py-7 lg:px-10 lg:py-9 transition-all duration-300"
        style={{
          boxShadow: phase === 'recording'
            ? '0 24px 60px rgba(15,23,42,0.12), 0 0 0 2px #4f46e5, 0 0 0 6px rgba(79,70,229,0.12)'
            : '0 24px 60px rgba(15,23,42,0.08)',
        }}
      >
        {/* Title, then type + tags on one line */}
        <div className="mb-5">
          <h1
            className="text-2xl sm:text-3xl font-semibold leading-tight tracking-tight"
            style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {material.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(TYPE_LABELS[material.contentType] || material.contentType) && (
              <span className="text-sm font-medium text-slate-500">{TYPE_LABELS[material.contentType] || material.contentType}</span>
            )}
            {material.difficulty && (
              <span className={`text-xs px-3 py-1 rounded-full font-semibold capitalize ${DIFFICULTY_COLORS[material.difficulty] || 'bg-slate-600 text-white'}`}>
                {material.difficulty}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <FileText className="w-3.5 h-3.5" /> {material.wordCount || 0} words
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" /> ~{material.estimatedReadingTime || 1} min
            </span>
          </div>
        </div>

        {/* Passage */}
        <div
          className="rounded-2xl px-4 py-5 sm:px-8 sm:py-7 mb-6 transition-all duration-500"
          style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: '1.15rem',
            lineHeight: 1.95,
            color: '#0f172a',
            background: phase === 'recording' ? '#fffbeb' : '#f8fafc',
            borderLeft: `5px solid ${phase === 'recording' ? '#f59e0b' : '#4f46e5'}`,
            boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.02)',
          }}
        >
          {material.content?.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} className={i < material.content.split('\n').filter(Boolean).length - 1 ? 'mb-5' : ''}>
              {para}
            </p>
          ))}
        </div>

        {/* Live transcript during recording */}
        <AnimatePresence>
          {phase === 'recording' && liveTranscript && (
            <Motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-5"
            >
              <div className="bg-slate-50 rounded-xl px-5 py-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">What we heard so far</p>
                <p className="text-sm text-slate-700 leading-relaxed">{liveTranscript}</p>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        {/* Controls: compact floating bar fixed to the bottom of the screen */}
        <div className="h-24" aria-hidden="true" />
        {typeof document !== 'undefined' && createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[55] flex justify-center px-3 md:bottom-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-slate-100 bg-white px-2.5 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.12)] sm:gap-3 sm:px-3">
          {/* Back */}
          <button
            type="button"
            onClick={onCancel}
            disabled={phase === 'recording' && !isPaused}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
          </button>
          <span className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />

          {/* Status */}
          <div className={phase === 'recording' ? 'min-w-0 shrink-0' : 'min-w-0 flex-1'}>
            <p className={`flex items-center gap-1.5 text-sm font-bold text-slate-900 ${phase === 'recording' ? '' : 'justify-center'}`}>
              <Motion.span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: phase === 'recording' ? (isPaused ? '#f59e0b' : '#ef4444') : '#94a3b8' }}
                animate={phase === 'recording' && !isPaused
                  ? { boxShadow: ['0 0 0 0px rgba(239,68,68,0.4)', '0 0 0 6px rgba(239,68,68,0)', '0 0 0 0px rgba(239,68,68,0.4)'] }
                  : { boxShadow: '0 0 0 0px transparent' }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              {phase === 'recording' ? (isPaused ? 'Paused' : 'Listening…') : 'Ready when you are'}
            </p>
            {phase === 'recording' && (
              <p className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(elapsed)}</span>
                <span className="hidden h-3 w-px bg-slate-200 sm:block" aria-hidden="true" />
                <span className="hidden items-center gap-1 sm:flex"><Gauge className="h-3 w-3" /> {wordsPerMinute} words/min</span>
              </p>
            )}
          </div>

          {/* Waveform: only once recording has started */}
          {phase === 'recording' ? (
          <div className="flex h-10 min-w-0 flex-1 items-center justify-center gap-[3px] overflow-hidden rounded-xl bg-rose-50 px-2" aria-hidden="true">
            {FOOTER_WAVE.map((h, i) => (
              <span
                key={i}
                ref={(el) => { barRefs.current[i] = el; }}
                className="w-[3px] shrink-0 rounded-full bg-rose-400 transition-transform duration-75 ease-out"
                style={{ height: `${Math.max(55, h)}%`, opacity: isPaused ? 0.4 : 1, transform: 'scaleY(0.12)' }}
              />
            ))}
          </div>
          ) : null}

          <span className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {phase === 'recording' && (
              <button
                type="button"
                onClick={isPaused ? resumeRecording : pauseRecording}
                aria-label={isPaused ? 'Resume' : 'Pause'}
                title={isPaused ? 'Resume' : 'Pause'}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${isPaused ? 'border-green-400 text-green-600 hover:bg-green-50' : 'border-amber-400 text-amber-600 hover:bg-amber-50'}`}
              >
                {isPaused ? <Play className="w-4 h-4" fill="currentColor" /> : <Pause className="w-4 h-4" fill="currentColor" />}
              </button>
            )}

            {/* Restart: only once a recording has begun (usable while paused) */}
            {phase === 'recording' && (
              <button
                type="button"
                onClick={restartRecording}
                disabled={!isPaused}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M3 12a9 9 0 1 0 9-9m0 0v6m0-6h-6" />
                </svg>
                <span className="hidden sm:inline">Restart</span>
              </button>
            )}

            {/* Primary: Start / I'm done (icon only) */}
            {phase === 'recording' ? (
              <button
                type="button"
                onClick={finishRecording}
                aria-label="I’m done"
                title="I’m done"
                className="inline-flex h-10 w-12 items-center justify-center rounded-xl bg-red-600 text-white shadow-[0_4px_14px_rgba(220,38,38,0.35)] transition-colors hover:bg-red-700"
              >
                <Square className="w-4 h-4" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-indigo-600 px-5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(79,70,229,0.35)] transition-colors hover:bg-indigo-700"
              >
                <Mic className="w-4 h-4" /> Start
              </button>
            )}
          </div>
          </div>
          </div>,
          document.body,
        )}

        {/* Footer */}
        <div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400">
          <span className="hidden lg:inline">Tip: press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">Space</kbd> to start / stop</span>
          <span className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5" /> Your voice is only used to give you feedback — it isn’t kept
          </span>
        </div>
      </Motion.div>
    </div>
  );
};

// History view
const ReadingHistory = ({ token }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/reading-assessment/student/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setHistory(d.data || []))
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
    </div>
  );

  if (selected) {
    return (
      <ReadingScoreCard
        assessment={selected}
        material={selected.materialId}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-16">
        <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No reading assessments yet. Start your first session!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((h) => (
        <Motion.div
          key={h._id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setSelected(h)}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${
            (h.scores?.overall || 0) >= 80 ? 'bg-emerald-500' : (h.scores?.overall || 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'
          }`}>
            {h.scores?.overall || 0}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm line-clamp-1">{h.materialId?.title || 'Reading'}</p>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span>{new Date(h.createdAt).toLocaleDateString()}</span>
              <span>{h.scores?.reading_speed || 0} WPM</span>
              <span className={`px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[h.materialId?.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                {h.materialId?.difficulty || '—'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
        </Motion.div>
      ))}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

// When `topics` is given (e.g. on a topic page), keep only items the teacher
// made for that chapter/topic.
const normTopic = (v) => String(v || '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
const filterByTopics = (items, topics) => {
  const wanted = (topics || []).map(normTopic).filter(Boolean);
  if (!wanted.length) return items;
  return items.filter((x) => wanted.includes(normTopic(x.chapter)) || wanted.includes(normTopic(x.topic)));
};

const ReadingPracticePage = ({ topics, heading, subheading, onSessionChange } = {}) => {
  const token = localStorage.getItem('token');
  const [view, setView] = useState('list'); // list | session | history
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [activeTab, setActiveTab] = useState('browse'); // browse | history

  useEffect(() => {
    fetch(`${API_BASE}/api/reading-assessment/student/materials`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setMaterials(filterByTopics(d.data || [], topics)))
      .catch(() => toast.error('Failed to load reading materials'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, (topics || []).join('|')]);

  const inSession = view === 'session' && Boolean(selectedMaterial);
  useEffect(() => {
    onSessionChange?.(inSession);
  }, [inSession, onSessionChange]);
  useEffect(() => () => onSessionChange?.(false), [onSessionChange]);

  if (view === 'session' && selectedMaterial) {
    return (
      <ReadingSession
        material={selectedMaterial}
        token={token}
        onCancel={() => { setView('list'); setSelectedMaterial(null); }}
        onComplete={() => { setView('list'); setSelectedMaterial(null); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {activeTab === 'history' ? (
        /* History: Back on the left, "My History" centred */
        <div className="relative flex min-h-9 items-center justify-center">
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className="absolute left-0 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-base font-bold text-[#0d1c2e]">My History</h2>
        </div>
      ) : (
        /* Heading on the left, History on the right */
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {heading && <h2 className="text-base font-bold text-[#0d1c2e]">{heading}</h2>}
            {subheading && <p className="text-xs text-[#64748b]">{subheading}</p>}
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <Clock className="w-4 h-4" /> History
          </button>
        </div>
      )}

      {activeTab === 'browse' ? (
        <>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 h-36 animate-pulse" />
              ))}
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No reading passages yet. Ask your teacher to publish some!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {materials.map((m) => (
                <MaterialCard
                  key={m._id}
                  material={m}
                  onStart={(mat) => { setSelectedMaterial(mat); setView('session'); }}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <ReadingHistory token={token} />
      )}
    </div>
  );
};

export default ReadingPracticePage;
