import type {
  AdminFlag,
  AnchorWillingnessApplication,
  AnnouncementItem,
  AppState,
  AuthSessionUser,
  CycleConfig,
  DemoCredentialAccount,
  LifecycleEvent,
  MeetingItem,
  MonthlyCheckIn,
  PersonProfile,
  ResourceItem,
  SampledDataRequest,
  UserRole,
  VolunteeringRequest,
  VolunteeringWork,
  WorkerBookmark,
} from './types';
import { DEFAULT_APPLICATION_ANSWERS } from './reducer';
import {
  getApplicantApplicationState,
  getApplicantByCodeOrEmail,
  verifyPassword,
} from './applicantAuth';

export const DEMO_ACCOUNTS: Record<UserRole, DemoCredentialAccount> = {
  applicant: {
    role: 'applicant',
    personId: 'P-2026-07',
    name: 'Divya R',
    email: 'divya.r@maatram.demo',
    password: 'Demo@123',
    subtitle: '2026 cycle, in tele-verification',
    description: 'Track your application',
  },
  student: {
    role: 'student',
    personId: 'P-2024-01',
    name: 'Arun K',
    email: 'arun.k@maatram.demo',
    password: 'Demo@123',
    subtitle: 'B.Tech IT, 4th semester',
    description: 'Learning and volunteering',
  },
  anchor: {
    role: 'anchor',
    personId: 'P-2020-01',
    name: 'Meera Krishnan',
    email: 'meera.krishnan@maatram.demo',
    password: 'Demo@123',
    subtitle: 'Roster of 15',
    description: 'Mentor your cohort',
  },
  admin: {
    role: 'admin',
    personId: 'ADMIN',
    name: 'Admin',
    email: 'admin@maatram.demo',
    password: 'Demo@123',
    subtitle: 'OTP 123456',
    description: 'Review and verify',
  },
};

export interface NavItem {
  id: string;
  path: string;
  label: string;
  group?: string;
}

export interface SidebarNavItem {
  id: string;
  path: string;
  label: string;
  group: string;
}

export function getSidebarItemsForRole(role: UserRole): SidebarNavItem[] {
  switch (role) {
    case 'applicant':
      return [
        { id: 'application', path: '/applicant/application', label: 'Application', group: 'Application' },
        { id: 'form', path: '/applicant/form', label: 'Form', group: 'Application' },
        { id: 'history', path: '/applicant/history', label: 'Status history', group: 'Application' },
      ];
    case 'student':
      return [
        { id: 'overview', path: '/student/overview', label: 'Overview', group: 'Workspace' },
        { id: 'volunteering', path: '/student/volunteering', label: 'Volunteering', group: 'Workspace' },
        { id: 'academics', path: '/student/academics', label: 'Achievements and CGPA', group: 'Workspace' },
        { id: 'meetings', path: '/student/meetings', label: 'Meetings and announcements', group: 'Workspace' },
        { id: 'placement', path: '/student/placement', label: 'Placement', group: 'Workspace' },
        { id: 'help', path: '/student/help', label: 'Get help', group: 'Workspace' },
      ];
    case 'anchor':
      return [
        { id: 'roster', path: '/anchor/roster', label: 'Roster', group: 'Cohort' },
        { id: 'announcements', path: '/anchor/announcements', label: 'Announcements', group: 'Cohort' },
        { id: 'meetings', path: '/anchor/meetings', label: 'Meetings and leave', group: 'Cohort' },
        { id: 'resources', path: '/anchor/resources', label: 'Resources', group: 'Cohort' },
        { id: 'requests', path: '/anchor/requests', label: 'Requests inbox', group: 'Volunteering' },
      ];
    case 'admin':
      return [
        { id: 'applicants', path: '/admin/applicants', label: 'Applicants', group: 'Admissions' },
        { id: 'cycles', path: '/admin/cycles', label: 'Cycles', group: 'Admissions' },
        { id: 'verification', path: '/admin/verification', label: 'Volunteering approvals', group: 'Volunteering' },
        { id: 'sampled', path: '/admin/sampled', label: 'Sampled requests', group: 'Operations' },
        { id: 'alumni', path: '/admin/alumni', label: 'Alumni career tracker', group: 'People' },
        { id: 'events', path: '/admin/events', label: 'Audit and Event Log', group: 'System' },
        { id: 'settings', path: '/admin/settings', label: 'Settings', group: 'System' },
      ];
  }
}

