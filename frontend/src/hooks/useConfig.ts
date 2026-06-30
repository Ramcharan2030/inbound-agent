import { useState, useEffect } from 'react';
import client from '../api/client';
import { Config } from '../api/types';

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await client.get('/api/config');
      // The API returns the config object directly
      setConfig(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (newConfig: Config) => {
    try {
      setSaving(true);
      await client.post('/api/config', newConfig);
      setConfig(newConfig);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return { config, loading, saving, error, updateConfig, refresh: fetchConfig };
}
