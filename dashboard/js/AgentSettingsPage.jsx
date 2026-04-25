// ─── Agent Settings Page ─────────────────────────────────────────────────────

const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-live-preview';
const GEMINI_LANGUAGE_OPTIONS = [
  { value: '', label: 'Auto-detect' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'te-IN', label: 'Telugu' },
];

const CFG_DEFAULTS = {
  first_line: "Namaste! This is Aryan from SPX AI. We help businesses automate with AI. Hmm, may I ask what kind of business you run?",
  agent_instructions: "",
  voice_mode: 'gemini_live',
  llm_provider: 'gemini',
  llm_model: GEMINI_DEFAULT_MODEL,
  gemini_live_model: GEMINI_DEFAULT_MODEL, 
  gemini_live_voice: 'Puck', 
  gemini_live_temperature: 0.8, 
  gemini_live_language: '', 
  livekit_url: '',
  livekit_api_key: '', livekit_api_secret: '',
  google_api_key: '',
};

function GeneralTab({ cfg, set }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <C.Input label="Opening Greeting" value={cfg.first_line || ''} onChange={set('first_line')} rows={3}
        hint="The first sentence your agent speaks when a prospect answers." />
      <C.Input label="System Prompt" value={cfg.agent_instructions || ''} onChange={set('agent_instructions')} rows={10} mono
        hint="Full instructions that shape agent personality, goals, and knowledge rules." />
    </div>
  );
}

function ModelsTab({ cfg, set }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <C.SectionTitle>Gemini 3.1 Live API</C.SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <C.Input
          label="Model"
          value={cfg.gemini_live_model || ''}
          onChange={set('gemini_live_model')}
          placeholder={GEMINI_DEFAULT_MODEL}
          hint="Default: Gemini 3.1 Live preview with native input and output audio."
          mono
        />
        <C.Input label="Voice" value={cfg.gemini_live_voice || 'Puck'} onChange={set('gemini_live_voice')} />
        <C.Select
          label="Language"
          value={cfg.gemini_live_language ?? ''}
          onChange={set('gemini_live_language')}
          options={GEMINI_LANGUAGE_OPTIONS}
          hint="Leave on Auto-detect for multilingual campaigns."
        />
        <C.Input label="Temperature" type="number" value={cfg.gemini_live_temperature ?? 0.8} onChange={v => set('gemini_live_temperature')(parseFloat(v))} />
      </div>
    </div>
  );
}

function CredentialsTab({ cfg, set }) {
  const [show, setShow] = React.useState({});
  const toggleShow = k => setShow(p => ({ ...p, [k]: !p[k] }));
  const SecretInput = ({ label, k, hint }) => (
    <div style={{ display: 'grid', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#7b849a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type={show[k] ? 'text' : 'password'} value={cfg[k] || ''} onChange={e => set(k)(e.target.value)}
          style={{ flex: 1, background: '#1a1e28', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e8eaef', fontSize: 13, padding: '9px 12px', fontFamily: 'monospace', outline: 'none' }} />
        <button onClick={() => toggleShow(k)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#7b849a', cursor: 'pointer', padding: '0 12px', fontSize: 12 }}>
          {show[k] ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <span style={{ fontSize: 11, color: '#5a6375' }}>{hint}</span>}
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <C.SectionTitle>LiveKit</C.SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <C.Input label="LiveKit URL" value={cfg.livekit_url || ''} onChange={set('livekit_url')} mono placeholder="wss://…" />
        <SecretInput label="API Key" k="livekit_api_key" />
        <SecretInput label="API Secret" k="livekit_api_secret" />
      </div>
      <C.SectionTitle>Gemini Live</C.SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <SecretInput label="Google API Key" k="google_api_key" hint="Used for Gemini Live audio input and output in this inbound-only build." />
      </div>
    </div>
  );
}

function AgentSettingsPage() {
  const [tab, setTab] = React.useState('General');
  const [cfg, setCfg] = React.useState({ ...CFG_DEFAULTS });
  const [loading, setLoading] = React.useState(true);
  const [saveState, setSaveState] = React.useState('idle'); // idle | saving | saved | error
  const tabs = ['General', 'Models & Voice', 'API Credentials'];
  const set = k => v => setCfg(p => ({ ...p, [k]: v }));

  React.useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => { setCfg(p => ({ ...p, ...data })); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaveState('saving');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const saveLabel = { idle: 'Save Changes', saving: 'Saving…', saved: '✓ Saved', error: '✗ Error' }[saveState];
  const saveVariant = saveState === 'saved' ? 'success' : saveState === 'error' ? 'danger' : 'primary';

  return (
    <div>
      <C.PageHeader title="Agent Settings"
        sub="Configure your voice agent's behaviour, models, and credentials"
        action={<C.Btn variant={saveVariant} onClick={handleSave} disabled={saveState === 'saving'}>{saveLabel}</C.Btn>} />
      <div style={{ marginBottom: 24 }}>
        <C.Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {loading ? <C.Spinner /> : (
        <C.Card style={{ padding: 24 }}>
          {tab === 'General'         && <GeneralTab cfg={cfg} set={set} />}
          {tab === 'Models & Voice'  && <ModelsTab cfg={cfg} set={set} />}
          {tab === 'API Credentials' && <CredentialsTab cfg={cfg} set={set} />}
        </C.Card>
      )}
    </div>
  );
}

Object.assign(window, { AgentSettingsPage });
