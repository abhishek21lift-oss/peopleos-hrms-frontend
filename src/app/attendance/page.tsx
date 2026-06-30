'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import { api, http, Client, Attendance } from '@/lib/api';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Fingerprint,
  Grid3x3,
  LayoutList,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Scan,
  Search,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  UserX,
  Users,
  Wifi,
  Zap,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────
   TYPES
──────────────────────────────────────────────────────────────── */
type ViewMode = 'table' | 'grid';
type StatusFilter = 'all' | 'present' | 'absent' | 'late' | 'unmarked';

const FEED_ITEMS = [
  { id: 1, name: 'Rahul Gupta',    action: 'checked in',   time: '2 min ago',  status: 'present', avatar: 'RG' },
  { id: 2, name: 'Ananya Joshi',  action: 'arrived late',  time: '6 min ago',  status: 'late',    avatar: 'AJ' },
  { id: 3, name: 'Deepak Mehta',  action: 'checked in',   time: '12 min ago', status: 'present', avatar: 'DM' },
  { id: 4, name: 'Sonia Kapoor',  action: 'scan failed',  time: '18 min ago', status: 'error',   avatar: 'SK' },
  { id: 5, name: 'Vijay Sharma',  action: 'checked in',   time: '25 min ago', status: 'present', avatar: 'VS' },
  { id: 6, name: 'Neha Singh',    action: 'membership ⚠', time: '31 min ago', status: 'warn',    avatar: 'NS' },
];

const WEEKLY_BARS = [
  { day: 'Mon', pct: 88 }, { day: 'Tue', pct: 76 }, { day: 'Wed', pct: 92 },
  { day: 'Thu', pct: 84 }, { day: 'Fri', pct: 70 }, { day: 'Sat', pct: 95 }, { day: 'Sun', pct: 62 },
];

const SMART_ALERTS = [
  { type: 'warn',    title: '4 members absent for 7+ days',           desc: 'Consider sending re-engagement notifications.',       icon: <AlertTriangle className="h-4 w-4" /> },
  { type: 'info',   title: '6 memberships expiring within 10 days',  desc: 'Renewals pending — trigger reminder campaign.',        icon: <Clock className="h-4 w-4" /> },
  { type: 'amber',  title: '3 members with frequent late check-ins',  desc: 'Rohit, Ananya & Vijay arriving 15+ min late daily.',  icon: <ArrowDownLeft className="h-4 w-4" /> },
  { type: 'green',  title: '12 members with 100% monthly attendance', desc: 'High-engagement cohort — ideal for loyalty rewards.',  icon: <Sparkles className="h-4 w-4" /> },
];

/* ────────────────────────────────────────────────────────────────
   ROOT
──────────────────────────────────────────────────────────────── */
export default function AttendancePage() {
  return (
    <Guard>
      <AttendanceContent />
    </Guard>
  );
}

