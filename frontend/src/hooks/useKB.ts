import { useState, useEffect } from 'react';
import client from '../api/client';
import { KBStatus, KBSource, KBJob } from '../api/types';

export function useKB() {
  const [status, setStatus] = useState<KBStatus | null>(null);
  const [sources, setSources] = useState<KBSource[]>([]);
  const [jobs, setJobs] = useState<KBJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statusRes, sourcesRes, jobsRes] = await Promise.all([
        client.get('/api/kb/status'),
        client.get('/api/kb/sources'),
        client.get('/api/kb/jobs')
      ]);
      setStatus(statusRes.data);
      setSources(sourcesRes.data.items || []);
      setJobs(jobsRes.data.items || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createSource = async (data: any) => {
    const res = await client.post('/api/kb/sources', data);
    await fetchData();
    return res.data;
  };

  const deleteSource = async (id: number) => {
    await client.delete(`/api/kb/sources/${id}`);
    await fetchData();
  };

  const syncSource = async (id: number) => {
    await client.post(`/api/kb/sources/${id}/sync`);
    await fetchData();
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await client.post('/api/kb/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    await fetchData();
    return res.data;
  };

  const searchKB = async (query: string) => {
    const res = await client.post('/api/kb/search', { query });
    return res.data;
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { 
    status, 
    sources, 
    jobs, 
    loading, 
    refresh: fetchData,
    createSource,
    deleteSource,
    syncSource,
    uploadFile,
    searchKB
  };
}
