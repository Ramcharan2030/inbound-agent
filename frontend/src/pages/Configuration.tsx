import React, { useState } from 'react';
import { Save, RefreshCw, Cpu, Phone, ShieldCheck, Database, MessageSquare, Settings } from 'lucide-react';
import { Card, Button, Input, Textarea, PageHeader, cn } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useConfig } from '../hooks/useConfig';
import type { Config } from '../api/types';

const CONFIG_TABS = [
  { id: 'agent',        icon: MessageSquare, label: 'Assistant',    desc: 'Greeting, instructions, session limits' },
  { id: 'gemini',       icon: Cpu,           label: 'Gemini AI',    desc: 'Model, voice, temperature, timeouts' },
  { id: 'voice',        icon: Phone,         label: 'Voice & SIP',  desc: 'LiveKit server, API keys, SIP trunk' },
  { id: 'integrations', icon: ShieldCheck,   label: 'API Keys',     desc: 'Google, Supabase, Telegram' },
  { id: 'kb',           icon: Database,      label: 'Knowledge Base', desc: 'Vector search, embedding, retrieval' },
] as const;

const FieldGroup = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</label>
    {children}
    {hint && <p className="text-xs text-zinc-700">{hint}</p>}
  </div>
);

const SectionTitle = ({ title }: { title: string }) => (
  <div className="pt-2 pb-1">
    <h4 className="text-sm font-semibold text-zinc-300">{title}</h4>
    <div className="h-px bg-[#1c1e27] mt-2" />
  </div>
);