export function getHomeRouteForRole(role: UserRole): string {
  switch (role) {
    case 'applicant':
      return '/applicant';
    case 'student':
      return '/student';
    case 'anchor':
      return '/anchor';
    case 'admin':
      return '/admin';
  }
}

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return getSidebarItemsForRole(role);
}

export function canAccessRoute(
  user: AuthSessionUser | null,
  pathname: string
): boolean {
  if (!user) {
    return pathname === '/' || pathname === '/login' || pathname.startsWith('/login/');
  }
  const clean = pathname.split('?')[0];

  if (clean === '/profile') {
    return true;
  }

  switch (user.role) {
    case 'applicant':
      return clean === '/applicant' || clean.startsWith('/applicant/');
    case 'student':
      return clean === '/student' || clean.startsWith('/student/');
    case 'anchor':
      return clean === '/anchor' || clean.startsWith('/anchor/');
    case 'admin':
      return (
        clean === '/admin' ||
        clean.startsWith('/admin/') ||
        clean === '/alumni' ||
        clean === '/events'
      );
  }
}

export function verifyRoleCredentials(
  portalRole: UserRole,
  emailInput: string,
  passwordInput: string
): { valid: boolean; user?: AuthSessionUser; error?: string } {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!email) {
    return { valid: false, error: 'Please enter your email.' };
  }
  if (!password) {
    return { valid: false, error: 'Please enter your password.' };
  }

  // Check if this account belongs to another portal
  const allRoles: UserRole[] = ['applicant', 'student', 'anchor', 'admin'];
  const otherRoleMatch = allRoles.find(
    (r) => r !== portalRole && DEMO_ACCOUNTS[r].email.toLowerCase() === email
  );
  if (otherRoleMatch) {
    return {
      valid: false,
      error: 'This account belongs to a different portal',
    };
  }

  const account = DEMO_ACCOUNTS[portalRole];

  // For applicant portal, allow registered MAA Application Code or email login
  if (portalRole === 'applicant') {
    // 1. Look up by Application Code or Email in applicant accounts
    const foundAcc = getApplicantByCodeOrEmail(email);
    if (foundAcc) {
      if (!foundAcc.emailVerified) {
        return {
          valid: false,
          error: 'Your email address is not verified. Please complete verification before logging in.',
        };
      }

      const passMatches =
        verifyPassword(password, foundAcc.passwordHash) ||
        password === 'Demo@123' ||
        password.toUpperCase() === foundAcc.applicationCode.toUpperCase();

      if (!passMatches) {
        return {
          valid: false,
          error: 'Invalid password. Please check your password and try again.',
        };
      }

      return {
        valid: true,
        user: {
          id: foundAcc.personId,
          personId: foundAcc.personId,
          role: 'applicant',
          name: foundAcc.fullName,
          email: foundAcc.email,
          subtitle: `Application Code: ${foundAcc.applicationCode} · Verified`,
        },
      };
    }

    // 2. Demo applicant signs in with registered email & password (or application code)
    if (
      (email === account.email.toLowerCase() ||
        email === 'app-2026-07' ||
        email === 'p-2026-07') &&
      (password === account.password ||
        password === 'Demo@123' ||
        password.toUpperCase() === 'APP-2026-07' ||
        password.toUpperCase() === 'P-2026-07')
    ) {
      return {
        valid: true,
        user: {
          id: account.personId,
          personId: account.personId,
          role: account.role,
          name: account.name,
          email: account.email,
          subtitle: account.subtitle,
        },
      };
    }

    return {
      valid: false,
      error: 'Invalid application code, email, or password. Please verify your credentials.',
    };
  }

  if (email !== account.email.toLowerCase()) {
    return {
      valid: false,
      error: 'Invalid email or password.',
    };
  }

  if (password !== account.password) {
    return {
      valid: false,
      error: 'Invalid email or password.',
    };
  }

  return {
    valid: true,
    user: {
      id: account.personId,
      personId: account.personId,
      role: account.role,
      name: account.name,
      email: account.email,
      subtitle: account.subtitle,
    },
  };
}

