import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, AuthUser } from '@/app/api/_auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user: AuthUser;
  try {
    user = await requireAuth(req);
  } catch (e) {
    return e as NextResponse;
  }
  try {
    const { id: memberId } = await params;
    const range = req.nextUrl.searchParams.get('range') || 'all';
    const date = req.nextUrl.searchParams.get('date');

    const cols = 'id, member_id, member_name, date, check_in_time, check_out_time, day, gps_lat, gps_lng, verification_method, device_name, attendance_status, session_duration_minutes, created_at';
    let sql: string;
    let sqlParams: unknown[];

    if (date) {
      sql = `SELECT ${cols} FROM biometric_attendance WHERE member_id = $1 AND date = $2 ORDER BY check_in_time DESC`;
      sqlParams = [memberId, date];
    } else if (range === 'monthly') {
      const month = (date || new Date().toISOString().slice(0, 7)).slice(0, 7);
      sql = `SELECT ${cols} FROM biometric_attendance WHERE member_id = $1 AND to_char(date, 'YYYY-MM') = $2 ORDER BY date DESC`;
      sqlParams = [memberId, month];
    } else {
      sql = `SELECT ${cols} FROM biometric_attendance WHERE member_id = $1 ORDER BY date DESC, check_in_time DESC LIMIT 100`;
      sqlParams = [memberId];
    }

    const records = await query(sql, sqlParams);
    return NextResponse.json({ records });
  } catch (err) {
    console.error('Member history error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
