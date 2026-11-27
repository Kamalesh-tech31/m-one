import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Inbox,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { DISTRICTS_8, type AuthSessionUser } from '../core/types';
import { generateSampleRegistrationDetails } from '../core/demoGenerator';
import { useMaatramStore } from '../core/store';
import {
  accountExists,
  createApplicantAccount,
  getApplicantApplication,
  getApplicantByCodeOrEmail,
  validateRegistrationFields,
} from '../core/applicantAuth';
import {
  getLatestEmailFor,
  sendEmailOtp,
  verifyEmailOtp,
  type DispatchedEmail,
} from '../core/emailService';

export const RegisterScreen: React.FC = () => {
  const navigate = useNavigate();
  const loginUser = useMaatramStore((s) => s.loginUser);

  // Form input states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState<string>(DISTRICTS_8[0]);
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDemoData, setIsDemoData] = useState(false);

  // Workflow steps: 'form' -> 'verification' -> 'completed'
  const [step, setStep] = useState<'form' | 'verification' | 'completed'>('form');

  // Email OTP state & countdown
  const [verificationCode, setVerificationCode] = useState('');
  const [currentDemoOtp, setCurrentDemoOtp] = useState('842106');
  const [isOtpExpired, setIsOtpExpired] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300); // 5 minutes
  const [latestDispatchedEmail, setLatestDispatchedEmail] = useState<DispatchedEmail | null>(null);

  // Form error & success states
  const [formError, setFormError] = useState('');
  const [generatedMaaCode, setGeneratedMaaCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [topToast, setTopToast] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setTopToast(msg);
    setTimeout(() => setTopToast(null), 3000);
  };

  // 5-minute expiration countdown timer
  useEffect(() => {
    if (step !== 'verification') return;
    if (secondsRemaining <= 0) {
      setIsOtpExpired(true);
      setOtpError('The 6-digit email verification code has expired. Please click Resend OTP.');
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsOtpExpired(true);
          setOtpError('The 6-digit email verification code has expired. Please click Resend OTP.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, secondsRemaining]);

  // Listen for dispatched emails
  useEffect(() => {
    const handleEmail = (e: Event) => {
      const custom = e as CustomEvent<DispatchedEmail>;
      if (custom.detail && custom.detail.to.toLowerCase() === email.trim().toLowerCase()) {
        setLatestDispatchedEmail(custom.detail);
        if (custom.detail.otpCode) {
          setCurrentDemoOtp(custom.detail.otpCode);
        }
      }
    };
    window.addEventListener('maatram:email-dispatched', handleEmail);
    return () => window.removeEventListener('maatram:email-dispatched', handleEmail);
  }, [email]);

  // 1. Independent "Use Demo Data" for New Account Creation
  const handleUseDemoData = () => {
    const sample = generateSampleRegistrationDetails();
    setFullName(sample.name);
    setPhone(sample.phone);
    setEmail(sample.email);
    setDistrict(sample.district);
    setDob(sample.dob || '2008-05-14');
    setPassword(sample.password);
    setConfirmPassword(sample.password);
    setIsDemoData(true);
    setFormError('');
    showNotification('Populated registration fields with demo data.');
  };

  // 2. Validate registration form & proceed to email OTP verification
  const handleProceedToVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Strict validation
    const validation = validateRegistrationFields({
      fullName,
      phone,
      email,
      district,
      dob,
      password,
      confirmPassword,
    });

    if (!validation.valid) {
      setFormError(validation.error || 'Please correct the highlighted errors.');
      return;
    }

    // Check duplicate account
    const duplicateCheck = accountExists(email, phone);
    if (duplicateCheck.exists) {
      setFormError(duplicateCheck.reason || 'An account with this email or mobile already exists.');
      return;
    }

    // Dispatch real email OTP (valid for 5 minutes)
    const emailRes = await sendEmailOtp(email, fullName);
    if (!emailRes.success) {
      setFormError(emailRes.error || 'Failed to dispatch verification email.');
      return;
    }

    setCurrentDemoOtp(emailRes.otp);
    setVerificationCode('');
    setIsOtpExpired(false);
    setOtpError('');
    setSecondsRemaining(300); // 5 minutes
    setLatestDispatchedEmail(getLatestEmailFor(email));
    setStep('verification');
    showNotification(`Verification code sent to ${email.trim().toLowerCase()}`);
  };

  // Developer Test Scenario Handlers
  const handleTestSuccessfulOtp = () => {
    setIsOtpExpired(false);
    setVerificationCode(currentDemoOtp);
    setOtpError('');
    showNotification(`Filled active OTP: ${currentDemoOtp}`);
  };

  const handleTestIncorrectOtp = () => {
    setIsOtpExpired(false);
    setVerificationCode('000000');
    setOtpError('');
    showNotification('Filled incorrect OTP: 000000');
  };

  const handleTestExpiredOtp = () => {
    setIsOtpExpired(true);
    setSecondsRemaining(0);
    setVerificationCode(currentDemoOtp);
    setOtpError('The verification code has expired (5-minute validity). Please click Resend OTP.');
    showNotification('Simulating expired OTP condition.');
  };

  const handleResendOtp = async () => {
    const emailRes = await sendEmailOtp(email, fullName);
    if (emailRes.success) {
      setCurrentDemoOtp(emailRes.otp);
      setIsOtpExpired(false);
      setSecondsRemaining(300);
      setVerificationCode('');
      setOtpError('');
      setLatestDispatchedEmail(getLatestEmailFor(email));
      showNotification(`New verification code sent to ${email}`);
    }
  };

  // 3. Verify Email with OTP and create applicant account
  const handleVerifyAndCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');

    if (isOtpExpired || secondsRemaining <= 0) {
      setOtpError('The verification code has expired. Please click Resend OTP to receive a new code.');
      return;
    }

    if (!verificationCode.trim()) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }

    // Validate OTP against email service
    const verifyResult = verifyEmailOtp(email, verificationCode);
    if (!verifyResult.success) {
      setOtpError(verifyResult.error || 'Invalid verification code. Please check your email.');
      return;
    }

    // Create applicant account (password hashed, email marked verified, unique MAA code generated)
    // NOTE: Does NOT submit the scholarship application!
    const createRes = await createApplicantAccount({
      fullName,
      phone,
      email,
      district,
      dob,
      password,
      confirmPassword,
    });

    if (!createRes.success || !createRes.account) {
      setOtpError(createRes.error || 'Failed to create applicant account.');
      return;
    }

    setGeneratedMaaCode(createRes.account.applicationCode);
    setStep('completed');
    showNotification(`Account created! Application Code: ${createRes.account.applicationCode}`);
  };

  const handleCopyMaaCode = () => {
    if (generatedMaaCode && navigator?.clipboard) {
      navigator.clipboard.writeText(generatedMaaCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      showNotification(`Copied Application Code: ${generatedMaaCode}`);
    }
  };

  const handleViewStatus = async () => {
    // 1. Log in the newly registered applicant
    const account =
      getApplicantByCodeOrEmail(generatedMaaCode) ||
      (email ? getApplicantByCodeOrEmail(email) : null);

    if (account) {
      const authUser: AuthSessionUser = {
        id: account.applicationCode,
        personId: account.applicationCode,
        role: 'applicant',
        name: account.fullName,
        email: account.email,
        subtitle: 'Applicant',
      };
      loginUser(authUser);

      // 2. Check the applicant's actual application record BEFORE navigating
      const application = await getApplicantApplication(authUser.id, authUser.email);

      if (!application) {
        navigate('/apply-now');
        return;
      }

      if (application.status === 'DRAFT') {
        navigate('/application-form');
        return;
      }

      if (application.status === 'SUBMITTED') {
        navigate('/status-pipeline');
        return;
      }
    } else {
      navigate('/login/applicant');
    }
  };

  const handleSignInAndApply = () => {
    try {
      localStorage.setItem('maatram_last_registered_code', generatedMaaCode);
      localStorage.setItem('maatram_last_registered_email', email.trim().toLowerCase());
    } catch {
      // ignore
    }
    navigate('/login/applicant');
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-between">
      {/* Top Notification Toast with Green Tick Mark */}
      {topToast && (
        <div
          role="status"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-neutral-950 text-white border border-neutral-800 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-medium animate-fade-in max-w-[90vw] sm:max-w-md pointer-events-auto"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="leading-snug flex-1">{topToast}</span>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 focus:outline-none">
            <span className="font-display text-xl font-extrabold tracking-[-0.02em] text-neutral-950">
              Maatram
            </span>
            <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight">
              One
            </span>
          </Link>

          <Link
            to="/login/applicant"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-950 transition-colors"
          >
            <span>Already have an account? Sign in</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-10">
        <div className="w-full max-w-lg">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            {/* Step 1: Registration Form */}
            {step === 'form' && (
              <>
                <div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFC20E]/20 text-neutral-900 mb-2">
                    <User className="w-3.5 h-3.5 text-neutral-950" />
                    <span>New Account Creation</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
                    Create Applicant Account
                  </h1>
                  <p className="text-xs sm:text-sm text-neutral-600 mt-1">
                    Register your details to apply for the Maatram One Higher Education Scholarship 2026–27.
                  </p>
                </div>

                {/* Independent "Use Demo Data" Helper Card */}
                <div className="p-4 bg-amber-50/90 border border-dashed border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                      <span>Registration Demo Assistant</span>
                    </p>
                    <p className="text-amber-800 text-[11px] leading-relaxed">
                      Populate realistic sample registration data. Values are fully editable and will not auto-submit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseDemoData}
                    className="px-3.5 py-2 rounded-xl font-bold text-xs bg-neutral-950 text-white hover:bg-neutral-800 transition-colors shrink-0 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FFC20E]" />
                    <span>Use Demo Data</span>
                  </button>
                </div>

                {/* DEMO DATA Badge */}
                {isDemoData && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-950 font-medium">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded mr-1.5">
                        DEMO DATA
                      </span>
                      <span>Sample applicant details populated. Review, edit as needed, and manually proceed to verification.</span>
                    </div>
                  </div>
                )}

                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleProceedToVerification} className="space-y-4">
                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-semibold text-neutral-800 mb-1">
                      Applicant Full Name *
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Divya R"
                      required
                      className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-phone" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Mobile Phone Number *
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 9840123456"
                        required
                        className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>

                    <div>
                      <label htmlFor="reg-dob" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Date of Birth *
                      </label>
                      <input
                        id="reg-dob"
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        required
                        className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-district" className="block text-xs font-semibold text-neutral-800 mb-1">
                        District (Tamil Nadu) *
                      </label>
                      <select
                        id="reg-district"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      >
                        {DISTRICTS_8.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="reg-email" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Contact Email Address *
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. applicant@demo.local"
                        required
                        className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-pass" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Password (min 6 characters) *
                      </label>
                      <div className="relative">
                        <input
                          id="reg-pass"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reg-confirm-pass" className="block text-xs font-semibold text-neutral-800 mb-1">
                        Confirm Password *
                      </label>
                      <input
                        id="reg-confirm-pass"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs mt-2 cursor-pointer"
                  >
                    <span>Proceed to Account Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}

            {/* Step 2: Email OTP Verification */}
            {step === 'verification' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FFC20E]/20 text-neutral-950 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-neutral-950" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-neutral-950">
                      Email Verification
                    </h2>
                    <p className="text-xs text-neutral-600">
                      We have sent a 6-digit verification code to <strong>{email}</strong>
                    </p>
                  </div>
                </div>

                {/* Real-time Email Dispatch Notification Banner */}
                {latestDispatchedEmail && (
                  <div className="p-3.5 bg-neutral-950 text-white rounded-2xl border border-neutral-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#FFC20E]">
                        <Inbox className="w-3.5 h-3.5" />
                        <span>Email Inbox Simulator</span>
                      </span>
                      <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full text-[10px]">
                        DELIVERED
                      </span>
                    </div>
                    <p className="font-semibold text-neutral-200">
                      Subject: {latestDispatchedEmail.subject}
                    </p>
                    <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 p-2.5 rounded-xl">
                      <span className="text-neutral-400 text-[11px]">Verification OTP:</span>
                      <span className="font-mono text-base font-bold text-[#FFC20E] tracking-wider">
                        {latestDispatchedEmail.otpCode || currentDemoOtp}
                      </span>
                    </div>
                  </div>
                )}

                {/* Expiry & Countdown Strip */}
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-950">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Code expires in:</span>
                  </div>
                  <span className={`font-mono font-bold text-sm ${secondsRemaining < 60 ? 'text-red-600 animate-pulse' : 'text-neutral-950'}`}>
                    {formatCountdown(secondsRemaining)}
                  </span>
                </div>

                {/* Interactive Developer OTP Test Scenarios */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5 text-xs text-amber-950">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Developer Verification Test Scenarios</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs pt-1">
                    <button
                      type="button"
                      onClick={handleTestSuccessfulOtp}
                      className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold hover:bg-emerald-200 transition-colors cursor-pointer"
                    >
                      ✓ Test Valid OTP ({currentDemoOtp})
                    </button>
                    <button
                      type="button"
                      onClick={handleTestIncorrectOtp}
                      className="px-2.5 py-1 rounded-lg bg-red-100 text-red-900 border border-red-300 font-semibold hover:bg-red-200 transition-colors cursor-pointer"
                    >
                      ✗ Test Incorrect OTP (000000)
                    </button>
                    <button
                      type="button"
                      onClick={handleTestExpiredOtp}
                      className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-950 border border-amber-400 font-semibold hover:bg-amber-300 transition-colors cursor-pointer"
                    >
                      ⚠ Test Expired OTP
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      ↻ Resend OTP
                    </button>
                  </div>
                </div>

                {otpError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{otpError}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyAndCreateAccount} className="space-y-4">
                  <div>
                    <label htmlFor="reg-otp" className="block text-xs font-semibold text-neutral-800 mb-1">
                      Enter 6-Digit Email Verification Code *
                    </label>
                    <input
                      id="reg-otp"
                      type="text"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => {
                        setVerificationCode(e.target.value);
                        setOtpError('');
                      }}
                      placeholder="e.g. 842106"
                      required
                      className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-base font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-neutral-950"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep('form')}
                      className="w-1/3 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-semibold text-xs border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>

                    <button
                      type="submit"
                      className="w-2/3 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Verify & Create Account</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 3: Registration Successful Screen */}
            {step === 'completed' && (
              <div className="space-y-6 text-center py-2">
                <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="font-display text-2xl font-extrabold text-neutral-950">
                    Registration Successful!
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-600 max-w-sm mx-auto">
                    Your applicant account has been verified and registered. Your unique application code has been generated.
                  </p>
                </div>

                {/* Generated MAA Application Code Card */}
                <div className="p-5 bg-neutral-950 text-white rounded-2xl border border-neutral-800 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#FFC20E]" />
                      <span>Official MAA Application Code</span>
                    </span>
                    <span className="text-[10px] bg-[#FFC20E] text-neutral-950 font-bold px-2 py-0.5 rounded-full">
                      ACTIVE
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                    <span className="font-mono text-2xl sm:text-3xl font-extrabold text-[#FFC20E] tracking-wider">
                      {generatedMaaCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyMaaCode}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-neutral-950 hover:bg-neutral-100 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-400">
                    Use this code to sign in and apply for scholarship or view your status pipeline.
                  </p>
                </div>

                {/* Confirmation Email Notification */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-left text-xs flex items-center gap-2.5 text-emerald-950">
                  <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                  <p className="leading-snug">
                    Confirmation email dispatched to <strong>{email}</strong> containing your login credentials and MAA Application Code.
                  </p>
                </div>

                {/* Account Summary */}
                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-left text-xs space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-neutral-500">Applicant Name:</span>
                    <span className="font-bold text-neutral-900">{fullName}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-neutral-500">Registered Email:</span>
                    <span className="font-mono font-semibold text-neutral-900">{email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Registered Phone:</span>
                    <span className="font-mono font-semibold text-neutral-900">{phone}</span>
                  </div>
                </div>

                {/* Actions: View Status & Sign In & Apply */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleViewStatus}
                    className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-sm bg-neutral-950 text-white hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>View Status</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSignInAndApply}
                    className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Sign In & Apply</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 px-4 text-center text-xs text-neutral-400">
        MH26-05 · Maatram One Higher Education Scholarship 2026–27
      </footer>
    </div>
  );
};
