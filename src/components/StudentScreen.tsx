import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Award,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Flag,
  GraduationCap,
  Inbox,
  Lock,
  MapPin,
  Upload,
} from 'lucide-react';
import { normalizeCompanyName } from '../core/normalization';
import type { StudentScopedView } from '../core/scoping';
import { PROOF_HOME_VISIT_URL, PROOF_SCHOOL_OUTREACH_URL } from '../core/seed';
import {
  nextDeterministicTimestamp,
  type AppendEventInput,
} from '../core/store';
import {
  DISTRICTS_8,
  type DifficultyCategory,
  type VolunteeringCategory,
} from '../core/types';
import {
  formatBytes,
  validateLeaveRequest,
  validateUploadFile,
} from '../core/validation';

interface StudentScreenProps {
  scoped: StudentScopedView;
  actorName: string;
  onAppend: (input: AppendEventInput) => void;
}

const DISTRICT_COORDS: Record<string, string> = {
  Chennai: '12.9784° N, 80.2209° E · Chennai Field Geo-Tag',
  Coimbatore: '11.0168° N, 76.9558° E · Coimbatore Field Geo-Tag',
  Madurai: '9.9252° N, 78.1198° E · Madurai Field Geo-Tag',
  Tiruchirappalli: '10.7905° N, 78.7047° E · Tiruchirappalli Field Geo-Tag',
  Salem: '11.6643° N, 78.1460° E · Salem Field Geo-Tag',
  Tirunelveli: '8.7139° N, 77.7567° E · Tirunelveli Field Geo-Tag',
  Vellore: '12.9165° N, 79.1325° E · Vellore Field Geo-Tag',
  Erode: '11.3410° N, 77.7172° E · Erode Field Geo-Tag',
};

const DIFFICULTY_CATEGORIES: DifficultyCategory[] = [
  'Academic',
  'Financial',
  'Personal',
  'Domain guidance',
];

