import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import DashboardHome from './features/dashboard/DashboardHome';
import UserManagementPage from './features/users/UserManagementPage';
import AuditLogPage from './features/audit/AuditLogPage';
import ProjectListPage from './features/projects/ProjectListPage';
import ProjectDetailsPage from './features/projects/ProjectDetailsPage';
import ListBoardPage from './features/lists/ListBoardPage';
import TasksPage from './features/tasks/TasksPage';
import TaskDetailsPage from './features/tasks/TaskDetailsPage';
import TeamActivityPage from './features/daily/TeamActivityPage';
import ReportsPage from './features/reports/ReportsPage';
import RegisterPage from './features/auth/RegisterPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';
import ProfilePage from './features/profile/ProfilePage';
import SettingsPage from './features/system/SettingsPage';
import { NotFoundPage } from './components/ErrorPages';
import { bootstrap } from './features/auth/authSlice';

/**
 * Root route table. On mount we attempt a silent refresh (bootstrap) so a logged-in
 * user with a valid refresh cookie is restored without re-entering credentials.
 *
 * Public:    /login
 * Protected: everything under AppLayout (requires authentication)
 */
export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(bootstrap());
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute permission="admin.settings" />}>
        <Route element={<AppLayout />}>
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute permission="project.read" />}>
        <Route element={<AppLayout />}>
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          <Route path="/lists/:id" element={<ListBoardPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute permission="task.read" />}>
        <Route element={<AppLayout />}>
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TaskDetailsPage />} />
        </Route>
      </Route>


      <Route element={<ProtectedRoute permission="dailyupdate.read.team" />}>
        <Route element={<AppLayout />}>
          <Route path="/team-activity" element={<TeamActivityPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute permission="report.view.self" />}>
        <Route element={<AppLayout />}>
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute permission="user.read" />}>
        <Route element={<AppLayout />}>
          <Route path="/users" element={<UserManagementPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute permission="audit.read" />}>
        <Route element={<AppLayout />}>
          <Route path="/audit" element={<AuditLogPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
