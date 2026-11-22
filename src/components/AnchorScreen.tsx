import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  BookOpen,
  CalendarCheck,
  Check,
  Clock,
  Flag,
  Inbox,
  KeyRound,
  Megaphone,
  Plus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { AnchorScopedView } from '../core/scoping';
import { PROOF_SCHOOL_OUTREACH_URL } from '../core/seed';
import type { AppendEventInput } from '../core/store';
import { formatBytes } from '../core/validation';
import {
  DISTRICTS_8,
  type PersonProfile,
} from '../core/types';

export type AnchorTab =
  | 'roster'
  | 'announcements'
  | 'meetings'
  | 'resources'
  | 'requests';

interface AnchorScreenProps {
  scoped: AnchorScopedView;
  actorName: string;
  activeTab?: AnchorTab;
  allPersonsLookup: Record<string, PersonProfile>;
  onAppend: (input: AppendEventInput) => void;
  showToast: (msg: string) => void;
}

export const AnchorScreen: React.FC<AnchorScreenProps> = ({
  scoped,
  actorName,
  activeTab = 'roster',
  allPersonsLookup,
  onAppend,
  showToast,
}) => {
  const activeAnchor = scoped.ownProfile;
  const roster = scoped.roster;

  // Join code onboarding
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinFeedback, setJoinFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annCategory, setAnnCategory] = useState('Academics');
  const [annPinned, setAnnPinned] = useState(false);

  // Meeting form
  const [mtgTitle, setMtgTitle] = useState('');
  const [mtgSchedule, setMtgSchedule] = useState('2026-11-29T10:30');
  const [mtgLocation, setMtgLocation] = useState(
    'Maatram T. Nagar Center / Google Meet'
  );

  // Resource form
  const [resTitle, setResTitle] = useState('');
  const [resCategory, setResCategory] = useState('Career Prep');
  const [resLabel, setResLabel] = useState('PDF Guide');

  // Monthly private check-in
  const [checkStudentId, setCheckStudentId] = useState(
    roster[0]?.personId || 'P-2024-01'
  );
  const [checkBlocked, setCheckBlocked] = useState(false);
  const [checkResponse, setCheckResponse] = useState('');

  // Sampled response draft
  const [sampledDrafts, setSampledDrafts] = useState<Record<string, string>>({});

  if (!activeAnchor) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-neutral-600">
          Anchor profile unavailable in current scope.
        </p>
      </div>
    );
  }

  const availableCodes = Object.values(allPersonsLookup)
    .filter(
      (p) =>
        p.joinCode &&
        !p.joinCodeRedeemedByAnchorId &&
        (!p.joinCodeExpiresAt || Date.parse(p.joinCodeExpiresAt) > Date.now())
    )
    .map((p) => p.joinCode as string);

  const handleRedeemJoinCode = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinFeedback(null);
    const cleaned = joinCodeInput.trim().toUpperCase();

    if (roster.length >= scoped.rosterCap) {
      setJoinFeedback({
        ok: false,
        msg: `Roster cap of ${scoped.rosterCap} reached. Cannot onboard more scholars.`,
      });
      return;
    }

    const targetPerson = Object.values(allPersonsLookup).find(
      (p) => p.joinCode?.toUpperCase() === cleaned
    );

    if (!targetPerson) {
      setJoinFeedback({
        ok: false,
        msg: `Join code "${cleaned}" not found.`,
      });
      return;
    }

    if (targetPerson.joinCodeRedeemedByAnchorId) {
      setJoinFeedback({
        ok: false,
        msg: `Code "${cleaned}" has already been redeemed.`,
      });
      return;
    }

    if (
      targetPerson.joinCodeExpiresAt &&
      Date.parse(targetPerson.joinCodeExpiresAt) < Date.now()
    ) {
      setJoinFeedback({
        ok: false,
        msg: `Code "${cleaned}" expired after 48 hours.`,
      });
      return;
    }

    onAppend({
      type: 'JOIN_CODE_REDEEMED',
      personId: targetPerson.personId,
      cycleId: targetPerson.cycleId,
      actor: actorName,
      payload: {
        joinCode: cleaned,
        anchorId: activeAnchor.personId,
      },
    });

    setJoinCodeInput('');
    setJoinFeedback({
      ok: true,
      msg: `Scholar ${targetPerson.name} (${targetPerson.personId}) onboarded to your roster.`,
    });
    showToast(`Scholar ${targetPerson.name} added to roster.`);
  };

  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;

    onAppend({
      type: 'ANNOUNCEMENT_POSTED',
      personId: activeAnchor.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        announcementId: `ANN-${Date.now().toString(36).toUpperCase()}`,
        title: annTitle.trim(),
        body: annBody.trim(),
        category: annCategory,
        pinned: annPinned,
        initialSeenBy: [activeAnchor.personId],
      },
    });

    setAnnTitle('');
    setAnnBody('');
    setAnnPinned(false);
    showToast('Announcement posted to cohort.');
  };

  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mtgTitle.trim()) return;

    onAppend({
      type: 'MEETING_CREATED',
      personId: activeAnchor.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        meetingId: `MTG-${Date.now().toString(36).toUpperCase()}`,
        title: mtgTitle.trim(),
        scheduledFor: new Date(mtgSchedule).toISOString(),
        locationOrLink: mtgLocation.trim(),
        agenda: 'Monthly anchor cohort sync, project progress, and doubt clearance.',
      },
    });

    setMtgTitle('');
    showToast('Cohort meeting scheduled.');
  };

  const handleReviewLeave = (
    meetingId: string,
    leaveId: string,
    decision: 'Approved' | 'Declined'
  ) => {
    onAppend({
      type: 'MEETING_LEAVE_REVIEWED',
      personId: activeAnchor.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        meetingId,
        leaveId,
        decision,
        reviewedBy: actorName,
      },
    });
    showToast(`Leave request ${decision.toLowerCase()}.`);
  };

  const handleAssignVolunteerRequest = (
    requestId: string,
    assignedStudentId: string
  ) => {
    const student = roster.find((s) => s.personId === assignedStudentId);
    if (!student) return;

    onAppend({
      type: 'VOLUNTEERING_REQUEST_ASSIGNED',
      personId: activeAnchor.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        requestId,
        assignedToPersonId: student.personId,
        assignedToName: student.name,
      },
    });
    showToast(`Task assigned to ${student.name}.`);
  };

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) return;

    onAppend({
      type: 'RESOURCE_ADDED',
      personId: activeAnchor.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        resourceId: `RES-${Date.now().toString(36).toUpperCase()}`,
        title: resTitle.trim(),
        category: resCategory,
        urlLabel: resLabel,
      },
    });

    setResTitle('');
    showToast('Resource added to cohort repository.');
  };

  const handleLogMonthlyCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkResponse.trim()) return;

    const student = roster.find((s) => s.personId === checkStudentId);
    if (!student) return;

    onAppend({
      type: 'MONTHLY_CHECK_SUBMITTED',
      personId: student.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        checkId: `CHK-${Date.now().toString(36).toUpperCase()}`,
        personName: student.name,
        month: format(new Date(), 'MMMM yyyy'),
        blocked: checkBlocked,
        response: checkResponse.trim(),
      },
    });

    setCheckResponse('');
    setCheckBlocked(false);
    showToast(`Monthly check logged for ${student.name}.`);
  };

  return (
    <div className="space-y-8">
      {/* Page Header (No yellow offset block) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-neutral-950">
            {activeTab === 'roster' && 'Cohort Roster'}
            {activeTab === 'announcements' && 'Cohort Announcements'}
            {activeTab === 'meetings' && 'Meetings & Leave Reviews'}
            {activeTab === 'resources' && 'Learning & Career Resources'}
            {activeTab === 'requests' && 'Requests Inbox'}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            {activeTab === 'roster' &&
              `Cohort of ${roster.length} / ${scoped.rosterCap} scholars · ${activeAnchor.region}`}
            {activeTab === 'announcements' &&
              'Broadcast updates, examination guidelines, and deadlines to your cohort.'}
            {activeTab === 'meetings' &&
              'Manage group gatherings, take attendance, and review scholar leave applications.'}
            {activeTab === 'resources' &&
              'Share curated study material and engineering preparation guides.'}
            {activeTab === 'requests' &&
              'Manage student volunteering availability requests and assign tasks.'}
          </p>
        </div>
      </div>

      {/* 1. ROSTER VIEW: Table & Join Code Redemption */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Join Code Onboarding */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs max-w-2xl">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Add Student by Join Code
            </h2>
            <form onSubmit={handleRedeemJoinCode} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="e.g. MTRM-2026-8492"
                  className="flex-1 min-w-0 border border-neutral-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold tracking-wider font-mono uppercase focus:outline-none focus:border-neutral-950"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] whitespace-nowrap shrink-0 transition-colors"
                >
                  Onboard Scholar
                </button>
              </div>

              {availableCodes.length > 0 && (
                <div className="text-xs text-neutral-600 space-y-1 pt-1">
                  <p className="font-medium text-neutral-500">Unredeemed join codes ready in pool:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableCodes.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setJoinCodeInput(code)}
                        className="px-2 py-0.5 rounded border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-neutral-900 font-mono text-xs"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {joinFeedback && (
                <p
                  className={`text-xs p-2.5 rounded-xl border ${
                    joinFeedback.ok
                      ? 'border-neutral-950 bg-neutral-50 text-neutral-950 font-medium'
                      : 'border-red-200 bg-red-50 text-red-900'
                  }`}
                >
                  {joinFeedback.msg}
                </p>
              )}
            </form>
          </section>

          {/* Roster Table */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Scholars in Cohort ({roster.length} / {scoped.rosterCap})
              </h2>
            </div>

            {roster.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-2">
                No scholars onboarded yet. Redeem a join code above to add scholars.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-neutral-200 rounded-xl overflow-hidden">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">College & Degree</th>
                      <th className="py-2.5 px-3">District</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Volunteering</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {roster.map((s) => (
                      <tr key={s.personId} className="hover:bg-neutral-50">
                        <td className="py-2.5 px-3 font-semibold text-neutral-950">
                          {s.name}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-700">
                          {s.college || 'Enrolled'} · {s.degree}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          {s.region}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-neutral-100 text-neutral-800 capitalize">
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-600">
                          {s.volunteeringCounts.teleVerifications +
                            s.volunteeringCounts.physicalVerifications +
                            s.volunteeringCounts.schoolVisits}{' '}
                          verified
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 2. ANNOUNCEMENTS VIEW */}
      {activeTab === 'announcements' && (
        <div className="space-y-6 max-w-3xl">
          {/* Post Form */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Post Cohort Notice
            </h2>
            <form onSubmit={handlePostAnnouncement} className="space-y-3">
              <input
                type="text"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Notice headline..."
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-neutral-950"
                required
              />
              <textarea
                rows={3}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Full announcement body..."
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-neutral-950"
                required
              />
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <select
                    value={annCategory}
                    onChange={(e) => setAnnCategory(e.target.value)}
                    className="border border-neutral-300 rounded-xl px-3 py-1.5 text-xs bg-white"
                  >
                    <option value="Academics">Academics</option>
                    <option value="Volunteering">Volunteering</option>
                    <option value="Gathering">Gathering</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                  <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annPinned}
                      onChange={(e) => setAnnPinned(e.target.checked)}
                    />
                    <span>Pin to top</span>
                  </label>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors"
                >
                  Publish Notice
                </button>
              </div>
            </form>
          </section>

          {/* Announcements List */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Published Cohort Announcements
            </h2>
            {scoped.ownAnnouncements.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-500 italic border border-dashed border-neutral-200 rounded-xl">
                No announcements yet
              </div>
            ) : (
              <div className="space-y-3">
                {scoped.ownAnnouncements.map((ann) => (
                  <div
                    key={ann.announcementId}
                    className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-950">
                          {ann.title}
                        </span>
                        {ann.pinned && (
                          <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[10px] font-semibold">
                            Pinned
                          </span>
                        )}
                      </div>
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
        </div>
      )}

      {/* 3. MEETINGS & LEAVE VIEW */}
      {activeTab === 'meetings' && (
        <div className="space-y-6 max-w-3xl">
          {/* Schedule Form */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Schedule Cohort Gathering
            </h2>
            <form onSubmit={handleCreateMeeting} className="space-y-3">
              <input
                type="text"
                value={mtgTitle}
                onChange={(e) => setMtgTitle(e.target.value)}
                placeholder="e.g. November Monthly Cohort Check-in"
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-neutral-950"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="datetime-local"
                  value={mtgSchedule}
                  onChange={(e) => setMtgSchedule(e.target.value)}
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs bg-white"
                  required
                />
                <input
                  type="text"
                  value={mtgLocation}
                  onChange={(e) => setMtgLocation(e.target.value)}
                  placeholder="Location or Google Meet URL"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors"
                >
                  Schedule Meeting
                </button>
              </div>
            </form>
          </section>

          {/* Meetings List with Leave Requests */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Gatherings & Scholar Leave Applications
            </h2>

            {scoped.ownMeetings.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-2">
                No meetings scheduled yet.
              </p>
            ) : (
              <div className="space-y-4">
                {scoped.ownMeetings.map((mtg) => (
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
                      <span className="text-xs font-mono text-neutral-600 bg-neutral-100 px-2.5 py-0.5 rounded-full">
                        {Object.values(mtg.rsvps).filter((r) => r === 'going').length} attending
                      </span>
                    </div>

                    {/* Leave requests review */}
                    {mtg.leaveRequests && mtg.leaveRequests.length > 0 && (
                      <div className="pt-2 border-t border-neutral-100 space-y-2">
                        <p className="text-xs font-bold text-neutral-800">
                          Pending Leave Applications
                        </p>
                        {mtg.leaveRequests.map((leave) => (
                          <div
                            key={leave.leaveId}
                            className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <p className="font-semibold text-neutral-950">
                                {leave.studentName}: {leave.reason}
                              </p>
                              <p className="text-[11px] text-neutral-500">
                                Proof document: {leave.proofFileName} ({formatBytes(leave.proofFileSize)})
                              </p>
                            </div>

                            {leave.status === 'Pending' ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleReviewLeave(mtg.meetingId, leave.leaveId, 'Approved')
                                  }
                                  className="px-2.5 py-1 rounded bg-neutral-950 text-white font-semibold text-xs"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleReviewLeave(mtg.meetingId, leave.leaveId, 'Declined')
                                  }
                                  className="px-2.5 py-1 rounded border border-neutral-300 text-neutral-700 font-semibold text-xs"
                                >
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <span className="font-semibold text-neutral-800">
                                {leave.status}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 4. RESOURCES VIEW */}
      {activeTab === 'resources' && (
        <div className="space-y-6 max-w-3xl">
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Add Cohort Learning Resource
            </h2>
            <form onSubmit={handleAddResource} className="flex gap-2">
              <input
                type="text"
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                placeholder="e.g. System Design Handbook"
                className="flex-1 border border-neutral-300 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-neutral-950"
                required
              />
              <select
                value={resCategory}
                onChange={(e) => setResCategory(e.target.value)}
                className="border border-neutral-300 rounded-xl px-3 py-2 text-xs bg-white"
              >
                <option value="Career Prep">Career Prep</option>
                <option value="Academics">Academics</option>
                <option value="Mentoring">Mentoring</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 shrink-0"
              >
                Add Resource
              </button>
            </form>
          </section>

          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Shared Cohort Repository
            </h2>
            <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
              {scoped.resources.map((res) => (
                <li
                  key={res.resourceId}
                  className="p-3.5 flex items-center justify-between text-xs hover:bg-neutral-50"
                >
                  <div>
                    <p className="font-bold text-neutral-950">{res.title}</p>
                    <p className="text-[11px] text-neutral-500">
                      Category: {res.category} · Added by {res.addedBy}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 text-[11px] font-semibold">
                    {res.urlLabel}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* 5. REQUESTS INBOX VIEW */}
      {activeTab === 'requests' && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs max-w-4xl">
          <h2 className="font-display text-lg font-bold text-neutral-950">
            Student Volunteering Requests Board
          </h2>

          <div className="space-y-3">
            {scoped.openVolunteeringRequests.map((req) => (
              <div
                key={req.requestId}
                className="p-4 border border-neutral-200 rounded-xl space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-neutral-950">{req.title}</p>
                    <p className="text-[11px] text-neutral-600">
                      Regions: {req.regions.join(', ')} · Window: {req.dateWindow}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-neutral-500">
                    Opted-in: {req.optedInVolunteers.length} scholars
                  </span>
                </div>

                {!req.assignedToPersonId && roster.length > 0 && (
                  <div className="pt-2 border-t border-neutral-100 flex items-center gap-2">
                    <span className="text-neutral-500">Assign to scholar:</span>
                    <select
                      onChange={(e) =>
                        handleAssignVolunteerRequest(req.requestId, e.target.value)
                      }
                      defaultValue=""
                      className="border border-neutral-300 rounded-lg px-2.5 py-1 text-xs bg-white"
                    >
                      <option value="" disabled>
                        Choose scholar...
                      </option>
                      {roster.map((s) => (
                        <option key={s.personId} value={s.personId}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {req.assignedToPersonId && (
                  <p className="text-xs font-semibold text-neutral-800">
                    Assigned to: {req.assignedToName}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
