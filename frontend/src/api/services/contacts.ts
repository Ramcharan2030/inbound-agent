import client from '../client';
import type { Contact } from '../types';

export async function fetchContacts(): Promise<Contact[]> {
  const res = await client.get<Contact[]>('/api/contacts');
  return res.data;
}
