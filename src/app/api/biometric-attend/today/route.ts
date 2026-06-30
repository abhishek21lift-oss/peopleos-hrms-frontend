import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, AuthUser } from '@/app/api/_auth';

interface AttendanceRow {
  id: string;
  member_id: string;
  member_name: string;
  check_in_time: string;
  verification_method: string;
  device_name: string;
  attendance_status: string;
}

export async function GET(req: NextRequest) {
  let user: AuthUser;
  try {
    user = await requireAuth(req);
  } catch (e) {
    return e as NextResponse;
  }
  try {
    const today = new Date().toISOString().slice(0, 10);

    const allRows = await query<AttendanceRow>(
      'SELECT id, member_id, member_name, check_in_time, verification_method, device_name, attendance_status FROM biometric_attendance WHERE date = $1 ORDER BY check_in_time DESC',
      [today],
    );

    const present = allRows.filter((r) => r.attendance_status === 'present').length;
    const late = allRows.filter((r) => r.attendance_status === 'late').length;
    const total = allRows.length;

    const feed = allRows.slice(0, 50).map((r) => ({
      id: r.id,
      memberName: r.member_name || r.member_id,
      checkInTime: r.check_in_time,
      verificationMethod: r.verification_method,
      deviceName: r.device_name,
    }));

    return NextResponse.json({
      present,
      absent: 0,
      late,
      active: total,
      feed,
    });
  } catch (err) {
    console.error('Today stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
