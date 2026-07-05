'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type User } from './api';
import { resetRedirectLock } from './http';
import type { Role } from './roles';
export type { Role } from './roles';

interface Ctx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<Ctx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

const SESSION_USER_KEY = '619_user_minimal_v3';

function ssGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function ssSet(key: string, val: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(key, val); } catch { /* quota */ }
}
function ssDel(key: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(key); } catch { /* noop */ }
}

// Read the cached user synchronously at render time so child components
// see the correct user on the very first render (no flash, no spinner).
function readCachedUser(): User | null {
  const raw = ssGet(SESSION_USER_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { id: string; name: string; role: string };
    return { id: p.id, name: p.name, role: p.role as Role, email: '' };
  } catch { ssDel(SESSION_USER_KEY); return null; }
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ME_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialise synchronously from sessionStorage:
  // - user: cached minimal profile (or null for new visitors)
  // - loading: true only when there is NO cached session (server check needed before rendering)
  const [user,    setUser]    = useState<User | null>(readCachedUser);
  const [loading, setLoading] = useState<boolean>(() => ssGet(SESSION_USER_KEY) === null);
  const router = useRouter();

  const loggedInRef = useRef(false);
  const initDone    = useRef(false);

  const _clearSession = useCallback(function () {
    loggedInRef.current = false;
    api.auth.logout?.().catch((_err) => console.warn('[auth] logout failed', _err));
    setUser(null);
    ssDel(SESSION_USER_KEY);
  }, []);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    // Race the server check against a timeout so the UI is never blocked
    // indefinitely by a slow or unreachable backend (Render cold start etc.).
    const meTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('me_timeout')), ME_TIMEOUT_MS)
    );

    Promise.race([api.auth.me(), meTimeout])
      .then((res) => {
        if (loggedInRef.current) return;
        if (res?.user) {
          const u = res.user as User;
          setUser(u);
          ssSet(SESSION_USER_KEY, JSON.stringify({ id: u.id, name: u.name, role: u.role }));
        } else {
          setUser(null);
          ssDel(SESSION_USER_KEY);
        }
      })
      .catch((err: unknown) => {
        if (loggedInRef.current) return;
        const status = (err as { status?: number })?.status;
        if (status === 401 || status === 403) {
          setUser(null);
          ssDel(SESSION_USER_KEY);
        }
        // timeout / network error: keep cached user silently
      })
      .finally(() => {
        if (!loggedInRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    function onSessionExpired() {
      _clearSession();
      router.replace('/login');
    }
    window.addEventListener('session-expired', onSessionExpired);
    return () => window.removeEventListener('session-expired', onSessionExpired);
  }, [_clearSession, router]);

  useEffect(() => {
    if (!user) return;
    let idleTimer: ReturnType<typeof setTimeout>;
    function resetIdleTimer() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        _clearSession();
        router.replace('/login');
      }, SESSION_TIMEOUT_MS);
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();
    return () => {
      clearTimeout(idleTimer);
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
    };
  }, [user, _clearSession, router]);

  const login = useCallback(async function (email: string, password: string): Promise<void> {
    const data = await api.auth.login(email, password);
    resetRedirectLock();
    loggedInRef.current = true;
    const u = data.user;
    setUser(u);
    ssSet(SESSION_USER_KEY, JSON.stringify({ id: u.id, name: u.name, role: u.role }));
    setLoading(false);
  }, []);

  const logout = useCallback(function (): void {
    _clearSession();
  }, [_clearSession]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
