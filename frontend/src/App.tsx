import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout';
import { Overview } from './pages/Overview';
import { CallLogs } from './pages/CallLogs';
import { Contacts } from './pages/Contacts';
import { Appointments } from './pages/Appointments';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Outbound } from './pages/Outbound';
import { Configuration } from './pages/Configuration';
import { DoctorSchedule } from './pages/DoctorSchedule';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/logs" element={<CallLogs />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/schedule" element={<DoctorSchedule />} />
          <Route path="/kb" element={<KnowledgeBase />} />
          <Route path="/outbound" element={<Outbound />} />
          <Route path="/config" element={<Configuration />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
