import React, { useState } from 'react';
import { ArrowRight, KeyRound, Play, RotateCcw, ShieldCheck, UserPlus } from 'lucide-react';
import { DEMO_ACCOUNTS, verifyRoleCredentials } from '../core/scoping';
import type { AuthSessionUser, UserRole } from '../core/types';

interface LoginScreenProps {
  onLogin: (user: AuthSessionUser) => void;
  onStartPublicApplication: () => void;
  onStartGuidedDemo: () => void;
  onResetDemo: () => void;
}

const ROLE_ORDER: UserRole[] = ['applicant', 'student', 'anchor', 'admin'];

const ROLE_LABELS: Record<UserRole, string> = {
  applicant: 'Applicant',
  student: 'Student',
  anchor: 'Anchor',
  admin: 'Admin',
};

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onStartPublicApplication,
  onStartGuidedDemo,
  onResetDemo,
}) => {
  const [credentials, setCredentials] = useState<
    Record<UserRole, { email: string; password: string }>
  >({
    applicant: {
      email: DEMO_ACCOUNTS.applicant.email,
      password: DEMO_ACCOUNTS.applicant.password,
    },
    student: {
      email: DEMO_ACCOUNTS.student.email,
      password: DEMO_ACCOUNTS.student.password,
    },
    anchor: {
      email: DEMO_ACCOUNTS.anchor.email,
      password: DEMO_ACCOUNTS.anchor.password,
    },
    admin: {
      email: DEMO_ACCOUNTS.admin.email,
      password: DEMO_ACCOUNTS.admin.password,
    },
  });

  const [errors, setErrors] = useState<Partial<Record<UserRole, string>>>({});
  const [resetBanner, setResetBanner] = useState<string>('');

  const handleFieldChange = (
    role: UserRole,
    field: 'email' | 'password',
    value: string
  ) => {
    setCredentials((prev) => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }));
    setErrors((prev) => ({ ...prev, [role]: undefined }));
  };

  const handleRoleSignIn = (e: React.FormEvent, role: UserRole) => {
    e.preventDefault();
    const { email, password } = credentials[role];
    const result = verifyRoleCredentials(role, email, password);
    if (!result.valid || !result.user) {
      setErrors((prev) => ({ ...prev, [role]: result.error || 'Login failed.' }));
      return;
    }
    onLogin(result.user);
  };

  const handleReset = () => {
    onResetDemo();
    setResetBanner('All demo events and workspaces restored to clean seed state.');
  };

  return (
    <div className="min-h-screen bg-white text-neutral-950 flex flex-col">
      {/* Minimal Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xl font-extrabold tracking-[-0.02em] text-neutral-950">
                Maatram
              </span>
              <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight">
                One
              </span>
            </div>
            <span className="hidden sm:inline text-xs text-neutral-500 border-l border-neutral-200 pl-3">
              From application to alumni stewardship
            </span>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset demo</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {resetBanner && (
          <div
            role="status"
            className="bg-neutral-950 text-white rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4"
          >
            <span>{resetBanner}</span>
            <button
              type="button"
              onClick={() => setResetBanner('')}
              className="text-xs font-semibold text-white underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Editorial Hero Section with ONE offset #FFC20E background block */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-5">
            <p className="section-kicker">
              MAATRAM ONE (M-ONE) · ROLE-BASED PORTAL
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-neutral-950 tracking-[-0.02em] leading-[1.2]">
              One scholar journey, from first application to{' '}
              <span className="heading-highlight">alumni</span> anchor.
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 max-w-2xl leading-relaxed">
              Sign in with a role workspace below to inspect scoped applicant tracking, student academics and volunteering proof, anchor cohort stewardship, or admin verification and replayable audit logs.
            </p>

            {/* Exactly ONE yellow primary CTA on this screen */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onStartGuidedDemo}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Start 3-minute demo</span>
              </button>

              <button
                type="button"
                onClick={onStartPublicApplication}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50 transition-colors"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>New here? Start your application</span>
              </button>
            </div>
          </div>

          {/* Right Hero Image framed over ONE #FFC20E offset block */}
          <div className="lg:col-span-5 relative pb-3 pr-3">
            <div
              aria-hidden="true"
              className="absolute inset-0 translate-x-3 translate-y-3 bg-[#FFC20E] rounded-2xl"
            />
            <div className="relative bg-white border border-neutral-950 rounded-2xl overflow-hidden shadow-xs">
              <img
                src="/src/assets/images/maatram_scholars_hero_1795172873424.jpg"
                alt="Maatram scholars studying together around notebooks and a laptop"
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="bg-neutral-950 text-white px-4 py-3 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">
                  Cycle 2026–27 Open · Deadline 30 Dec 2026
                </span>
                <span className="font-mono text-[11px] text-neutral-300 tabular-nums">
                  12,480+ applicants
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Four Role Login Cards */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-neutral-200 pb-3">
            <div>
              <p className="section-kicker">ROLE SIGN-IN · SYNTHETIC DEMO ACCOUNTS</p>
              <h2 className="font-display text-2xl font-bold text-neutral-950 mt-1">
                Choose your Maatram One workspace
              </h2>
            </div>
            <p className="text-xs text-neutral-500">
              Each account opens strictly scoped navigation and data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {ROLE_ORDER.map((role) => {
              const acc = DEMO_ACCOUNTS[role];
              const creds = credentials[role];
              const err = errors[role];

              return (
                <form
                  key={role}
                  onSubmit={(e) => handleRoleSignIn(e, role)}
                  data-testid={`login-card-${role}`}
                  className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                        {ROLE_LABELS[role]}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-500">
                        {acc.personId}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-xl font-bold text-neutral-950">
                        {acc.name}
                      </h3>
                      <p className="text-xs font-medium text-neutral-800 mt-0.5 stat-underline">
                        {acc.subtitle}
                      </p>
                    </div>

                    <p className="text-xs text-neutral-600 leading-relaxed">
                      {acc.description}
                    </p>

                    <div className="space-y-2 pt-1">
                      <div>
                        <label
                          htmlFor={`login-email-${role}`}
                          className="block text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500 mb-1"
                        >
                          Email
                        </label>
                        <input
                          id={`login-email-${role}`}
                          type="email"
                          value={creds.email}
                          onChange={(e) =>
                            handleFieldChange(role, 'email', e.target.value)
                          }
                          className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`login-password-${role}`}
                          className="block text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500 mb-1"
                        >
                          Password
                        </label>
                        <input
                          id={`login-password-${role}`}
                          type="password"
                          value={creds.password}
                          onChange={(e) =>
                            handleFieldChange(role, 'password', e.target.value)
                          }
                          className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
                        />
                      </div>

                      <p className="text-[11px] font-semibold text-neutral-500 tabular-nums flex items-center gap-1">
                        {role === 'admin' ? (
                          <>
                            <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>
                              Prefilled · Next screen OTP:{' '}
                              <span className="tracking-[0.08em] font-bold text-neutral-700">
                                123456
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>Demo hint prefilled</span>
                          </>
                        )}
                      </p>
                    </div>

                    {err && (
                      <p role="alert" className="text-xs text-red-700 font-medium">
                        {err}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors"
                  >
                    <span>
                      {role === 'admin'
                        ? 'Continue to OTP'
                        : `Sign in as ${ROLE_LABELS[role]}`}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white py-4 px-4 sm:px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
          <span>
            Maatram One (M-one) · Student Lifecycle Platform · MH26-05
          </span>
          <span>
            Synthetic demo accounts only · Event-sourced in browser localStorage
          </span>
        </div>
      </footer>
    </div>
  );
};
