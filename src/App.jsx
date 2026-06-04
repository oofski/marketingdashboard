import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, isAdmin } from './contexts/AuthContext.jsx';
import Login from './components/Login.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './components/Dashboard.jsx';
import EmployeeList from './components/EmployeeList.jsx';
import EmployeeDetail from './components/EmployeeDetail.jsx';
import MyTasks from './components/MyTasks.jsx';
import Settings from './components/Settings.jsx';
import UserManagement from './components/UserManagement.jsx';
import TemplateEditor from './components/TemplateEditor.jsx';

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

  const admin = isAdmin(user);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/my-tasks" element={<MyTasks />} />
        <Route path="/employees" element={<EmployeeList />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        {admin && <Route path="/staff" element={<UserManagement />} />}
        {admin && <Route path="/template" element={<TemplateEditor />} />}
        {admin && <Route path="/settings" element={<Settings />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
