import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, AuthUser } from '@/app/api/_auth';

interface WebAuthnCredential {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
}

export async function GET(req: NextRequest) {
  let user: AuthUser;
  try {
    user = await requireAuth(req);
  } catch (e) {
    return e as NextResponse;
  }
  try {
    const memberId = req.nextUrl.searchParams.get('member_id');
    if (!memberId) {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 });
    }
    const creds = await query<WebAuthnCredential>(
      'SELECT id, credential_id, device_name, created_at, last_used_at FROM webauthn_credentials WHERE member_id = $1 ORDER BY created_at DESC',
      [memberId],
    );
    return NextResponse.json({
      credentials: creds.map((c) => ({
        id: c.credential_id,
        deviceName: c.device_name,
        createdAt: c.created_at,
        lastUsedAt: c.last_used_at,
      })),
    });
  } catch (err) {
    console.error('List credentials error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
