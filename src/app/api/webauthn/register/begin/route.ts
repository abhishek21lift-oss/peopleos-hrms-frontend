import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateRegOptions, RP_ID } from '@/lib/webauthn-server';
import { requireAuth, AuthUser } from '@/app/api/_auth';
import crypto from 'crypto';

interface CredentialRow {
  credential_id: string;
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

    await execute("DELETE FROM webauthn_challenges WHERE expires_at < now()");

    const existingCreds = await query<CredentialRow>(
      'SELECT credential_id FROM webauthn_credentials WHERE member_id = $1',
      [memberId],
    );

    const options = await generateRegOptions(
      { id: memberId, name: memberId, displayName: memberId },
      existingCreds.map((c) => ({ id: c.credential_id })),
    );

    const challenge = options.challenge;
    await execute(
      'INSERT INTO webauthn_challenges (challenge, member_id, type, expires_at) VALUES ($1, $2, $3, $4)',
      [challenge, memberId, 'registration', new Date(Date.now() + 120000).toISOString()],
    );

    return NextResponse.json({
      challenge: options.challenge,
      rp: options.rp,
      user: {
        id: memberId,
        name: memberId,
        displayName: memberId,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      attestation: options.attestation,
      authenticatorSelection: options.authenticatorSelection,
      excludeCredentials: options.excludeCredentials?.map((c) => ({
        id: c.id,
        type: 'public-key',
      })),
    });
  } catch (err) {
    console.error('WebAuthn register begin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
