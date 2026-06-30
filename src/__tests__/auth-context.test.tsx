import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor, screen } from '@testing-library/react';
import { useAuth, AuthProvider } from '@/lib/auth-context';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  mockMe: vi.fn(),
  mockLoginApi: vi.fn(),
  mockLogoutApi: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockResetLock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { auth: { me: mocks.mockMe, login: mocks.mockLoginApi, logout: mocks.mockLogoutApi } },
  User: class {},
}));

vi.mock('@/lib/http', () => ({
  resetRedirectLock: () => mocks.mockResetLock(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.mockRouterReplace }),
}));

beforeEach(() => {
  mocks.mockMe.mockReset();
  mocks.mockLoginApi.mockReset();
  mocks.mockLogoutApi.mockReset();
  mocks.mockRouterReplace.mockReset();
  mocks.mockResetLock.mockReset();
  if (typeof localStorage !== 'undefined') localStorage.clear();
  if (typeof window !== 'undefined' && window.localStorage) window.localStorage.clear();
});

function Probe() {
  const ctx = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="user">{ctx.user ? ctx.user.email : 'none'}</span>
      <button data-testid="logout" onClick={ctx.logout}>logout</button>
    </div>
  );
}

function CaptureApi() {
  const api = useAuth();
  (CaptureApi as unknown as { api: typeof api }).api = api;
  return null;
}

function wrap(node: ReactNode) {
  return render(<AuthProvider>{node}</AuthProvider>);
}

describe('AuthProvider', () => {
  it('starts with loading=true and resolves to null user when me() returns nothing', async () => {
    mocks.mockMe.mockResolvedValue({});
    wrap(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('hydrates from cache immediately then validates with me()', async () => {
    const cached = { id: 'u1', email: 'cached@x.com', role: 'admin' };
    window.sessionStorage.setItem('619_user_minimal_v3', JSON.stringify(cached));
    let resolveMe!: (v: { user: typeof cached }) => void;
    mocks.mockMe.mockReturnValue(new Promise((res) => { resolveMe = res; }));
    wrap(<Probe />);
    expect(screen.getByTestId('user').textContent).toBe('cached@x.com');
    await act(async () => { resolveMe({ user: cached }); });
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('cached@x.com');
  });

  it('clears cached user on 401 from me()', async () => {
    const cached = { id: 'u1', email: 'cached@x.com', role: 'admin' };
    window.sessionStorage.setItem('619_user_minimal_v3', JSON.stringify(cached));
    mocks.mockMe.mockRejectedValue({ status: 401, message: 'no' });
    wrap(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(window.sessionStorage.getItem('619_user_minimal_v3')).toBeNull();
  });

  it('keeps cached user on 5xx from me()', async () => {
    const cached = { id: 'u1', email: 'cached@x.com', role: 'admin' };
    window.sessionStorage.setItem('619_user_minimal_v3', JSON.stringify(cached));
    mocks.mockMe.mockRejectedValue({ status: 503, message: 'down' });
    wrap(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('cached@x.com');
  });

  it('login() sets the user and clears loading immediately', async () => {
    mocks.mockMe.mockResolvedValue({});
    const fresh = { id: 'u2', email: 'fresh@x.com', role: 'admin' };
    mocks.mockLoginApi.mockResolvedValue({ user: fresh });
    wrap(<CaptureApi />);
    await waitFor(() => expect((CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api.loading).toBe(false));
    await act(async () => {
      await (CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api.login('fresh@x.com', 'pw');
    });
    const api = (CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api;
    expect(api.user?.email).toBe('fresh@x.com');
    expect(api.loading).toBe(false);
    expect(mocks.mockResetLock).toHaveBeenCalled();
  });

  it('logout() clears the user and stored cache', async () => {
    mocks.mockMe.mockResolvedValue({});
    mocks.mockLogoutApi.mockResolvedValue(undefined);
    wrap(<CaptureApi />);
    await waitFor(() => expect((CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api.loading).toBe(false));
    await act(async () => {
      (CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api.logout();
    });
    const api = (CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api;
    expect(api.user).toBeNull();
    expect(window.sessionStorage.getItem('619_user_minimal_v3')).toBeNull();
  });

  it('responds to session-expired event by clearing state and routing to /login', async () => {
    mocks.mockMe.mockResolvedValue({});
    mocks.mockLogoutApi.mockResolvedValue(undefined);
    const u = { id: 'u3', email: 'e@x.com', role: 'admin' };
    mocks.mockLoginApi.mockResolvedValue({ user: u });
    wrap(<CaptureApi />);
    await waitFor(() => expect((CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api.loading).toBe(false));
    await act(async () => {
      await (CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api.login('e@x.com', 'pw');
    });
    expect((CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api.user).not.toBeNull();
    act(() => {
      window.dispatchEvent(new CustomEvent('session-expired'));
    });
    await waitFor(() =>
      expect((CaptureApi as unknown as { api: ReturnType<typeof useAuth> }).api.user).toBeNull(),
    );
    expect(mocks.mockRouterReplace).toHaveBeenCalledWith('/login');
  });
});
