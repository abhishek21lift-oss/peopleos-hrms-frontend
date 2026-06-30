import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, AuthUser } from '@/app/api/_auth';

interface AttendanceRow {
  member_id: string;
  member_name: string;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
  day: string;
  verification_method: string;
  device_name: string;
  attendance_status: string;
  gps_lat: number | null;
  gps_lng: number | null;
}

export async function GET(req: NextRequest) {
  let user: AuthUser;
  try {
    user = await requireAuth(req);
  } catch (e) {
    return e as NextResponse;
  }
  try {
    const range = req.nextUrl.searchParams.get('range') || 'daily';
    const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const format = req.nextUrl.searchParams.get('format') || 'csv';

    const cols = 'member_id, member_name, date, check_in_time, check_out_time, day, verification_method, device_name, attendance_status, gps_lat, gps_lng';
    let sql: string;
    let params: unknown[];
    if (range === 'monthly') {
      const month = date.slice(0, 7);
      sql = `SELECT ${cols} FROM biometric_attendance WHERE to_char(date, 'YYYY-MM') = $1 ORDER BY date, check_in_time`;
      params = [month];
    } else if (range === 'weekly') {
      const d = new Date(date);
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      sql = `SELECT ${cols} FROM biometric_attendance WHERE date >= $1 AND date <= $2 ORDER BY date, check_in_time`;
      params = [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
    } else {
      sql = `SELECT ${cols} FROM biometric_attendance WHERE date = $1 ORDER BY check_in_time`;
      params = [date];
    }

    const records = await query<AttendanceRow>(sql, params);

    if (format === 'csv') {
      const header = 'Member ID,Member Name,Date,Check In,Check Out,Day,Method,Device,Status,Lat,Lng\n';
      const rows = records.map((r) =>
        [r.member_id, r.member_name, r.date, r.check_in_time, r.check_out_time || '', r.day, r.verification_method, r.device_name, r.attendance_status, r.gps_lat || '', r.gps_lng || ''].join(',')
      ).join('\n');
      return new NextResponse(header + rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="attendance-${range}-${date}.csv"`,
        },
      });
    }

    return NextResponse.json({ records, total: records.length });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
