import type {
  AddressVerificationMode,
  AppState,
  ApplicationAnswers,
  CycleConfig,
  DifficultyCategory,
  LifecycleEvent,
  LifecycleStage,
  OutboxEmail,
  PersonProfile,
  SampledRequestType,
  WorkerBookmark,
} from './types';

export const DEFAULT_APPLICATION_ANSWERS: ApplicationAnswers = {
  fullName: '',
  schoolName: '',
  schoolType: 'Government',
  tenthMarks: '',
  twelfthMarks: '',
  parentOccupation: '',
  familyAnnualIncome: '',
  housingType: 'Rented',
  whyMaatram: '',
};

export const DEFAULT_CYCLES: Record<string, CycleConfig> = {
  '2024': {
    cycleId: '2024',
    label: 'Cycle 2024–25',
    applicationDeadline: '2024-06-15T23:59:00.000Z',
    isOpen: false,
    baseApplicants: 0,
    baseSelected: 0,
  },
  '2025': {
    cycleId: '2025',
    label: 'Cycle 2025–26',
    applicationDeadline: '2025-06-15T23:59:00.000Z',
    isOpen: false,
    baseApplicants: 0,
    baseSelected: 0,
  },
  '2026': {
    cycleId: '2026',
    label: 'Cycle 2026–27',
    applicationDeadline: '2026-12-30T23:59:00.000Z',
    isOpen: true,
    baseApplicants: 0,
    baseSelected: 0,
  },
};

export const INITIAL_STATE: AppState = {
  events: [],
  seenIds: {},
  nextSeq: 1,
  persons: {},
  volunteeringRequests: {},
  volunteeringWorks: {},
  announcements: {},
  meetings: {},
  resources: {},
  monthlyChecks: [],
  adminFlags: [],
  sampledRequests: {},
  anchorApplications: [],
  cycles: DEFAULT_CYCLES,
  workerBookmark: {
    lastSeq: 0,
    processedEventIds: [],
    outbox: [],
  },
  rosterCap: 15,
  anchorFeeAmount: 1000,
};

function createEmptyPerson(
  personId: string,
  cycleId: string,
  payload?: Record<string, unknown>
): PersonProfile {
  return {
    personId,
    cycleId,
    name: (payload?.fullName as string) || (payload?.name as string) || personId,
    email:
      (payload?.email as string) ||
      `${personId.toLowerCase()}@maatram-synthetic.edu.in`,
    phone: (payload?.phone as string) || '+91 98400 00000',
    region: (payload?.region as string) || 'Chennai',
    status: 'draft',
    roles: [],
    stage: 'application',
    shortlisted: false,
    verifiers: {
      teleStatus: 'Pending',
      physicalStatus: 'Pending',
    },
    applicationAnswers: { ...DEFAULT_APPLICATION_ANSWERS },
    cgpaHistory: [],
    achievements: [],
    documents: [],
    volunteeringCounts: {
      teleVerifications: 0,
      physicalVerifications: 0,
      schoolVisits: 0,
    },
    placementRecord: {
      companiesAttended: [],
      offerStatus: 'Preparing',
    },
    careerHistory: [],
    statusHistory: [],
  };
}

function addRole(
  roles: PersonProfile['roles'],
  role: PersonProfile['roles'][number]
): PersonProfile['roles'] {
  return roles.includes(role) ? roles : [...roles, role];
}

function sortHistoryChronologically<T extends { occurredAt: string; seq: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const timeDiff = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
    if (timeDiff !== 0) return timeDiff;
    return a.seq - b.seq;
  });
}

const STAGE_LABELS: Record<LifecycleStage, string> = {
  application: 'Application',
  tele_verification: 'Tele-verification',
  physical_verification: 'Physical verification',
  panel_interview: 'Offline panel interview',
  selected: 'Selected',
  rejected: 'Rejected',
};

