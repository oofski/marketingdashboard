import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Login from './components/Login.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './components/Dashboard.jsx';
import PatientList from './components/PatientList.jsx';
import PatientDetail from './components/PatientDetail.jsx';
import VisitScreen from './components/VisitScreen.jsx';
import ArchiveView from './components/ArchiveView.jsx';
import Settings from './components/Settings.jsx';
import UserManagement from './components/UserManagement.jsx';

export default function App() {
  const { user, loaded } = useAuth();
  if (!loaded) return null;

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<PatientList />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/patients/:patientId/visits/:visitId" element={<VisitScreen />} />
        <Route path="/archive" element={<ArchiveView />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
