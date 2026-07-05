'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail } from 'lucide-react';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  // Redirect already-authenticated users away from the login page.
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'trainer') router.replace('/trainer/dashboard');
      else if (user.role === 'member') router.replace('/member/dashboard');
      else router.replace('/pt-os');
    }
  }, [user, loading, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) return setError('Email is required.');
    if (!password)     return setError('Password is required.');
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  // Always render the login form — no spinner gate.
  // Authenticated users are redirected away by the effect above.
  return (
    <div className="min-h-screen bg-[#f0efed] flex overflow-hidden relative font-['Inter',sans-serif]">

      {/* ── Concrete Texture Overlay ── */}
      <div
        className="absolute inset-0 opacity-[0.35] mix-blend-multiply pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '300px 300px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#e8e7e3] via-transparent to-[#d8d7d3] opacity-40 pointer-events-none" />

      {/* ── Bottom Left Paint Brush Stroke ── */}
      <div className="absolute bottom-0 left-0 pointer-events-none select-none">
        <svg width="380" height="320" viewBox="0 0 380 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 280 C60 260 100 200 140 180 C180 160 200 100 240 80 C280 60 320 20 350 0 L380 0 L380 320 L0 320 Z"
            fill="#DC2626" opacity="0.85" />
          <path d="M0 300 C40 280 80 240 120 220 C160 200 180 150 220 130 C260 110 290 80 320 60 L380 30 L380 320 L0 320 Z"
            fill="#1A1A1A" opacity="0.75" />
          <path d="M0 310 C30 295 60 270 90 255 C120 240 140 200 170 180 C200 160 230 130 260 110 L380 60 L380 320 L0 320 Z"
            fill="#DC2626" opacity="0.6" />
        </svg>
      </div>

      {/* ── Right Side Deer Silhouette Watermark ── */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-[0.07]">
        <svg width="400" height="600" viewBox="0 0 400 600" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="
            M200 40 C180 40 160 55 150 75
            C140 95 130 100 110 110
            C90 120 70 145 65 170
            C60 195 55 210 45 225
            C35 240 20 260 15 285
            C10 310 5 340 5 370
            C5 400 10 420 20 435
            C30 450 45 460 60 475
            C75 490 85 510 100 520
            C115 530 130 535 150 540
            C170 545 190 550 200 555
            C210 550 230 545 250 540
            C270 535 285 530 300 520
            C315 510 325 490 340 475
            C355 460 370 450 380 435
            C390 420 395 400 395 370
            C395 340 390 310 385 285
            C380 260 365 240 355 225
            C345 210 340 195 335 170
            C330 145 310 120 290 110
            C270 100 260 95 250 75
            C240 55 220 40 200 40 Z
          " fill="#1A1A1A" />
          <path d="
            M120 100 C110 70 105 40 115 10
            C120 -5 135 -10 150 -5
            C165 0 175 15 170 35
            C165 55 155 70 150 80
          " fill="#1A1A1A" />
          <path d="
            M280 100 C290 70 295 40 285 10
            C280 -5 265 -10 250 -5
            C235 0 225 15 230 35
            C235 55 245 70 250 80
          " fill="#1A1A1A" />
          <path d="
            M100 70 C90 40 80 15 70 0
            C65 -8 75 -12 85 -5
            C95 2 110 15 115 35
          " fill="#1A1A1A" />
          <path d="
            M300 70 C310 40 320 15 330 0
            C335 -8 325 -12 315 -5
            C305 2 290 15 285 35
          " fill="#1A1A1A" />
        </svg>
      </div>

      {/* ── Main Content ── */}
      <div className="relative z-10 flex w-full items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >

          {/* ── Login Card ── */}
          <div className="relative bg-white rounded-[20px] border border-[#DC2626]/20 shadow-[0_8px_40px_rgba(0,0,0,0.08),0_2px_8px_rgba(220,38,38,0.06)] overflow-hidden dark:bg-[#1E1F24]">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#DC2626] via-[#B91C1C] to-[#DC2626] opacity-80" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-[#DC2626]/10" />

            <div className="px-8 py-10 sm:px-10 sm:py-12">

              {/* ── Logo & Brand ── */}
              <div className="flex flex-col items-center mb-8">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-5"
                >
                  <ShieldLogo size={88} />
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="text-[22px] font-bold text-[#1A1A1A] tracking-[0.15em] uppercase dark:text-white"
                >
                  619 FITNESS{' '}
                  <span className="text-[#DC2626]">STUDIO</span>
                </motion.h1>
              </div>

              {/* ── Error ── */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2.5 rounded-[12px] bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-[13px] font-medium text-[#DC2626] mb-5"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#DC2626]/15 text-[9px] font-bold text-[#DC2626]">!</span>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Form ── */}
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4A4A4A] mb-1.5 uppercase tracking-[0.08em]">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="your@email.com"
                      required
                      className="w-full h-[50px] pl-4 pr-11 rounded-[12px] bg-[#F9F9F9] border border-[#E5E5E5] text-[14px] text-[#1A1A1A] outline-none transition-all duration-200 placeholder:text-[var(--text-disabled)]/70 focus:border-[#DC2626]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(220,38,38,0.06)] dark:bg-[#2A2B30] dark:border-[var(--border)] dark:text-[var(--text-primary)] dark:focus:bg-[#1E1F24]"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] pointer-events-none">
                      <Mail size={18} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#4A4A4A] mb-1.5 uppercase tracking-[0.08em] dark:text-[var(--text-muted)]">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••••"
                      required
                      className="w-full h-[50px] pl-4 pr-11 rounded-[12px] bg-[#F9F9F9] border border-[#E5E5E5] text-[14px] text-[#1A1A1A] outline-none transition-all duration-200 placeholder:text-[var(--text-disabled)]/70 focus:border-[#DC2626]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(220,38,38,0.06)] dark:bg-[#2A2B30] dark:border-[var(--border)] dark:text-[var(--text-primary)] dark:focus:bg-[#1E1F24]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] hover:text-[#6B7280] transition-colors"
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={busy}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full h-[50px] rounded-[12px] bg-[#DC2626] text-white text-[15px] font-bold tracking-[0.04em] overflow-hidden transition-all duration-200 shadow-[0_4px_16px_rgba(220,38,38,0.25)] hover:shadow-[0_8px_28px_rgba(220,38,38,0.35)] hover:bg-[#B91C1C] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <span className="relative flex items-center justify-center gap-2">
                    {busy ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-[2px] border-white/30 border-t-white animate-spin" />
                        Signing in&hellip;
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </span>
                </motion.button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-[12px] text-[#6B7280] leading-relaxed">
                  Having trouble?{' '}
                  <button type="button" className="font-semibold text-[#DC2626] hover:text-[#B91C1C] transition-colors">
                    Contact your gym administrator
                  </button>
                </p>
              </div>

            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <p className="text-[11px] text-[var(--text-disabled)] tracking-[0.03em]">
              &copy; {new Date().getFullYear()} 619 FITNESS STUDIO. All rights reserved.
            </p>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}

function ShieldLogo({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="
        M44 2
        C44 2 12 14 6 20
        C0 26 0 30 2 38
        C4 46 10 58 18 68
        C26 78 34 82 40 86
        C42 87 46 87 48 86
        C54 82 62 78 70 68
        C78 58 84 46 86 38
        C88 30 88 26 82 20
        C76 14 44 2 44 2 Z
      " fill="#DC2626" />
      <path d="
        M44 8
        C44 8 16 18 11 23
        C6 28 6 32 8 39
        C10 46 15 57 22 66
        C29 75 36 79 41 82
        C43 83 45 83 47 82
        C52 79 59 75 66 66
        C73 57 78 46 80 39
        C82 32 82 28 77 23
        C72 18 44 8 44 8 Z
      " fill="#B91C1C" opacity="0.5" />
      <path d="
        M44 30
        C40 30 37 33 36 36
        C35 39 33 42 30 44
        C27 46 24 50 23 54
        C22 58 21 62 22 65
        C23 68 26 70 30 72
        C34 74 39 75 44 76
        C49 75 54 74 58 72
        C62 70 65 68 66 65
        C67 62 66 58 65 54
        C64 50 61 46 58 44
        C55 42 53 39 52 36
        C51 33 48 30 44 30 Z
      " fill="#1A1A1A" />
      <path d="
        M33 38
        C30 32 28 26 29 20
        C29 16 32 14 35 16
        C38 18 40 22 39 27
        C38 32 36 36 35 38
      " fill="#1A1A1A" />
      <path d="
        M55 38
        C58 32 60 26 59 20
        C59 16 56 14 53 16
        C50 18 48 22 49 27
        C50 32 52 36 53 38
      " fill="#1A1A1A" />
      <text
        x="44" y="68"
        textAnchor="middle"
        fill="white"
        fontSize="11"
        fontWeight="800"
        fontFamily="Inter, sans-serif"
        letterSpacing="1"
      >
        619
      </text>
    </svg>
  );
}
