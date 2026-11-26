import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FileCheck,
  FileText,
  KeyRound,
  Lock,
  MapPin,
  Settings,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminScopedView } from '../core/scoping';
import type { AppendEventInput } from '../core/store';
import type {
  AddressVerificationMode,
  LifecycleEvent,
  SampledRequestType,
} from '../core/types';
import {
  DEMO_ADMIN_OTP,
  selectSampledCohort,
  verifyAdminOtp,
} from '../core/validation';
import { AlumniScreen } from './AlumniScreen';
import { EventLogScreen } from './EventLogScreen';

interface AdminScreenProps {
  scoped: AdminScopedView;
  actorName: string;
  onAppend: (input: AppendEventInput) => void;
  otpVerified: boolean;
  onOtpVerify: (verified: boolean) => void;
  activeTab?: string;
  onReplayFromStart?: () => void;
  onReplayFromTime?: (iso: string) => void;
  onReplayFromBookmark?: () => void;
  onSimulateDuplicate?: () => { duplicateId: string; eventCountBefore: number; eventCountAfter: number };
  onSimulateOutOfOrder?: () => LifecycleEvent;
}

const SAMPLED_REQUEST_TYPES: SampledRequestType[] = [
  'Number of verified volunteering entries',
  'Achievements sheet',
  'Event attendance',
  'CGPA snapshot',
];

