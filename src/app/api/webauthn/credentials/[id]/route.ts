import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { requireAuth, AuthUser } from '@/app/api/_auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user: AuthUser;
  try {
    user = await requireAuth(req);
  } catch (e) {
    return e as NextResponse;
  }
  try {
    const { id } = await params;
    await execute('DELETE FROM webauthn_credentials WHERE credential_id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete credential error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
