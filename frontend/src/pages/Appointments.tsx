import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Search, 
  Clock, 
  XCircle, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Card, Table, Th, Td, Badge, Button, Input, Modal } from '../components/ui';
import { useAppointments } from '../hooks/useAppointments';
import { Appointment } from '../api/types';

export const Appointments = () => {
  const { appointments, loading, cancelAppointment } = useAppointments();
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const filtered = appointments.filter(a => 
    a.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    a.contact_phone.includes(search) ||
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCancel = async () => {
    if (!cancellingId) return;
    try {
      await cancelAppointment(cancellingId, cancelReason);
      setCancellingId(null);
      setCancelReason('');
    } catch (err) {
      alert("Failed to cancel: " + (err as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Appointments</h2>
          <p className="text-zinc-400 mt-1">Manage scheduled bookings and customer visits.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <Input 
              placeholder="Search appointments..." 
              className="pl-10 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus size={18} />
            New Appointment
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Date & Time</Th>
              <Th>Customer</Th>
              <Th>Appointment</Th>
              <Th>Status</Th>
              <Th>Source</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><Td colSpan={6}><div className="h-12 bg-zinc-800 rounded" /></Td></tr>)
            ) : filtered.length === 0 ? (
              <tr><Td colSpan={6} className="text-center py-12 text-zinc-500">No appointments found.</Td></tr>
            ) : (
              filtered.map(app => (
                <tr key={app.id} className="hover:bg-zinc-900/50 transition-colors">
                  <Td>
                    <div className="font-medium text-white">{format(new Date(app.scheduled_start), 'MMM d, HH:mm')}</div>
                    <div className="text-xs text-zinc-500">{app.timezone}</div>
                  </Td>
                  <Td>
                    <div className="font-medium text-zinc-100">{app.contact_name}</div>
                    <div className="text-xs text-zinc-500">{app.contact_phone}</div>
                  </Td>
                  <Td>
                    <div className="font-medium text-white">{app.title}</div>
                    <div className="text-xs text-zinc-500 max-w-xs truncate">{app.notes}</div>
                  </Td>
                  <Td>
                    {app.status === 'scheduled' && <Badge variant="info">Scheduled</Badge>}
                    {app.status === 'completed' && <Badge variant="success">Completed</Badge>}
                    {app.status === 'cancelled' && <Badge variant="danger">Cancelled</Badge>}
                  </Td>
                  <Td>
                    <Badge variant="default" className="capitalize">{app.source.replace('_', ' ')}</Badge>
                  </Td>
                  <Td className="text-right">
                    {app.status === 'scheduled' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setCancellingId(app.id)}
                      >
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

      {/* Cancel Confirmation Modal */}
      <Modal 
        isOpen={!!cancellingId} 
        onClose={() => setCancellingId(null)} 
        title="Cancel Appointment"
      >
        <div className="space-y-4">
          <p className="text-zinc-400">Are you sure you want to cancel this appointment? This action cannot be undone.</p>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Reason for cancellation</label>
            <Input 
              placeholder="e.g. Customer rescheduled via phone" 
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setCancellingId(null)}>Keep Appointment</Button>
            <Button variant="danger" onClick={handleCancel}>Confirm Cancellation</Button>
          </div>
        </div>
      </Modal>

      {/* Create Modal - Simplified for now */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Create New Appointment"
      >
        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-medium text-zinc-400">Customer Name</label>
               <Input placeholder="Asha" />
             </div>
             <div className="space-y-2">
               <label className="text-sm font-medium text-zinc-400">Phone Number</label>
               <Input placeholder="+91..." />
             </div>
           </div>
           <div className="space-y-2">
             <label className="text-sm font-medium text-zinc-400">Start Time</label>
             <Input type="datetime-local" />
           </div>
           <div className="space-y-2">
             <label className="text-sm font-medium text-zinc-400">Notes</label>
             <textarea className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 min-h-[100px]" />
           </div>
           <div className="flex justify-end gap-3">
             <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
             <Button onClick={() => setIsCreateModalOpen(false)}>Create Appointment</Button>
           </div>
        </div>
      </Modal>
    </div>
  );
};
