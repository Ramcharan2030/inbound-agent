import client from '../client';
import type { Appointment } from '../types';

export async function fetchAppointments(): Promise<Appointment[]> {
  const res = await client.get<Appointment[]>('/api/appointments');
  return res.data;
}

export async function createAppointment(data: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>): Promise<Appointment> {
  const res = await client.post<Appointment>('/api/appointments', data);
  return res.data;
}

export async function cancelAppointment(id: string, reason: string): Promise<void> {
  await client.post(`/api/appointments/${id}/cancel`, { reason });
}
