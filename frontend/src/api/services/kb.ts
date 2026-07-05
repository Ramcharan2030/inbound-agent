import client from '../client';
import type { KBStatus, KBSource, KBJob, KBSearchResult } from '../types';

export interface KBSourcePayload {
  source_type: 'web_url' | 'pdf_upload';
  title: string;
  source_url?: string;
  enabled?: boolean;
}

export async function fetchKBStatus(): Promise<KBStatus> {
  const res = await client.get<KBStatus>('/api/kb/status');
  return res.data;
}

export async function fetchKBSources(): Promise<KBSource[]> {
  const res = await client.get<{ items: KBSource[] }>('/api/kb/sources');
  return res.data.items || [];
}

export async function fetchKBJobs(): Promise<KBJob[]> {
  const res = await client.get<{ items: KBJob[] }>('/api/kb/jobs');
  return res.data.items || [];
}

export async function createKBSource(data: KBSourcePayload): Promise<KBSource> {
  const res = await client.post<KBSource>('/api/kb/sources', data);
  return res.data;
}

export async function deleteKBSource(id: number): Promise<void> {
  await client.delete(`/api/kb/sources/${id}`);
}

export async function syncKBSource(id: number): Promise<void> {
  await client.post(`/api/kb/sources/${id}/sync`);
}

export async function uploadKBFile(file: File): Promise<KBSource> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await client.post<KBSource>('/api/kb/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function searchKB(query: string): Promise<KBSearchResult> {
  const res = await client.post<KBSearchResult>('/api/kb/search', { query });
  return res.data;
}
