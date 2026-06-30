import { NextRequest, NextResponse } from 'next/server';

export interface AuthUser {
  sub: string;
  role: string;
  [key: string]: unknown;
}

export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const token = req.cookies.get('token')?.value;
  if (!token) {
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Verify by calling the backend auth endpoint
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';
  try {
    const res = await fetch(`${backendUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return await res.json();
  } catch (e) {
    if (e instanceof NextResponse) throw e;
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
