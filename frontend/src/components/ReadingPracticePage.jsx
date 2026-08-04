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

// Animated waveform bars
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
const ReadingSession = ({ material, token, onComplete, onCancel }) => {
  const [phase, setPhase] = useState('preview'); // preview | recording | processing | results
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(500); // collect chunks every 500ms
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);
      setPhase('recording');

      // Start live timer
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        const wordsSpoken = liveTranscript.trim().split(/\s+/).filter(Boolean).length;
        if (secs > 0) setWordsPerMinute(Math.round((wordsSpoken / secs) * 60));
      }, 1000);

      startLiveSpeech();
    } catch (err) {
      toast.error('Microphone permission denied. Please allow microphone access.');
    }
  };

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

  const finishRecording = async () => {
    clearInterval(timerRef.current);
    recognitionRef.current?.stop();

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    await new Promise((resolve) => {
      recorder.onstop = resolve;
      if (recorder.state !== 'inactive') recorder.stop();
    });

    // Stop all tracks
    recorder.stream?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
    setPhase('processing');

    try {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('materialId', material._id);
      formData.append('audioDurationSeconds', String(elapsed));

      const resp = await fetch(`${API_BASE}/api/reading-assessment/student/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setAssessment(data.data);
      setPhase('results');
    } catch (err) {
      console.error(err);
      toast.error('Evaluation failed. Please try again.');
      setPhase('recording');
    }
  };

  useEffect(() => () => {
    clearInterval(timerRef.current);
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }, []);

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to materials
      </button>

      {/* Material header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${DIFFICULTY_COLORS[material.difficulty] || 'bg-gray-100 text-gray-600'}`}>
            {material.difficulty}
          </span>
          {material.subject && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">{material.subject}</span>
          )}
          {material.chapter && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{material.chapter}</span>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium">
            {TYPE_LABELS[material.contentType] || material.contentType}
          </span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{material.title}</h2>
        <div className="flex gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {material.wordCount} words</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ~{material.estimatedReadingTime} min</span>
        </div>
      </div>

      {/* Text content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Reading Passage</h3>
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-800 leading-8 text-base font-['Georgia',serif] whitespace-pre-wrap">
            {material.content}
          </p>
        </div>
      </div>

      {/* Controls */}
      <AnimatePresence mode="wait">
        {phase === 'preview' && (
          <Motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50 rounded-2xl p-6 text-center"
          >
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic className="w-7 h-7 text-indigo-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Ready to read aloud?</h3>
            <p className="text-sm text-gray-500 mb-5">Read the passage above clearly. We'll record your voice and evaluate your reading.</p>
            <button
              onClick={startRecording}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <Play className="w-5 h-5" /> Start Reading
            </button>
          </Motion.div>
        )}

        {phase === 'recording' && (
          <Motion.div
            key="recording"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 space-y-5"
          >
            {/* Status bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-sm font-semibold text-gray-700">{isPaused ? 'Paused' : 'Recording...'}</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-mono text-gray-600">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{formatTime(elapsed)}</span>
                <span className="flex items-center gap-1.5"><Gauge className="w-4 h-4" />{wordsPerMinute} WPM</span>
              </div>
            </div>

            {/* Waveform */}
            <div className="flex justify-center py-2">
              <Waveform active={isRecording && !isPaused} />
            </div>

            {/* Live transcript */}
            {liveTranscript && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Live Transcript</p>
                <p className="text-sm text-gray-700 leading-relaxed">{liveTranscript}</p>
              </div>
            )}

            {/* Control buttons */}
            <div className="flex items-center justify-center gap-3">
              {!isPaused ? (
                <button
                  onClick={pauseRecording}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 transition-colors text-sm"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              ) : (
                <button
                  onClick={resumeRecording}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-green-200 bg-green-50 text-green-700 font-medium hover:bg-green-100 transition-colors text-sm"
                >
                  <Play className="w-4 h-4" /> Resume
                </button>
              )}
              <button
                onClick={finishRecording}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors text-sm"
              >
                <Square className="w-4 h-4" /> Finish
              </button>
            </div>
          </Motion.div>
        )}

        {phase === 'processing' && (
          <Motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center"
          >
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Analysing your reading...</h3>
            <p className="text-sm text-gray-500">Transcribing audio and evaluating pronunciation, fluency, and grammar. This may take up to 60 seconds.</p>
          </Motion.div>
        )}
      </AnimatePresence>
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
