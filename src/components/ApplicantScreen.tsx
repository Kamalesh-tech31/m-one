import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  FileCheck,
  FileText,
  Info,
  KeyRound,
  Lock,
  Save,
  ShieldCheck,
  Shuffle,
  Smartphone,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { DEFAULT_APPLICATION_ANSWERS } from '../core/reducer';
import { generateRandomApplicantData } from '../core/demoGenerator';
import type { ApplicantScopedView } from '../core/scoping';
import { useMaatramStore, type AppendEventInput } from '../core/store';
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

export type ApplicantTab = 'application' | 'form' | 'history';

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

const ALL_DOC_OPTIONS = [
  'Income Certificate',
  'House Rent Receipt',
  'House Tax / Property Proof',
  'Previous-Year School Fee Receipt',
  'Government School Attendance Proof',
  'Current Employment Proof',
  'Electricity Bill',
  '10th Marksheet',
  '12th Marksheet',
  'One House Photo',
  'Address Proof',
] as const;

interface SubmittedApplicantRecord {
  applicationCode: string;
  identityRef: string;
  email: string;
  phone: string;
  fullName: string;
  personId: string;
  submittedAt: string;
}

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

  // Local state
  const [email, setEmail] = useState<string>(activePerson?.email || '');
  const [region, setRegion] = useState<string>(
    activePerson && (DISTRICTS_8 as readonly string[]).includes(activePerson.region)
      ? activePerson.region
      : DISTRICTS_8[0]
  );
  const [docLabel, setDocLabel] = useState<string>(ALL_DOC_OPTIONS[0]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [activeUploadLabel, setActiveUploadLabel] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string>('');

  // Simulated OTP state (frontend demonstration only)
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtpCode, setDemoOtpCode] = useState('842106');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState<boolean>(
    Boolean(activePerson?.otpVerified || activePerson?.applicationSubmittedAt)
  );
  const [otpError, setOtpError] = useState('');

  const navigate = useNavigate();
  const logoutUser = useMaatramStore((s) => s.logoutUser);

  // Post-submission workflow state:
  // 'idle' -> 'submitted_awaiting_code' (displays "Generate a code" button) -> 'code_generated' (displays generated code + "Return to Login Screen")
  const [submissionStage, setSubmissionStage] = useState<
    'idle' | 'submitted_awaiting_code' | 'code_generated'
  >('idle');
  const [pendingAnswers, setPendingAnswers] = useState<ApplicationAnswers | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [demoAppCode, setDemoAppCode] = useState<string>(activePerson?.applicationCode || '');

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplicationAnswers>({
    resolver: zodResolver(applicationSchema),
    defaultValues: activePerson?.applicationAnswers || DEFAULT_APPLICATION_ANSWERS,
  });

  // Watch form fields for live checklist and validation gating
  const watchFullName = watch('fullName');
  const watchPhone = watch('phone');
  const watchGender = watch('gender');
  const watchDob = watch('dob');
  const watchIdentityRef = watch('identityRef');
  const watchFatherName = watch('fatherName');
  const watchMotherName = watch('motherName');
  const watchParentOccupation = watch('parentOccupation');
  const watchFamilyMembersCount = watch('familyMembersCount');
  const watchHousingType = watch('housingType') || 'Rented';
  const watchSchoolName = watch('schoolName');
  const watchSchoolType = watch('schoolType');
  const watchMediumOfInstruction = watch('mediumOfInstruction');
  const watchStream = watch('stream');
  const watchTenthMarks = watch('tenthMarks');
  const watchTwelfthMarks = watch('twelfthMarks');
  const watchFamilyAnnualIncome = watch('familyAnnualIncome');
  const watchIncomeSource = watch('incomeSource');
  const watchWhyMaatram = watch('whyMaatram');
  const watchEligibilityProofType = watch('eligibilityProofType') || 'govt_school_attendance';

  const deadlineIso =
    activeCycle?.applicationDeadline || '2026-12-30T23:59:00.000Z';
  const deadlineFormatted = format(new Date(deadlineIso), 'dd MMM yyyy');
  const isCycleOpen =
    Boolean(activeCycle?.isOpen) && Date.now() <= Date.parse(deadlineIso);

  const isApplicationSubmitted = Boolean(activePerson?.applicationSubmittedAt);

  useEffect(() => {
    if (activePerson) {
      reset(activePerson.applicationAnswers);
      setEmail(activePerson.email);
      setRegion(
        (DISTRICTS_8 as readonly string[]).includes(activePerson.region)
          ? activePerson.region
          : DISTRICTS_8[0]
      );
      if (activePerson.otpVerified || activePerson.applicationSubmittedAt) {
        setOtpVerified(true);
      }
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

  // Uploaded documents in current profile
  const uploadedDocs = activePerson.documents;
  const uploadedDocLabels = useMemo(
    () => new Set(uploadedDocs.map((d) => d.label)),
    [uploadedDocs]
  );

  const hasIncomeCert = uploadedDocLabels.has('Income Certificate');
  const hasRentOrHouseProof =
    watchHousingType === 'Own'
      ? uploadedDocLabels.has('House Tax / Property Proof') || uploadedDocLabels.has('House Rent Receipt')
      : uploadedDocLabels.has('House Rent Receipt') || uploadedDocLabels.has('House Tax / Property Proof');
  const hasEligibilityProof =
    uploadedDocLabels.has('Previous-Year School Fee Receipt') ||
    uploadedDocLabels.has('Government School Attendance Proof') ||
    uploadedDocLabels.has('Current Employment Proof') ||
    uploadedDocLabels.has('Eligibility Proof');
  const hasElectricityBill = uploadedDocLabels.has('Electricity Bill');
  const hasMarksheets =
    uploadedDocLabels.has('10th Marksheet') && uploadedDocLabels.has('12th Marksheet');
  const hasHousePhoto = uploadedDocLabels.has('One House Photo');

  // Filter status history to show only application and verification pipeline events
  const pipelineHistory = useMemo(() => {
    return activePerson.statusHistory.filter((item) => {
      const l = item.label.toLowerCase();
      // Omit documents, certificates, tenders, drafts, and other non-pipeline items
      if (
        l.includes('document') ||
        l.includes('certificate') ||
        l.includes('draft') ||
        l.includes('receipt') ||
        l.includes('tender') ||
        l.includes('renewal') ||
        l.includes('mode chosen') ||
        l.includes('verifier updated')
      ) {
        return false;
      }
      return (
        l.includes('applied') ||
        l.includes('application submitted') ||
        l.includes('stage advanced') ||
        l.includes('televerification') ||
        l.includes('tele-verification') ||
        l.includes('physical verification') ||
        l.includes('panel interview') ||
        l.includes('interview') ||
        l.includes('selected') ||
        l.includes('shortlisted') ||
        l.includes('rejected')
      );
    });
  }, [activePerson.statusHistory]);

  // Check prototype duplicate submission prevention via localStorage
  const duplicateSubmissionCheck = useMemo(() => {
    if (isApplicationSubmitted) return { isDuplicate: false };
    const ref = (watchIdentityRef || '').trim().toLowerCase();
    const em = (email || '').trim().toLowerCase();
    if (!ref && !em) return { isDuplicate: false };

    try {
      const raw = localStorage.getItem('maatram_submitted_applicants');
      if (raw) {
        const list: SubmittedApplicantRecord[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          const match = list.find((item) => {
            if (
              item.personId === targetPersonId ||
              item.applicationCode === activePerson.applicationCode
            ) {
              return false;
            }
            const matchRef =
              ref && item.identityRef && item.identityRef.trim().toLowerCase() === ref;
            const matchEmail =
              em && item.email && item.email.trim().toLowerCase() === em;
            return matchRef || matchEmail;
          });
          if (match) {
            return {
              isDuplicate: true,
              existingCode: match.applicationCode,
              reason: ref && match.identityRef.toLowerCase() === ref
                ? `Identity Reference "${watchIdentityRef}"`
                : `Email "${email}"`,
            };
          }
        }
      }
    } catch {
      // ignore
    }
    return { isDuplicate: false };
  }, [watchIdentityRef, email, targetPersonId, activePerson.applicationCode, isApplicationSubmitted]);

  // Section completeness
  const hasPersonalDetails = Boolean(
    watchFullName?.trim() &&
    email?.trim() &&
    watchPhone?.trim() &&
    watchGender &&
    watchDob &&
    region &&
    watchIdentityRef?.trim()
  );

  const hasFamilyDetails = Boolean(
    watchFatherName?.trim() &&
    watchMotherName?.trim() &&
    watchParentOccupation?.trim() &&
    watchFamilyMembersCount?.trim() &&
    watchHousingType
  );

  const hasEducationalDetails = Boolean(
    watchSchoolName?.trim() &&
    watchSchoolType &&
    watchMediumOfInstruction &&
    watchStream?.trim() &&
    watchTenthMarks?.trim() &&
    watchTwelfthMarks?.trim()
  );

  const hasFinancialDetails = Boolean(
    watchFamilyAnnualIncome?.trim() &&
    watchIncomeSource?.trim() &&
    watchWhyMaatram?.trim() &&
    (watchWhyMaatram?.trim().length || 0) >= 15
  );

  const hasAllRequiredDocs =
    hasIncomeCert &&
    hasRentOrHouseProof &&
    hasEligibilityProof &&
    hasElectricityBill &&
    hasMarksheets &&
    hasHousePhoto;

  // Strict Submit Button gating: visible only when all required checks pass
  const isReadyToSubmit =
    hasPersonalDetails &&
    hasFamilyDetails &&
    hasEducationalDetails &&
    hasFinancialDetails &&
    hasAllRequiredDocs &&
    otpVerified &&
    !duplicateSubmissionCheck.isDuplicate;

  const handleSaveDraft = () => {
    const values = getValues();
    const actor = values.fullName?.trim() || actorName;
    if (values.fullName?.trim()) {
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
        phone: values.phone || '',
        answers: values,
      },
    });

    // Also update prototype localStorage if submitted
    try {
      const raw = localStorage.getItem('maatram_submitted_applicants');
      if (raw) {
        const list: SubmittedApplicantRecord[] = JSON.parse(raw);
        const idx = list.findIndex(
          (item) =>
            item.personId === targetPersonId ||
            (activePerson.applicationCode &&
              item.applicationCode === activePerson.applicationCode)
        );
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            fullName: values.fullName?.trim() || list[idx].fullName,
            phone: values.phone?.trim() || list[idx].phone,
            email: email.trim().toLowerCase() || list[idx].email,
            identityRef: values.identityRef?.trim() || list[idx].identityRef,
          };
          localStorage.setItem('maatram_submitted_applicants', JSON.stringify(list));
        }
      }
    } catch {
      // ignore
    }

    showToast(
      isApplicationSubmitted
        ? 'Application details updated successfully.'
        : 'Draft saved successfully.'
    );
  };

  const runSimulatedSignedUpload = (
    labelToUse: string,
    file: { name: string; type: string; size: number }
  ) => {
    setUploadError('');
    setActiveUploadLabel(labelToUse);

    const check = validateUploadFile(file);
    if (!check.valid) {
      setUploadError(check.error || 'Upload rejected.');
      setActiveUploadLabel(null);
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
              label: labelToUse,
              fileName: file.name,
              fileType: file.type || 'application/pdf',
              fileSize: file.size,
              signedUrl: `https://signed.maatram.local/docs/${encodeURIComponent(
                file.name
              )}`,
            },
          });
          showToast(`Uploaded ${labelToUse} (${file.name}).`);
          window.setTimeout(() => {
            setUploadProgress(null);
            setActiveUploadLabel(null);
          }, 350);
        }
      }, (index + 1) * 100);
    });
  };

  const handleDocumentFileInput = (
    labelToUse: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    runSimulatedSignedUpload(labelToUse, {
      name: file.name,
      type: file.type,
      size: file.size,
    });
    e.target.value = '';
  };

  const handleUploadSampleDoc = (labelToUse: string, defaultName: string) => {
    runSimulatedSignedUpload(labelToUse, {
      name: defaultName,
      type: 'application/pdf',
      size: 245000 + Math.floor(Math.random() * 80000),
    });
  };

  const handleSendSimulatedOtp = () => {
    if (!watchPhone?.trim()) {
      setOtpError('Please enter a valid mobile number in Personal Details.');
      return;
    }
    const generated = String(Math.floor(100000 + Math.random() * 900000));
    setDemoOtpCode(generated);
    setOtpSent(true);
    setEnteredOtp('');
    setOtpError('');
    showToast(`Simulated OTP sent to ${watchPhone}: ${generated}`);
  };

  const handleVerifySimulatedOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredOtp.trim()) {
      setOtpError('Please enter the 6-digit OTP.');
      return;
    }
    if (enteredOtp.trim() === demoOtpCode || enteredOtp.trim() === '842106') {
      setOtpVerified(true);
      setOtpError('');
      showToast('Simulated OTP verified successfully.');
    } else {
      setOtpError(`Invalid OTP. Use demo verification code: ${demoOtpCode}`);
    }
  };

  const handleEasyFillDemoData = () => {
    setIsGeneratingDemo(true);
    const demo = generateRandomApplicantData();

    // Store generated demo application code
    setDemoAppCode(demo.applicationCode);

    // 1. Populate form answers with randomized demographic and academic data
    reset(demo.answers);

    // 2. Set contact and district info
    setEmail(demo.email);
    setRegion(demo.region);

    // 3. Update session display name
    onUpdateSessionName(demo.answers.fullName);

    // 4. Attach sample required documents matching the applicant's profile
    demo.documents.forEach((doc, idx) => {
      onAppend({
        type: 'DOCUMENT_UPLOADED',
        personId: targetPersonId,
        cycleId: '2026',
        actor: demo.answers.fullName,
        payload: {
          docId: `DOC-DEMO-${idx + 1}-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
          label: doc.label,
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileSize: doc.size,
          signedUrl: `https://signed.maatram.local/docs/${encodeURIComponent(doc.fileName)}`,
        },
      });
    });

    // 5. Complete simulated OTP verification immediately
    setDemoOtpCode(demo.otp);
    setEnteredOtp(demo.otp);
    setOtpSent(true);
    setOtpVerified(true);
    setOtpError('');

    setTimeout(() => setIsGeneratingDemo(false), 300);

    showToast(
      `Generated demo applicant: ${demo.answers.fullName} (${demo.applicationCode}) - All fields filled!`
    );
  };

  const onValidSubmit = (values: ApplicationAnswers) => {
    if (isApplicationSubmitted) {
      handleSaveDraft();
      return;
    }

    if (!isCycleOpen) {
      showToast('Application cycle 2026 is closed.');
      return;
    }

    if (duplicateSubmissionCheck.isDuplicate) {
      showToast('Duplicate submission prevented.');
      return;
    }

    if (!isReadyToSubmit) {
      showToast('Please complete all mandatory fields, documents, and OTP.');
      return;
    }

    const actor = values.fullName.trim() || actorName;
    if (values.fullName.trim()) {
      onUpdateSessionName(values.fullName.trim());
    }

    // Save answers in state; after submitting, a "Generate a code" button appears
    setPendingAnswers(values);
    setSubmissionStage('submitted_awaiting_code');
    showToast('Application submitted. Now click "Generate a code".');
  };

  const handleGenerateCode = () => {
    const values = pendingAnswers || getValues();
    const actor = values.fullName.trim() || actorName;

    // Generate prototype Application Code
    const personSuffix = targetPersonId.replace('P-2026-', '').replace('P-', '');
    const randomFour = Math.floor(1000 + Math.random() * 9000);
    const newAppCode = demoAppCode || `APP-2026-${personSuffix || String(randomFour)}`;
    const verifiedIdentityRef = values.identityRef?.trim() || `MOCK-${targetPersonId}`;

    // Store submission in prototype localStorage
    try {
      const existingRaw = localStorage.getItem('maatram_submitted_applicants');
      const existingList: SubmittedApplicantRecord[] = existingRaw
        ? JSON.parse(existingRaw)
        : [];
      const newRecord: SubmittedApplicantRecord = {
        applicationCode: newAppCode,
        identityRef: verifiedIdentityRef,
        email: email.trim().toLowerCase(),
        phone: values.phone || '',
        fullName: values.fullName.trim(),
        personId: targetPersonId,
        submittedAt: new Date().toISOString(),
      };
      const filtered = existingList.filter((item) => item.personId !== targetPersonId);
      filtered.push(newRecord);
      localStorage.setItem('maatram_submitted_applicants', JSON.stringify(filtered));
    } catch {
      // ignore
    }

    // Append event to reducer
    onAppend({
      type: 'APPLICATION_SUBMITTED',
      personId: targetPersonId,
      cycleId: '2026',
      actor,
      payload: {
        email,
        region,
        phone: values.phone || '',
        applicationCode: newAppCode,
        identityRef: verifiedIdentityRef,
        answers: {
          ...values,
          identityRef: verifiedIdentityRef,
        },
      },
    });

    setGeneratedCode(newAppCode);
    setSubmissionStage('code_generated');
    showToast(`Code generated: ${newAppCode}. Please return to login.`);
  };

  const handleReturnToLogin = () => {
    logoutUser();
    navigate('/login/applicant');
  };

  const handleCopyCode = (code: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      showToast(`Copied Application Code: ${code}`);
    }
  };

  const currentStageIndex = STAGES.findIndex((s) => s.id === activePerson.stage);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-neutral-950">
              {submissionStage !== 'idle'
                ? 'Application Submission'
                : !isApplicationSubmitted || activeTab === 'form'
                  ? 'Scholarship Application'
                  : activeTab === 'application'
                    ? 'Application Status'
                    : 'Pipeline Status History'}
            </h1>
            {(activePerson.applicationCode || demoAppCode) && (
              <span className="bg-neutral-950 text-white rounded-full px-3 py-0.5 text-xs font-mono font-bold tracking-tight">
                {activePerson.applicationCode || demoAppCode}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            {submissionStage !== 'idle'
              ? 'Application recorded. Generate and copy your unique code to return to login and view status.'
              : !isApplicationSubmitted
                ? 'Complete personal, family, educational, financial details and document uploads in one unified submission.'
                : activeTab === 'form'
                  ? 'Your submitted application is editable. Update your personal, family, educational, financial details or documents anytime.'
                  : activeTab === 'application'
                    ? `Cycle 2026–27 · Deadline: ${deadlineFormatted} (${isCycleOpen ? 'Open' : 'Closed'})`
                    : 'Chronological timeline of application and verification stage progress.'}
          </p>
        </div>
      </div>

      {/* 1. After Submitting: "Generate a code" button appears */}
      {submissionStage === 'submitted_awaiting_code' && (
        <div className="bg-white border-2 border-neutral-950 rounded-3xl p-6 sm:p-8 shadow-md space-y-5 max-w-3xl">
          <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-900 shrink-0">
              <CheckCircle2 className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-neutral-950">
                Application Details Submitted!
              </h2>
              <p className="text-xs text-neutral-600">
                Your application details and documents have been recorded. Click below to generate your unique Application Code.
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5 text-xs text-amber-950">
            <p className="font-bold">Next Step: Generate Access Code</p>
            <p className="text-amber-800">
              Generating your unique Application Code is required to sign in and view your scholarship status pipeline.
            </p>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={handleGenerateCode}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              <span>Generate a code</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. After Generating Code: Prominently displays code and "Return to Login Screen" button */}
      {submissionStage === 'code_generated' && (
        <div className="bg-white border-2 border-neutral-950 rounded-3xl p-6 sm:p-8 shadow-md space-y-6 max-w-3xl">
          <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-neutral-950">
                Application Code Generated!
              </h2>
              <p className="text-xs text-neutral-600">
                Return to the login screen and sign in with this generated code to view your application status.
              </p>
            </div>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-neutral-300 rounded-xl p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  YOUR GENERATED APPLICATION CODE
                </p>
                <p className="font-mono text-3xl font-black text-neutral-950 tracking-wider">
                  {generatedCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCode(generatedCode)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors self-start sm:self-auto"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">Next: Sign In with Generated Code</p>
              <p className="text-[11px]">
                Please return to the login screen. Sign in with your registered email (<strong>{email}</strong>) and this generated code (<strong>{generatedCode}</strong>). Once logged in, the code will grant access to view your application status pipeline.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={handleReturnToLogin}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-neutral-950 text-white hover:bg-neutral-800 shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>Return to Login Screen</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {submissionStage === 'idle' && (
        <>
          {/* 1. APPLICATION VIEW: Stepper, Join Code, Verifiers */}
          {isApplicationSubmitted && activeTab === 'application' && (
            <div className="space-y-6">
              {/* Submission status banner */}
              {activePerson.applicationCode ? (
                <div className="bg-neutral-950 text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#FFC20E]" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                        Active Scholarship Application
                      </span>
                    </div>
                    <p className="font-mono text-xl font-bold tracking-wider">
                      {activePerson.applicationCode}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Academic Cycle 2026–27 · Identity Ref: <span className="font-mono text-neutral-200">{activePerson.identityRef || 'MOCK-VERIFIED'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="bg-white/10 text-neutral-200 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold">
                      {activePerson.applicationSubmittedAt
                        ? `Submitted: ${format(new Date(activePerson.applicationSubmittedAt), 'dd MMM yyyy')}`
                        : 'Draft in Progress'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-amber-950">
                      Application Not Yet Submitted
                    </p>
                    <p className="text-amber-800 mt-0.5">
                      Please complete the combined application form, upload mandatory proofs, and complete simulated OTP verification.
                    </p>
                  </div>
                </div>
              )}

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
                  /* Stepper */
                  <div className="py-4">
                    <ol className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-2">
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
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isCurrent
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
                                className={`text-xs font-bold leading-tight ${isCurrent
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

              {/* Applicant-Filled Sections Overview with Direct Edit Access */}
              <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-neutral-950">
                      Applicant-Filled Application Details
                    </h2>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      Your submitted profile information and documents under review. You can easily edit any section.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/applicant/form')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs self-start sm:self-auto"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Application Details</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Personal Details Card */}
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        1. Personal Details
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/applicant/form')}
                        className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 underline inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    </div>
                    <div className="text-xs space-y-1">
                      <p>
                        <strong className="text-neutral-900">Name:</strong>{' '}
                        {activePerson.name || activePerson.applicationAnswers.fullName || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Email:</strong>{' '}
                        {activePerson.email || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Phone:</strong>{' '}
                        {activePerson.phone || activePerson.applicationAnswers.phone || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Gender / DOB:</strong>{' '}
                        {activePerson.applicationAnswers.gender || '—'} ·{' '}
                        {activePerson.applicationAnswers.dob || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">District / Region:</strong>{' '}
                        {activePerson.region || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Identity Reference:</strong>{' '}
                        <span className="font-mono">
                          {activePerson.identityRef || activePerson.applicationAnswers.identityRef || '—'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Family Details Card */}
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        2. Family Details
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/applicant/form')}
                        className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 underline inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    </div>
                    <div className="text-xs space-y-1">
                      <p>
                        <strong className="text-neutral-900">Father's Name:</strong>{' '}
                        {activePerson.applicationAnswers.fatherName || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Mother's Name:</strong>{' '}
                        {activePerson.applicationAnswers.motherName || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Parent Occupation:</strong>{' '}
                        {activePerson.applicationAnswers.parentOccupation || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Family Members:</strong>{' '}
                        {activePerson.applicationAnswers.familyMembersCount || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Housing Type:</strong>{' '}
                        {activePerson.applicationAnswers.housingType || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Educational Details Card */}
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        3. Educational Details
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/applicant/form')}
                        className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 underline inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    </div>
                    <div className="text-xs space-y-1">
                      <p>
                        <strong className="text-neutral-900">School:</strong>{' '}
                        {activePerson.applicationAnswers.schoolName || '—'} (
                        {activePerson.applicationAnswers.schoolType || '—'})
                      </p>
                      <p>
                        <strong className="text-neutral-900">Medium / Stream:</strong>{' '}
                        {activePerson.applicationAnswers.mediumOfInstruction || '—'} ·{' '}
                        {activePerson.applicationAnswers.stream || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">10th Marks:</strong>{' '}
                        {activePerson.applicationAnswers.tenthMarks || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">12th Marks:</strong>{' '}
                        {activePerson.applicationAnswers.twelfthMarks || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Financial Details Card */}
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        4. Financial Details
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/applicant/form')}
                        className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 underline inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    </div>
                    <div className="text-xs space-y-1">
                      <p>
                        <strong className="text-neutral-900">Annual Family Income:</strong>{' '}
                        {activePerson.applicationAnswers.familyAnnualIncome || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Income Source:</strong>{' '}
                        {activePerson.applicationAnswers.incomeSource || '—'}
                      </p>
                      <p>
                        <strong className="text-neutral-900">Why Maatram:</strong>{' '}
                        <span className="text-neutral-600 italic line-clamp-2">
                          {activePerson.applicationAnswers.whyMaatram || '—'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Document Status Section */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        5. Supporting Documents Status ({uploadedDocs.length} Uploaded)
                      </span>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Document status remains recorded from the completed form, and can be edited or replaced.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/applicant/form')}
                      className="text-xs font-bold text-neutral-900 hover:underline inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit / Replace Documents</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div
                      className={`p-2 rounded-lg border flex items-center justify-between gap-1.5 ${hasIncomeCert
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                        : 'bg-white border-neutral-200 text-neutral-500'
                        }`}
                    >
                      <span className="truncate">Income Certificate</span>
                      <span className="text-[10px] uppercase font-bold shrink-0">
                        {hasIncomeCert ? 'Uploaded' : 'Pending'}
                      </span>
                    </div>
                    <div
                      className={`p-2 rounded-lg border flex items-center justify-between gap-1.5 ${hasRentOrHouseProof
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                        : 'bg-white border-neutral-200 text-neutral-500'
                        }`}
                    >
                      <span className="truncate">Rent / Property Proof</span>
                      <span className="text-[10px] uppercase font-bold shrink-0">
                        {hasRentOrHouseProof ? 'Uploaded' : 'Pending'}
                      </span>
                    </div>
                    <div
                      className={`p-2 rounded-lg border flex items-center justify-between gap-1.5 ${hasEligibilityProof
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                        : 'bg-white border-neutral-200 text-neutral-500'
                        }`}
                    >
                      <span className="truncate">Eligibility Proof</span>
                      <span className="text-[10px] uppercase font-bold shrink-0">
                        {hasEligibilityProof ? 'Uploaded' : 'Pending'}
                      </span>
                    </div>
                    <div
                      className={`p-2 rounded-lg border flex items-center justify-between gap-1.5 ${hasElectricityBill
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                        : 'bg-white border-neutral-200 text-neutral-500'
                        }`}
                    >
                      <span className="truncate">Electricity Bill</span>
                      <span className="text-[10px] uppercase font-bold shrink-0">
                        {hasElectricityBill ? 'Uploaded' : 'Pending'}
                      </span>
                    </div>
                    <div
                      className={`p-2 rounded-lg border flex items-center justify-between gap-1.5 ${hasMarksheets
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                        : 'bg-white border-neutral-200 text-neutral-500'
                        }`}
                    >
                      <span className="truncate">10th & 12th Marks</span>
                      <span className="text-[10px] uppercase font-bold shrink-0">
                        {hasMarksheets ? 'Uploaded' : 'Pending'}
                      </span>
                    </div>
                    <div
                      className={`p-2 rounded-lg border flex items-center justify-between gap-1.5 ${hasHousePhoto
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                        : 'bg-white border-neutral-200 text-neutral-500'
                        }`}
                    >
                      <span className="truncate">House Photo</span>
                      <span className="text-[10px] uppercase font-bold shrink-0">
                        {hasHousePhoto ? 'Uploaded' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* 2. FORM VIEW: Single Combined Application Process */}
          {(!isApplicationSubmitted || activeTab === 'form') && (
            <div className="space-y-6 max-w-4xl">
              {/* Editable Application Review Banner when submitted */}
              {isApplicationSubmitted && (
                <div className="bg-neutral-900 text-white border border-neutral-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFC20E] text-neutral-950 flex items-center justify-center font-bold shrink-0">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-white">
                          Application Submitted · Editable Review Mode
                        </p>
                        <span className="bg-[#FFC20E]/20 text-[#FFC20E] border border-[#FFC20E]/30 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-bold">
                          {activePerson.applicationCode || 'APP-2026-07'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Your application details and documents can be easily edited below. All updates are saved to your review record.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs flex items-center justify-center gap-2 whitespace-nowrap self-start sm:self-auto shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              )}

              {/* Prototype Duplicate Warning */}
              {!isApplicationSubmitted && duplicateSubmissionCheck.isDuplicate && (
                <div className="p-4 rounded-2xl border border-red-300 bg-red-50 text-red-950 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-red-900 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>Duplicate Submission Prevented</span>
                  </div>
                  <p>
                    An application with matching <strong>{duplicateSubmissionCheck.reason}</strong> has already been submitted in this browser prototype under Application Code: <strong className="font-mono">{duplicateSubmissionCheck.existingCode}</strong>.
                  </p>
                  <p className="text-red-800">
                    Please change the identity reference/email or sign in with your existing Application Code.
                  </p>
                </div>
              )}

              {/* Generate Demo Application Card */}
              {submissionStage === 'idle' && (
                <div className="bg-amber-50/90 border-2 border-dashed border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFC20E] text-neutral-950 uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-neutral-950" />
                        Demo Generator
                      </span>
                      <span className="text-xs font-bold text-amber-950">
                        One-Click Demo Application Generator
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Generate realistic random dummy data for all personal, family, educational, and financial fields with safe sample document proofs and simulated OTP. Every click generates a fresh applicant profile.
                    </p>
                    {demoAppCode && (
                      <div className="flex items-center gap-2 pt-1 text-xs">
                        <span className="font-semibold text-neutral-700">Application Code:</span>
                        <span className="bg-neutral-950 text-white font-mono font-bold px-2.5 py-0.5 rounded-full text-xs">
                          {demoAppCode}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleEasyFillDemoData}
                    disabled={isGeneratingDemo}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-neutral-950 text-white hover:bg-neutral-800 active:scale-95 shadow-xs flex items-center justify-center gap-2 whitespace-nowrap self-start sm:self-auto transition-all shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Shuffle className={`w-4 h-4 text-[#FFC20E] ${isGeneratingDemo ? 'animate-spin' : ''}`} />
                    <span>Generate Demo Application</span>
                  </button>
                </div>
              )}

              {/* Progress / Readiness Checklist Bar */}
              {!isApplicationSubmitted && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                      APPLICATION READINESS CHECKLIST
                    </p>
                    <span className="text-xs font-mono font-bold text-neutral-900">
                      {[
                        hasPersonalDetails,
                        hasFamilyDetails,
                        hasEducationalDetails,
                        hasFinancialDetails,
                        hasAllRequiredDocs,
                        otpVerified,
                      ].filter(Boolean).length} / 6 Complete
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${hasPersonalDetails ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'bg-white border-neutral-200 text-neutral-500'}`}>
                      {hasPersonalDetails ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-neutral-300" />}
                      <span>1. Personal Details</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${hasFamilyDetails ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'bg-white border-neutral-200 text-neutral-500'}`}>
                      {hasFamilyDetails ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-neutral-300" />}
                      <span>2. Family Details</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${hasEducationalDetails ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'bg-white border-neutral-200 text-neutral-500'}`}>
                      {hasEducationalDetails ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-neutral-300" />}
                      <span>3. Educational Details</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${hasFinancialDetails ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'bg-white border-neutral-200 text-neutral-500'}`}>
                      {hasFinancialDetails ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-neutral-300" />}
                      <span>4. Financial Details</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${hasAllRequiredDocs ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'bg-white border-neutral-200 text-neutral-500'}`}>
                      {hasAllRequiredDocs ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-neutral-300" />}
                      <span>5. Required Documents</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${otpVerified ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'bg-white border-neutral-200 text-neutral-500'}`}>
                      {otpVerified ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-neutral-300" />}
                      <span>6. Simulated OTP</span>
                    </div>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSubmit(onValidSubmit)}
                className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-8 shadow-xs"
              >
                {/* SECTION 1: Personal Details */}
                <div className="space-y-4">
                  <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-neutral-950">
                        1. Personal Details
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Applicant identity and contact information.
                      </p>
                    </div>
                    {hasPersonalDetails && (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Validated
                      </span>
                    )}
                  </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="q2-father" className="block text-xs font-semibold text-neutral-800 mb-1">
                  Father's / Guardian's Name *
                </label>
                <input
                  id="q2-father"
                  type="text"
                  {...register('fatherName')}
                  placeholder="e.g. Rajendran M"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
              </div>

              <div>
                <label htmlFor="q2-mother" className="block text-xs font-semibold text-neutral-800 mb-1">
                  Mother's / Guardian's Name *
                </label>
                <input
                  id="q2-mother"
                  type="text"
                  {...register('motherName')}
                  placeholder="e.g. Kamala R"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
              </div>

              <div>
                <label htmlFor="q4-occupation" className="block text-xs font-semibold text-neutral-800 mb-1">
                  Parent / Guardian Occupation *
                </label>
                <input
                  id="q4-occupation"
                  type="text"
                  {...register('parentOccupation')}
                  placeholder="e.g. Daily wage tailor"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                {errors.parentOccupation && (
                  <p className="text-xs text-red-600 mt-1">{errors.parentOccupation.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="q2-members" className="block text-xs font-semibold text-neutral-800 mb-1">
                  Number of Family Members *
                </label>
                <input
                  id="q2-members"
                  type="text"
                  {...register('familyMembersCount')}
                  placeholder="e.g. 4"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="q6-housing" className="block text-xs font-semibold text-neutral-800 mb-1">
                  Housing Status *
                </label>
                <select
                  id="q6-housing"
                  {...register('housingType')}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                >
                  <option value="Rented">Rented (House rent receipt upload required)</option>
                  <option value="Own">Own (House tax / residential proof upload required)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: Educational Details */}
          <div className="space-y-4">
            <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-neutral-950">
                  3. Educational Details
                </h3>
                <p className="text-xs text-neutral-500">
                  Schooling history and board examination scores.
                </p>
              </div>
              {hasEducationalDetails && (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Validated
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="q1-school" className="block text-xs font-semibold text-neutral-800 mb-1">
                  School Name *
                </label>
                <input
                  id="q1-school"
                  type="text"
                  {...register('schoolName')}
                  placeholder="e.g. Govt Higher Secondary School, Saidapet"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                {errors.schoolName && (
                  <p className="text-xs text-red-600 mt-1">{errors.schoolName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="q2-school-type" className="block text-xs font-semibold text-neutral-800 mb-1">
                  School Type *
                </label>
                <select
                  id="q2-school-type"
                  {...register('schoolType')}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                >
                  <option value="Government">Government School</option>
                  <option value="Private">Private School</option>
                </select>
              </div>

              <div>
                <label htmlFor="q3-medium" className="block text-xs font-semibold text-neutral-800 mb-1">
                  Medium of Instruction *
                </label>
                <select
                  id="q3-medium"
                  {...register('mediumOfInstruction')}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                >
                  <option value="Tamil">Tamil</option>
                  <option value="English">English</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="q3-stream" className="block text-xs font-semibold text-neutral-800 mb-1">
                  12th Stream / Major *
                </label>
                <input
                  id="q3-stream"
                  type="text"
                  {...register('stream')}
                  placeholder="e.g. Computer Science / Maths"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
              </div>

              <div>
                <label htmlFor="q3-tenth" className="block text-xs font-semibold text-neutral-800 mb-1">
                  10th Board Marks *
                </label>
                <input
                  id="q3-tenth"
                  type="text"
                  {...register('tenthMarks')}
                  placeholder="e.g. 464 / 500 (92.8%)"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                {errors.tenthMarks && (
                  <p className="text-xs text-red-600 mt-1">{errors.tenthMarks.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="q3-twelfth" className="block text-xs font-semibold text-neutral-800 mb-1">
                  12th Board Marks *
                </label>
                <input
                  id="q3-twelfth"
                  type="text"
                  {...register('twelfthMarks')}
                  placeholder="e.g. 552 / 600 (92.0%)"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                {errors.twelfthMarks && (
                  <p className="text-xs text-red-600 mt-1">{errors.twelfthMarks.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: Financial Details */}
          <div className="space-y-4">
            <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-neutral-950">
                  4. Financial Details
                </h3>
                <p className="text-xs text-neutral-500">
                  Annual household income and need statement.
                </p>
              </div>
              {hasFinancialDetails && (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Validated
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="q5-income" className="block text-xs font-semibold text-neutral-800 mb-1">
                  Family Annual Income *
                </label>
                <input
                  id="q5-income"
                  type="text"
                  {...register('familyAnnualIncome')}
                  placeholder="e.g. Rs 95,000"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                {errors.familyAnnualIncome && (
                  <p className="text-xs text-red-600 mt-1">{errors.familyAnnualIncome.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="q5-source" className="block text-xs font-semibold text-neutral-800 mb-1">
                  Primary Income Source *
                </label>
                <input
                  id="q5-source"
                  type="text"
                  {...register('incomeSource')}
                  placeholder="e.g. Daily wage tailoring / Agricultural labour"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="q7-why" className="block text-xs font-semibold text-neutral-800 mb-1">
                  Statement of Need: Why Maatram? *
                </label>
                <textarea
                  id="q7-why"
                  rows={3}
                  {...register('whyMaatram')}
                  placeholder="Explain your household challenges and how Maatram One scholarship and mentorship will enable your higher education..."
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                {errors.whyMaatram && (
                  <p className="text-xs text-red-600 mt-1">{errors.whyMaatram.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 5: Document Uploads (Completed in the same process!) */}
          <div className="space-y-4">
            <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-neutral-950">
                  5. Supporting Documents Upload
                </h3>
                <p className="text-xs text-neutral-500">
                  All supporting documents must be completed directly in this application process.
                </p>
              </div>
              {hasAllRequiredDocs && (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> All Uploaded
                </span>
              )}
            </div>

            {uploadProgress !== null && (
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-neutral-700">
                  <span>Uploading {activeUploadLabel || 'document'}...</span>
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
              <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Income Certificate */}
              <div className="p-4 border border-neutral-200 rounded-xl space-y-2.5 bg-neutral-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-900">
                    a. Income Certificate *
                  </p>
                  {hasIncomeCert ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Uploaded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-600 text-[11px] font-medium">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">
                  Revenue department or Tahsildar issued income proof.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hasIncomeCert ? 'Replace / Upload File' : 'Choose File'}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleDocumentFileInput('Income Certificate', e)}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleUploadSampleDoc('Income Certificate', 'income_certificate_2026.pdf')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-700"
                  >
                    Sample Upload
                  </button>
                </div>
              </div>

              {/* 2. House Rent Receipt / Ownership Proof */}
              <div className="p-4 border border-neutral-200 rounded-xl space-y-2.5 bg-neutral-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-900">
                    b. House Rent Receipt / Property Proof *
                  </p>
                  {hasRentOrHouseProof ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Uploaded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-600 text-[11px] font-medium">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">
                  {watchHousingType === 'Own'
                    ? 'House tax receipt / patta copy / ownership proof.'
                    : 'Recent house rent receipt from landlord.'}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hasRentOrHouseProof ? 'Replace / Upload File' : 'Choose File'}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        handleDocumentFileInput(
                          watchHousingType === 'Own' ? 'House Tax / Property Proof' : 'House Rent Receipt',
                          e
                        )
                      }
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      handleUploadSampleDoc(
                        watchHousingType === 'Own' ? 'House Tax / Property Proof' : 'House Rent Receipt',
                        watchHousingType === 'Own' ? 'property_tax_receipt.pdf' : 'house_rent_receipt.pdf'
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-700"
                  >
                    Sample Upload
                  </button>
                </div>
              </div>

              {/* 3. Eligibility Proof (Fee / Govt School Attendance / Employment) */}
              <div className="p-4 border border-neutral-200 rounded-xl space-y-2.5 bg-neutral-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-900">
                    c. Eligibility Proof *
                  </p>
                  {hasEligibilityProof ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Uploaded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-600 text-[11px] font-medium">
                      Required
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Select proof type to provide:
                  </label>
                  <select
                    {...register('eligibilityProofType')}
                    className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                  >
                    <option value="govt_school_attendance">Government school attendance proof</option>
                    <option value="school_fee_receipt">Previous-year school fee payment proof</option>
                    <option value="employment_proof">Current employment proof</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hasEligibilityProof ? 'Replace / Upload File' : 'Choose File'}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const lbl =
                          watchEligibilityProofType === 'school_fee_receipt'
                            ? 'Previous-Year School Fee Receipt'
                            : watchEligibilityProofType === 'employment_proof'
                              ? 'Current Employment Proof'
                              : 'Government School Attendance Proof';
                        handleDocumentFileInput(lbl, e);
                      }}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const lbl =
                        watchEligibilityProofType === 'school_fee_receipt'
                          ? 'Previous-Year School Fee Receipt'
                          : watchEligibilityProofType === 'employment_proof'
                            ? 'Current Employment Proof'
                            : 'Government School Attendance Proof';
                      handleUploadSampleDoc(lbl, `${watchEligibilityProofType}_proof.pdf`);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-700"
                  >
                    Sample Upload
                  </button>
                </div>
              </div>

              {/* 4. Electricity Bill */}
              <div className="p-4 border border-neutral-200 rounded-xl space-y-2.5 bg-neutral-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-900">
                    d. Electricity Bill (EB Card / Bill) *
                  </p>
                  {hasElectricityBill ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Uploaded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-600 text-[11px] font-medium">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">
                  Latest TANGEDCO / Electricity board consumption bill.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hasElectricityBill ? 'Replace / Upload File' : 'Choose File'}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleDocumentFileInput('Electricity Bill', e)}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleUploadSampleDoc('Electricity Bill', 'electricity_bill_latest.pdf')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-700"
                  >
                    Sample Upload
                  </button>
                </div>
              </div>

              {/* 5. Marksheets (10th & 12th) */}
              <div className="p-4 border border-neutral-200 rounded-xl space-y-2.5 bg-neutral-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-900">
                    e. 10th & 12th Board Marksheets *
                  </p>
                  {hasMarksheets ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Both Uploaded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-600 text-[11px] font-medium">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">
                  Official board issued grade sheets or online results.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadedDocLabels.has('10th Marksheet') ? 'Replace 10th' : 'Upload 10th'}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleDocumentFileInput('10th Marksheet', e)}
                      className="sr-only"
                    />
                  </label>
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadedDocLabels.has('12th Marksheet') ? 'Replace 12th' : 'Upload 12th'}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleDocumentFileInput('12th Marksheet', e)}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      handleUploadSampleDoc('10th Marksheet', 'marksheet_10th.pdf');
                      handleUploadSampleDoc('12th Marksheet', 'marksheet_12th.pdf');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-700"
                  >
                    Sample Marksheets
                  </button>
                </div>
              </div>

              {/* 6. House Photo */}
              <div className="p-4 border border-neutral-200 rounded-xl space-y-2.5 bg-neutral-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-900">
                    f. One House Photo *
                  </p>
                  {hasHousePhoto ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Uploaded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-600 text-[11px] font-medium">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">
                  Front exterior photograph of residential dwelling.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hasHousePhoto ? 'Replace / Upload Photo' : 'Choose Photo'}</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={(e) => handleDocumentFileInput('One House Photo', e)}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleUploadSampleDoc('One House Photo', 'residence_front.jpg')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-700"
                  >
                    Sample Photo
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: Simulated OTP Flow (Frontend Demonstration Only) */}
          <div className="space-y-4 pt-2 border-t border-neutral-200">
            <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-neutral-950">
                  6. Phone Verification (Simulated OTP Flow)
                </h3>
                <p className="text-xs text-neutral-500">
                  Frontend demonstration only — verify applicant contact number.
                </p>
              </div>
              {otpVerified && (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Verified
                </span>
              )}
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Prototype Simulated OTP Verification</span>
              </div>
              <p className="text-xs text-amber-900">
                This simulated OTP verifies the applicant's mobile contact number for prototype demonstration without connecting an external SMS provider.
              </p>

              {otpVerified ? (
                <div className="p-3 bg-white border border-emerald-300 rounded-xl flex items-center gap-2 text-emerald-900 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ Phone Verified: {watchPhone || activePerson.phone || 'Contact authenticated'} [Mock Verification State]</span>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSendSimulatedOtp}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors"
                    >
                      {otpSent ? 'Resend Simulated OTP' : 'Send Verification OTP'}
                    </button>
                    <span className="text-xs text-neutral-600 font-mono">
                      Target Phone: <strong className="text-neutral-950">{watchPhone || 'Enter phone above'}</strong>
                    </span>
                  </div>

                  {otpSent && (
                    <div className="p-3 bg-white border border-amber-300 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-900 font-medium">
                          Simulated OTP dispatched to phone:
                        </span>
                        <span className="font-mono text-sm font-bold bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                          {demoOtpCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={enteredOtp}
                          onChange={(e) => {
                            setEnteredOtp(e.target.value);
                            setOtpError('');
                          }}
                          placeholder="Enter 6-digit OTP"
                          className="w-40 px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-mono font-bold tracking-widest text-center"
                        />
                        <button
                          type="button"
                          onClick={handleVerifySimulatedOtp}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors"
                        >
                          Verify Code
                        </button>
                      </div>
                      {otpError && (
                        <p className="text-xs text-red-600 font-medium">{otpError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 7: Actions & Submit Button Gating */}
          <div className="pt-4 border-t border-neutral-200 space-y-4">
            {!isApplicationSubmitted && (
              <>
                {!isReadyToSubmit ? (
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                      <Info className="w-4 h-4 text-neutral-500" />
                      <span>Submit Button Locked: Complete Required Verification Checks</span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      The final Submit button will appear once all mandatory personal, family, educational, financial fields, all 6 required verification documents, and the simulated OTP verification are complete.
                    </p>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50 transition-colors"
                      >
                        Save Progress as Draft
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display the final Submit button only when all required checks pass */
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div>
                      <p className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>All Application Checks Passed</span>
                      </p>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Your scholarship details, uploaded proofs, and identity reference are ready for submission.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors"
                      >
                        Save Draft
                      </button>
                      <button
                        type="submit"
                        disabled={!isCycleOpen}
                        className="px-8 py-3 rounded-xl text-sm font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] shadow-sm transition-all flex items-center gap-2"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Submit Application</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {isApplicationSubmitted && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-neutral-50 border border-neutral-300 rounded-2xl">
                <div>
                  <p className="font-bold text-sm text-neutral-950 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Application Active ({activePerson.applicationCode || activePerson.personId})</span>
                  </p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Your applicant details and documents are editable. Click below to save any changes to your application.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4 stroke-[2.5]" />
                  <span>Save & Update Application</span>
                </button>
              </div>
            )}
          </div>
        </form>
    </div>
  )
}

{/* 3. STATUS HISTORY VIEW */ }
{
  isApplicationSubmitted && activeTab === 'history' && (
    <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs max-w-3xl">
      <div className="border-b border-neutral-200 pb-3">
        <h2 className="font-display text-lg font-bold text-neutral-950">
          Pipeline Status History
        </h2>
        <p className="text-xs text-neutral-600">
          Chronological progress of application and verification stages.
        </p>
      </div>

      <ol className="space-y-3">
        {pipelineHistory.length === 0 ? (
          <li className="text-xs text-neutral-500 italic py-2">
            No pipeline status entries recorded yet.
          </li>
        ) : (
          pipelineHistory.map((item) => (
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
  )
}
        </>
      )}
    </div >
  );
};
