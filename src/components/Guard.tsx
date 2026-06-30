'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { hasRole, normaliseRole } from '@/lib/roles';
import type { Role } from '@/lib/roles';

interface Props {
  children: React.ReactNode;
  role?: Role;
  roles?: Role[];
}

export default function Guard({ children, role, roles }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!hasRole(user.role, roles ?? role)) {
      router.replace('/login?unauthorized=true');
      return;
    }

    setReady(true);
  }, [user, loading, role, roles, router]);

  if (loading || !ready) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          background: 'var(--bg-canvas)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--brand-lo)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px var(--brand-glow)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="animate-spin" style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--brand-soft)', borderTopColor: 'var(--brand-lo)' }} />

          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Loading
          </div>
        </div>
      </div>
    );
  }

  if (!user || !hasRole(user.role, roles ?? role)) {
    return null;
  }

  return <>{children}</>;
}
