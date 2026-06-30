import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { verifyRegResponse } from '@/lib/webauthn-server';
import { requireAuth, AuthUser } from '@/app/api/_auth';

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
    const body = await req.json();
    const { memberId, deviceName, credentialId, rawId, attestationObject, clientDataJSON } = body;

    if (!memberId || !deviceName || !credentialId || !attestationObject || !clientDataJSON) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const challengeRow = await queryOne<ChallengeRow>(
      "SELECT challenge FROM webauthn_challenges WHERE member_id = $1 AND type = 'registration' AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
      [memberId],
    );
    if (!challengeRow) {
      return NextResponse.json({ error: 'No valid challenge found. Please start enrollment again.' }, { status: 400 });
    }

    const verification = await verifyRegResponse(
      {
        id: credentialId,
        rawId,
        response: { attestationObject, clientDataJSON },
        type: 'public-key',
      },
      challengeRow.challenge,
    );

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 });
    }

    const publicKey = Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64url');

    await execute(
      'INSERT INTO webauthn_credentials (member_id, credential_id, device_name, public_key) VALUES ($1, $2, $3, $4) ON CONFLICT (credential_id) DO UPDATE SET device_name = $3',
      [memberId, credentialId, deviceName, publicKey],
    );

    await execute('DELETE FROM webauthn_challenges WHERE challenge = $1', [challengeRow.challenge]);

    return NextResponse.json({ success: true, credential: { id: credentialId } });
  } catch (err) {
    console.error('WebAuthn register complete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