export const Configuration = () => {
  const { config, loading, saving, updateConfig, refresh } = useConfig();
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<typeof CONFIG_TABS[number]['id']>('agent');
  const [formData, setFormData] = useState<Partial<Config>>({});

  React.useEffect(() => {
    if (config) setFormData(config);
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val =
      type === 'number'   ? parseFloat(value) :
      type === 'checkbox' ? (e.target as HTMLInputElement).checked :
      value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async () => {
    const result = await updateConfig(formData as Config);
    if (result.success) {
      success('Saved', 'Configuration has been saved and will take effect on the next call.');
    } else {
      toastError('Save Failed', result.error || 'Could not save configuration.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 skeleton w-48 rounded-xl" />
        <div className="flex gap-6">
          <div className="w-52 space-y-2">
            {[1,2,3,4,5].map((i) => <div key={i} className="h-14 skeleton rounded-xl" />)}
          </div>
          <div className="flex-1 h-96 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  const activeTabInfo = CONFIG_TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration"
        subtitle="Manage agent behavior, AI models, and service integrations."
        icon={Settings}
        iconColor="text-blue-400"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
              <RefreshCw size={14} />
              Reload
            </Button>
            <Button size="sm" onClick={handleSubmit} isLoading={saving} className="gap-2 px-5">
              <Save size={14} />
              Save Changes
            </Button>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab sidebar */}
        <div className="lg:w-56 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 lg:shrink-0">
          {CONFIG_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-start gap-3 px-3.5 py-3 rounded-xl text-left transition-all duration-150 whitespace-nowrap lg:whitespace-normal w-full shrink-0',
                  isActive
                    ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#13141a] border border-transparent'
                )}
              >
                <Icon size={16} className={cn('mt-0.5 shrink-0', isActive ? 'text-blue-400' : 'text-zinc-600')} />
                <div className="hidden lg:block">
                  <p className="text-sm font-semibold leading-none">{tab.label}</p>
                  <p className="text-[11px] mt-1 leading-tight opacity-60">{tab.desc}</p>
                </div>
                <span className="lg:hidden text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Config panel */}
        <div className="flex-1 min-w-0">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-[#1c1e27]">
              {React.createElement(activeTabInfo.icon, { size: 18, className: 'text-blue-400 shrink-0' })}
              <div>
                <h3 className="font-semibold text-white">{activeTabInfo.label}</h3>
                <p className="text-xs text-zinc-600 mt-0.5">{activeTabInfo.desc}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* ── Agent ── */}
              {activeTab === 'agent' && (
                <>
                  <FieldGroup label="First Line (Greeting)" hint="The very first sentence spoken when the agent picks up the call.">
                    <Input name="first_line" value={formData.first_line || ''} onChange={handleChange} placeholder="Namaste! How can I help you today?" />
                  </FieldGroup>
                  <FieldGroup label="Assistant Instructions" hint="Full system prompt. Be specific about tone, tasks, and constraints.">
                    <Textarea
                      name="agent_instructions"
                      value={formData.agent_instructions || ''}
                      onChange={handleChange}
                      rows={9}
                      placeholder="You are a helpful real-estate receptionist. Qualify the buyer, answer property questions, and book site visits…"
                    />
                  </FieldGroup>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldGroup label="Max Turns" hint="Max conversation exchanges before wrap-up.">
                      <Input type="number" name="max_turns" value={formData.max_turns || 0} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="User Away Timeout (s)" hint="Seconds of silence before session closes.">
                      <Input type="number" name="user_away_timeout" value={formData.user_away_timeout || 0} onChange={handleChange} />
                    </FieldGroup>
                  </div>
                  <FieldGroup label="Session Close Transcript Timeout (s)">
                    <Input type="number" name="session_close_transcript_timeout" value={formData.session_close_transcript_timeout || 0} onChange={handleChange} />
                  </FieldGroup>
                </>
              )}

              {/* ── Gemini ── */}
              {activeTab === 'gemini' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldGroup label="Live Model">
                      <Input name="gemini_live_model" value={formData.gemini_live_model || ''} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="TTS Model">
                      <Input name="gemini_tts_model" value={formData.gemini_tts_model || ''} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Live Voice">
                      <Input name="gemini_live_voice" value={formData.gemini_live_voice || ''} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Language">
                      <Input name="gemini_live_language" value={formData.gemini_live_language || ''} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Temperature" hint="0.0 = deterministic, 1.0 = creative">
                      <Input type="number" step="0.1" min="0" max="2" name="gemini_live_temperature" value={formData.gemini_live_temperature || 0} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Language Preset">
                      <Input name="lang_preset" value={formData.lang_preset || ''} onChange={handleChange} />
                    </FieldGroup>
                  </div>
                  <SectionTitle title="Timeout & Retry Settings" />
                  <div className="grid grid-cols-3 gap-4">
                    <FieldGroup label="Preflight (s)">
                      <Input type="number" name="gemini_live_preflight_timeout" value={formData.gemini_live_preflight_timeout || 0} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Connect (s)">
                      <Input type="number" name="gemini_live_connect_timeout" value={formData.gemini_live_connect_timeout || 0} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Retries">
                      <Input type="number" name="gemini_live_connect_retries" value={formData.gemini_live_connect_retries || 0} onChange={handleChange} />
                    </FieldGroup>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="checkbox"
                      id="gemini_live_preflight_enabled"
                      name="gemini_live_preflight_enabled"
                      checked={formData.gemini_live_preflight_enabled || false}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-[#252833] bg-[#0e0f14] text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="gemini_live_preflight_enabled" className="text-sm font-medium text-zinc-300">Enable Preflight Check</label>
                  </div>
                </>
              )}

              {/* ── Voice & SIP ── */}
              {activeTab === 'voice' && (
                <>
                  <FieldGroup label="LiveKit Server URL">
                    <Input name="livekit_url" value={formData.livekit_url || ''} onChange={handleChange} placeholder="wss://..." />
                  </FieldGroup>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldGroup label="LiveKit API Key">
                      <Input name="livekit_api_key" value={formData.livekit_api_key || ''} onChange={handleChange} type="password" />
                    </FieldGroup>
                    <FieldGroup label="LiveKit API Secret">
                      <Input name="livekit_api_secret" value={formData.livekit_api_secret || ''} onChange={handleChange} type="password" />
                    </FieldGroup>
                  </div>
                  <FieldGroup label="SIP Trunk ID">
                    <Input name="sip_trunk_id" value={formData.sip_trunk_id || ''} onChange={handleChange} />
                  </FieldGroup>
                </>
              )}

              {/* ── Integrations ── */}
              {activeTab === 'integrations' && (
                <>
                  <FieldGroup label="Google API Key (Gemini)">
                    <Input name="google_api_key" value={formData.google_api_key || ''} onChange={handleChange} type="password" />
                  </FieldGroup>
                  <SectionTitle title="Supabase" />
                  <div className="grid grid-cols-2 gap-4">
                    <FieldGroup label="Supabase URL">
                      <Input name="supabase_url" value={formData.supabase_url || ''} onChange={handleChange} placeholder="https://xxx.supabase.co" />
                    </FieldGroup>
                    <FieldGroup label="Supabase Anon Key">
                      <Input name="supabase_key" value={formData.supabase_key || ''} onChange={handleChange} type="password" />
                    </FieldGroup>
                  </div>
                  <SectionTitle title="Telegram Notifications" />
                  <div className="grid grid-cols-2 gap-4">
                    <FieldGroup label="Bot Token">
                      <Input name="telegram_bot_token" value={formData.telegram_bot_token || ''} onChange={handleChange} type="password" />
                    </FieldGroup>
                    <FieldGroup label="Chat ID">
                      <Input name="telegram_chat_id" value={formData.telegram_chat_id || ''} onChange={handleChange} />
                    </FieldGroup>
                  </div>
                </>
              )}

              {/* ── Knowledge Base ── */}
              {activeTab === 'kb' && (
                <>
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0a0b0f] border border-[#1c1e27]">
                    <input
                      type="checkbox"
                      id="kb_enabled"
                      name="kb_enabled"
                      checked={formData.kb_enabled || false}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-[#252833] bg-[#0e0f14] text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="kb_enabled" className="text-sm font-semibold text-white cursor-pointer">Enable Knowledge Base</label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldGroup label="Backend">
                      <Input name="kb_backend" value={formData.kb_backend || ''} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Data Directory">
                      <Input name="kb_data_dir" value={formData.kb_data_dir || ''} onChange={handleChange} />
                    </FieldGroup>
                  </div>
                  <SectionTitle title="Retrieval Settings" />
                  <div className="grid grid-cols-3 gap-4">
                    <FieldGroup label="Top K">
                      <Input type="number" name="kb_top_k" value={formData.kb_top_k || 0} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Similarity Threshold">
                      <Input type="number" step="0.01" name="kb_similarity_threshold" value={formData.kb_similarity_threshold || 0} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Live Timeout (ms)">
                      <Input type="number" name="kb_live_timeout_ms" value={formData.kb_live_timeout_ms || 0} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Context Budget (chars)">
                      <Input type="number" name="kb_context_char_budget" value={formData.kb_context_char_budget || 0} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Chunk Size">
                      <Input type="number" name="kb_chunk_size" value={formData.kb_chunk_size || 0} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Chunk Overlap">
                      <Input type="number" name="kb_chunk_overlap" value={formData.kb_chunk_overlap || 0} onChange={handleChange} />
                    </FieldGroup>
                  </div>
                  <SectionTitle title="Embedding" />
                  <div className="grid grid-cols-2 gap-4">
                    <FieldGroup label="Provider">
                      <Input name="kb_embedding_provider" value={formData.kb_embedding_provider || ''} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Model">
                      <Input name="kb_embedding_model" value={formData.kb_embedding_model || ''} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Fallback Provider">
                      <Input name="kb_embedding_fallback_provider" value={formData.kb_embedding_fallback_provider || ''} onChange={handleChange} />
                    </FieldGroup>
                    <FieldGroup label="Fallback Model">
                      <Input name="kb_embedding_fallback_model" value={formData.kb_embedding_fallback_model || ''} onChange={handleChange} />
                    </FieldGroup>
                  </div>
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0a0b0f] border border-[#1c1e27]">
                    <input
                      type="checkbox"
                      id="kb_rerank_enabled"
                      name="kb_rerank_enabled"
                      checked={formData.kb_rerank_enabled || false}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-[#252833] bg-[#0e0f14] text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="kb_rerank_enabled" className="text-sm font-semibold text-white cursor-pointer">Enable Re-ranking</label>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