export const AdminScreen: React.FC<AdminScreenProps> = ({
  scoped,
  actorName,
  onAppend,
  otpVerified,
  onOtpVerify,
  activeTab = 'applicants',
  onReplayFromStart = () => {},
  onReplayFromTime = () => {},
  onReplayFromBookmark = () => {},
  onSimulateDuplicate = () => ({ duplicateId: '', eventCountBefore: 0, eventCountAfter: 0 }),
  onSimulateOutOfOrder = () => ({} as LifecycleEvent),
}) => {
  // OTP Gate state
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  // Filters & Selection
  const [cycleFilter, setCycleFilter] = useState<'all' | '2024' | '2025' | '2026'>('all');
  const [applicantSearch, setApplicantSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [inspectingApplicantId, setInspectingApplicantId] = useState<string | null>(null);

  // Sampled request creation (4 types)
  const [sampleType, setSampleType] = useState<SampledRequestType>(
    'Number of verified volunteering entries'
  );
  const [sampleTitle, setSampleTitle] = useState(
    'Annual Scholar Verification & Progress Check (Sample 1 per 25)'
  );
  const [samplePrompt, setSamplePrompt] = useState(
    'Submit verified volunteering count summary for sampled cohort.'
  );
  const [sampleDeadline, setSampleDeadline] = useState('2026-12-10');

  // Admin Settings: Anchor Yearly Renewal Fee & Roster Cap
  const [feeSettingInput, setFeeSettingInput] = useState(
    String(scoped.anchorFeeAmount)
  );
  const [capSettingInput, setCapSettingInput] = useState(
    String(scoped.rosterCap)
  );

  useEffect(() => {
    setFeeSettingInput(String(scoped.anchorFeeAmount));
  }, [scoped.anchorFeeAmount]);

  useEffect(() => {
    setCapSettingInput(String(scoped.rosterCap));
  }, [scoped.rosterCap]);

  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  const allPersons = scoped.allPersons;

  const applicantList = useMemo(() => {
    return allPersons.filter((p) => {
      if (cycleFilter !== 'all' && p.cycleId !== cycleFilter) return false;
      const isApp = p.roles.includes('applicant') || Boolean(p.applicationSubmittedAt);
      if (!isApp) return false;
      if (applicantSearch.trim()) {
        const q = applicantSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.personId.toLowerCase().includes(q) ||
          (p.applicationCode && p.applicationCode.toLowerCase().includes(q)) ||
          p.region.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allPersons, cycleFilter, applicantSearch]);

  const [volunteeringStatusFilter, setVolunteeringStatusFilter] = useState<
    'all' | 'submitted' | 'approved' | 'verified'
  >('all');

  const allVolunteeringSubmissions = useMemo(() => {
    return [...scoped.volunteeringWorks].sort(
      (a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)
    );
  }, [scoped.volunteeringWorks]);

  const filteredVolunteeringSubmissions = useMemo(() => {
    return allVolunteeringSubmissions.filter((w) => {
      if (volunteeringStatusFilter === 'submitted') return w.status === 'Submitted';
      if (volunteeringStatusFilter === 'approved') return w.status === 'Anchor approved';
      if (volunteeringStatusFilter === 'verified') return w.status === 'Admin verified';
      return true;
    });
  }, [allVolunteeringSubmissions, volunteeringStatusFilter]);

  const yoyData = useMemo(() => {
    return (['2024', '2025', '2026'] as const).map((cid) => {
      const cycleCfg = scoped.cycles[cid];
      const cohort = allPersons.filter((p) => p.cycleId === cid);
      const liveApplicants = cohort.filter(
        (p) => p.roles.includes('applicant') || Boolean(p.applicationSubmittedAt)
      ).length;
      const liveSelected = cohort.filter(
        (p) =>
          p.roles.includes('selected') ||
          p.status === 'selected' ||
          p.status === 'student' ||
          p.status === 'alumni' ||
          p.status === 'anchor'
      ).length;
      const applicants = (cycleCfg?.baseApplicants || 0) + liveApplicants;
      const selected = (cycleCfg?.baseSelected || 0) + liveSelected;
      const rate =
        applicants > 0 ? Number(((selected / applicants) * 100).toFixed(1)) : 0;
      return {
        cycleId: cid,
        cycleLabel: `Cycle ${cid}`,
        applicants,
        selected,
        rate,
      };
    });
  }, [allPersons, scoped.cycles]);

  const statusAuditTrail = useMemo(() => {
    const statusTypes = new Set([
      'APPLICATION_SUBMITTED',
      'STAGE_ADVANCED',
      'ADDRESS_VERIFICATION_MODE_CHOSEN',
      'APPLICANT_SHORTLISTED',
      'APPLICANT_SELECTED',
      'APPLICANT_REJECTED',
      'JOIN_CODE_REDEEMED',
      'ANCHOR_WILLINGNESS_APPLIED',
      'ANCHOR_FEE_UPDATED',
      'ROSTER_CAP_UPDATED',
    ]);
    return [...scoped.events]
      .filter((e) => {
        if (!statusTypes.has(e.type)) return false;
        if (cycleFilter !== 'all' && e.cycleId !== cycleFilter) return false;
        return true;
      })
      .sort((a, b) => b.seq - a.seq);
  }, [scoped.events, cycleFilter]);

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = verifyAdminOtp(otpInput);
    if (!res.valid) {
      setOtpError(res.error || 'Invalid OTP');
      return;
    }
    setOtpError('');
    setOtpInput('');
    onOtpVerify(true);
  };

  if (!otpVerified) {
    return (
      <div className="max-w-md mx-auto py-12">
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5 shadow-xs">
          <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
            <span className="w-10 h-10 rounded-xl bg-neutral-950 text-white flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <p className="section-kicker">GOVERNANCE GATE</p>
              <h1 className="font-display text-xl font-extrabold text-neutral-950 tracking-[-0.02em]">
                Admin OTP Verification
              </h1>
              <p className="text-xs text-neutral-600">
                Audit actor logged as &ldquo;{actorName}&rdquo;
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-950 bg-neutral-950 text-white px-4 py-3 text-xs flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#FFC20E]" aria-hidden="true" />
              <span>Demo OTP hint:</span>
            </span>
            <span className="font-bold text-white tracking-[0.08em] tabular-nums">
              {DEMO_ADMIN_OTP}
            </span>
          </div>

          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-otp-input"
                className="block text-xs font-semibold text-neutral-800 mb-1.5"
              >
                Enter 6-digit OTP
              </label>
              <input
                id="admin-otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={(e) => {
                  setOtpInput(e.target.value);
                  setOtpError('');
                }}
                placeholder="123456"
                className="w-full border border-neutral-300 rounded-lg px-3.5 py-2.5 text-base font-semibold tracking-[0.08em] tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
              {otpError && (
                <p role="alert" className="text-xs text-red-600 mt-1.5 font-medium">
                  {otpError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors"
              >
                Verify & Enter Admin
              </button>
              <button
                type="button"
                onClick={() => setOtpInput(DEMO_ADMIN_OTP)}
                className="px-3 py-2.5 rounded-xl text-xs font-medium border border-neutral-950 bg-white hover:bg-neutral-50 text-neutral-950"
              >
                Fill {DEMO_ADMIN_OTP}
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  const toggleCheckbox = (pid: string) => {
    setSelectedIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const handleBulkShortlist = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((pid) => {
      const p = scoped.persons[pid];
      if (p) {
        onAppend({
          type: 'APPLICANT_SHORTLISTED',
          personId: pid,
          cycleId: p.cycleId,
          actor: actorName,
          payload: { note: 'Bulk shortlisted in Admin cohort review.' },
        });
      }
    });
    setToastMsg(`Shortlisted ${selectedIds.length} applicant(s).`);
    setSelectedIds([]);
  };

  const handleChooseAddressMode = (
    pid: string,
    mode: AddressVerificationMode
  ) => {
    const person = scoped.persons[pid];
    if (!person) return;
    onAppend({
      type: 'ADDRESS_VERIFICATION_MODE_CHOSEN',
      personId: pid,
      cycleId: person.cycleId,
      actor: actorName,
      payload: {
        mode,
        note: `Admin selected "${mode}" after reviewing Address Proof.`,
      },
    });
    setToastMsg(`Address verification mode set to "${mode}" for ${person.name}.`);
  };

  const handleSelectApplicant = (pid: string) => {
    const person = scoped.persons[pid];
    if (!person) return;
    const code = `MTRM-${person.cycleId}-${String(
      1000 + ((scoped.events.length * 173) % 8999)
    )}`;
    const expiresAt = new Date(
      Date.now() + 48 * 60 * 60 * 1000
    ).toISOString();
    onAppend({
      type: 'APPLICANT_SELECTED',
      personId: pid,
      cycleId: person.cycleId,
      actor: actorName,
      payload: {
        joinCode: code,
        joinCodeExpiresAt: expiresAt,
        reason: 'Selected by Admin review; linked student record and join code created.',
        college: 'Pending Enrollment',
        degree: 'Undergraduate Cohort',
      },
    });
    setToastMsg(`Selected ${person.name}. Join code generated.`);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetId) return;
    if (!rejectReason.trim()) {
      setRejectError('A rejection reason is required.');
      return;
    }
    const person = scoped.persons[rejectTargetId];
    onAppend({
      type: 'APPLICANT_REJECTED',
      personId: rejectTargetId,
      cycleId: person?.cycleId || '2026',
      actor: actorName,
      payload: { reason: rejectReason.trim() },
    });
    setToastMsg(`Rejected ${person?.name || rejectTargetId}.`);
    setRejectTargetId(null);
    setRejectReason('');
    setRejectError('');
  };

  const handleCreateSampledRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sampleTitle.trim() || !samplePrompt.trim()) return;
    const studentIds = allPersons
      .filter((p) => p.roles.includes('student'))
      .map((s) => s.personId);
    const sampled = selectSampledCohort(studentIds, 25, scoped.events.length);

    onAppend({
      type: 'SAMPLED_REQUEST_CREATED',
      personId: 'SYSTEM',
      cycleId: '2026',
      actor: actorName,
      payload: {
        requestId: `SR-${Date.now().toString(36).toUpperCase()}`,
        requestType: sampleType,
        title: sampleTitle.trim(),
        prompt: samplePrompt.trim(),
        deadline: sampleDeadline,
        ratioLabel: '1 per 25 scholars (2–3 per year)',
        sampledPersonIds: sampled,
      },
    });
    setToastMsg(`Sampled request dispatched to ${sampled.length} scholar(s).`);
  };

  const handleSaveFeeSetting = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.max(0, Number(feeSettingInput) || 1000);
    onAppend({
      type: 'ANCHOR_FEE_UPDATED',
      personId: 'SYSTEM',
      cycleId: '2026',
      actor: actorName,
      payload: { amount },
    });
    setToastMsg(`Anchor renewal fee set to Rs ${amount.toLocaleString()}.`);
  };

  const handleSaveCapSetting = (e: React.FormEvent) => {
    e.preventDefault();
    const cap = Math.max(1, Number(capSettingInput) || 15);
    onAppend({
      type: 'ROSTER_CAP_UPDATED',
      personId: 'SYSTEM',
      cycleId: '2026',
      actor: actorName,
      payload: { cap },
    });
    setToastMsg(`Anchor roster cap updated to ${cap} scholars.`);
  };

  // If sub-route is alumni or events, render those specialized screens directly
  if (activeTab === 'alumni') {
    return (
      <AlumniScreen
        alumniList={allPersons.filter(
          (p) => p.roles.includes('alumni') || p.careerHistory.length > 0
        )}
        actorName={actorName}
        readOnly={false}
        onAppend={onAppend}
      />
    );
  }

  if (activeTab === 'events') {
    return (
      <EventLogScreen
        events={scoped.events}
        workerBookmark={scoped.workerBookmark}
        onReplayFromStart={onReplayFromStart}
        onReplayFromTime={onReplayFromTime}
        onReplayFromBookmark={onReplayFromBookmark}
        onSimulateDuplicate={onSimulateDuplicate}
        onSimulateOutOfOrder={onSimulateOutOfOrder}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Toast Notification (Top Center with Tick Mark) */}
      {toastMsg && (
        <div
          role="status"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-neutral-950 text-white border border-neutral-800 rounded-2xl px-5 py-3 text-xs sm:text-sm flex items-center gap-3 shadow-2xl animate-fade-in max-w-[90vw] sm:max-w-md pointer-events-auto"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="leading-snug flex-1">{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg('')}
            className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors shrink-0 cursor-pointer ml-1"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. APPLICANTS TAB */}
      {activeTab === 'applicants' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
                Applicants
              </h1>
              <p className="text-sm text-neutral-600 mt-1">
                Review applicant pipeline, address verification mode, and selections.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 border border-neutral-200 bg-neutral-50 p-1 rounded-xl">
                {(['all', '2024', '2025', '2026'] as const).map((cid) => (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => setCycleFilter(cid)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      cycleFilter === cid
                        ? 'bg-neutral-950 text-white'
                        : 'text-neutral-700 hover:text-neutral-950'
                    }`}
                  >
                    {cid === 'all' ? 'All Cycles' : `Cycle ${cid}`}
                  </button>
                ))}
              </div>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkShortlist}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] whitespace-nowrap"
                >
                  Bulk Shortlist ({selectedIds.length})
                </button>
              )}
            </div>
          </div>

          {/* Search row */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search applicants by name, ID, or region..."
              value={applicantSearch}
              onChange={(e) => setApplicantSearch(e.target.value)}
              className="w-full sm:max-w-md border border-neutral-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
            />
          </div>

          {/* Reject Reason Form Modal/Inline */}
          {rejectTargetId && (
            <form
              onSubmit={handleConfirmReject}
              className="border border-neutral-950 bg-neutral-50 rounded-xl p-4 space-y-2.5"
            >
              <p className="text-sm font-bold text-neutral-950">
                Reject {scoped.persons[rejectTargetId]?.name || rejectTargetId} — Reason Required
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  aria-label="Rejection reason"
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    setRejectError('');
                  }}
                  placeholder="Enter required reason (visible to Applicant)..."
                  className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 whitespace-nowrap"
                >
                  Confirm Rejection
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectTargetId(null);
                    setRejectReason('');
                    setRejectError('');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-medium border border-neutral-950 bg-white text-neutral-950"
                >
                  Cancel
                </button>
              </div>
              {rejectError && (
                <p className="text-xs text-red-600 font-medium">{rejectError}</p>
              )}
            </form>
          )}

          {/* Applicants Table */}
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-semibold">
                    <th className="py-3 px-4 w-8">Pick</th>
                    <th className="py-3 px-4">Application Code & Applicant</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">School & Marks</th>
                    <th className="py-3 px-4">Uploaded Documents</th>
                    <th className="py-3 px-4">Address Verification Mode</th>
                    <th className="py-3 px-4">Stage & Status</th>
                    <th className="py-3 px-4 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {applicantList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-neutral-500">
                        No applicants found.
                      </td>
                    </tr>
                  ) : (
                    applicantList.map((p) => {
                      const isFinal =
                        p.stage === 'selected' || p.stage === 'rejected';
                      const hasAddressProof = p.documents.some(
                        (d) => d.label === 'Address Proof'
                      );
                      const appCode =
                        p.applicationCode ||
                        `APP-${p.cycleId}-${p.personId.replace('P-2026-', '').replace('P-', '')}`;
                      const docNames = p.documents.map((d) => d.label);

                      return (
                        <tr key={p.personId} className="hover:bg-neutral-50">
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              aria-label={`Select ${p.name}`}
                              checked={selectedIds.includes(p.personId)}
                              onChange={() => toggleCheckbox(p.personId)}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-neutral-950 bg-neutral-100 px-2 py-0.5 rounded text-[11px] border border-neutral-200">
                                {appCode}
                              </span>
                              <span className="font-semibold text-neutral-950">
                                {p.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              {p.personId} · {p.region}
                              {p.applicationAnswers.identityRef && (
                                <span className="font-mono text-neutral-400 ml-1">
                                  ({p.applicationAnswers.identityRef})
                                </span>
                              )}
                              {p.shortlisted && ' · Shortlisted'}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono tabular-nums text-neutral-800">
                              {p.cycleId === '2026'
                                ? '2026–27'
                                : p.cycleId === '2025'
                                  ? '2025–26'
                                  : '2024–25'}
                            </span>
                            <span className="block text-[10px] text-neutral-400">
                              Cycle {p.cycleId}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-neutral-900 font-medium">
                              {p.applicationAnswers.schoolName ||
                                `${p.applicationAnswers.schoolType} School`}
                            </p>
                            <p className="text-[11px] text-neutral-600">
                              10th:{' '}
                              <span className="font-mono font-semibold">
                                {p.applicationAnswers.tenthMarks || '—'}
                              </span>{' '}
                              · 12th:{' '}
                              <span className="font-mono font-semibold">
                                {p.applicationAnswers.twelfthMarks || '—'}
                              </span>
                            </p>
                            <p className="text-[10px] text-neutral-400 truncate max-w-[180px]">
                              Income: {p.applicationAnswers.familyAnnualIncome || '—'}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            {docNames.length === 0 ? (
                              <span className="text-[11px] text-neutral-400 italic">
                                No uploads
                              </span>
                            ) : (
                              <div className="space-y-1 max-w-[200px]">
                                <div className="flex flex-wrap gap-1">
                                  {docNames.slice(0, 3).map((dname, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-block px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800 text-[10px] font-medium truncate max-w-[150px]"
                                      title={dname}
                                    >
                                      {dname}
                                    </span>
                                  ))}
                                  {docNames.length > 3 && (
                                    <span className="inline-block px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 text-[10px] font-bold">
                                      +{docNames.length - 3} more
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-neutral-400 block font-mono">
                                  {docNames.length} file
                                  {docNames.length > 1 ? 's' : ''} attached
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {hasAddressProof ? (
                              <select
                                aria-label={`Address verification mode for ${p.name}`}
                                value={p.addressVerificationMode || ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleChooseAddressMode(
                                      p.personId,
                                      e.target.value as AddressVerificationMode
                                    );
                                  }
                                }}
                                className="border border-neutral-300 rounded-lg px-2 py-1 text-xs bg-white"
                              >
                                <option value="">Choose mode...</option>
                                <option value="Online panel">Online panel</option>
                                <option value="Physical verification">
                                  Physical verification
                                </option>
                              </select>
                            ) : (
                              <span className="text-[11px] text-neutral-500">
                                {p.addressVerificationMode || 'Awaiting Address Proof'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                                p.stage === 'selected'
                                  ? 'bg-neutral-950 text-white'
                                  : p.stage === 'rejected'
                                    ? 'bg-red-100 text-red-900'
                                    : 'bg-neutral-100 text-neutral-800'
                              }`}
                            >
                              {p.stage.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setInspectingApplicantId(p.personId)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 transition-colors inline-flex items-center gap-1"
                                title="View Application Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-neutral-500" />
                                <span>Details</span>
                              </button>
                              {!isFinal ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectApplicant(p.personId)}
                                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
                                  >
                                    Select
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectTargetId(p.personId);
                                      setRejectReason('');
                                      setRejectError('');
                                    }}
                                    className="px-3 py-1 rounded-lg text-xs font-medium border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : p.joinCode ? (
                                <span className="text-[11px] font-semibold tracking-[0.08em] tabular-nums text-neutral-700">
                                  {p.joinCode}
                                </span>
                              ) : (
                                <span className="text-[11px] text-neutral-500">
                                  Closed
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full Application Details Inspection Modal */}
          {inspectingApplicantId && scoped.persons[inspectingApplicantId] && (() => {
            const insp = scoped.persons[inspectingApplicantId];
            const inspAnswers = insp.applicationAnswers;
            const inspCode =
              insp.applicationCode ||
              `APP-${insp.cycleId}-${insp.personId.replace('P-2026-', '').replace('P-', '')}`;

            return (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              >
                <div className="bg-white border border-neutral-200 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
                  {/* Modal Header */}
                  <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-neutral-950 text-white px-2.5 py-0.5 rounded-full">
                          {inspCode}
                        </span>
                        <h2 className="font-display text-xl font-bold text-neutral-950">
                          {insp.name}
                        </h2>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Academic Year {insp.cycleId === '2026' ? '2026–27' : `Cycle ${insp.cycleId}`} · Region: {insp.region} · Current Stage: <span className="font-semibold text-neutral-900">{insp.stage.replace('_', ' ')}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectingApplicantId(null)}
                      className="p-1.5 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-950 hover:bg-neutral-50"
                      aria-label="Close applicant details"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Submission & Mock Verification Notice */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <span className="text-neutral-500 block">Identity Reference</span>
                      <span className="font-mono font-semibold text-neutral-950">
                        {insp.identityRef || inspAnswers.identityRef || 'MOCK-VERIFIED'}
                      </span>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">
                        [Prototype Mock ID]
                      </span>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <span className="text-neutral-500 block">Submission Date</span>
                      <span className="font-mono text-neutral-950">
                        {insp.applicationSubmittedAt
                          ? format(new Date(insp.applicationSubmittedAt), 'dd MMM yyyy, HH:mm')
                          : 'Draft In Progress'}
                      </span>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <span className="text-neutral-500 block">Phone & OTP Status</span>
                      <span className="font-semibold text-emerald-800 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{insp.phone || inspAnswers.phone || 'Verified'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Personal & Family Information */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Personal & Household Background
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-neutral-50/50 p-4 rounded-xl border border-neutral-200">
                      <div>
                        <span className="text-neutral-500 block">Contact Email</span>
                        <span className="font-medium text-neutral-950">{insp.email}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Gender</span>
                        <span className="font-medium text-neutral-950">{inspAnswers.gender || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Date of Birth</span>
                        <span className="font-medium text-neutral-950">{inspAnswers.dob || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Housing Status</span>
                        <span className="font-medium text-neutral-950">{inspAnswers.housingType}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Father / Guardian</span>
                        <span className="font-medium text-neutral-950">{inspAnswers.fatherName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Mother / Guardian</span>
                        <span className="font-medium text-neutral-950">{inspAnswers.motherName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Parent Occupation</span>
                        <span className="font-medium text-neutral-950">{inspAnswers.parentOccupation}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Family Members</span>
                        <span className="font-medium text-neutral-950">{inspAnswers.familyMembersCount || '4'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Educational & Financial Details */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Academic Credentials & Financial Need
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-neutral-50/50 p-4 rounded-xl border border-neutral-200">
                      <div>
                        <span className="text-neutral-500 block">School Name & Type</span>
                        <span className="font-medium text-neutral-950">
                          {inspAnswers.schoolName || '—'} ({inspAnswers.schoolType})
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">10th Board Marks</span>
                        <span className="font-mono font-bold text-neutral-950">{inspAnswers.tenthMarks || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">12th Board Marks</span>
                        <span className="font-mono font-bold text-neutral-950">{inspAnswers.twelfthMarks || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Medium of Instruction</span>
                        <span className="font-medium text-neutral-950">{inspAnswers.mediumOfInstruction || 'Tamil'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Stream</span>
                        <span className="font-medium text-neutral-950">{inspAnswers.stream || 'Science'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Family Annual Income</span>
                        <span className="font-mono font-bold text-neutral-950">{inspAnswers.familyAnnualIncome}</span>
                      </div>
                    </div>

                    {inspAnswers.whyMaatram && (
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
                        <span className="text-neutral-500 font-semibold block mb-1">Statement of Need (Why Maatram):</span>
                        <p className="text-neutral-800">{inspAnswers.whyMaatram}</p>
                      </div>
                    )}
                  </div>

                  {/* Uploaded Verification Documents */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Attached Verification Documents ({insp.documents.length})
                    </h3>
                    {insp.documents.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic py-1">
                        No documents attached.
                      </p>
                    ) : (
                      <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden text-xs">
                        {insp.documents.map((doc) => (
                          <li key={doc.docId} className="p-3 flex items-center justify-between gap-3 hover:bg-neutral-50">
                            <div className="flex items-center gap-2.5">
                              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              <div>
                                <span className="font-semibold text-neutral-950">{doc.label}</span>
                                <span className="text-neutral-500 font-mono text-[11px] ml-2">
                                  {doc.fileName}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                              Verified File
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Modal Footer Decisions */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                    <span className="text-xs text-neutral-500">
                      Assigned Verifiers: Tele: {insp.verifiers.teleVerifierName || 'Meera'} · Physical: {insp.verifiers.physicalVerifierName || 'Priya'}
                    </span>
                    <div className="flex items-center gap-2">
                      {insp.stage !== 'selected' && insp.stage !== 'rejected' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectApplicant(insp.personId);
                              setInspectingApplicantId(null);
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800"
                          >
                            Select Applicant
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectingApplicantId(null);
                              setRejectTargetId(insp.personId);
                              setRejectReason('');
                              setRejectError('');
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-medium border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setInspectingApplicantId(null)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 2. CYCLES TAB (The ONLY chart in the entire app) */}
      {activeTab === 'cycles' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
                Cycles
              </h1>
              <p className="text-sm text-neutral-600 mt-1">
                Year-over-year admissions trends and cohort conversion rates.
              </p>
            </div>
          </div>

          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="border-b border-neutral-200 pb-3">
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Multi-Year Cycle Comparison
              </h2>
              <p className="text-xs text-neutral-600 mt-0.5">
                Total applicants (~12,000/year) vs selected scholars (500–700/year) across cycles.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={yoyData}
                    margin={{ top: 10, right: 16, left: 4, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="cycleLabel"
                      tick={{
                        fill: '#111827',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'Manrope', system-ui, sans-serif",
                      }}
                    />
                    <YAxis
                      tick={{
                        fill: '#4B5563',
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "'Manrope', system-ui, sans-serif",
                      }}
                      tickFormatter={(v) => Number(v).toLocaleString()}
                    />
                    <Tooltip
                      formatter={(value: unknown, name: unknown) => [
                        Number(value ?? 0).toLocaleString(),
                        String(name ?? ''),
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #E5E7EB',
                        fontSize: 12,
                        fontFamily: "'Manrope', system-ui, sans-serif",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'Manrope', system-ui, sans-serif",
                      }}
                    />
                    <Bar
                      dataKey="applicants"
                      name="Total Applicants"
                      fill="#0A0A0A"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="selected"
                      name="Selected Scholars"
                      fill="#FFC20E"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-5 grid grid-cols-1 gap-3">
                {yoyData.map((row) => (
                  <div
                    key={row.cycleId}
                    className="border border-neutral-200 rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-display text-sm font-bold text-neutral-950">
                        {row.cycleLabel}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-neutral-600 mt-0.5">
                        {row.applicants.toLocaleString()} applicants ·{' '}
                        {row.selected.toLocaleString()} selected
                      </p>
                    </div>
                    <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold tabular-nums shrink-0">
                      {row.rate}% rate
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-5">
              <h3 className="text-sm font-bold text-neutral-950 mb-3">
                Status Change Audit Trail ({statusAuditTrail.length} events)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                      <th className="py-2 pr-3">Seq</th>
                      <th className="py-2 pr-3">Cycle</th>
                      <th className="py-2 pr-3">Person</th>
                      <th className="py-2 pr-3">Transition Event</th>
                      <th className="py-2 pr-3">Actor</th>
                      <th className="py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {statusAuditTrail.slice(0, 10).map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-2 pr-3 font-mono tabular-nums text-neutral-500">
                          #{ev.seq}
                        </td>
                        <td className="py-2 pr-3 font-mono tabular-nums">
                          {ev.cycleId}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-neutral-950">
                          {scoped.persons[ev.personId]?.name || ev.personId}
                        </td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-neutral-800">
                          {ev.type}
                        </td>
                        <td className="py-2 pr-3 text-neutral-600">{ev.actor}</td>
                        <td className="py-2 font-mono tabular-nums text-neutral-500">
                          {format(new Date(ev.occurredAt), 'dd MMM yyyy, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 3. VOLUNTEERING SUBMISSIONS & APPROVAL WORKFLOW TAB */}
      {(activeTab === 'verification' || activeTab === 'volunteering') && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
                Volunteering Approvals & Verification
              </h1>
              <p className="text-sm text-neutral-600 mt-1">
                Review student volunteering submissions, track verification status, and execute approval workflows.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
                {allVolunteeringSubmissions.filter((w) => w.status === 'Submitted').length} pending approval
              </span>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-900 border border-blue-200">
                {allVolunteeringSubmissions.filter((w) => w.status === 'Anchor approved').length} approved
              </span>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
                {allVolunteeringSubmissions.filter((w) => w.status === 'Admin verified').length} verified
              </span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: `All Submissions (${allVolunteeringSubmissions.length})` },
              {
                id: 'submitted',
                label: `Pending Approval (${
                  allVolunteeringSubmissions.filter((w) => w.status === 'Submitted').length
                })`,
              },
              {
                id: 'approved',
                label: `Approved (${
                  allVolunteeringSubmissions.filter((w) => w.status === 'Anchor approved').length
                })`,
              },
              {
                id: 'verified',
                label: `Verified & Synced (${
                  allVolunteeringSubmissions.filter((w) => w.status === 'Admin verified').length
                })`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setVolunteeringStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  volunteeringStatusFilter === tab.id
                    ? 'bg-neutral-950 text-white'
                    : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredVolunteeringSubmissions.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center text-sm text-neutral-500">
              No volunteering submissions found for this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredVolunteeringSubmissions.map((work) => (
                <div
                  key={work.workId}
                  className="bg-white border border-neutral-200 rounded-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-12 shadow-xs"
                >
                  <div className="sm:col-span-4 bg-neutral-100 relative min-h-[160px]">
                    <img
                      src={work.photoUrl}
                      alt={`Verification proof for ${work.location}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="sm:col-span-8 p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              work.status === 'Admin verified'
                                ? 'bg-emerald-100 text-emerald-800'
                                : work.status === 'Anchor approved'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {work.status === 'Submitted'
                              ? 'Pending Approval'
                              : work.status === 'Anchor approved'
                              ? 'Approved'
                              : 'Admin Verified'}
                          </span>
                          <span className="bg-neutral-100 text-neutral-700 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize">
                            {work.submitterRole === 'anchor' ? 'Anchor Direct' : 'Student Submission'}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-neutral-500">
                          {work.workId}
                        </span>
                      </div>
                      <p className="text-base font-bold text-neutral-950">
                        {work.personName} · {work.category.replace('_', ' ')}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                          {work.location} ({work.region})
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          Submitted {format(new Date(work.submittedAt), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                      {work.notes && <p className="text-xs text-neutral-700">{work.notes}</p>}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100">
                      <div>
                        {work.status === 'Submitted' && (
                          <span className="text-[11px] text-neutral-500 font-medium">
                            Awaiting admin review and approval
                          </span>
                        )}
                        {work.status === 'Anchor approved' && (
                          <span className="text-[11px] text-neutral-600 font-medium">
                            Approved by {work.anchorApprovedBy || 'Admin'} · Ready for final verification
                          </span>
                        )}
                        {work.status === 'Admin verified' && (
                          <span className="text-[11px] text-emerald-700 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                            Verified by {work.verifiedBy || 'Admin'} · Counts synced to Volunteer Portal
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {work.status === 'Submitted' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onAppend({
                                  type: 'VOLUNTEERING_WORK_ANCHOR_APPROVED',
                                  personId: work.personId,
                                  cycleId: work.cycleId || '2026',
                                  actor: actorName,
                                  payload: {
                                    workId: work.workId,
                                    scholarPersonId: work.personId,
                                  },
                                });
                                setToastMsg(
                                  `Approved volunteering submission ${work.workId} for ${work.personName}.`
                                );
                              }}
                              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-neutral-300 text-neutral-900 hover:bg-neutral-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onAppend({
                                  type: 'VOLUNTEERING_WORK_VERIFIED',
                                  personId: work.personId,
                                  cycleId: work.cycleId || '2026',
                                  actor: actorName,
                                  payload: {
                                    workId: work.workId,
                                    verifiedBy: actorName,
                                  },
                                });
                                setToastMsg(
                                  `Approved & verified ${work.workId} for ${work.personName}. Counts synced.`
                                );
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b]"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Verify & Sync</span>
                            </button>
                          </>
                        )}
                        {work.status === 'Anchor approved' && (
                          <button
                            type="button"
                            onClick={() => {
                              onAppend({
                                type: 'VOLUNTEERING_WORK_VERIFIED',
                                personId: work.personId,
                                cycleId: work.cycleId || '2026',
                                actor: actorName,
                                payload: {
                                  workId: work.workId,
                                  verifiedBy: actorName,
                                },
                              });
                              setToastMsg(
                                `Verified ${work.workId} for ${work.personName}. Counts synced.`
                              );
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b]"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Verify & Sync Counts</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. SAMPLED REQUESTS TAB */}
      {activeTab === 'sampled' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
                Sampled Requests
              </h1>
              <p className="text-sm text-neutral-600 mt-1">
                Sample 1 scholar per 25 across the cohort across 4 structured audit types.
              </p>
            </div>
          </div>

          <div className="max-w-4xl space-y-6">
            <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="border-b border-neutral-200 pb-3">
                <h2 className="font-display text-base font-bold text-neutral-950">
                  Create Sampled Request (1 per 25)
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Automatically selects a random subset of scholars with a defined submission deadline.
                </p>
              </div>

              <form onSubmit={handleCreateSampledRequest} className="space-y-3">
                <div>
                  <label
                    htmlFor="sample-type-select"
                    className="block text-xs font-semibold text-neutral-700 mb-1"
                  >
                    Sampled Request Type
                  </label>
                  <select
                    id="sample-type-select"
                    value={sampleType}
                    onChange={(e) => {
                      const nextType = e.target.value as SampledRequestType;
                      setSampleType(nextType);
                      setSampleTitle(`${nextType} Audit (Sample 1 per 25)`);
                    }}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {SAMPLED_REQUEST_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="sample-title-input"
                    className="block text-xs font-semibold text-neutral-700 mb-1"
                  >
                    Title
                  </label>
                  <input
                    id="sample-title-input"
                    type="text"
                    value={sampleTitle}
                    onChange={(e) => setSampleTitle(e.target.value)}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sample-prompt-input"
                    className="block text-xs font-semibold text-neutral-700 mb-1"
                  >
                    Instructions / Prompt
                  </label>
                  <textarea
                    id="sample-prompt-input"
                    rows={2}
                    value={samplePrompt}
                    onChange={(e) => setSamplePrompt(e.target.value)}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="sample-deadline"
                      className="text-xs font-medium text-neutral-600"
                    >
                      Deadline
                    </label>
                    <input
                      id="sample-deadline"
                      type="date"
                      value={sampleDeadline}
                      onChange={(e) => setSampleDeadline(e.target.value)}
                      className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b]"
                  >
                    Dispatch Sampled Request
                  </button>
                </div>
              </form>
            </section>

            {scoped.sampledRequests.length > 0 && (
              <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 shadow-xs">
                <div className="border-b border-neutral-200 pb-3">
                  <h2 className="font-display text-base font-bold text-neutral-950">
                    Dispatched Sampled Requests ({scoped.sampledRequests.length})
                  </h2>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Cohort audit requests dispatched across anchors and scholars.
                  </p>
                </div>
                <div className="space-y-3">
                  {scoped.sampledRequests.map((sr) => (
                    <div
                      key={sr.requestId}
                      className="border border-neutral-200 rounded-xl p-4 text-xs space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-neutral-950 text-sm">{sr.title}</p>
                          <p className="text-neutral-600 mt-0.5">{sr.prompt}</p>
                        </div>
                        <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0 self-start sm:self-center">
                          {sr.ratioLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-100 text-[11px] text-neutral-500">
                        <span>Deadline: {sr.deadline}</span>
                        <span>Sampled: {sr.sampledPersonIds.length} scholar(s)</span>
                        <span>Responses: {Object.keys(sr.responses || {}).length}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* 6. SETTINGS TAB (Fee and roster cap only — No reset demo) */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
                Settings
              </h1>
              <p className="text-sm text-neutral-600 mt-1">
                Configure anchor renewal fee and cohort roster limits.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOtpVerify(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-neutral-950 bg-white text-neutral-950 hover:bg-neutral-50"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Lock Admin</span>
              </button>
            </div>
          </div>

          <div className="max-w-2xl bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-neutral-950" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-neutral-950">
                  Cohort & Anchor Parameters
                </h2>
              </div>
              <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold tabular-nums">
                Fee: Rs {scoped.anchorFeeAmount.toLocaleString()} · Cap: {scoped.rosterCap} scholars
              </span>
            </div>

            <form onSubmit={handleSaveFeeSetting} className="space-y-2">
              <label
                htmlFor="admin-anchor-fee"
                className="block text-xs font-semibold text-neutral-800"
              >
                Anchor Yearly Renewal Fee (Rs)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="admin-anchor-fee"
                  type="number"
                  min="0"
                  step="50"
                  value={feeSettingInput}
                  onChange={(e) => setFeeSettingInput(e.target.value)}
                  className="w-44 border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b]"
                >
                  Save Fee
                </button>
              </div>
              <p className="text-xs text-neutral-500">
                Determines the renewal fee displayed on the anchor portal fee invoice.
              </p>
            </form>

            <form onSubmit={handleSaveCapSetting} className="space-y-2 pt-4 border-t border-neutral-100">
              <label
                htmlFor="admin-roster-cap"
                className="block text-xs font-semibold text-neutral-800"
              >
                Anchor Cohort Roster Cap (Scholars per Anchor)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="admin-roster-cap"
                  type="number"
                  min="1"
                  max="50"
                  value={capSettingInput}
                  onChange={(e) => setCapSettingInput(e.target.value)}
                  className="w-44 border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
                >
                  Save Cap
                </button>
              </div>
              <p className="text-xs text-neutral-500">
                Maximum number of active scholars assigned to a single anchor.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};