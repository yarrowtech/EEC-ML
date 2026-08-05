import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  easy: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

const TYPE_LABELS = {
  story: 'Story',
  paragraph: 'Paragraph',
  poem: 'Poem',
  article: 'Article',
  dialogue: 'Dialogue',
};

// Animated bar visualizer (matches the HTML design)
const BarVisualizer = ({ active, color = '#4f46e5' }) => {
  const delays = [0, 0.15, 0.3, 0.45, 0.6, 0.75];
  return (
    <div className="flex items-end gap-1" style={{ height: 28 }}>
      {delays.map((delay, i) => (
        <Motion.span
          key={i}
          style={{
            display: 'inline-block',
            width: 4,
            borderRadius: 4,
            background: active ? '#f59e0b' : color,
            transformOrigin: 'bottom',
          }}
          animate={active
            ? { scaleY: [0.15, 0.95, 0.5, 0.15], height: 28 }
            : { scaleY: 0.2, height: 28 }}
          transition={active ? {
            duration: 0.9,
            repeat: Infinity,
            repeatType: 'mirror',
            delay,
            ease: 'easeInOut',
          } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
};

// Legacy waveform kept for history display
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
      <div className="flex flex-wrap gap-2">
        {material.difficulty && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[material.difficulty]}`}>
            {material.difficulty}
          </span>
        )}
        {material.subject && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
            {material.subject}
          </span>
        )}
        {material.chapter && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {material.chapter}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> {material.wordCount || 0} words
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> ~{material.estimatedReadingTime || 1} min
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
      setLiveTranscript((prev) => (prev + final).slice(-600) + interim);
    };
    rec.start();
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
      startTimeRef.current = Date.now();
      setIsPaused(false);
      setElapsed(0);
      setPhase('recording');

      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        const wordsSpoken = liveTranscript.trim().split(/\s+/).filter(Boolean).length;
        if (secs > 0) setWordsPerMinute(Math.round((wordsSpoken / secs) * 60));
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
  }, [startLiveSpeech, liveTranscript]);

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
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
    recognitionRef.current?.stop();

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
  }, [material, token, elapsed]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    recognitionRef.current?.stop();
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
      <div className="max-w-3xl mx-auto flex items-center justify-center min-h-64">
        <Motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl border border-white/50 p-12 text-center w-full"
        >
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Analysing your reading…</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Transcribing audio and evaluating pronunciation, fluency, and grammar. This may take up to 60 seconds.
          </p>
        </Motion.div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center min-h-64">
        <Motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl border border-red-100 p-12 text-center w-full"
        >
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Evaluation failed</h3>
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

  const isActive = phase === 'recording' && !isPaused;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Back to materials
      </button>

      {/* ── Main card ── */}
      <Motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="bg-white rounded-[28px] shadow-xl border border-white/50 px-10 py-9 transition-all duration-300"
        style={{
          boxShadow: phase === 'recording'
            ? '0 24px 60px rgba(15,23,42,0.12), 0 0 0 2px #4f46e5, 0 0 0 6px rgba(79,70,229,0.12)'
            : '0 24px 60px rgba(15,23,42,0.08)',
        }}
      >
        {/* Top row: chip + meta */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600 bg-indigo-100/80 px-4 py-1.5 rounded-full border border-indigo-100">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block" />
            Read aloud
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <FileText className="w-3.5 h-3.5" /> {material.wordCount || 0} words
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" /> ~{material.estimatedReadingTime || 1} min
            </span>
            {material.difficulty && (
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${DIFFICULTY_COLORS[material.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                {material.difficulty}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="mb-5">
          <h1
            className="text-3xl font-semibold leading-tight tracking-tight"
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
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <span>{TYPE_LABELS[material.contentType] || material.contentType}</span>
            {material.subject && <><span className="opacity-30">·</span><span>{material.subject}</span></>}
            {material.chapter && <><span className="opacity-30">·</span><span className="text-slate-400">{material.chapter}</span></>}
          </p>
        </div>

        {/* Passage */}
        <div
          className="rounded-2xl px-8 py-7 mb-7 transition-all duration-500"
          style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: '1.08rem',
            lineHeight: 1.9,
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
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Live Transcript</p>
                <p className="text-sm text-slate-700 leading-relaxed">{liveTranscript}</p>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Status + visualizer */}
          <div className="flex items-center gap-3">
            {/* Status dot */}
            <Motion.span
              className="inline-block w-3.5 h-3.5 rounded-full shrink-0"
              style={{
                background: phase === 'recording'
                  ? (isPaused ? '#f59e0b' : '#ef4444')
                  : '#94a3b8',
              }}
              animate={phase === 'recording' && !isPaused
                ? { boxShadow: ['0 0 0 0px rgba(239,68,68,0.4)', '0 0 0 8px rgba(239,68,68,0)', '0 0 0 0px rgba(239,68,68,0.4)'] }
                : { boxShadow: '0 0 0 0px transparent' }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Status text */}
            <span className="text-sm font-medium text-slate-600">
              {phase === 'recording'
                ? isPaused
                  ? <><strong className="text-slate-800">Paused</strong> — {formatTime(elapsed)}</>
                  : <><strong className="text-slate-800">Recording</strong> — speak clearly · {formatTime(elapsed)} · {wordsPerMinute} WPM</>
                : <><strong className="text-slate-800">Ready</strong> to read</>
              }
            </span>

            {/* Bar visualizer */}
            <div aria-hidden="true">
              <BarVisualizer active={isActive} />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Pause / Resume (only during recording) */}
            <AnimatePresence>
              {phase === 'recording' && (
                <Motion.button
                  key="pause-resume"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all hover:-translate-y-0.5 ${
                    isPaused
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Motion.button>
              )}
            </AnimatePresence>

            {/* Reset (disabled while recording) */}
            <button
              onClick={() => { setPhase('preview'); setElapsed(0); setLiveTranscript(''); setAssessment(null); }}
              disabled={phase === 'recording' && !isPaused}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M3 12a9 9 0 1 0 9-9m0 0v6m0-6h-6" />
              </svg>
              Reset
            </button>

            {/* Primary: Start / Finish */}
            <Motion.button
              whileHover={{ y: -2 }}
              whileTap={{ y: 0 }}
              onClick={phase === 'recording' ? finishRecording : startRecording}
              className="flex items-center gap-2 px-7 py-2.5 rounded-full text-sm font-semibold text-white transition-all"
              style={{
                background: phase === 'recording'
                  ? 'linear-gradient(135deg, #dc2626, #ef4444)'
                  : 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
                boxShadow: phase === 'recording'
                  ? '0 4px 20px rgba(239,68,68,0.4)'
                  : '0 4px 20px rgba(79,70,229,0.35)',
              }}
            >
              {phase === 'recording' ? (
                <>
                  <Square className="w-4 h-4" />
                  Finish Reading
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Start Reading
                </>
              )}
            </Motion.button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400">
          <span>Read clearly · Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">Space</kbd> to start / stop</span>
          <span className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5" /> Audio is analysed by AI — not stored permanently
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

const ReadingPracticePage = () => {
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
      .then((d) => setMaterials(d.data || []))
      .catch(() => toast.error('Failed to load reading materials'))
      .finally(() => setLoading(false));
  }, [token]);

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
      {/* Sub-tab: Browse / History */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {['browse', 'history'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
              activeTab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'browse' ? 'Browse Passages' : 'My History'}
          </button>
        ))}
      </div>

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
