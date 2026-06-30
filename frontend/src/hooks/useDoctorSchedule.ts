import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { ScheduleDay, BlockedDay, AppointmentNotification } from '../api/types';

// ── Weekly Schedule ───────────────────────────────────────────────────────────

export function useSchedule() {
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.get<{ schedule: ScheduleDay[] }>('/api/schedule');
      setSchedule(res.data.schedule || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDay = useCallback(async (dayOfWeek: number, payload: Partial<ScheduleDay>) => {
    setSaving(true);
    try {
      await client.post(`/api/schedule/${dayOfWeek}`, payload);
      await fetchSchedule();
    } catch (err: any) {
      throw new Error(err.message);
    } finally {
      setSaving(false);
    }
  }, [fetchSchedule]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  return { schedule, loading, saving, error, refresh: fetchSchedule, updateDay };
}

// ── Blocked Days ──────────────────────────────────────────────────────────────

export function useBlockedDays(year: number, month: number) {
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBlocked = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.get<{ blocked_days: BlockedDay[] }>(
        `/api/schedule/blocked?year=${year}&month=${month}`
      );
      setBlockedDays(res.data.blocked_days || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const blockDay = useCallback(async (blocked_date: string, reason: string) => {
    await client.post('/api/schedule/blocked', { blocked_date, reason });
    await fetchBlocked();
  }, [fetchBlocked]);

  const unblockDay = useCallback(async (blocked_date: string) => {
    await client.delete(`/api/schedule/blocked/${blocked_date}`);
    await fetchBlocked();
  }, [fetchBlocked]);

  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  return { blockedDays, loading, error, refresh: fetchBlocked, blockDay, unblockDay };
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function useNotifications(pollMs = 10000) {
  const [notifications, setNotifications] = useState<AppointmentNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await client.get<{ notifications: AppointmentNotification[] }>('/api/notifications?limit=50');
      setNotifications(res.data.notifications || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, pollMs);
    return () => clearInterval(id);
  }, [fetchNotifications, pollMs]);

  return { notifications, loading, refresh: fetchNotifications };
}
