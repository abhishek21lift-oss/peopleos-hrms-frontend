'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint, Shield, MapPin, Navigation, Clock, ToggleLeft,
  ToggleRight, Save, RefreshCw, AlertTriangle, CheckCircle2,
  Smartphone, ScanFace,
} from 'lucide-react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { PremiumButton } from '@/components/premium/PremiumButton';
import { api } from '@/lib/api';

interface GymSettings {
  geofence_lat: number;
  geofence_lng: number;
  geofence_radius: number;
  enable_face_id: boolean;
  enable_touch_id: boolean;
  enable_gps: boolean;
  duplicate_window_minutes: number;
  auto_checkout: boolean;
  auto_checkout_minutes: number;
}

const DEFAULT_SETTINGS: GymSettings = {
  geofence_lat: 19.0760,
  geofence_lng: 72.8777,
  geofence_radius: 100,
  enable_face_id: true,
  enable_touch_id: true,
  enable_gps: true,
  duplicate_window_minutes: 60,
  auto_checkout: false,
  auto_checkout_minutes: 120,
};

export default function BiometricPage() {
  return (
    <Guard role="admin">
      <AppShell>
        <BiometricSettingsContent />
      </AppShell>
    </Guard>
  );
}

function BiometricSettingsContent() {
  const [settings, setSettings] = useState<GymSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    api.gymSettings.get().then((res: any) => {
      if (res) setSettings(res);
    }).catch((err) => { console.error('[biometric-settings] failed to load gym settings:', err); }).finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof GymSettings>(key: K, val: GymSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await api.gymSettings.update(settings as any) as any;
      if (res?.success) {
        setStatus({ type: 'success', msg: 'Settings saved successfully.' });
      } else {
        setStatus({ type: 'error', msg: 'Failed to save settings.' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err?.message || 'Failed to save settings.' });
    }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(145deg,#f8fafc 0%,#f1f5f9 50%,#fafafe 100%)' }}>
        <RefreshCw size={24} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg,#f8fafc 0%,#f1f5f9 50%,#fafafe 100%)' }}>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f0a1e 0%,#1a0f2e 30%,#0f172a 100%)', padding: '36px 32px 32px', borderRadius: '0 0 36px 36px' }}>
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)' }}>
          <motion.div className="absolute -top-16 -left-8 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
            animate={{ x: [0, 25, -15, 0], y: [0, -30, 10, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.div className="absolute -bottom-16 -right-8 w-72 h-72 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }}
            animate={{ x: [0, -20, 15, 0], y: [0, 20, -8, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
        <div className="relative z-10 mx-auto" style={{ maxWidth: 800 }}>
          <div className="flex items-center gap-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center w-[48px] h-[48px] rounded-[14px]"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 8px 28px rgba(99,102,241,0.3)' }}>
              <Shield size={20} color="#fff" />
            </motion.div>
            <div>
              <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="text-[24px] font-[860] tracking-[-0.03em]"
                style={{ background: 'linear-gradient(135deg,#c7d2fe,#e9d5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Biometric & Passkey Settings
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Configure WebAuthn passkey and GPS geofence settings
              </motion.p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-5 py-6 sm:px-8" style={{ maxWidth: 800 }}>
        {/* Status */}
        <AnimatePresence>
          {status && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-[13px] p-3.5 mb-5 flex items-center gap-2.5 text-[13px] font-[500]"
              style={{ background: status.type === 'success' ? '#f0fdf4' : '#fff1f2', border: `1px solid ${status.type === 'success' ? '#bbf7d0' : '#fecdd3'}`, color: status.type === 'success' ? '#166534' : '#9f1239' }}>
              {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {status.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Biometric Methods */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[22px] p-6 mb-5" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: 'rgba(99,102,241,0.10)' }}>
              <Fingerprint size={18} style={{ color: '#6366f1' }} />
            </div>
            <h2 className="text-[16px] font-[760]" style={{ color: 'rgb(15,23,42)' }}>Biometric Verification Methods</h2>
          </div>

          <div className="space-y-3">
            {[
              { key: 'enable_face_id' as const, label: 'Face ID / Face Unlock', icon: <ScanFace size={18} />, desc: 'Allow members to use Face ID (iPhone) or Face Unlock (Android)', color: '#6366f1' },
              { key: 'enable_touch_id' as const, label: 'Touch ID / Fingerprint', icon: <Fingerprint size={18} />, desc: 'Allow members to use Touch ID or fingerprint scanner', color: '#10b981' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-[14px] p-4" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ background: `${item.color}12`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[13px] font-[660]" style={{ color: 'rgb(15,23,42)' }}>{item.label}</p>
                    <p className="text-[11.5px]" style={{ color: 'rgb(148,163,184)' }}>{item.desc}</p>
                  </div>
                </div>
                <button onClick={() => update(item.key, !settings[item.key])}
                  className="flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12px] font-[600] transition-all"
                  style={{ background: settings[item.key] ? `${item.color}15` : '#e2e8f0', color: settings[item.key] ? item.color : '#94a3b8' }}>
                  {settings[item.key] ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {settings[item.key] ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* GPS Geofence */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-[22px] p-6 mb-5" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: 'rgba(245,158,11,0.10)' }}>
              <MapPin size={18} style={{ color: '#f59e0b' }} />
            </div>
            <h2 className="text-[16px] font-[760]" style={{ color: 'rgb(15,23,42)' }}>GPS Geofence</h2>
          </div>

          <div className="flex items-center justify-between rounded-[14px] p-4 mb-4" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}>
                <Navigation size={18} />
              </div>
              <div>
                <p className="text-[13px] font-[660]" style={{ color: 'rgb(15,23,42)' }}>GPS Location Verification</p>
                <p className="text-[11.5px]" style={{ color: 'rgb(148,163,184)' }}>Require GPS location within gym radius to mark attendance</p>
              </div>
            </div>
            <button onClick={() => update('enable_gps', !settings.enable_gps)}
              className="flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12px] font-[600] transition-all"
              style={{ background: settings.enable_gps ? 'rgba(245,158,11,0.15)' : '#e2e8f0', color: settings.enable_gps ? '#f59e0b' : '#94a3b8' }}>
              {settings.enable_gps ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {settings.enable_gps ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="mb-1.5 text-[11.5px] font-[620] uppercase tracking-wider" style={{ color: 'rgb(148,163,184)' }}>Latitude</p>
              <input type="number" step="any" value={settings.geofence_lat} onChange={(e) => update('geofence_lat', parseFloat(e.target.value) || 0)}
                className="w-full rounded-[11px] px-3.5 py-2.5 text-[13px] outline-none"
                style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: 'rgb(15,23,42)', fontFamily: 'inherit' }} />
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] font-[620] uppercase tracking-wider" style={{ color: 'rgb(148,163,184)' }}>Longitude</p>
              <input type="number" step="any" value={settings.geofence_lng} onChange={(e) => update('geofence_lng', parseFloat(e.target.value) || 0)}
                className="w-full rounded-[11px] px-3.5 py-2.5 text-[13px] outline-none"
                style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: 'rgb(15,23,42)', fontFamily: 'inherit' }} />
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] font-[620] uppercase tracking-wider" style={{ color: 'rgb(148,163,184)' }}>Radius (meters)</p>
              <input type="number" value={settings.geofence_radius} onChange={(e) => update('geofence_radius', parseInt(e.target.value) || 100)}
                className="w-full rounded-[11px] px-3.5 py-2.5 text-[13px] outline-none"
                style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: 'rgb(15,23,42)', fontFamily: 'inherit' }} />
            </div>
          </div>
        </motion.div>

        {/* Duplicate & Auto Checkout */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-[22px] p-6 mb-5" style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 20px rgba(0,0,0,0.07)' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: 'rgba(16,185,129,0.10)' }}>
              <Clock size={18} style={{ color: '#10b981' }} />
            </div>
            <h2 className="text-[16px] font-[760]" style={{ color: 'rgb(15,23,42)' }}>Attendance Rules</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-[14px] p-4" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <div>
                <p className="text-[13px] font-[660]" style={{ color: 'rgb(15,23,42)' }}>Duplicate Attendance Window</p>
                <p className="text-[11.5px]" style={{ color: 'rgb(148,163,184)' }}>Prevent multiple check-ins within this time (minutes)</p>
              </div>
              <input type="number" value={settings.duplicate_window_minutes} onChange={(e) => update('duplicate_window_minutes', parseInt(e.target.value) || 60)}
                className="w-20 rounded-[9px] px-3 py-2 text-[13px] font-[600] text-center outline-none"
                style={{ background: 'white', border: '1.5px solid #e2e8f0', color: 'rgb(15,23,42)', fontFamily: 'inherit' }} />
            </div>

            <div className="flex items-center justify-between rounded-[14px] p-4" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[13px] font-[660]" style={{ color: 'rgb(15,23,42)' }}>Auto Check-Out</p>
                  <p className="text-[11.5px]" style={{ color: 'rgb(148,163,184)' }}>Automatically check out members after a period</p>
                </div>
              </div>
              <button onClick={() => update('auto_checkout', !settings.auto_checkout)}
                className="flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12px] font-[600] transition-all"
                style={{ background: settings.auto_checkout ? 'rgba(16,185,129,0.15)' : '#e2e8f0', color: settings.auto_checkout ? '#10b981' : '#94a3b8' }}>
                {settings.auto_checkout ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                {settings.auto_checkout ? 'On' : 'Off'}
              </button>
            </div>

            {settings.auto_checkout && (
              <div className="flex items-center justify-between rounded-[14px] p-4" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <p className="text-[13px] font-[660]" style={{ color: 'rgb(15,23,42)' }}>Auto Check-Out After (minutes)</p>
                <input type="number" value={settings.auto_checkout_minutes} onChange={(e) => update('auto_checkout_minutes', parseInt(e.target.value) || 120)}
                  className="w-20 rounded-[9px] px-3 py-2 text-[13px] font-[600] text-center outline-none"
                  style={{ background: 'white', border: '1.5px solid #e2e8f0', color: 'rgb(15,23,42)', fontFamily: 'inherit' }} />
              </div>
            )}
          </div>
        </motion.div>

        {/* Save */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <PremiumButton tone="primary" glow icon={<Save size={14} />} onClick={handleSave} loading={saving} disabled={saving} className="w-full">
            Save Settings
          </PremiumButton>
        </motion.div>
      </div>
    </div>
  );
}
