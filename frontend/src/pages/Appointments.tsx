import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Search, XCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, Table, Th, Td, Badge, Button, Input, Modal, PageHeader, EmptyState } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAppointments } from '../hooks/useAppointments';
import { Appointment } from '../api/types';

const StatusBadge = ({ status }: { status: Appointment['status'] }) => {
  const config = {
    scheduled: { variant: 'info' as const,    icon: CalendarIcon,   label: 'Scheduled' },
    completed: { variant: 'success' as const,  icon: CheckCircle2,   label: 'Completed' },
    cancelled: { variant: 'danger' as const,   icon: XCircle,        label: 'Cancelled' },
  };
  const { variant, icon: Icon, label } = config[status] || config.scheduled;
  return (
    <Badge variant={variant} className="gap-1.5">
      <Icon size={11} />
      {label}
    </Badge>
  );
};

export const Appointments = () => {
  const { appointments, loading, cancelAppointment, createAppointment } = useAppointments();
  const { success, error: toastError } = useToast();
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [form, setForm] = useState({
    contact_name: '',
    contact_phone: '',
    scheduled_start: '',
    title: 'Site Visit',
    notes: '',
  });

  const filtered = appointments.filter(
    (a) =>
      a.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      a.contact_phone.includes(search) ||
      a.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCancel = async () => {
    if (!cancellingId) return;
    setCancelling(true);
    try {
      await cancelAppointment(cancellingId, cancelReason);
      success('Visit Cancelled', 'The site visit has been cancelled successfully.');
      setCancellingId(null);
      setCancelReason('');
    } catch (err: any) {
      toastError('Cancellation Failed', err.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleCreate = async () => {
    if (!form.contact_name.trim() || !form.contact_phone.trim() || !form.scheduled_start) {
      toastError('Missing Fields', 'Please fill in customer name, phone number, and visit time.');
      return;
    }
    const start = new Date(form.scheduled_start);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    setCreating(true);
    try {
      await createAppointment({
        title: form.title || 'Site Visit',
        contact_name: form.contact_name.trim(),
        contact_phone: form.contact_phone.trim(),
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        timezone: 'Asia/Kolkata',
        status: 'scheduled',
        source: 'manual_ui',
        notes: form.notes.trim(),
      });
      success('Site Visit Created', `Scheduled for ${format(start, 'MMM d, HH:mm')}.`);
      setForm({ contact_name: '', contact_phone: '', scheduled_start: '', title: 'Site Visit', notes: '' });
      setIsCreateModalOpen(false);
    } catch (err: any) {
      toastError('Creation Failed', err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Visits"
        subtitle="Manage property inquiries, scheduled visits, and customer bookings."
        icon={CalendarIcon}
        iconColor="text-emerald-400"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <Input
                placeholder="Search visits..."
                className="pl-9 w-52 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className="gap-2">
              <Plus size={15} />
              New Visit
            </Button>
          </div>
        }
      />

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Date & Time</Th>
              <Th>Customer</Th>
              <Th>Inquiry</Th>
              <Th>Status</Th>
              <Th>Source</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3].map((i) => (
                <tr key={i}>
                  <Td><div className="h-4 skeleton w-28" /></Td>
                  <Td><div className="h-4 skeleton w-24" /></Td>
                  <Td><div className="h-4 skeleton w-32" /></Td>
                  <Td><div className="h-5 skeleton w-20 rounded-full" /></Td>
                  <Td><div className="h-5 skeleton w-16 rounded-full" /></Td>
                  <Td><div className="h-8 skeleton w-16 ml-auto" /></Td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={CalendarIcon}
                    title="No site visits found"
                    description={search ? 'Try a different search term.' : 'Site visits booked by the AI agent or manually will appear here.'}
                    action={
                      <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                        <Plus size={14} />
                        Create Visit
                      </Button>
                    }
                  />
                </Td>
              </tr>
            ) : (
              filtered.map((app) => (
                <tr key={app.id} className="hover:bg-[#0e0f14]/60 transition-colors">
                  <Td>
                    <div className="font-medium text-white">{format(new Date(app.scheduled_start), 'MMM d, HH:mm')}</div>
                    <div className="text-xs text-zinc-600 mt-0.5">{app.timezone}</div>
                  </Td>
                  <Td>
                    <div className="font-medium text-zinc-100">{app.contact_name}</div>
                    <div className="text-xs text-zinc-600 mt-0.5">{app.contact_phone}</div>
                  </Td>
                  <Td>
                    <div className="font-medium text-white">{app.title}</div>
                    {app.notes && (
                      <div className="text-xs text-zinc-600 max-w-xs truncate mt-0.5">{app.notes}</div>
                    )}
                  </Td>
                  <Td><StatusBadge status={app.status} /></Td>
                  <Td>
                    <Badge variant="default" className="capitalize">{app.source.replace(/_/g, ' ')}</Badge>
                  </Td>
                  <Td className="text-right">
                    {app.status === 'scheduled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
                        onClick={() => setCancellingId(app.id)}
                      >
                        <XCircle size={13} />
                        Cancel
                      </Button>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Cancel Modal */}
      <Modal isOpen={!!cancellingId} onClose={() => setCancellingId(null)} title="Cancel Site Visit">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/15">
            <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-zinc-400">
              Are you sure you want to cancel this site visit? This action cannot be undone.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Reason for cancellation (optional)
            </label>
            <Input
              placeholder="e.g. Customer rescheduled via phone"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setCancellingId(null)}>Keep Visit</Button>
            <Button variant="danger" onClick={handleCancel} isLoading={cancelling}>
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Site Visit">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Customer Name</label>
              <Input
                placeholder="Asha Sharma"
                value={form.contact_name}
                onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Phone Number</label>
              <Input
                placeholder="+91..."
                value={form.contact_phone}
                onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Property / Project</label>
            <Input
              placeholder="e.g. Green Meadows 2BHK"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Visit Time</label>
            <Input
              type="datetime-local"
              value={form.scheduled_start}
              onChange={(e) => setForm((p) => ({ ...p, scheduled_start: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Inquiry Notes</label>
            <textarea
              className="flex w-full rounded-lg border border-[#252833] bg-[#0e0f14] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[90px] transition-all"
              placeholder="Budget, preferred area, property type, special requests…"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} isLoading={creating}>Create Site Visit</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
