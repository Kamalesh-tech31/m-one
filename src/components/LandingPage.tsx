import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

interface LandingPageProps {
  onStartPublicApplication: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartPublicApplication,
}) => {
  return (
    <div className="min-h-screen bg-white text-neutral-950 flex flex-col justify-between">
      {/* Header: Maatram One wordmark on the left, one black solid "Login" button on the right. Nothing else. */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-xl font-extrabold tracking-[-0.02em] text-neutral-950">
              Maatram
            </span>
            <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight">
              One
            </span>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition-colors"
          >
            Login
          </Link>
        </div>
      </header>

      {/* Hero Section with exact layout & offset yellow block */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold text-neutral-950 tracking-[-0.02em] leading-[1.15]">
              One scholar journey, from first application to{' '}
              <span className="heading-highlight">alumni</span> anchor.
            </h1>
            <p className="text-base sm:text-lg text-neutral-600 max-w-xl leading-relaxed">
              Apply, learn, mentor and give back, all in one place.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl text-sm font-bold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors shadow-xs"
              >
                Login
              </Link>

              <button
                type="button"
                onClick={onStartPublicApplication}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold border border-neutral-950 text-neutral-950 bg-white hover:bg-neutral-50 transition-colors"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>Start your application</span>
              </button>
            </div>
          </div>

          {/* Right Hero Image framed over offset #FFC20E block */}
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
        </div>
      </main>

      {/* Footer: small, with "MH26-05" only */}
      <footer className="border-t border-neutral-200 bg-white py-4 px-4 sm:px-6">
        <div className="max-w-[1280px] mx-auto text-center text-xs text-neutral-400">
          MH26-05
        </div>
      </footer>
    </div>
  );
};
