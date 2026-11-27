import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  Edit3,
  Eye,
  FileCheck,
  FileCheck2,
  FileText,
  Info,
  KeyRound,
  Lock,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { DEFAULT_APPLICATION_ANSWERS } from '../core/reducer';
import {
  createSafeDemoFile,
  generateDemoEducationalDetails,
  generateDemoFamilyDetails,
  generateDemoFinancialDetails,
  generateDemoPersonalDetails,
} from '../core/demoGenerator';
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
import {
  getApplicantApplication,
  saveDraftApplication,
  submitApplicantApplication,
  updateApplicantApplication,
} from '../core/applicantAuth';

export type ApplicantTab =
  | 'application'
  | 'form'
  | 'history'
  | 'edit'
  | 'apply-now'
  | 'resume';

interface ApplicantScreenProps {
  scoped: ApplicantScopedView;
  actorName: string;
  activeTab?: ApplicantTab;
  targetSection?: string;
  onUpdateSessionName: (name: string) => void;
  onAppend: (input: AppendEventInput) => void;
  showToast: (msg: string) => void;
}

const STAGES: Array<{ id: LifecycleStage; label: string }> = [
  { id: 'application', label: '1. Application Submitted' },
  { id: 'tele_verification', label: '2. Tele-Verification' },
  { id: 'physical_verification', label: '3. Physical Verification' },
  { id: 'panel_interview', label: '4. Panel Review' },
  { id: 'selected', label: '5. Final Selection / Result' },
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
  targetSection,
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

  const navigate = useNavigate();

  // Scroll to targeted section when navigating to edit specific section
  useEffect(() => {
    const sec =
      targetSection ||
      new URLSearchParams(window.location.search).get('section');
    if (sec && (activeTab === 'edit' || activeTab === 'form')) {
      const normalized = sec.toLowerCase();
      const elId =
        normalized === 'personal'
          ? 'section-personal'
          : normalized === 'family'
          ? 'section-family'
          : normalized === 'educational' || normalized === 'education'
          ? 'section-educational'
          : normalized === 'financial'
          ? 'section-financial'
          : normalized === 'documents' || normalized === 'supporting-documents'
          ? 'section-documents'
          : `section-${normalized}`;

      const el = document.getElementById(elId);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    }
  }, [targetSection, activeTab]);

  // Simulated OTP state (frontend demonstration only)
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtpCode, setDemoOtpCode] = useState('842106');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState<boolean>(
    Boolean(activePerson?.otpVerified || activePerson?.applicationSubmittedAt)
  );
  const [otpError, setOtpError] = useState('');
  const [otpExpired, setOtpExpired] = useState(false);
  const [demoPipelineStage, setDemoPipelineStage] = useState<
    'live' | 'applied' | 'tele_verification' | 'physical_verification' | 'selection_board' | 'selected' | 'rejected'
  >('live');

  const logoutUser = useMaatramStore((s) => s.logoutUser);

  // Post-submission workflow state:
  // 'idle' -> 'submitted_awaiting_code' (displays "Generate a code" button) -> 'code_generated' (displays generated code + "Return to Login Screen")
  const [submissionStage, setSubmissionStage] = useState<
    'idle' | 'submitted_awaiting_code' | 'code_generated'
  >('idle');
  const [pendingAnswers, setPendingAnswers] = useState<ApplicationAnswers | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [demoAppCode, setDemoAppCode] = useState<string>(activePerson?.applicationCode || '');
  const [previewDoc, setPreviewDoc] = useState<{
    label: string;
    fileName: string;
    fileSize?: number;
    fileType?: string;
  } | null>(null);

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

  const appRecord = useMemo(() => {
    return getApplicantApplication(
      activePerson?.applicationCode || activePerson?.personId || '',
      activePerson?.email
    );
  }, [activePerson?.applicationCode, activePerson?.personId, activePerson?.email]);

  const lastLoadedPersonIdRef = useRef<string | null>(null);
  const prevTabRef = useRef<string | null>(null);

  useEffect(() => {
    if (activePerson) {
      const isNewPerson = lastLoadedPersonIdRef.current !== activePerson.personId;
      const isEnteringForm =
        (activeTab === 'edit' || activeTab === 'form') && prevTabRef.current !== activeTab;
      prevTabRef.current = activeTab;

      if (isNewPerson || isEnteringForm) {
        lastLoadedPersonIdRef.current = activePerson.personId;
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
    }
  }, [activePerson, activeTab, reset]);

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

    // Save draft or update existing submission in applicantAuth storage
    if (isApplicationSubmitted) {
      updateApplicantApplication(
        targetPersonId,
        values,
        uploadedDocs,
        email,
        activePerson.applicationCode
      );
    } else {
      saveDraftApplication(targetPersonId, email, values, uploadedDocs);
    }

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

    if (isApplicationSubmitted) {
      navigate('/applicant/application');
    }
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
          const currentAnswers = getValues();
          onAppend({
            type: 'APPLICATION_DRAFT_SAVED',
            personId: targetPersonId,
            cycleId: '2026',
            actor: currentAnswers.fullName?.trim() || actorName,
            payload: {
              email,
              region,
              phone: currentAnswers.phone || '',
              answers: currentAnswers,
            },
          });

          const newDoc = {
            docId: `DOC-${Date.now().toString(36).toUpperCase()}`,
            label: labelToUse,
            fileName: file.name,
            fileType: file.type || 'application/pdf',
            fileSize: file.size,
            signedUrl: `https://signed.maatram.local/docs/${encodeURIComponent(
              file.name
            )}`,
            uploadedAt: new Date().toISOString(),
          };

          onAppend({
            type: 'DOCUMENT_UPLOADED',
            personId: targetPersonId,
            cycleId: '2026',
            actor: actorName,
            payload: newDoc,
          });

          const nextDocs = [
            ...uploadedDocs.filter((d) => d.label !== labelToUse),
            newDoc,
          ];

          if (isApplicationSubmitted) {
            updateApplicantApplication(
              targetPersonId,
              currentAnswers,
              nextDocs,
              email,
              activePerson.applicationCode
            );
          } else {
            saveDraftApplication(targetPersonId, email, currentAnswers, nextDocs);
          }

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

  const handleUploadSampleDoc = (
    labelToUse: string,
    defaultName: string,
    mimeType = 'application/pdf',
    description?: string
  ) => {
    const safeFile = createSafeDemoFile(
      defaultName,
      mimeType,
      description || `DEMO FILE · ${labelToUse}`
    );
    runSimulatedSignedUpload(labelToUse, {
      name: safeFile.name,
      type: safeFile.type,
      size: safeFile.size,
    });
  };

  const handleUseDemoPersonal = () => {
    const data = generateDemoPersonalDetails();
    setValue('fullName', data.fullName, { shouldValidate: true });
    setValue('phone', data.phone, { shouldValidate: true });
    setValue('gender', data.gender, { shouldValidate: true });
    setValue('dob', data.dob, { shouldValidate: true });
    setValue('identityRef', data.identityRef, { shouldValidate: true });
    setEmail(data.email);
    setRegion(data.region);
    onUpdateSessionName(data.fullName);
    showToast('Populated Section 1 (Personal Details) with demo data.');
  };

  const handleUseDemoFamily = () => {
    const data = generateDemoFamilyDetails();
    setValue('fatherName', data.fatherName, { shouldValidate: true });
    setValue('motherName', data.motherName, { shouldValidate: true });
    setValue('parentOccupation', data.parentOccupation, { shouldValidate: true });
    setValue('familyMembersCount', data.familyMembersCount, { shouldValidate: true });
    setValue('housingType', data.housingType as 'Rented' | 'Own', { shouldValidate: true });
    showToast('Populated Section 2 (Family Details) with demo data.');
  };

  const handleUseDemoEducational = () => {
    const data = generateDemoEducationalDetails(region);
    setValue('schoolName', data.schoolName, { shouldValidate: true });
    setValue('schoolType', data.schoolType as 'Government' | 'Private', { shouldValidate: true });
    setValue('mediumOfInstruction', data.mediumOfInstruction, { shouldValidate: true });
    setValue('stream', data.stream, { shouldValidate: true });
    setValue('tenthMarks', data.tenthMarks, { shouldValidate: true });
    setValue('twelfthMarks', data.twelfthMarks, { shouldValidate: true });
    showToast('Populated Section 3 (Educational Details) with demo data.');
  };

  const handleUseDemoFinancial = () => {
    const data = generateDemoFinancialDetails();
    setValue('familyAnnualIncome', data.familyAnnualIncome, { shouldValidate: true });
    setValue('incomeSource', data.incomeSource, { shouldValidate: true });
    setValue('whyMaatram', data.whyMaatram, { shouldValidate: true });
    showToast('Populated Section 4 (Financial Details) with demo data.');
  };

  const handleSendSimulatedOtp = () => {
    if (!watchPhone?.trim()) {
      setOtpError('Please enter a valid mobile number in Personal Details.');
      return;
    }
    const generated = String(Math.floor(100000 + Math.random() * 900000));
    setDemoOtpCode(generated);
    setOtpSent(true);
    setOtpExpired(false);
    setEnteredOtp('');
    setOtpError('');
    showToast(`Simulated OTP sent to ${watchPhone}: ${generated}`);
  };

  const handleTestValidOtp = () => {
    setEnteredOtp(demoOtpCode || '842106');
    setOtpExpired(false);
    setOtpError('');
    showToast(`Filled valid demo OTP (${demoOtpCode || '842106'}). Click Verify Code.`);
  };

  const handleTestIncorrectOtp = () => {
    setEnteredOtp('000000');
    setOtpExpired(false);
    setOtpError('');
    showToast('Filled incorrect OTP (000000) for error testing.');
  };

  const handleTestExpiredOtp = () => {
    setOtpExpired(true);
    setOtpError('The verification code has expired (simulated timeout). Please click Resend OTP.');
    showToast('Simulated expired OTP condition.');
  };

  const handleVerifySimulatedOtp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otpExpired) {
      setOtpError('The verification code has expired (simulated timeout). Please click Resend OTP.');
      return;
    }
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

    // Preserve the existing MAA Application Code generated at registration
    const appCode =
      activePerson.applicationCode ||
      demoAppCode ||
      `MAA-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const verifiedIdentityRef = values.identityRef?.trim() || `MOCK-${targetPersonId}`;

    // Record submission in applicantAuth storage
    submitApplicantApplication(
      targetPersonId,
      appCode,
      verifiedIdentityRef,
      email,
      values.phone || '',
      values.fullName.trim(),
      values,
      uploadedDocs
    );

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
        applicationCode: appCode,
        identityRef: verifiedIdentityRef,
        answers: {
          ...values,
          identityRef: verifiedIdentityRef,
        },
      },
    });

    showToast('Scholarship application submitted successfully!');
    navigate('/applicant/application');
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

  const effectiveStage = demoPipelineStage === 'live' ? activePerson.stage : demoPipelineStage;
  const currentStageIndex = STAGES.findIndex((s) => s.id === effectiveStage);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-neutral-950">
              {submissionStage !== 'idle'
                ? 'Application Submission'
                : activeTab === 'apply-now'
                  ? 'Apply for Scholarship'
                  : activeTab === 'resume'
                    ? 'Resume Application'
                    : activeTab === 'edit'
                      ? 'Edit Application'
                      : !isApplicationSubmitted || activeTab === 'form'
                        ? 'Scholarship Application'
                        : activeTab === 'application'
                          ? 'Application Status'
                          : 'Pipeline Status History'}
            </h1>
            {isApplicationSubmitted && activePerson.applicationCode && (
              <span className="bg-neutral-950 text-white rounded-full px-3 py-0.5 text-xs font-mono font-bold tracking-tight">
                {activePerson.applicationCode}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            {submissionStage !== 'idle'
              ? 'Application recorded. Generate and copy your unique code to return to login and view status.'
              : activeTab === 'apply-now'
                ? 'Start your Higher Education Scholarship 2026–27 application.'
                : activeTab === 'resume'
                  ? 'Continue your saved application draft and submit for verification.'
                  : activeTab === 'edit'
                    ? 'Your submitted application is editable. Update your personal, family, educational, financial details or documents anytime.'
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
          {/* APPLY NOW VIEW: For applicants who have registered an account but not submitted */}
          {(activeTab === 'apply-now' ||
            (activeTab === 'application' && !isApplicationSubmitted && !appRecord)) && (
            <div className="max-w-2xl mx-auto py-6 sm:py-10">
              <div className="bg-white border-2 border-neutral-200 rounded-3xl p-8 sm:p-10 shadow-xs text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-900 mx-auto flex items-center justify-center">
                  <FileText className="w-8 h-8 text-amber-600" />
                </div>

                <div className="space-y-2.5">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
                    {activePerson.applicationCode || 'MAA-2026'}
                  </span>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-neutral-950">
                    You haven't submitted your application yet!
                  </h2>
                  <p className="text-sm text-neutral-600 max-w-lg mx-auto leading-relaxed">
                    Your account has been successfully created. Complete your scholarship application to start tracking your application status.
                  </p>
                </div>

                {/* Account details summary */}
                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-left text-xs space-y-2 max-w-md mx-auto">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-neutral-500">Applicant:</span>
                    <span className="font-bold text-neutral-900">{activePerson.name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-neutral-500">Registered Email:</span>
                    <span className="font-mono text-neutral-900">{activePerson.email}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-neutral-500">Registered Phone:</span>
                    <span className="font-mono text-neutral-900">{activePerson.phone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">District:</span>
                    <span className="font-medium text-neutral-900">{activePerson.region || 'Tamil Nadu'}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/applicant/form')}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Apply Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RESUME APPLICATION VIEW: For applicants with an incomplete draft */}
          {(activeTab === 'resume' ||
            (activeTab === 'application' && !isApplicationSubmitted && appRecord?.status === 'DRAFT')) && (
            <div className="max-w-2xl mx-auto py-6 sm:py-10">
              <div className="bg-white border-2 border-neutral-200 rounded-3xl p-8 sm:p-10 shadow-xs text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-900 mx-auto flex items-center justify-center border border-amber-200">
                  <Clock className="w-8 h-8 text-amber-600" />
                </div>

                <div className="space-y-2.5">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    Draft In Progress
                  </span>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-neutral-950">
                    Resume Your Scholarship Application
                  </h2>
                  <p className="text-sm text-neutral-600 max-w-lg mx-auto leading-relaxed">
                    You have an incomplete application draft in progress. Pick up where you left off and submit your application to start tracking your application status.
                  </p>
                </div>

                {appRecord?.lastSavedAt && (
                  <p className="text-xs text-neutral-400">
                    Last saved: {new Date(appRecord.lastSavedAt).toLocaleString()}
                  </p>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/applicant/form')}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Resume Application</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

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
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    <span className="bg-white/10 text-neutral-200 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold">
                      {activePerson.applicationSubmittedAt
                        ? `Submitted: ${format(new Date(activePerson.applicationSubmittedAt), 'dd MMM yyyy')}`
                        : 'Draft in Progress'}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/profile')}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white hover:bg-white/30 transition-colors cursor-pointer"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/applicant/edit')}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors cursor-pointer"
                    >
                      Edit Application
                    </button>
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
                {/* Pipeline Demo Scenario Tester */}
                <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                      <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                        Selection Pipeline Demo Scenario Tester
                      </span>
                      {demoPipelineStage !== 'live' && (
                        <span className="bg-amber-200 text-amber-950 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-amber-400">
                          DEMO STATUS
                        </span>
                      )}
                    </div>
                    {demoPipelineStage !== 'live' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDemoPipelineStage('live');
                          showToast('Reset to live application pipeline status.');
                        }}
                        className="text-xs font-bold text-neutral-800 underline hover:text-neutral-950 cursor-pointer self-start sm:self-auto"
                      >
                        Reset to Live Status
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Test applicant progression across official selection stages. Generated demo stages are simulated for prototype verification and do not modify actual applicant selection records or decisions.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDemoPipelineStage('live');
                        showToast('Showing Live Status.');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        demoPipelineStage === 'live'
                          ? 'bg-neutral-950 text-white border-neutral-950'
                          : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      Live Status
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoPipelineStage('applied');
                        showToast('Simulated Stage 1: Applied (Demo).');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        demoPipelineStage === 'applied'
                          ? 'bg-[#FFC20E] text-neutral-950 border-amber-500 font-bold'
                          : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      1. Applied
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoPipelineStage('tele_verification');
                        showToast('Simulated Stage 2: Tele-Verification (Demo).');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        demoPipelineStage === 'tele_verification'
                          ? 'bg-[#FFC20E] text-neutral-950 border-amber-500 font-bold'
                          : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      2. Tele-Verification
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoPipelineStage('physical_verification');
                        showToast('Simulated Stage 3: Physical Verification (Demo).');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        demoPipelineStage === 'physical_verification'
                          ? 'bg-[#FFC20E] text-neutral-950 border-amber-500 font-bold'
                          : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      3. Physical Verification
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoPipelineStage('selection_board');
                        showToast('Simulated Stage 4: Selection Board (Demo).');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        demoPipelineStage === 'selection_board'
                          ? 'bg-[#FFC20E] text-neutral-950 border-amber-500 font-bold'
                          : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      4. Selection Board
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoPipelineStage('selected');
                        showToast('Simulated Stage 5: Selected Scholar (Demo).');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        demoPipelineStage === 'selected'
                          ? 'bg-emerald-600 text-white border-emerald-700 font-bold'
                          : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      5. Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoPipelineStage('rejected');
                        showToast('Simulated Stage: Not Selected / Rejected (Demo).');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        demoPipelineStage === 'rejected'
                          ? 'bg-red-600 text-white border-red-700 font-bold'
                          : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      Not Selected
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-bold text-neutral-950">
                        Selection Pipeline
                      </h2>
                      {demoPipelineStage !== 'live' && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                          DEMO STATUS
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">
                      Current stage:{' '}
                      <span className="font-semibold text-neutral-950">
                        {effectiveStage === 'rejected'
                          ? 'Not Selected (Rejected)'
                          : STAGES[currentStageIndex]?.label || effectiveStage}
                      </span>
                      {activePerson.shortlisted && ' · Shortlisted'}
                      {demoPipelineStage !== 'live' && (
                        <span className="text-amber-700 font-medium ml-1">
                          (Simulated Demo Scenario)
                        </span>
                      )}
                    </p>
                  </div>

                  {activePerson.addressVerificationMode && (
                    <span className="bg-neutral-100 text-neutral-800 rounded-full px-3 py-1 text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Mode: {activePerson.addressVerificationMode}</span>
                    </span>
                  )}
                </div>

                {effectiveStage === 'rejected' ? (
                  <div
                    role="alert"
                    className="p-4 rounded-xl border border-red-300 bg-red-50 text-red-950 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold">Application Not Selected (Admin Decision)</p>
                      {demoPipelineStage !== 'live' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-200 text-red-900 border border-red-300 px-2 py-0.5 rounded">
                          DEMO STATUS
                        </span>
                      )}
                    </div>
                    <p>
                      <span className="font-semibold">Rejection reason: </span>
                      {activePerson.rejectionReason || 'Family income exceeds eligible scholarship threshold (Simulated Demo Decision)'}
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
                {effectiveStage === 'selected' && (activePerson.joinCode || demoPipelineStage === 'selected') && (
                  <div className="border border-neutral-950 bg-neutral-950 text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-[#FFC20E]" aria-hidden="true" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-300">
                          Workspace Join Code (Valid 48 hours)
                        </span>
                        {demoPipelineStage !== 'live' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-neutral-950 px-2 py-0.5 rounded">
                            DEMO CODE
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-bold tracking-[0.08em] tabular-nums text-white">
                        {activePerson.joinCode || 'MAATRAM-JOIN-2026-DEMO'}
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
                    onClick={() => navigate('/applicant/edit')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
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
                        onClick={() => navigate('/applicant/edit/personal')}
                        className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 underline inline-flex items-center gap-1 cursor-pointer"
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
                        onClick={() => navigate('/applicant/edit/family')}
                        className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 underline inline-flex items-center gap-1 cursor-pointer"
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
                        onClick={() => navigate('/applicant/edit/educational')}
                        className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 underline inline-flex items-center gap-1 cursor-pointer"
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
                        onClick={() => navigate('/applicant/edit/financial')}
                        className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 underline inline-flex items-center gap-1 cursor-pointer"
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
                      onClick={() => navigate('/applicant/edit/documents')}
                      className="text-xs font-bold text-neutral-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
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
          {(!isApplicationSubmitted || activeTab === 'form' || activeTab === 'edit') && (
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
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate('/applicant/application')}
                      className="px-4 py-2.5 rounded-xl font-semibold text-xs bg-neutral-800 text-white hover:bg-neutral-700 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back to Application</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
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
                <div id="section-personal" className="space-y-4 scroll-mt-6">
                  <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-neutral-950">
                        1. Personal Details
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Applicant identity and contact information.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUseDemoPersonal}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#FFC20E]" />
                        <span>Use Demo Data</span>
                      </button>
                      {hasPersonalDetails && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Validated
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="q1-name" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Full Name *
                      </label>
                      <input
                        id="q1-name"
                        type="text"
                        {...register('fullName')}
                        placeholder="e.g. Senthil Kumar S"
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                      {errors.fullName && (
                        <p className="text-xs text-red-600 mt-1">{errors.fullName.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="q1-email" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Email Address *
                      </label>
                      <input
                        id="q1-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. senthil.s@demo.local"
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>

                    <div>
                      <label htmlFor="q1-phone" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Mobile Phone Number *
                      </label>
                      <input
                        id="q1-phone"
                        type="tel"
                        {...register('phone')}
                        placeholder="e.g. 9840123456"
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>

                    <div>
                      <label htmlFor="q1-gender" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Gender *
                      </label>
                      <select
                        id="q1-gender"
                        {...register('gender')}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="q1-dob" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Date of Birth *
                      </label>
                      <input
                        id="q1-dob"
                        type="date"
                        {...register('dob')}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>

                    <div>
                      <label htmlFor="q1-region" className="block text-xs font-semibold text-neutral-800 mb-1">
                        District (Tamil Nadu) *
                      </label>
                      <select
                        id="q1-region"
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

                    <div className="sm:col-span-2">
                      <label htmlFor="q1-identity" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Identity / Registration Reference *
                      </label>
                      <input
                        id="q1-identity"
                        type="text"
                        {...register('identityRef')}
                        placeholder="e.g. MOCK-TN-2026-9812"
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Mock identity reference number for verification without storing sensitive government IDs.
                      </p>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Family Details */}
                <div id="section-family" className="space-y-4 scroll-mt-6">
                  <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-neutral-950">
                        2. Family Details
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Household structure, parent background, and housing type.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUseDemoFamily}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#FFC20E]" />
                        <span>Use Demo Data</span>
                      </button>
                      {hasFamilyDetails && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Validated
                        </span>
                      )}
                    </div>
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
                <div id="section-educational" className="space-y-4 scroll-mt-6">
                  <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-neutral-950">
                        3. Educational Details
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Schooling history and board examination scores.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUseDemoEducational}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#FFC20E]" />
                        <span>Use Demo Data</span>
                      </button>
                      {hasEducationalDetails && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Validated
                        </span>
                      )}
                    </div>
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
                <div id="section-financial" className="space-y-4 scroll-mt-6">
                  <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-neutral-950">
                        4. Financial Details
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Annual household income and need statement.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUseDemoFinancial}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#FFC20E]" />
                        <span>Use Demo Data</span>
                      </button>
                      {hasFinancialDetails && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Validated
                        </span>
                      )}
                    </div>
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
                <div id="section-documents" className="space-y-4 scroll-mt-6">
                  <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-neutral-950">
                        5. Supporting Documents Upload
                      </h3>
                      <p className="text-xs text-neutral-500">
                        All 6 supporting document requirements can be uploaded or filled using demo files.
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
                      {uploadedDocs.find((d) => d.label === 'Income Certificate') && (
                        <div className="p-2 bg-white border border-neutral-200 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span className="truncate font-mono text-[11px] text-neutral-800">
                              {uploadedDocs.find((d) => d.label === 'Income Certificate')?.fileName}
                            </span>
                            {uploadedDocs.find((d) => d.label === 'Income Certificate')?.fileName?.toLowerCase().includes('demo') && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                DEMO FILE
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const doc = uploadedDocs.find((d) => d.label === 'Income Certificate');
                              if (doc) setPreviewDoc(doc);
                            }}
                            className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 flex items-center gap-1 cursor-pointer ml-2 shrink-0"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{hasIncomeCert ? 'Replace File' : 'Choose File'}</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleDocumentFileInput('Income Certificate', e)}
                            className="sr-only"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleUploadSampleDoc('Income Certificate', 'income_certificate_demo.pdf', 'application/pdf', 'DEMO FILE · Income Certificate')}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-[#FFC20E]" />
                          <span>Use Demo Data</span>
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
                      {uploadedDocs.find((d) => d.label === 'House Rent Receipt' || d.label === 'House Tax / Property Proof') && (
                        <div className="p-2 bg-white border border-neutral-200 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span className="truncate font-mono text-[11px] text-neutral-800">
                              {uploadedDocs.find((d) => d.label === 'House Rent Receipt' || d.label === 'House Tax / Property Proof')?.fileName}
                            </span>
                            {uploadedDocs.find((d) => d.label === 'House Rent Receipt' || d.label === 'House Tax / Property Proof')?.fileName?.toLowerCase().includes('demo') && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                DEMO FILE
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const doc = uploadedDocs.find((d) => d.label === 'House Rent Receipt' || d.label === 'House Tax / Property Proof');
                              if (doc) setPreviewDoc(doc);
                            }}
                            className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 flex items-center gap-1 cursor-pointer ml-2 shrink-0"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{hasRentOrHouseProof ? 'Replace File' : 'Choose File'}</span>
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
                              watchHousingType === 'Own' ? 'property_tax_receipt_demo.pdf' : 'house_rent_receipt_demo.pdf',
                              'application/pdf',
                              'DEMO FILE · House Proof'
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-[#FFC20E]" />
                          <span>Use Demo Data</span>
                        </button>
                      </div>
                    </div>

                    {/* 3. Eligibility Proof */}
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
                      {uploadedDocs.find((d) => d.label.includes('Proof') || d.label.includes('Receipt')) && (
                        <div className="p-2 bg-white border border-neutral-200 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span className="truncate font-mono text-[11px] text-neutral-800">
                              {uploadedDocs.find((d) => d.label.includes('Proof') || d.label.includes('Receipt'))?.fileName}
                            </span>
                            {uploadedDocs.find((d) => d.label.includes('Proof') || d.label.includes('Receipt'))?.fileName?.toLowerCase().includes('demo') && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                DEMO FILE
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const doc = uploadedDocs.find((d) => d.label.includes('Proof') || d.label.includes('Receipt'));
                              if (doc) setPreviewDoc(doc);
                            }}
                            className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 flex items-center gap-1 cursor-pointer ml-2 shrink-0"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{hasEligibilityProof ? 'Replace File' : 'Choose File'}</span>
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
                            handleUploadSampleDoc(lbl, `${watchEligibilityProofType || 'eligibility'}_proof_demo.pdf`, 'application/pdf', 'DEMO FILE · Eligibility Proof');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-[#FFC20E]" />
                          <span>Use Demo Data</span>
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
                      {uploadedDocs.find((d) => d.label === 'Electricity Bill') && (
                        <div className="p-2 bg-white border border-neutral-200 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span className="truncate font-mono text-[11px] text-neutral-800">
                              {uploadedDocs.find((d) => d.label === 'Electricity Bill')?.fileName}
                            </span>
                            {uploadedDocs.find((d) => d.label === 'Electricity Bill')?.fileName?.toLowerCase().includes('demo') && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                DEMO FILE
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const doc = uploadedDocs.find((d) => d.label === 'Electricity Bill');
                              if (doc) setPreviewDoc(doc);
                            }}
                            className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 flex items-center gap-1 cursor-pointer ml-2 shrink-0"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{hasElectricityBill ? 'Replace File' : 'Choose File'}</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleDocumentFileInput('Electricity Bill', e)}
                            className="sr-only"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleUploadSampleDoc('Electricity Bill', 'electricity_bill_demo.pdf', 'application/pdf', 'DEMO FILE · Electricity Bill')}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-[#FFC20E]" />
                          <span>Use Demo Data</span>
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
                      {uploadedDocs.find((d) => d.label === '10th Marksheet' || d.label === '12th Marksheet') && (
                        <div className="space-y-1">
                          {uploadedDocs.filter((d) => d.label === '10th Marksheet' || d.label === '12th Marksheet').map((d) => (
                            <div key={d.label} className="p-1.5 bg-white border border-neutral-200 rounded-lg flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-3 h-3 text-neutral-500 shrink-0" />
                                <span className="truncate font-mono text-[11px] text-neutral-800">
                                  {d.label}: {d.fileName}
                                </span>
                                {d.fileName?.toLowerCase().includes('demo') && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded shrink-0">
                                    DEMO
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(d)}
                                className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 flex items-center gap-1 cursor-pointer ml-2 shrink-0"
                              >
                                <Eye className="w-3 h-3" /> Preview
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
                        <button
                          type="button"
                          onClick={() => {
                            handleUploadSampleDoc('10th Marksheet', 'marksheet_10th_demo.pdf', 'application/pdf', 'DEMO FILE · 10th Marksheet');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-[#FFC20E]" />
                          <span>Use Demo 10th Marksheet</span>
                        </button>

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
                            handleUploadSampleDoc('12th Marksheet', 'marksheet_12th_demo.pdf', 'application/pdf', 'DEMO FILE · 12th Marksheet');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-[#FFC20E]" />
                          <span>Use Demo 12th Marksheet</span>
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
                      {uploadedDocs.find((d) => d.label === 'One House Photo') && (
                        <div className="p-2 bg-white border border-neutral-200 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span className="truncate font-mono text-[11px] text-neutral-800">
                              {uploadedDocs.find((d) => d.label === 'One House Photo')?.fileName}
                            </span>
                            {uploadedDocs.find((d) => d.label === 'One House Photo')?.fileName?.toLowerCase().includes('demo') && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                DEMO FILE
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const doc = uploadedDocs.find((d) => d.label === 'One House Photo');
                              if (doc) setPreviewDoc(doc);
                            }}
                            className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 flex items-center gap-1 cursor-pointer ml-2 shrink-0"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{hasHousePhoto ? 'Replace Photo' : 'Choose Photo'}</span>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png"
                            onChange={(e) => handleDocumentFileInput('One House Photo', e)}
                            className="sr-only"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleUploadSampleDoc('One House Photo', 'house_photo_demo.jpg', 'image/jpeg', 'DEMO FILE · House Photograph')}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors text-neutral-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-[#FFC20E]" />
                          <span>Use Demo Data</span>
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
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                          >
                            {otpSent ? 'Resend Simulated OTP' : 'Send Verification OTP'}
                          </button>
                          <span className="text-xs text-neutral-600 font-mono">
                            Target Phone: <strong className="text-neutral-950">{watchPhone || 'Enter phone in Section 1'}</strong>
                          </span>
                        </div>

                        {otpSent && (
                          <div className="p-3 bg-white border border-amber-300 rounded-xl space-y-3">
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
                                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors cursor-pointer"
                              >
                                Verify Code
                              </button>
                            </div>
                            {otpError && (
                              <p className="text-xs text-red-600 font-medium">{otpError}</p>
                            )}

                            {/* Demo OTP Testing Controls */}
                            <div className="pt-2 border-t border-neutral-200 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700">
                                <Sparkles className="w-3 h-3 text-[#FFC20E]" />
                                <span>Demo OTP Testing Scenarios:</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleTestValidOtp}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer"
                                >
                                  Test Valid OTP
                                </button>
                                <button
                                  type="button"
                                  onClick={handleTestIncorrectOtp}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 text-red-900 hover:bg-red-100 border border-red-300 transition-colors cursor-pointer"
                                >
                                  Test Incorrect OTP
                                </button>
                                <button
                                  type="button"
                                  onClick={handleTestExpiredOtp}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 transition-colors cursor-pointer"
                                >
                                  Test Expired OTP
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSendSimulatedOtp}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border border-neutral-300 transition-colors cursor-pointer"
                                >
                                  Resend OTP
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 7: Actions & Submit Button Gating */}
                <div className="pt-4 border-t border-neutral-200 space-y-4">
                  {!isApplicationSubmitted && (
                    <div className="space-y-4">
                      {!isReadyToSubmit && (
                        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs space-y-2">
                          <div className="flex items-center gap-2 font-bold text-amber-950">
                            <Info className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Submit Application Disabled — Pending Completion</span>
                          </div>
                          <p className="text-amber-900">
                            The Submit Application button remains disabled until all mandatory sections and verification checks are complete:
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1 font-medium text-[11px]">
                            {!hasPersonalDetails && (
                              <span className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900">
                                • 1. Personal Details
                              </span>
                            )}
                            {!hasFamilyDetails && (
                              <span className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900">
                                • 2. Family Details
                              </span>
                            )}
                            {!hasEducationalDetails && (
                              <span className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900">
                                • 3. Educational Details
                              </span>
                            )}
                            {!hasFinancialDetails && (
                              <span className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900">
                                • 4. Financial Details
                              </span>
                            )}
                            {!hasAllRequiredDocs && (
                              <span className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900">
                                • 5. Supporting Documents ({[
                                  hasIncomeCert,
                                  hasRentOrHouseProof,
                                  hasEligibilityProof,
                                  hasElectricityBill,
                                  hasMarksheets,
                                  hasHousePhoto,
                                ].filter(Boolean).length}/6)
                              </span>
                            )}
                            {!otpVerified && (
                              <span className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900">
                                • 6. Phone OTP Verification
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-neutral-50 border border-neutral-200 rounded-2xl">
                        <div>
                          {isReadyToSubmit ? (
                            <div>
                              <p className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>All Application Checks Passed</span>
                              </p>
                              <p className="text-xs text-emerald-800 mt-0.5">
                                All mandatory sections, required verification documents, and phone verification are complete. Click Submit Application to submit.
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                                <Lock className="w-4 h-4 text-neutral-400" />
                                <span>Application Incomplete</span>
                              </p>
                              <p className="text-xs text-neutral-500 mt-0.5">
                                Complete all sections above or save your current progress as a draft.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors cursor-pointer"
                          >
                            Save Draft
                          </button>
                          <button
                            type="submit"
                            disabled={!isReadyToSubmit || !isCycleOpen}
                            className={`px-8 py-3 rounded-xl text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 ${
                              isReadyToSubmit && isCycleOpen
                                ? 'bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] active:scale-95 cursor-pointer'
                                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed border border-neutral-300'
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Submit Application</span>
                          </button>
                        </div>
                      </div>
                    </div>
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
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => navigate('/applicant/application')}
                          className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                        >
                          Cancel Editing
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Save className="w-4 h-4 stroke-[2.5]" />
                          <span>Save & Update Application</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* 3. STATUS HISTORY VIEW */}
          {isApplicationSubmitted && activeTab === 'history' && (
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
          )}
        </>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full border border-neutral-300 shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-neutral-950 text-white flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4 text-[#FFC20E]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-950">
                    {previewDoc.label}
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono truncate max-w-[240px]">
                    {previewDoc.fileName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-950 hover:bg-neutral-200/60 transition-colors cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {previewDoc.fileName.toLowerCase().includes('demo') && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2.5 text-xs text-amber-950">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[11px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded mr-1.5">
                      DEMO FILE
                    </span>
                    <span>Programmatically generated safe sample file for prototype demonstration.</span>
                  </div>
                </div>
              )}

              {/* Document Visual Box */}
              <div className="border border-neutral-200 rounded-xl p-8 bg-neutral-50 flex flex-col items-center justify-center text-center space-y-3 min-h-[180px]">
                {previewDoc.fileName.toLowerCase().endsWith('.jpg') ||
                previewDoc.fileName.toLowerCase().endsWith('.png') ||
                previewDoc.fileName.toLowerCase().endsWith('.jpeg') ? (
                  <div className="space-y-2">
                    <div className="w-20 h-20 mx-auto rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
                      <FileCheck className="w-10 h-10" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-800">
                      Sample Residence Exterior Image Preview
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-20 h-20 mx-auto rounded-xl bg-neutral-200 border border-neutral-300 flex items-center justify-center text-neutral-800">
                      <FileText className="w-10 h-10 text-neutral-600" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-800">
                      Sample Verified PDF Document Preview
                    </p>
                  </div>
                )}
                <div className="text-[11px] text-neutral-500 font-mono space-y-0.5">
                  <p>File: {previewDoc.fileName}</p>
                  {previewDoc.fileSize && <p>Size: {formatBytes(previewDoc.fileSize)}</p>}
                  <p>MIME: {previewDoc.fileType || 'application/pdf'}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
