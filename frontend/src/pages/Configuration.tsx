import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Cpu, Phone, ShieldCheck, Database, MessageSquare } from 'lucide-react';
import { Card, Button, Input, cn } from '../components/ui';
import { useConfig } from '../hooks/useConfig';
import type { Config } from '../api/types';

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap",
      active 
        ? "bg-blue-600/10 text-blue-500 border border-blue-500/20" 
        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
    )}
  >
    <Icon size={18} />
    {label}
  </button>
);

export const Configuration = () => {
  const { config, loading, saving, updateConfig, refresh } = useConfig();
  const [activeTab, setActiveTab] = useState('agent');
  const [formData, setFormData] = useState<Partial<Config>>({});
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  React.useEffect(() => {
    if (config) setFormData(config);
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'number' ? parseFloat(value) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    const result = await updateConfig(formData as Config);
    if (result.success) {
      setSaveStatus({ type: 'success', message: 'Configuration saved successfully' });
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus({ type: 'error', message: result.error || 'Failed to save configuration' });
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-6"><div className="h-10 w-48 bg-zinc-900 rounded" /><div className="h-96 bg-zinc-900 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Configuration</h2>
          <p className="text-zinc-400 mt-1">Manage agent behavior, AI models, and service integrations.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={refresh} className="gap-2">
            <RefreshCw size={18} />
            Reload
          </Button>
          <Button onClick={handleSubmit} isLoading={saving} className="gap-2 px-6">
            <Save size={18} />
            Save Changes
          </Button>
        </div>
      </div>

      {saveStatus && (
        <div className={cn(
          "p-4 rounded-lg flex items-center gap-3 border animate-in fade-in slide-in-from-top-4",
          saveStatus.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
        )}>
          {saveStatus.message}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0">
          <TabButton active={activeTab === 'agent'} onClick={() => setActiveTab('agent')} icon={MessageSquare} label="Agent Behavior" />
          <TabButton active={activeTab === 'gemini'} onClick={() => setActiveTab('gemini')} icon={Cpu} label="Gemini AI" />
          <TabButton active={activeTab === 'voice'} onClick={() => setActiveTab('voice')} icon={Phone} label="Voice & SIP" />
          <TabButton active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} icon={ShieldCheck} label="API Keys" />
          <TabButton active={activeTab === 'kb'} onClick={() => setActiveTab('kb')} icon={Database} label="Knowledge Base" />
        </div>

        <div className="flex-1">
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {activeTab === 'agent' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">First Line (Greeting)</label>
                    <Input name="first_line" value={formData.first_line || ''} onChange={handleChange} placeholder="Namaste! How can I help you today?" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Agent Instructions</label>
                    <textarea 
                      name="agent_instructions" 
                      value={formData.agent_instructions || ''} 
                      onChange={handleChange}
                      rows={8}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                      placeholder="You are a helpful AI receptionist..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Max Turns</label>
                      <Input type="number" name="max_turns" value={formData.max_turns || 0} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">User Away Timeout (s)</label>
                      <Input type="number" name="user_away_timeout" value={formData.user_away_timeout || 0} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'gemini' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Live Model</label>
                      <Input name="gemini_live_model" value={formData.gemini_live_model || ''} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Live Voice</label>
                      <Input name="gemini_live_voice" value={formData.gemini_live_voice || ''} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Temperature</label>
                      <Input type="number" step="0.1" name="gemini_live_temperature" value={formData.gemini_live_temperature || 0} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Language</label>
                      <Input name="gemini_live_language" value={formData.gemini_live_language || ''} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-zinc-800">
                    <h4 className="text-sm font-semibold text-white mb-4">Timeout Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Preflight (s)</label>
                        <Input type="number" name="gemini_live_preflight_timeout" value={formData.gemini_live_preflight_timeout || 0} onChange={handleChange} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Connect (s)</label>
                        <Input type="number" name="gemini_live_connect_timeout" value={formData.gemini_live_connect_timeout || 0} onChange={handleChange} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Retries</label>
                        <Input type="number" name="gemini_live_connect_retries" value={formData.gemini_live_connect_retries || 0} onChange={handleChange} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'voice' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">LiveKit Server URL</label>
                    <Input name="livekit_url" value={formData.livekit_url || ''} onChange={handleChange} placeholder="wss://..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">LiveKit API Key</label>
                      <Input name="livekit_api_key" value={formData.livekit_api_key || ''} onChange={handleChange} type="password" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">LiveKit API Secret</label>
                      <Input name="livekit_api_secret" value={formData.livekit_api_secret || ''} onChange={handleChange} type="password" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">SIP Trunk ID</label>
                    <Input name="sip_trunk_id" value={formData.sip_trunk_id || ''} onChange={handleChange} />
                  </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Google API Key (Gemini)</label>
                    <Input name="google_api_key" value={formData.google_api_key || ''} onChange={handleChange} type="password" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Supabase URL</label>
                      <Input name="supabase_url" value={formData.supabase_url || ''} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Supabase Key</label>
                      <Input name="supabase_key" value={formData.supabase_key || ''} onChange={handleChange} type="password" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-zinc-800">
                    <h4 className="text-sm font-semibold text-white mb-4">Telegram Notifications</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Bot Token</label>
                        <Input name="telegram_bot_token" value={formData.telegram_bot_token || ''} onChange={handleChange} type="password" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Chat ID</label>
                        <Input name="telegram_chat_id" value={formData.telegram_chat_id || ''} onChange={handleChange} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'kb' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <input 
                      type="checkbox" 
                      id="kb_enabled" 
                      name="kb_enabled" 
                      checked={formData.kb_enabled || false} 
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="kb_enabled" className="text-sm font-medium text-white">Enable Knowledge Base</label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Backend</label>
                      <Input name="kb_backend" value={formData.kb_backend || ''} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Data Directory</label>
                      <Input name="kb_data_dir" value={formData.kb_data_dir || ''} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Top K</label>
                      <Input type="number" name="kb_top_k" value={formData.kb_top_k || 0} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Similarity Threshold</label>
                      <Input type="number" step="0.01" name="kb_similarity_threshold" value={formData.kb_similarity_threshold || 0} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Live Timeout (ms)</label>
                      <Input type="number" name="kb_live_timeout_ms" value={formData.kb_live_timeout_ms || 0} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              )}
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