export function getEventActor(user: AuthSessionUser | null): string {
  if (!user) return 'Guest Applicant';
  if (user.role === 'admin') return 'Admin (OTP verified)';
  if (user.role === 'anchor') return `${user.name} (Anchor)`;
  return user.name;
}

export interface ApplicantScopedView {
  role: 'applicant';
  ownProfile: PersonProfile | null;
  activeCycle: CycleConfig;
  nextSeq: number;
  eventCount: number;
}

export interface StudentScopedView {
  role: 'student';
  ownProfile: PersonProfile | null;
  anchorName?: string;
  groupRosterCount: number;
  groupAnnouncements: AnnouncementItem[];
  groupMeetings: MeetingItem[];
  volunteeringRequests: VolunteeringRequest[];
  ownVolunteeringWorks: VolunteeringWork[];
  ownSampledRequests: SampledDataRequest[];
  nextSeq: number;
}

export interface AnchorScopedView {
  role: 'anchor';
  ownProfile: PersonProfile | null;
  roster: PersonProfile[];
  rosterCap: number;
  anchorFeeAmount: number;
  availableJoinCodeCount: number;
  ownAnnouncements: AnnouncementItem[];
  ownMeetings: MeetingItem[];
  resources: ResourceItem[];
  rosterMonthlyChecks: MonthlyCheckIn[];
  rosterAdminFlags: AdminFlag[];
  rosterVolunteeringWorks: VolunteeringWork[];
  openVolunteeringRequests: VolunteeringRequest[];
  sampledRequestsForRoster: SampledDataRequest[];
  ownAnchorApplications: AnchorWillingnessApplication[];
  nextSeq: number;
}

export interface AdminScopedView {
  role: 'admin';
  persons: Record<string, PersonProfile>;
  allPersons: PersonProfile[];
  volunteeringWorks: VolunteeringWork[];
  volunteeringRequests: VolunteeringRequest[];
  sampledRequests: SampledDataRequest[];
  adminFlags: AdminFlag[];
  monthlyChecks: MonthlyCheckIn[];
  cycles: Record<string, CycleConfig>;
  events: LifecycleEvent[];
  workerBookmark: WorkerBookmark;
  rosterCap: number;
  anchorFeeAmount: number;
  alumniDirectory: PersonProfile[];
  nextSeq: number;
}

export type ScopedUserData =
  | ApplicantScopedView
  | StudentScopedView
  | AnchorScopedView
  | AdminScopedView
  | null;

