import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const RP_NAME = '619 ERP';
const RP_ID = process.env.NEXT_PUBLIC_APP_DOMAIN ||
  (process.env.VERCEL_URL ? process.env.VERCEL_URL.split(':')[0] : 'localhost');
const ORIGIN = process.env.NEXT_PUBLIC_APP_DOMAIN
  ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

export { RP_NAME, RP_ID, ORIGIN };

export async function generateRegOptions(user: { id: string; name: string; displayName: string }, excludeCredentials: { id: string }[]) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.name,
    userDisplayName: user.displayName,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: excludeCredentials.map((c) => ({
      id: c.id,
      transports: ['internal'],
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'required',
    },
  });
}

export async function verifyRegResponse(credential: any, expectedChallenge: string) {
  return verifyRegistrationResponse({
    response: credential,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });
}

export async function generateAuthOptions(allowCredentials: { id: string }[]) {
  return generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: allowCredentials.map((c) => ({
      id: c.id,
      transports: ['internal'],
    })),
    userVerification: 'required',
  });
}

export async function verifyAuthResponse(response: any, expectedChallenge: string, credential: any) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential,
  });
}
