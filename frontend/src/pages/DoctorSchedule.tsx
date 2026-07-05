import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday } from 'date-fns';
import {
  CalendarDays, ChevronLeft, ChevronRight, BanIcon, CheckCircle2,
  Bell, Phone, Clock, User, AlertTriangle, Building2, Save,
  RefreshCw, XCircle, Calendar
} from 'lucide-react';
import { Card, Badge, Button, Input, Modal, PageHeader } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useSchedule, useBlockedDays, useNotifications } from '../hooks/useDoctorSchedule';
import { ScheduleDay, BlockedDay } from '../api/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(t: string | null) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

function toDateKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

// ── Appointment Notifications Panel ──────────────────────────────────────────

function NotificationsPanel() {
  const { notifications, loading, refresh } = useNotifications(10000);

  const typeConfig = {
    booking:   { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2, label: 'New Booking' },
    cancelled: { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         icon: XCircle,     label: 'Cancelled' },
    completed: { color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',        icon: CheckCircle2, label: 'Completed' },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-blue-400" />
          <h3 className="text-base font-semibold text-white">Site Visit Notifications</h3>
          <span className="text-xs text-zinc-500 ml-1">Auto-refreshes every 10s</span>
        </div>
        <button onClick={refresh} className="text-zinc-500 hover:text-white transition-colors p-1 rounded">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '520px' }}>
        {loading && notifications.length === 0 ? (
          [1,2,3].map(i => (
            <div key={i} className="animate-pulse h-20 bg-zinc-800/50 rounded-xl" />
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell size={32} className="text-zinc-700 mb-3" />
            <p className="text-zinc-500 text-sm">No site visit notifications yet.</p>
            <p className="text-zinc-600 text-xs mt-1">Bookings made by the agent or manually will appear here.</p>
          </div>
        ) : (
          notifications.map((n) => {
            const cfg = typeConfig[n.type] || typeConfig.booking;
            const Icon = cfg.icon;
            return (
              <div key={`${n.id}-${n.created_at}`} className={`rounded-xl border p-3 ${cfg.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon size={16} className={`${cfg.color} mt-0.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-zinc-500 shrink-0">
                        {n.created_at ? format(new Date(n.created_at), 'MMM d, HH:mm') : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <User size={12} className="text-zinc-400 shrink-0" />
                      <span className="text-sm font-medium text-white truncate">{n.contact_name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Phone size={12} className="text-zinc-400 shrink-0" />
                      <span className="text-xs text-zinc-400">{n.contact_phone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock size={12} className="text-zinc-400 shrink-0" />
                      <span className="text-xs text-zinc-300">
                        {n.scheduled_start ? format(new Date(n.scheduled_start), 'EEE, MMM d · h:mm a') : '—'}
                      </span>
                    </div>
                    {n.notes && (
                      <p className="text-xs text-zinc-500 mt-1 truncate">{n.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Weekly Schedule Editor ────────────────────────────────────────────────────

function ScheduleEditor() {
  const { schedule, loading, saving, updateDay } = useSchedule();
  const [localSchedule, setLocalSchedule] = useState<ScheduleDay[]>([]);
  const [savedDays, setSavedDays] = useState<Set<number>>(new Set());

  React.useEffect(() => {
    if (schedule.length) setLocalSchedule(JSON.parse(JSON.stringify(schedule)));
  }, [schedule]);

  const handleChange = (dayIdx: number, field: keyof ScheduleDay, value: any) => {
    setLocalSchedule(prev => prev.map((d, i) => i === dayIdx ? { ...d, [field]: value } : d));
    setSavedDays(prev => { const n = new Set(prev); n.delete(dayIdx); return n; });
  };

  const { success: toastSuccess, error: toastError } = useToast();

  const handleSaveDay = async (day: ScheduleDay, idx: number) => {
    try {
      await updateDay(day.day_of_week, {
        morning_start: day.morning_start,
        morning_end: day.morning_end,
        afternoon_start: day.afternoon_start,
        afternoon_end: day.afternoon_end,
        is_active: day.is_active,
      });
      setSavedDays(prev => new Set(prev).add(idx));
      toastSuccess('Schedule Saved', `${day.day_name} hours updated.`);
      setTimeout(() => setSavedDays(prev => { const n = new Set(prev); n.delete(idx); return n; }), 2000);
    } catch (e: any) {
      toastError('Save Failed', e.message);
    }
  };

  if (loading) return <div className="space-y-3">{[0,1,2,3,4,5,6].map(i => <div key={i} className="h-14 bg-zinc-800/50 animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-2">
      {localSchedule.map((day, idx) => (
        <div
          key={day.day_of_week}
          className={`rounded-xl border p-3 transition-all ${day.is_active ? 'border-zinc-700/60 bg-zinc-900/40' : 'border-zinc-800/40 bg-zinc-900/20 opacity-60'}`}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle + Day Name */}
            <div className="flex items-center gap-2 w-28 shrink-0">
              <button
                onClick={() => handleChange(idx, 'is_active', !day.is_active)}
                className={`w-9 h-5 rounded-full transition-colors relative ${day.is_active ? 'bg-blue-600' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${day.is_active ? 'left-4' : 'left-0.5'}`} />
              </button>
              <span className="text-sm font-semibold text-zinc-200 w-16">{day.day_name}</span>
            </div>

            {day.is_active ? (
              <>
                {/* Morning Session */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500 w-16 shrink-0">Morning</span>
                  <input
                    type="time"
                    value={day.morning_start || ''}
                    onChange={e => handleChange(idx, 'morning_start', e.target.value || null)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-zinc-600 text-xs">to</span>
                  <input
                    type="time"
                    value={day.morning_end || ''}
                    onChange={e => handleChange(idx, 'morning_end', e.target.value || null)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Afternoon Session */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500 w-16 shrink-0">Afternoon</span>
                  <input
                    type="time"
                    value={day.afternoon_start || ''}
                    onChange={e => handleChange(idx, 'afternoon_start', e.target.value || null)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-zinc-600 text-xs">to</span>
                  <input
                    type="time"
                    value={day.afternoon_end || ''}
                    onChange={e => handleChange(idx, 'afternoon_end', e.target.value || null)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            ) : (
              <span className="text-xs text-zinc-600 italic">Closed all day</span>
            )}

            {/* Save button */}
            <button
              onClick={() => handleSaveDay(day, idx)}
              disabled={saving}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                savedDays.has(idx)
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                  : 'bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600/20'
              }`}
            >
              {savedDays.has(idx) ? <><CheckCircle2 size={12} /> Saved</> : <><Save size={12} /> Save</>}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { blockedDays, loading, blockDay, unblockDay } = useBlockedDays(year, month);

  const blockedSet = useMemo(() => {
    return new Set(blockedDays.map(b => b.blocked_date));
  }, [blockedDays]);

  const blockedReasonMap = useMemo(() => {
    const m: Record<string, BlockedDay> = {};
    blockedDays.forEach(b => { m[b.blocked_date] = b; });
    return m;
  }, [blockedDays]);

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Pad to start on Monday
  const startPad = useMemo(() => {
    const d = getDay(startOfMonth(currentDate));
    return d === 0 ? 6 : d - 1; // Mon=0, Sun=6
  }, [currentDate]);

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setBlockReason('');
    setIsModalOpen(true);
  };

  const { success: toastSuccess, error: toastError } = useToast();

  const handleBlock = async () => {
    if (!selectedDay) return;
    setActionLoading(true);
    try {
      await blockDay(toDateKey(selectedDay), blockReason);
      toastSuccess('Day Blocked', format(selectedDay, 'MMM d') + ' is now unavailable for visits.');
      setIsModalOpen(false);
    } catch (e: any) {
      toastError('Block Failed', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!selectedDay) return;
    setActionLoading(true);
    try {
      await unblockDay(toDateKey(selectedDay));
      toastSuccess('Day Unblocked', format(selectedDay, 'MMM d') + ' is now available for visits.');
      setIsModalOpen(false);
    } catch (e: any) {
      toastError('Unblock Failed', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const selectedKey = selectedDay ? toDateKey(selectedDay) : '';
  const selectedIsBlocked = blockedSet.has(selectedKey);
  const selectedBlockedInfo = blockedReasonMap[selectedKey];

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-base font-semibold text-white">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-zinc-500 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {/* Padding cells */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {days.map(day => {
          const key = toDateKey(day);
          const isBlocked = blockedSet.has(key);
          const isCurrentDay = isToday(day);
          const inMonth = isSameMonth(day, currentDate);

          return (
            <button
              key={key}
              onClick={() => handleDayClick(day)}
              className={`
                relative rounded-xl p-2 text-center transition-all group min-h-[52px] flex flex-col items-center justify-center gap-0.5
                ${isBlocked
                  ? 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20'
                  : isCurrentDay
                    ? 'bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30'
                    : 'bg-zinc-900/40 border border-zinc-800/60 hover:bg-zinc-800/60 hover:border-zinc-700'
                }
                ${!inMonth ? 'opacity-30' : ''}
              `}
            >
              <span className={`text-sm font-semibold ${isBlocked ? 'text-red-300' : isCurrentDay ? 'text-blue-300' : 'text-zinc-200'}`}>
                {format(day, 'd')}
              </span>
              {isBlocked && (
                <span className="text-[9px] font-bold text-red-400 uppercase tracking-wide">Blocked</span>
              )}
              {isCurrentDay && !isBlocked && (
                <span className="w-1 h-1 rounded-full bg-blue-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
          <span className="text-xs text-zinc-500">Visit blocked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-600/20 border border-blue-500/30" />
          <span className="text-xs text-zinc-500">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-zinc-900/40 border border-zinc-800/60" />
          <span className="text-xs text-zinc-500">Available</span>
        </div>
      </div>

      {/* Block / Unblock Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedDay ? format(selectedDay, 'EEEE, MMMM d, yyyy') : ''}
      >
        {selectedDay && (
          <div className="space-y-4">
            {selectedIsBlocked ? (
              <>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <BanIcon size={18} className="text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-300">This day is blocked</p>
                    {selectedBlockedInfo?.reason && (
                      <p className="text-xs text-red-400/80 mt-1">Reason: {selectedBlockedInfo.reason}</p>
                    )}
                    <p className="text-xs text-zinc-500 mt-1">The AI agent will not accept site visit bookings for this date.</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
                  <button
                    onClick={handleUnblock}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} />
                    {actionLoading ? 'Unblocking...' : 'Unblock This Day'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40">
                  <Calendar size={18} className="text-zinc-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-zinc-300">
                    Block this day to prevent the AI agent from accepting new site visits. 
                    The sales team will be shown as unavailable.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Reason (optional)</label>
                  <Input
                    placeholder="e.g. Team offsite, project event, holiday, maintenance..."
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                  <button
                    onClick={handleBlock}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <BanIcon size={15} />
                    {actionLoading ? 'Blocking...' : 'Block This Day'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export const DoctorSchedule = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Visit Schedule"
        subtitle="Manage site visit hours, block unavailable days, and view visit booking notifications."
        icon={Building2}
        iconColor="text-blue-400"
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <AlertTriangle size={16} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-300/80">
          The AI agent uses this schedule in real-time. Changes to working hours or blocked days take effect immediately on the next call.
        </p>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar — spans 1 col */}
        <div className="xl:col-span-1">
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <CalendarDays size={18} className="text-violet-400" />
              <h3 className="text-base font-semibold text-white">Block Days</h3>
            </div>
            <CalendarView />
          </div>
        </div>

        {/* Schedule Editor — spans 1 col */}
        <div className="xl:col-span-1">
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <Clock size={18} className="text-amber-400" />
              <h3 className="text-base font-semibold text-white">Working Hours</h3>
            </div>
            <ScheduleEditor />
          </div>
        </div>

        {/* Notifications — spans 1 col */}
        <div className="xl:col-span-1">
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
            <NotificationsPanel />
          </div>
        </div>
      </div>
    </div>
  );
};
