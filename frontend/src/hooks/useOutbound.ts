import { useState } from 'react';
import client from '../api/client';

export function useOutbound() {
  const [loading, setLoading] = useState(false);

  const dispatchSingle = async (phone: string, name: string) => {
    setLoading(true);
    try {
      const res = await client.post('/api/call/single', { phone, caller_name: name });
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  const dispatchBulk = async (data: { numbers?: string[], phone_numbers?: string }) => {
    setLoading(true);
    try {
      const res = await client.post('/api/call/bulk', data);
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  return { dispatchSingle, dispatchBulk, loading };
}
