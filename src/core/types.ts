export type UserRole = 'applicant' | 'student' | 'anchor' | 'admin';

export interface AuthSessionUser {
  id: string;
  personId: string;
  role: UserRole;
  name: string;
  email: string;
  subtitle: string;
}

export interface DemoCredentialAccount {
  role: UserRole;
  personId: string;
  name: string;
  email: string;
  password: string;
  subtitle: string;
  description: string;
}

export type RoleTab =
  | 'applicant'
  | 'student'
  | 'alumni'
  | 'anchor'
  | 'admin'
  | 'events';

export const DISTRICTS_8 = [
  'Chennai',
  'Coimbatore',
  'Madurai',
  'Tiruchirappalli',
  'Salem',
  'Tirunelveli',
  'Vellore',
  'Erode',
] as const;

export type DistrictName = (typeof DISTRICTS_8)[number];

export type DifficultyCategory =
  | 'Academic'
  | 'Financial'
  | 'Personal'
  | 'Domain guidance';

export type AddressVerificationMode =
  | 'Online panel'
  | 'Physical verification';

export type SampledRequestType =
  | 'Number of verified volunteering entries'
  | 'Achievements sheet'
  | 'Event attendance'
  | 'CGPA snapshot';

export type LifecycleStage =
  | 'application'
  | 'tele_verification'
  | 'physical_verification'
  | 'panel_interview'
  | 'selected'
  | 'rejected';

export type PersonStatus =
  | 'draft'
  | 'applicant'
  | 'selected'
  | 'student'
  | 'alumni'
  | 'anchor'
  | 'rejected';

export type EventType =
  | 'CYCLE_BASELINE_SEEDED'
  | 'APPLICATION_DRAFT_SAVED'
  | 'APPLICATION_SUBMITTED'
  | 'STAGE_ADVANCED'
  | 'VERIFIER_ASSIGNED'
  | 'ADDRESS_VERIFICATION_MODE_CHOSEN'
  | 'APPLICANT_SHORTLISTED'
  | 'APPLICANT_SELECTED'
  | 'APPLICANT_REJECTED'
  | 'DOCUMENT_UPLOADED'
  | 'JOIN_CODE_REDEEMED'
  | 'STUDENT_PROFILE_UPDATED'
  | 'PROFILE_UPDATED'
  | 'profile.updated'
  | 'CGPA_RECORDED'
  | 'ACHIEVEMENT_ADDED'
  | 'DIFFICULTY_FLAG_UPDATED'
  | 'VOLUNTEERING_REQUEST_CREATED'
  | 'VOLUNTEERING_REQUEST_OPTED_IN'
  | 'VOLUNTEERING_REQUEST_ASSIGNED'
  | 'VOLUNTEERING_WORK_SUBMITTED'
  | 'VOLUNTEERING_WORK_ANCHOR_APPROVED'
  | 'VOLUNTEERING_WORK_VERIFIED'
  | 'PLACEMENT_RECORD_UPDATED'
  | 'CAREER_HISTORY_ADDED'
  | 'ANNOUNCEMENT_POSTED'
  | 'ANNOUNCEMENT_PIN_TOGGLED'
  | 'ANNOUNCEMENT_SEEN'
  | 'MEETING_CREATED'
  | 'MEETING_RSVP_UPDATED'
  | 'MEETING_ATTENDANCE_MARKED'
  | 'MEETING_LEAVE_REQUESTED'
  | 'MEETING_LEAVE_REVIEWED'
  | 'RESOURCE_ADDED'
  | 'MONTHLY_CHECK_SUBMITTED'
  | 'ADMIN_FLAG_RAISED'
  | 'SAMPLED_REQUEST_CREATED'
  | 'SAMPLED_REQUEST_RESPONDED'
  | 'ANCHOR_WILLINGNESS_APPLIED'
  | 'ROSTER_CAP_UPDATED'
  | 'ANCHOR_FEE_UPDATED';

export interface LifecycleEvent {
  id: string;
  seq: number;
  type: EventType;
  personId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  recordedAt: string;
  actor: string;
  cycleId: string;
}

export interface ApplicationAnswers {
  fullName: string;
  schoolName: string;
  schoolType: 'Government' | 'Private';
  tenthMarks: string;
  twelfthMarks: string;
  parentOccupation: string;
  familyAnnualIncome: string;
  housingType: 'Rented' | 'Own';
  whyMaatram: string;
}

export interface StatusHistoryEntry {
  eventId: string;
  seq: number;
  stage: LifecycleStage | string;
  label: string;
  occurredAt: string;
  actor: string;
  note?: string;
}

export interface UploadedDocument {
  docId: string;
  label: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  signedUrl: string;
  uploadedAt: string;
}

export interface CgpaEntry {
  semester: string;
  gpa: number;
  recordedAt: string;
}

export interface AchievementEntry {
  title: string;
  category: string;
  date: string;
}

export interface VolunteeringCounts {
  teleVerifications: number;
  physicalVerifications: number;
  schoolVisits: number;
}

export interface PlacementRecord {
  companiesAttended: string[];
  placedCompany?: string;
  offerStatus: 'Preparing' | 'Interviewing' | 'Offer Received' | 'Alumni Employed';
  salaryLpa?: string;
  offerDocName?: string;
  salarySlipName?: string;
  updatedAt?: string;
}

export type CareerSource = 'self-reported' | 'referral' | 'placement';

export interface CareerHistoryEntry {
  entryId: string;
  company: string;
  roleTitle: string;
  startYear: number;
  endYear?: number;
  source: CareerSource;
  recordedAt: string;
}

