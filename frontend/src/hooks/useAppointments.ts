import { useState, useEffect } from 'react';
import client from '../api/client';
import { Appointment } from '../api/types';

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await client.get<Appointment[]>('/api/appointments');
      setAppointments(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAppointment = async (data: Partial<Appointment>) => {
    try {
      const response = await client.post('/api/appointments', data);
      await fetchAppointments();
      return response.data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const updateAppointment = async (id: string, data: Partial<Appointment>) => {
    try {
      const response = await client.patch(`/api/appointments/${id}`, data);
      await fetchAppointments();
      return response.data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const cancelAppointment = async (id: string, reason: string) => {
    try {
      const response = await client.post(`/api/appointments/${id}/cancel`, { reason });
      await fetchAppointments();
      return response.data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  return { 
    appointments, 
    loading, 
    error, 
    refresh: fetchAppointments, 
    createAppointment, 
    updateAppointment, 
    cancelAppointment 
  };
}
