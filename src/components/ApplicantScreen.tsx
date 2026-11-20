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

export type ApplicantTab = 'application' | 'form' | 'documents' | 'history';

interface ApplicantScreenProps {
  scoped: ApplicantScopedView;
  actorName: string;
  activeTab?: ApplicantTab;
  onUpdateSessionName: (name: string) => void;
  onAppend: (input: AppendEventInput) => void;
  showToast: (msg: string) => void;
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
  activeTab = 'application',
  onUpdateSessionName,
  onAppend,
  showToast,
}) => {
  const activePerson = scoped.ownProfile;
  const activeCycle = scoped.activeCycle;

  const [email, setEmail] = useState<string>(activePerson?.email || '');
  const [region, setRegion] = useState<string>(
    activePerson && (DISTRICTS_8 as readonly string[]).includes(activePerson.region)
      ? activePerson.region
      : DISTRICTS_8[0]
  );
  const [docLabel, setDocLabel] = useState<string>(REQUIRED_DOC_OPTIONS[0]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string>('');

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
  }, [activePerson, reset]);

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
    showToast('Draft saved successfully.');
  };

  const onValidSubmit = (values: ApplicationAnswers) => {
    if (!isCycleOpen) {
      showToast('Application cycle 2026 is closed.');
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
    showToast('Application submitted successfully.');
  };

  const runSimulatedSignedUpload = (file: {
    name: string;
    type: string;
    size: number;
  }) => {
    setUploadError('');

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
          showToast(`Uploaded ${docLabel} (${file.name}).`);
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
      {/* Page Header (No yellow offset block) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-neutral-950">
            {activeTab === 'application' && 'Application Status'}
            {activeTab === 'form' && 'Scholarship Application Form'}
            {activeTab === 'documents' && 'Verification Documents'}
            {activeTab === 'history' && 'Status History'}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            {activeTab === 'application' &&
              `Cycle 2026–27 · Deadline: ${deadlineFormatted} (${isCycleOpen ? 'Open' : 'Closed'})`}
            {activeTab === 'form' &&
              'Provide accurate household and academic details to support your scholarship review.'}
            {activeTab === 'documents' &&
              'Upload supporting marksheets and income certificates for verifier review.'}
            {activeTab === 'history' &&
              'Timeline of all stage advances and official actions recorded in your profile.'}
          </p>
        </div>
      </div>

      {/* 1. APPLICATION VIEW: Stepper, Join Code, Verifiers */}
      {activeTab === 'application' && (
        <div className="space-y-6">
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-neutral-950">
                  Selection Pipeline
                </h2>
                <p className="text-xs text-neutral-500">
                  Current stage:{' '}
                  <span className="font-semibold text-neutral-950">
                    {activePerson.stage === 'rejected'
                      ? 'Rejected'
                      : STAGES[currentStageIndex]?.label || activePerson.stage}
                  </span>
                  {activePerson.shortlisted && ' · Shortlisted'}
                </p>
              </div>

              {activePerson.addressVerificationMode && (
                <span className="bg-neutral-100 text-neutral-800 rounded-full px-3 py-1 text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mode: {activePerson.addressVerificationMode}</span>
                </span>
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
              /* Stepper: completed steps are small check circle on a thin black line */
              <div className="py-4">
                <ol className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-2">
                  {/* Thin connecting line across steps */}
                  <div
                    aria-hidden="true"
                    className="hidden md:block absolute top-4 left-6 right-6 h-[1px] bg-neutral-950 -z-0"
                  />

                  {STAGES.map((stage, idx) => {
                    const isDone = idx < currentStageIndex;
                    const isCurrent = idx === currentStageIndex;

                    return (
                      <li
                        key={stage.id}
                        className="relative z-10 flex md:flex-col items-center gap-3 md:gap-2 text-left md:text-center flex-1"
                      >
                        {/* Circle Indicator */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            isCurrent
                              ? 'bg-[#FFC20E] text-neutral-950 font-bold ring-4 ring-neutral-100'
                              : isDone
                                ? 'bg-white border border-neutral-950 text-neutral-950'
                                : 'bg-neutral-100 border border-neutral-300 text-neutral-400'
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          ) : (
                            <span className="text-xs font-mono font-bold">
                              {idx + 1}
                            </span>
                          )}
                        </div>

                        <div>
                          <p
                            className={`text-xs font-bold leading-tight ${
                              isCurrent
                                ? 'text-neutral-950'
                                : isDone
                                  ? 'text-neutral-800'
                                  : 'text-neutral-400'
                            }`}
                          >
                            {stage.label}
                          </p>
                          {isCurrent && (
                            <p className="text-[11px] text-neutral-500 font-medium">
                              In progress
                            </p>
                          )}
                          {isDone && (
                            <p className="text-[11px] text-neutral-500 font-medium">
                              Completed
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Address Verification Tracker Strip */}
            <div className="border border-neutral-200 bg-neutral-50 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-neutral-950">
                  Address Verification:{' '}
                </span>
                {activePerson.addressVerificationMode ? (
                  <span className="text-neutral-800">
                    {activePerson.addressVerificationMode} mode assigned by Admin
                  </span>
                ) : (
                  <span className="text-neutral-500">
                    Awaiting verification review
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-neutral-600 shrink-0">
                Verifiers: {activePerson.verifiers.teleVerifierName || 'Meera'} (Tele) ·{' '}
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
                      Workspace Join Code (Valid 48 hours)
                    </span>
                  </div>
                  <p className="text-2xl font-bold tracking-[0.08em] tabular-nums text-white">
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
                      : ' · Share with your Anchor'}
                  </p>
                </div>
                <span className="bg-white text-neutral-950 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap shrink-0 self-start sm:self-center">
                  {activePerson.anchorId ? 'Onboarded to Roster' : 'Ready to Redeem'}
                </span>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 2. FORM VIEW: 7-Question Scholarship Form */}
      {activeTab === 'form' && (
        <form
          onSubmit={handleSubmit(onValidSubmit)}
          className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs max-w-3xl"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Application Questions
              </h2>
              <p className="text-xs text-neutral-600">
                Save a draft anytime or submit your application before {deadlineFormatted}.
              </p>
            </div>
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
                Contact Email
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

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50 transition-colors"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={!isCycleOpen}
              className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] disabled:opacity-50 transition-colors"
            >
              Submit Application
            </button>
          </div>
        </form>
      )}

      {/* 3. DOCUMENTS VIEW */}
      {activeTab === 'documents' && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs max-w-3xl">
          <div className="border-b border-neutral-200 pb-3">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Upload Verification Documents
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              10th/12th marksheet, income certificate, address proof, house photo · PDF/JPG/PNG only · Max 5 MB
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 min-w-0">
            <select
              value={docLabel}
              onChange={(e) => setDocLabel(e.target.value)}
              className="w-full sm:flex-1 min-w-0 border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
            >
              {REQUIRED_DOC_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 cursor-pointer whitespace-nowrap shrink-0">
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>Choose Document</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileInputChange}
                className="sr-only"
              />
            </label>
          </div>

          {uploadProgress !== null && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono tabular-nums text-neutral-700">
                <span>Uploading document...</span>
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
              className="flex items-start gap-2 p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-900 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
              Uploaded Document Files
            </h3>

            {activePerson.documents.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-2">
                No documents uploaded yet.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                {activePerson.documents.map((doc) => (
                  <li
                    key={doc.docId}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
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
                    <span className="bg-neutral-100 text-neutral-800 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                      Uploaded
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* 4. STATUS HISTORY VIEW */}
      {activeTab === 'history' && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs max-w-3xl">
          <div className="border-b border-neutral-200 pb-3">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Audit Timeline
            </h2>
            <p className="text-xs text-neutral-600">
              Complete chronological history of stage advances and verification actions.
            </p>
          </div>

          <ol className="space-y-3">
            {activePerson.statusHistory.length === 0 ? (
              <li className="text-xs text-neutral-500 italic py-2">
                No history entries recorded yet.
              </li>
            ) : (
              activePerson.statusHistory.map((item) => (
                <li
                  key={item.eventId}
                  className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-950">
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
                    <span>Actor: {item.actor}</span>
                  </div>
                  {item.note && (
                    <p className="text-xs text-neutral-700 bg-white p-2 rounded-lg border border-neutral-200 mt-1">
                      {item.note}
                    </p>
                  )}
                </li>
              ))
            )}
          </ol>
        </section>
      )}
    </div>
  );
};
