import { useState, useEffect } from 'react';
import client from '../api/client';
import { CallLog } from '../api/types';

export function useLogs() {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await client.get<CallLog[]>('/api/logs');
      setLogs(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTranscript = async (logId: string) => {
    try {
      const response = await client.get(`/api/logs/${logId}/transcript`, {
        responseType: 'text'
      });
      return response.data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return { logs, loading, error, fetchLogs, getTranscript };
}
