import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ChevronRight, Pause, Play, X } from 'lucide-react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AdminScreen } from './components/AdminScreen';
import { AlumniScreen } from './components/AlumniScreen';
import { AnchorScreen } from './components/AnchorScreen';
import { ApplicantScreen } from './components/ApplicantScreen';
import { EventLogScreen } from './components/EventLogScreen';
import { LoginScreen } from './components/LoginScreen';
import { StudentScreen } from './components/StudentScreen';
import { TopBar } from './components/TopBar';
import {
  canAccessRoute,
  DEMO_ACCOUNTS,
  getEventActor,
  getHomeRouteForRole,
  selectForUser,
  type AdminScopedView,
  type AnchorScopedView,
  type ApplicantScopedView,
  type StudentScopedView,
} from './core/scoping';
import { useMaatramStore } from './core/store';
import type { AuthSessionUser } from './core/types';

const DEMO_CAPTIONS = [
  'Step 1 of 5: Applicant (Divya R) — stage stepper and verification document upload.',
  'Step 2 of 5: Admin (OTP verified) — selects applicant & generates 48-hour join code.',
  'Step 3 of 5: Anchor (Meera Krishnan) — redeems join code into roster of 15 & posts announcement.',
  'Step 4 of 5: Student (Arun K) — B.Tech IT 4th sem volunteering request & proof verification.',
  'Step 5 of 5: Admin — verifies volunteering, replays Audit and Event Log, and runs Alumni company query.',
];

function makeSessionUser(role: keyof typeof DEMO_ACCOUNTS): AuthSessionUser {
  const acc = DEMO_ACCOUNTS[role];
  return {
    id: acc.personId,
    personId: acc.personId,
    role: acc.role,
    name: acc.name,
    email: acc.email,
    subtitle: acc.subtitle,
  };
}

interface RouteGuardProps {
  user: AuthSessionUser | null;
  onUnauthorizedToast: (msg: string) => void;
  suppressUnauthorizedToast?: boolean;
  children: React.ReactNode;
}

