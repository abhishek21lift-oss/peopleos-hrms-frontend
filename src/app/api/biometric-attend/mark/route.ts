import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { requireAuth, AuthUser } from '@/app/api/_auth';
import { checkRateLimit } from '@/app/api/_ratelimit';

interface GymSettings {
  geofence_lat: number;
  geofence_lng: number;
  geofence_radius: number;
  enable_gps: boolean;
  duplicate_window_minutes: number;
}

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
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(`${ip}:biometric`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const { memberId, memberName, verificationMethod, deviceName, latitude, longitude } = body;

    if (!memberId || !verificationMethod) {
      return NextResponse.json({ error: 'memberId and verificationMethod are required' }, { status: 400 });
    }

    const settings = await queryOne<GymSettings>('SELECT geofence_lat, geofence_lng, geofence_radius, enable_gps, duplicate_window_minutes FROM gym_settings WHERE id = 1');
    if (!settings) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (settings.enable_gps && latitude && longitude) {
      const R = 6371000;
      const dLat = ((latitude - settings.geofence_lat) * Math.PI) / 180;
      const dLng = ((longitude - settings.geofence_lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((settings.geofence_lat * Math.PI) / 180) * Math.cos((latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist > settings.geofence_radius) {
        return NextResponse.json({
          success: false,
          error: `You are ${Math.round(dist)}m from the gym (limit: ${settings.geofence_radius}m).`,
        });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const existing = await queryOne<AttendanceRecord>(
      'SELECT id, check_in_time FROM biometric_attendance WHERE member_id = $1 AND date = $2',
      [memberId, today],
    );
    if (existing) {
      const elapsed = (Date.now() - new Date(`${today}T${existing.check_in_time}`).getTime()) / 60000;
      if (elapsed < settings.duplicate_window_minutes) {
        return NextResponse.json({
          success: false,
          error: `Already checked in. Duplicate window: ${settings.duplicate_window_minutes} minutes.`,
        });
      }
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = now.getHours();
    const status = hour >= 10 ? 'late' : 'present';

    const inserted = await queryOne<AttendanceRecord>(
      `INSERT INTO biometric_attendance (member_id, member_name, date, check_in_time, day, gps_lat, gps_lng, verification_method, device_name, attendance_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [memberId, memberName || '', today, timeStr, day, latitude || null, longitude || null, verificationMethod, deviceName || '', status],
    );

    return NextResponse.json({ success: true, attendanceId: inserted?.id });
  } catch (err) {
    console.error('Biometric mark error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
