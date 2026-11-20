import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  AlertCircle,
  Check,
  Clock,
  FileText,
  KeyRound,
  ShieldCheck,
  Upload,
  UserCheck,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { DEFAULT_APPLICATION_ANSWERS } from '../core/reducer';
import type { ApplicantScopedView } from '../core/scoping';
import type { AppendEventInput } from '../core/store';
import {
  DISTRICTS_8,
  type ApplicationAnswers,
  type LifecycleStage,
} from '../core/types';
import {
  applicationSchema,
  formatBytes,
  validateUploadFile,
} from '../core/validation';

interface ApplicantScreenProps {
  scoped: ApplicantScopedView;
  actorName: string;
  onUpdateSessionName: (name: string) => void;
  onAppend: (input: AppendEventInput) => void;
}

const STAGES: Array<{ id: LifecycleStage; label: string }> = [
  { id: 'application', label: 'Application' },
  { id: 'tele_verification', label: 'Tele-verification' },
  { id: 'physical_verification', label: 'Physical verification' },
  { id: 'panel_interview', label: 'Offline panel interview' },
  { id: 'selected', label: 'Selected' },
];

const REQUIRED_DOC_OPTIONS = [
  '10th Marksheet',
  '12th Marksheet',
  'Income Certificate',
  'Address Proof',
  'One House Photo',
] as const;