const ProtectedRoleRoute: React.FC<RouteGuardProps> = ({
  user,
  onUnauthorizedToast,
  suppressUnauthorizedToast = false,
  children,
}) => {
  const location = useLocation();

  useEffect(() => {
    if (
      !suppressUnauthorizedToast &&
      user &&
      !canAccessRoute(user, location.pathname)
    ) {
      onUnauthorizedToast('Not available for your role');
    }
  }, [user, location.pathname, onUnauthorizedToast, suppressUnauthorizedToast]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessRoute(user, location.pathname)) {
    if (suppressUnauthorizedToast) {
      return null;
    }
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  );
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const derived = useMaatramStore((s) => s.derived);
  const currentUser = useMaatramStore((s) => s.currentUser);
  const adminOtpVerified = useMaatramStore((s) => s.adminOtpVerified);
  const guidedDemo = useMaatramStore((s) => s.guidedDemo);

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
  const resetToSeed = useMaatramStore((s) => s.resetToSeed);
  const setAdminOtpVerified = useMaatramStore((s) => s.setAdminOtpVerified);
  const startGuidedDemo = useMaatramStore((s) => s.startGuidedDemo);
  const setGuidedDemoStep = useMaatramStore((s) => s.setGuidedDemoStep);
  const setGuidedDemoAutoPlay = useMaatramStore((s) => s.setGuidedDemoAutoPlay);
  const stopGuidedDemo = useMaatramStore((s) => s.stopGuidedDemo);

  const [alumniDemoQuery, setAlumniDemoQuery] = useState<string | undefined>(
    undefined
  );
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(''), 4200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const executeDemoStep = useCallback(
    (stepIndex: number) => {
      const store = useMaatramStore.getState();

      if (stepIndex === 0) {
        // 1. Login as Applicant (Divya R): stepper & upload
        setAlumniDemoQuery(undefined);
        const applicantUser = makeSessionUser('applicant');
        store.loginUser(applicantUser);
        navigate('/applicant');

        const divya = store.derived.persons['P-2026-07'];
        if (divya && divya.documents.length === 0) {
          store.append({
            id: 'EVT-DEMO5-UPLOAD-DIVYA',
            type: 'DOCUMENT_UPLOADED',
            personId: 'P-2026-07',
            cycleId: '2026',
            actor: getEventActor(applicantUser),
            payload: {
              docId: 'DOC-DEMO-DIVYA-01',
              label: '12th Marksheet',
              fileName: 'divya_12th_marksheet.pdf',
              fileType: 'application/pdf',
              fileSize: 912000,
              signedUrl: 'https://signed.maatram.local/docs/divya_12th_marksheet.pdf',
            },
          });
        }
        if (divya && divya.stage === 'application') {
          store.append({
            id: 'EVT-DEMO5-STAGE-DIVYA',
            type: 'STAGE_ADVANCED',
            personId: 'P-2026-07',
            cycleId: '2026',
            actor: getEventActor(applicantUser),
            payload: {
              stage: 'tele_verification',
              reason: 'Guided demo progressed Divya R into Tele-verification.',
            },
          });
        }
      } else if (stepIndex === 1) {
        // 2. Login as Admin: select applicant & issue join code
        const adminUser = makeSessionUser('admin');
        store.loginUser(adminUser);
        store.setAdminOtpVerified(true);
        navigate('/admin');

        const divya = store.derived.persons['P-2026-07'];
        if (divya && divya.stage !== 'selected') {
          store.append({
            id: 'EVT-DEMO5-SELECT-DIVYA',
            type: 'APPLICANT_SELECTED',
            personId: 'P-2026-07',
            cycleId: '2026',
            actor: getEventActor(adminUser),
            payload: {
              joinCode: 'MTRM-2026-9701',
              joinCodeExpiresAt: '2026-11-23T18:00:00.000Z',
              reason: 'Guided demo Admin selection with 48h workspace join code.',
              college: 'Anna University — CEG',
              degree: 'B.E. Computer Science',
            },
          });
        }
      } else if (stepIndex === 2) {
        // 3. Login as Anchor (Meera Krishnan): add student by join code & post announcement
        const anchorUser = makeSessionUser('anchor');
        store.loginUser(anchorUser);
        navigate('/anchor');

        const divya = store.derived.persons['P-2026-07'];
        if (divya?.joinCode && !divya.joinCodeRedeemedByAnchorId) {
          store.append({
            id: 'EVT-DEMO5-REDEEM-DIVYA',
            type: 'JOIN_CODE_REDEEMED',
            personId: 'P-2026-07',
            cycleId: '2026',
            actor: getEventActor(anchorUser),
            payload: {
              joinCode: divya.joinCode,
              anchorId: 'P-2020-01',
            },
          });
        }
        if (!store.derived.announcements['ANN-DEMO-2026']) {
          store.append({
            id: 'EVT-DEMO5-ANN',
            type: 'ANNOUNCEMENT_POSTED',
            personId: 'P-2020-01',
            cycleId: '2026',
            actor: getEventActor(anchorUser),
            payload: {
              announcementId: 'ANN-DEMO-2026',
              title: 'Welcome Cohort Update: Verification & Winter Prep',
              body: 'Warm welcome to newly onboarded scholars. Please RSVP for Saturday cohort check-in.',
              category: 'Onboarding',
              pinned: true,
              initialSeenBy: ['P-2024-01'],
            },
          });
        }
      } else if (stepIndex === 3) {
        // 4. Login as Student (Arun K): volunteering
        const studentUser = makeSessionUser('student');
        store.loginUser(studentUser);
        navigate('/student');
      } else if (stepIndex === 4) {
        // 5. Login as Admin: verify volunteering, Event Log replay, Alumni company query
        const adminUser = makeSessionUser('admin');
        store.loginUser(adminUser);
        store.setAdminOtpVerified(true);

        const pendingWork = Object.values(store.derived.volunteeringWorks).find(
          (w) =>
            (w.submitterRole === 'student' && w.status === 'Anchor approved') ||
            (w.submitterRole === 'anchor' && w.status === 'Submitted')
        );
        if (pendingWork) {
          store.append({
            id: `EVT-DEMO5-VERIFY-${pendingWork.workId}`,
            type: 'VOLUNTEERING_WORK_VERIFIED',
            personId: pendingWork.personId,
            cycleId: pendingWork.cycleId,
            actor: getEventActor(adminUser),
            payload: {
              workId: pendingWork.workId,
              verifiedBy: getEventActor(adminUser),
            },
          });
        }

        store.simulateDuplicate();
        store.replayStart();
        setAlumniDemoQuery('Tata Consultancy Services Pvt Ltd');
        navigate('/alumni');
      }
    },
    [navigate]
  );

  const handleStartGuidedDemo = () => {
    startGuidedDemo();
    executeDemoStep(0);
  };

  const handleNextDemoStep = useCallback(() => {
    const next = guidedDemo.step + 1;
    if (next >= DEMO_CAPTIONS.length) {
      stopGuidedDemo();
      return;
    }
    setGuidedDemoStep(next, DEMO_CAPTIONS[next]);
    executeDemoStep(next);
  }, [guidedDemo.step, executeDemoStep, setGuidedDemoStep, stopGuidedDemo]);

  useEffect(() => {
    if (!guidedDemo.active || !guidedDemo.autoPlay) return;
    const timer = window.setTimeout(() => {
      handleNextDemoStep();
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [guidedDemo.active, guidedDemo.autoPlay, guidedDemo.step, handleNextDemoStep]);

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

  const isLoginRoute = location.pathname === '/login';

  return (
    <div className="min-h-screen bg-white text-neutral-950 flex flex-col">
      {currentUser && !isLoginRoute && (
        <TopBar
          user={currentUser}
          onSwitchAccount={handleLogoutOrSwitch}
          onLogout={handleLogoutOrSwitch}
        />
      )}

      {/* Guided 3-Minute Demo Caption Bar */}
      <AnimatePresence>
        {guidedDemo.active && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            role="region"
            aria-label="Guided 3-minute demo controller"
            className="bg-neutral-950 text-white border-b border-neutral-800"
          >
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="bg-white text-neutral-950 rounded-full px-2.5 py-0.5 font-mono font-bold tabular-nums shrink-0 border-b-2 border-[#FFC20E]">
                  {guidedDemo.step + 1} / {DEMO_CAPTIONS.length}
                </span>
                <p className="font-medium text-neutral-100 leading-snug">
                  {guidedDemo.caption || DEMO_CAPTIONS[guidedDemo.step]}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setGuidedDemoAutoPlay(!guidedDemo.autoPlay)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-medium"
                >
                  {guidedDemo.autoPlay ? (
                    <>
                      <Pause className="w-3 h-3" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" aria-hidden="true" />
                      <span>Resume</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleNextDemoStep}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#FFC20E] hover:bg-[#e5ae0b] text-neutral-950 font-semibold"
                >
                  <span>
                    {guidedDemo.step + 1 >= DEMO_CAPTIONS.length
                      ? 'Finish'
                      : 'Next'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={stopGuidedDemo}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-200 font-medium"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                  <span>Skip</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Guard Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            role="status"
            className="fixed bottom-5 right-5 z-50 bg-neutral-950 text-white border border-neutral-800 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 text-xs font-medium"
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
          </motion.div>
        )}
      </AnimatePresence>

      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={currentUser ? getHomeRouteForRole(currentUser.role) : '/login'}
              replace
            />
          }
        />
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to={getHomeRouteForRole(currentUser.role)} replace />
            ) : (
              <LoginScreen
                onLogin={handleLogin}
                onStartPublicApplication={handleStartPublicApplication}
                onStartGuidedDemo={handleStartGuidedDemo}
                onResetDemo={() => resetToSeed({ keepSession: false })}
              />
            )
          }
        />
        <Route
          path="/applicant"
          element={
            <ProtectedRoleRoute
              user={currentUser}
              onUnauthorizedToast={showToast}
              suppressUnauthorizedToast={guidedDemo.active}
            >
              <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8">
                {scopedData?.role === 'applicant' && (
                  <ApplicantScreen
                    scoped={scopedData as ApplicantScopedView}
                    actorName={currentActor}
                    onUpdateSessionName={updateCurrentUserName}
                    onAppend={append}
                  />
                )}
              </main>
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/student"
          element={
            <ProtectedRoleRoute
              user={currentUser}
              onUnauthorizedToast={showToast}
              suppressUnauthorizedToast={guidedDemo.active}
            >
              <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8">
                {scopedData?.role === 'student' && (
                  <StudentScreen
                    scoped={scopedData as StudentScopedView}
                    actorName={currentActor}
                    onAppend={append}
                  />
                )}
              </main>
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/anchor"
          element={
            <ProtectedRoleRoute
              user={currentUser}
              onUnauthorizedToast={showToast}
              suppressUnauthorizedToast={guidedDemo.active}
            >
              <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8">
                {scopedData?.role === 'anchor' && (
                  <AnchorScreen
                    scoped={scopedData as AnchorScopedView}
                    actorName={currentActor}
                    allPersonsLookup={derived.persons}
                    onAppend={append}
                  />
                )}
              </main>
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/alumni"
          element={
            <ProtectedRoleRoute
              user={currentUser}
              onUnauthorizedToast={showToast}
              suppressUnauthorizedToast={guidedDemo.active}
            >
              <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8">
                {(scopedData?.role === 'anchor' ||
                  scopedData?.role === 'admin') && (
                  <AlumniScreen
                    alumniList={scopedData.alumniDirectory}
                    actorName={currentActor}
                    readOnly={scopedData.role === 'anchor'}
                    onAppend={append}
                    initialQuery={alumniDemoQuery}
                  />
                )}
              </main>
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoleRoute
              user={currentUser}
              onUnauthorizedToast={showToast}
              suppressUnauthorizedToast={guidedDemo.active}
            >
              <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8">
                {scopedData?.role === 'admin' && (
                  <AdminScreen
                    scoped={scopedData as AdminScopedView}
                    actorName={currentActor}
                    onAppend={append}
                    otpVerified={adminOtpVerified}
                    onOtpVerify={setAdminOtpVerified}
                    onResetDemo={() => resetToSeed({ keepSession: true })}
                  />
                )}
              </main>
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoleRoute
              user={currentUser}
              onUnauthorizedToast={showToast}
              suppressUnauthorizedToast={guidedDemo.active}
            >
              <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8">
                {scopedData?.role === 'admin' && (
                  <EventLogScreen
                    events={scopedData.events}
                    workerBookmark={scopedData.workerBookmark}
                    onReplayFromStart={replayStart}
                    onReplayFromTime={replayTime}
                    onReplayFromBookmark={replayBookmark}
                    onSimulateDuplicate={simulateDuplicate}
                    onSimulateOutOfOrder={simulateOutOfOrder}
                  />
                )}
              </main>
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="*"
          element={
            <Navigate
              to={currentUser ? getHomeRouteForRole(currentUser.role) : '/login'}
              replace
            />
          }
        />
      </Routes>

      {!isLoginRoute && (
        <footer className="border-t border-neutral-200 bg-white py-4 px-4 sm:px-6 mt-auto">
          <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
            <span>
              Maatram One (M-one) · Student Lifecycle Platform · MH26-05
            </span>
            <span>
              Synthetic demo data only · Event-sourced in browser localStorage
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}
