'use client';

import { useState } from 'react';
import { http } from '@/lib/http';
import { useToast } from '@/lib/toast';
import { Shield, Eye, EyeOff, Loader2, Key, Smartphone, Check } from 'lucide-react';

function StrengthBar({ password }: { password: string }) {
  const score = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]
    .filter(r => r.test(password)).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-amber-400', 'bg-yellow-300', 'bg-green-400'];
  return password ? (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
            i <= score ? colors[score] : 'bg-white/10'
          }`} />
        ))}
      </div>
      <p className={`text-[11px] ${score <= 1 ? 'text-red-400' : score <= 2 ? 'text-amber-400' : 'text-green-400'}`}>
        {labels[score]}
      </p>
    </div>
  ) : null;
}

export default function SecurityPage() {
  const { toast } = useToast();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({ current: false, next: false });
  const [saving, setSaving] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaModal, setMfaModal] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'qr' | 'verify' | 'codes'>('qr');

  const handlePasswordSave = async () => {
    if (!pw.current) return toast.error('Enter your current password');
    if (pw.next.length < 8) return toast.error('New password must be at least 8 characters');
    if (pw.next !== pw.confirm) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await http('/api/profile/password', { method: 'PUT', body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password updated successfully');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update password');
    } finally { setSaving(false); }
  };

  const handleMfaOpen = async () => {
    setMfaModal(true);
    setStep('qr');
    setMfaLoading(true);
    try {
      const res = await http<{ qrUrl: string; secret: string }>('/api/profile/mfa/setup', { method: 'POST', body: JSON.stringify({}) });
      setQrUrl(res.qrUrl);
      setSecret(res.secret);
    } catch { toast.error('Failed to initiate MFA setup'); setMfaModal(false); }
    finally { setMfaLoading(false); }
  };

  const handleMfaVerify = async () => {
    if (mfaCode.length !== 6) return toast.error('Enter the 6-digit code');
    setMfaLoading(true);
    try {
      const res = await http<{ recoveryCodes: string[] }>('/api/profile/mfa/verify', { method: 'POST', body: JSON.stringify({ code: mfaCode }) });
      setRecoveryCodes(res.recoveryCodes);
      setMfaEnabled(true);
      setStep('codes');
    } catch { toast.error('Invalid code. Try again.'); }
    finally { setMfaLoading(false); }
  };

  const handleMfaDisable = async () => {
    try {
      await http('/api/profile/mfa', { method: 'DELETE' });
      setMfaEnabled(false);
      toast.success('2FA disabled');
    } catch { toast.error('Failed to disable 2FA'); }
  };

  const pwInput = (name: 'current' | 'next' | 'confirm', label: string, showKey?: 'current' | 'next') => (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-white/45 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={showKey && show[showKey] ? 'text' : 'password'}
          value={pw[name]}
          onChange={e => setPw(p => ({ ...p, [name]: e.target.value }))}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-10 text-[14px] text-white
            focus:outline-none focus:border-[#FF2E63]/60 focus:ring-2 focus:ring-[#FF2E63]/10 transition-all"
        />
        {showKey && (
          <button
            type="button"
            onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey] }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            {show[showKey] ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {name === 'next' && <StrengthBar password={pw.next} />}
    </div>
  );

  return (
    <div className="space-y-4 pb-10">
      {/* Password */}
      <div className="bg-[#141414] border border-white/[0.07] rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-[#FF2E63]" />
          <h3 className="text-[14px] font-semibold text-white">Change Password</h3>
        </div>
        <div className="space-y-4 max-w-md">
          {pwInput('current', 'Current Password', 'current')}
          {pwInput('next', 'New Password', 'next')}
          {pwInput('confirm', 'Confirm New Password')}
          <button
            onClick={handlePasswordSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF2E63] hover:bg-[#E11D48] text-[13px] text-white font-medium transition-all active:scale-95 disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* MFA */}
      <div className="bg-[#141414] border border-white/[0.07] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone size={14} className="text-[#FF2E63]" />
          <h3 className="text-[14px] font-semibold text-white">Two-Factor Authentication</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-white/60">Add an extra layer of security to your account.</p>
            <p className={`text-[12px] mt-1 font-medium ${mfaEnabled ? 'text-green-400' : 'text-white/30'}`}>
              {mfaEnabled ? '2FA is enabled' : '2FA is not enabled'}
            </p>
          </div>
          {mfaEnabled
            ? <button onClick={handleMfaDisable} className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 text-[13px] hover:bg-red-500/10 transition-all">Disable 2FA</button>
            : <button onClick={handleMfaOpen} className="px-4 py-2 rounded-xl bg-[#FF2E63] hover:bg-[#E11D48] text-white text-[13px] font-medium transition-all active:scale-95">Enable 2FA</button>
          }
        </div>
      </div>

      {/* MFA Modal */}
      {mfaModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" role="presentation" onClick={() => { setMfaModal(false); setMfaCode(''); }} />
          <div role="dialog" aria-modal="true" className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 shadow-2xl">
            {step === 'qr' && (
              <div className="space-y-4">
                <h4 className="text-[15px] font-semibold text-white">Scan QR Code</h4>
                <p className="text-[13px] text-white/50">Scan with Google Authenticator or Authy.</p>
                {mfaLoading
                  ? <div className="w-40 h-40 mx-auto bg-white/[0.06] rounded-xl animate-pulse" />
                  : qrUrl && <img src={qrUrl} alt="MFA QR Code" className="w-40 h-40 mx-auto rounded-xl bg-white p-2" />
                }
                <button onClick={() => setStep('verify')} className="w-full py-2.5 rounded-xl bg-[#FF2E63] text-white text-[13px] font-medium">I've scanned it →</button>
              </div>
            )}
            {step === 'verify' && (
              <div className="space-y-4">
                <h4 className="text-[15px] font-semibold text-white">Enter 6-digit code</h4>
                <input
                  value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  className="w-full text-center text-[24px] font-mono tracking-widest bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF2E63]/60 transition-all"
                />
                <button onClick={handleMfaVerify} disabled={mfaLoading || mfaCode.length !== 6}
                  className="w-full py-2.5 rounded-xl bg-[#FF2E63] text-white text-[13px] font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {mfaLoading ? <Loader2 size={14} className="animate-spin" /> : 'Verify & Enable'}
                </button>
              </div>
            )}
            {step === 'codes' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-400" />
                  <h4 className="text-[15px] font-semibold text-white">2FA Enabled!</h4>
                </div>
                <p className="text-[13px] text-white/50">Save these recovery codes somewhere safe.</p>
                <div className="grid grid-cols-2 gap-2">
                  {recoveryCodes.map((c, i) => (
                    <code key={i} className="bg-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] font-mono text-white/70 text-center">{c}</code>
                  ))}
                </div>
                <button onClick={() => { setMfaModal(false); setMfaCode(''); }} className="w-full py-2.5 rounded-xl bg-[#FF2E63] text-white text-[13px] font-medium">Done</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Save({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
}
