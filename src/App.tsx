import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { AdminScreen } from './components/AdminScreen';
import { AnchorScreen, type AnchorTab } from './components/AnchorScreen';
import { AppShell } from './components/AppShell';
import { ApplicantScreen, type ApplicantTab } from './components/ApplicantScreen';
import { LandingPage } from './components/LandingPage';
import { LoginScreen } from './components/LoginScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { StudentScreen, type StudentTab } from './components/StudentScreen';
import {
  canAccessRoute,
  getEventActor,
  getHomeRouteForRole,
  selectForUser,
  type AdminScopedView,
  type AnchorScopedView,
  type ApplicantScopedView,
  type StudentScopedView,
} from './core/scoping';
import { useMaatramStore } from './core/store';
import type { AppState, AuthSessionUser, PersonProfile } from './core/types';

interface RouteGuardProps {
  user: AuthSessionUser | null;
  onUnauthorizedToast: (msg: string) => void;
  children: React.ReactNode;
}

const ProtectedRoleRoute: React.FC<RouteGuardProps> = ({
  user,
  onUnauthorizedToast,
  children,
}) => {
  const location = useLocation();

  useEffect(() => {
    if (user && !canAccessRoute(user, location.pathname)) {
      onUnauthorizedToast('Not available for your role');
    }
  }, [user, location.pathname, onUnauthorizedToast]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessRoute(user, location.pathname)) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
};

function ApplicantViewWrapper({
  scopedData,
  currentActor,
  updateCurrentUserName,
  append,
  showToast,
}: {
  scopedData: ApplicantScopedView | null;
  currentActor: string;
  updateCurrentUserName: (name: string) => void;
  append: (input: any) => void;
  showToast: (msg: string) => void;
}) {
  const { tab } = useParams<{ tab?: string }>();
  if (!scopedData) return null;
  return (
    <ApplicantScreen
      scoped={scopedData}
      actorName={currentActor}
      onUpdateSessionName={updateCurrentUserName}
      onAppend={append}
      activeTab={(tab as ApplicantTab) || 'application'}
      showToast={showToast}
    />
  );
}

function StudentViewWrapper({
  scopedData,
  currentActor,
  append,
  showToast,
}: {
  scopedData: StudentScopedView | null;
  currentActor: string;
  append: (input: any) => void;
  showToast: (msg: string) => void;
}) {
  const { tab } = useParams<{ tab?: string }>();
  if (!scopedData) return null;
  return (
    <StudentScreen
      scoped={scopedData}
      actorName={currentActor}
      onAppend={append}
      activeTab={(tab as StudentTab) || 'overview'}
      showToast={showToast}
    />
  );
}

function AnchorViewWrapper({
  scopedData,
  currentActor,
  allPersonsLookup,
  append,
  showToast,
}: {
  scopedData: AnchorScopedView | null;
  currentActor: string;
  allPersonsLookup: Record<string, PersonProfile>;
  append: (input: any) => void;
  showToast: (msg: string) => void;
}) {
  const { tab } = useParams<{ tab?: string }>();
  if (!scopedData) return null;
  return (
    <AnchorScreen
      scoped={scopedData}
      actorName={currentActor}
      allPersonsLookup={allPersonsLookup}
      onAppend={append}
      activeTab={(tab as AnchorTab) || 'roster'}
      showToast={showToast}
    />
  );
}

function AdminViewWrapper({
  scopedData,
  currentActor,
  append,
  adminOtpVerified,
  setAdminOtpVerified,
  replayStart,
  replayTime,
  replayBookmark,
  simulateDuplicate,
  simulateOutOfOrder,
}: {
  scopedData: AdminScopedView | null;
  currentActor: string;
  append: (input: any) => void;
  adminOtpVerified: boolean;
  setAdminOtpVerified: (v: boolean) => void;
  replayStart: () => void;
  replayTime: (iso: string) => void;
  replayBookmark: () => void;
  simulateDuplicate: () => any;
  simulateOutOfOrder: () => any;
}) {
  const { tab } = useParams<{ tab?: string }>();
  if (!scopedData) return null;
  return (
    <AdminScreen
      scoped={scopedData}
      actorName={currentActor}
      onAppend={append}
      otpVerified={adminOtpVerified}
      onOtpVerify={setAdminOtpVerified}
      activeTab={tab || 'applicants'}
      onReplayFromStart={replayStart}
      onReplayFromTime={replayTime}
      onReplayFromBookmark={replayBookmark}
      onSimulateDuplicate={simulateDuplicate}
      onSimulateOutOfOrder={simulateOutOfOrder}
    />
  );
}