export const StudentScreen: React.FC<StudentScreenProps> = ({
  scoped,
  actorName,
  onAppend,
}) => {
  const activeStudent = scoped.ownProfile;

  // CGPA form
  const [semesterLabel, setSemesterLabel] = useState('Sem 5');
  const [gpaInput, setGpaInput] = useState('9.08');

  // Achievement form
  const [achTitle, setAchTitle] = useState('');
  const [achCategory, setAchCategory] = useState('Technical');

  // Difficulty flag form (4 categories)
  const [diffCategory, setDiffCategory] =
    useState<DifficultyCategory>('Academic');
  const [diffNote, setDiffNote] = useState('');

  // Meeting leave request inline state
  const [leaveMeetingId, setLeaveMeetingId] = useState<string | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveProofFile, setLeaveProofFile] = useState<{
    name: string;
    type: string;
    size: number;
  } | null>(null);
  const [leaveError, setLeaveError] = useState('');

  // Volunteering Request Board form (8 districts)
  const [reqTitle, setReqTitle] = useState(
    'Ready for physical verification — weekend drive'
  );
  const [selectedRegions, setSelectedRegions] = useState<string[]>([
    'Chennai',
    'Vellore',
  ]);
  const [reqWindow, setReqWindow] = useState('Nov 22 – Nov 24, 2026');

  // Volunteering Work Submission form
  const [workCategory, setWorkCategory] =
    useState<VolunteeringCategory>('physical_verification');
  const [workRegion, setWorkRegion] = useState<string>(DISTRICTS_8[0]);
  const [workLocation, setWorkLocation] = useState(
    'Govt HSS, Chromepet · Chennai'
  );
  const [workNotes, setWorkNotes] = useState('');
  const [workPhotoPreset, setWorkPhotoPreset] = useState<'home' | 'school'>(
    'home'
  );
  const [workPhotoName, setWorkPhotoName] = useState('field_visit_photo.jpg');
  const [workPhotoError, setWorkPhotoError] = useState('');

  // Placement record form
  const [companyAttendedInput, setCompanyAttendedInput] = useState('');
  const [placedCompanyInput, setPlacedCompanyInput] = useState('');
  const [offerStatusInput, setOfferStatusInput] = useState<
    'Preparing' | 'Interviewing' | 'Offer Received' | 'Alumni Employed'
  >('Offer Received');
  const [salaryInput, setSalaryInput] = useState('');
  const [placementUploadMsg, setPlacementUploadMsg] = useState('');
  const [placementUploadErr, setPlacementUploadErr] = useState('');

  // Sampled response draft
  const [sampledDrafts, setSampledDrafts] = useState<Record<string, string>>(
    {}
  );

  const [statusMessage, setStatusMessage] = useState('');

  if (!activeStudent) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-neutral-600">
          Student profile unavailable in current scope.
        </p>
      </div>
    );
  }

  const autoCapturedLocation =
    DISTRICT_COORDS[workRegion] || DISTRICT_COORDS.Chennai;
  const autoCapturedTimestamp = nextDeterministicTimestamp(scoped.nextSeq);
  const autoCapturedTimeDisplay = format(
    new Date(autoCapturedTimestamp),
    'dd MMM yyyy, HH:mm:ss'
  );

  const latestCgpa =
    activeStudent.cgpaHistory.length > 0
      ? activeStudent.cgpaHistory[activeStudent.cgpaHistory.length - 1].gpa
      : null;

  const anchorAnnouncements = scoped.groupAnnouncements;
  const anchorMeetings = scoped.groupMeetings;
  const volunteeringRequests = scoped.volunteeringRequests;
  const myWorks = scoped.ownVolunteeringWorks;

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region]
    );
  };

  const handleAddCgpa = (e: React.FormEvent) => {
    e.preventDefault();
    const gpa = Number(gpaInput);
    if (!semesterLabel.trim() || Number.isNaN(gpa) || gpa < 0 || gpa > 10) {
      return;
    }
    onAppend({
      type: 'CGPA_RECORDED',
      personId: activeStudent.personId,
      cycleId: activeStudent.cycleId,
      actor: actorName,
      payload: { semester: semesterLabel.trim(), gpa },
    });
    setStatusMessage(`Recorded ${semesterLabel.trim()} GPA (${gpa.toFixed(2)}).`);
  };

  const handleAddAchievement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!achTitle.trim()) return;
    onAppend({
      type: 'ACHIEVEMENT_ADDED',
      personId: activeStudent.personId,
      cycleId: activeStudent.cycleId,
      actor: actorName,
      payload: {
        title: achTitle.trim(),
        category: achCategory,
        date: nextDeterministicTimestamp(scoped.nextSeq).slice(0, 10),
      },
    });
    setAchTitle('');
    setStatusMessage('Achievement logged.');
  };

  const handleToggleDifficulty = (flagged: boolean) => {
    const note =
      diffNote.trim() ||
      activeStudent.difficultyFlag?.note ||
      `Requested ${diffCategory.toLowerCase()} mentoring support.`;
    onAppend({
      type: 'DIFFICULTY_FLAG_UPDATED',
      personId: activeStudent.personId,
      cycleId: activeStudent.cycleId,
      actor: actorName,
      payload: { flagged, category: diffCategory, note },
    });
    setStatusMessage(
      flagged
        ? `Difficulty flag (${diffCategory}) raised to Anchor & Admin.`
        : 'Difficulty flag cleared.'
    );
  };

  const handleLeaveSubmit = (e: React.FormEvent, meetingId: string) => {
    e.preventDefault();
    setLeaveError('');
    const check = validateLeaveRequest({
      reason: leaveReason,
      proofFile: leaveProofFile,
    });
    if (!check.valid) {
      setLeaveError(check.error || 'Leave request invalid.');
      return;
    }
    onAppend({
      type: 'MEETING_LEAVE_REQUESTED',
      personId: activeStudent.personId,
      cycleId: activeStudent.cycleId,
      actor: actorName,
      payload: {
        leaveId: `LR-${Date.now().toString(36).toUpperCase()}`,
        meetingId,
        studentName: activeStudent.name,
        reason: leaveReason.trim(),
        proofFileName: leaveProofFile!.name,
        proofFileSize: leaveProofFile!.size,
      },
    });
    setLeaveMeetingId(null);
    setLeaveReason('');
    setLeaveProofFile(null);
    setStatusMessage('Leave request with supporting proof sent to Anchor.');
  };

  const handleRaiseVolunteeringRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim() || selectedRegions.length === 0) return;
    onAppend({
      type: 'VOLUNTEERING_REQUEST_CREATED',
      personId: activeStudent.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        requestId: `VR-${Date.now().toString(36).toUpperCase()}`,
        title: reqTitle.trim(),
        regions: selectedRegions,
        dateWindow: reqWindow,
        notes: 'Raised from Student Volunteering Request Board.',
      },
    });
    setStatusMessage(
      'Volunteering availability posted to Request Board for peer opt-in and Anchor assignment.'
    );
  };

  const handleWorkPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorkPhotoError('');
    const check = validateUploadFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!check.valid) {
      setWorkPhotoError(check.error || 'Invalid proof file.');
      return;
    }
    setWorkPhotoName(file.name);
    e.target.value = '';
  };

  const handleSubmitVolunteeringWork = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedLocation =
      workCategory === 'physical_verification'
        ? autoCapturedLocation
        : workLocation.trim();
    if (!resolvedLocation) return;

    const photoUrl =
      workPhotoPreset === 'school'
        ? PROOF_SCHOOL_OUTREACH_URL
        : PROOF_HOME_VISIT_URL;

    onAppend({
      type: 'VOLUNTEERING_WORK_SUBMITTED',
      personId: activeStudent.personId,
      cycleId: '2026',
      occurredAt:
        workCategory === 'physical_verification'
          ? autoCapturedTimestamp
          : undefined,
      actor: actorName,
      payload: {
        workId: `VW-${Date.now().toString(36).toUpperCase()}`,
        category: workCategory,
        region: workRegion,
        location: resolvedLocation,
        photoUrl,
        notes:
          workNotes.trim() ||
          `Proof: ${workPhotoName}. Field verification completed with original documents checked.`,
        submitterRole: 'student',
      },
    });
    setWorkNotes('');
    setStatusMessage(
      'Volunteering work submitted (Status: Submitted → awaiting Anchor approval, then Admin verification).'
    );
  };

  const handlePlacementUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const attended = companyAttendedInput.trim()
      ? Array.from(
          new Set([
            ...activeStudent.placementRecord.companiesAttended,
            companyAttendedInput.trim(),
          ])
        )
      : activeStudent.placementRecord.companiesAttended;

    const placed =
      placedCompanyInput.trim() ||
      activeStudent.placementRecord.placedCompany;

    onAppend({
      type: 'PLACEMENT_RECORD_UPDATED',
      personId: activeStudent.personId,
      cycleId: activeStudent.cycleId,
      actor: actorName,
      payload: {
        companiesAttended: attended,
        placedCompany: placed,
        offerStatus: offerStatusInput,
        salaryLpa:
          salaryInput.trim() || activeStudent.placementRecord.salaryLpa,
      },
    });

    if (offerStatusInput === 'Alumni Employed' && placed) {
      onAppend({
        type: 'CAREER_HISTORY_ADDED',
        personId: activeStudent.personId,
        cycleId: activeStudent.cycleId,
        actor: actorName,
        payload: {
          entryId: `CH-${Date.now().toString(36).toUpperCase()}`,
          company: placed,
          roleTitle: 'Graduate Engineer',
          startYear: 2026,
          source: 'placement',
        },
      });
    }

    setCompanyAttendedInput('');
    setStatusMessage('Placement record updated in event log.');
  };

  const handlePlacementDocUpload = (
    kind: 'offer' | 'salary',
    file?: File | null
  ) => {
    setPlacementUploadErr('');
    setPlacementUploadMsg('');
    const targetFile = file || {
      name:
        kind === 'offer'
          ? `${activeStudent.personId.toLowerCase()}_offer_letter.pdf`
          : `${activeStudent.personId.toLowerCase()}_salary_slip.pdf`,
      type: 'application/pdf',
      size: 620000,
    };
    const check = validateUploadFile({
      name: targetFile.name,
      type: targetFile.type,
      size: targetFile.size,
    });
    if (!check.valid) {
      setPlacementUploadErr(check.error || 'Invalid upload');
      return;
    }
    onAppend({
      type: 'PLACEMENT_RECORD_UPDATED',
      personId: activeStudent.personId,
      cycleId: activeStudent.cycleId,
      actor: actorName,
      payload:
        kind === 'offer'
          ? { offerDocName: targetFile.name }
          : { salarySlipName: targetFile.name },
    });
    setPlacementUploadMsg(
      `Uploaded ${targetFile.name} (${kind === 'offer' ? 'Offer Letter' : 'Salary Slip'}).`
    );
  };

  const rosterDenominator = Math.max(scoped.groupRosterCount, 15);

  return (
    <div className="space-y-8">
      {/* Header with ONE offset #FFC20E block */}
      <div className="relative pr-2 pb-2">
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-2 translate-y-2 bg-[#FFC20E] rounded-2xl"
        />
        <section className="relative bg-white border border-neutral-950 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-neutral-950 text-white rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em]">
                {activeStudent.yearCompleted
                  ? `${activeStudent.yearCompleted} Years Completed`
                  : `Cycle ${activeStudent.cycleId} Scholar`}
              </span>
              {activeStudent.semesterLabel && (
                <span className="border border-neutral-300 bg-neutral-50 text-neutral-800 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {activeStudent.semesterLabel}
                </span>
              )}
              <span className="text-xs text-neutral-600 font-semibold tabular-nums">
                {activeStudent.personId} · Anchor:{' '}
                {scoped.anchorName || activeStudent.anchorId || 'Unassigned'}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
              <span className="heading-highlight">{activeStudent.name}</span> — Scholar Workspace
            </h1>
            <p className="text-sm text-neutral-600">
              {activeStudent.degree || 'Undergraduate Cohort'}
              {activeStudent.semesterLabel
                ? `, ${activeStudent.semesterLabel}`
                : ''}{' '}
              · {activeStudent.college || 'Pending College Mapping'} ·{' '}
              {activeStudent.region}
            </p>
          </div>

          <div className="bg-neutral-950 text-white rounded-xl px-4 py-3 shrink-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Latest GPA
            </p>
            <p className="text-xl font-mono font-bold tabular-nums stat-underline">
              {latestCgpa !== null ? latestCgpa.toFixed(2) : '—'}
            </p>
          </div>
        </section>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="bg-neutral-950 text-white rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4"
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage('')}
            className="text-xs font-semibold text-white underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Synced Volunteering Counts + Locked NGO Teaching Card */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-neutral-200 pb-3">
          <div>
            <p className="section-kicker">VERIFIED IMPACT</p>
            <h2 className="font-display text-lg font-bold text-neutral-950 mt-0.5">
              Verified Volunteering Impact
            </h2>
            <p className="text-xs text-neutral-600">
              Counts increment strictly when Admin verifies submitted volunteering events.
            </p>
          </div>
          <span className="bg-neutral-950 text-white rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap self-start sm:self-center">
            Synced from Volunteer Portal
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-950 text-white rounded-xl p-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Tele-verifications
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums mt-1.5 stat-underline">
              {activeStudent.volunteeringCounts.teleVerifications}
            </p>
          </div>
          <div className="bg-neutral-950 text-white rounded-xl p-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Physical verifications
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums mt-1.5 stat-underline">
              {activeStudent.volunteeringCounts.physicalVerifications}
            </p>
          </div>
          <div className="bg-neutral-950 text-white rounded-xl p-4">
            <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              School visits
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums mt-1.5 stat-underline">
              {activeStudent.volunteeringCounts.schoolVisits}
            </p>
          </div>
          <div
            aria-disabled="true"
            className="border border-dashed border-neutral-300 rounded-xl p-4 bg-neutral-50 text-neutral-500 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-neutral-700">
                NGO teaching
              </p>
              <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold text-neutral-600 mt-2">
              NGO teaching, coming soon
            </p>
          </div>
        </div>
      </section>

      {/* Grid: Academic + Difficulty Flag + Meetings/Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-6">
          {/* CGPA Tracker */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-neutral-950" aria-hidden="true" />
                <div>
                  <p className="section-kicker">ACADEMICS</p>
                  <h2 className="font-display text-lg font-bold text-neutral-950">
                    CGPA Tracker
                  </h2>
                </div>
              </div>
              <span className="font-mono text-sm font-bold tabular-nums text-neutral-950 stat-underline">
                Latest: {latestCgpa !== null ? latestCgpa.toFixed(2) : '—'}
              </span>
            </div>

            {activeStudent.cgpaHistory.length === 0 ? (
              <p className="text-xs text-neutral-500">
                No semester CGPA entries recorded yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {activeStudent.cgpaHistory.map((item) => (
                  <div
                    key={item.semester}
                    className="border border-neutral-200 rounded-xl p-3 text-center"
                  >
                    <p className="text-xs text-neutral-500">{item.semester}</p>
                    <p className="font-mono text-lg font-bold tabular-nums text-neutral-950 mt-0.5">
                      {item.gpa.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddCgpa} className="flex flex-wrap gap-2 pt-2">
              <input
                type="text"
                aria-label="Semester"
                value={semesterLabel}
                onChange={(e) => setSemesterLabel(e.target.value)}
                placeholder="Sem 5"
                className="w-28 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                aria-label="GPA"
                value={gpaInput}
                onChange={(e) => setGpaInput(e.target.value)}
                className="w-24 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm font-mono tabular-nums"
              />
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
              >
                Record GPA
              </button>
            </form>
          </section>

          {/* Achievements */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
              <Award className="w-5 h-5 text-neutral-950" aria-hidden="true" />
              <div>
                <p className="section-kicker">RECOGNITION</p>
                <h2 className="font-display text-lg font-bold text-neutral-950">
                  My Achievements
                </h2>
              </div>
            </div>

            <ul className="divide-y divide-neutral-200">
              {activeStudent.achievements.length === 0 ? (
                <li className="py-2 text-xs text-neutral-500">
                  No achievements logged yet.
                </li>
              ) : (
                activeStudent.achievements.map((ach, idx) => (
                  <li
                    key={`${ach.title}-${idx}`}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">
                        {ach.title}
                      </p>
                      <p className="text-xs text-neutral-500 font-mono tabular-nums">
                        {ach.date}
                      </p>
                    </div>
                    <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0">
                      {ach.category}
                    </span>
                  </li>
                ))
              )}
            </ul>

            <form
              onSubmit={handleAddAchievement}
              className="flex flex-wrap gap-2 pt-1"
            >
              <input
                type="text"
                aria-label="Achievement title"
                value={achTitle}
                onChange={(e) => setAchTitle(e.target.value)}
                placeholder="e.g. Regional Hackathon Finalist"
                className="flex-1 min-w-[180px] border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <select
                aria-label="Achievement category"
                value={achCategory}
                onChange={(e) => setAchCategory(e.target.value)}
                className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white"
              >
                <option value="Technical">Technical</option>
                <option value="Academic">Academic</option>
                <option value="Leadership">Leadership</option>
              </select>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-sm font-medium bg-neutral-950 text-white hover:bg-neutral-800"
              >
                Add
              </button>
            </form>
          </section>

          {/* Difficulty Flag */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-neutral-950" aria-hidden="true" />
                <div>
                  <p className="section-kicker">SUPPORT REQUEST</p>
                  <h2 className="font-display text-lg font-bold text-neutral-950">
                    Difficulty Flag
                  </h2>
                </div>
              </div>
              {activeStudent.difficultyFlag?.flagged ? (
                <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {activeStudent.difficultyFlag.category} · Active
                </span>
              ) : (
                <span className="text-xs text-neutral-500">All clear</span>
              )}
            </div>

            {activeStudent.difficultyFlag?.flagged && (
              <div className="p-3 rounded-xl border border-neutral-950 bg-neutral-50 text-neutral-950 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">
                    Support Requested ({activeStudent.difficultyFlag.category})
                  </p>
                  <p>{activeStudent.difficultyFlag.note}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="difficulty-category"
                  className="block text-xs font-medium text-neutral-600 mb-1"
                >
                  Category
                </label>
                <select
                  id="difficulty-category"
                  value={diffCategory}
                  onChange={(e) =>
                    setDiffCategory(e.target.value as DifficultyCategory)
                  }
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {DIFFICULTY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              rows={2}
              aria-label="Difficulty note"
              value={diffNote}
              onChange={(e) => setDiffNote(e.target.value)}
              placeholder="Describe any Academic, Financial, Personal, or Domain guidance blocker..."
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleToggleDifficulty(true)}
                className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
              >
                Raise Difficulty Flag
              </button>
              {activeStudent.difficultyFlag?.flagged && (
                <button
                  type="button"
                  onClick={() => handleToggleDifficulty(false)}
                  className="px-4 py-1.5 rounded-xl text-sm font-medium border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50"
                >
                  Mark Resolved
                </button>
              )}
            </div>
          </section>

          {/* Own Sampled Data Requests (if sampled) */}
          {scoped.ownSampledRequests.length > 0 && (
            <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
                <Inbox className="w-5 h-5 text-neutral-950" aria-hidden="true" />
                <div>
                  <p className="section-kicker">AUDIT CHECK</p>
                  <h2 className="font-display text-lg font-bold text-neutral-950">
                    My Sampled Data Requests
                  </h2>
                </div>
              </div>
              {scoped.ownSampledRequests.map((sr) => {
                const resp = sr.responses[activeStudent.personId];
                return (
                  <div
                    key={sr.requestId}
                    className="border border-neutral-200 rounded-xl p-3.5 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-950">{sr.title}</span>
                      <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-mono">
                        Due {sr.deadline}
                      </span>
                    </div>
                    <p className="text-neutral-600">{sr.prompt}</p>
                    {resp ? (
                      <p className="p-2 rounded-lg bg-neutral-50 border border-neutral-200 font-medium text-neutral-900">
                        Submitted: {resp.response}
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          aria-label={`Sampled response for ${sr.title}`}
                          value={sampledDrafts[sr.requestId] || ''}
                          onChange={(e) =>
                            setSampledDrafts({
                              ...sampledDrafts,
                              [sr.requestId]: e.target.value,
                            })
                          }
                          placeholder="Enter response..."
                          className="flex-1 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const txt = sampledDrafts[sr.requestId]?.trim();
                            if (!txt) return;
                            onAppend({
                              type: 'SAMPLED_REQUEST_RESPONDED',
                              personId: activeStudent.personId,
                              cycleId: '2026',
                              actor: actorName,
                              payload: { requestId: sr.requestId, response: txt },
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white"
                        >
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>

        {/* Right 6 cols: Anchor Group Announcements, Meetings (+ Leave Request), Placement + Career History */}
        <div className="lg:col-span-6 space-y-6">
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="border-b border-neutral-200 pb-3">
              <p className="section-kicker">ANCHOR GROUP FEED</p>
              <h2 className="font-display text-lg font-bold text-neutral-950 mt-0.5">
                Anchor Announcements & Meetings
              </h2>
              <p className="text-xs text-neutral-600">
                Scoped to your assigned Anchor group ({scoped.anchorName || 'Unassigned'})
              </p>
            </div>

            <div className="space-y-3">
              {anchorAnnouncements.map((ann) => {
                const seen = ann.seenBy.includes(activeStudent.personId);
                return (
                  <div
                    key={ann.announcementId}
                    className={`border rounded-xl p-3.5 space-y-2 ${
                      ann.pinned
                        ? 'border-neutral-950 border-l-4 border-l-[#FFC20E] bg-white'
                        : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ann.pinned && (
                            <span className="bg-neutral-950 text-white rounded-full px-2 py-0.5 text-[10px] font-bold">
                              Pinned
                            </span>
                          )}
                          <p className="text-sm font-bold text-neutral-950">
                            {ann.title}
                          </p>
                        </div>
                        <p className="text-xs text-neutral-600 mt-0.5">
                          {ann.body}
                        </p>
                      </div>
                      <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                        {ann.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono tabular-nums text-neutral-500">
                        Seen by {ann.seenBy.length} of {rosterDenominator}
                      </span>
                      {seen ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-800">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Seen</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onAppend({
                              type: 'ANNOUNCEMENT_SEEN',
                              personId: activeStudent.personId,
                              cycleId: '2026',
                              actor: actorName,
                              payload: {
                                announcementId: ann.announcementId,
                                studentId: activeStudent.personId,
                              },
                            })
                          }
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
                        >
                          Mark as Seen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-neutral-200 pt-3 space-y-2.5">
              <h3 className="text-xs font-bold text-neutral-700">
                Upcoming Anchor Meetings
              </h3>
              {anchorMeetings.map((mtg) => {
                const myRsvp = mtg.rsvps[activeStudent.personId];
                const myLeaves = mtg.leaveRequests.filter(
                  (lr) => lr.studentId === activeStudent.personId
                );
                const isRequestingLeave = leaveMeetingId === mtg.meetingId;
                return (
                  <div
                    key={mtg.meetingId}
                    className="border border-neutral-200 rounded-xl p-3.5 space-y-2.5"
                  >
                    <p className="text-sm font-bold text-neutral-950">
                      {mtg.title}
                    </p>
                    <p className="text-xs text-neutral-600 font-mono tabular-nums">
                      {format(new Date(mtg.scheduledFor), 'dd MMM yyyy, HH:mm')} ·{' '}
                      {mtg.locationOrLink}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {(['going', 'maybe', 'declined'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            onAppend({
                              type: 'MEETING_RSVP_UPDATED',
                              personId: activeStudent.personId,
                              cycleId: '2026',
                              actor: actorName,
                              payload: {
                                meetingId: mtg.meetingId,
                                studentId: activeStudent.personId,
                                status: st,
                              },
                            })
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                            myRsvp === st
                              ? 'bg-neutral-950 text-white border-b-2 border-[#FFC20E]'
                              : 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
                          }`}
                        >
                          RSVP: {st}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setLeaveMeetingId(
                            isRequestingLeave ? null : mtg.meetingId
                          );
                          setLeaveError('');
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50"
                      >
                        Request leave
                      </button>
                    </div>

                    {isRequestingLeave && (
                      <form
                        onSubmit={(e) => handleLeaveSubmit(e, mtg.meetingId)}
                        className="border border-neutral-300 bg-neutral-50 rounded-xl p-3 space-y-2.5 mt-2"
                      >
                        <p className="text-xs font-bold text-neutral-950">
                          Meeting Leave Request (Reason & Proof Required)
                        </p>
                        <input
                          type="text"
                          aria-label="Leave reason"
                          value={leaveReason}
                          onChange={(e) => setLeaveReason(e.target.value)}
                          placeholder="Reason (e.g. Semester lab examination overlap)..."
                          className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-300 text-xs font-medium cursor-pointer hover:bg-neutral-100">
                            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {leaveProofFile
                                ? `${leaveProofFile.name} (${formatBytes(
                                    leaveProofFile.size
                                  )})`
                                : 'Upload Proof (PDF/JPG/PNG)'}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  setLeaveProofFile({
                                    name: f.name,
                                    type: f.type,
                                    size: f.size,
                                  });
                                }
                              }}
                              className="sr-only"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setLeaveProofFile({
                                name: 'exam_schedule_proof.pdf',
                                type: 'application/pdf',
                                size: 320000,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-xs font-medium text-neutral-900"
                          >
                            Attach Sample PDF
                          </button>
                        </div>
                        {leaveError && (
                          <p role="alert" className="text-xs text-red-600 font-medium">
                            {leaveError}
                          </p>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setLeaveMeetingId(null)}
                            className="px-3 py-1 rounded-lg text-xs font-medium border border-neutral-300 bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
                          >
                            Submit Leave Request
                          </button>
                        </div>
                      </form>
                    )}

                    {myLeaves.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {myLeaves.map((lr) => (
                          <div
                            key={lr.leaveId}
                            className="text-xs p-2 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-900 truncate">
                                Leave: {lr.reason}
                              </p>
                              <p className="text-[11px] font-mono text-neutral-500">
                                Proof: {lr.proofFileName}
                              </p>
                            </div>
                            <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                              {lr.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Placement Record & Own Career History */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-neutral-950" aria-hidden="true" />
                <div>
                  <p className="section-kicker">CAREER PROGRESSION</p>
                  <h2 className="font-display text-lg font-bold text-neutral-950">
                    My Placement & Career History
                  </h2>
                </div>
              </div>
              <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {activeStudent.placementRecord.offerStatus}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-neutral-600">
                Companies Attended:{' '}
                <span className="font-semibold text-neutral-950">
                  {activeStudent.placementRecord.companiesAttended.length > 0
                    ? activeStudent.placementRecord.companiesAttended.join(', ')
                    : 'None yet'}
                </span>
              </p>
              <p className="text-neutral-600">
                Placed / Offer:{' '}
                <span className="font-semibold text-neutral-950">
                  {activeStudent.placementRecord.placedCompany || 'Pending'}
                </span>
                {activeStudent.placementRecord.salaryLpa && (
                  <span className="font-mono tabular-nums text-neutral-700">
                    {' '}
                    · {activeStudent.placementRecord.salaryLpa}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-3 text-[11px] font-mono text-neutral-600">
                <span>
                  Offer Letter:{' '}
                  {activeStudent.placementRecord.offerDocName || 'Not uploaded'}
                </span>
                <span>·</span>
                <span>
                  Salary Slip:{' '}
                  {activeStudent.placementRecord.salarySlipName || 'Not uploaded'}
                </span>
              </div>
            </div>

            {activeStudent.careerHistory.length > 0 && (
              <div className="border-t border-neutral-200 pt-3 space-y-2">
                <p className="text-xs font-bold text-neutral-950">
                  My Recorded Career History
                </p>
                {activeStudent.careerHistory.map((entry) => (
                  <div
                    key={entry.entryId}
                    className="border border-neutral-200 rounded-lg p-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-neutral-700" aria-hidden="true" />
                      <span className="font-semibold text-neutral-950">
                        {entry.roleTitle} · {normalizeCompanyName(entry.company).normalized}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-neutral-500">
                      {entry.startYear}–{entry.endYear || 'Present'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handlePlacementUpdate}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-neutral-200"
            >
              <input
                type="text"
                aria-label="Add company attended"
                value={companyAttendedInput}
                onChange={(e) => setCompanyAttendedInput(e.target.value)}
                placeholder="Add attended company (e.g. TCS)"
                className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                aria-label="Placed company"
                value={placedCompanyInput}
                onChange={(e) => setPlacedCompanyInput(e.target.value)}
                placeholder="Placed company (if offered)"
                className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <select
                aria-label="Offer status"
                value={offerStatusInput}
                onChange={(e) =>
                  setOfferStatusInput(
                    e.target.value as
                      | 'Preparing'
                      | 'Interviewing'
                      | 'Offer Received'
                      | 'Alumni Employed'
                  )
                }
                className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white"
              >
                <option value="Preparing">Preparing</option>
                <option value="Interviewing">Interviewing</option>
                <option value="Offer Received">Offer Received</option>
                <option value="Alumni Employed">Alumni Employed (Current Job)</option>
              </select>
              <input
                type="text"
                aria-label="Compensation package"
                value={salaryInput}
                onChange={(e) => setSalaryInput(e.target.value)}
                placeholder="Package (e.g. 6.5 LPA)"
                className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm font-mono"
              />
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlacementDocUpload('offer')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Mock Upload Offer Letter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePlacementDocUpload('salary')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Mock Upload Salary Slip</span>
                  </button>
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
                >
                  Save Placement
                </button>
              </div>
            </form>
            {placementUploadMsg && (
              <p className="text-xs text-neutral-800 font-medium">
                {placementUploadMsg}
              </p>
            )}
            {placementUploadErr && (
              <p className="text-xs text-red-600 font-medium">
                {placementUploadErr}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Volunteering Request Board & Submit Work (Exactly ONE yellow Primary CTA here) */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5 shadow-xs">
        <div className="border-b border-neutral-200 pb-3">
          <p className="section-kicker">VOLUNTEERING PORTAL</p>
          <h2 className="font-display text-lg font-bold text-neutral-950 mt-0.5">
            Volunteering Request Board & Field Work Submission
          </h2>
          <p className="text-xs text-neutral-600">
            Raise availability across the 8 districts, opt into open requests, and log work with read-only auto-captured location & time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleRaiseVolunteeringRequest}
              className="border border-neutral-200 rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-bold text-neutral-950">
                1. Raise &ldquo;Ready for Physical Verification&rdquo;
              </h3>
              <input
                type="text"
                aria-label="Volunteering request title"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <div>
                <p className="text-xs font-medium text-neutral-600 mb-1.5">
                  Pick regions (8 districts)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DISTRICTS_8.map((reg) => {
                    const active = selectedRegions.includes(reg);
                    return (
                      <button
                        key={reg}
                        type="button"
                        onClick={() => toggleRegion(reg)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-neutral-950 text-white'
                            : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {reg}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input
                type="text"
                aria-label="Date window"
                value={reqWindow}
                onChange={(e) => setReqWindow(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-xl text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
              >
                Post Volunteering Availability
              </button>
            </form>

            {/* Primary CTA of Student Screen */}
            <form
              onSubmit={handleSubmitVolunteeringWork}
              className="border border-neutral-200 rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-bold text-neutral-950">
                2. Submit Completed Volunteering Work
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Volunteering category"
                  value={workCategory}
                  onChange={(e) =>
                    setWorkCategory(e.target.value as VolunteeringCategory)
                  }
                  className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                >
                  <option value="physical_verification">
                    Physical verification
                  </option>
                  <option value="tele_verification">Tele-verification</option>
                  <option value="school_visit">School visit</option>
                </select>
                <select
                  aria-label="Work district"
                  value={workRegion}
                  onChange={(e) => setWorkRegion(e.target.value)}
                  className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                >
                  {DISTRICTS_8.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {workCategory === 'physical_verification' ? (
                <div className="border border-neutral-950 bg-neutral-50 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-neutral-950 inline-flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Auto-captured GPS & Timestamp (Read-only)</span>
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-neutral-800 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>{autoCapturedLocation}</span>
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-neutral-700 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>{autoCapturedTimeDisplay}</span>
                  </p>
                </div>
              ) : (
                <input
                  type="text"
                  aria-label="Visit location"
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                  placeholder="School or tele-desk location"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Photo proof preset"
                  value={workPhotoPreset}
                  onChange={(e) =>
                    setWorkPhotoPreset(e.target.value as 'home' | 'school')
                  }
                  className="flex-1 min-w-0 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                >
                  <option value="home">
                    Mock Photo: Home Visit Field Check
                  </option>
                  <option value="school">
                    Mock Photo: School Outreach Session
                  </option>
                </select>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-medium cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Upload Proof</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleWorkPhotoFile}
                    className="sr-only"
                  />
                </label>
              </div>
              <p className="text-[11px] font-mono text-neutral-500">
                Attached proof: {workPhotoName}
              </p>
              {workPhotoError && (
                <p className="text-xs text-red-600">{workPhotoError}</p>
              )}

              <textarea
                rows={2}
                aria-label="Field notes"
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                placeholder="Verification observations..."
                className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b]"
              >
                Submit Work to Anchor
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-neutral-950 mb-2.5">
                Scoped Request Board
              </h3>
              <div className="space-y-2.5">
                {volunteeringRequests.map((req) => {
                  const hasOptedIn = req.optedInVolunteers.some(
                    (v) => v.personId === activeStudent.personId
                  );
                  return (
                    <div
                      key={req.requestId}
                      className="border border-neutral-200 rounded-xl p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-neutral-950">
                            {req.title}
                          </p>
                          <p className="text-xs text-neutral-600">
                            Raised by {req.createdByName} · {req.dateWindow}
                          </p>
                        </div>
                        {req.assignedToName ? (
                          <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0">
                            Assigned: {req.assignedToName}
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-neutral-500 shrink-0">
                            Awaiting Anchor
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-700">
                          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{req.regions.join(', ')}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Opted in: {req.optedInVolunteers.length}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={hasOptedIn}
                          onClick={() =>
                            onAppend({
                              type: 'VOLUNTEERING_REQUEST_OPTED_IN',
                              personId: activeStudent.personId,
                              cycleId: '2026',
                              actor: actorName,
                              payload: {
                                requestId: req.requestId,
                                volunteerName: activeStudent.name,
                              },
                            })
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                            hasOptedIn
                              ? 'bg-neutral-100 text-neutral-500 cursor-default'
                              : 'bg-neutral-950 text-white hover:bg-neutral-800'
                          }`}
                        >
                          {hasOptedIn ? 'Opted In' : 'Opt In'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-neutral-950 mb-2.5">
                My Volunteering Work Status
              </h3>
              <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-xl">
                {myWorks.length === 0 ? (
                  <p className="p-3.5 text-xs text-neutral-500">
                    No submissions yet for {activeStudent.name}.
                  </p>
                ) : (
                  myWorks.map((w) => (
                    <div
                      key={w.workId}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-950">
                          {w.category.replace('_', ' ')} · {w.location}
                        </p>
                        <p className="text-[11px] text-neutral-500 font-mono tabular-nums">
                          {w.workId} · {format(new Date(w.submittedAt), 'dd MMM yyyy, HH:mm')}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${
                          w.status === 'Admin verified'
                            ? 'bg-neutral-950 text-white border-b-2 border-[#FFC20E]'
                            : w.status === 'Anchor approved'
                              ? 'bg-neutral-950 text-white'
                              : 'bg-neutral-200 text-neutral-800'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
