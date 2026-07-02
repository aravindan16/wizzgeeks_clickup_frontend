import { useEffect, lazy, Suspense } from 'react';
import { useDispatch } from 'react-redux';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import GlobalLoader from './components/GlobalLoader';
import { NotFoundPage } from './components/ErrorPages';
import { bootstrap } from './features/auth/authSlice';

// Route-level code splitting: each page becomes its own chunk, fetched on demand.
// This shrinks the initial bundle and makes navigation load only what's needed.
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const DashboardHome = lazy(() => import('./features/dashboard/DashboardHome'));
const UserManagementPage = lazy(() => import('./features/users/UserManagementPage'));
const AuditLogPage = lazy(() => import('./features/audit/AuditLogPage'));
const ProjectListPage = lazy(() => import('./features/projects/ProjectListPage'));
const ProjectDetailsPage = lazy(() => import('./features/projects/ProjectDetailsPage'));
const ListBoardPage = lazy(() => import('./features/lists/ListBoardPage'));
const TasksPage = lazy(() => import('./features/tasks/TasksPage'));
const FiltersPage = lazy(() => import('./features/filters/FiltersPage'));
const TaskDetailsPage = lazy(() => import('./features/tasks/TaskDetailsPage'));
const TeamActivityPage = lazy(() => import('./features/daily/TeamActivityPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const SettingsPage = lazy(() => import('./features/system/SettingsPage'));

// Lightweight fallback shown while a route chunk loads.
const RouteFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <span className="wg-spinner" />
  </div>
);

/**
 * Root route table. On mount we attempt a silent refresh (bootstrap) so a logged-in
 * user with a valid refresh cookie is restored without re-entering credentials.
 *
 * Public:    /login
 * Protected: everything under AppLayout (requires authentication)
 */
// Public auth routes where the user is logged OUT — no session to restore, so we
// skip the /auth/refresh bootstrap (it would just 401 pointlessly).
const AUTH_ROUTES = ['/login', '/forgot-password', '/reset-password'];

// Module-level one-shot guard: React StrictMode double-invokes effects in dev,
// which fired /auth/refresh twice. This ensures bootstrap runs exactly once.
let didBootstrap = false;

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Run the silent session restore once, and not on logged-out auth pages.
    if (didBootstrap || AUTH_ROUTES.includes(window.location.pathname)) return;
    didBootstrap = true;
    dispatch(bootstrap());
  }, [dispatch]);

  return (
    <>
    <GlobalLoader />
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/:id" element={<DashboardHome />} />
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
          <Route path="/filters" element={<FiltersPage />} />
          <Route path="/filters/:id" element={<FiltersPage />} />
          <Route path="/tasks/:id" element={<TaskDetailsPage />} />
        </Route>
      </Route>


      <Route element={<ProtectedRoute permission="dailyupdate.read.team" />}>
        <Route element={<AppLayout />}>
          <Route path="/team-activity" element={<TeamActivityPage />} />
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
    </Suspense>
    </>
  );
}
