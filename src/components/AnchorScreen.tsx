import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  BookOpen,
  CalendarCheck,
  Check,
  Flag,
  Inbox,
  KeyRound,
  Megaphone,
  MessageSquare,
  Pin,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { AnchorScopedView } from '../core/scoping';
import { PROOF_SCHOOL_OUTREACH_URL } from '../core/seed';
import type { AppendEventInput } from '../core/store';
import {
  DISTRICTS_8,
  type PersonProfile,
  type VolunteeringCategory,
} from '../core/types';

interface AnchorScreenProps {
  scoped: AnchorScopedView;
  actorName: string;
  allPersonsLookup: Record<string, PersonProfile>;
  onAppend: (input: AppendEventInput) => void;
}

export const AnchorScreen: React.FC<AnchorScreenProps> = ({
  scoped,
  actorName,
  allPersonsLookup,
  onAppend,
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
  const [resCategory] = useState('Career Prep');
  const [resLabel, setResLabel] = useState('PDF Guide');

  // Monthly private check-in
  const [checkStudentId, setCheckStudentId] = useState(
    roster[0]?.personId || 'P-2024-01'
  );
  const [checkBlocked, setCheckBlocked] = useState(false);
  const [checkResponse, setCheckResponse] = useState('');

  // Flag to admin
  const [flagSubjectId, setFlagSubjectId] = useState('');
  const [flagType, setFlagType] = useState<'malpractice' | 'achievement'>(
    'achievement'
  );
  const [flagDetails, setFlagDetails] = useState('');

  // Sampled request response
  const [sampledDrafts, setSampledDrafts] = useState<Record<string, string>>(
    {}
  );

  // Anchor own yearly renewal + mock payment
  const [willingRegion, setWillingRegion] = useState<string>(
    activeAnchor?.region || 'Chennai'
  );
  const [willingMotivation, setWillingMotivation] = useState(
    'Renewing yearly Anchor commitment to steward a cohort of 15 scholars and lead verifications.'
  );

  // Anchor direct volunteering work (goes straight to Admin)
  const [anchorWorkCategory, setAnchorWorkCategory] =
    useState<VolunteeringCategory>('school_visit');
  const [anchorWorkLocation, setAnchorWorkLocation] = useState(
    'Govt HSS, T. Nagar · Chennai'
  );
  const [anchorWorkNotes, setAnchorWorkNotes] = useState('');

  const [bannerMsg, setBannerMsg] = useState('');

  if (!activeAnchor) return null;

  // Unredeemed codes exposed only as code chips (no dossier browsing)
  const availableCodes = Object.values(allPersonsLookup)
    .filter(
      (p) =>
        p.joinCode &&
        !p.joinCodeRedeemedByAnchorId &&
        (!p.joinCodeExpiresAt || Date.parse(p.joinCodeExpiresAt) > Date.now())
    )
    .map((p) => p.joinCode as string);

  const announcements = scoped.ownAnnouncements;
  const meetings = scoped.ownMeetings;
  const resources = scoped.resources;

  const studentWorksPendingApproval = scoped.rosterVolunteeringWorks.filter(
    (w) => w.submitterRole === 'student' && w.status === 'Submitted'
  );

  const openRequests = scoped.openVolunteeringRequests;
  const sampledRequests = scoped.sampledRequestsForRoster;

  const handleRedeemJoinCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;

    if (roster.length >= scoped.rosterCap) {
      setJoinFeedback({
        ok: false,
        msg: `Roster cap reached (${roster.length}/${scoped.rosterCap}). Ask Admin to adjust the cap in Settings.`,
      });
      return;
    }

    const match = Object.values(allPersonsLookup).find(
      (p) => p.joinCode?.toUpperCase() === code
    );
    if (!match) {
      setJoinFeedback({
        ok: false,
        msg: `No selected scholar found with join code "${code}".`,
      });
      return;
    }
    if (match.joinCodeRedeemedByAnchorId) {
      setJoinFeedback({
        ok: false,
        msg: `Join code "${code}" has already been redeemed.`,
      });
      return;
    }
    if (
      match.joinCodeExpiresAt &&
      Date.parse(match.joinCodeExpiresAt) < Date.now()
    ) {
      setJoinFeedback({
        ok: false,
        msg: `Join code "${code}" expired after 48 hours.`,
      });
      return;
    }

    onAppend({
      type: 'JOIN_CODE_REDEEMED',
      personId: match.personId,
      cycleId: match.cycleId,
      actor: actorName,
      payload: {
        joinCode: code,
        anchorId: activeAnchor.personId,
      },
    });
    setJoinCodeInput('');
    setJoinFeedback({
      ok: true,
      msg: `Added ${match.name} (${match.personId}) to ${activeAnchor.name}'s roster.`,
    });
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
        initialSeenBy: [],
      },
    });
    setAnnTitle('');
    setAnnBody('');
    setAnnPinned(false);
    setBannerMsg('Announcement broadcast to your roster.');
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
        agenda: 'Cohort check-in & mentoring updates.',
      },
    });
    setMtgTitle('');
    setBannerMsg('Meeting scheduled with RSVP & attendance tracking.');
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
    setBannerMsg('Resource added to shelf.');
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
        month: 'November 2026',
        blocked: checkBlocked,
        response: checkResponse.trim(),
      },
    });
    setCheckResponse('');
    setBannerMsg('Private monthly check-in logged.');
  };

  const handleRaiseAdminFlag = (e: React.FormEvent) => {
    e.preventDefault();
    const subjectId = flagSubjectId || roster[0]?.personId;
    if (!subjectId || !flagDetails.trim()) return;
    const subjectName =
      roster.find((s) => s.personId === subjectId)?.name || subjectId;
    onAppend({
      type: 'ADMIN_FLAG_RAISED',
      personId: activeAnchor.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        flagId: `FLG-${Date.now().toString(36).toUpperCase()}`,
        subjectPersonId: subjectId,
        subjectName,
        flagType,
        details: flagDetails.trim(),
      },
    });
    setFlagDetails('');
    setBannerMsg(`Flag sent to Admin for ${subjectName}.`);
  };

  const handleSubmitAnchorWillingness = (e: React.FormEvent) => {
    e.preventDefault();
    const fee = scoped.anchorFeeAmount;
    const receiptId = `RCPT-MTRM-${String(
      100000 + ((scoped.nextSeq * 919) % 899999)
    )}`;
    onAppend({
      type: 'ANCHOR_WILLINGNESS_APPLIED',
      personId: activeAnchor.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        applicationId: `ANC-${Date.now().toString(36).toUpperCase()}`,
        motivation: willingMotivation.trim(),
        preferredRegion: willingRegion,
        feeAmount: fee,
        paymentReceiptId: receiptId,
        paidAt: new Date().toISOString(),
      },
    });
    setBannerMsg(
      `${activeAnchor.name} renewed as Anchor! Receipt ${receiptId} (Rs ${fee.toLocaleString()}) issued.`
    );
  };

  const handleAnchorSubmitWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchorWorkLocation.trim()) return;
    onAppend({
      type: 'VOLUNTEERING_WORK_SUBMITTED',
      personId: activeAnchor.personId,
      cycleId: '2026',
      actor: actorName,
      payload: {
        workId: `VW-${Date.now().toString(36).toUpperCase()}`,
        category: anchorWorkCategory,
        region: activeAnchor.region,
        location: anchorWorkLocation.trim(),
        photoUrl: PROOF_SCHOOL_OUTREACH_URL,
        notes:
          anchorWorkNotes.trim() ||
          'Anchor-led outreach/verification submitted directly to Admin queue.',
        submitterRole: 'anchor',
      },
    });
    setAnchorWorkNotes('');
    setBannerMsg(
      'Anchor volunteering work submitted straight to Admin verification queue.'
    );
  };

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
                Anchor Workspace
              </span>
              <span className="text-xs font-semibold tabular-nums text-neutral-600">
                Roster: {roster.length} of {scoped.rosterCap} scholars
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
              <span className="heading-highlight">{activeAnchor.name}</span> · {activeAnchor.region}
            </h1>
            <p className="text-sm text-neutral-600">
              Scoped cohort hub for pinned announcements, join-code onboarding, leave approvals, and volunteering sign-offs.
            </p>
          </div>

          <div className="bg-neutral-950 text-white rounded-xl px-4 py-3 shrink-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Cohort Cap
            </p>
            <p className="text-xl font-mono font-bold tabular-nums stat-underline">
              {roster.length} / {scoped.rosterCap}
            </p>
          </div>
        </section>
      </div>

      {bannerMsg && (
        <div
          role="status"
          className="bg-neutral-950 text-white rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4"
        >
          <span>{bannerMsg}</span>
          <button
            type="button"
            onClick={() => setBannerMsg('')}
            className="text-xs font-semibold text-white underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Join Code Onboarding (Primary Yellow CTA) + Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <KeyRound className="w-5 h-5 text-neutral-950" aria-hidden="true" />
            <div>
              <p className="section-kicker">ONBOARDING</p>
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Add Student by Join Code
              </h2>
            </div>
          </div>

          <form onSubmit={handleRedeemJoinCode} className="space-y-3">
            <div>
              <label
                htmlFor="join-code-input"
                className="block text-xs font-medium text-neutral-600 mb-1"
              >
                One-time 48-hour join code
              </label>
              <div className="flex gap-2">
                <input
                  id="join-code-input"
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="MTRM-2026-8492"
                  className="flex-1 min-w-0 border border-neutral-300 rounded-lg px-3 py-2 text-sm font-semibold tracking-[0.08em] tabular-nums uppercase focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] whitespace-nowrap shrink-0"
                >
                  Add Scholar
                </button>
              </div>
            </div>

            {availableCodes.length > 0 && (
              <div className="text-xs text-neutral-600 space-y-1">
                <p className="font-medium">Unredeemed join codes ready:</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setJoinCodeInput(code)}
                      className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 font-semibold tracking-[0.08em] tabular-nums text-xs"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {joinFeedback && (
              <p
                role="status"
                className={`text-xs font-medium p-2.5 rounded-xl border ${
                  joinFeedback.ok
                    ? 'border-neutral-950 bg-neutral-50 text-neutral-950'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                {joinFeedback.msg}
              </p>
            )}
          </form>

          {/* One-Tap Flag to Admin */}
          <form
            onSubmit={handleRaiseAdminFlag}
            className="border-t border-neutral-200 pt-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-neutral-950" aria-hidden="true" />
              <h3 className="text-sm font-bold text-neutral-950">
                One-Tap Flag to Admin (Malpractice / Achievement)
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Scholar to flag"
                value={flagSubjectId || roster[0]?.personId || ''}
                onChange={(e) => setFlagSubjectId(e.target.value)}
                className="w-full min-w-0 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
              >
                {roster.map((s) => (
                  <option key={s.personId} value={s.personId}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Flag category"
                value={flagType}
                onChange={(e) =>
                  setFlagType(e.target.value as 'malpractice' | 'achievement')
                }
                className="w-full min-w-0 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
              >
                <option value="achievement">Achievement</option>
                <option value="malpractice">Malpractice</option>
              </select>
            </div>
            <input
              type="text"
              aria-label="Flag details"
              value={flagDetails}
              onChange={(e) => setFlagDetails(e.target.value)}
              placeholder="Summarize achievement or malpractice concern..."
              className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl text-sm font-medium bg-neutral-950 text-white hover:bg-neutral-800"
            >
              Send Flag to Admin
            </button>
          </form>
        </section>

        {/* Roster Table */}
        <section className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-neutral-950" aria-hidden="true" />
              <div>
                <p className="section-kicker">ASSIGNED COHORT</p>
                <h2 className="font-display text-lg font-bold text-neutral-950">
                  Cohort Roster ({roster.length}/{scoped.rosterCap})
                </h2>
              </div>
            </div>
            <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold font-mono tabular-nums">
              {Math.max(0, scoped.rosterCap - roster.length)} slots open
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="py-2 pr-3 font-semibold">Scholar</th>
                  <th className="py-2 pr-3 font-semibold">Cycle</th>
                  <th className="py-2 pr-3 font-semibold">College / Degree</th>
                  <th className="py-2 pr-3 font-semibold text-right">GPA</th>
                  <th className="py-2 pr-3 font-semibold text-right">Verified Vol.</th>
                  <th className="py-2 font-semibold">Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {roster.map((student) => {
                  const latestGpa =
                    student.cgpaHistory[student.cgpaHistory.length - 1]?.gpa;
                  const volTotal =
                    student.volunteeringCounts.teleVerifications +
                    student.volunteeringCounts.physicalVerifications +
                    student.volunteeringCounts.schoolVisits;
                  return (
                    <tr key={student.personId} className="hover:bg-neutral-50">
                      <td className="py-2.5 pr-3 font-semibold text-neutral-950 whitespace-nowrap">
                        {student.name}
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-neutral-600">
                        {student.cycleId}
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-700">
                        {student.college || 'Pending'} ·{' '}
                        {student.degree || 'UG'}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-semibold">
                        {latestGpa !== undefined ? latestGpa.toFixed(2) : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                        {volTotal}
                      </td>
                      <td className="py-2.5">
                        {student.difficultyFlag?.flagged ? (
                          <span className="inline-block whitespace-nowrap bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                            {student.difficultyFlag.category}
                          </span>
                        ) : (
                          <span className="text-neutral-400">Nominal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Announcements + Meetings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <Megaphone className="w-5 h-5 text-neutral-950" aria-hidden="true" />
            <div>
              <p className="section-kicker">BROADCASTS</p>
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Announcements (&ldquo;Seen by X of {scoped.rosterCap}&rdquo;)
              </h2>
            </div>
          </div>

          <form onSubmit={handlePostAnnouncement} className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                aria-label="Announcement title"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Announcement headline"
                className="flex-1 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <select
                aria-label="Announcement category"
                value={annCategory}
                onChange={(e) => setAnnCategory(e.target.value)}
                className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
              >
                <option value="Academics">Academics</option>
                <option value="Finance">Finance</option>
                <option value="Placement">Placement</option>
                <option value="Volunteering">Volunteering</option>
              </select>
            </div>
            <textarea
              rows={2}
              aria-label="Announcement body"
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Write official update for your cohort..."
              className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={annPinned}
                  onChange={(e) => setAnnPinned(e.target.checked)}
                />
                <span>Pin announcement</span>
              </label>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
              >
                Broadcast Update
              </button>
            </div>
          </form>

          <div className="divide-y divide-neutral-200 border-t border-neutral-200 pt-2">
            {announcements.map((ann) => (
              <div key={ann.announcementId} className="py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ann.pinned && (
                      <span className="bg-neutral-950 text-white rounded-full px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1">
                        <Pin className="w-2.5 h-2.5" aria-hidden="true" />
                        <span>Pinned</span>
                      </span>
                    )}
                    <p className="text-sm font-bold text-neutral-950">
                      {ann.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onAppend({
                          type: 'ANNOUNCEMENT_PIN_TOGGLED',
                          personId: activeAnchor.personId,
                          cycleId: '2026',
                          actor: actorName,
                          payload: {
                            announcementId: ann.announcementId,
                            pinned: !ann.pinned,
                          },
                        })
                      }
                      className="px-2 py-0.5 rounded border border-neutral-300 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      {ann.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold tabular-nums">
                      Seen by {ann.seenBy.length} of {scoped.rosterCap}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-neutral-600">{ann.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Meetings */}
        <section className="lg:col-span-6 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <CalendarCheck
              className="w-5 h-5 text-neutral-950"
              aria-hidden="true"
            />
            <div>
              <p className="section-kicker">COHORT MEETINGS</p>
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Meetings, Attendance & Leave Approvals
              </h2>
            </div>
          </div>

          <form onSubmit={handleCreateMeeting} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              aria-label="Meeting title"
              value={mtgTitle}
              onChange={(e) => setMtgTitle(e.target.value)}
              placeholder="Meeting title"
              className="sm:col-span-2 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <input
              type="datetime-local"
              aria-label="Meeting time"
              value={mtgSchedule}
              onChange={(e) => setMtgSchedule(e.target.value)}
              className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
            />
            <input
              type="text"
              aria-label="Meeting location or link"
              value={mtgLocation}
              onChange={(e) => setMtgLocation(e.target.value)}
              className="sm:col-span-2 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl text-sm font-medium bg-neutral-950 text-white hover:bg-neutral-800"
            >
              Schedule
            </button>
          </form>

          <div className="space-y-4">
            {meetings.map((mtg) => {
              const goingCount = Object.values(mtg.rsvps).filter(
                (v) => v === 'going'
              ).length;
              const attendedCount = Object.values(mtg.attendance).filter(
                Boolean
              ).length;
              return (
                <div
                  key={mtg.meetingId}
                  className="border border-neutral-200 rounded-xl p-3.5 space-y-3"
                >
                  <div>
                    <p className="text-sm font-bold text-neutral-950">
                      {mtg.title}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-neutral-500">
                      {format(new Date(mtg.scheduledFor), 'dd MMM yyyy, HH:mm')} · RSVP Going:{' '}
                      {goingCount} · Attended: {attendedCount}/{roster.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {roster.map((student) => {
                      const attended = Boolean(mtg.attendance[student.personId]);
                      return (
                        <button
                          key={student.personId}
                          type="button"
                          onClick={() =>
                            onAppend({
                              type: 'MEETING_ATTENDANCE_MARKED',
                              personId: activeAnchor.personId,
                              cycleId: '2026',
                              actor: actorName,
                              payload: {
                                meetingId: mtg.meetingId,
                                studentId: student.personId,
                                attended: !attended,
                              },
                            })
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            attended
                              ? 'bg-neutral-950 text-white border-b-2 border-[#FFC20E]'
                              : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                          }`}
                        >
                          {attended && <Check className="w-3 h-3" aria-hidden="true" />}
                          <span>{student.name.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {mtg.leaveRequests.length > 0 && (
                    <div className="border-t border-neutral-200 pt-2.5 space-y-2">
                      <p className="text-xs font-bold text-neutral-800">
                        Student Leave Requests ({mtg.leaveRequests.length})
                      </p>
                      {mtg.leaveRequests.map((lr) => (
                        <div
                          key={lr.leaveId}
                          className="p-2.5 rounded-xl border border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-950">
                              {lr.studentName}
                            </p>
                            <p className="text-neutral-700">{lr.reason}</p>
                            <p className="text-[11px] font-mono text-neutral-500">
                              Proof: {lr.proofFileName}
                            </p>
                          </div>
                          {lr.status === 'Pending' ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  onAppend({
                                    type: 'MEETING_LEAVE_REVIEWED',
                                    personId: activeAnchor.personId,
                                    cycleId: '2026',
                                    actor: actorName,
                                    payload: {
                                      meetingId: mtg.meetingId,
                                      leaveId: lr.leaveId,
                                      decision: 'Approved',
                                    },
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onAppend({
                                    type: 'MEETING_LEAVE_REVIEWED',
                                    personId: activeAnchor.personId,
                                    cycleId: '2026',
                                    actor: actorName,
                                    payload: {
                                      meetingId: mtg.meetingId,
                                      leaveId: lr.leaveId,
                                      decision: 'Declined',
                                    },
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-100"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                              {lr.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Volunteering Approvals + Resource Shelf + Monthly Check-in + Sampled Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <ShieldCheck
              className="w-5 h-5 text-neutral-950"
              aria-hidden="true"
            />
            <div>
              <p className="section-kicker">ROSTER APPROVALS</p>
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Volunteering Assignment & Approval
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-700">
              Roster Student Work Awaiting Anchor Approval (Submitted → Anchor Approved)
            </h3>
            {studentWorksPendingApproval.length === 0 ? (
              <p className="text-xs text-neutral-500">
                No pending student submissions in your roster.
              </p>
            ) : (
              studentWorksPendingApproval.map((work) => (
                <div
                  key={work.workId}
                  className="border border-neutral-200 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-950">
                      {work.personName} · {work.category.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-neutral-600 truncate">
                      {work.location} ({work.region})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onAppend({
                        type: 'VOLUNTEERING_WORK_ANCHOR_APPROVED',
                        personId: activeAnchor.personId,
                        cycleId: work.cycleId,
                        actor: actorName,
                        payload: { workId: work.workId },
                      })
                    }
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 whitespace-nowrap shrink-0"
                  >
                    Approve → Admin
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-neutral-200 pt-3 space-y-2.5">
            <h3 className="text-xs font-bold text-neutral-700">
              Assign Opted-In Volunteers on Request Board
            </h3>
            {openRequests.map((req) => (
              <div
                key={req.requestId}
                className="border border-neutral-200 rounded-xl p-3 space-y-2"
              >
                <p className="text-xs font-bold text-neutral-950">
                  {req.title}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {req.optedInVolunteers.length === 0 ? (
                    <span className="text-xs text-neutral-500">
                      No opt-ins yet.
                    </span>
                  ) : (
                    req.optedInVolunteers.map((v) => (
                      <button
                        key={v.personId}
                        type="button"
                        onClick={() =>
                          onAppend({
                            type: 'VOLUNTEERING_REQUEST_ASSIGNED',
                            personId: activeAnchor.personId,
                            cycleId: '2026',
                            actor: actorName,
                            payload: {
                              requestId: req.requestId,
                              assigneeId: v.personId,
                              assigneeName: v.name,
                            },
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          req.assignedToPersonId === v.personId
                            ? 'bg-neutral-950 text-white border-b-2 border-[#FFC20E]'
                            : 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
                        }`}
                      >
                        Assign: {v.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAnchorSubmitWork}
            className="border-t border-neutral-200 pt-3 space-y-2"
          >
            <h3 className="text-xs font-bold text-neutral-700">
              Submit Anchor Field Work (Goes Straight to Admin)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Anchor work category"
                value={anchorWorkCategory}
                onChange={(e) =>
                  setAnchorWorkCategory(e.target.value as VolunteeringCategory)
                }
                className="w-full min-w-0 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
              >
                <option value="school_visit">School visit</option>
                <option value="physical_verification">
                  Physical verification
                </option>
                <option value="tele_verification">Tele-verification</option>
              </select>
              <input
                type="text"
                aria-label="Anchor work location"
                value={anchorWorkLocation}
                onChange={(e) => setAnchorWorkLocation(e.target.value)}
                className="w-full min-w-0 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                aria-label="Anchor work notes"
                value={anchorWorkNotes}
                onChange={(e) => setAnchorWorkNotes(e.target.value)}
                placeholder="Notes for Admin verification..."
                className="flex-1 min-w-0 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-neutral-950 text-white hover:bg-neutral-800 whitespace-nowrap shrink-0"
              >
                Submit to Admin
              </button>
            </div>
          </form>
        </section>

        <div className="lg:col-span-6 space-y-6">
          {/* Resource Shelf */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
              <BookOpen className="w-5 h-5 text-neutral-950" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Resource Shelf
              </h2>
            </div>

            <ul className="divide-y divide-neutral-100">
              {resources.map((res) => (
                <li
                  key={res.resourceId}
                  className="py-2 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      {res.title}
                    </p>
                    <p className="text-xs text-neutral-500">{res.urlLabel}</p>
                  </div>
                  <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                    {res.category}
                  </span>
                </li>
              ))}
            </ul>

            <form onSubmit={handleAddResource} className="flex flex-wrap gap-2 pt-2">
              <input
                type="text"
                aria-label="Resource title"
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                placeholder="Resource title"
                className="flex-1 min-w-[160px] border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                aria-label="Resource format"
                value={resLabel}
                onChange={(e) => setResLabel(e.target.value)}
                className="w-28 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-neutral-950 text-white hover:bg-neutral-800"
              >
                Add Resource
              </button>
            </form>
          </section>

          {/* Monthly Private Check-In */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
              <MessageSquare
                className="w-5 h-5 text-neutral-950"
                aria-hidden="true"
              />
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Monthly Private Check: &ldquo;Anything blocking you?&rdquo;
              </h2>
            </div>

            <div className="space-y-2">
              {scoped.rosterMonthlyChecks.map((chk) => (
                <div
                  key={chk.checkId}
                  className="border border-neutral-200 rounded-xl p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-950">
                      {chk.personName} · {chk.month}
                    </span>
                    <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {chk.blocked ? 'Blocker Reported' : 'No Blockers'}
                    </span>
                  </div>
                  <p className="text-neutral-700">{chk.response}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleLogMonthlyCheck} className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Scholar for monthly check"
                  value={checkStudentId}
                  onChange={(e) => setCheckStudentId(e.target.value)}
                  className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                >
                  {roster.map((s) => (
                    <option key={s.personId} value={s.personId}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={checkBlocked}
                    onChange={(e) => setCheckBlocked(e.target.checked)}
                  />
                  <span>Has blocker</span>
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Monthly check response"
                  value={checkResponse}
                  onChange={(e) => setCheckResponse(e.target.value)}
                  placeholder="Log scholar private check-in note..."
                  className="flex-1 min-w-0 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 shrink-0"
                >
                  Save Check
                </button>
              </div>
            </form>
          </section>

          {/* Sampled Data Requests Inbox (Roster Scoped) */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
              <Inbox className="w-5 h-5 text-neutral-950" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Sampled Data Requests Inbox (Your Roster)
              </h2>
            </div>

            {sampledRequests.length === 0 ? (
              <p className="text-xs text-neutral-500">
                No sampled data requests assigned to your roster.
              </p>
            ) : (
              sampledRequests.map((req) => {
                const firstSampledId = req.sampledPersonIds[0] || '';
                const existingResp = firstSampledId
                  ? req.responses[firstSampledId]
                  : undefined;
                return (
                  <div
                    key={req.requestId}
                    className="border border-neutral-200 rounded-xl p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="inline-block border border-neutral-300 bg-neutral-50 text-neutral-800 rounded px-2 py-0.5 text-[11px] font-semibold mb-1">
                          {req.requestType}
                        </span>
                        <p className="font-bold text-neutral-950">{req.title}</p>
                      </div>
                      <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-mono tabular-nums shrink-0">
                        Due {req.deadline}
                      </span>
                    </div>
                    <p className="text-neutral-600">{req.prompt}</p>
                    <p className="text-neutral-500 font-mono">
                      Sampled in roster: {req.sampledPersonIds.join(', ')} ({req.ratioLabel})
                    </p>
                    {existingResp ? (
                      <p className="p-2 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-900">
                        Responded: {existingResp.response}
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          aria-label={`Response for ${req.title}`}
                          value={sampledDrafts[req.requestId] || ''}
                          onChange={(e) =>
                            setSampledDrafts({
                              ...sampledDrafts,
                              [req.requestId]: e.target.value,
                            })
                          }
                          placeholder="Enter sampled verification response..."
                          className="flex-1 min-w-0 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const text = sampledDrafts[req.requestId]?.trim();
                            if (!text || !firstSampledId) return;
                            onAppend({
                              type: 'SAMPLED_REQUEST_RESPONDED',
                              personId: firstSampledId,
                              cycleId: '2026',
                              actor: actorName,
                              payload: {
                                requestId: req.requestId,
                                response: text,
                              },
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 shrink-0"
                        >
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>

      {/* Anchor Yearly Renewal & Stewardship Fee (Own Anchor Profile & Receipts Only) */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-neutral-200 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-neutral-950" aria-hidden="true" />
            <div>
              <p className="section-kicker">ANCHOR STEWARDSHIP</p>
              <h2 className="font-display text-lg font-bold text-neutral-950">
                My Yearly Anchor Renewal & Fee Receipt
              </h2>
              <p className="text-xs text-neutral-600">
                Yearly fee configured in Admin Settings (Rs {scoped.anchorFeeAmount.toLocaleString()}) with instant receipt.
              </p>
            </div>
          </div>
          <span className="bg-neutral-950 text-white rounded-full px-3 py-1 text-xs font-mono font-semibold tabular-nums self-start sm:self-center">
            Yearly Fee: Rs {scoped.anchorFeeAmount.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSubmitAnchorWillingness}
            className="lg:col-span-6 space-y-3"
          >
            <div>
              <label
                htmlFor="willing-region"
                className="block text-xs font-medium text-neutral-600 mb-1"
              >
                Preferred District ({activeAnchor.name})
              </label>
              <select
                id="willing-region"
                value={willingRegion}
                onChange={(e) => setWillingRegion(e.target.value)}
                className="w-full min-w-0 border border-neutral-300 rounded-lg px-2.5 py-2 text-sm bg-white"
              >
                {DISTRICTS_8.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={2}
              aria-label="Anchor motivation"
              value={willingMotivation}
              onChange={(e) => setWillingMotivation(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
            >
              Pay Rs {scoped.anchorFeeAmount.toLocaleString()} Yearly Renewal & Generate Receipt
            </button>
          </form>

          <div className="lg:col-span-6 space-y-2.5">
            <h3 className="text-xs font-bold text-neutral-700">
              My Issued Anchor Renewal Receipts
            </h3>
            {scoped.ownAnchorApplications.map((app) => (
              <div
                key={app.applicationId}
                className="border border-neutral-950 bg-neutral-50 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-bold text-neutral-950">
                    {app.personName} · {app.preferredRegion}
                  </p>
                  <p className="text-xs text-neutral-600">{app.motivation}</p>
                  <p className="text-[11px] font-mono tabular-nums text-neutral-500 mt-1">
                    Receipt {app.paymentReceiptId} · Paid{' '}
                    {format(new Date(app.paidAt), 'dd MMM yyyy')}
                  </p>
                </div>
                <span className="bg-neutral-950 text-white rounded-full px-3 py-1 text-xs font-mono font-bold tabular-nums shrink-0 self-start sm:self-center">
                  Rs {app.feeAmount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
