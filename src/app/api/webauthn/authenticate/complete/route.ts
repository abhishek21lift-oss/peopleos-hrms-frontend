import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { verifyAuthResponse } from '@/lib/webauthn-server';
import { requireAuth, AuthUser } from '@/app/api/_auth';
import { checkRateLimit } from '@/app/api/_ratelimit';

interface WebAuthnCredential {
  id: string;
  credential_id: string;
  public_key: string;
  sign_count: number;
  transports: string;
  member_id: string;
  member_name: string;
}

interface ChallengeRow {
  challenge: string;
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { credentialId, rawId, authenticatorData, signature, clientDataJSON, userHandle } = body;

    if (!credentialId || !rawId || !authenticatorData || !signature || !clientDataJSON) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const challengeRow = await queryOne<ChallengeRow>(
      "SELECT challenge FROM webauthn_challenges WHERE type = 'authentication' AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
    );
    if (!challengeRow) {
      return NextResponse.json({ error: 'No valid challenge found. Please try again.' }, { status: 400 });
    }

    const credRow = await queryOne<WebAuthnCredential>(
      'SELECT credential_id, public_key, sign_count, member_id, member_name FROM webauthn_credentials WHERE credential_id = $1',
      [credentialId],
    );
    if (!credRow) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 400 });
    }

    const verification = await verifyAuthResponse(
      {
        id: credentialId,
        rawId,
        response: { authenticatorData, signature, clientDataJSON, userHandle },
        type: 'public-key',
      },
      challengeRow.challenge,
      {
        id: credRow.credential_id,
        publicKey: new Uint8Array(Buffer.from(credRow.public_key, 'base64url')),
        counter: credRow.sign_count || 0,
        transports: ['internal'],
      },
    );

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication verification failed' }, { status: 400 });
    }

    const newCounter = verification.authenticationInfo.newCounter;
    await execute(
      'UPDATE webauthn_credentials SET last_used_at = now(), sign_count = $2 WHERE credential_id = $1',
      [credentialId, newCounter],
    );
    await execute('DELETE FROM webauthn_challenges WHERE challenge = $1', [challengeRow.challenge]);

    return NextResponse.json({
      success: true,
      memberId: credRow.member_id,
      memberName: credRow.member_name || undefined,
    });
  } catch (err) {
    console.error('WebAuthn authenticate complete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
