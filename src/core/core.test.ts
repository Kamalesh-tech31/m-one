import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeCompanyName } from './normalization';
import {
  applyEvent,
  foldEvents,
  processEmailWorker,
  replayFromStart,
  replayFromTime,
} from './reducer';
import { EventStore } from './store';
import type { LifecycleEvent } from './types';
import {
  DEMO_ADMIN_OTP,
  selectSampledCohort,
  validateLeaveRequest,
  validateUploadFile,
  verifyAdminOtp,
} from './validation';
import {
  canAccessRoute,
  DEMO_ACCOUNTS,
  getEventActor,
  getHomeRouteForRole,
  getNavItemsForRole,
  getSidebarItemsForRole,
  selectForUser,
  verifyRoleCredentials,
} from './scoping';
import { buildSeedEvents } from './seed';
import {
  createSafeDemoBlob,
  createSafeDemoFile,
  generateDemoEducationalDetails,
  generateDemoFamilyDetails,
  generateDemoFinancialDetails,
  generateDemoPersonalDetails,
  generateRandomApplicantData,
  generateSampleRegistrationDetails,
} from './demoGenerator';

function makeEvent(
  partial: Partial<LifecycleEvent> & Pick<LifecycleEvent, 'id' | 'seq' | 'type' | 'personId'>
): LifecycleEvent {
  return {
    payload: {},
    occurredAt: '2026-11-10T10:00:00.000Z',
    recordedAt: '2026-11-10T10:00:01.000Z',
    actor: 'Test Runner',
    cycleId: '2026',
    ...partial,
  };
}

