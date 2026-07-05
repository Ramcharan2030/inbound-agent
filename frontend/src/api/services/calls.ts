import client from '../client';
import type { CallLog } from '../types';

export async function fetchLogs(): Promise<CallLog[]> {
  const res = await client.get<CallLog[]>('/api/logs');
  return res.data;
}

export async function fetchTranscript(logId: string): Promise<string> {
  const res = await client.get<string>(`/api/logs/${logId}/transcript`, {
    responseType: 'text',
  });
  return res.data;
}
