// Shared misc pages: language presets and demo link

const PRESETS = [
  { id: 'multilingual', label: 'Multilingual (Auto-detect)', desc: 'Detect the caller language and adapt naturally across Indian campaigns.', sttLanguage: 'unknown', ttsLanguage: 'hi-IN', ttsVoice: 'kavya', geminiLiveLanguage: '' },
  { id: 'hinglish', label: 'Hinglish', desc: 'Mix Hindi and English naturally for conversational Indian sales calls.', sttLanguage: 'hi-IN', ttsLanguage: 'hi-IN', ttsVoice: 'kavya', geminiLiveLanguage: '' },
  { id: 'english', label: 'English (India)', desc: 'Indian English only. Fast and consistent for urban prospects.', sttLanguage: 'en-IN', ttsLanguage: 'en-IN', ttsVoice: 'dev', geminiLiveLanguage: 'en-IN' },
  { id: 'hindi', label: 'Hindi', desc: 'Pure Hindi. Best for Tier 2/3 markets.', sttLanguage: 'hi-IN', ttsLanguage: 'hi-IN', ttsVoice: 'ritu', geminiLiveLanguage: 'hi-IN' },
  { id: 'marathi', label: 'Marathi', desc: 'Polite Marathi for Maharashtra-focused outreach.', sttLanguage: 'mr-IN', ttsLanguage: 'mr-IN', ttsVoice: 'shubh', geminiLiveLanguage: 'mr-IN' },
  { id: 'tamil', label: 'Tamil', desc: 'Tamil language for Tamil Nadu campaigns.', sttLanguage: 'ta-IN', ttsLanguage: 'ta-IN', ttsVoice: 'priya', geminiLiveLanguage: 'ta-IN' },
  { id: 'telugu', label: 'Telugu', desc: 'Telugu for Hyderabad and Andhra campaigns.', sttLanguage: 'te-IN', ttsLanguage: 'te-IN', ttsVoice: 'kavya', geminiLiveLanguage: 'te-IN' },
  { id: 'gujarati', label: 'Gujarati', desc: 'Gujarati for western India campaigns and investor outreach.', sttLanguage: 'gu-IN', ttsLanguage: 'gu-IN', ttsVoice: 'rohan', geminiLiveLanguage: '' },
  { id: 'bengali', label: 'Bengali', desc: 'Bengali for Kolkata and east India campaigns.', sttLanguage: 'bn-IN', ttsLanguage: 'bn-IN', ttsVoice: 'neha', geminiLiveLanguage: '' },
  { id: 'kannada', label: 'Kannada', desc: 'Kannada for Bengaluru and Karnataka outreach.', sttLanguage: 'kn-IN', ttsLanguage: 'kn-IN', ttsVoice: 'rahul', geminiLiveLanguage: '' },
  { id: 'malayalam', label: 'Malayalam', desc: 'Malayalam for Kerala prospects and follow-ups.', sttLanguage: 'ml-IN', ttsLanguage: 'ml-IN', ttsVoice: 'ritu', geminiLiveLanguage: '' },
];

function LanguagePage() {
  const [active, setActive] = React.useState('multilingual');
  const [saved, setSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => {
        const presetId = PRESETS.some(p => p.id === cfg.lang_preset) ? cfg.lang_preset : 'multilingual';
        setActive(presetId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      const preset = PRESETS.find(p => p.id === active) || PRESETS[0];
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang_preset: preset.id,
          stt_language: preset.sttLanguage,
          tts_language: preset.ttsLanguage,
          tts_voice: preset.ttsVoice,
          gemini_live_language: preset.geminiLiveLanguage,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div>
      <C.PageHeader title="Language Preset" sub="Select the language configuration for this agent" />
      {loading ? <C.Spinner /> : (
        <div style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
          {PRESETS.map(p => (
            <div key={p.id} onClick={() => setActive(p.id)}
              style={{ border: `1px solid ${active === p.id ? '#5a7ef5' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: '16px 20px', cursor: 'pointer', background: active === p.id ? 'rgba(90,126,245,0.08)' : '#13161e', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${active === p.id ? '#5a7ef5' : 'rgba(255,255,255,0.2)'}`, background: active === p.id ? '#5a7ef5' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {active === p.id && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: active === p.id ? '#5a7ef5' : '#e8eaef' }}>{p.label}</div>
                <div style={{ fontSize: 12, color: '#7b849a', marginTop: 3 }}>{p.desc}</div>
              </div>
            </div>
          ))}
          <C.Btn variant={saved ? 'success' : 'primary'} style={{ width: 'fit-content' }} onClick={handleSave}>{saved ? 'Saved' : 'Save Preset'}</C.Btn>
        </div>
      )}
    </div>
  );
}

function DemoPage() {
  const [generated, setGenerated] = React.useState(false);
  const [label, setLabel] = React.useState('Escala Realty - Property Demo');
  const [expiry, setExpiry] = React.useState('7');
  const [copied, setCopied] = React.useState(false);
  const link = `${window.location.origin}/demo`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <C.PageHeader title="Demo Link" sub="Generate a shareable demo link for prospects or investors" />
      <div style={{ maxWidth: 560, display: 'grid', gap: 20 }}>
        <C.Card style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <C.Input label="Demo Label" value={label} onChange={setLabel} placeholder="Name for this demo link" />
            <C.Select label="Link Expiry" value={expiry} onChange={setExpiry}
              options={[{ value: '1', label: '1 day' }, { value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '0', label: 'Never expires' }]} />
            <C.Btn variant="primary" onClick={() => setGenerated(true)}>Generate Demo Link</C.Btn>
          </div>
        </C.Card>

        {generated && (
          <C.Card style={{ padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7b849a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Your Demo Link</div>
            <div style={{ background: '#1a1e28', border: '1px solid rgba(90,126,245,0.3)', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 13, color: '#a0b0f0', marginBottom: 12, wordBreak: 'break-all' }}>
              {link}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <C.Btn variant="primary" size="sm" onClick={handleCopy}>{copied ? 'Copied' : 'Copy Link'}</C.Btn>
              <C.Btn variant="ghost" size="sm" onClick={() => window.open(link, '_blank')}>Open in Tab</C.Btn>
            </div>
            <div style={{ fontSize: 12, color: '#5a6375', marginTop: 12 }}>
              Expires in {expiry === '0' ? 'never' : `${expiry} day${expiry === '1' ? '' : 's'}`} · Label: {label}
            </div>
          </C.Card>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { LanguagePage, DemoPage });