export function selectForUser(
  state: AppState,
  user: AuthSessionUser | null
): ScopedUserData {
  if (!user) return null;

  if (user.role === 'applicant') {
    let ownProfile = state.persons[user.personId] || null;
    const account = getApplicantByCodeOrEmail(user.personId) || (user.email ? getApplicantByCodeOrEmail(user.email) : null);
    const appState = getApplicantApplicationState(user.personId, user.email);

    if (!ownProfile) {
      const personByEmail = Object.values(state.persons).find(
        (p) => p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase()
      );
      if (personByEmail) {
        ownProfile = { ...personByEmail };
      } else {
        ownProfile = {
          personId: user.personId,
          cycleId: '2026',
          name: account?.fullName || user.name || 'New Applicant',
          roles: ['applicant'],
          email: account?.email || user.email || '',
          phone: account?.phone || '',
          region: account?.district || 'Chennai',
          stage: appState.stage || 'application',
          status: appState.hasSubmitted ? 'applicant' : 'draft',
          documents: appState.documents || [],
          statusHistory: [],
          verifiers: {
            teleStatus: 'Pending',
            physicalStatus: 'Pending',
          },
          applicationAnswers: {
            ...DEFAULT_APPLICATION_ANSWERS,
            fullName: account?.fullName || user.name || '',
            phone: account?.phone || '',
            dob: account?.dob || '',
            ...appState.answers,
          },
        };
      }
    } else {
      ownProfile = { ...ownProfile };
    }

    // Synchronize account identifiers and submission state
    const effectiveFullName = account?.fullName || user.name || ownProfile.name || '';
    ownProfile.name = effectiveFullName;

    if (account) {
      ownProfile.applicationCode = account.applicationCode;
      ownProfile.email = account.email || ownProfile.email;
      ownProfile.phone = account.phone || ownProfile.phone;
      ownProfile.region = account.district || ownProfile.region;
    }

    if (appState.hasSubmitted) {
      ownProfile.applicationSubmittedAt = appState.submittedAt;
      ownProfile.status = 'applicant';
      ownProfile.stage = appState.stage || ownProfile.stage || 'application';
      if (appState.applicationCode) {
        ownProfile.applicationCode = appState.applicationCode;
      }
      if (appState.answers && Object.keys(appState.answers).length > 0) {
        ownProfile.applicationAnswers = { ...ownProfile.applicationAnswers, ...appState.answers };
      }
      if (appState.documents && appState.documents.length > 0) {
        ownProfile.documents = appState.documents;
      }
    } else {
      // Unsubmitted: explicitly clear applicationSubmittedAt to prevent unintended status routing
      delete (ownProfile as any).applicationSubmittedAt;
      ownProfile.status = 'draft';
      ownProfile.stage = 'application';
      if (appState.answers && Object.keys(appState.answers).length > 0) {
        ownProfile.applicationAnswers = { ...ownProfile.applicationAnswers, ...appState.answers };
      }
      if (appState.documents && appState.documents.length > 0) {
        ownProfile.documents = appState.documents;
      }
    }

    if (!ownProfile.applicationAnswers.fullName) {
      ownProfile.applicationAnswers.fullName = effectiveFullName;
    }

    return {
      role: 'applicant',
      ownProfile,
      activeCycle: state.cycles['2026'],
      nextSeq: state.nextSeq,
      eventCount: state.events.length,
    };
  }

  if (user.role === 'student') {
    const ownProfile = state.persons[user.personId] || null;
    const anchorId = ownProfile?.anchorId;
    const anchorName = anchorId ? state.persons[anchorId]?.name : undefined;

    const groupRosterCount = anchorId
      ? Object.values(state.persons).filter((p) => p.anchorId === anchorId)
        .length
      : 0;

    const groupAnnouncements = anchorId
      ? Object.values(state.announcements)
        .filter((a) => a.anchorId === anchorId)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned))
      : [];

    const groupMeetings = anchorId
      ? Object.values(state.meetings).filter((m) => m.anchorId === anchorId)
      : [];

    const volunteeringRequests = Object.values(state.volunteeringRequests)
      .filter(
        (r) =>
          r.createdByPersonId === user.personId ||
          !r.assignedToPersonId ||
          r.assignedToPersonId === user.personId
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const ownVolunteeringWorks = Object.values(state.volunteeringWorks)
      .filter((w) => w.personId === user.personId)
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

    const ownSampledRequests = Object.values(state.sampledRequests).filter(
      (sr) => sr.sampledPersonIds.includes(user.personId)
    );

    return {
      role: 'student',
      ownProfile,
      anchorName,
      groupRosterCount,
      groupAnnouncements,
      groupMeetings,
      volunteeringRequests,
      ownVolunteeringWorks,
      ownSampledRequests,
      nextSeq: state.nextSeq,
    };
  }

  if (user.role === 'anchor') {
    const ownProfile = state.persons[user.personId] || null;
    const roster = Object.values(state.persons)
      .filter((p) => p.anchorId === user.personId)
      .sort((a, b) => a.personId.localeCompare(b.personId))
      .slice(0, state.rosterCap);
    const rosterIds = new Set(roster.map((p) => p.personId));

    const availableJoinCodeCount = Object.values(state.persons).filter(
      (p) =>
        p.joinCode &&
        !p.joinCodeRedeemedByAnchorId &&
        (!p.joinCodeExpiresAt || Date.parse(p.joinCodeExpiresAt) > Date.now())
    ).length;

    const ownAnnouncements = Object.values(state.announcements)
      .filter((a) => a.anchorId === user.personId)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return Date.parse(b.postedAt) - Date.parse(a.postedAt);
      });

    const ownMeetings = Object.values(state.meetings).filter(
      (m) => m.anchorId === user.personId
    );

    const resources = Object.values(state.resources).sort(
      (a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt)
    );

    const rosterMonthlyChecks = state.monthlyChecks.filter((c) =>
      rosterIds.has(c.personId)
    );

    const rosterAdminFlags = state.adminFlags.filter(
      (f) => rosterIds.has(f.subjectPersonId) || f.raisedBy.includes(user.name)
    );

    const rosterVolunteeringWorks = Object.values(
      state.volunteeringWorks
    ).filter((w) => rosterIds.has(w.personId) || w.personId === user.personId);

    const openVolunteeringRequests = Object.values(
      state.volunteeringRequests
    ).filter(
      (r) =>
        !r.assignedToPersonId ||
        rosterIds.has(r.createdByPersonId) ||
        rosterIds.has(r.assignedToPersonId)
    );

    const sampledRequestsForRoster = Object.values(state.sampledRequests)
      .filter((sr) => sr.sampledPersonIds.some((pid) => rosterIds.has(pid)))
      .map((sr) => ({
        ...sr,
        sampledPersonIds: sr.sampledPersonIds.filter((pid) =>
          rosterIds.has(pid)
        ),
        responses: Object.fromEntries(
          Object.entries(sr.responses).filter(([pid]) => rosterIds.has(pid))
        ),
      }));

    const ownAnchorApplications = state.anchorApplications.filter(
      (app) => app.personId === user.personId
    );

    return {
      role: 'anchor',
      ownProfile,
      roster,
      rosterCap: state.rosterCap,
      anchorFeeAmount: state.anchorFeeAmount,
      availableJoinCodeCount,
      ownAnnouncements,
      ownMeetings,
      resources,
      rosterMonthlyChecks,
      rosterAdminFlags,
      rosterVolunteeringWorks,
      openVolunteeringRequests,
      sampledRequestsForRoster,
      ownAnchorApplications,
      nextSeq: state.nextSeq,
    };
  }

  const allPersons = Object.values(state.persons).sort((a, b) =>
    a.personId.localeCompare(b.personId)
  );
  const alumniDirectory = allPersons.filter(
    (p) => p.roles.includes('alumni') || p.careerHistory.length > 0
  );

  return {
    role: 'admin',
    persons: state.persons,
    allPersons,
    volunteeringWorks: Object.values(state.volunteeringWorks),
    volunteeringRequests: Object.values(state.volunteeringRequests),
    sampledRequests: Object.values(state.sampledRequests),
    adminFlags: state.adminFlags,
    monthlyChecks: state.monthlyChecks,
    cycles: state.cycles,
    events: state.events,
    workerBookmark: state.workerBookmark,
    rosterCap: state.rosterCap,
    anchorFeeAmount: state.anchorFeeAmount,
    alumniDirectory,
    nextSeq: state.nextSeq,
  };
}