/* ────────────────────────────────────────────────────────────────
   MAIN CONTENT  —  all original logic preserved
──────────────────────────────────────────────────────────────── */
function AttendanceContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const today   = new Date().toISOString().split('T')[0];

  /* ── original state ── */
  const [date,      setDate]      = useState(today);
  const [clients,   setClients]   = useState<Client[]>([]);
  const [records,   setRecords]   = useState<Attendance[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [search,    setSearch]    = useState('');
  const [bioCode,   setBioCode]   = useState('');
  const [bioSaving, setBioSaving] = useState(false);

  /* ── new UI state ── */
  const [viewMode,      setViewMode]      = useState<ViewMode>('table');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [activeTab,     setActiveTab]     = useState<'members' | 'insights' | 'alerts'>('members');
  const [bioFocus,      setBioFocus]      = useState(false);
  const [dirty,         setDirty]         = useState(false);
  const bioRef = useRef<HTMLInputElement>(null);

  /* ── original data fetch ── */
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.clients.list({ status: 'active' }),
      api.attendance.list({ date, type: 'client' }),
    ])
      .then(([c, a]) => { setClients(c); setRecords(a); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  /* ── original mark function ── */
  async function mark(client: Client, status: string) {
    setSaving(client.id);
    try {
      await api.attendance.mark({
        type:         'client',
        ref_id:       client.id,
        ref_name:     client.name,
        trainer_id:   client.trainer_id,
        trainer_name: client.trainer_name,
        date,
        status,
      });
      const updated = await api.attendance.list({ date, type: 'client' });
      setRecords(updated);
      setSuccess(`Marked ${client.name} as ${status}`);
      setDirty(true);
      setTimeout(() => setSuccess(''), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  /* ── original biometric check-in ── */
  async function biometricCheckIn() {
    if (!bioCode.trim()) return;
    setBioSaving(true);
    setError('');
    try {
      const res = await http<{ message: string }>('/api/attendance/biometric', { method: 'POST', body: JSON.stringify({ biometric_code: bioCode.trim(), type: 'client' }) });
      const updated = await api.attendance.list({ date, type: 'client' });
      setRecords(updated);
      setSuccess(res.message);
      setBioCode('');
      setDirty(true);
      setTimeout(() => setSuccess(''), 2200);
    } catch (e: any) {
      setError(e.message || 'Biometric check-in failed');
    } finally {
      setBioSaving(false);
    }
  }

  /* ── original mark-all ── */
  async function markAllPresent() {
    for (const c of filtered) {
      if (!getRecord(c.id)) await mark(c, 'present');
    }
  }

  function getRecord(clientId: string) {
    return records.find((r) => r.ref_id === clientId);
  }

  /* ── derived ── */
  const summary = {
    present:  records.filter((r) => r.status === 'present').length,
    absent:   records.filter((r) => r.status === 'absent').length,
    late:     records.filter((r) => r.status === 'late').length,
    unmarked: clients.length - records.length,
    total:    clients.length,
  };

  const filtered = clients.filter((c) => {
    const rec  = getRecord(c.id);
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.mobile || '').includes(search) ||
      (c.client_id || '').includes(search);
    const matchStatus =
      statusFilter === 'all'      ? true :
      statusFilter === 'present'  ? rec?.status === 'present' :
      statusFilter === 'absent'   ? rec?.status === 'absent' :
      statusFilter === 'late'     ? rec?.status === 'late' :
      statusFilter === 'unmarked' ? !rec : true;
    return matchSearch && matchStatus;
  });

  const attendanceRate = summary.total > 0
    ? Math.round(((summary.present + summary.late) / summary.total) * 100)
    : 0;

  return (
    <AppShell>
      <div className="relative min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 lg:px-8">

          {/* ── toasts ── */}
          {error   && <Toast msg={error}   type="error"   onClose={() => setError('')} />}
          {success && <Toast msg={success} type="success" onClose={() => setSuccess('')} />}

          {/* ── HERO ── */}
          <AttendanceHero
            date={date} setDate={setDate} today={today}
            attendanceRate={attendanceRate} summary={summary}
            onMarkAll={date === today ? markAllPresent : undefined}
          />

          {/* ── KPI CARDS ── */}
          <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 lg:gap-4">
            <KpiCard label="Present"   value={summary.present}  hint={`${summary.total > 0 ? Math.round(summary.present / summary.total * 100) : 0}% of total`}  accent="emerald" icon={<UserCheck className="h-5 w-5" />} onClick={() => setStatusFilter('present')}  active={statusFilter === 'present'} />
            <KpiCard label="Absent"    value={summary.absent}   hint={`${summary.total > 0 ? Math.round(summary.absent  / summary.total * 100) : 0}% of total`}  accent="rose"    icon={<UserX    className="h-5 w-5" />} onClick={() => setStatusFilter('absent')}   active={statusFilter === 'absent'} />
            <KpiCard label="Late"      value={summary.late}     hint="Arrived after cut-off" accent="amber"   icon={<Clock    className="h-5 w-5" />} onClick={() => setStatusFilter('late')}     active={statusFilter === 'late'} />
            <KpiCard label="Unmarked"  value={summary.unmarked} hint="Pending today"         accent="zinc"    icon={<Users    className="h-5 w-5" />} onClick={() => setStatusFilter('unmarked')} active={statusFilter === 'unmarked'} />
            <KpiCard label="Total"     value={summary.total}    hint="Active members"        accent="sky"     icon={<Activity className="h-5 w-5" />} onClick={() => setStatusFilter('all')}      active={statusFilter === 'all'} />
            <KpiCard label="Rate"      value={`${attendanceRate}%`} hint="Attendance today"  accent="violet"  icon={<TrendingUp className="h-5 w-5" />} />
          </section>

          {/* ── BIOMETRIC PANEL ── */}
          <BiometricPanel
            bioCode={bioCode} setBioCode={setBioCode}
            bioSaving={bioSaving} onSubmit={biometricCheckIn}
            bioRef={bioRef} bioFocus={bioFocus} setBioFocus={setBioFocus}
          />

          {/* ── TAB BAR ── */}
          <div className="mt-6 flex flex-wrap gap-2 rounded-[22px] border border-zinc-200/80 bg-white/70 p-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            {(['members', 'insights', 'alerts'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`rounded-[16px] px-4 py-2.5 text-sm font-medium capitalize transition ${
                  activeTab === tab
                    ? 'bg-[linear-gradient(135deg,#dc2626,#991b1b)] text-white shadow-[0_6px_20px_rgba(220,38,38,0.3)]'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:bg-white/10 hover:text-zinc-900 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white'
                }`}>
                {tab === 'members' ? 'Member Attendance' : tab === 'insights' ? 'Insights & Trends' : 'Smart Alerts'}
                {tab === 'alerts' && (
                  <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-xs text-white">4</span>
                )}
              </button>
            ))}
          </div>

          {/* ── TAB PANELS ── */}
          <div className="mt-5">
            {activeTab === 'members' && (
              <MembersPanel
                filtered={filtered} loading={loading}
                search={search} setSearch={setSearch}
                statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                viewMode={viewMode} setViewMode={setViewMode}
                saving={saving} getRecord={getRecord} mark={mark}
                date={date} today={today} onMarkAll={date === today ? markAllPresent : undefined}
              />
            )}
            {activeTab === 'insights' && <InsightsPanel summary={summary} />}
            {activeTab === 'alerts'   && <AlertsPanel />}
          </div>

          {/* ── LIVE FEED ── */}
          <LiveFeedPanel />

          {/* ── QUICK ACTIONS ── */}
          <QuickActionsPanel onMarkAll={date === today ? markAllPresent : undefined} />

        </div>

        {/* ── FOOTER BAR ── */}
        <FooterBar dirty={dirty} setDirty={setDirty} onSync={() => { setLoading(true); Promise.all([api.clients.list({ status: 'active' }), api.attendance.list({ date, type: 'client' })]).then(([c, a]) => { setClients(c); setRecords(a); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }} />
      </div>
    </AppShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   HERO
──────────────────────────────────────────────────────────────── */
function AttendanceHero({ date, setDate, today, attendanceRate, summary, onMarkAll }: {
  date: string; setDate: (d: string) => void; today: string;
  attendanceRate: number; summary: { present: number; absent: number; late: number; unmarked: number; total: number };
  onMarkAll?: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(9,9,11,0.97),rgba(38,7,12,0.93),rgba(24,24,27,0.94))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(220,38,38,0.26),transparent_28%),radial-gradient(circle_at_75%_12%,rgba(16,185,129,0.14),transparent_20%),radial-gradient(circle_at_60%_85%,rgba(255,255,255,0.04),transparent_14%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
        <div className="space-y-5 text-white">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300 backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live sync active
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-md">
              <Wifi className="h-3.5 w-3.5" />Biometric device connected
            </span>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-white/50">619 Fitness Studio</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[3rem] lg:leading-[1.06]">Member Attendance</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              Real-time biometric attendance and member check-in management across all sessions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              max={today}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white backdrop-blur-md transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/20 [color-scheme:dark]"
            />
            <HeroBtn label="Manual Entry"    icon={<Plus className="h-4 w-4" />} />
            <HeroBtn label="Export"          icon={<Download className="h-4 w-4" />} />
            <HeroBtn label="Reports"         icon={<FileText className="h-4 w-4" />} />
            {onMarkAll && (
              <HeroBtn label="Mark All Present" icon={<CheckCircle2 className="h-4 w-4" />} primary onClick={onMarkAll} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Present today',  value: summary.present,  sub: 'members' },
            { label: 'Attendance rate', value: `${attendanceRate}%`, sub: 'today' },
            { label: 'Late arrivals',  value: summary.late,     sub: 'logged' },
            { label: 'Unmarked',       value: summary.unmarked, sub: 'pending' },
          ].map(stat => (
            <div key={stat.label} className="rounded-[22px] border border-white/10 bg-white/10 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-xl">
              <p className="text-xs text-white/45">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-white/50">{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   BIOMETRIC PANEL
──────────────────────────────────────────────────────────────── */
function BiometricPanel({ bioCode, setBioCode, bioSaving, onSubmit, bioRef, bioFocus, setBioFocus }: {
  bioCode: string; setBioCode: (v: string) => void;
  bioSaving: boolean; onSubmit: () => void;
  bioRef: React.RefObject<HTMLInputElement | null>;
  bioFocus: boolean; setBioFocus: (v: boolean) => void;
}) {
  return (
    <section className="mt-6 rounded-[30px] border border-zinc-200/70 bg-white/75 p-5 shadow-[0_10px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">

        {/* pulse icon */}
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full transition ${
          bioSaving ? 'animate-pulse bg-[linear-gradient(135deg,#dc2626,#991b1b)] shadow-[0_0_40px_rgba(220,38,38,0.55)]' :
          bioFocus  ? 'bg-[linear-gradient(135deg,#dc2626,#7c3aed)] shadow-[0_0_32px_rgba(220,38,38,0.42)]' :
          'bg-zinc-100 dark:bg-white/8'
        }`}>
          {bioSaving
            ? <Loader2 className="h-8 w-8 animate-spin text-white" />
            : <Fingerprint className={`h-9 w-9 transition ${ bioFocus ? 'text-white' : 'text-zinc-400 dark:text-white/35' }`} />
          }
        </div>

        {/* input */}
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">Smart Check-in</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">Biometric / Member Code</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-white/40">
            Scan fingerprint, NFC card or RFID tag — device can POST to <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-white/10">/api/attendance/biometric</code>
          </p>
          <form className="mt-4 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
            <input
              ref={bioRef}
              value={bioCode}
              onChange={e => setBioCode(e.target.value)}
              onFocus={() => setBioFocus(true)}
              onBlur={() => setBioFocus(false)}
              placeholder="Scan fingerprint / enter member code"
              autoComplete="off"
              className="flex-1 min-w-[220px] rounded-[16px] border border-zinc-200 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-zinc-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:ring-rose-900/20"
            />
            <button
              type="submit"
              disabled={bioSaving || !bioCode.trim()}
              className="inline-flex items-center gap-2 rounded-[16px] border-transparent bg-[linear-gradient(135deg,#dc2626,#991b1b)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(220,38,38,0.28)] transition disabled:opacity-50 hover:shadow-[0_12px_30px_rgba(220,38,38,0.38)] hover:-translate-y-0.5"
            >
              {bioSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              {bioSaving ? 'Checking in…' : 'Check In'}
            </button>
          </form>
        </div>

        {/* recent feed preview */}
        <div className="hidden lg:block w-56">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">Recent scans</p>
          <div className="space-y-2">
            {FEED_ITEMS.slice(0, 3).map(f => (
              <div key={f.id} className="flex items-center gap-2.5 rounded-[14px] border border-zinc-100 bg-zinc-50/70 px-3 py-2 dark:border-white/5 dark:bg-white/5">
                <FeedAvatar initials={f.avatar} status={f.status} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-800 dark:text-white/80">{f.name}</p>
                  <p className="text-xs text-zinc-400 dark:text-white/30">{f.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   MEMBERS TABLE PANEL
──────────────────────────────────────────────────────────────── */
function MembersPanel({ filtered, loading, search, setSearch, statusFilter, setStatusFilter, viewMode, setViewMode, saving, getRecord, mark, date, today, onMarkAll }: {
  filtered: Client[]; loading: boolean;
  search: string; setSearch: (v: string) => void;
  statusFilter: StatusFilter; setStatusFilter: (v: StatusFilter) => void;
  viewMode: ViewMode; setViewMode: (v: ViewMode) => void;
  saving: string | null;
  getRecord: (id: string) => Attendance | undefined;
  mark: (c: Client, status: string) => Promise<void>;
  date: string; today: string;
  onMarkAll?: () => void;
}) {
  const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'present', label: 'Present' },
    { id: 'absent', label: 'Absent' }, { id: 'late', label: 'Late' }, { id: 'unmarked', label: 'Unmarked' },
  ];

  return (
    <section className="rounded-[30px] border border-zinc-200/70 bg-white/75 p-5 shadow-[0_10px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">Member Attendance</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-white/45">{filtered.length} members · P = Present · A = Absent · L = Late</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onMarkAll && (
            <button onClick={onMarkAll} className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />Mark All Present
            </button>
          )}
        </div>
      </div>

      {/* toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-white/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member…"
            className="w-full rounded-[14px] border border-zinc-200 bg-white/80 py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-zinc-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30" />
        </div>
        <div className="flex gap-1 rounded-[14px] border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5">
          {STATUS_FILTERS.map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`rounded-[10px] px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === f.id ? 'bg-white text-zinc-900 shadow-sm dark:bg-white/12 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/70'
              }`}>{f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 rounded-[14px] border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5">
          <button onClick={() => setViewMode('table')} className={`rounded-[10px] p-2 transition ${ viewMode === 'table' ? 'bg-white shadow-sm dark:bg-white/12' : 'text-zinc-400 dark:text-white/30' }`}><LayoutList className="h-4 w-4" /></button>
          <button onClick={() => setViewMode('grid')}  className={`rounded-[10px] p-2 transition ${ viewMode === 'grid'  ? 'bg-white shadow-sm dark:bg-white/12' : 'text-zinc-400 dark:text-white/30' }`}><Grid3x3  className="h-4 w-4" /></button>
        </div>
      </div>

      {loading ? (
        <SkeletonRows />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No members found" desc="Try adjusting search or status filters." />
      ) : viewMode === 'table' ? (
        <TableView filtered={filtered} saving={saving} getRecord={getRecord} mark={mark} />
      ) : (
        <GridView filtered={filtered} saving={saving} getRecord={getRecord} mark={mark} />
      )}
    </section>
  );
}

function TableView({ filtered, saving, getRecord, mark }: {
  filtered: Client[]; saving: string | null;
  getRecord: (id: string) => Attendance | undefined;
  mark: (c: Client, s: string) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto rounded-[20px] border border-zinc-200/70 dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500 dark:bg-white/5 dark:text-white/40">
          <tr>
            {['Member', 'Plan', 'Trainer', 'Status', 'Check-in', 'Actions'].map(h => (
              <th key={h} className="px-5 py-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(c => {
            const rec = getRecord(c.id);
            return (
              <tr key={c.id} className="border-t border-zinc-100 transition hover:bg-zinc-50 dark:bg-white/5/70 dark:border-white/5 dark:hover:bg-white/5">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <MemberAvatar client={c} />
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-zinc-400 dark:text-white/30">{c.client_id || ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-white/65">{c.package_type || '—'}</span>
                </td>
                <td className="px-5 py-4 text-sm text-zinc-500 dark:text-white/40">{c.trainer_name || '—'}</td>
                <td className="px-5 py-4">{rec ? <StatusBadge status={rec.status} /> : <StatusBadge status="unmarked" />}</td>
                <td className="px-5 py-4 text-xs tabular-nums text-zinc-500 dark:text-white/40">{rec?.check_in || '—'}</td>
                <td className="px-5 py-4">
                  <AttendanceBtns client={c} rec={rec} saving={saving} mark={mark} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GridView({ filtered, saving, getRecord, mark }: {
  filtered: Client[]; saving: string | null;
  getRecord: (id: string) => Attendance | undefined;
  mark: (c: Client, s: string) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map(c => {
        const rec = getRecord(c.id);
        return (
          <div key={c.id} className="rounded-[22px] border border-zinc-200/70 bg-white/85 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <MemberAvatar client={c} large />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-zinc-400 dark:text-white/30">{c.package_type || '—'}</p>
                </div>
              </div>
              {rec ? <StatusBadge status={rec.status} /> : <StatusBadge status="unmarked" />}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-zinc-500 dark:text-white/40">{rec?.check_in ? `Checked in ${rec.check_in}` : 'Not yet marked'}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <AttendanceBtns client={c} rec={rec} saving={saving} mark={mark} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttendanceBtns({ client, rec, saving, mark }: {
  client: Client; rec: Attendance | undefined; saving: string | null;
  mark: (c: Client, s: string) => Promise<void>;
}) {
  const isSaving = saving === client.id;
  return (
    <div className="flex items-center gap-1.5">
      {([
        { status: 'present', label: 'P', active: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/40 ring-2 ring-emerald-300/30 dark:text-emerald-300', inactive: 'border-zinc-200 bg-white text-zinc-500 hover:border-emerald-300 hover:text-emerald-600 dark:border-white/10 dark:bg-white/5 dark:text-white/40' },
        { status: 'absent',  label: 'A', active: 'bg-rose-500/15 text-rose-700 border-rose-400/40 ring-2 ring-rose-300/30 dark:text-rose-300',             inactive: 'border-zinc-200 bg-white text-zinc-500 hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:bg-white/5 dark:text-white/40' },
        { status: 'late',    label: 'L', active: 'bg-amber-500/15 text-amber-700 border-amber-400/40 ring-2 ring-amber-300/30 dark:text-amber-300',          inactive: 'border-zinc-200 bg-white text-zinc-500 hover:border-amber-300 hover:text-amber-600 dark:border-white/10 dark:bg-white/5 dark:text-white/40' },
      ] as const).map(({ status, label, active, inactive }) => (
        <button
          key={status}
          onClick={() => mark(client, status)}
          disabled={isSaving}
          className={`h-9 w-9 rounded-[10px] border text-xs font-bold transition ${ rec?.status === status ? active : inactive } ${isSaving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          {isSaving ? '…' : label}
        </button>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   INSIGHTS PANEL
──────────────────────────────────────────────────────────────── */
function InsightsPanel({ summary }: { summary: { present: number; absent: number; late: number; unmarked: number; total: number } }) {
  const max = Math.max(...WEEKLY_BARS.map(b => b.pct), 1);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <PremiumCard title="Weekly Attendance Trends" subtitle="Last 7 days — daily attendance rate">
        <div className="flex h-44 items-end gap-2 pt-4">
          {WEEKLY_BARS.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <p className="text-xs font-semibold text-zinc-600 dark:text-white/55">{b.pct}%</p>
              <div className="w-full rounded-t-[10px] transition-all" style={{ height: `${(b.pct / max) * 140}px`, background: b.pct >= 85 ? 'linear-gradient(180deg,#10b981,#059669)' : b.pct >= 70 ? 'linear-gradient(180deg,#dc2626,#991b1b)' : 'linear-gradient(180deg,#f59e0b,#d97706)' }} />
              <p className="text-xs text-zinc-400 dark:text-white/30">{b.day}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          {[['#10b981', '≥ 85% great'], ['#dc2626', '70–84% normal'], ['#f59e0b', '< 70% low']].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 text-zinc-500 dark:text-white/40"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>
          ))}
        </div>
      </PremiumCard>

      <div className="space-y-4">
        <PremiumCard title="Today's breakdown" subtitle="Live distribution">
          <div className="space-y-3">
            {([
              { label: 'Present',  value: summary.present,  color: '#10b981', bg: 'bg-emerald-500/15' },
              { label: 'Absent',   value: summary.absent,   color: '#dc2626', bg: 'bg-rose-500/15' },
              { label: 'Late',     value: summary.late,     color: '#f59e0b', bg: 'bg-amber-500/15' },
              { label: 'Unmarked', value: summary.unmarked, color: '#71717a', bg: 'bg-zinc-400/15' },
            ] as const).map(item => (
              <div key={item.label} className="rounded-[14px] bg-zinc-50 p-3 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-700 dark:text-white/70">{item.label}</p>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: item.color }}>{item.value}</p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-zinc-200 dark:bg-white/10">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${summary.total > 0 ? (item.value / summary.total) * 100 : 0}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard title="Peak hours" subtitle="Studio occupancy">
          <div className="space-y-2">
            {[['6–8 AM', 78], ['8–10 AM', 95], ['10 AM–12', 62], ['4–6 PM', 88], ['6–8 PM', 72]].map(([t, v]) => (
              <div key={String(t)} className="flex items-center gap-3">
                <p className="w-20 shrink-0 text-xs text-zinc-500 dark:text-white/40">{t}</p>
                <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-white/10">
                  <div className="h-2 rounded-full bg-[linear-gradient(90deg,#dc2626,#fb7185)]" style={{ width: `${v}%` }} />
                </div>
                <p className="w-8 text-right text-xs font-medium text-zinc-600 dark:text-white/55">{v}%</p>
              </div>
            ))}
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   ALERTS PANEL
──────────────────────────────────────────────────────────────── */
function AlertsPanel() {
  const COLORS: Record<string, string> = {
    warn:  'border-rose-400/30 bg-rose-500/8 dark:bg-rose-900/15',
    info:  'border-sky-400/30 bg-sky-500/8 dark:bg-sky-900/15',
    amber: 'border-amber-400/30 bg-amber-500/8 dark:bg-amber-900/15',
    green: 'border-emerald-400/30 bg-emerald-500/8 dark:bg-emerald-900/15',
  };
  const ICON_COLORS: Record<string, string> = {
    warn: 'text-rose-500', info: 'text-sky-500', amber: 'text-amber-500', green: 'text-emerald-500',
  };
  return (
    <PremiumCard title="Smart Alerts" subtitle="AI-powered operational insights based on attendance patterns">
      <div className="grid gap-4 sm:grid-cols-2">
        {SMART_ALERTS.map((a, i) => (
          <div key={i} className={`rounded-[20px] border p-5 transition hover:-translate-y-0.5 ${COLORS[a.type]}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${ICON_COLORS[a.type]}`}>{a.icon}</div>
              <div className="flex-1">
                <p className="font-semibold text-zinc-900 dark:text-white/90">{a.title}</p>
                <p className="mt-1.5 text-sm text-zinc-500 dark:text-white/45">{a.desc}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <SmBtn label="View members" icon={<Eye className="h-3.5 w-3.5" />} />
              <SmBtn label="Send reminder" icon={<Bell className="h-3.5 w-3.5" />} />
            </div>
          </div>
        ))}
      </div>
    </PremiumCard>
  );
}

/* ────────────────────────────────────────────────────────────────
   LIVE FEED
──────────────────────────────────────────────────────────────── */
function LiveFeedPanel() {
  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-white/40">Live activity</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">Real-time feed</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEED_ITEMS.map(f => (
          <div key={f.id} className="flex items-center gap-3.5 rounded-[20px] border border-zinc-200/70 bg-white/80 px-4 py-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <FeedAvatar initials={f.avatar} status={f.status} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-zinc-900 dark:text-white">{f.name}</p>
              <p className="text-xs text-zinc-500 dark:text-white/40">{f.action}</p>
            </div>
            <p className="shrink-0 text-xs text-zinc-400 dark:text-white/30">{f.time}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   QUICK ACTIONS
──────────────────────────────────────────────────────────────── */
function QuickActionsPanel({ onMarkAll }: { onMarkAll?: () => void }) {
  const actions = [
    { label: 'Mark All Present', icon: <CheckCircle2 className="h-5 w-5" />, color: 'from-emerald-500/20 to-green-500/10', onClick: onMarkAll },
    { label: 'Bulk Attendance',  icon: <Users className="h-5 w-5" />,        color: 'from-sky-500/20 to-blue-500/10' },
    { label: 'Export CSV',       icon: <Download className="h-5 w-5" />,      color: 'from-violet-500/20 to-purple-500/10' },
    { label: 'Send Reminders',   icon: <Bell className="h-5 w-5" />,          color: 'from-amber-500/20 to-yellow-500/10' },
    { label: 'Open Reports',     icon: <BarChart3 className="h-5 w-5" />,     color: 'from-rose-500/20 to-red-500/10' },
    { label: 'Start Live Scan',  icon: <Scan className="h-5 w-5" />,          color: 'from-rose-500/20 to-red-500/10' },
  ];
  return (
    <section className="mt-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-white/40">Quick actions</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">Common operations</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {actions.map(a => (
          <button key={a.label} onClick={a.onClick}
            className={`group rounded-[22px] border border-zinc-200 dark:border-white/10/70 bg-gradient-to-br ${a.color} p-5 text-left transition hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] dark:border-white/10`}>
            <div className="mb-4 h-10 w-10 rounded-[14px] border border-zinc-200/70 bg-white/80 flex items-center justify-center text-zinc-700 shadow-sm transition group-hover:scale-110 dark:border-white/10 dark:bg-white/10 dark:text-white/75">{a.icon}</div>
            <p className="text-sm font-semibold leading-snug text-zinc-900 dark:text-white">{a.label}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   FOOTER BAR
──────────────────────────────────────────────────────────────── */
function FooterBar({ dirty, setDirty, onSync }: { dirty: boolean; setDirty: (v: boolean) => void; onSync: () => void }) {
  return (
    <div className="sticky bottom-4 z-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,20,0.84),rgba(18,18,20,0.72))] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3 text-white">
          <span className={`h-2.5 w-2.5 rounded-full ${dirty ? 'bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.8)]' : 'bg-emerald-400'}`} />
          <div>
            <p className="text-sm font-medium">{dirty ? 'Unsaved attendance changes' : 'All changes saved'}</p>
            <p className="text-xs text-white/50">Sync updates attendance records across all devices.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <HeroBtn label="Reset"           icon={<RefreshCw className="h-4 w-4" />}      onClick={() => setDirty(false)} compact />
          <HeroBtn label="Sync Devices"    icon={<Wifi className="h-4 w-4" />}           onClick={() => { onSync(); setDirty(false); }} compact />
          <HeroBtn label="Generate Report" icon={<FileText className="h-4 w-4" />}       compact />
          <HeroBtn label="Save Attendance" icon={<CheckCircle2 className="h-4 w-4" />}   primary compact onClick={() => setDirty(false)} />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   SHARED ATOMS
──────────────────────────────────────────────────────────────── */
function PremiumCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[30px] border border-zinc-200/70 bg-white/75 p-5 shadow-[0_10px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-500 dark:text-white/45">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function KpiCard({ label, value, hint, accent, icon, onClick, active }: {
  label: string; value: string | number; hint: string;
  accent: string; icon: React.ReactNode;
  onClick?: () => void; active?: boolean;
}) {
  const accents: Record<string, string> = {
    emerald: 'from-emerald-500/15 to-green-500/8',
    rose:    'from-rose-500/15 to-red-500/8',
    amber:   'from-amber-500/15 to-yellow-500/8',
    sky:     'from-sky-500/15 to-blue-500/8',
    violet:  'from-violet-500/15 to-purple-500/8',
    zinc:    'from-zinc-400/15 to-zinc-500/8',
  };
  return (
    <button onClick={onClick}
      className={`group rounded-[22px] border bg-gradient-to-br ${accents[accent] ?? accents.zinc} bg-white/80 p-4 shadow-sm text-left transition hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(15,23,42,0.10)] dark:bg-white/5 ${
        active ? 'border-rose-400/40 ring-2 ring-rose-200/30 dark:border-rose-400/30 dark:ring-rose-900/20' : 'border-zinc-200/70 dark:border-white/10'
      }`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="h-9 w-9 rounded-[12px] border border-zinc-200/70 bg-white/90 flex items-center justify-center text-zinc-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white/70">{icon}</div>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-white/70">{label}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-white/40">{hint}</p>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    present:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    absent:   'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
    late:     'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    unmarked: 'bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-white/40',
  };
  const dots: Record<string, string> = {
    present: 'bg-emerald-500', absent: 'bg-rose-500', late: 'bg-amber-500', unmarked: 'bg-zinc-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${map[status] ?? map.unmarked}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status] ?? dots.unmarked}`} />
      {status}
    </span>
  );
}

function MemberAvatar({ client, large }: { client: Client; large?: boolean }) {
  const sz = large ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs';
  const initials = (client.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  if ((client as any).photo_url) {
    return <Image src={(client as any).photo_url} alt={client.name} width={48} height={48} className={`${sz} rounded-full object-cover`} />;
  }
  return (
    <div className={`${sz} shrink-0 rounded-full bg-[linear-gradient(135deg,#dc2626,#7c3aed)] flex items-center justify-center font-semibold text-white shadow-sm`}>
      {initials}
    </div>
  );
}

function FeedAvatar({ initials, status, size = 'sm' }: { initials: string; status: string; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'h-10 w-10 text-sm' : 'h-7 w-7 text-xs';
  const ringColor = status === 'present' ? 'ring-emerald-400' : status === 'late' ? 'ring-amber-400' : status === 'error' ? 'ring-rose-400' : status === 'warn' ? 'ring-amber-400' : 'ring-zinc-300';
  return (
    <div className={`${sz} shrink-0 rounded-full bg-[linear-gradient(135deg,#dc2626,#7c3aed)] flex items-center justify-center font-semibold text-white ring-2 ${ringColor}`}>
      {initials}
    </div>
  );
}

function HeroBtn({ label, icon, primary, compact, onClick }: { label: string; icon: React.ReactNode; primary?: boolean; compact?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border font-medium transition hover:-translate-y-0.5 ${
        compact ? 'px-3.5 py-2 text-sm' : 'px-4 py-2.5 text-sm'
      } ${
        primary
          ? 'border-transparent bg-[linear-gradient(135deg,#dc2626,#991b1b)] text-white shadow-[0_10px_28px_rgba(220,38,38,0.32)] hover:shadow-[0_14px_36px_rgba(220,38,38,0.42)]'
          : 'border-white/15 bg-white/10 text-white/85 hover:bg-white/18 backdrop-blur-md'
      }`}>
      {icon}{label}
    </button>
  );
}

function SmBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-white/70 dark:hover:bg-white/15">
      {icon}{label}
    </button>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-[16px] bg-zinc-100/70 p-4 dark:bg-white/5">
          <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded-full bg-zinc-200 dark:bg-white/10" />
            <div className="h-2.5 w-1/4 rounded-full bg-zinc-200 dark:bg-white/10" />
          </div>
          <div className="h-8 w-24 rounded-[10px] bg-zinc-200 dark:bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function Toast({ msg, type, onClose }: { msg: string; type: 'error' | 'success'; onClose: () => void }) {
  return (
    <div className={`mb-4 flex items-center gap-3 rounded-[16px] border px-4 py-3.5 text-sm font-medium shadow-sm ${
      type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-900/20 dark:text-emerald-300'
        : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-900/20 dark:text-rose-300'
    }`}>
      {type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center rounded-[22px] border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-12 text-center dark:border-white/10 dark:bg-white/3">
      <div className="mb-4 text-zinc-400 dark:text-white/30">{icon}</div>
      <p className="font-semibold text-zinc-800 dark:text-white/80">{title}</p>
      <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-white/40">{desc}</p>
    </div>
  );
}
