'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Phone, Mail, MapPin, Award, DollarSign,
  Clock, Users, Target, FileText, Shield,
  ChevronRight, ChevronLeft, Check, Upload, Plus, X,
  Dumbbell, Star, Zap, Calendar, Camera, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Guard from '@/components/Guard';

// ── Types ────────────────────────────────────────────────────────────
type Step = { id: number; title: string; subtitle: string; icon: React.ReactNode; color: string };

const STEPS: Step[] = [
  { id: 1, title: 'Personal Details',        subtitle: 'Basic info & photo',       icon: <User size={16}/>,       color: '#6366f1' },
  { id: 2, title: 'Contact Information',     subtitle: 'Phone, email, address',    icon: <Phone size={16}/>,      color: '#8b5cf6' },
  { id: 3, title: 'Coaching Specialization', subtitle: 'Expertise & certifications',icon: <Dumbbell size={16}/>,  color: '#06b6d4' },
  { id: 4, title: 'Salary & Payroll',        subtitle: 'Compensation details',     icon: <DollarSign size={16}/>, color: '#10b981' },
  { id: 5, title: 'Shift & Schedule',        subtitle: 'Working hours',            icon: <Clock size={16}/>,      color: '#f59e0b' },
  { id: 6, title: 'Clients & Permissions',   subtitle: 'Access & assignments',     icon: <Shield size={16}/>,     color: '#ef4444' },
];

