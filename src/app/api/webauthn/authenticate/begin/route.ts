import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateAuthOptions } from '@/lib/webauthn-server';
import { requireAuth, AuthUser } from '@/app/api/_auth';
import { checkRateLimit } from '@/app/api/_ratelimit';

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
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(`${ip}:webauthn-auth`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const memberId = req.nextUrl.searchParams.get('member_id');

    await execute("DELETE FROM webauthn_challenges WHERE expires_at < now()");

    let creds: CredentialRow[];
    if (memberId) {
      creds = await query<CredentialRow>(
        'SELECT credential_id FROM webauthn_credentials WHERE member_id = $1',
        [memberId],
      );
    } else {
      creds = await query<CredentialRow>('SELECT credential_id FROM webauthn_credentials');
    }

    const options = await generateAuthOptions(
      creds.map((c) => ({ id: c.credential_id })),
    );

    const challenge = options.challenge;
    await execute(
      'INSERT INTO webauthn_challenges (challenge, member_id, type, expires_at) VALUES ($1, $2, $3, $4)',
      [challenge, memberId || null, 'authentication', new Date(Date.now() + 120000).toISOString()],
    );

    return NextResponse.json({
      challenge: options.challenge,
      allowCredentials: options.allowCredentials?.map((c) => ({
        id: c.id,
        type: 'public-key',
      })) || [],
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: options.userVerification,
    });
  } catch (err) {
    console.error('WebAuthn authenticate begin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
