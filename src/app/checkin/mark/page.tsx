'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Fingerprint, ScanFace, Smartphone, CheckCircle2,
  XCircle, AlertTriangle, Clock, Navigation, LocateFixed,
  RefreshCw, User, LogIn, ChevronRight,
} from 'lucide-react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { PremiumButton } from '@/components/premium/PremiumButton';
import { api } from '@/lib/api';
import { isWebAuthnSupported, authenticateCredential } from '@/lib/webauthn';

type Step = 'gps' | 'biometric' | 'success' | 'error';
type VerifyMethod = 'face_id' | 'touch_id' | 'fingerprint' | 'passkey';

interface GymSettings {
  geofence_lat: number;
  geofence_lng: number;
  geofence_radius: number;
  enable_face_id: boolean;
  enable_touch_id: boolean;
  enable_gps: boolean;
  duplicate_window_minutes: number;
}

const STEP_CONFIG: Record<Step, { label: string; icon: React.ReactNode; color: string }> = {
  gps: { label: 'GPS Verification', icon: <Navigation size={20} />, color: '#6366f1' },
  biometric: { label: 'Biometric Verification', icon: <Shield size={20} />, color: '#10b981' },
  success: { label: 'Attendance Marked', icon: <CheckCircle2 size={20} />, color: '#10b981' },
  error: { label: 'Failed', icon: <XCircle size={20} />, color: '#ef4444' },
};

export default function MarkAttendancePage() {
  return (
    <Guard>
      <AppShell>
        <MarkAttendanceContent />
      </AppShell>
    </Guard>
  );
}

