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

export const DEMO_ACCOUNTS: Record<UserRole, DemoCredentialAccount> = {
  applicant: {
    role: 'applicant',
    personId: 'P-2026-07',
    name: 'Divya R',
    email: 'divya.r@maatram-synthetic.edu.in',
    password: 'maatram-applicant',
    subtitle: '2026 cycle, draft saved',
    description:
      '7-question scholarship application, 5 verification document uploads, stage tracker, and workspace join code.',
  },
  student: {
    role: 'student',
    personId: 'P-2024-01',
    name: 'Arun K',
    email: 'arun.k@maatram-synthetic.edu.in',
    password: 'maatram-student',
    subtitle: 'B.Tech IT, 4th semester',
    description:
      'CGPA progression, difficulty flags, Anchor group meetings & leave requests, volunteering proof, and placement log.',
  },
  anchor: {
    role: 'anchor',
    personId: 'P-2020-01',
    name: 'Meera Krishnan',
    email: 'meera.krishnan@maatram-synthetic.edu.in',
    password: 'maatram-anchor',
    subtitle: 'Roster of 15',
    description:
      'Manage your 15-scholar cohort, redeem join codes, approve volunteering, review leave, and query Alumni directory.',
  },
  admin: {
    role: 'admin',
    personId: 'ADMIN',
    name: 'Admin',
    email: 'admin@maatram-synthetic.edu.in',
    password: 'maatram-admin',
    subtitle: 'OTP gate · 123456',
    description:
      'Applicant verification, bulk selection, sampled data audits, awards, cycle analytics, settings, and Event Log.',
  },
};

export interface NavItem {
  id: string;
  path: string;
  label: string;
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
  switch (role) {
    case 'applicant':
      return [{ id: 'applicant', path: '/applicant', label: 'My Application' }];
    case 'student':
      return [{ id: 'student', path: '/student', label: 'Student Workspace' }];
    case 'anchor':
      return [
        { id: 'anchor', path: '/anchor', label: 'Anchor Workspace' },
        { id: 'alumni', path: '/alumni', label: 'Alumni Directory' },
      ];
    case 'admin':
      return [
        { id: 'admin', path: '/admin', label: 'Admin Console' },
        { id: 'alumni', path: '/alumni', label: 'Alumni Career Tracker' },
        { id: 'events', path: '/events', label: 'Audit and Event Log' },
      ];
  }
}

export function canAccessRoute(
  user: AuthSessionUser | null,
  pathname: string
): boolean {
  if (!user) {
    return pathname === '/login';
  }
  const clean = pathname.split('?')[0];
  switch (user.role) {
    case 'applicant':
      return clean === '/applicant';
    case 'student':
      return clean === '/student';
    case 'anchor':
      return clean === '/anchor' || clean === '/alumni';
    case 'admin':
      return clean === '/admin' || clean === '/alumni' || clean === '/events';
  }
}

export function verifyRoleCredentials(
  role: UserRole,
  emailInput: string,
  passwordInput: string
): { valid: boolean; user?: AuthSessionUser; error?: string } {
  const account = DEMO_ACCOUNTS[role];
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!email) {
    return { valid: false, error: 'Please enter the synthetic account email.' };
  }
  if (!password) {
    return { valid: false, error: 'Please enter the account password.' };
  }
  if (email !== account.email.toLowerCase() || password !== account.password) {
    return {
      valid: false,
      error: `Invalid credentials for ${role}. Use demo hint (${account.email} / ${account.password}).`,
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
  alumniDirectory: PersonProfile[];
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
    return {
      role: 'applicant',
      ownProfile: state.persons[user.personId] || null,
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

    const alumniDirectory = Object.values(state.persons)
      .filter((p) => p.roles.includes('alumni') || p.careerHistory.length > 0)
      .sort((a, b) => a.personId.localeCompare(b.personId));

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
      alumniDirectory,
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
