import client from '../client';

export interface DispatchSingleResult {
  status: 'ok' | 'error';
  message?: string;
  room?: string;
}

export interface DispatchBulkResult {
  results: Array<{
    phone: string;
    status: 'ok' | 'error';
    message?: string;
    room?: string;
  }>;
}

export async function dispatchSingleCall(phone: string, name: string): Promise<DispatchSingleResult> {
  const res = await client.post<DispatchSingleResult>('/api/outbound/call', {
    phone_number: phone,
    caller_name: name,
  });
  return res.data;
}

export async function dispatchBulkCalls(payload: { phone_numbers: string }): Promise<DispatchBulkResult> {
  const res = await client.post<DispatchBulkResult>('/api/outbound/bulk', payload);
  return res.data;
}
