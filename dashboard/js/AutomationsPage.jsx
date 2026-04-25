// ─── Automations Page ────────────────────────────────────────────────────────

const AUTO_JOB_STATUS = { sent: 'green', pending: 'amber', failed: 'red', processing: 'blue', completed: 'green', cancelled: 'gray' };
const AUTO_CHANNEL_C  = { whatsapp: 'green' };

function AutomationsPage() {
  const [autoTab, setAutoTab] = React.useState('Jobs');
  const [jobs, setJobs] = React.useState([]);
  const [templates, setTemplates] = React.useState([]);
  const [assets, setAssets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [channelFilter, setChannelFilter] = React.useState('all');

  const reload = () => Promise.all([
    fetch('/api/automation/jobs').then(r => r.json()).catch(() => []),
    fetch('/api/whatsapp/templates').then(r => r.json()).catch(() => []),
    fetch('/api/message-assets').then(r => r.json()).catch(() => []),
  ]).then(([j, t, a]) => {
    setJobs(Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : []));
    setTemplates(Array.isArray(t.items) ? t.items : []);
    setAssets(Array.isArray(a) ? a : (Array.isArray(a?.items) ? a.items : []));
    setLoading(false);
  });

  React.useEffect(() => { reload(); }, []);

  const filtered = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (channelFilter !== 'all' && j.channel !== channelFilter) return false;
    return true;
  });

  const stats = {
    total:   jobs.length,
    sent:    jobs.filter(j => j.status === 'sent' || j.status === 'completed').length,
    pending: jobs.filter(j => j.status === 'pending').length,
    failed:  jobs.filter(j => j.status === 'failed').length,
  };

  const handleRetry = async id => {
    await fetch(`/api/automation/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    }).catch(() => {});
    reload();
  };

  const handleDelete = async id => {
    await fetch(`/api/automation/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    }).catch(() => {});
    setJobs(p => p.filter(j => j.id !== id));
  };

  return (
    <div>
      <C.PageHeader title="Automations" sub="Inbound follow-up and WhatsApp reminder workflows" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <C.Stat label="Total Jobs" value={stats.total} />
        <C.Stat label="Sent" value={stats.sent} accent="#34d399" />
        <C.Stat label="Pending" value={stats.pending} accent="#fbbf24" />
        <C.Stat label="Failed" value={stats.failed} accent="#f87171" />
      </div>
      <C.Tabs tabs={['Jobs','Template Manager','Asset Library']} active={autoTab} onChange={setAutoTab} />
      <div style={{ marginTop: 16 }}>

        {autoTab === 'Jobs' && (loading ? <C.Spinner /> : (
          <C.Card title="Automation Jobs" action={
            <div style={{ display: 'flex', gap: 8 }}>
              <C.Tabs tabs={['all','pending','sent','failed']} active={statusFilter} onChange={setStatusFilter} />
              <C.Tabs tabs={['all','whatsapp']} active={channelFilter} onChange={setChannelFilter} />
            </div>
          }>
            <C.Table cols={['Contact','Channel','Trigger','Template','Scheduled','Status','Actions']}
              empty="No automation jobs."
              rows={filtered.map(j => [
                <div>
                  <div style={{ fontWeight: 600, color: '#e8eaef' }}>{j.contact_name || 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: '#7b849a', fontVariantNumeric: 'tabular-nums' }}>{j.phone_number}</div>
                </div>,
                <C.Badge color={AUTO_CHANNEL_C[j.channel] || 'gray'}>{j.channel}</C.Badge>,
                <span style={{ fontSize: 12, color: '#c8cdd8', textTransform: 'capitalize' }}>{(j.trigger || j.type || '').replace(/_/g, ' ')}</span>,
                <span style={{ fontSize: 12, color: '#7b849a' }}>{j.template_name || '—'}</span>,
                <span style={{ fontSize: 12, color: '#7b849a' }}>{j.scheduled_for ? new Date(j.scheduled_for).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</span>,
                <C.Badge color={AUTO_JOB_STATUS[j.status] || 'gray'}>{j.status}</C.Badge>,
                <div style={{ display: 'flex', gap: 6 }}>
                  {j.status === 'failed'  && <C.Btn variant="ghost"   size="sm" onClick={() => handleRetry(j.id)}>Retry</C.Btn>}
                  <C.Btn variant="danger" size="sm" onClick={() => handleDelete(j.id)}>Del</C.Btn>
                </div>,
              ])} />
          </C.Card>
        ))}

        {autoTab === 'Template Manager' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {templates.length === 0 ? (
              <div style={{ fontSize: 13, color: '#5a6375', padding: '20px', fontStyle: 'italic' }}>No templates yet.</div>
            ) : templates.map(t => (
              <C.Card key={t.name} style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e8eaef' }}>{t.name}</span>
                      <C.Badge color={t.active !== false ? 'green' : 'gray'}>{t.active !== false ? 'Active' : 'Inactive'}</C.Badge>
                      {t.category && <C.Badge color="blue">{t.category}</C.Badge>}
                    </div>
                    {t.body && <div style={{ fontSize: 12, color: '#c8cdd8', marginTop: 4, lineHeight: 1.5 }}>{t.body}</div>}
                    {t.variables && <div style={{ fontSize: 12, color: '#7b849a', marginTop: 4 }}>Variables: {t.variables.map(v => `{${v}}`).join(', ')}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <C.Btn variant="ghost" size="sm">Edit</C.Btn>
                    <C.Btn variant="ghost" size="sm">Preview</C.Btn>
                  </div>
                </div>
              </C.Card>
            ))}
            <C.Btn variant="ghost">+ New Template</C.Btn>
          </div>
        )}

        {autoTab === 'Asset Library' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <C.Card title="Uploaded Assets" action={
              <label style={{ cursor: 'pointer' }}>
                <C.Btn variant="primary" size="sm">Upload Asset</C.Btn>
                <input type="file" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('file', file);
                  await fetch('/api/message-assets/upload', { method: 'POST', body: fd }).catch(() => null);
                  reload();
                }} />
              </label>
            }>
              <C.Table cols={['Name','Type','Size','URL','Actions']}
                empty="No assets uploaded."
                rows={assets.map(a => [
                  <span style={{ fontWeight: 600, color: '#e8eaef' }}>{a.filename || a.name}</span>,
                  <C.Badge color={a.content_type?.includes('pdf') ? 'blue' : 'purple'}>{a.content_type?.split('/')[1] || 'file'}</C.Badge>,
                  <span style={{ fontSize: 12, color: '#7b849a' }}>{a.size ? `${(a.size / 1024).toFixed(0)} KB` : '—'}</span>,
                  <span style={{ fontSize: 11, color: '#7b849a', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{a.public_url || a.url || '—'}</span>,
                  <div style={{ display: 'flex', gap: 6 }}>
                    <C.Btn variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(a.public_url || a.url || '')}>Copy URL</C.Btn>
                    <C.Btn variant="danger" size="sm">Delete</C.Btn>
                  </div>,
                ])} />
            </C.Card>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AutomationsPage });
