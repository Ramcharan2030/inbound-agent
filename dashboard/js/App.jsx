// App shell

const NAV = [
  { id: 'dashboard',   icon: 'DB',   label: 'Dashboard' },
  { id: 'calendar',    icon: 'CAL',  label: 'Calendar' },
  { id: 'agent',       icon: 'AG',   label: 'Agent Settings' },
  { id: 'logs',        icon: 'LOG',  label: 'Call Logs' },
  { id: 'automations', icon: 'AUTO', label: 'Automations' },
  { id: 'language',    icon: 'LANG', label: 'Language Preset' },
  { id: 'demo',        icon: 'DEMO', label: 'Demo Link' },
];

function Sidebar({ page, setPage, badgeCounts }) {
  return (
    <div style={{
      width: 220, flexShrink: 0, background: '#0f1117',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/dashboard-js/logo.png" alt="SPX AI Logo" style={{ height: 32, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e8eaef', letterSpacing: '-0.02em' }}>SPX AI</div>
            <div style={{ fontSize: 10, color: '#5a6375', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Voice Agent</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
        {NAV.map(item => {
          const active = page === item.id;
          const badge = badgeCounts[item.id];
          return (
            <button key={item.id} onClick={() => setPage(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 400,
                background: active ? 'rgba(90,126,245,0.14)' : 'transparent',
                color: active ? '#7da4fa' : '#7b849a',
                transition: 'all 0.12s', marginBottom: 1,
                textAlign: 'left',
              }}>
              <span style={{ fontSize: 11, opacity: active ? 1 : 0.8, flexShrink: 0, minWidth: 28 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {badge > 0 && <span style={{ background: active ? '#5a7ef5' : 'rgba(255,255,255,0.12)', color: active ? '#fff' : '#c8cdd8', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>{badge}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #34d399, #5a7ef5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>EA</div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Escala Realty</div>
            <div style={{ fontSize: 10, color: '#5a6375' }}>Admin</div>
          </div>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}

function TopBar({ page }) {
  const item = NAV.find(n => n.id === page);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div style={{
      height: 52, background: '#0b0d12', borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', padding: '0 28px',
      justifyContent: 'space-between', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#5a6375' }}>SPX AI</span>
        <span style={{ color: '#2e3347' }}>{'>'}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9aa5bd' }}>{item?.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 999, padding: '3px 10px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#34d399' }}>Gemini 3.1 Live</span>
        </div>
        <span style={{ fontSize: 12, color: '#5a6375' }}>{dateStr}</span>
      </div>
    </div>
  );
}

function App() {
  const PAGE_KEY = 'spxai_page';
  const [page, setPage] = React.useState(() => {
    try { return localStorage.getItem(PAGE_KEY) || localStorage.getItem('rxai_page') || 'dashboard'; } catch { return 'dashboard'; }
  });
  const [badgeCounts, setBadgeCounts] = React.useState({ whatsapp: 0, automations: 0 });
  const [visitedPages, setVisitedPages] = React.useState(() => new Set([page]));

  React.useEffect(() => {
    try {
      localStorage.setItem(PAGE_KEY, page);
      localStorage.removeItem('rxai_page');
    } catch {}
  }, [page]);

  React.useEffect(() => {
    setVisitedPages(prev => {
      if (prev.has(page)) return prev;
      const next = new Set(prev);
      next.add(page);
      return next;
    });
  }, [page]);



  const pages = {
    dashboard:   DashboardPage,
    calendar:    CalendarPage,
    agent:       AgentSettingsPage,
    logs:        CallLogsPage,
    automations: AutomationsPage,
    language:    LanguagePage,
    demo:        DemoPage,
  };

  const renderedPages = Array.from(visitedPages).map(pageId => {
    const PageComponent = pages[pageId] || DashboardPage;
    const isActive = pageId === page;
    return (
      <div
        key={pageId}
        style={{ display: isActive ? 'block' : 'none', minHeight: '100%' }}
        aria-hidden={!isActive}
      >
        <PageComponent />
      </div>
    );
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0b0d12', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar page={page} setPage={setPage} badgeCounts={badgeCounts} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar page={page} />
        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          {renderedPages}
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { App });