describe('Maatram One Event-Sourced Core', () => {
  it('folds applicant -> selected -> student -> alumni -> anchor and derives volunteering counts only from verified events', () => {
    const events: LifecycleEvent[] = [
      makeEvent({
        id: 'E1',
        seq: 1,
        type: 'APPLICATION_SUBMITTED',
        personId: 'P-TEST-1',
        payload: {
          email: 'test@maatram-synthetic.edu.in',
          answers: {
            fullName: 'Test Scholar',
            schoolName: 'Govt HSS',
            schoolType: 'Government',
            tenthMarks: '480/500',
            twelfthMarks: '570/600',
            parentOccupation: 'Carpenter',
            familyAnnualIncome: 'Rs 1,20,000',
            housingType: 'Rented',
            whyMaatram: 'Looking for engineering scholarship and mentorship.',
          },
        },
      }),
      makeEvent({
        id: 'E2',
        seq: 2,
        type: 'APPLICANT_SELECTED',
        personId: 'P-TEST-1',
        payload: {
          joinCode: 'MTRM-2026-9999',
          joinCodeExpiresAt: '2026-11-22T10:00:00.000Z',
          reason: 'Top panel score',
        },
      }),
      makeEvent({
        id: 'E3',
        seq: 3,
        type: 'JOIN_CODE_REDEEMED',
        personId: 'P-TEST-1',
        payload: { joinCode: 'MTRM-2026-9999', anchorId: 'P-ANCHOR-1' },
      }),
      makeEvent({
        id: 'E4',
        seq: 4,
        type: 'VOLUNTEERING_WORK_SUBMITTED',
        personId: 'P-TEST-1',
        payload: {
          workId: 'W-1',
          category: 'physical_verification',
          region: 'Chennai',
          location: 'Tambaram',
          photoUrl: '/mock.jpg',
          submitterRole: 'student',
        },
      }),
      makeEvent({
        id: 'E5',
        seq: 5,
        type: 'VOLUNTEERING_WORK_ANCHOR_APPROVED',
        personId: 'P-ANCHOR-1',
        payload: { workId: 'W-1' },
      }),
    ];

    const beforeVerify = foldEvents(events);
    expect(beforeVerify.persons['P-TEST-1'].status).toBe('student');
    expect(beforeVerify.persons['P-TEST-1'].volunteeringCounts.physicalVerifications).toBe(0);

    const afterVerify = applyEvent(
      beforeVerify,
      makeEvent({
        id: 'E6',
        seq: 6,
        type: 'VOLUNTEERING_WORK_VERIFIED',
        personId: 'P-TEST-1',
        payload: { workId: 'W-1', verifiedBy: 'Admin (OTP verified)' },
      })
    );
    expect(afterVerify.persons['P-TEST-1'].volunteeringCounts.physicalVerifications).toBe(1);

    const withCareer = applyEvent(
      afterVerify,
      makeEvent({
        id: 'E7',
        seq: 7,
        type: 'CAREER_HISTORY_ADDED',
        personId: 'P-TEST-1',
        payload: {
          entryId: 'CH-1',
          company: 'TCS',
          roleTitle: 'Engineer',
          startYear: 2026,
          source: 'placement',
        },
      })
    );
    expect(withCareer.persons['P-TEST-1'].roles).toContain('alumni');

    const asAnchor = applyEvent(
      withCareer,
      makeEvent({
        id: 'E8',
        seq: 8,
        type: 'ANCHOR_WILLINGNESS_APPLIED',
        personId: 'P-TEST-1',
        payload: {
          applicationId: 'ANC-1',
          motivation: 'Give back',
          preferredRegion: 'Chennai',
          feeAmount: 1000,
          paymentReceiptId: 'RCPT-1',
        },
      })
    );
    expect(asAnchor.persons['P-TEST-1'].status).toBe('anchor');
    expect(asAnchor.persons['P-TEST-1'].roles).toContain('anchor');
  });

  it('deduplicates events with an already-seen id (idempotency)', () => {
    const store = new EventStore([]);
    const first = store.append({
      id: 'DUP-EVENT-1',
      type: 'APPLICATION_SUBMITTED',
      personId: 'P-DUP',
      actor: 'Student',
      cycleId: '2026',
      payload: {
        answers: {
          fullName: 'Duplicate Test',
          schoolName: 'Govt School',
          schoolType: 'Government',
          tenthMarks: '450/500',
          twelfthMarks: '540/600',
          parentOccupation: 'Driver',
          familyAnnualIncome: 'Rs 1,00,000',
          housingType: 'Rented',
          whyMaatram: 'Testing idempotency in reducer.',
        },
      },
    });
    expect(first.appended).toBe(true);
    expect(store.getEvents().length).toBe(1);

    const second = store.append({
      id: 'DUP-EVENT-1',
      type: 'APPLICATION_SUBMITTED',
      personId: 'P-DUP',
      actor: 'Student',
      cycleId: '2026',
      payload: { answers: { fullName: 'Should Be Ignored' } },
    });
    expect(second.appended).toBe(false);
    expect(store.getEvents().length).toBe(1);
    expect(store.getState().persons['P-DUP'].name).toBe('Duplicate Test');
  });

  it('replays from bookmark and from start without producing duplicate outbox emails', () => {
    const events: LifecycleEvent[] = [
      makeEvent({
        id: 'MAIL-E1',
        seq: 1,
        type: 'APPLICATION_SUBMITTED',
        personId: 'P-MAIL-1',
        payload: {
          email: 'mail1@maatram-synthetic.edu.in',
          answers: { fullName: 'Mail One' },
        },
      }),
      makeEvent({
        id: 'MAIL-E2',
        seq: 2,
        type: 'APPLICANT_SELECTED',
        personId: 'P-MAIL-1',
        payload: { joinCode: 'MTRM-2026-1111', joinCodeExpiresAt: '2026-11-22T00:00:00Z' },
      }),
    ];

    const state1 = foldEvents(events);
    expect(state1.workerBookmark.lastSeq).toBe(2);
    expect(state1.workerBookmark.outbox.length).toBe(2);

    const replayedBookmark = processEmailWorker(
      events,
      {
        ...state1.workerBookmark,
        lastSeq: 0,
      },
      state1.persons
    );
    expect(replayedBookmark.outbox.length).toBe(2);
    expect(replayedBookmark.lastSeq).toBe(2);

    const replayedStart = replayFromStart(events);
    expect(replayedStart.workerBookmark.outbox.length).toBe(2);
  });

  it('handles out-of-order occurredAt events using commit seq so worker bookmark never skips late events', () => {
    const e1 = makeEvent({
      id: 'OOO-1',
      seq: 1,
      type: 'APPLICATION_SUBMITTED',
      personId: 'P-OOO',
      occurredAt: '2026-11-10T10:00:00.000Z',
      payload: { answers: { fullName: 'Late Event Scholar' } },
    });
    const e2 = makeEvent({
      id: 'OOO-2',
      seq: 2,
      type: 'STAGE_ADVANCED',
      personId: 'P-OOO',
      occurredAt: '2026-11-15T10:00:00.000Z',
      payload: { stage: 'physical_verification' },
    });

    const initialFold = foldEvents([e1, e2]);
    expect(initialFold.workerBookmark.lastSeq).toBe(2);
    expect(initialFold.persons['P-OOO'].stage).toBe('physical_verification');

    const lateEvent = makeEvent({
      id: 'OOO-3',
      seq: 3,
      type: 'STAGE_ADVANCED',
      personId: 'P-OOO',
      occurredAt: '2026-11-12T10:00:00.000Z',
      payload: { stage: 'tele_verification' },
    });

    const nextFold = applyEvent(initialFold, lateEvent);
    const nextBookmark = processEmailWorker(
      nextFold.events,
      initialFold.workerBookmark,
      nextFold.persons
    );

    expect(nextBookmark.lastSeq).toBe(3);
    expect(nextBookmark.processedEventIds).toContain('OOO-3');
    expect(nextFold.persons['P-OOO'].stage).toBe('physical_verification');
    expect(nextFold.persons['P-OOO'].statusHistory.map((h) => h.stage)).toEqual([
      'application',
      'tele_verification',
      'physical_verification',
    ]);

    const timeReplay = replayFromTime(nextFold.events, '2026-11-12T00:00:00.000Z', nextBookmark);
    expect(timeReplay.events.length).toBe(3);
    expect(timeReplay.workerBookmark.outbox.length).toBe(1);
  });

  it('normalizes company names across casing, legal suffixes, and alias table', () => {
    const a = normalizeCompanyName('tcs');
    const b = normalizeCompanyName('Tata Consultancy Services Pvt. Ltd.');
    const c = normalizeCompanyName('Tata Consultancy Services Limited');
    expect(a.normalized).toBe('Tata Consultancy Services');
    expect(b.normalized).toBe('Tata Consultancy Services');
    expect(c.normalized).toBe('Tata Consultancy Services');
    expect(a.canonicalKey).toBe(b.canonicalKey);

    const d = normalizeCompanyName('CTS');
    const e = normalizeCompanyName('Cognizant Technology Solutions India');
    expect(d.normalized).toBe('Cognizant');
    expect(e.normalized).toBe('Cognizant');
  });

  it('validates upload file types (PDF/JPG/PNG only) and size (max 5 MB)', () => {
    expect(
      validateUploadFile({
        name: 'marksheet.pdf',
        type: 'application/pdf',
        size: 1024 * 1024,
      }).valid
    ).toBe(true);

    expect(
      validateUploadFile({
        name: 'income_cert.jpg',
        type: 'image/jpeg',
        size: 5 * 1024 * 1024,
      }).valid
    ).toBe(true);

    const wrongType = validateUploadFile({
      name: 'script.exe',
      type: 'application/x-msdownload',
      size: 5000,
    });
    expect(wrongType.valid).toBe(false);
    expect(wrongType.error).toMatch(/Only PDF, JPG, or PNG/i);

    const oversized = validateUploadFile({
      name: 'huge_scan.png',
      type: 'image/png',
      size: 5 * 1024 * 1024 + 1,
    });
    expect(oversized.valid).toBe(false);
    expect(oversized.error).toMatch(/exceeds the 5\.00 MB/i);
  });

  it('validates admin OTP gate logic (demo OTP 123456)', () => {
    expect(verifyAdminOtp('').valid).toBe(false);
    expect(verifyAdminOtp('12ab').valid).toBe(false);
    expect(verifyAdminOtp('999999').valid).toBe(false);
    expect(verifyAdminOtp(DEMO_ADMIN_OTP).valid).toBe(true);
    expect(verifyAdminOtp(` ${DEMO_ADMIN_OTP} `).valid).toBe(true);
  });

  it('validates meeting leave requests (required reason and valid proof upload)', () => {
    const validProof = {
      name: 'exam_schedule.pdf',
      type: 'application/pdf',
      size: 320000,
    };

    expect(
      validateLeaveRequest({ reason: '', proofFile: validProof }).valid
    ).toBe(false);
    expect(
      validateLeaveRequest({ reason: 'End-sem lab exam', proofFile: null }).valid
    ).toBe(false);
    expect(
      validateLeaveRequest({
        reason: 'End-sem lab exam',
        proofFile: { name: 'virus.exe', type: 'application/x-msdownload', size: 1000 },
      }).valid
    ).toBe(false);
    expect(
      validateLeaveRequest({ reason: 'End-sem lab exam', proofFile: validProof }).valid
    ).toBe(true);
  });

  it('samples cohort deterministically at 1 person per 25', () => {
    expect(selectSampledCohort([], 25)).toEqual([]);
    expect(selectSampledCohort(['P-1', 'P-2', 'P-3'], 25)).toEqual(['P-1']);

    const cohort26 = Array.from({ length: 26 }, (_, i) =>
      `P-${String(i + 1).padStart(2, '0')}`
    );
    expect(selectSampledCohort(cohort26, 25).length).toBe(2);

    const cohort75 = Array.from({ length: 75 }, (_, i) =>
      `P-${String(i + 1).padStart(2, '0')}`
    );
    expect(selectSampledCohort(cohort75, 25).length).toBe(3);
  });
});