export const ApplicantScreen: React.FC<ApplicantScreenProps> = ({
  scoped,
  actorName,
  onUpdateSessionName,
  onAppend,
}) => {
  const activePerson = scoped.ownProfile;
  const activeCycle = scoped.activeCycle;

  const [email, setEmail] = useState<string>(activePerson?.email || '');
  const [region, setRegion] = useState<string>(
    activePerson && (DISTRICTS_8 as readonly string[]).includes(activePerson.region)
      ? activePerson.region
      : DISTRICTS_8[0]
  );
  const [bannerMsg, setBannerMsg] = useState<string>('');
  const [docLabel, setDocLabel] = useState<string>(REQUIRED_DOC_OPTIONS[0]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<ApplicationAnswers>({
    resolver: zodResolver(applicationSchema),
    defaultValues: activePerson?.applicationAnswers || DEFAULT_APPLICATION_ANSWERS,
  });

  const deadlineIso =
    activeCycle?.applicationDeadline || '2026-12-30T23:59:00.000Z';
  const deadlineFormatted = format(new Date(deadlineIso), 'dd MMM yyyy');
  const isCycleOpen =
    Boolean(activeCycle?.isOpen) && Date.now() <= Date.parse(deadlineIso);

  useEffect(() => {
    if (activePerson) {
      reset(activePerson.applicationAnswers);
      setEmail(activePerson.email);
      setRegion(
        (DISTRICTS_8 as readonly string[]).includes(activePerson.region)
          ? activePerson.region
          : DISTRICTS_8[0]
      );
    }
  }, [activePerson?.personId, activePerson?.applicationAnswers, activePerson?.email, activePerson?.region, reset]);

  if (!activePerson) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-neutral-600">
          Your applicant profile could not be found in the event store.
        </p>
      </div>
    );
  }

  const targetPersonId = activePerson.personId;

  const handleSaveDraft = () => {
    const values = getValues();
    const actor = values.fullName.trim() || actorName;
    if (values.fullName.trim()) {
      onUpdateSessionName(values.fullName.trim());
    }
    onAppend({
      type: 'APPLICATION_DRAFT_SAVED',
      personId: targetPersonId,
      cycleId: '2026',
      actor,
      payload: {
        email,
        region,
        answers: values,
      },
    });
    setBannerMsg('Draft saved to append-only event log.');
  };

  const onValidSubmit = (values: ApplicationAnswers) => {
    if (!isCycleOpen) {
      setBannerMsg('Application cycle 2026 is closed.');
      return;
    }
    const actor = values.fullName.trim() || actorName;
    if (values.fullName.trim()) {
      onUpdateSessionName(values.fullName.trim());
    }
    onAppend({
      type: 'APPLICATION_SUBMITTED',
      personId: targetPersonId,
      cycleId: '2026',
      actor,
      payload: {
        email,
        region,
        answers: values,
      },
    });
    setBannerMsg('Application submitted and recorded in event log.');
  };

  const handleAdvanceStageDemo = () => {
    const currentIndex = STAGES.findIndex((s) => s.id === activePerson.stage);
    if (currentIndex === -1 || currentIndex >= STAGES.length - 1) return;
    const nextStage = STAGES[currentIndex + 1];

    if (nextStage.id === 'selected') {
      const code = `MTRM-2026-${String(1000 + ((scoped.eventCount * 137) % 8999))}`;
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      onAppend({
        type: 'APPLICANT_SELECTED',
        personId: activePerson.personId,
        cycleId: activePerson.cycleId,
        actor: actorName,
        payload: {
          joinCode: code,
          joinCodeExpiresAt: expiresAt,
          reason: 'Advanced via stage stepper walkthrough.',
          college: 'Pending Enrollment',
          degree: 'Undergraduate Cohort',
        },
      });
      setBannerMsg(
        `Selected! One-time join code ${code} issued (valid 48 hours).`
      );
    } else {
      onAppend({
        type: 'STAGE_ADVANCED',
        personId: activePerson.personId,
        cycleId: activePerson.cycleId,
        actor: actorName,
        payload: {
          stage: nextStage.id,
          reason: `Progressed to ${nextStage.label}.`,
        },
      });
      setBannerMsg(`Stage updated to ${nextStage.label}.`);
    }
  };

  const runSimulatedSignedUpload = (file: {
    name: string;
    type: string;
    size: number;
  }) => {
    setUploadError('');
    setUploadSuccess('');

    const check = validateUploadFile(file);
    if (!check.valid) {
      setUploadError(check.error || 'Upload rejected.');
      return;
    }

    setUploadProgress(20);
    const steps = [55, 85, 100];
    steps.forEach((pct, index) => {
      window.setTimeout(() => {
        setUploadProgress(pct);
        if (pct === 100) {
          onAppend({
            type: 'DOCUMENT_UPLOADED',
            personId: targetPersonId,
            cycleId: '2026',
            actor: actorName,
            payload: {
              docId: `DOC-${Date.now().toString(36).toUpperCase()}`,
              label: docLabel,
              fileName: file.name,
              fileType: file.type || 'application/pdf',
              fileSize: file.size,
              signedUrl: `https://signed.maatram.local/docs/${encodeURIComponent(
                file.name
              )}`,
            },
          });
          setUploadSuccess(
            `Uploaded ${docLabel} (${file.name}, ${formatBytes(file.size)}) via signed link.`
          );
          window.setTimeout(() => setUploadProgress(null), 450);
        }
      }, (index + 1) * 120);
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    runSimulatedSignedUpload({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    e.target.value = '';
  };

  const currentStageIndex = STAGES.findIndex((s) => s.id === activePerson.stage);

  return (
    <div className="space-y-8">
      {/* Header Card with ONE offset #FFC20E block */}
      <div className="relative pr-2 pb-2">
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-2 translate-y-2 bg-[#FFC20E] rounded-2xl"
        />
        <section className="relative bg-white border border-neutral-950 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bg-neutral-950 text-white rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em]">
                Cycle 2026–27
              </span>
              <span className="text-xs font-semibold tabular-nums text-neutral-600">
                Deadline: {deadlineFormatted} · {isCycleOpen ? 'Open' : 'Closed'}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
              Your <span className="heading-highlight">Application</span> Portal
            </h1>
            <p className="text-sm text-neutral-600">
              Signed in as <strong>{activePerson.name}</strong> ({activePerson.personId}) · Status:{' '}
              <span className="font-mono uppercase text-xs font-semibold text-neutral-950">
                {activePerson.status}
              </span>
            </p>
          </div>

          <div className="bg-neutral-950 text-white rounded-xl px-4 py-3 shrink-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Applicant ID
            </p>
            <p className="text-lg font-mono font-bold tabular-nums stat-underline">
              {activePerson.personId}
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

      {/* Selection Pipeline Stepper */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <p className="section-kicker">APPLICATION TRACKER</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-neutral-950">
                Selection Pipeline
              </h2>
              {activePerson.addressVerificationMode && (
                <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Address Mode: {activePerson.addressVerificationMode}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-600">
              Current stage:{' '}
              <span className="font-semibold text-neutral-950">
                {activePerson.stage === 'rejected'
                  ? 'Rejected'
                  : STAGES[currentStageIndex]?.label || activePerson.stage}
              </span>
              {activePerson.shortlisted && ' · Shortlisted'}
            </p>
          </div>

          {activePerson.stage !== 'selected' &&
            activePerson.stage !== 'rejected' && (
              <button
                type="button"
                onClick={handleAdvanceStageDemo}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                Demo: Advance Stage →
              </button>
            )}
        </div>

        {activePerson.stage === 'rejected' ? (
          <div
            role="alert"
            className="p-4 rounded-xl border border-red-300 bg-red-50 text-red-950 text-sm space-y-1"
          >
            <p className="font-bold">Application Not Selected (Admin Decision)</p>
            <p>
              <span className="font-semibold">Rejection reason: </span>
              {activePerson.rejectionReason || 'Not specified'}
            </p>
          </div>
        ) : (
          <ol className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {STAGES.map((stage, idx) => {
              const isDone = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;

              const verifierMeta =
                stage.id === 'tele_verification'
                  ? {
                      name: activePerson.verifiers.teleVerifierName || 'Meera',
                      status: activePerson.verifiers.teleStatus,
                    }
                  : stage.id === 'physical_verification'
                    ? {
                        name:
                          activePerson.verifiers.physicalVerifierName || 'Priya',
                        status: activePerson.verifiers.physicalStatus,
                      }
                    : null;

              return (
                <li
                  key={stage.id}
                  className={`rounded-xl border px-3.5 py-3.5 flex flex-col justify-between gap-2 ${
                    isCurrent
                      ? 'border-neutral-950 bg-white border-b-4 border-b-[#FFC20E]'
                      : isDone
                        ? 'border-neutral-950 bg-neutral-950 text-white'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                        isCurrent
                          ? 'bg-[#FFC20E] text-neutral-950'
                          : isDone
                            ? 'bg-white text-neutral-950'
                            : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                    <span className="text-xs font-semibold leading-tight">
                      {stage.label}
                    </span>
                  </div>

                  {verifierMeta && (
                    <div
                      className={`text-[11px] flex items-center gap-1 pt-1.5 border-t ${
                        isDone
                          ? 'border-neutral-800 text-neutral-300'
                          : 'border-neutral-200 text-neutral-700'
                      }`}
                    >
                      <UserCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        Verifier: <strong>{verifierMeta.name}</strong> ·{' '}
                        {verifierMeta.status}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {/* Address Verification Tracker Strip */}
        <div className="border border-neutral-200 bg-neutral-50 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div>
            <span className="font-semibold text-neutral-950">
              Address Proof & Verification Mode:{' '}
            </span>
            {activePerson.addressVerificationMode ? (
              <span className="font-semibold text-neutral-950">
                {activePerson.addressVerificationMode} (assigned by Admin)
              </span>
            ) : activePerson.documents.some((d) => d.label === 'Address Proof') ? (
              <span className="text-neutral-700">
                Address Proof submitted — awaiting Admin mode choice (Online panel or Physical verification)
              </span>
            ) : (
              <span className="text-neutral-500">
                Upload Address Proof so Admin can choose Online panel or Physical verification
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] text-neutral-600 shrink-0">
            Alumni verifiers: {activePerson.verifiers.teleVerifierName || 'Meera'} (Tele) ·{' '}
            {activePerson.verifiers.physicalVerifierName || 'Priya'} (Physical)
          </span>
        </div>

        {/* Join Code Banner on Selection */}
        {activePerson.stage === 'selected' && activePerson.joinCode && (
          <div className="border border-neutral-950 bg-neutral-950 text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#FFC20E]" aria-hidden="true" />
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-300">
                  One-Time Workspace Join Code (Expires in 48 hours)
                </span>
              </div>
              <p className="text-2xl font-bold tracking-[0.08em] tabular-nums text-white stat-underline">
                {activePerson.joinCode}
              </p>
              <p className="text-xs text-neutral-300 font-semibold tabular-nums pt-1">
                Valid until:{' '}
                {activePerson.joinCodeExpiresAt
                  ? format(
                      new Date(activePerson.joinCodeExpiresAt),
                      'dd MMM yyyy, HH:mm'
                    )
                  : '48h from selection'}
                {activePerson.anchorId
                  ? ` · Redeemed by Anchor ${activePerson.anchorId}`
                  : ' · Share with your Anchor in Anchor Workspace'}
              </p>
            </div>
            <span className="bg-white text-neutral-950 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap shrink-0 self-start sm:self-center">
              {activePerson.anchorId ? 'Onboarded to Roster' : 'Ready to Redeem'}
            </span>
          </div>
        )}
      </section>

      {/* Main Two-Column Grid: 7-Question Form (7 cols) + Documents & Timeline (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 7-Question Application Form (Exactly ONE yellow Primary CTA here) */}
        <form
          onSubmit={handleSubmit(onValidSubmit)}
          className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl p-6 space-y-5 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div>
              <p className="section-kicker">CYCLE 2026–27 FORM</p>
              <h2 className="font-display text-xl font-bold text-neutral-950 mt-0.5">
                7-Question Application Form
              </h2>
              <p className="text-xs text-neutral-600">
                Save a draft anytime or submit before {deadlineFormatted}.
              </p>
            </div>
            <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold font-mono">
              {targetPersonId}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="q1-name"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                1a. Applicant Full Name
              </label>
              <input
                id="q1-name"
                type="text"
                {...register('fullName')}
                placeholder="e.g. Divya R"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
              {errors.fullName && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="q1-school"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                1b. School Name
              </label>
              <input
                id="q1-school"
                type="text"
                {...register('schoolName')}
                placeholder="e.g. Govt HSS, Saidapet"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
              {errors.schoolName && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.schoolName.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="q2-school-type"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                2. School Type
              </label>
              <select
                id="q2-school-type"
                {...register('schoolType')}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
              >
                <option value="Government">Government</option>
                <option value="Private">Private</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="applicant-region"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                District (8 Regions)
              </label>
              <select
                id="applicant-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
              >
                {DISTRICTS_8.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="q3-tenth"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                3a. 10th Board Marks
              </label>
              <input
                id="q3-tenth"
                type="text"
                {...register('tenthMarks')}
                placeholder="e.g. 464 / 500 (92.8%)"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
              {errors.tenthMarks && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.tenthMarks.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="q3-twelfth"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                3b. 12th Board Marks
              </label>
              <input
                id="q3-twelfth"
                type="text"
                {...register('twelfthMarks')}
                placeholder="e.g. 552 / 600 (92.0%)"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
              {errors.twelfthMarks && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.twelfthMarks.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="q4-occupation"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                4. Parent / Guardian Occupation
              </label>
              <input
                id="q4-occupation"
                type="text"
                {...register('parentOccupation')}
                placeholder="e.g. Tailor"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
              {errors.parentOccupation && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.parentOccupation.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="q5-income"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                5. Family Annual Income
              </label>
              <input
                id="q5-income"
                type="text"
                {...register('familyAnnualIncome')}
                placeholder="e.g. Rs 1,35,000"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
              {errors.familyAnnualIncome && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.familyAnnualIncome.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="q6-housing"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                6. Housing Status
              </label>
              <select
                id="q6-housing"
                {...register('housingType')}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
              >
                <option value="Rented">Rented</option>
                <option value="Own">Own</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="applicant-email"
                className="block text-xs font-semibold text-neutral-800 mb-1"
              >
                Contact Email (Synthetic)
              </label>
              <input
                id="applicant-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="q7-why"
              className="block text-xs font-semibold text-neutral-800 mb-1"
            >
              7. Why Maatram?
            </label>
            <textarea
              id="q7-why"
              rows={3}
              {...register('whyMaatram')}
              placeholder="Explain your academic goals and how Maatram mentorship will help..."
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
            />
            {errors.whyMaatram && (
              <p className="text-xs text-red-600 mt-1">
                {errors.whyMaatram.message}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50 transition-colors"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={!isCycleOpen}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] disabled:opacity-50 transition-colors"
            >
              Submit Application
            </button>
          </div>
        </form>

        {/* Right Column: Document Upload + Status History Timeline */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="border-b border-neutral-200 pb-3">
              <p className="section-kicker">VERIFICATION UPLOADS</p>
              <h2 className="font-display text-lg font-bold text-neutral-950 mt-0.5">
                Verification Documents
              </h2>
              <p className="text-xs text-neutral-600">
                10th/12th marksheet, income certificate, address proof, one house photo · PDF/JPG/PNG only · Max 5 MB
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
              <label htmlFor="doc-type-label" className="sr-only">
                Document category
              </label>
              <select
                id="doc-type-label"
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                className="w-full sm:flex-1 min-w-0 border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
              >
                {REQUIRED_DOC_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>Choose File</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileInputChange}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-neutral-500">Quick test:</span>
              <button
                type="button"
                onClick={() =>
                  runSimulatedSignedUpload({
                    name: `${docLabel.toLowerCase().replace(/\s+/g, '_')}.pdf`,
                    type: 'application/pdf',
                    size: 1450000,
                  })
                }
                className="text-xs px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 font-medium"
              >
                Valid PDF (1.4 MB)
              </button>
              <button
                type="button"
                onClick={() =>
                  runSimulatedSignedUpload({
                    name: 'archive.exe',
                    type: 'application/x-msdownload',
                    size: 42000,
                  })
                }
                className="text-xs px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 font-medium"
              >
                Reject Wrong Type
              </button>
              <button
                type="button"
                onClick={() =>
                  runSimulatedSignedUpload({
                    name: 'high_res_scan.png',
                    type: 'image/png',
                    size: 6.4 * 1024 * 1024,
                  })
                }
                className="text-xs px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 font-medium"
              >
                Reject &gt; 5 MB
              </button>
            </div>

            {uploadProgress !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono tabular-nums text-neutral-700">
                  <span>Uploading via signed URL...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FFC20E] transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-900 text-xs"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div
                role="status"
                className="flex items-start gap-2 p-3 rounded-lg border border-neutral-950 bg-neutral-50 text-neutral-950 text-xs"
              >
                <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <ul className="divide-y divide-neutral-200">
              {activePerson.documents.length === 0 ? (
                <li className="py-3 text-xs text-neutral-500">
                  No documents uploaded yet.
                </li>
              ) : (
                activePerson.documents.map((doc) => (
                  <li
                    key={doc.docId}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText
                        className="w-4 h-4 text-neutral-700 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-950 truncate">
                          {doc.label} · {doc.fileName}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-neutral-500">
                          {formatBytes(doc.fileSize)} ·{' '}
                          {format(new Date(doc.uploadedAt), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                    <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                      Signed
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Status History Timeline */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="border-b border-neutral-200 pb-3">
              <p className="section-kicker">AUDIT TRAIL</p>
              <h2 className="font-display text-lg font-bold text-neutral-950 mt-0.5">
                Status History Timeline
              </h2>
              <p className="text-xs text-neutral-600">
                Append-only audit trail ordered by event timestamp
              </p>
            </div>

            <ol className="space-y-3">
              {activePerson.statusHistory.length === 0 ? (
                <li className="text-xs text-neutral-500">
                  Save draft or submit application to initialize audit trail.
                </li>
              ) : (
                activePerson.statusHistory.map((item) => (
                  <li
                    key={item.eventId}
                    className="pb-3 border-b border-neutral-100 last:border-b-0 last:pb-0 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-950">
                        {item.label}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-neutral-500 shrink-0">
                        seq #{item.seq}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                      <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="font-mono tabular-nums">
                        {format(new Date(item.occurredAt), 'dd MMM yyyy, HH:mm')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.actor}</span>
                    </div>
                    {item.note && (
                      <p className="text-xs text-neutral-600">{item.note}</p>
                    )}
                  </li>
                ))
              )}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
};