function ProfileViewWrapper({
  user,
  derived,
  currentActor,
  append,
  onUpdateSessionName,
  showToast,
}: {
  user: AuthSessionUser;
  derived: AppState;
  currentActor: string;
  append: (input: any) => void;
  onUpdateSessionName: (name: string) => void;
  showToast: (msg: string) => void;
}) {
  const profile = derived.persons[user.personId] || null;
  return (
    <ProfileScreen
      user={user}
      profile={profile}
      actorName={currentActor}
      onAppend={append}
      onUpdateSessionName={onUpdateSessionName}
      showToast={showToast}
    />
  );
}

export default function App() {
  const navigate = useNavigate();

  const derived = useMaatramStore((s) => s.derived);
  const currentUser = useMaatramStore((s) => s.currentUser);
  const adminOtpVerified = useMaatramStore((s) => s.adminOtpVerified);

  const append = useMaatramStore((s) => s.append);
  const loginUser = useMaatramStore((s) => s.loginUser);
  const logoutUser = useMaatramStore((s) => s.logoutUser);
  const updateCurrentUserName = useMaatramStore((s) => s.updateCurrentUserName);
  const startPublicApplicationDraft = useMaatramStore(
    (s) => s.startPublicApplicationDraft
  );
  const replayStart = useMaatramStore((s) => s.replayStart);
  const replayTime = useMaatramStore((s) => s.replayTime);
  const replayBookmark = useMaatramStore((s) => s.replayBookmark);
  const simulateDuplicate = useMaatramStore((s) => s.simulateDuplicate);
  const simulateOutOfOrder = useMaatramStore((s) => s.simulateOutOfOrder);
  const setAdminOtpVerified = useMaatramStore((s) => s.setAdminOtpVerified);

  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(''), 3000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const scopedData = selectForUser(derived, currentUser);
  const currentActor = getEventActor(currentUser);

  const handleLogin = (user: AuthSessionUser) => {
    setToastMessage('');
    loginUser(user);
    navigate(getHomeRouteForRole(user.role));
  };

  const handleStartPublicApplication = () => {
    setToastMessage('');
    startPublicApplicationDraft();
    navigate('/applicant');
  };

  const handleLogoutOrSwitch = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white text-neutral-950 flex flex-col font-sans">
      {/* 3-Second Role Guard Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 bg-neutral-950 text-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 text-xs font-medium animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 text-[#FFC20E] shrink-0" aria-hidden="true" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-neutral-400 hover:text-white ml-1"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Routes>
        {/* Landing Page */}
        <Route
          path="/"
          element={
            currentUser ? (
              <Navigate to={getHomeRouteForRole(currentUser.role)} replace />
            ) : (
              <LandingPage
                onStartPublicApplication={handleStartPublicApplication}
              />
            )
          }
        />

        {/* Login Hub and Sub-pages */}
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to={getHomeRouteForRole(currentUser.role)} replace />
            ) : (
              <LoginScreen
                onLogin={handleLogin}
                onStartPublicApplication={handleStartPublicApplication}
                setAdminOtpVerified={setAdminOtpVerified}
              />
            )
          }
        />
        <Route
          path="/login/:role"
          element={
            currentUser ? (
              <Navigate to={getHomeRouteForRole(currentUser.role)} replace />
            ) : (
              <LoginScreen
                onLogin={handleLogin}
                onStartPublicApplication={handleStartPublicApplication}
                setAdminOtpVerified={setAdminOtpVerified}
              />
            )
          }
        />

        {/* My Profile (All Roles) */}
        <Route
          path="/profile"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              {currentUser && (
                <AppShell user={currentUser} onLogout={handleLogoutOrSwitch}>
                  <ProfileViewWrapper
                    user={currentUser}
                    derived={derived}
                    currentActor={currentActor}
                    append={append}
                    onUpdateSessionName={updateCurrentUserName}
                    showToast={showToast}
                  />
                </AppShell>
              )}
            </ProtectedRoleRoute>
          }
        />

        {/* Applicant Screens */}
        <Route
          path="/applicant"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              {currentUser && (
                <AppShell user={currentUser} onLogout={handleLogoutOrSwitch}>
                  <ApplicantViewWrapper
                    scopedData={scopedData as ApplicantScopedView}
                    currentActor={currentActor}
                    updateCurrentUserName={updateCurrentUserName}
                    append={append}
                    showToast={showToast}
                  />
                </AppShell>
              )}
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/applicant/:tab"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              {currentUser && (
                <AppShell user={currentUser} onLogout={handleLogoutOrSwitch}>
                  <ApplicantViewWrapper
                    scopedData={scopedData as ApplicantScopedView}
                    currentActor={currentActor}
                    updateCurrentUserName={updateCurrentUserName}
                    append={append}
                    showToast={showToast}
                  />
                </AppShell>
              )}
            </ProtectedRoleRoute>
          }
        />

        {/* Student Screens */}
        <Route
          path="/student"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              {currentUser && (
                <AppShell user={currentUser} onLogout={handleLogoutOrSwitch}>
                  <StudentViewWrapper
                    scopedData={scopedData as StudentScopedView}
                    currentActor={currentActor}
                    append={append}
                    showToast={showToast}
                  />
                </AppShell>
              )}
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/student/:tab"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              {currentUser && (
                <AppShell user={currentUser} onLogout={handleLogoutOrSwitch}>
                  <StudentViewWrapper
                    scopedData={scopedData as StudentScopedView}
                    currentActor={currentActor}
                    append={append}
                    showToast={showToast}
                  />
                </AppShell>
              )}
            </ProtectedRoleRoute>
          }
        />

        {/* Anchor Screens */}
        <Route
          path="/anchor"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              {currentUser && (
                <AppShell user={currentUser} onLogout={handleLogoutOrSwitch}>
                  <AnchorViewWrapper
                    scopedData={scopedData as AnchorScopedView}
                    currentActor={currentActor}
                    allPersonsLookup={derived.persons}
                    append={append}
                    showToast={showToast}
                  />
                </AppShell>
              )}
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/anchor/:tab"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              {currentUser && (
                <AppShell user={currentUser} onLogout={handleLogoutOrSwitch}>
                  <AnchorViewWrapper
                    scopedData={scopedData as AnchorScopedView}
                    currentActor={currentActor}
                    allPersonsLookup={derived.persons}
                    append={append}
                    showToast={showToast}
                  />
                </AppShell>
              )}
            </ProtectedRoleRoute>
          }
        />

        {/* Admin Screens */}
        <Route
          path="/admin"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              {currentUser && (
                <AppShell user={currentUser} onLogout={handleLogoutOrSwitch}>
                  <AdminViewWrapper
                    scopedData={scopedData as AdminScopedView}
                    currentActor={currentActor}
                    append={append}
                    adminOtpVerified={adminOtpVerified}
                    setAdminOtpVerified={setAdminOtpVerified}
                    replayStart={replayStart}
                    replayTime={replayTime}
                    replayBookmark={replayBookmark}
                    simulateDuplicate={simulateDuplicate}
                    simulateOutOfOrder={simulateOutOfOrder}
                  />
                </AppShell>
              )}
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/admin/:tab"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              {currentUser && (
                <AppShell user={currentUser} onLogout={handleLogoutOrSwitch}>
                  <AdminViewWrapper
                    scopedData={scopedData as AdminScopedView}
                    currentActor={currentActor}
                    append={append}
                    adminOtpVerified={adminOtpVerified}
                    setAdminOtpVerified={setAdminOtpVerified}
                    replayStart={replayStart}
                    replayTime={replayTime}
                    replayBookmark={replayBookmark}
                    simulateDuplicate={simulateDuplicate}
                    simulateOutOfOrder={simulateOutOfOrder}
                  />
                </AppShell>
              )}
            </ProtectedRoleRoute>
          }
        />

        {/* Redirect /alumni and /events to Admin sub-routes */}
        <Route
          path="/alumni"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              <Navigate to="/admin/alumni" replace />
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoleRoute user={currentUser} onUnauthorizedToast={showToast}>
              <Navigate to="/admin/events" replace />
            </ProtectedRoleRoute>
          }
        />

        {/* Fallback */}
        <Route
          path="*"
          element={
            <Navigate
              to={currentUser ? getHomeRouteForRole(currentUser.role) : '/'}
              replace
            />
          }
        />
      </Routes>
    </div>
  );
}
