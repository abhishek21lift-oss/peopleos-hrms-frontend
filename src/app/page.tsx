'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import PtOsDashboard from '@/components/dashboards/PtOsDashboard';

export default function Root() {
  const { user } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!ready) return null;

  return (
    <Guard>
      <AppShell>
        <PtOsDashboard />
      </AppShell>
    </Guard>
  );
}
