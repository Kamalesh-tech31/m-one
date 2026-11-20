import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Award,
  Briefcase,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  GraduationCap,
  Inbox,
  Lock,
  MapPin,
  Megaphone,
  Plus,
  Upload,
  UserCheck,
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

export type StudentTab =
  | 'overview'
  | 'volunteering'
  | 'academics'
  | 'meetings'
  | 'placement'
  | 'help';

interface StudentScreenProps {
  scoped: StudentScopedView;
  actorName: string;
  activeTab?: StudentTab;
  onAppend: (input: AppendEventInput) => void;
  showToast: (msg: string) => void;
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
  activeTab = 'overview',
  onAppend,
  showToast,
}) => {
  const activeStudent = scoped.ownProfile;

  // CGPA form
  const [semesterLabel, setSemesterLabel] = useState('Sem 5');
  const [gpaInput, setGpaInput] = useState('9.08');

  // Achievement form
  const [achTitle, setAchTitle] = useState('');
  const [achCategory, setAchCategory] = useState('Hackathon');

  // Difficulty flag form
  const [diffCategory, setDiffCategory] = useState<DifficultyCategory>('Academic');
  const [diffNote, setDiffNote] = useState('');

  // Meeting leave form
  const [leaveMeetingId, setLeaveMeetingId] = useState<string | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveProofFile, setLeaveProofFile] = useState<{
    name: string;
    type: string;
    size: number;
  } | null>(null);
  const [leaveError, setLeaveError] = useState('');

  // Volunteering availability request
  const [reqTitle, setReqTitle] = useState('Weekend School Verification Outreach');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([
    'Chennai',
    'Vellore',
  ]);
  const [reqWindow, setReqWindow] = useState('Nov 2026 – Dec 2026');

  // Submit volunteering proof form
  const [workCategory, setWorkCategory] = useState<VolunteeringCategory>(
    'physical_verification'
  );
  const [workRegion, setWorkRegion] = useState('Chennai');
  const [workLocation, setWorkLocation] = useState('Govt HSS Saidapet & Ashok Nagar');
  const [workNotes, setWorkNotes] = useState('Verified 2 applicant homes & verified marksheet originals.');
  const [workPhotoUrl, setWorkPhotoUrl] = useState(PROOF_HOME_VISIT_URL);
  const [workPhotoName, setWorkPhotoName] = useState('field_visit_photo.jpg');
  const [workPhotoError, setWorkPhotoError] = useState('');

  // Placement record form
  const [companyAttendedInput, setCompanyAttendedInput] = useState('');
  const [placedCompanyInput, setPlacedCompanyInput] = useState('');
  const [offerStatusInput, setOfferStatusInput] = useState<
    'Preparing' | 'Interviewing' | 'Offer Received' | 'Alumni Employed'
  >('Offer Received');
  const [salaryInput, setSalaryInput] = useState('');
  const [placementUploadErr, setPlacementUploadErr] = useState('');

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
    showToast(`Recorded ${semesterLabel.trim()} GPA (${gpa.toFixed(2)}).`);
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
    showToast('Achievement logged.');
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
    showToast(
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
    showToast('Leave request with supporting proof sent to Anchor.');
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
    showToast('Volunteering availability posted.');
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
      setWorkPhotoError(check.error || 'Invalid file.');
      return;
    }
    setWorkPhotoName(file.name);
    setWorkPhotoUrl(URL.createObjectURL(file));
  };

  const handleSubmitWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workLocation.trim()) return;

    onAppend({
      type: 'VOLUNTEERING_WORK_SUBMITTED',
      personId: activeStudent.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        workId: `VW-${Date.now().toString(36).toUpperCase()}`,
        personName: activeStudent.name,
        submitterRole: 'student',
        category: workCategory,
        region: workRegion,
        location: `${workLocation.trim()} [GPS: ${autoCapturedLocation}]`,
        photoUrl: workPhotoUrl,
        notes: `${workNotes.trim()} [Captured: ${autoCapturedTimeDisplay}]`,
      },
    });

    showToast('Volunteering work submitted. Awaiting Anchor review.');
  };

  const handleOptInRequest = (requestId: string) => {
    onAppend({
      type: 'VOLUNTEERING_REQUEST_OPTED_IN',
      personId: activeStudent.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        requestId,
        personName: activeStudent.name,
      },
    });
    showToast('Opted in for volunteering task.');
  };

  const handleRsvp = (meetingId: string, rsvp: 'going' | 'maybe' | 'declined') => {
    onAppend({
      type: 'MEETING_RSVP_UPDATED',
      personId: activeStudent.personId,
      cycleId: activeStudent.cycleId,
      actor: actorName,
      payload: { meetingId, rsvp },
    });
    showToast(`RSVP updated: ${rsvp}.`);
  };

  const handleSavePlacementRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const currentAttended = activeStudent.placementRecord.companiesAttended;
    const nextAttended = companyAttendedInput.trim()
      ? Array.from(new Set([...currentAttended, companyAttendedInput.trim()]))
      : currentAttended;

    const placed =
      placedCompanyInput.trim() || activeStudent.placementRecord.placedCompany;

    onAppend({
      type: 'PLACEMENT_RECORD_UPDATED',
      personId: activeStudent.personId,
      cycleId: activeStudent.cycleId,
      actor: actorName,
      payload: {
        companiesAttended: nextAttended,
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
    showToast('Placement record updated.');
  };

  const handlePlacementDocUpload = (kind: 'offer' | 'salary', file?: File | null) => {
    setPlacementUploadErr('');
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
    showToast(`Uploaded ${targetFile.name}.`);
  };

  return (
    <div className="space-y-8">
      {/* Page Header (No yellow offset block) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-neutral-950">
            {activeTab === 'overview' && 'Student Overview'}
            {activeTab === 'volunteering' && 'Volunteering & Field Proof'}
            {activeTab === 'academics' && 'Academic Progression & CGPA'}
            {activeTab === 'meetings' && 'Cohort Meetings & Announcements'}
            {activeTab === 'placement' && 'Placement & Career Log'}
            {activeTab === 'help' && 'Mentoring & Support'}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            {activeTab === 'overview' &&
              `${activeStudent.degree || 'Undergraduate'} · ${activeStudent.college || 'College'} · Anchor: ${scoped.anchorName || 'Assigned'}`}
            {activeTab === 'volunteering' &&
              'Participate in student verification visits and submit photo-verified impact proof.'}
            {activeTab === 'academics' &&
              'Log semester GPA updates and co-curricular achievements for anchor review.'}
            {activeTab === 'meetings' &&
              'Stay updated with anchor cohort notices, upcoming gatherings, and leave requests.'}
            {activeTab === 'placement' &&
              'Track campus interviews, offer status, and upload verified placement documentation.'}
            {activeTab === 'help' &&
              'Flag academic or personal challenges directly to your mentor for guidance.'}
          </p>
        </div>
      </div>

      {/* 1. OVERVIEW: Profile Card & Verified Volunteering Impact Strip */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-neutral-950">
                  {activeStudent.name}
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {activeStudent.degree} · {activeStudent.semesterLabel || 'Current Semester'} · {activeStudent.college}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Anchor Mentor: <span className="font-semibold text-neutral-900">{scoped.anchorName || 'Assigned'}</span>
                </p>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-right">
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Latest CGPA
                </p>
                <p className="text-2xl font-mono font-bold text-neutral-950">
                  {latestCgpa !== null ? latestCgpa.toFixed(2) : '—'}
                </p>
              </div>
            </div>

            {/* Verified Volunteering Impact Strip (with "Synced from Volunteer Portal" label) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Verified Volunteering Counts
                </h3>
                <span className="text-[11px] font-semibold text-neutral-500 italic">
                  Synced from Volunteer Portal
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-neutral-950 text-white rounded-xl">
                  <p className="text-xs text-neutral-400">Tele-verifications</p>
                  <p className="text-2xl font-mono font-bold mt-1">
                    {activeStudent.volunteeringCounts.teleVerifications}
                  </p>
                </div>
                <div className="p-4 bg-neutral-950 text-white rounded-xl">
                  <p className="text-xs text-neutral-400">Physical Verifications</p>
                  <p className="text-2xl font-mono font-bold mt-1">
                    {activeStudent.volunteeringCounts.physicalVerifications}
                  </p>
                </div>
                <div className="p-4 bg-neutral-950 text-white rounded-xl">
                  <p className="text-xs text-neutral-400">School Visits</p>
                  <p className="text-2xl font-mono font-bold mt-1">
                    {activeStudent.volunteeringCounts.schoolVisits}
                  </p>
                </div>
                <div className="p-4 border border-dashed border-neutral-300 rounded-xl bg-neutral-50 text-neutral-500 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                    <span>NGO Teaching</span>
                    <Lock className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">Coming soon</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. VOLUNTEERING: Board & Submit Proof */}
      {activeTab === 'volunteering' && (
        <div className="space-y-6">
          {/* Submit Work Proof Form */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="border-b border-neutral-100 pb-3">
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Submit Volunteering Field Proof
              </h2>
              <p className="text-xs text-neutral-500">
                Submit visit details and geotagged photograph for Anchor approval and Admin verification.
              </p>
            </div>

            <form onSubmit={handleSubmitWork} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-900">
                    Category
                  </label>
                  <select
                    value={workCategory}
                    onChange={(e) =>
                      setWorkCategory(e.target.value as VolunteeringCategory)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  >
                    <option value="physical_verification">Physical Verification</option>
                    <option value="tele_verification">Tele-verification</option>
                    <option value="school_visit">School Outreach Visit</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-900">
                    Region
                  </label>
                  <select
                    value={workRegion}
                    onChange={(e) => setWorkRegion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  >
                    {DISTRICTS_8.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-900">
                    Location / School
                  </label>
                  <input
                    type="text"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    placeholder="e.g. Govt HSS Saidapet"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  Verification Notes
                </label>
                <textarea
                  rows={2}
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div>
                  <label className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Proof Photo</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={handleWorkPhotoFile}
                      className="sr-only"
                    />
                  </label>
                  <span className="text-xs text-neutral-500 ml-2">
                    {workPhotoName}
                  </span>
                  {workPhotoError && (
                    <p className="text-xs text-red-600 mt-1">{workPhotoError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors"
                >
                  Submit Proof
                </button>
              </div>
            </form>
          </section>

          {/* Volunteering Works List */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              My Submitted Volunteering Entries
            </h2>

            {myWorks.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-2">
                No volunteering entries submitted yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-neutral-200 rounded-xl overflow-hidden">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Location & Coordinates</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {myWorks.map((work) => (
                      <tr key={work.workId} className="hover:bg-neutral-50">
                        <td className="py-2.5 px-3 font-semibold text-neutral-950 capitalize">
                          {work.category.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-700">
                          {work.location}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              work.status === 'Admin verified'
                                ? 'bg-green-100 text-green-800'
                                : work.status === 'Anchor approved'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {work.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-500">
                          {format(new Date(work.submittedAt), 'dd MMM yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Volunteering Requests Board */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Open Volunteering Opportunities
            </h2>
            <div className="space-y-3">
              {volunteeringRequests.map((req) => {
                const hasOptedIn = req.optedInVolunteers.some(
                  (v) => v.personId === activeStudent.personId
                );

                return (
                  <div
                    key={req.requestId}
                    className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-neutral-950">
                        {req.title}
                      </p>
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        Regions: {req.regions.join(', ')} · Date Window: {req.dateWindow}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={hasOptedIn}
                      onClick={() => handleOptInRequest(req.requestId)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-100 disabled:opacity-50 shrink-0 self-start sm:self-auto"
                    >
                      {hasOptedIn ? 'Opted In' : 'Opt In'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* 3. ACADEMICS: CGPA & Achievements */}
      {activeTab === 'academics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* CGPA progression */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              CGPA Progression
            </h2>

            <form onSubmit={handleAddCgpa} className="flex gap-2">
              <input
                type="text"
                value={semesterLabel}
                onChange={(e) => setSemesterLabel(e.target.value)}
                placeholder="Sem 5"
                className="w-28 px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                required
              />
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={gpaInput}
                onChange={(e) => setGpaInput(e.target.value)}
                placeholder="9.00"
                className="w-28 px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl font-bold text-xs bg-neutral-950 text-white hover:bg-neutral-800 transition-colors"
              >
                Log GPA
              </button>
            </form>

            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs border border-neutral-200 rounded-xl overflow-hidden">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Semester</th>
                    <th className="py-2 px-3">GPA</th>
                    <th className="py-2 px-3">Recorded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {activeStudent.cgpaHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50">
                      <td className="py-2 px-3 font-semibold text-neutral-950">
                        {item.semester}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-neutral-900">
                        {item.gpa.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 font-mono text-neutral-500">
                        {format(new Date(item.recordedAt), 'dd MMM yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Achievements Tracker */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Scholar Achievements
            </h2>

            <form onSubmit={handleAddAchievement} className="space-y-2">
              <input
                type="text"
                value={achTitle}
                onChange={(e) => setAchTitle(e.target.value)}
                placeholder="e.g. 1st Place Inter-college Hackathon"
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                required
              />
              <div className="flex gap-2">
                <select
                  value={achCategory}
                  onChange={(e) => setAchCategory(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                >
                  <option value="Hackathon">Hackathon</option>
                  <option value="Certification">Certification</option>
                  <option value="Academic Project">Academic Project</option>
                  <option value="Sports">Sports</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold text-xs bg-neutral-950 text-white hover:bg-neutral-800 transition-colors"
                >
                  Add
                </button>
              </div>
            </form>

            <ul className="space-y-2 pt-2">
              {activeStudent.achievements.map((item, idx) => (
                <li
                  key={idx}
                  className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-neutral-950">{item.title}</p>
                    <p className="text-[11px] text-neutral-500">{item.category}</p>
                  </div>
                  <span className="font-mono text-neutral-500">{item.date}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* 4. MEETINGS & ANNOUNCEMENTS */}
      {activeTab === 'meetings' && (
        <div className="space-y-6">
          {/* Cohort Announcements (Empty state: "No announcements yet") */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Cohort Announcements
            </h2>

            {anchorAnnouncements.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-500 italic border border-dashed border-neutral-200 rounded-xl">
                No announcements yet
              </div>
            ) : (
              <div className="space-y-3">
                {anchorAnnouncements.map((ann) => (
                  <div
                    key={ann.announcementId}
                    className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-neutral-950">
                        {ann.title}
                      </p>
                      <span className="text-[11px] font-mono text-neutral-500">
                        {format(new Date(ann.postedAt), 'dd MMM yyyy')}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-700 leading-relaxed">
                      {ann.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Group Meetings & Leave Requests */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Upcoming Gatherings & RSVP
            </h2>

            {anchorMeetings.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-2">
                No meetings scheduled.
              </p>
            ) : (
              <div className="space-y-4">
                {anchorMeetings.map((mtg) => {
                  const myRsvp = mtg.rsvps[activeStudent.personId] || null;

                  return (
                    <div
                      key={mtg.meetingId}
                      className="p-4 border border-neutral-200 rounded-xl space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-neutral-950">
                            {mtg.title}
                          </p>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            {format(new Date(mtg.scheduledFor), 'dd MMM yyyy, HH:mm')} · {mtg.locationOrLink}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {(['going', 'maybe', 'declined'] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleRsvp(mtg.meetingId, r)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize border transition-colors ${
                                myRsvp === r
                                  ? 'bg-neutral-950 text-white border-neutral-950'
                                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                        <span className="text-neutral-500">
                          Agenda: {mtg.agenda || 'Cohort sync & academic check-in'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLeaveMeetingId(mtg.meetingId)}
                          className="font-semibold text-neutral-900 underline hover:text-black"
                        >
                          Request Leave
                        </button>
                      </div>

                      {/* Leave request form modal/inline */}
                      {leaveMeetingId === mtg.meetingId && (
                        <form
                          onSubmit={(e) => handleLeaveSubmit(e, mtg.meetingId)}
                          className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3 mt-2"
                        >
                          <p className="text-xs font-bold text-neutral-900">
                            Submit Leave Request with Proof
                          </p>
                          {leaveError && (
                            <p className="text-xs text-red-600">{leaveError}</p>
                          )}
                          <input
                            type="text"
                            value={leaveReason}
                            onChange={(e) => setLeaveReason(e.target.value)}
                            placeholder="Reason for absence (at least 5 characters)"
                            className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 text-xs"
                            required
                          />
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f)
                                setLeaveProofFile({
                                  name: f.name,
                                  type: f.type,
                                  size: f.size,
                                });
                            }}
                            className="text-xs text-neutral-600"
                            required
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setLeaveMeetingId(null)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border border-neutral-300 text-neutral-700"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-3.5 py-1 rounded-lg text-xs font-bold bg-neutral-950 text-white"
                            >
                              Send Leave Request
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 5. PLACEMENT: Form & Uploads */}
      {activeTab === 'placement' && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs max-w-3xl">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Placement Progress & Documents
            </h2>
            <p className="text-xs text-neutral-500">
              Record interview history, offer letter, and salary documentation.
            </p>
          </div>

          <form onSubmit={handleSavePlacementRecord} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  Offer Status
                </label>
                <select
                  value={offerStatusInput}
                  onChange={(e) => setOfferStatusInput(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                >
                  <option value="Preparing">Preparing</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Offer Received">Offer Received</option>
                  <option value="Alumni Employed">Alumni Employed</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  Placed Company
                </label>
                <input
                  type="text"
                  value={placedCompanyInput}
                  onChange={(e) => setPlacedCompanyInput(e.target.value)}
                  placeholder="e.g. Tata Consultancy Services"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  Salary LPA (optional)
                </label>
                <input
                  type="text"
                  value={salaryInput}
                  onChange={(e) => setSalaryInput(e.target.value)}
                  placeholder="e.g. 7.5 LPA"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  Add Attended Company
                </label>
                <input
                  type="text"
                  value={companyAttendedInput}
                  onChange={(e) => setCompanyAttendedInput(e.target.value)}
                  placeholder="e.g. Cognizant"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors"
              >
                Save Placement Record
              </button>
            </div>
          </form>

          {/* Document Uploads */}
          <div className="pt-4 border-t border-neutral-100 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Placement Proof Documents
            </h3>
            {placementUploadErr && (
              <p className="text-xs text-red-600">{placementUploadErr}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 text-xs">
                <p className="font-bold text-neutral-900">Offer Letter</p>
                <p className="text-neutral-500 font-mono">
                  {activeStudent.placementRecord.offerDocName || 'Not uploaded'}
                </p>
                <label className="inline-block px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 font-semibold cursor-pointer">
                  <span>Upload Offer Letter</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      handlePlacementDocUpload('offer', e.target.files?.[0])
                    }
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 text-xs">
                <p className="font-bold text-neutral-900">Salary Slip</p>
                <p className="text-neutral-500 font-mono">
                  {activeStudent.placementRecord.salarySlipName || 'Not uploaded'}
                </p>
                <label className="inline-block px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 font-semibold cursor-pointer">
                  <span>Upload Salary Slip</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      handlePlacementDocUpload('salary', e.target.files?.[0])
                    }
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6. GET HELP: Difficulty Flag */}
      {activeTab === 'help' && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xs max-w-2xl">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Mentoring & Difficulty Support
            </h2>
            <p className="text-xs text-neutral-500">
              Privately alert your Anchor and Admin if you need academic, financial, or personal mentoring.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-neutral-900">
                Difficulty Category
              </label>
              <select
                value={diffCategory}
                onChange={(e) =>
                  setDiffCategory(e.target.value as DifficultyCategory)
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm focus:outline-none focus:border-neutral-950"
              >
                {DIFFICULTY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-neutral-900">
                Mentoring Notes (Confidential)
              </label>
              <textarea
                rows={3}
                value={diffNote}
                onChange={(e) => setDiffNote(e.target.value)}
                placeholder="Share details regarding your current challenge..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm focus:outline-none focus:border-neutral-950"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleToggleDifficulty(true)}
                className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors"
              >
                Raise Difficulty Flag
              </button>

              {activeStudent.difficultyFlag?.flagged && (
                <button
                  type="button"
                  onClick={() => handleToggleDifficulty(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 transition-colors"
                >
                  Clear Flag
                </button>
              )}
            </div>

            {activeStudent.difficultyFlag?.flagged && (
              <div className="p-3.5 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-950 space-y-1">
                <p className="font-bold">
                  Active Flag: {activeStudent.difficultyFlag.category}
                </p>
                <p>{activeStudent.difficultyFlag.note}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
