import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { requireAuth, AuthUser } from '@/app/api/_auth';

interface AttendanceRecord {
  id: string;
  check_in_time: string;
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
    const { memberId } = body;
    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const record = await queryOne<AttendanceRecord>(
      'SELECT id, check_in_time FROM biometric_attendance WHERE member_id = $1 AND date = $2 AND check_out_time IS NULL',
      [memberId, today],
    );
    if (!record) {
      return NextResponse.json({ error: 'No active check-in found for today' }, { status: 400 });
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const checkInDate = new Date(`${today}T${record.check_in_time}`);
    const durationMin = Math.round((now.getTime() - checkInDate.getTime()) / 60000);

    await execute(
      'UPDATE biometric_attendance SET check_out_time = $1, session_duration_minutes = $2 WHERE id = $3',
      [timeStr, durationMin, record.id],
    );

    return NextResponse.json({ success: true, sessionDurationMinutes: durationMin });
  } catch (err) {
    console.error('Biometric checkout error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