const SPECIALIZATIONS = ['Strength Training', 'HIIT', 'Yoga', 'Pilates', 'Cardio', 'Powerlifting', 'CrossFit', 'Functional Training', 'Rehabilitation', 'Nutrition', 'Weight Loss', 'Muscle Gain', 'Endurance', 'Flexibility'];
const CERTIFICATIONS = ['K11 Fitness', 'ACE Certified', 'NASM CPT', 'ISSA', 'ACSM', 'CrossFit L1', 'Yoga RYT 200', 'Sports Nutrition', 'First Aid CPR'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── FloatLabel ───────────────────────────────────────────────────────
function FloatLabel({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="relative">
      {children}
      <label className="pointer-events-none absolute left-4 top-3.5 origin-left scale-75 -translate-y-3 text-[11px] font-[600] uppercase tracking-widest"
        style={{ color: 'rgb(148,163,184)', letterSpacing: '0.12em' }}>
        {label}{required && <span className="ml-0.5 text-rose-400">*</span>}
      </label>
    </div>
  );
}

// ── Input ────────────────────────────────────────────────────────────
function Input({ label, type = 'text', placeholder, required, value, onChange }: {
  label: string; type?: string; placeholder?: string; required?: boolean;
  value?: string; onChange?: (v: string) => void;
}) {
  return (
    <FloatLabel label={label} required={required}>
      <input
        type={type} placeholder={placeholder}
        value={value ?? ''}
        onChange={function(e) { onChange?.(e.target.value); }}
        className="w-full rounded-[14px] px-4 pb-3 pt-7 text-[14px] font-[500] outline-none transition-all"
        style={{
          background: 'var(--bg-subtle)',
          border: '1px solid rgba(15,23,42,0.08)',
          color: 'rgb(15,23,42)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
        onFocus={function(e) {
          e.currentTarget.style.border = '1px solid rgba(99,102,241,0.40)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.9)';
          e.currentTarget.style.background = 'var(--bg-card)';
        }}
        onBlur={function(e) {
          e.currentTarget.style.border = '1px solid rgba(15,23,42,0.08)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.9)';
          e.currentTarget.style.background = 'var(--bg-subtle)';
        }}
      />
    </FloatLabel>
  );
}

// ── Select ───────────────────────────────────────────────────────────
function Select({ label, options, required, value, onChange }: {
  label: string; options: string[]; required?: boolean;
  value?: string; onChange?: (v: string) => void;
}) {
  return (
    <FloatLabel label={label} required={required}>
      <select
        value={value ?? ''}
        onChange={function(e) { onChange?.(e.target.value); }}
        className="w-full appearance-none rounded-[14px] px-4 pb-3 pt-7 text-[14px] font-[500] outline-none transition-all"
        style={{
          background: 'var(--bg-subtle)',
          border: '1px solid rgba(15,23,42,0.08)',
          color: 'rgb(15,23,42)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        <option value="">Select</option>
        {options.map(function(o) { return <option key={o} value={o}>{o}</option>; })}
      </select>
    </FloatLabel>
  );
}

// ── ChipGroup ────────────────────────────────────────────────────────
function ChipGroup({ options, selected, onChange, color }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; color: string }) {
  function toggle(o: string) {
    onChange(selected.includes(o) ? selected.filter(function(s) { return s !== o; }) : [...selected, o]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(function(o) {
        const on = selected.includes(o);
        return (
          <button key={o} type="button" onClick={function() { toggle(o); }}
            className="rounded-full px-3 py-1.5 text-[12px] font-[600] transition-all duration-150 active:scale-95"
            style={{
              background: on ? color : 'var(--border)',
              color: on ? '#fff' : 'rgb(71,85,105)',
              border: on ? '1.5px solid ' + color : '1.5px solid transparent',
              boxShadow: on ? '0 2px 8px ' + color + '30' : 'none',
            }}>
            {on && <Check size={10} className="mr-1 inline" />}{o}
          </button>
        );
      })}
    </div>
  );
}

// ── ToggleSwitch ─────────────────────────────────────────────────────
function ToggleSwitch({ label, sublabel, defaultOn, checked, onChange }: {
  label: string; sublabel?: string; defaultOn?: boolean;
  checked?: boolean; onChange?: (v: boolean) => void;
}) {
  const [on, setOn] = useState(defaultOn ?? checked ?? false);
  return (
    <div className="flex items-center justify-between rounded-[14px] px-4 py-3.5"
      style={{ background: 'var(--bg-subtle)', border: '1px solid rgba(15,23,42,0.07)' }}>
      <div>
        <p className="text-[13.5px] font-[600]" style={{ color: 'rgb(15,23,42)' }}>{label}</p>
        {sublabel && <p className="mt-0.5 text-[11.5px]" style={{ color: 'rgb(148,163,184)' }}>{sublabel}</p>}
      </div>
      <button type="button" onClick={function() { const v = !on; setOn(v); onChange?.(v); }}
        className="relative h-6 w-11 rounded-full transition-all duration-300"
        style={{ background: on ? '#6366f1' : 'var(--border-3)' }}
        aria-checked={on} role="switch">
        <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all duration-300"
          style={{ left: on ? '23px' : '3px', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
      </button>
    </div>
  );
}

// ── DragDropUpload ───────────────────────────────────────────────────
function DragDropUpload({ label, accept }: { label: string; accept: string }) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-2 text-[12px] font-[700] uppercase tracking-widest" style={{ color: 'rgb(148,163,184)' }}>{label}</p>
      <div
        onClick={function() { ref.current?.click(); }}
        onDragOver={function(e) { e.preventDefault(); setDragging(true); }}
        onDragLeave={function() { setDragging(false); }}
        onDrop={function(e) { e.preventDefault(); setDragging(false); setFiles(function(p) { return [...p, ...Array.from(e.dataTransfer.files).map(function(f) { return f.name; })]; }); }}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-[16px] px-6 py-8 text-center transition-all"
        style={{ border: dragging ? '2px dashed #6366f1' : '2px dashed rgba(15,23,42,0.12)', background: dragging ? 'rgba(99,102,241,0.04)' : 'rgba(248,250,252,0.6)' }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: 'rgba(99,102,241,0.08)' }}>
          <Upload size={18} style={{ color: '#6366f1' }} />
        </div>
        <p className="text-[13px] font-[600]" style={{ color: 'rgb(71,85,105)' }}>Drop files here or <span style={{ color: '#6366f1' }}>browse</span></p>
        <p className="text-[11px]" style={{ color: 'rgb(148,163,184)' }}>{accept}</p>
        <input ref={ref} type="file" accept={accept} multiple className="hidden"
          onChange={function(e) { setFiles(function(p) { return [...p, ...Array.from(e.target.files || []).map(function(f) { return f.name; })]; }); }} />
      </div>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map(function(f, i) {
            return (
              <span key={i} className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-[600]"
                style={{ background: 'rgba(99,102,241,0.09)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.18)' }}>
                <FileText size={10} />{f}
                <button onClick={function() { setFiles(function(p) { return p.filter(function(_, j) { return j !== i; }); }); }} className="ml-0.5">
                  <X size={9} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
export default function AddCoachPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [specs, setSpecs] = useState<string[]>([]);
  const [certs, setCerts] = useState<string[]>([]);
  const [workDays, setWorkDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // Form state (essential fields)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [experience, setExperience] = useState('');
  const [salary, setSalary] = useState('');

  const current = STEPS[step - 1];
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  const handleSubmit = useCallback(async function() {
    if (!firstName || !email || !phone) {
      setError('First name, email, and phone are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const name = firstName + ' ' + (lastName || '').trim();
      await api.trainers.create({
        name: name.trim(),
        email: email,
        phone: phone,
        specialization: specs.join(', '),
        experience_years: parseInt(experience) || 0,
      });
      router.push('/trainers');
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to create coach');
    } finally {
      setSubmitting(false);
    }
  }, [firstName, lastName, email, phone, specs, experience, router]);

  const stepContent: Record<number, React.ReactNode> = {
    1: (
      <div className="space-y-4">
        <div className="flex justify-center pb-2">
          <button type="button" onClick={function() { photoRef.current?.click(); }}
            className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[24px] transition-all"
            style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.08) 0%,rgba(139,92,246,0.06) 100%)', border: '2px dashed rgba(99,102,241,0.25)' }}>
            {photoPreview ? <img src={photoPreview} alt="Trainer photo preview" className="h-full w-full object-cover" /> : <Camera size={24} style={{ color: 'rgba(99,102,241,0.5)' }} />}
            <span className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"><Camera size={20} className="text-white" /></span>
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={function(e) { const f = e.target.files?.[0]; if (f) setPhotoPreview(URL.createObjectURL(f)); }} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="First Name" required value={firstName} onChange={setFirstName} />
          <Input label="Last Name" value={lastName} onChange={setLastName} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Gender" options={['Male', 'Female', 'Other']} />
          <Input label="Date of Birth" type="date" />
        </div>
        <Select label="Experience Level" options={['Beginner (0-1 yr)', 'Intermediate (1-3 yrs)', 'Advanced (3-5 yrs)', 'Expert (5+ yrs)']} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Employee ID" placeholder="AUTO-GENERATED" />
          <Input label="Join Date" type="date" />
        </div>
      </div>
    ),
    2: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Phone Number" type="tel" required value={phone} onChange={setPhone} />
          <Input label="Alternate Phone" type="tel" />
        </div>
        <Input label="Email Address" type="email" required value={email} onChange={setEmail} />
        <Input label="Emergency Contact Name" />
        <Input label="Emergency Contact Phone" type="tel" />
        <Input label="Address Line 1" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="City" />
          <Input label="State" />
          <Input label="PIN Code" />
        </div>
      </div>
    ),
    3: (
      <div className="space-y-5">
        <div>
          <p className="mb-2.5 text-[12px] font-[700] uppercase tracking-widest" style={{ color: 'rgb(148,163,184)' }}>Coaching Specializations</p>
          <ChipGroup options={SPECIALIZATIONS} selected={specs} onChange={setSpecs} color="#06b6d4" />
        </div>
        <div>
          <p className="mb-2.5 text-[12px] font-[700] uppercase tracking-widest" style={{ color: 'rgb(148,163,184)' }}>Certifications</p>
          <ChipGroup options={CERTIFICATIONS} selected={certs} onChange={setCerts} color="#8b5cf6" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Years of Experience" type="number" value={experience} onChange={setExperience} />
          <Select label="Primary Language" options={['Hindi', 'English', 'Both']} />
        </div>
        <Input label="Bio / About Coach" />
        <DragDropUpload label="Certification Documents" accept=".pdf,.jpg,.png" />
      </div>
    ),
    4: (
      <div className="space-y-4">
        <Select label="Salary Type" options={['Fixed Monthly', 'Per Session', 'Revenue Share', 'Hybrid']} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Base Salary (₹)" type="number" value={salary} onChange={setSalary} />
          <Input label="Session Rate (₹)" type="number" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Revenue Share %" type="number" />
          <Select label="Payment Frequency" options={['Monthly', 'Bi-Weekly', 'Weekly']} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Bank" options={['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'Other']} />
          <Input label="Account Number" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="IFSC Code" />
          <Input label="PAN Number" />
        </div>
        <ToggleSwitch label="Include PF / ESI" sublabel="Statutory deductions applicable" />
        <ToggleSwitch label="Bonus Eligible" sublabel="Performance-based bonus" defaultOn />
      </div>
    ),
    5: (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Shift Start Time" type="time" />
          <Input label="Shift End Time" type="time" />
        </div>
        <div>
          <p className="mb-2.5 text-[12px] font-[700] uppercase tracking-widest" style={{ color: 'rgb(148,163,184)' }}>Working Days</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(function(d) {
              const on = workDays.includes(d);
              return (
                <button key={d} type="button"
                  onClick={function() { setWorkDays(on ? workDays.filter(function(x) { return x !== d; }) : [...workDays, d]); }}
                  className="h-10 w-12 rounded-[12px] text-[13px] font-[700] transition-all"
                  style={{ background: on ? '#10b981' : 'var(--border)', color: on ? '#fff' : 'rgb(100,116,139)', border: on ? '1.5px solid #10b981' : '1.5px solid transparent', boxShadow: on ? '0 2px 8px rgba(16,185,129,0.25)' : 'none' }}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Max Sessions / Day" type="number" />
          <Input label="Max Clients" type="number" />
        </div>
        <ToggleSwitch label="Available for Weekends" sublabel="Saturday & Sunday availability" defaultOn />
        <ToggleSwitch label="Available for Early Morning" sublabel="Before 7:00 AM shifts" />
      </div>
    ),
    6: (
      <div className="space-y-4">
        <Input label="Monthly Client Target" type="number" />
        <Input label="Monthly Revenue Target (₹)" type="number" />
        <Select label="Studio Access Level" options={['Full Access', 'Floor Only', 'Limited Hours', 'Custom']} />
        <div className="space-y-2">
          <p className="text-[12px] font-[700] uppercase tracking-widest" style={{ color: 'rgb(148,163,184)' }}>Studio Permissions</p>
          <ToggleSwitch label="Manage Own Clients" sublabel="Add/remove client assignments" defaultOn />
          <ToggleSwitch label="View Financial Data" sublabel="Revenue and payment reports" />
          <ToggleSwitch label="Attendance Management" sublabel="Mark and edit attendance" defaultOn />
          <ToggleSwitch label="Content Publishing" sublabel="Post to engagement channels" />
          <ToggleSwitch label="Leave Self-Approval" sublabel="Approve own leave requests" />
        </div>
        <DragDropUpload label="Identity Documents (Aadhaar / PAN)" accept=".pdf,.jpg,.png" />
      </div>
    ),
  };

  return (
    <Guard role="admin">
      <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#f8fafc 0%,#f1f5f9 50%,#f8f4ff 100%)' }}>
      <div className="sticky top-0 z-30 border-b" style={{ background: 'var(--bg-card)', backdropFilter: 'blur(20px)', borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-4">
          <Link href="/trainers"
            className="flex h-9 w-9 items-center justify-center rounded-[11px] transition-all hover:bg-black/5 active:scale-95"
            style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <ChevronLeft size={16} style={{ color: 'rgb(71,85,105)' }} />
          </Link>
          <div className="flex-1">
            <h1 className="text-[16px] font-[800] tracking-[-0.02em]" style={{ color: 'rgb(15,23,42)' }}>Add New Coach</h1>
            <p className="text-[12px]" style={{ color: 'rgb(148,163,184)' }}>Step {step} of {STEPS.length} &mdash; {current.title}</p>
          </div>
          <span className="rounded-full px-3 py-1 text-[11px] font-[700]"
            style={{ background: 'rgba(99,102,241,0.08)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.15)' }}>
            {Math.round(progress)}% complete
          </span>
        </div>
        <div className="h-[2px] w-full" style={{ background: 'var(--border)' }}>
          <div className="h-full transition-all duration-500 ease-out"
            style={{ width: progress + '%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {/* Step navigator */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          {STEPS.map(function(s) {
            return (
              <button key={s.id} onClick={function() { setStep(s.id); }}
                className="flex shrink-0 items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-left transition-all"
                style={{
                  background: step === s.id ? s.color : step > s.id ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.7)',
                  border: step === s.id ? '1.5px solid ' + s.color : step > s.id ? '1.5px solid rgba(16,185,129,0.20)' : '1.5px solid rgba(15,23,42,0.08)',
                  boxShadow: step === s.id ? '0 4px 16px ' + s.color + '30' : 'none',
                }}>
                <span style={{ color: step === s.id ? '#fff' : step > s.id ? '#059669' : 'rgb(148,163,184)' }}>
                  {step > s.id ? <Check size={14} /> : s.icon}
                </span>
                <span className="hidden text-[12px] font-[700] sm:block"
                  style={{ color: step === s.id ? '#fff' : step > s.id ? '#059669' : 'rgb(100,116,139)' }}>
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-[14px] p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.16)' }}>
            <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
            <p className="text-[13px] font-[600]" style={{ color: '#b91c1c' }}>{error}</p>
          </div>
        )}

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[24px] p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 4px 24px rgba(15,23,42,0.07), 0 1px 3px rgba(15,23,42,0.04)', backdropFilter: 'blur(20px)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px]"
                style={{ background: current.color + '14', color: current.color, border: '1.5px solid ' + current.color + '25' }}>
                {current.icon}
              </div>
              <div>
                <h2 className="text-[17px] font-[800] tracking-[-0.02em]" style={{ color: 'rgb(15,23,42)' }}>{current.title}</h2>
                <p className="text-[12.5px]" style={{ color: 'rgb(148,163,184)' }}>{current.subtitle}</p>
              </div>
            </div>
            {stepContent[step]}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={function() { setStep(function(s) { return Math.max(1, s - 1); }); }}
            disabled={step === 1}
            className="flex items-center gap-2 rounded-[14px] px-5 py-3 text-[14px] font-[700] transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(15,23,42,0.10)', color: 'rgb(71,85,105)' }}>
            <ChevronLeft size={16} /> Previous
          </button>

          {step < STEPS.length ? (
            <button type="button" onClick={function() { setStep(function(s) { return Math.min(STEPS.length, s + 1); }); }}
              className="flex items-center gap-2 rounded-[14px] px-6 py-3 text-[14px] font-[700] text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.30)' }}>
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 rounded-[14px] px-6 py-3 text-[14px] font-[700] text-white transition-all active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.30)' }}>
              {submitting ? <span className="animate-spin">&#9696;</span> : <Check size={16} />}
              {submitting ? 'Creating…' : 'Add Coach'}
            </button>
          )}
        </div>
      </div>
    </div></Guard>
  );
}