function MarkAttendanceContent() {
  const [step, setStep] = useState<Step>('gps');
  const [memberId, setMemberId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'checking' | 'verified' | 'denied'>('idle');
  const [webAuthnSupported, setWebAuthnSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
    const ua = navigator.userAgent;
    setDeviceName(ua.includes('iPhone') ? 'iPhone' : ua.includes('Android') ? 'Android' : ua.includes('Mac') ? 'Mac' : 'Browser');
    const stored = localStorage.getItem('619_member_context');
    if (stored) {
      try {
        const ctx = JSON.parse(stored);
        if (ctx.id) setMemberId(ctx.id);
        if (ctx.name) setMemberName(ctx.name);
      } catch {}
    }
    api.gymSettings.get().then((res: any) => setSettings(res)).catch((err) => { console.error('[mark-attendance] failed to load gym settings:', err); });
  }, []);

  const handleGPSVerify = async () => {
    if (!navigator.geolocation) {
      setErrorMsg('GPS is not available on this device.');
      setStep('error');
      return;
    }
    setGpsStatus('checking');
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setGpsStatus('verified');
        setLoading(false);
        setStep('biometric');
      },
      (err) => {
        setErrorMsg(err.code === 1 ? 'GPS permission denied. Enable location services to continue.' : 'Could not get GPS location.');
        setGpsStatus('denied');
        setStep('error');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const handleBiometricVerify = async (method: VerifyMethod) => {
    setVerifyMethod(method);
    setLoading(true);
    setErrorMsg('');
    try {
      const beginRes = await api.webauthn.authenticateBegin(memberId || undefined) as any;
      const assertion = await authenticateCredential({
        challenge: beginRes.challenge,
        allowCredentials: beginRes.allowCredentials,
        rpId: beginRes.rpId,
      });
      const verifyRes = await api.webauthn.authenticateComplete({
        credentialId: assertion.credentialId,
        rawId: assertion.rawId,
        authenticatorData: assertion.response.authenticatorData,
        signature: assertion.response.signature,
        clientDataJSON: assertion.response.clientDataJSON,
        userHandle: assertion.response.userHandle,
      }) as any;
      if (!verifyRes?.success) {
        setErrorMsg('Biometric verification failed.');
        setStep('error');
        setLoading(false);
        return;
      }
      const resolvedId = verifyRes.memberId || memberId;
      const resolvedName = verifyRes.memberName || memberName;
      if (!resolvedId) {
        setErrorMsg('Could not identify member. Please enter your Member ID.');
        setStep('error');
        setLoading(false);
        return;
      }
      const markRes = await api.biometricAttend.mark({
        memberId: resolvedId,
        verificationMethod: method === 'face_id' ? 'Face ID' : method === 'touch_id' ? 'Touch ID' : method === 'fingerprint' ? 'Fingerprint' : 'Passkey',
        deviceName,
        latitude: location?.lat ?? 0,
        longitude: location?.lng ?? 0,
      }) as any;
      if (markRes?.success) {
        setStep('success');
      } else {
        setErrorMsg(markRes?.error || 'Failed to mark attendance.');
        setStep('error');
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setErrorMsg('Biometric verification cancelled.');
      } else {
        setErrorMsg(err?.message || 'Biometric verification failed.');
      }
      setStep('error');
    }
    finally { setLoading(false); }
  };

  const handleReset = () => {
    setStep('gps');
    setGpsStatus('idle');
    setErrorMsg('');
    setVerifyMethod(null);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg,#f8fafc 0%,#f1f5f9 50%,#fafafe 100%)' }}>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f0a1e 0%,#1a2e0a 30%,#0f172a 100%)', padding: '36px 32px 32px', borderRadius: '0 0 36px 36px' }}>
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)' }}>
          <motion.div className="absolute -top-16 -left-8 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }}
            animate={{ x: [0, 25, -15, 0], y: [0, -30, 10, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.div className="absolute -bottom-16 -right-8 w-72 h-72 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
            animate={{ x: [0, -20, 15, 0], y: [0, 20, -8, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
        <div className="relative z-10 mx-auto" style={{ maxWidth: 600 }}>
          <div className="flex items-center gap-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center w-[48px] h-[48px] rounded-[14px]"
              style={{ background: 'linear-gradient(135deg,#10b981,#6366f1)', boxShadow: '0 8px 28px rgba(16,185,129,0.3)' }}>
              <LogIn size={20} color="#fff" />
            </motion.div>
            <div>
              <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="text-[24px] font-[860] tracking-[-0.03em]"
                style={{ background: 'linear-gradient(135deg,#6ee7b7,#c7d2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Mark Attendance
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                GPS + Biometric verification required
              </motion.p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-5 py-6 sm:px-8" style={{ maxWidth: 600 }}>
        {/* Step Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(['gps', 'biometric', 'success'] as Step[]).map((s, i) => {
            const cfg = STEP_CONFIG[s];
            const active = step === s || (s === 'success' && step === 'success');
            const done = step === 'success' && i < 2;
            const failed = step === 'error' && i <= ['gps', 'biometric', 'success'].indexOf(step === 'error' ? (step === 'error' ? (gpsStatus === 'denied' ? 'gps' : 'biometric') : 'success') : s);
            return (
              <React.Fragment key={s}>
                {i > 0 && <div className="h-px w-8" style={{ background: done || (step === 'success' && i <= 2) ? '#10b981' : '#e2e8f0' }} />}
                <div className="flex items-center gap-1.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-[700]"
                    style={{ background: active ? cfg.color : done ? '#10b981' : '#f1f5f9', color: active || done ? '#fff' : '#94a3b8' }}>
                    {done ? <CheckCircle2 size={12} /> : i + 1}
                  </div>
                  <span className="text-[10px] font-[600] hidden sm:inline" style={{ color: active ? cfg.color : '#94a3b8' }}>{cfg.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Member ID */}
        {!memberId && step !== 'success' && (
          <div className="rounded-[16px] p-4 mb-4 flex items-center gap-3" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
            <User size={16} style={{ color: '#94a3b8' }} />
            <input value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="Enter Member ID (optional if passkey identifies you)"
              className="flex-1 bg-transparent text-[13px] outline-none" style={{ color: 'rgb(15,23,42)', fontFamily: 'inherit' }} />
          </div>
        )}

        {/* Error */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-[13px] p-3.5 mb-4 flex items-start gap-2.5 text-[13px] font-[500]"
              style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239' }}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* Step: GPS */}
          {step === 'gps' && (
            <motion.div key="gps" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="rounded-[22px] p-6 text-center" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="flex justify-center mb-5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[20px]" style={{ background: gpsStatus === 'verified' ? 'rgba(16,185,129,0.10)' : gpsStatus === 'denied' ? 'rgba(239,68,68,0.10)' : 'rgba(99,102,241,0.10)' }}>
                    {gpsStatus === 'verified' ? <CheckCircle2 size={36} style={{ color: '#10b981' }} /> : gpsStatus === 'denied' ? <XCircle size={36} style={{ color: '#ef4444' }} /> : <LocateFixed size={36} style={{ color: '#6366f1' }} />}
                  </div>
                </motion.div>
                <h2 className="text-[18px] font-[760] mb-1" style={{ color: 'rgb(15,23,42)' }}>GPS Verification</h2>
                <p className="text-[13px] mb-6" style={{ color: 'rgb(148,163,184)' }}>We need to verify you are at the gym location.</p>
                {gpsStatus === 'verified' ? (
                  <div className="rounded-[13px] p-3 mb-4 flex items-center gap-2.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                    <span className="text-[13px] font-[500]" style={{ color: '#166534' }}>Location verified</span>
                  </div>
                ) : (
                  <PremiumButton tone="primary" glow icon={<Navigation size={14} />} onClick={handleGPSVerify} loading={loading} disabled={loading} className="w-full">
                    Verify My Location
                  </PremiumButton>
                )}
                {location && (
                  <p className="mt-3 text-[11px]" style={{ color: 'rgb(148,163,184)' }}>
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Step: Biometric */}
          {step === 'biometric' && (
            <motion.div key="biometric" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="rounded-[22px] p-6" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
                <div className="text-center mb-6">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                    className="flex justify-center mb-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[20px]" style={{ background: 'rgba(16,185,129,0.10)' }}>
                      <Shield size={36} style={{ color: '#10b981' }} />
                    </div>
                  </motion.div>
                  <h2 className="text-[18px] font-[760] mb-1" style={{ color: 'rgb(15,23,42)' }}>Biometric Verification</h2>
                  <p className="text-[13px]" style={{ color: 'rgb(148,163,184)' }}>Verify your identity using your enrolled passkey</p>
                </div>

                <div className="space-y-3">
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => handleBiometricVerify('face_id')} disabled={loading}
                    className="flex w-full items-center gap-4 rounded-[14px] p-4 text-left transition-all"
                    style={{ background: 'rgba(99,102,241,0.06)', border: '1.5px solid rgba(99,102,241,0.2)', color: 'rgb(15,23,42)', opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-[12px]" style={{ background: 'rgba(99,102,241,0.12)' }}>
                      <ScanFace size={22} style={{ color: '#6366f1' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-[680]">Face ID / Face Unlock</p>
                      <p className="text-[11.5px]" style={{ color: 'rgb(148,163,184)' }}>Use Face ID or Android Face Unlock</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#6366f1' }} />
                  </motion.button>

                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => handleBiometricVerify('touch_id')} disabled={loading}
                    className="flex w-full items-center gap-4 rounded-[14px] p-4 text-left transition-all"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1.5px solid rgba(16,185,129,0.2)', color: 'rgb(15,23,42)', opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-[12px]" style={{ background: 'rgba(16,185,129,0.12)' }}>
                      <Fingerprint size={22} style={{ color: '#10b981' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-[680]">Touch ID / Fingerprint</p>
                      <p className="text-[11.5px]" style={{ color: 'rgb(148,163,184)' }}>Use Touch ID or fingerprint scanner</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#10b981' }} />
                  </motion.button>

                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => handleBiometricVerify('passkey')} disabled={loading}
                    className="flex w-full items-center gap-4 rounded-[14px] p-4 text-left transition-all"
                    style={{ background: 'rgba(139,92,246,0.06)', border: '1.5px solid rgba(139,92,246,0.2)', color: 'rgb(15,23,42)', opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-[12px]" style={{ background: 'rgba(139,92,246,0.12)' }}>
                      <Smartphone size={22} style={{ color: '#8b5cf6' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-[680]">Device Passkey</p>
                      <p className="text-[11.5px]" style={{ color: 'rgb(148,163,184)' }}>Use your device PIN, pattern, or password</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#8b5cf6' }} />
                  </motion.button>
                </div>

                <div className="mt-4">
                  <PremiumButton tone="secondary" icon={<RefreshCw size={13} />} onClick={() => setStep('gps')} className="w-full">
                    Back to GPS
                  </PremiumButton>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="rounded-[22px] p-8 text-center" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="flex justify-center mb-5">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[24px]" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 16px 48px rgba(16,185,129,0.3)' }}>
                    <CheckCircle2 size={44} color="#fff" />
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <h2 className="text-[22px] font-[800] mb-1" style={{ color: 'rgb(15,23,42)' }}>Attendance Marked!</h2>
                  <p className="text-[14px] mb-2" style={{ color: 'rgb(148,163,184)' }}>
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-[12px] font-[600]" style={{ background: 'rgba(16,185,129,0.08)', color: '#16a34a' }}>
                    <Shield size={12} />
                    Verified via {verifyMethod === 'face_id' ? 'Face ID' : verifyMethod === 'touch_id' ? 'Touch ID' : verifyMethod === 'fingerprint' ? 'Fingerprint' : 'Passkey'}
                  </div>
                </motion.div>
                <div className="mt-6">
                  <PremiumButton tone="primary" glow icon={<RefreshCw size={14} />} onClick={handleReset}>
                    Mark Another
                  </PremiumButton>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="rounded-[22px] p-6 text-center" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="flex justify-center mb-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[20px]" style={{ background: 'rgba(239,68,68,0.10)' }}>
                    <XCircle size={36} style={{ color: '#ef4444' }} />
                  </div>
                </motion.div>
                <h2 className="text-[18px] font-[760] mb-1" style={{ color: 'rgb(15,23,42)' }}>Attendance Not Marked</h2>
                <PremiumButton tone="primary" glow icon={<RefreshCw size={14} />} onClick={handleReset} className="mt-5">
                  Try Again
                </PremiumButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info */}
        <div className="mt-5 rounded-[14px] p-4 text-[12px] leading-relaxed" style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)', color: 'rgb(100,116,139)' }}>
          <strong style={{ color: '#6366f1' }}>How it works:</strong>
          <ol className="mt-1.5 ml-4 space-y-0.5 list-decimal">
            <li>Your GPS location is checked against the gym geofence</li>
            <li>You verify using your enrolled passkey (Face ID / Touch ID / Fingerprint)</li>
            <li>Attendance is recorded with timestamp and verification method</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