describe('Maatram One Role Auth, Route Guard & Scoping', () => {
  it('enforces route guards and home routes per role', () => {
    expect(getHomeRouteForRole('applicant')).toBe('/applicant');
    expect(getHomeRouteForRole('student')).toBe('/student');
    expect(getHomeRouteForRole('anchor')).toBe('/anchor');
    expect(getHomeRouteForRole('admin')).toBe('/admin');

    expect(canAccessRoute(null, '/login')).toBe(true);
    expect(canAccessRoute(null, '/login/applicant')).toBe(true);
    expect(canAccessRoute(null, '/student')).toBe(false);
    expect(canAccessRoute(null, '/admin')).toBe(false);

    const applicantUser = verifyRoleCredentials(
      'applicant',
      DEMO_ACCOUNTS.applicant.email,
      DEMO_ACCOUNTS.applicant.password
    ).user!;
    expect(canAccessRoute(applicantUser, '/applicant')).toBe(true);
    expect(canAccessRoute(applicantUser, '/applicant/documents')).toBe(true);
    expect(canAccessRoute(applicantUser, '/student')).toBe(false);
    expect(canAccessRoute(applicantUser, '/anchor')).toBe(false);
    expect(canAccessRoute(applicantUser, '/admin')).toBe(false);
    expect(canAccessRoute(applicantUser, '/alumni')).toBe(false);
    expect(canAccessRoute(applicantUser, '/events')).toBe(false);
    expect(canAccessRoute(applicantUser, '/profile')).toBe(true);

    const studentUser = verifyRoleCredentials(
      'student',
      DEMO_ACCOUNTS.student.email,
      DEMO_ACCOUNTS.student.password
    ).user!;
    expect(canAccessRoute(studentUser, '/student')).toBe(true);
    expect(canAccessRoute(studentUser, '/student/volunteering')).toBe(true);
    expect(canAccessRoute(studentUser, '/applicant')).toBe(false);
    expect(canAccessRoute(studentUser, '/anchor')).toBe(false);
    expect(canAccessRoute(studentUser, '/alumni')).toBe(false);
    expect(canAccessRoute(studentUser, '/admin')).toBe(false);
    expect(canAccessRoute(studentUser, '/events')).toBe(false);
    expect(canAccessRoute(studentUser, '/profile')).toBe(true);

    const anchorUser = verifyRoleCredentials(
      'anchor',
      DEMO_ACCOUNTS.anchor.email,
      DEMO_ACCOUNTS.anchor.password
    ).user!;
    expect(canAccessRoute(anchorUser, '/anchor')).toBe(true);
    expect(canAccessRoute(anchorUser, '/anchor/roster')).toBe(true);
    expect(canAccessRoute(anchorUser, '/applicant')).toBe(false);
    expect(canAccessRoute(anchorUser, '/student')).toBe(false);
    // Anchor redirected from alumni tracker and event log
    expect(canAccessRoute(anchorUser, '/alumni')).toBe(false);
    expect(canAccessRoute(anchorUser, '/events')).toBe(false);
    expect(canAccessRoute(anchorUser, '/admin')).toBe(false);
    expect(canAccessRoute(anchorUser, '/profile')).toBe(true);

    const adminUser = verifyRoleCredentials(
      'admin',
      DEMO_ACCOUNTS.admin.email,
      DEMO_ACCOUNTS.admin.password
    ).user!;
    expect(canAccessRoute(adminUser, '/admin')).toBe(true);
    expect(canAccessRoute(adminUser, '/admin/applicants')).toBe(true);
    expect(canAccessRoute(adminUser, '/admin/cycles')).toBe(true);
    expect(canAccessRoute(adminUser, '/alumni')).toBe(true);
    expect(canAccessRoute(adminUser, '/events')).toBe(true);
    expect(canAccessRoute(adminUser, '/applicant')).toBe(false);
    expect(canAccessRoute(adminUser, '/student')).toBe(false);
    expect(canAccessRoute(adminUser, '/anchor')).toBe(false);
    expect(canAccessRoute(adminUser, '/profile')).toBe(true);
  });

  it('provides sidebar items matching Section 4 exactly for each role', () => {
    const applicantItems = getSidebarItemsForRole('applicant');
    expect(applicantItems.map((i) => i.label)).toEqual([
      'Application',
    ]);
    expect(applicantItems.map((i) => i.path)).toEqual([
      '/applicant/application',
    ]);

    const studentItems = getSidebarItemsForRole('student');
    expect(studentItems.map((i) => i.label)).toEqual([
      'Overview',
      'Volunteering',
      'Achievements and CGPA',
      'Meetings and announcements',
      'Placement',
      'Get help',
    ]);
    expect(studentItems.map((i) => i.path)).toEqual([
      '/student/overview',
      '/student/volunteering',
      '/student/academics',
      '/student/meetings',
      '/student/placement',
      '/student/help',
    ]);

    const anchorItems = getSidebarItemsForRole('anchor');
    expect(anchorItems.map((i) => i.label)).toEqual([
      'Roster',
      'Announcements',
      'Meetings and leave',
      'Resources',
      'Requests inbox',
    ]);
    expect(anchorItems.map((i) => i.path)).toEqual([
      '/anchor/roster',
      '/anchor/announcements',
      '/anchor/meetings',
      '/anchor/resources',
      '/anchor/requests',
    ]);
    // Verifies Alumni Directory is removed for Anchor
    expect(anchorItems.some((i) => i.label.toLowerCase().includes('alumni'))).toBe(false);

    const adminItems = getSidebarItemsForRole('admin');
    expect(adminItems.map((i) => i.label)).toEqual([
      'Applicants',
      'Cycles',
      'Volunteering approvals',
      'Sampled requests',
      'Alumni career tracker',
      'Audit and Event Log',
    ]);
    expect(adminItems.map((i) => i.path)).toEqual([
      '/admin/applicants',
      '/admin/cycles',
      '/admin/verification',
      '/admin/sampled',
      '/admin/alumni',
      '/admin/events',
    ]);
    expect(adminItems.some((i) => i.label.toLowerCase().includes('setting'))).toBe(false);
  });

  it('verifies demo credentials, rejects wrong passwords, and blocks cross-portal login attempts', () => {
    // 1. Applicant
    const okApp = verifyRoleCredentials(
      'applicant',
      'divya.r@maatram.demo',
      'Demo@123'
    );
    expect(okApp.valid).toBe(true);
    expect(okApp.user?.personId).toBe('P-2026-07');
    expect(okApp.user?.name).toBe('Divya R');

    // Cross-portal rejection
    const appWrongPortal = verifyRoleCredentials(
      'applicant',
      'arun.k@maatram.demo',
      'Demo@123'
    );
    expect(appWrongPortal.valid).toBe(false);
    expect(appWrongPortal.error).toBe('This account belongs to a different portal');

    // 2. Student
    const okStudent = verifyRoleCredentials(
      'student',
      'arun.k@maatram.demo',
      'Demo@123'
    );
    expect(okStudent.valid).toBe(true);
    expect(okStudent.user?.personId).toBe('P-2024-01');

    const studentWrongPortal = verifyRoleCredentials(
      'student',
      'meera.krishnan@maatram.demo',
      'Demo@123'
    );
    expect(studentWrongPortal.valid).toBe(false);
    expect(studentWrongPortal.error).toBe('This account belongs to a different portal');

    // 3. Anchor
    const okAnchor = verifyRoleCredentials(
      'anchor',
      'meera.krishnan@maatram.demo',
      'Demo@123'
    );
    expect(okAnchor.valid).toBe(true);
    expect(okAnchor.user?.personId).toBe('P-2020-01');

    const anchorWrongPortal = verifyRoleCredentials(
      'anchor',
      'admin@maatram.demo',
      'Demo@123'
    );
    expect(anchorWrongPortal.valid).toBe(false);
    expect(anchorWrongPortal.error).toBe('This account belongs to a different portal');

    // 4. Admin
    const okAdmin = verifyRoleCredentials(
      'admin',
      'admin@maatram.demo',
      'Demo@123'
    );
    expect(okAdmin.valid).toBe(true);
    expect(verifyAdminOtp('123456').valid).toBe(true);
    expect(verifyAdminOtp('999999').valid).toBe(false);

    const adminWrongPortal = verifyRoleCredentials(
      'admin',
      'divya.r@maatram.demo',
      'Demo@123'
    );
    expect(adminWrongPortal.valid).toBe(false);
    expect(adminWrongPortal.error).toBe('This account belongs to a different portal');

    // Wrong password for any role
    const badPass = verifyRoleCredentials(
      'student',
      'arun.k@maatram.demo',
      'wrong-pass'
    );
    expect(badPass.valid).toBe(false);
    expect(badPass.error).toBe('Invalid email or password.');
  });

  it('scopes selectForUser strictly by role and prevents anchor from reading alumni directory', () => {
    const state = foldEvents(buildSeedEvents());

    const applicantUser = verifyRoleCredentials(
      'applicant',
      DEMO_ACCOUNTS.applicant.email,
      DEMO_ACCOUNTS.applicant.password
    ).user!;
    const applicantView = selectForUser(state, applicantUser);
    expect(applicantView?.role).toBe('applicant');
    if (applicantView?.role === 'applicant') {
      expect(applicantView.ownProfile?.personId).toBe('P-2026-07');
      expect(applicantView.ownProfile?.name).toBe('Divya R');
      expect('allPersons' in applicantView).toBe(false);
    }

    const studentUser = verifyRoleCredentials(
      'student',
      DEMO_ACCOUNTS.student.email,
      DEMO_ACCOUNTS.student.password
    ).user!;
    const studentView = selectForUser(state, studentUser);
    expect(studentView?.role).toBe('student');
    if (studentView?.role === 'student') {
      expect(studentView.ownProfile?.personId).toBe('P-2024-01');
      expect(studentView.anchorName).toBe('Meera Krishnan');
      expect(studentView.ownVolunteeringWorks.every((w) => w.personId === 'P-2024-01')).toBe(true);
      expect(studentView.groupAnnouncements.every((a) => a.anchorId === 'P-2020-01')).toBe(true);
      expect(
        studentView.ownSampledRequests.every((sr) => sr.sampledPersonIds.includes('P-2024-01'))
      ).toBe(true);
      expect('events' in studentView).toBe(false);
    }

    const anchorUser = verifyRoleCredentials(
      'anchor',
      DEMO_ACCOUNTS.anchor.email,
      DEMO_ACCOUNTS.anchor.password
    ).user!;
    const anchorView = selectForUser(state, anchorUser);
    expect(anchorView?.role).toBe('anchor');
    if (anchorView?.role === 'anchor') {
      expect(anchorView.ownProfile?.personId).toBe('P-2020-01');
      expect(anchorView.roster.length).toBeLessThanOrEqual(anchorView.rosterCap);
      expect(anchorView.roster.every((p) => p.anchorId === 'P-2020-01')).toBe(true);
      expect(anchorView.ownAnnouncements.every((a) => a.anchorId === 'P-2020-01')).toBe(true);
      expect(anchorView.ownMeetings.every((m) => m.anchorId === 'P-2020-01')).toBe(true);
      // Anchor cannot read alumni directory / other alumni career history
      expect('alumniDirectory' in anchorView).toBe(false);
    }

    const adminUser = verifyRoleCredentials(
      'admin',
      DEMO_ACCOUNTS.admin.email,
      DEMO_ACCOUNTS.admin.password
    ).user!;
    const adminView = selectForUser(state, adminUser);
    expect(adminView?.role).toBe('admin');
    if (adminView?.role === 'admin') {
      expect(adminView.allPersons.length).toBeGreaterThan(10);
      expect(adminView.events.length).toBe(state.events.length);
      expect(adminView.rosterCap).toBe(15);
      expect(adminView.alumniDirectory.length).toBeGreaterThan(0);
    }

    expect(selectForUser(state, null)).toBeNull();
  });

  it('resolves event actor from the logged-in session user', () => {
    expect(getEventActor(null)).toBe('Guest Applicant');
    expect(getEventActor(verifyRoleCredentials('applicant', DEMO_ACCOUNTS.applicant.email, DEMO_ACCOUNTS.applicant.password).user!)).toBe('Divya R');
    expect(getEventActor(verifyRoleCredentials('student', DEMO_ACCOUNTS.student.email, DEMO_ACCOUNTS.student.password).user!)).toBe('Arun K');
    expect(getEventActor(verifyRoleCredentials('anchor', DEMO_ACCOUNTS.anchor.email, DEMO_ACCOUNTS.anchor.password).user!)).toBe('Meera Krishnan (Anchor)');
    expect(getEventActor(verifyRoleCredentials('admin', DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password).user!)).toBe('Admin (OTP verified)');
  });

  it('appends profile.updated event and applies updates without silent mutation', () => {
    const initialState = foldEvents(buildSeedEvents());
    const actor = 'Arun K';

    const updated = applyEvent(
      initialState,
      makeEvent({
        id: 'EVT-PROF-TEST-1',
        seq: initialState.nextSeq,
        type: 'profile.updated',
        personId: 'P-2024-01',
        actor,
        payload: {
          name: 'Arun Kumar',
          phone: '+91 98765 43210',
          college: 'PSG College of Technology',
          degree: 'B.Tech Information Technology',
          photoUrl: 'data:image/png;base64,mock',
        },
      })
    );

    const person = updated.persons['P-2024-01'];
    expect(person.name).toBe('Arun Kumar');
    expect(person.phone).toBe('+91 98765 43210');
    expect(person.college).toBe('PSG College of Technology');
    expect(person.photoUrl).toBe('data:image/png;base64,mock');
  });

  it('appends anchor career entry and updates current job via deterministic replay', () => {
    const initialState = foldEvents(buildSeedEvents());
    const anchorActor = 'Meera Krishnan (Anchor)';

    const withNewJob = applyEvent(
      initialState,
      makeEvent({
        id: 'EVT-CAREER-TEST-1',
        seq: initialState.nextSeq,
        type: 'CAREER_HISTORY_ADDED',
        personId: 'P-2020-01',
        actor: anchorActor,
        payload: {
          entryId: 'CH-MEERA-NEW',
          company: 'Tata Consultancy Services Pvt Ltd',
          roleTitle: 'Principal Architect',
          startYear: 2026,
          source: 'self-reported',
        },
      })
    );

    const replayed = replayFromStart(withNewJob.events);
    const meera = replayed.persons['P-2020-01'];
    expect(meera.currentCompany).toBe('Tata Consultancy Services Pvt Ltd');
    expect(meera.currentRoleTitle).toBe('Principal Architect');
    expect(meera.careerHistory.some((c) => c.entryId === 'CH-MEERA-NEW')).toBe(true);
  });
});