export interface VerifierProgress {
  teleVerifierName?: string;
  teleStatus: 'Pending' | 'In progress' | 'Completed';
  physicalVerifierName?: string;
  physicalStatus: 'Pending' | 'In progress' | 'Completed';
}

export interface PersonProfile {
  personId: string;
  cycleId: string;
  name: string;
  email: string;
  phone: string;
  region: string;
  status: PersonStatus;
  roles: Array<'applicant' | 'selected' | 'student' | 'alumni' | 'anchor'>;
  stage: LifecycleStage;
  shortlisted: boolean;
  rejectionReason?: string;
  addressVerificationMode?: AddressVerificationMode;
  verifiers: VerifierProgress;
  applicationAnswers: ApplicationAnswers;
  applicationSubmittedAt?: string;
  joinCode?: string;
  joinCodeExpiresAt?: string;
  joinCodeRedeemedByAnchorId?: string;
  anchorId?: string;
  college?: string;
  degree?: string;
  semesterLabel?: string;
  yearCompleted?: number;
  cgpaHistory: CgpaEntry[];
  achievements: AchievementEntry[];
  difficultyFlag?: {
    flagged: boolean;
    category: DifficultyCategory;
    note: string;
    updatedAt: string;
  };
  documents: UploadedDocument[];
  volunteeringCounts: VolunteeringCounts;
  placementRecord: PlacementRecord;
  careerHistory: CareerHistoryEntry[];
  currentCompany?: string;
  currentRoleTitle?: string;
  photoUrl?: string;
  statusHistory: StatusHistoryEntry[];
}

export type VolunteeringCategory =
  | 'tele_verification'
  | 'physical_verification'
  | 'school_visit';

export type VolunteeringWorkStatus =
  | 'Submitted'
  | 'Anchor approved'
  | 'Admin verified';

export interface VolunteeringRequest {
  requestId: string;
  cycleId: string;
  createdByPersonId: string;
  createdByName: string;
  title: string;
  regions: string[];
  dateWindow: string;
  notes: string;
  optedInVolunteers: Array<{ personId: string; name: string; optedInAt: string }>;
  assignedToPersonId?: string;
  assignedToName?: string;
  assignedByActor?: string;
  createdAt: string;
}

export interface VolunteeringWork {
  workId: string;
  requestId?: string;
  cycleId: string;
  personId: string;
  personName: string;
  submitterRole: 'student' | 'anchor';
  category: VolunteeringCategory;
  region: string;
  location: string;
  photoUrl: string;
  notes: string;
  status: VolunteeringWorkStatus;
  submittedAt: string;
  anchorApprovedAt?: string;
  anchorApprovedBy?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface AnnouncementItem {
  announcementId: string;
  anchorId: string;
  title: string;
  body: string;
  category: string;
  postedAt: string;
  pinned: boolean;
  seenBy: string[];
}

export interface LeaveRequestItem {
  leaveId: string;
  meetingId: string;
  studentId: string;
  studentName: string;
  reason: string;
  proofFileName: string;
  proofFileSize: number;
  status: 'Pending' | 'Approved' | 'Declined';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface MeetingItem {
  meetingId: string;
  anchorId: string;
  title: string;
  scheduledFor: string;
  locationOrLink: string;
  agenda: string;
  rsvps: Record<string, 'going' | 'maybe' | 'declined'>;
  attendance: Record<string, boolean>;
  leaveRequests: LeaveRequestItem[];
}

export interface ResourceItem {
  resourceId: string;
  title: string;
  category: string;
  urlLabel: string;
  addedBy: string;
  addedAt: string;
}

export interface MonthlyCheckIn {
  checkId: string;
  personId: string;
  personName: string;
  month: string;
  blocked: boolean;
  response: string;
  submittedAt: string;
}

export interface AdminFlag {
  flagId: string;
  raisedBy: string;
  subjectPersonId: string;
  subjectName: string;
  flagType: 'malpractice' | 'achievement';
  details: string;
  createdAt: string;
}

export interface SampledDataRequest {
  requestId: string;
  cycleId: string;
  requestType: SampledRequestType;
  title: string;
  prompt: string;
  deadline: string;
  ratioLabel: string;
  sampledPersonIds: string[];
  responses: Record<string, { response: string; respondedAt: string }>;
  createdAt: string;
  createdBy: string;
}

export interface AnchorWillingnessApplication {
  applicationId: string;
  personId: string;
  personName: string;
  motivation: string;
  preferredRegion: string;
  feeAmount: number;
  paymentReceiptId: string;
  paidAt: string;
}

export interface OutboxEmail {
  id: string;
  eventId: string;
  seq: number;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

export interface WorkerBookmark {
  lastSeq: number;
  processedEventIds: string[];
  outbox: OutboxEmail[];
}

export interface CycleConfig {
  cycleId: string;
  label: string;
  applicationDeadline: string;
  isOpen: boolean;
  baseApplicants: number;
  baseSelected: number;
}

export interface AppState {
  events: LifecycleEvent[];
  seenIds: Record<string, boolean>;
  nextSeq: number;
  persons: Record<string, PersonProfile>;
  volunteeringRequests: Record<string, VolunteeringRequest>;
  volunteeringWorks: Record<string, VolunteeringWork>;
  announcements: Record<string, AnnouncementItem>;
  meetings: Record<string, MeetingItem>;
  resources: Record<string, ResourceItem>;
  monthlyChecks: MonthlyCheckIn[];
  adminFlags: AdminFlag[];
  sampledRequests: Record<string, SampledDataRequest>;
  anchorApplications: AnchorWillingnessApplication[];
  cycles: Record<string, CycleConfig>;
  workerBookmark: WorkerBookmark;
  rosterCap: number;
  anchorFeeAmount: number;
}
