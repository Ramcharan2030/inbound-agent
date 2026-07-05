import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/layout';
import { Overview } from './pages/Overview';
import { CallLogs } from './pages/CallLogs';
import { Contacts } from './pages/Contacts';
import { Appointments } from './pages/Appointments';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Outbound } from './pages/Outbound';
import { Configuration } from './pages/Configuration';
import { DoctorSchedule } from './pages/DoctorSchedule';

// ─── Error Boundary ───────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#08090c] flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-white">Something went wrong</h2>
            <p className="text-sm text-zinc-500 font-mono bg-[#0e0f14] p-3 rounded-lg border border-[#1c1e27] text-left overflow-x-auto">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── App ──────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/"             element={<Overview />} />
              <Route path="/logs"         element={<CallLogs />} />
              <Route path="/contacts"     element={<Contacts />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/schedule"     element={<DoctorSchedule />} />
              <Route path="/kb"           element={<KnowledgeBase />} />
              <Route path="/outbound"     element={<Outbound />} />
              <Route path="/config"       element={<Configuration />} />
            </Routes>
          </Layout>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