describe('Maatram One Follow-up 3 Manrope-Only Typography', () => {
  it('loads only Manrope (400-800) and guarantees body, button, and input font-family resolves to Manrope', () => {
    const rootDir = path.resolve(process.cwd());
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');

    expect(html).toContain('family=Manrope:wght@400;500;600;700;800');
    expect(html).not.toMatch(/Playfair|Inter|JetBrains/i);

    expect(css).toMatch(/--font-sans:\s*'Manrope'/);
    expect(css).toMatch(/--font-display:\s*'Manrope'/);
    expect(css).toMatch(/--font-mono:\s*'Manrope'/);
    expect(css).toMatch(/html,\s*\n\s*body\s*\{[^}]*font-family:\s*'Manrope'/s);
    expect(css).toMatch(/button,\s*\n\s*input,\s*\n\s*select,\s*\n\s*textarea[^}]*font-family:\s*inherit/s);

    const resolveComputedStartFont = (selectorFont: string, inheritedBase: string) =>
      (selectorFont === 'inherit' ? inheritedBase : selectorFont)
        .replace(/['"]/g, '')
        .split(',')[0]
        .trim();

    const bodyFont = "'Manrope', system-ui, -apple-system, sans-serif";
    expect(resolveComputedStartFont(bodyFont, bodyFont)).toBe('Manrope');
    expect(resolveComputedStartFont('inherit', bodyFont)).toBe('Manrope');
  });

  it('supports applicant application workflow with applicationCode, mock identity reference and Application Code sign-in', () => {
    // 1. Submit event reduces applicationCode, identityRef, and otpVerified
    const submitEvent = makeEvent({
      id: 'EV-APP-SUBMIT-1',
      seq: 101,
      type: 'APPLICATION_SUBMITTED',
      personId: 'P-2026-99',
      actor: 'Priya S',
      payload: {
        email: 'priya.s@demo.local',
        region: 'Chennai',
        applicationCode: 'APP-2026-99',
        identityRef: 'MOCK-TN-2026-99',
        answers: {
          fullName: 'Priya S',
          schoolName: 'Govt Model HSS',
          schoolType: 'Government',
          tenthMarks: '480 / 500',
          twelfthMarks: '575 / 600',
          parentOccupation: 'Weaver',
          familyAnnualIncome: 'Rs 75,000',
          housingType: 'Rented',
          whyMaatram: 'Mentorship and financial aid for engineering education.',
          phone: '9840123456',
          identityRef: 'MOCK-TN-2026-99',
        },
      },
    });

    const state = applyEvent(foldEvents(buildSeedEvents()), submitEvent);
    const applicant = state.persons['P-2026-99'];
    expect(applicant).toBeDefined();
    expect(applicant.applicationCode).toBe('APP-2026-99');
    expect(applicant.identityRef).toBe('MOCK-TN-2026-99');
    expect(applicant.otpVerified).toBe(true);
    expect(applicant.statusHistory.some((h) => h.note?.includes('APP-2026-99'))).toBe(true);

    // 2. verifyRoleCredentials accepts demo applicant credentials or application code
    const credsCheck = verifyRoleCredentials('applicant', 'divya.r@maatram.demo', 'APP-2026-07');
    expect(credsCheck.valid).toBe(true);
    expect(credsCheck.user?.role).toBe('applicant');

    const passCheck = verifyRoleCredentials('applicant', 'divya.r@maatram.demo', 'Demo@123');
    expect(passCheck.valid).toBe(true);
  });

  it('generateRandomApplicantData produces a complete, correctly mapped demo applicant with Application Code and safe demo documents', () => {
    const first = generateRandomApplicantData();
    const second = generateRandomApplicantData();

    // 1. Application Code
    expect(first.applicationCode).toMatch(/^APP-2026-\d{2}$/);

    // 2. Personal Details
    expect(first.answers.fullName).toBeTruthy();
    expect(first.answers.gender).toMatch(/^(Female|Male)$/);
    expect(first.answers.dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.answers.phone).toMatch(/^\d{10}$/);
    expect(first.answers.identityRef).toMatch(/^MOCK-TN-2026-\d{4}$/);
    expect(first.answers.fatherName).toBeTruthy();
    expect(first.answers.motherName).toBeTruthy();
    expect(first.answers.familyMembersCount).toMatch(/^[345]$/);
    expect(first.answers.address).toBeTruthy();
    expect(first.answers.district).toBe(first.region);
    expect(first.answers.state).toBe('Tamil Nadu');
    expect(first.email).toMatch(/@demo\.local$/);
    expect(first.otp).toMatch(/^\d{6}$/);

    // 3. Educational Details & Mathematical Consistency
    expect(first.answers.academicYear).toBe('2026–2027');
    expect(first.answers.schoolName).toBeTruthy();
    expect(first.answers.schoolType).toMatch(/^(Government|Private)$/);
    expect(first.answers.mediumOfInstruction).toMatch(/^(Tamil|English)$/);
    expect(first.answers.stream).toBeTruthy();

    const tenthMatch = first.answers.tenthMarks.match(/^(\d+)\s*\/\s*500\s*\((\d+\.\d+)%\)$/);
    expect(tenthMatch).toBeTruthy();
    if (tenthMatch) {
      const obtained = Number(tenthMatch[1]);
      const pct = Number(tenthMatch[2]);
      expect(obtained).toBeLessThanOrEqual(500);
      expect(pct).toBeCloseTo((obtained / 500) * 100, 1);
    }

    const twelfthMatch = first.answers.twelfthMarks.match(/^(\d+)\s*\/\s*600\s*\((\d+\.\d+)%\)$/);
    expect(twelfthMatch).toBeTruthy();
    if (twelfthMatch) {
      const obtained = Number(twelfthMatch[1]);
      const pct = Number(twelfthMatch[2]);
      expect(obtained).toBeLessThanOrEqual(600);
      expect(pct).toBeCloseTo((obtained / 600) * 100, 1);
    }

    // 4. Financial Details
    expect(first.answers.familyAnnualIncome).toMatch(/^Rs \d{2,3},\d{3}$/);
    expect(first.answers.parentOccupation).toBeTruthy();
    expect(first.answers.incomeSource).toBeTruthy();
    expect(first.answers.monthlyRent).toMatch(/^Rs \d,\d{3}$/);
    expect(first.answers.schoolFees).toMatch(/^Rs \d,\d{3}$/);
    expect(first.answers.electricityBillAmount).toMatch(/^Rs \d{3}$/);
    expect(first.answers.otherExpenses).toBeTruthy();
    expect(first.answers.outstandingLoans).toBeTruthy();

    // 5. Safe Sample Documents
    const docFileNames = first.documents.map((d) => d.fileName);
    expect(docFileNames).toContain('income_certificate_demo.pdf');
    expect(docFileNames).toContain('electricity_bill_demo.pdf');
    expect(docFileNames).toContain('marksheet_10th_demo.pdf');
    expect(docFileNames).toContain('marksheet_12th_demo.pdf');
    expect(docFileNames).toContain('residence_front_demo.jpg');
    expect(first.documents.every((d) => d.description.includes('DEMO / SAMPLE'))).toBe(true);

    // 6. Safe demo blob creation
    const sampleBlob = createSafeDemoBlob(
      'Income Certificate',
      'income_certificate_demo.pdf',
      first.answers.fullName
    );
    expect(sampleBlob.size).toBeGreaterThan(0);
    expect(sampleBlob.type).toBe('application/pdf');

    // 7. Reducer Document Replacement (replaces instead of duplicate accumulation)
    const testPerson = {
      personId: 'P-TEST-DEDUP',
      fullName: 'Test Candidate',
      email: 'test@demo.local',
      documents: [],
      roles: ['applicant' as const],
      stage: 'applied' as const,
      cycleId: '2026',
      region: 'Chennai',
      statusHistory: [],
    };
    let state = foldEvents(buildSeedEvents());
    state.persons['P-TEST-DEDUP'] = testPerson as any;

    const event1: LifecycleEvent = {
      id: 'EV-1',
      seq: 9991,
      type: 'DOCUMENT_UPLOADED',
      personId: 'P-TEST-DEDUP',
      actor: 'Tester',
      cycleId: '2026',
      occurredAt: '2026-11-22T10:00:00.000Z',
      recordedAt: '2026-11-22T10:00:00.000Z',
      payload: {
        docId: 'D1',
        label: 'Income Certificate',
        fileName: 'income_certificate_demo.pdf',
        fileType: 'application/pdf',
        fileSize: 1000,
        signedUrl: '/mock/1',
      },
    };
    state = applyEvent(state, event1);
    expect(state.persons['P-TEST-DEDUP'].documents.length).toBe(1);

    const event2: LifecycleEvent = {
      id: 'EV-2',
      seq: 9992,
      type: 'DOCUMENT_UPLOADED',
      personId: 'P-TEST-DEDUP',
      actor: 'Tester',
      cycleId: '2026',
      occurredAt: '2026-11-22T10:05:00.000Z',
      recordedAt: '2026-11-22T10:05:00.000Z',
      payload: {
        docId: 'D2',
        label: 'Income Certificate',
        fileName: 'income_certificate_demo.pdf',
        fileType: 'application/pdf',
        fileSize: 1200,
        signedUrl: '/mock/2',
      },
    };
    state = applyEvent(state, event2);
    expect(state.persons['P-TEST-DEDUP'].documents.length).toBe(1);
    expect(state.persons['P-TEST-DEDUP'].documents[0].docId).toBe('D2');

    // 8. Distinct on repeated generation
    expect(first.answers.identityRef).not.toBe(second.answers.identityRef);
    expect(first.email).not.toBe(second.email);
  });

  it('provides independent section-wise demo data generation and registered account authentication', () => {
    // 1. Personal details
    const personal = generateDemoPersonalDetails();
    expect(personal.fullName).toBeTruthy();
    expect(personal.phone).toMatch(/^\d{10}$/);
    expect(['Male', 'Female', 'Other']).toContain(personal.gender);
    expect(personal.region).toBeTruthy();
    expect(personal.identityRef).toMatch(/^MOCK-TN-2026-\d{4}$/);

    // 2. Family details
    const family = generateDemoFamilyDetails();
    expect(family.fatherName).toBeTruthy();
    expect(family.motherName).toBeTruthy();
    expect(family.parentOccupation).toBeTruthy();
    expect(['Rented', 'Own']).toContain(family.housingType);
    expect(Number(family.familyMembersCount)).toBeGreaterThanOrEqual(3);

    // 3. Educational details
    const edu = generateDemoEducationalDetails('Chennai');
    expect(edu.schoolName).toBeTruthy();
    expect(['Government', 'Private']).toContain(edu.schoolType);
    expect(edu.tenthMarks).toContain('/ 500');
    expect(edu.twelfthMarks).toContain('/ 600');

    // 4. Financial details
    const fin = generateDemoFinancialDetails();
    expect(fin.familyAnnualIncome).toBeTruthy();
    expect(fin.incomeSource).toBeTruthy();
    expect(fin.whyMaatram.length).toBeGreaterThanOrEqual(20);

    // 5. Registration helper
    const reg = generateSampleRegistrationDetails();
    expect(reg.name).toBeTruthy();
    expect(reg.email).toContain('@demo.local');
    expect(reg.password).toBe('DemoApplicant@123');

    // 6. Safe demo File generation
    const sampleDocFile = createSafeDemoFile(
      'income_certificate_demo.pdf',
      'application/pdf',
      'DEMO / SAMPLE · Income Certificate'
    );
    expect(sampleDocFile.name).toBe('income_certificate_demo.pdf');
    expect(sampleDocFile.size).toBeGreaterThan(0);
    expect(sampleDocFile.type).toBe('application/pdf');

    // 7. Registered account verification in verifyRoleCredentials
    const mockStorage: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
      clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
    };

    const registeredAccount = {
      fullName: 'Vignesh K',
      phone: '9840112233',
      email: 'vignesh.k@registered.local',
      district: 'Madurai',
      password: 'MyCustomPassword!456',
      registeredAt: new Date().toISOString(),
    };
    (globalThis as any).localStorage.setItem(
      'maatram_registered_accounts',
      JSON.stringify([registeredAccount])
    );

    const verifiedAuth = verifyRoleCredentials(
      'applicant',
      'vignesh.k@registered.local',
      'MyCustomPassword!456'
    );
    expect(verifiedAuth.valid).toBe(true);
    expect(verifiedAuth.user?.name).toBe('Vignesh K');
    expect(verifiedAuth.user?.role).toBe('applicant');

    // Wrong password should fail
    const failedAuth = verifyRoleCredentials(
      'applicant',
      'vignesh.k@registered.local',
      'WrongPassword'
    );
    expect(failedAuth.valid).toBe(false);

    // Verify selectForUser synthesizes a clean new profile for new registered applicant
    const stateForTest = foldEvents(buildSeedEvents());
    const scopedUser = selectForUser(
      stateForTest,
      verifiedAuth.user!
    ) as any;
    expect(scopedUser).not.toBeNull();
    expect(scopedUser.ownProfile).not.toBeNull();
    expect(scopedUser.ownProfile.personId).toBe(verifiedAuth.user!.personId);
    expect(scopedUser.ownProfile.applicationSubmittedAt).toBeUndefined();
    expect(scopedUser.ownProfile.applicationAnswers.fullName).toBe('Vignesh K');
  });

  it('preserves application answers across draft save and document uploads', () => {
    const personId = 'P-REG-TEST-001';
    let state = foldEvents(buildSeedEvents());

    // 1. Save draft answers
    const draftEvent = {
      id: 'EVT-DRAFT-1',
      type: 'APPLICATION_DRAFT_SAVED' as const,
      personId,
      cycleId: '2026',
      occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      actor: 'Test Student',
      seq: state.nextSeq,
      payload: {
        email: 'test@student.demo',
        region: 'Chennai',
        phone: '9840199999',
        answers: {
          fullName: 'Test Student',
          schoolName: 'Govt Model Higher Secondary School',
          tenthMarks: '480 / 500 (96.0%)',
          twelfthMarks: '580 / 600 (96.7%)',
          familyAnnualIncome: 'Rs 85,000',
        },
      },
    };
    state = applyEvent(state, draftEvent);
    expect(state.persons[personId].applicationAnswers.fullName).toBe('Test Student');
    expect(state.persons[personId].applicationAnswers.tenthMarks).toBe('480 / 500 (96.0%)');

    // 2. Upload document
    const uploadEvent = {
      id: 'EVT-UPLOAD-1',
      type: 'DOCUMENT_UPLOADED' as const,
      personId,
      cycleId: '2026',
      occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      actor: 'Test Student',
      seq: state.nextSeq,
      payload: {
        docId: 'DOC-1',
        label: 'Income Certificate',
        fileName: 'income_certificate_demo.pdf',
        fileType: 'application/pdf',
        fileSize: 124000,
        signedUrl: 'https://signed.maatram.local/docs/income_certificate_demo.pdf',
      },
    };
    state = applyEvent(state, uploadEvent);

    // Answers must remain 100% intact after document upload!
    expect(state.persons[personId].applicationAnswers.fullName).toBe('Test Student');
    expect(state.persons[personId].applicationAnswers.tenthMarks).toBe('480 / 500 (96.0%)');
    expect(state.persons[personId].documents).toHaveLength(1);
    expect(state.persons[personId].documents[0].label).toBe('Income Certificate');
  });
});