export function applyEvent(state: AppState, event: LifecycleEvent): AppState {
  // Idempotency guard: ignore any event whose id was already folded
  if (state.seenIds[event.id]) {
    return state;
  }

  const nextSeenIds = { ...state.seenIds, [event.id]: true };
  const nextEvents = [...state.events, event];
  const nextSeq = Math.max(state.nextSeq, event.seq + 1);

  const payload = event.payload || {};
  const isSystemEvent = event.personId === 'SYSTEM';

  let persons = state.persons;
  const getOrCreatePerson = (pid: string): PersonProfile =>
    persons[pid] || createEmptyPerson(pid, event.cycleId, payload);

  let volunteeringRequests = state.volunteeringRequests;
  let volunteeringWorks = state.volunteeringWorks;
  let announcements = state.announcements;
  let meetings = state.meetings;
  let resources = state.resources;
  let monthlyChecks = state.monthlyChecks;
  let adminFlags = state.adminFlags;
  let sampledRequests = state.sampledRequests;
  let anchorApplications = state.anchorApplications;
  let cycles = state.cycles;
  let rosterCap = state.rosterCap;
  let anchorFeeAmount = state.anchorFeeAmount;

  if (!isSystemEvent && event.personId) {
    const person = getOrCreatePerson(event.personId);

    switch (event.type) {
      case 'APPLICATION_DRAFT_SAVED': {
        const answers = (payload.answers as Partial<ApplicationAnswers>) || {};
        const mergedAnswers = { ...person.applicationAnswers, ...answers };
        const updated: PersonProfile = {
          ...person,
          name: mergedAnswers.fullName || person.name,
          email: (payload.email as string) || person.email,
          phone: (payload.phone as string) || person.phone,
          region: (payload.region as string) || person.region,
          applicationAnswers: mergedAnswers,
          roles: addRole(person.roles, 'applicant'),
          status: person.status === 'draft' ? 'draft' : person.status,
          statusHistory: sortHistoryChronologically([
            ...person.statusHistory,
            {
              eventId: event.id,
              seq: event.seq,
              stage: person.stage,
              label: 'Application draft saved',
              occurredAt: event.occurredAt,
              actor: event.actor,
            },
          ]),
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'APPLICATION_SUBMITTED': {
        const answers = (payload.answers as Partial<ApplicationAnswers>) || {};
        const mergedAnswers = { ...person.applicationAnswers, ...answers };
        const updated: PersonProfile = {
          ...person,
          name: mergedAnswers.fullName || person.name,
          email: (payload.email as string) || person.email,
          phone: (payload.phone as string) || person.phone,
          region: (payload.region as string) || person.region,
          status: person.status === 'draft' ? 'applicant' : person.status,
          roles: addRole(person.roles, 'applicant'),
          stage: 'application',
          applicationAnswers: mergedAnswers,
          applicationSubmittedAt: event.occurredAt,
          statusHistory: sortHistoryChronologically([
            ...person.statusHistory,
            {
              eventId: event.id,
              seq: event.seq,
              stage: 'application',
              label: 'Application submitted',
              occurredAt: event.occurredAt,
              actor: event.actor,
              note: `Cycle ${event.cycleId}`,
            },
          ]),
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'VERIFIER_ASSIGNED': {
        const updated: PersonProfile = {
          ...person,
          verifiers: {
            teleVerifierName:
              (payload.teleVerifierName as string | undefined) ??
              person.verifiers.teleVerifierName,
            teleStatus:
              (payload.teleStatus as PersonProfile['verifiers']['teleStatus']) ??
              person.verifiers.teleStatus,
            physicalVerifierName:
              (payload.physicalVerifierName as string | undefined) ??
              person.verifiers.physicalVerifierName,
            physicalStatus:
              (payload.physicalStatus as PersonProfile['verifiers']['physicalStatus']) ??
              person.verifiers.physicalStatus,
          },
          statusHistory: sortHistoryChronologically([
            ...person.statusHistory,
            {
              eventId: event.id,
              seq: event.seq,
              stage: person.stage,
              label: 'Alumni anchor verifier updated',
              occurredAt: event.occurredAt,
              actor: event.actor,
              note: (payload.note as string) || undefined,
            },
          ]),
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'ADDRESS_VERIFICATION_MODE_CHOSEN': {
        const mode = payload.mode as AddressVerificationMode;
        const updated: PersonProfile = {
          ...person,
          addressVerificationMode: mode,
          statusHistory: sortHistoryChronologically([
            ...person.statusHistory,
            {
              eventId: event.id,
              seq: event.seq,
              stage: person.stage,
              label: `Address verification mode chosen: ${mode}`,
              occurredAt: event.occurredAt,
              actor: event.actor,
              note: (payload.note as string) || undefined,
            },
          ]),
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'STAGE_ADVANCED': {
        const nextStage = (payload.stage as LifecycleStage) || person.stage;
        const nextHistory = sortHistoryChronologically([
          ...person.statusHistory,
          {
            eventId: event.id,
            seq: event.seq,
            stage: nextStage,
            label: `Stage advanced to ${STAGE_LABELS[nextStage] || nextStage}`,
            occurredAt: event.occurredAt,
            actor: event.actor,
            note: payload.reason as string | undefined,
          },
        ]);
        const latestStageEntry = [...nextHistory]
          .reverse()
          .find((entry) => entry.stage in STAGE_LABELS);
        const effectiveStage =
          (latestStageEntry?.stage as LifecycleStage) || nextStage;
        const nextStatus =
          effectiveStage === 'selected'
            ? person.status === 'applicant' || person.status === 'draft'
              ? 'selected'
              : person.status
            : effectiveStage === 'rejected'
              ? 'rejected'
              : person.status === 'draft'
                ? 'applicant'
                : person.status;
        const nextRoles =
          effectiveStage === 'selected'
            ? addRole(person.roles, 'selected')
            : person.roles;

        // Auto-reflect verifier completion status as stages progress
        const nextVerifiers = { ...person.verifiers };
        if (nextStage === 'tele_verification') {
          nextVerifiers.teleVerifierName =
            nextVerifiers.teleVerifierName || 'Meera';
          nextVerifiers.teleStatus = 'In progress';
        } else if (nextStage === 'physical_verification') {
          nextVerifiers.teleVerifierName =
            nextVerifiers.teleVerifierName || 'Meera';
          nextVerifiers.teleStatus = 'Completed';
          nextVerifiers.physicalVerifierName =
            nextVerifiers.physicalVerifierName || 'Priya';
          nextVerifiers.physicalStatus = 'In progress';
        } else if (
          nextStage === 'panel_interview' ||
          nextStage === 'selected'
        ) {
          nextVerifiers.teleVerifierName =
            nextVerifiers.teleVerifierName || 'Meera';
          nextVerifiers.teleStatus = 'Completed';
          nextVerifiers.physicalVerifierName =
            nextVerifiers.physicalVerifierName || 'Priya';
          nextVerifiers.physicalStatus = 'Completed';
        }

        const updated: PersonProfile = {
          ...person,
          stage: effectiveStage,
          status: nextStatus,
          roles: nextRoles,
          verifiers: nextVerifiers,
          joinCode: (payload.joinCode as string) || person.joinCode,
          joinCodeExpiresAt:
            (payload.joinCodeExpiresAt as string) || person.joinCodeExpiresAt,
          statusHistory: nextHistory,
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'APPLICANT_SHORTLISTED': {
        const updated: PersonProfile = {
          ...person,
          shortlisted: true,
          statusHistory: sortHistoryChronologically([
            ...person.statusHistory,
            {
              eventId: event.id,
              seq: event.seq,
              stage: person.stage,
              label: 'Shortlisted for verification',
              occurredAt: event.occurredAt,
              actor: event.actor,
              note: payload.note as string | undefined,
            },
          ]),
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'APPLICANT_SELECTED': {
        const joinCode = payload.joinCode as string;
        const joinCodeExpiresAt = payload.joinCodeExpiresAt as string;
        const reason = payload.reason as string | undefined;
        let nextRoles = addRole(person.roles, 'selected');
        nextRoles = addRole(nextRoles, 'student');
        const updated: PersonProfile = {
          ...person,
          stage: 'selected',
          status:
            person.status === 'alumni' || person.status === 'anchor'
              ? person.status
              : 'selected',
          roles: nextRoles,
          shortlisted: true,
          verifiers: {
            teleVerifierName: person.verifiers.teleVerifierName || 'Meera',
            teleStatus: 'Completed',
            physicalVerifierName:
              person.verifiers.physicalVerifierName || 'Priya',
            physicalStatus: 'Completed',
          },
          joinCode,
          joinCodeExpiresAt,
          college:
            (payload.college as string) || person.college || 'Pending Enrollment',
          degree:
            (payload.degree as string) ||
            person.degree ||
            'Undergraduate Cohort',
          statusHistory: sortHistoryChronologically([
            ...person.statusHistory,
            {
              eventId: event.id,
              seq: event.seq,
              stage: 'selected',
              label: `Selected — Join code ${joinCode} issued`,
              occurredAt: event.occurredAt,
              actor: event.actor,
              note: reason,
            },
          ]),
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'APPLICANT_REJECTED': {
        const reason =
          (payload.reason as string) || 'Not selected in this cycle';
        const updated: PersonProfile = {
          ...person,
          stage: 'rejected',
          status: 'rejected',
          rejectionReason: reason,
          statusHistory: sortHistoryChronologically([
            ...person.statusHistory,
            {
              eventId: event.id,
              seq: event.seq,
              stage: 'rejected',
              label: 'Application rejected',
              occurredAt: event.occurredAt,
              actor: event.actor,
              note: reason,
            },
          ]),
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'DOCUMENT_UPLOADED': {
        const doc = {
          docId: payload.docId as string,
          label: payload.label as string,
          fileName: payload.fileName as string,
          fileType: payload.fileType as string,
          fileSize: payload.fileSize as number,
          signedUrl: payload.signedUrl as string,
          uploadedAt: event.occurredAt,
        };
        const updated: PersonProfile = {
          ...person,
          documents: [...person.documents, doc],
          statusHistory: sortHistoryChronologically([
            ...person.statusHistory,
            {
              eventId: event.id,
              seq: event.seq,
              stage: person.stage,
              label: `Document uploaded: ${doc.label}`,
              occurredAt: event.occurredAt,
              actor: event.actor,
              note: doc.fileName,
            },
          ]),
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'JOIN_CODE_REDEEMED': {
        const anchorId = payload.anchorId as string;
        const joinCode = payload.joinCode as string;
        const nextRoles = addRole(person.roles, 'student');
        const updated: PersonProfile = {
          ...person,
          status:
            person.status === 'alumni' || person.status === 'anchor'
              ? person.status
              : 'student',
          roles: nextRoles,
          anchorId,
          joinCodeRedeemedByAnchorId: anchorId,
          statusHistory: sortHistoryChronologically([
            ...person.statusHistory,
            {
              eventId: event.id,
              seq: event.seq,
              stage: person.stage,
              label: `Added to Anchor roster (${anchorId})`,
              occurredAt: event.occurredAt,
              actor: event.actor,
              note: `Join code ${joinCode} redeemed`,
            },
          ]),
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'STUDENT_PROFILE_UPDATED': {
        const nextRoles = addRole(person.roles, 'student');
        const nextStatus =
          (payload.status as PersonProfile['status']) ||
          (person.status === 'selected' || person.status === 'applicant'
            ? 'student'
            : person.status);
        const updatedRoles =
          nextStatus === 'alumni'
            ? addRole(addRole(nextRoles, 'selected'), 'alumni')
            : nextStatus === 'anchor'
              ? addRole(
                  addRole(addRole(nextRoles, 'selected'), 'alumni'),
                  'anchor'
                )
              : nextRoles;
        const nextStage =
          (nextStatus === 'alumni' || nextStatus === 'anchor') &&
          !person.applicationSubmittedAt
            ? 'selected'
            : person.stage;
        const updated: PersonProfile = {
          ...person,
          name: (payload.name as string) || person.name,
          region: (payload.region as string) || person.region,
          college: (payload.college as string) || person.college,
          degree: (payload.degree as string) || person.degree,
          semesterLabel:
            (payload.semesterLabel as string) || person.semesterLabel,
          yearCompleted:
            typeof payload.yearCompleted === 'number'
              ? payload.yearCompleted
              : person.yearCompleted,
          anchorId: (payload.anchorId as string) || person.anchorId,
          status: nextStatus,
          stage: nextStage,
          roles: updatedRoles,
        };
        persons = { ...persons, [event.personId]: updated };
        break;
      }

      case 'CGPA_RECORDED': {
        const semester = payload.semester as string;
        const gpa = Number(payload.gpa);
        const existingIdx = person.cgpaHistory.findIndex(
          (item) => item.semester === semester
        );
        const nextCgpa =
          existingIdx >= 0
            ? person.cgpaHistory.map((item, idx) =>
                idx === existingIdx
                  ? { semester, gpa, recordedAt: event.occurredAt }
                  : item
              )
            : [
                ...person.cgpaHistory,
                { semester, gpa, recordedAt: event.occurredAt },
              ];
        persons = {
          ...persons,
          [event.personId]: {
            ...person,
            cgpaHistory: nextCgpa,
          },
        };
        break;
      }

      case 'ACHIEVEMENT_ADDED': {
        const achievement = {
          title: payload.title as string,
          category: (payload.category as string) || 'Academic',
          date: (payload.date as string) || event.occurredAt.slice(0, 10),
        };
        persons = {
          ...persons,
          [event.personId]: {
            ...person,
            achievements: [...person.achievements, achievement],
          },
        };
        break;
      }

      case 'DIFFICULTY_FLAG_UPDATED': {
        persons = {
          ...persons,
          [event.personId]: {
            ...person,
            difficultyFlag: {
              flagged: Boolean(payload.flagged),
              category:
                (payload.category as DifficultyCategory) || 'Academic',
              note: (payload.note as string) || '',
              updatedAt: event.occurredAt,
            },
          },
        };
        break;
      }

      case 'PLACEMENT_RECORD_UPDATED': {
        const nextPlacement = {
          ...person.placementRecord,
          companiesAttended:
            (payload.companiesAttended as string[]) ||
            person.placementRecord.companiesAttended,
          placedCompany:
            (payload.placedCompany as string | undefined) ??
            person.placementRecord.placedCompany,
          offerStatus:
            (payload.offerStatus as PersonProfile['placementRecord']['offerStatus']) ||
            person.placementRecord.offerStatus,
          salaryLpa:
            (payload.salaryLpa as string | undefined) ??
            person.placementRecord.salaryLpa,
          offerDocName:
            (payload.offerDocName as string | undefined) ??
            person.placementRecord.offerDocName,
          salarySlipName:
            (payload.salarySlipName as string | undefined) ??
            person.placementRecord.salarySlipName,
          updatedAt: event.occurredAt,
        };
        const becameAlumni =
          nextPlacement.offerStatus === 'Alumni Employed' ||
          person.status === 'alumni' ||
          person.status === 'anchor';
        const updatedRoles = becameAlumni
          ? addRole(person.roles, 'alumni')
          : person.roles;
        const updatedStatus =
          nextPlacement.offerStatus === 'Alumni Employed' &&
          person.status === 'student'
            ? 'alumni'
            : person.status;
        persons = {
          ...persons,
          [event.personId]: {
            ...person,
            status: updatedStatus,
            roles: updatedRoles,
            placementRecord: nextPlacement,
            currentCompany:
              nextPlacement.offerStatus === 'Alumni Employed' &&
              nextPlacement.placedCompany
                ? nextPlacement.placedCompany
                : person.currentCompany,
          },
        };
        break;
      }

      case 'CAREER_HISTORY_ADDED': {
        const entry = {
          entryId: payload.entryId as string,
          company: payload.company as string,
          roleTitle: payload.roleTitle as string,
          startYear: Number(payload.startYear),
          endYear:
            payload.endYear !== undefined &&
            payload.endYear !== null &&
            payload.endYear !== ''
              ? Number(payload.endYear)
              : undefined,
          source: payload.source as 'self-reported' | 'referral' | 'placement',
          recordedAt: event.occurredAt,
        };
        const nextHistory = [...person.careerHistory, entry].sort(
          (a, b) => a.startYear - b.startYear
        );
        const latest = nextHistory[nextHistory.length - 1];
        const updatedRoles = addRole(person.roles, 'alumni');
        const updatedStatus =
          person.status === 'anchor' ? 'anchor' : 'alumni';
        persons = {
          ...persons,
          [event.personId]: {
            ...person,
            status: updatedStatus,
            roles: updatedRoles,
            careerHistory: nextHistory,
            currentCompany: latest?.company || person.currentCompany,
            currentRoleTitle: latest?.roleTitle || person.currentRoleTitle,
          },
        };
        break;
      }

      case 'VOLUNTEERING_REQUEST_CREATED': {
        const requestId = payload.requestId as string;
        volunteeringRequests = {
          ...volunteeringRequests,
          [requestId]: {
            requestId,
            cycleId: event.cycleId,
            createdByPersonId: event.personId,
            createdByName: person.name,
            title: payload.title as string,
            regions: (payload.regions as string[]) || [],
            dateWindow: (payload.dateWindow as string) || 'This week',
            notes: (payload.notes as string) || '',
            optedInVolunteers: [],
            createdAt: event.occurredAt,
          },
        };
        break;
      }

      case 'VOLUNTEERING_REQUEST_OPTED_IN': {
        const requestId = payload.requestId as string;
        const req = volunteeringRequests[requestId];
        if (req) {
          const already = req.optedInVolunteers.some(
            (v) => v.personId === event.personId
          );
          if (!already) {
            volunteeringRequests = {
              ...volunteeringRequests,
              [requestId]: {
                ...req,
                optedInVolunteers: [
                  ...req.optedInVolunteers,
                  {
                    personId: event.personId,
                    name: (payload.volunteerName as string) || person.name,
                    optedInAt: event.occurredAt,
                  },
                ],
              },
            };
          }
        }
        break;
      }

      case 'VOLUNTEERING_REQUEST_ASSIGNED': {
        const requestId = payload.requestId as string;
        const req = volunteeringRequests[requestId];
        if (req) {
          volunteeringRequests = {
            ...volunteeringRequests,
            [requestId]: {
              ...req,
              assignedToPersonId: payload.assigneeId as string,
              assignedToName: payload.assigneeName as string,
              assignedByActor: event.actor,
            },
          };
        }
        break;
      }

      case 'VOLUNTEERING_WORK_SUBMITTED': {
        const workId = payload.workId as string;
        const submitterRole =
          (payload.submitterRole as 'student' | 'anchor') || 'student';
        volunteeringWorks = {
          ...volunteeringWorks,
          [workId]: {
            workId,
            requestId: payload.requestId as string | undefined,
            cycleId: event.cycleId,
            personId: event.personId,
            personName: person.name,
            submitterRole,
            category: payload.category as
              | 'tele_verification'
              | 'physical_verification'
              | 'school_visit',
            region: payload.region as string,
            location: payload.location as string,
            photoUrl: payload.photoUrl as string,
            notes: (payload.notes as string) || '',
            status: 'Submitted',
            submittedAt: event.occurredAt,
          },
        };
        break;
      }

      case 'VOLUNTEERING_WORK_ANCHOR_APPROVED': {
        const workId = payload.workId as string;
        const work = volunteeringWorks[workId];
        if (work) {
          volunteeringWorks = {
            ...volunteeringWorks,
            [workId]: {
              ...work,
              status: 'Anchor approved',
              anchorApprovedAt: event.occurredAt,
              anchorApprovedBy: event.actor,
            },
          };
        }
        break;
      }

      case 'VOLUNTEERING_WORK_VERIFIED': {
        const workId = payload.workId as string;
        const work = volunteeringWorks[workId];
        if (work) {
          const updatedWork = {
            ...work,
            status: 'Admin verified' as const,
            verifiedAt: event.occurredAt,
            verifiedBy: (payload.verifiedBy as string) || event.actor,
          };
          volunteeringWorks = {
            ...volunteeringWorks,
            [workId]: updatedWork,
          };

          const workerPerson =
            persons[work.personId] ||
            createEmptyPerson(work.personId, event.cycleId);
          const counts = { ...workerPerson.volunteeringCounts };
          if (work.category === 'tele_verification') {
            counts.teleVerifications += 1;
          } else if (work.category === 'physical_verification') {
            counts.physicalVerifications += 1;
          } else if (work.category === 'school_visit') {
            counts.schoolVisits += 1;
          }
          persons = {
            ...persons,
            [work.personId]: {
              ...workerPerson,
              volunteeringCounts: counts,
            },
          };
        }
        break;
      }

      case 'ANNOUNCEMENT_POSTED': {
        const announcementId = payload.announcementId as string;
        announcements = {
          ...announcements,
          [announcementId]: {
            announcementId,
            anchorId: event.personId,
            title: payload.title as string,
            body: payload.body as string,
            category: (payload.category as string) || 'Update',
            postedAt: event.occurredAt,
            pinned: Boolean(payload.pinned),
            seenBy: (payload.initialSeenBy as string[]) || [],
          },
        };
        break;
      }

      case 'ANNOUNCEMENT_PIN_TOGGLED': {
        const announcementId = payload.announcementId as string;
        const ann = announcements[announcementId];
        if (ann) {
          announcements = {
            ...announcements,
            [announcementId]: {
              ...ann,
              pinned:
                typeof payload.pinned === 'boolean'
                  ? payload.pinned
                  : !ann.pinned,
            },
          };
        }
        break;
      }

      case 'ANNOUNCEMENT_SEEN': {
        const announcementId = payload.announcementId as string;
        const studentId = (payload.studentId as string) || event.personId;
        const ann = announcements[announcementId];
        if (ann && !ann.seenBy.includes(studentId)) {
          announcements = {
            ...announcements,
            [announcementId]: {
              ...ann,
              seenBy: [...ann.seenBy, studentId],
            },
          };
        }
        break;
      }

      case 'MEETING_CREATED': {
        const meetingId = payload.meetingId as string;
        meetings = {
          ...meetings,
          [meetingId]: {
            meetingId,
            anchorId: event.personId,
            title: payload.title as string,
            scheduledFor: payload.scheduledFor as string,
            locationOrLink: payload.locationOrLink as string,
            agenda: (payload.agenda as string) || '',
            rsvps: {},
            attendance: {},
            leaveRequests: [],
          },
        };
        break;
      }

      case 'MEETING_RSVP_UPDATED': {
        const meetingId = payload.meetingId as string;
        const studentId = (payload.studentId as string) || event.personId;
        const status = payload.status as 'going' | 'maybe' | 'declined';
        const mtg = meetings[meetingId];
        if (mtg) {
          meetings = {
            ...meetings,
            [meetingId]: {
              ...mtg,
              rsvps: { ...mtg.rsvps, [studentId]: status },
            },
          };
        }
        break;
      }

      case 'MEETING_ATTENDANCE_MARKED': {
        const meetingId = payload.meetingId as string;
        const studentId = (payload.studentId as string) || event.personId;
        const attended = Boolean(payload.attended);
        const mtg = meetings[meetingId];
        if (mtg) {
          meetings = {
            ...meetings,
            [meetingId]: {
              ...mtg,
              attendance: { ...mtg.attendance, [studentId]: attended },
            },
          };
        }
        break;
      }

      case 'MEETING_LEAVE_REQUESTED': {
        const meetingId = payload.meetingId as string;
        const mtg = meetings[meetingId];
        if (mtg) {
          const leaveItem = {
            leaveId: payload.leaveId as string,
            meetingId,
            studentId: event.personId,
            studentName: (payload.studentName as string) || person.name,
            reason: payload.reason as string,
            proofFileName: payload.proofFileName as string,
            proofFileSize: Number(payload.proofFileSize) || 0,
            status: 'Pending' as const,
            submittedAt: event.occurredAt,
          };
          meetings = {
            ...meetings,
            [meetingId]: {
              ...mtg,
              leaveRequests: [...mtg.leaveRequests, leaveItem],
            },
          };
        }
        break;
      }

      case 'MEETING_LEAVE_REVIEWED': {
        const meetingId = payload.meetingId as string;
        const leaveId = payload.leaveId as string;
        const decision = payload.decision as 'Approved' | 'Declined';
        const mtg = meetings[meetingId];
        if (mtg) {
          meetings = {
            ...meetings,
            [meetingId]: {
              ...mtg,
              leaveRequests: mtg.leaveRequests.map((lr) =>
                lr.leaveId === leaveId
                  ? {
                      ...lr,
                      status: decision,
                      reviewedBy: event.actor,
                      reviewedAt: event.occurredAt,
                    }
                  : lr
              ),
            },
          };
        }
        break;
      }

      case 'RESOURCE_ADDED': {
        const resourceId = payload.resourceId as string;
        resources = {
          ...resources,
          [resourceId]: {
            resourceId,
            title: payload.title as string,
            category: payload.category as string,
            urlLabel: payload.urlLabel as string,
            addedBy: event.actor,
            addedAt: event.occurredAt,
          },
        };
        break;
      }

      case 'MONTHLY_CHECK_SUBMITTED': {
        monthlyChecks = [
          ...monthlyChecks,
          {
            checkId: payload.checkId as string,
            personId: event.personId,
            personName: person.name,
            month: payload.month as string,
            blocked: Boolean(payload.blocked),
            response: payload.response as string,
            submittedAt: event.occurredAt,
          },
        ];
        break;
      }

      case 'ADMIN_FLAG_RAISED': {
        adminFlags = [
          ...adminFlags,
          {
            flagId: payload.flagId as string,
            raisedBy: event.actor,
            subjectPersonId: payload.subjectPersonId as string,
            subjectName: payload.subjectName as string,
            flagType: payload.flagType as 'malpractice' | 'achievement',
            details: payload.details as string,
            createdAt: event.occurredAt,
          },
        ];
        break;
      }

      case 'SAMPLED_REQUEST_RESPONDED': {
        const requestId = payload.requestId as string;
        const req = sampledRequests[requestId];
        if (req) {
          sampledRequests = {
            ...sampledRequests,
            [requestId]: {
              ...req,
              responses: {
                ...req.responses,
                [event.personId]: {
                  response: payload.response as string,
                  respondedAt: event.occurredAt,
                },
              },
            },
          };
        }
        break;
      }

      case 'ANCHOR_WILLINGNESS_APPLIED': {
        const nextRoles = addRole(addRole(person.roles, 'alumni'), 'anchor');
        persons = {
          ...persons,
          [event.personId]: {
            ...person,
            status: 'anchor',
            roles: nextRoles,
            statusHistory: sortHistoryChronologically([
              ...person.statusHistory,
              {
                eventId: event.id,
                seq: event.seq,
                stage: person.stage,
                label: 'Anchor yearly renewal submitted & fee receipt issued',
                occurredAt: event.occurredAt,
                actor: event.actor,
                note: `Receipt ${payload.paymentReceiptId as string}`,
              },
            ]),
          },
        };
        anchorApplications = [
          ...anchorApplications,
          {
            applicationId: payload.applicationId as string,
            personId: event.personId,
            personName: person.name,
            motivation: payload.motivation as string,
            preferredRegion: payload.preferredRegion as string,
            feeAmount: Number(payload.feeAmount),
            paymentReceiptId: payload.paymentReceiptId as string,
            paidAt: (payload.paidAt as string) || event.occurredAt,
          },
        ];
        break;
      }

      default:
        break;
    }
  } else {
    // SYSTEM-level events
    if (event.type === 'CYCLE_BASELINE_SEEDED') {
      const cid = event.cycleId;
      const existing = cycles[cid] || {
        cycleId: cid,
        label: `Cycle ${cid}`,
        applicationDeadline: `${cid}-12-30T23:59:00.000Z`,
        isOpen: cid === '2026',
        baseApplicants: 0,
        baseSelected: 0,
      };
      cycles = {
        ...cycles,
        [cid]: {
          ...existing,
          baseApplicants: Number(payload.baseApplicants) || 0,
          baseSelected: Number(payload.baseSelected) || 0,
          applicationDeadline:
            (payload.applicationDeadline as string) ||
            existing.applicationDeadline,
        },
      };
    } else if (event.type === 'ROSTER_CAP_UPDATED') {
      rosterCap = Math.max(1, Number(payload.cap) || 15);
    } else if (event.type === 'ANCHOR_FEE_UPDATED') {
      anchorFeeAmount = Math.max(0, Number(payload.amount) || 1000);
    } else if (event.type === 'SAMPLED_REQUEST_CREATED') {
      const requestId = payload.requestId as string;
      sampledRequests = {
        ...sampledRequests,
        [requestId]: {
          requestId,
          cycleId: event.cycleId,
          requestType:
            (payload.requestType as SampledRequestType) ||
            'Number of verified volunteering entries',
          title: payload.title as string,
          prompt: payload.prompt as string,
          deadline: payload.deadline as string,
          ratioLabel: (payload.ratioLabel as string) || '1 per 25 scholars',
          sampledPersonIds: (payload.sampledPersonIds as string[]) || [],
          responses: {},
          createdAt: event.occurredAt,
          createdBy: event.actor,
        },
      };
    }
  }

  return {
    ...state,
    events: nextEvents,
    seenIds: nextSeenIds,
    nextSeq,
    persons,
    volunteeringRequests,
    volunteeringWorks,
    announcements,
    meetings,
    resources,
    monthlyChecks,
    adminFlags,
    sampledRequests,
    anchorApplications,
    cycles,
    rosterCap,
    anchorFeeAmount,
  };
}

function buildEmailForEvent(
  event: LifecycleEvent,
  persons: Record<string, PersonProfile>
): OutboxEmail | null {
  const person = persons[event.personId];
  const recipient =
    person?.email || `${event.personId.toLowerCase()}@maatram-synthetic.edu.in`;
  const name = person?.name || event.personId;

  switch (event.type) {
    case 'APPLICATION_SUBMITTED':
      return {
        id: `MAIL-${event.id}`,
        eventId: event.id,
        seq: event.seq,
        to: recipient,
        subject: `[Maatram One · ${event.cycleId}] Application received — ${name}`,
        body: `Dear ${name}, your Maatram One scholarship application for cycle ${event.cycleId} has been logged.`,
        sentAt: event.recordedAt,
      };
    case 'ADDRESS_VERIFICATION_MODE_CHOSEN':
      return {
        id: `MAIL-${event.id}`,
        eventId: event.id,
        seq: event.seq,
        to: recipient,
        subject: `[Maatram One · ${event.cycleId}] Verification mode: ${String(
          event.payload.mode || ''
        )}`,
        body: `Dear ${name}, your address proof has been reviewed. Assigned mode: ${String(
          event.payload.mode || ''
        )}.`,
        sentAt: event.recordedAt,
      };
    case 'APPLICANT_SELECTED':
      return {
        id: `MAIL-${event.id}`,
        eventId: event.id,
        seq: event.seq,
        to: recipient,
        subject: `[Maatram One · ${event.cycleId}] Congratulations! Join Code ${String(
          event.payload.joinCode || ''
        )}`,
        body: `Welcome to Maatram One, ${name}. Share join code ${String(
          event.payload.joinCode || ''
        )} with your assigned Anchor within 48 hours.`,
        sentAt: event.recordedAt,
      };
    case 'APPLICANT_REJECTED':
      return {
        id: `MAIL-${event.id}`,
        eventId: event.id,
        seq: event.seq,
        to: recipient,
        subject: `[Maatram One · ${event.cycleId}] Application update`,
        body: `Dear ${name}, thank you for applying. Decision reason: ${String(
          event.payload.reason || ''
        )}`,
        sentAt: event.recordedAt,
      };
    case 'VOLUNTEERING_WORK_VERIFIED':
      return {
        id: `MAIL-${event.id}`,
        eventId: event.id,
        seq: event.seq,
        to: recipient,
        subject: `[Maatram One Volunteer Portal] Volunteering verified`,
        body: `Your volunteering submission (${String(
          event.payload.workId || ''
        )}) has been verified by Admin and synced to your profile.`,
        sentAt: event.recordedAt,
      };
    case 'SAMPLED_REQUEST_CREATED':
      return {
        id: `MAIL-${event.id}`,
        eventId: event.id,
        seq: event.seq,
        to: 'anchors-cohort@maatram-synthetic.edu.in',
        subject: `[Maatram One Audit] Sampled request (${String(
          event.payload.requestType || ''
        )}): ${String(event.payload.title || '')}`,
        body: `Please respond before ${String(
          event.payload.deadline || ''
        )}. Selection rule: ${String(event.payload.ratioLabel || '1 per 25')}.`,
        sentAt: event.recordedAt,
      };
    case 'ANCHOR_WILLINGNESS_APPLIED':
      return {
        id: `MAIL-${event.id}`,
        eventId: event.id,
        seq: event.seq,
        to: recipient,
        subject: `[Maatram One Anchor] Yearly renewal receipt ${String(
          event.payload.paymentReceiptId || ''
        )}`,
        body: `Thank you ${name} for renewing as an Anchor for ${String(
          event.payload.preferredRegion || ''
        )}. Receipt: ${String(event.payload.paymentReceiptId || '')}.`,
        sentAt: event.recordedAt,
      };
    default:
      return null;
  }
}

export function processEmailWorker(
  events: LifecycleEvent[],
  currentBookmark: WorkerBookmark,
  persons: Record<string, PersonProfile>
): WorkerBookmark {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  let lastSeq = currentBookmark.lastSeq;
  const processedSet = new Set(currentBookmark.processedEventIds);
  const existingOutboxEventIds = new Set(
    currentBookmark.outbox.map((item) => item.eventId)
  );
  const nextOutbox = [...currentBookmark.outbox];

  for (const event of ordered) {
    if (event.seq <= currentBookmark.lastSeq) {
      continue;
    }
    if (!processedSet.has(event.id) && !existingOutboxEventIds.has(event.id)) {
      const mail = buildEmailForEvent(event, persons);
      if (mail) {
        nextOutbox.push(mail);
        existingOutboxEventIds.add(event.id);
      }
      processedSet.add(event.id);
    }
    if (event.seq > lastSeq) {
      lastSeq = event.seq;
    }
  }

  return {
    lastSeq,
    processedEventIds: Array.from(processedSet),
    outbox: nextOutbox,
  };
}

export function foldEvents(
  events: LifecycleEvent[],
  existingBookmark?: WorkerBookmark
): AppState {
  const folded = events.reduce(applyEvent, INITIAL_STATE);
  const startBookmark: WorkerBookmark = existingBookmark || {
    lastSeq: 0,
    processedEventIds: [],
    outbox: [],
  };
  const nextBookmark = processEmailWorker(
    folded.events,
    startBookmark,
    folded.persons
  );
  return {
    ...folded,
    workerBookmark: nextBookmark,
  };
}

export function replayFromStart(events: LifecycleEvent[]): AppState {
  return foldEvents(events, {
    lastSeq: 0,
    processedEventIds: [],
    outbox: [],
  });
}

export function replayFromTime(
  events: LifecycleEvent[],
  fromOccurredAtIso: string,
  currentBookmark: WorkerBookmark
): AppState {
  const threshold = Date.parse(fromOccurredAtIso);
  const priorEvents = events.filter(
    (e) => Date.parse(e.occurredAt) < threshold
  );
  const replaySlice = events.filter(
    (e) => Date.parse(e.occurredAt) >= threshold
  );

  const baseState = priorEvents.reduce(applyEvent, INITIAL_STATE);
  const replayedState = replaySlice.reduce(applyEvent, baseState);

  const nextBookmark = processEmailWorker(
    replayedState.events,
    currentBookmark,
    replayedState.persons
  );

  return {
    ...replayedState,
    workerBookmark: nextBookmark,
  };
}
