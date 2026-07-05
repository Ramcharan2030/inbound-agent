import client from '../client';
import type { Stats } from '../types';

export async function fetchStats(): Promise<Stats> {
  const res = await client.get<Stats>('/api/stats');
  return res.data;
}
