import React, { useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  KeyRound,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  DEMO_ACCOUNTS,
  verifyRoleCredentials,
} from '../core/scoping';
import type { AuthSessionUser, UserRole } from '../core/types';
import { DEMO_ADMIN_OTP, verifyAdminOtp } from '../core/validation';

interface LoginScreenProps {
  onLogin: (user: AuthSessionUser) => void;
  onStartPublicApplication: () => void;
  setAdminOtpVerified?: (verified: boolean) => void;
}

const ROLES_LIST: Array<{
  role: UserRole;
  title: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
    {
      role: 'applicant',
      title: 'Applicant',
      tagline: 'Track your application',
      icon: FileText,
    },
    {
      role: 'student',
      title: 'Student',
      tagline: 'Learning and volunteering',
      icon: GraduationCap,
    },
    {
      role: 'anchor',
      title: 'Anchor',
      tagline: 'Mentor your cohort',
      icon: Users,
    },
    {
      role: 'admin',
      title: 'Admin',
      tagline: 'Review and verify',
      icon: ShieldCheck,
    },
  ];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onStartPublicApplication,
  setAdminOtpVerified,
}) => {
  const { role: urlRole } = useParams<{ role?: string }>();
  const navigate = useNavigate();

  const selectedRole = (
    urlRole && ['applicant', 'student', 'anchor', 'admin'].includes(urlRole)
      ? urlRole
      : null
  ) as UserRole | null;

  // Form states for role login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoCreds, setShowDemoCreds] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Admin mock OTP states
  const [adminAwaitingOtp, setAdminAwaitingOtp] = useState(false);
  const [pendingAdminUser, setPendingAdminUser] = useState<AuthSessionUser | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  // Prefill registered code or email
  React.useEffect(() => {
    try {
      if (selectedRole === 'applicant') {
        const lastRegCode = localStorage.getItem('maatram_last_registered_code');
        const lastRegEmail = localStorage.getItem('maatram_last_registered_email');
        if (lastRegCode) {
          setEmail(lastRegCode);
        } else if (lastRegEmail) {
          setEmail(lastRegEmail);
        }
      }
    } catch {
      // ignore
    }
  }, [selectedRole]);

  const currentRoleConfig = selectedRole
    ? ROLES_LIST.find((r) => r.role === selectedRole)
    : null;

  const handleUseDemoAccount = () => {
    if (!selectedRole) return;
    const creds = DEMO_ACCOUNTS[selectedRole];
    setEmail(creds.email);
    setPassword(creds.password);
    setErrorMsg('');
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setErrorMsg('');

    const result = verifyRoleCredentials(selectedRole, email, password);
    if (!result.valid || !result.user) {
      setErrorMsg(result.error || 'Invalid credentials.');
      return;
    }

    // Admin role requires mock OTP screen (OTP 123456)
    if (selectedRole === 'admin') {
      setPendingAdminUser(result.user);
      setAdminAwaitingOtp(true);
      setOtpInput('');
      setOtpError('');
      return;
    }

    onLogin(result.user);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAdminUser) return;
    const otpCheck = verifyAdminOtp(otpInput);
    if (!otpCheck.valid) {
      setOtpError(otpCheck.error || 'Invalid OTP.');
      return;
    }
    if (setAdminOtpVerified) {
      setAdminOtpVerified(true);
    }
    onLogin(pendingAdminUser);
  };

  const handleBackToRoles = () => {
    setEmail('');
    setPassword('');
    setErrorMsg('');
    setAdminAwaitingOtp(false);
    setPendingAdminUser(null);
    navigate('/login');
  };

  // If no role selected, show the Role Selector card (/login)
  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-white text-neutral-950 flex flex-col justify-between">
        {/* Simple top bar / header */}
        <header className="border-b border-neutral-200 bg-white">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-1.5">
              <span className="font-display text-xl font-extrabold tracking-[-0.02em] text-neutral-950">
                Maatram
              </span>
              <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight">
                One
              </span>
            </Link>
            <Link
              to="/"
              className="text-xs font-semibold text-neutral-600 hover:text-neutral-950"
            >
              Back to Home
            </Link>
          </div>
        </header>

        {/* Centered card with wordmark, sign-in line, and 4 stacked role cards */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5">
                <span className="font-display text-2xl font-extrabold tracking-[-0.02em] text-neutral-950">
                  Maatram
                </span>
                <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight">
                  One
                </span>
              </div>
              <p className="text-sm text-neutral-600">
                Sign in to your Maatram One workspace
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                SELECT PORTAL ROLE
              </p>

              <div className="space-y-2.5">
                {ROLES_LIST.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => navigate(`/login/${item.role}`)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border border-neutral-200 hover:border-neutral-950 hover:bg-neutral-50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-900 group-hover:bg-neutral-950 group-hover:text-white transition-colors shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-display text-sm font-bold text-neutral-950">
                            {item.title}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {item.tagline}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-950 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        <footer className="border-t border-neutral-200 bg-white py-4 px-4 sm:px-6">
          <div className="max-w-[1280px] mx-auto text-center text-xs text-neutral-400">
            MH26-05
          </div>
        </footer>
      </div>
    );
  }

  // Role-specific sign-in view (/login/applicant, /login/student, /login/anchor, /login/admin)
  const roleTitle = `${currentRoleConfig?.title || 'User'} sign in`;
  const demoAccountInfo = DEMO_ACCOUNTS[selectedRole];

  return (
    <div className="min-h-screen bg-white text-neutral-950 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5">
            <span className="font-display text-xl font-extrabold tracking-[-0.02em] text-neutral-950">
              Maatram
            </span>
            <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight">
              One
            </span>
          </Link>
          <button
            type="button"
            onClick={handleBackToRoles}
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-950"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to roles</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
              {adminAwaitingOtp ? 'Admin Verification Code' : roleTitle}
            </h1>
            <p className="text-xs text-neutral-500">
              {adminAwaitingOtp
                ? 'Enter the 6-digit one-time code to confirm your administrative access.'
                : selectedRole === 'applicant'
                  ? 'Sign in with your MAA Application Code or registered email to continue or track your application.'
                  : `Enter your credentials to access the ${currentRoleConfig?.title.toLowerCase()} portal.`}
            </p>
          </div>

          {adminAwaitingOtp ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-otp-input"
                  className="block text-xs font-bold text-neutral-900"
                >
                  6-Digit OTP Code
                </label>
                <input
                  id="admin-otp-input"
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value);
                    setOtpError('');
                  }}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 font-mono text-center tracking-widest text-lg font-bold"
                  autoFocus
                />
                <p className="text-[11px] text-neutral-400">
                  Demo hint: Use verification code <span className="font-mono font-bold text-neutral-700">{DEMO_ADMIN_OTP}</span>
                </p>
              </div>

              {otpError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-medium">
                  {otpError}
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors cursor-pointer"
              >
                <span>Verify & Sign in</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setAdminAwaitingOtp(false)}
                className="w-full text-center text-xs font-semibold text-neutral-500 hover:text-neutral-950 cursor-pointer"
              >
                Change login credentials
              </button>
            </form>
          ) : (
            /* Regular Credentials Form */
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="block text-xs font-bold text-neutral-900"
                >
                  {selectedRole === 'applicant'
                    ? 'MAA Application Code or Registered Email'
                    : 'Email Address'}
                </label>
                <input
                  id="login-email"
                  type={selectedRole === 'applicant' ? 'text' : 'email'}
                  autoComplete={selectedRole === 'applicant' ? 'username' : 'email'}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder={
                    selectedRole === 'applicant'
                      ? 'e.g. MAA-2026-7925 or applicant@demo.local'
                      : `e.g. ${demoAccountInfo.email}`
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 text-sm font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold text-neutral-900"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Enter password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Exactly ONE yellow primary button per page */}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors"
              >
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Applicant page specific: "New here? Create account" */}
              {selectedRole === 'applicant' && (
                <div className="text-center pt-2">
                  <Link
                    to="/register"
                    className="text-xs font-semibold text-neutral-700 hover:text-neutral-950 underline underline-offset-2"
                  >
                    New here? Create account
                  </Link>
                </div>
              )}

              {/* Collapsible Demo credentials box */}
              <div className="pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowDemoCreds(!showDemoCreds)}
                  className="w-full flex items-center justify-between text-xs text-neutral-500 hover:text-neutral-900 font-medium py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Demo credentials</span>
                  </span>
                  {showDemoCreds ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showDemoCreds && (
                  <div className="mt-2 p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 text-xs">
                    <div className="space-y-1">
                      <p className="text-neutral-600">
                        <span className="font-semibold text-neutral-900">Email:</span>{' '}
                        <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                          {demoAccountInfo.email}
                        </code>
                      </p>
                      <p className="text-neutral-600">
                        <span className="font-semibold text-neutral-900">Password:</span>{' '}
                        <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                          {demoAccountInfo.password}
                        </code>
                      </p>
                      {selectedRole === 'applicant' && (
                        <p className="text-neutral-600">
                          <span className="font-semibold text-neutral-900">Generated Code:</span>{' '}
                          <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                            APP-2026-07
                          </code>
                        </p>
                      )}
                      {selectedRole === 'applicant' && (
                        <p className="text-neutral-600">
                          <span className="font-semibold text-neutral-900">Generated Code:</span>{' '}
                          <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                            APP-2026-07
                          </code>
                        </p>
                      )}
                      <p className="text-[11px] text-neutral-500 italic">
                        {demoAccountInfo.subtitle}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleUseDemoAccount}
                      className="w-full py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 font-semibold text-neutral-900 text-xs transition-colors"
                    >
                      Use demo account
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleBackToRoles}
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-950"
            >
              ← Back to roles
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t border-neutral-200 bg-white py-4 px-4 sm:px-6">
        <div className="max-w-[1280px] mx-auto text-center text-xs text-neutral-400">
          MH26-05
        </div>
      </footer>
    </div>
  );
};
