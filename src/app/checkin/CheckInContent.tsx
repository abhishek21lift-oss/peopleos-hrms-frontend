'use client';
/**
 * CheckInContent — the actual face check-in UI.
 *
 * This file is dynamically imported with ssr:false from checkin/page.tsx.
 * That ensures @tensorflow/tfjs and face-api.js are excluded from the
 * SSR/static bundle entirely and only load when this page is visited.
 *
 * Flow: Load models → Start camera → Detect face → Blink anti-spoof
 *        → Recognize → POST to /api/checkin/face → Show result
 * Fallback: Manual name/mobile search → mark attendance via API
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppShell from '@/components/AppShell';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useAntiSpoof } from '@/hooks/useAntiSpoof';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import {
  Camera, ScanFace, User, Search, CheckCircle2, XCircle,
  Loader2, RefreshCw, AlertTriangle, Clock, Volume2, VolumeX,
  Wifi, WifiOff,
} from 'lucide-react';
import type { CheckInState, CheckInResult, DetectionResult } from '@/types/checkin';

type RecentRow = {
  id: string; name: string; time: string;
  status: 'success' | 'manual' | 'failed';
  memberId?: string; membershipStatus?: string;
};

const STATUS_CFG: Record<CheckInState, { color: string; label: string; Icon: any }> = {
  idle:          { color: '#94a3b8', label: 'Idle',             Icon: ScanFace },
  loading:       { color: '#6366f1', label: 'Loading models…',  Icon: Loader2 },
  ready:         { color: '#6366f1', label: 'Scanning',         Icon: ScanFace },
  liveness:      { color: '#f59e0b', label: 'Please blink',     Icon: User },
  recognizing:   { color: '#3b82f6', label: 'Recognizing…',    Icon: Loader2 },
  checking_in:   { color: '#3b82f6', label: 'Checking in…',    Icon: Loader2 },
  success:       { color: '#22c55e', label: 'Check-in OK',      Icon: CheckCircle2 },
  fail_unknown:  { color: '#ef4444', label: 'Not recognized',   Icon: XCircle },
  fail_expired:  { color: '#ef4444', label: 'Membership issue', Icon: AlertTriangle },
  fail_multiple: { color: '#f59e0b', label: 'One person only',  Icon: AlertTriangle },
  no_permission: { color: '#ef4444', label: 'Camera blocked',   Icon: Camera },
  error:         { color: '#ef4444', label: 'Error',            Icon: XCircle },
};

const CARD = {
  background: '#ffffff',
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.04)',
} as const;

export default function CheckInContent() {
  const camera    = useCamera();
  const detection = useFaceDetection();
  const { modelStatus, startDetectionLoop, stopDetectionLoop } = detection;
  const antiSpoof = useAntiSpoof();
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const cooldownRef = useRef<number>(0);
  const autoRetryRef= useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryFnRef = useRef<() => void>(() => {});

  const [state,      setState]      = useState<CheckInState>('idle');
  const [statusMsg,  setStatusMsg]  = useState('Starting…');
  const [result,     setResult]     = useState<CheckInResult | null>(null);
  const [voiceOn,    setVoiceOn]    = useState(true);
  const [recents,    setRecents]    = useState<RecentRow[]>([]);
  const [search,     setSearch]     = useState('');
  const [clients,    setClients]    = useState<any[]>([]);
  const [manualBusy, setManualBusy] = useState(false);
  const [isOnline,   setIsOnline]   = useState(true);

  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch {}
  }, [voiceOn]);

  const pushRecent = useCallback((row: RecentRow) => {
    setRecents((prev) => {
      const next = [row, ...prev].slice(0, 30);
      return next;
    });
  }, []);

  useEffect(() => {
    api.clients.list({ status: 'active', limit: 500 })
      .then((r: any) => setClients(Array.isArray(r) ? r : (r?.clients ?? [])))
      .catch((err) => console.error('[checkin] failed to load clients', err));
  }, []);

  const runRecognition = useCallback(async (descriptor: Float32Array) => {
    setState('checking_in'); setStatusMsg('Verifying…');
    try {
      const data = await api.checkin.face(Array.from(descriptor));
      if (!data.success) {
        setResult({ success: false, message: data.error || 'Not recognized' });
        setState('fail_unknown'); setStatusMsg('Not recognized — try again');
        speak('Face not recognized');
        pushRecent({ id: crypto.randomUUID(), name: 'Unknown', time: nowTime(), status: 'failed' });
      } else {
        const ms = (data.member?.status || 'active').toLowerCase();
        const ok = ms === 'active';
        setResult({
          success: ok,
          message: ok ? `Welcome, ${data.member!.name}!` : `Membership ${ms}`,
          clientId: data.member!.id,
          clientName: data.member!.name,
          membershipStatus: ms as any,
        });
        setState(ok ? 'success' : 'fail_expired');
        setStatusMsg(ok ? `Welcome ${data.member!.name}` : `Membership ${ms}`);
        speak(ok ? `Welcome, ${data.member!.name}` : `Membership ${ms}. Please contact reception.`);
        pushRecent({
          id: crypto.randomUUID(), name: data.member!.name,
          time: nowTime(), status: ok ? 'success' : 'failed',
          memberId: data.member!.id, membershipStatus: ms,
        });
      }
    } catch {
      setResult({ success: false, message: 'Network error' });
      setState('error'); setStatusMsg('Network error');
      speak('Network error');
    }
    if (autoRetryRef.current) clearTimeout(autoRetryRef.current);
    autoRetryRef.current = setTimeout(() => retryFnRef.current(), 6000);
  }, [speak, pushRecent]);

  const handleDetection = useCallback((d: DetectionResult) => {
    if (Date.now() < cooldownRef.current) return;
    if (!d.detected) {
      if (state === 'ready' || state === 'liveness')
        setStatusMsg('Position your face in the guide');
      return;
    }
    if (d.multipleFaces) {
      setState('fail_multiple'); setStatusMsg('One person at a time');
      cooldownRef.current = Date.now() + 2500;
      return;
    }
    if (d.landmarks) antiSpoof.processFaceLandmarks(d.landmarks);
    if (!antiSpoof.blinkDetected) {
      setState('liveness'); setStatusMsg('Please blink once to verify');
      return;
    }
    if (state !== 'recognizing' && state !== 'checking_in' && d.descriptor) {
      setState('recognizing'); setStatusMsg('Analyzing face…');
      cooldownRef.current = Date.now() + 5000;
      void runRecognition(d.descriptor);
    }
  }, [state, antiSpoof, runRecognition]);

  const retry = useCallback(() => {
    if (autoRetryRef.current) clearTimeout(autoRetryRef.current);
    antiSpoof.reset(); cooldownRef.current = 0; setResult(null);
    setState(camera.status === 'active' ? 'ready' : 'idle');
    setStatusMsg(
      camera.status === 'active'
        ? 'Position your face in the guide'
        : 'Starting camera…'
    );
  }, [antiSpoof, camera.status]);

  useEffect(() => { retryFnRef.current = retry; }, [retry]);

  // Init: load models then start camera
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading'); setStatusMsg('Loading face recognition models…');
      const ok = await detection.loadModels();
      if (cancelled) return;
      if (!ok) {
        setState('error');
        setStatusMsg('Could not load models — check /public/models/');
        return;
      }
      setStatusMsg('Starting camera…');
      const camOk = await camera.start();
      if (cancelled) return;
      if (!camOk) {
        setState('no_permission');
        setStatusMsg(camera.error || 'Camera unavailable');
        return;
      }
      setState('ready'); setStatusMsg('Position your face in the guide');
    })();
    return () => {
      cancelled = true;
      detection.stopDetectionLoop(); camera.stop();
      if (autoRetryRef.current) clearTimeout(autoRetryRef.current);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (camera.status !== 'active' || modelStatus !== 'ready') return;
    if (!camera.videoRef.current || !canvasRef.current) return;
    startDetectionLoop(
      camera.videoRef.current, canvasRef.current, handleDetection
    );
    return () => stopDetectionLoop();
  }, [camera.status, camera.videoRef, handleDetection, modelStatus, startDetectionLoop, stopDetectionLoop]);

  const manualCheckIn = async (client: any) => {
    setManualBusy(true); setSearch('');
    try {
      await api.attendance.mark({
        type: 'client', ref_id: client.id, ref_name: client.name,
        date: new Date().toISOString().split('T')[0],
        check_in: nowTime(), status: 'present', notes: 'manual',
      });
      pushRecent({
        id: crypto.randomUUID(), name: client.name,
        time: nowTime(), status: 'manual', memberId: client.id,
      });
      speak(`${client.name} checked in`);
    } catch {}
    setManualBusy(false);
  };

  const searchResults = search.trim()
    ? clients.filter((c) => {
        const q = search.toLowerCase();
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.mobile || '').includes(q) ||
          (c.member_code || '').toLowerCase().includes(q)
        );
      }).slice(0, 6)
    : [];

  const sc = STATUS_CFG[state];
  const StatusIcon = sc.Icon;
  const isSpinning = ['loading', 'recognizing', 'checking_in'].includes(state);
  const isSuccess  = state === 'success';
  const isError    = ['fail_unknown','fail_expired','fail_multiple','no_permission','error'].includes(state);
  const showRetry  = isSuccess || isError;

  const camGuideColor =
    state === 'liveness'    ? '#f59e0b' :
    state === 'recognizing' ? '#3b82f6' :
    state === 'checking_in' ? '#6366f1' :
    state === 'success'     ? '#22c55e' :
    isError                 ? '#ef4444' :
    'rgba(255,255,255,0.35)';

  const showScanLine = state === 'ready' || state === 'recognizing';
  const showGuide = state === 'ready' || state === 'liveness' || state === 'recognizing';

  return (
    <AppShell>
      <style>{`
        @keyframes ck-spin { to { transform: rotate(360deg); } }
        @keyframes ck-scan { 0% { top: 16px; } 100% { top: calc(100% - 16px); } }
        @keyframes ck-float1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,-20px) scale(1.08); } }
        @keyframes ck-float2 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-40px) scale(1.12); } 66% { transform: translate(-20px,10px) scale(0.95); } }
        @keyframes ck-float3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,30px) scale(1.06); } }
        @keyframes ck-pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.3); } 100% { box-shadow: 0 0 0 20px rgba(99,102,241,0); } }
        @keyframes ck-guide-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>

      {/* ── Premium Dark Hero ── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1440 40%, #1e1b4b 70%, #1e40af 100%)',
        marginBottom: 20,
      }}>
        {/* Top accent bar */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, #6366f1, #a78bfa, #22d3ee, #6366f1)',
          backgroundSize: '200% 100%',
        }} />

        {/* Animated orbs */}
        <div style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', width: 320, height: 320, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
            top: -120, right: -60,
            animation: 'ck-float1 8s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', width: 240, height: 240, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
            bottom: -80, left: -40,
            animation: 'ck-float2 10s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', width: 180, height: 180, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)',
            top: 10, left: '40%',
            animation: 'ck-float3 7s ease-in-out infinite',
          }} />
        </div>

        {/* Content row */}
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '20px 24px',
        }}>
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #e0e7ff 0%, #a78bfa 40%, #22d3ee 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0,
              }}
            >
              Face Check-In
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{
                margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{
                display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                background: '#22d3ee',
              }} />
              Live recognition · {fmtDate(new Date())}
            </motion.p>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 100,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: isOnline ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${isOnline ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: isOnline ? '#10b981' : '#ef4444',
              }}
            >
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: isOnline ? '#10b981' : '#ef4444',
              }} />
              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              {isOnline ? 'Online' : 'Offline'}
            </motion.span>

            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setVoiceOn(v => !v)}
              title="Toggle voice"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: voiceOn ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                color: voiceOn ? '#a78bfa' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer', transition: 'all 0.2s',
                outline: 'none',
              }}
            >
              {voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </motion.button>

            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 100,
                fontSize: 10, fontWeight: 700,
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#a78bfa',
              }}
            >
              <Clock size={10} />
              {recents.length} today
            </motion.span>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Two Columns ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* ═══ Left: Camera Card ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            ...CARD,
            overflow: 'hidden',
          }}
        >
          {/* Camera area */}
          <div style={{
            position: 'relative', width: '100%',
            aspectRatio: '4 / 3',
            background: '#0f172a',
            overflow: 'hidden',
          }}>
            <video
              ref={camera.videoRef}
              autoPlay playsInline muted
              aria-label="Camera feed for face recognition check-in"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
              }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
              }}
            />

            {/* Color overlay for success/error states */}
            <div style={{
              position: 'absolute', inset: 0,
              pointerEvents: 'none',
              transition: 'background 0.4s ease',
              background: isSuccess
                ? 'rgba(34,197,94,0.12)'
                : isError ? 'rgba(239,68,68,0.12)' : 'transparent',
            }} />

            {/* Face guide ring */}
            {showGuide && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 220, height: 220,
                  borderRadius: '50%',
                  border: `2.5px solid ${camGuideColor}`,
                  pointerEvents: 'none',
                  animation: 'ck-guide-pulse 2s ease-in-out infinite',
                  boxShadow: `0 0 30px ${camGuideColor}20, inset 0 0 30px ${camGuideColor}08`,
                }}
              />
            )}

            {/* Scanning line */}
            {showScanLine && (
              <div style={{
                position: 'absolute', left: '10%', right: '10%',
                height: 2,
                background: 'linear-gradient(90deg, transparent, #6366f1, #a78bfa, #6366f1, transparent)',
                pointerEvents: 'none',
                animation: 'ck-scan 2.2s ease-in-out infinite',
                boxShadow: '0 0 12px rgba(99,102,241,0.4)',
                borderRadius: 1,
              }} />
            )}

            {/* Status pill */}
            <div style={{
              position: 'absolute', bottom: 14, left: '50%',
              transform: 'translateX(-50%)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 100,
              background: 'rgba(15,23,42,0.75)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: sc.color,
              fontSize: 11, fontWeight: 600,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              zIndex: 5,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: sc.color,
                flexShrink: 0,
              }} />
              <StatusIcon
                size={11}
                style={isSpinning ? { animation: 'ck-spin 0.9s linear infinite' } : {}}
              />
              <span>{sc.label}</span>
            </div>
          </div>

          {/* Status message bar */}
          <div
            role="status" aria-live="polite"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px',
              background: sc.color + '12',
              borderBottom: `1px solid ${sc.color}20`,
              fontSize: 12, fontWeight: 500, color: sc.color,
            }}
          >
            <StatusIcon
              size={13}
              style={isSpinning ? { animation: 'ck-spin 0.9s linear infinite' } : {}}
            />
            {statusMsg}
          </div>

          {/* Result display */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  padding: '14px 20px',
                  background: isSuccess ? '#f0fdf4' : '#fef2f2',
                  borderBottom: `1px solid ${isSuccess ? '#86efac' : '#fecaca'}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: isSuccess ? '#10b981' : '#ef4444',
                  color: '#fff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                  boxShadow: `0 0 0 4px ${isSuccess ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                }}>
                  {isSuccess ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                    {result.clientName || result.message}
                  </div>
                  {result.clientName && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                      {result.message}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div style={{ padding: '12px 20px', display: 'flex', gap: 10 }}>
            {showRetry && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={retry}
                style={{
                  flex: 1,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  border: 'none',
                  fontSize: 12, fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                  outline: 'none',
                }}
              >
                <RefreshCw size={13} /> Retry scan
              </motion.button>
            )}
            {state === 'no_permission' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => camera.start()}
                style={{
                  flex: 1,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  border: 'none',
                  fontSize: 12, fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                  outline: 'none',
                }}
              >
                <Camera size={13} /> Enable camera
              </motion.button>
            )}
          </div>

          {/* Privacy notice */}
          <div style={{
            padding: '0 20px 12px', fontSize: 11,
            color: '#64748b',
            display: 'flex', gap: 5, alignItems: 'center',
          }}>
            <AlertTriangle size={10} />
            Only face descriptors are transmitted — no images or video.
          </div>
        </motion.div>

        {/* ═══ Right Panel Column ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Manual Check-In Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={CARD}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <span style={{
                fontSize: 13, fontWeight: 600, color: '#0f172a',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Search size={13} color="#6366f1" /> Manual Check-In
              </span>
            </div>
            <div style={{ padding: '12px 14px' }}>
              {/* Search input */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                minWidth: 0,
              }}>
                <Search size={13} color="#94a3b8" style={{ flexShrink: 0 }} />
                <input
                  placeholder="Name, ID, or mobile…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    background: 'transparent',
                    fontSize: 12, color: '#0f172a',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Search results */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {searchResults.map((c, idx) => (
                      <motion.button
                        key={c.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.03 }}
                        onClick={() => manualCheckIn(c)}
                        disabled={manualBusy}
                        whileHover={{ scale: 1.01, background: '#f8fafc' }}
                        whileTap={{ scale: 0.99 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 10,
                          width: '100%',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          cursor: 'pointer', textAlign: 'left', fontSize: 13,
                          transition: 'all 0.15s',
                          outline: 'none',
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(99,102,241,0.12)',
                          color: '#6366f1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                        }}>
                          {(c.name || '').slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 500, color: '#0f172a',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontSize: 12,
                          }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {c.member_code || c.client_id}
                          </div>
                        </div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '2px 8px', borderRadius: 100,
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                          ...(
                            (c.status || 'active') === 'active'
                              ? { background: '#f0fdf4', color: '#10b981', border: '1px solid #86efac' }
                              : (c.status || '') === 'expired'
                              ? { background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }
                              : (c.status || '') === 'frozen'
                              ? { background: '#fffbeb', color: '#f59e0b', border: '1px solid #fde68a' }
                              : { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }
                          ),
                        }}>
                          {c.status}
                        </span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading state */}
              <AnimatePresence>
                {manualBusy && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      fontSize: 12, color: '#64748b',
                      marginTop: 8, display: 'flex', gap: 6, alignItems: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <Loader2 size={12} style={{ animation: 'ck-spin 0.9s linear infinite' }} />
                    Checking in…
                  </motion.div>
                )}
              </AnimatePresence>

              {/* No results hint */}
              {search.trim() && searchResults.length === 0 && !manualBusy && (
                <div style={{
                  fontSize: 11, color: '#94a3b8',
                  marginTop: 10, textAlign: 'center',
                  padding: '8px 0',
                }}>
                  No members found
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Recent Check-ins Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={CARD}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <span style={{
                fontSize: 13, fontWeight: 600, color: '#0f172a',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Clock size={13} color="#6366f1" /> Recent Check-ins
              </span>
              {recents.length > 0 && (
                <button
                  onClick={() => setRecents([])}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '3px 10px', borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    fontSize: 10, fontWeight: 600, color: '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    outline: 'none',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {recents.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center',
                  padding: '36px 16px',
                  color: '#94a3b8',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: 'rgba(99,102,241,0.08)',
                    color: '#6366f1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 10,
                  }}>
                    <ScanFace size={18} />
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    No check-ins recorded yet today
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {recents.map((r) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0, padding: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px',
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background:
                          r.status === 'success' ? '#10b981' :
                          r.status === 'failed'  ? '#ef4444' :
                          '#6366f1',
                        color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                        boxShadow: `0 0 0 3px ${
                          r.status === 'success' ? 'rgba(16,185,129,0.15)' :
                          r.status === 'failed'  ? 'rgba(239,68,68,0.15)' :
                          'rgba(99,102,241,0.15)'
                        }`,
                      }}>
                        {r.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 500, fontSize: 12, color: '#0f172a',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {r.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {r.time}
                        </div>
                      </div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '2px 8px', borderRadius: 100,
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                        ...(
                          r.status === 'success'
                            ? { background: '#f0fdf4', color: '#10b981', border: '1px solid #86efac' }
                            : r.status === 'failed'
                            ? { background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }
                            : { background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }
                        ),
                      }}>
                        {r.status}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
