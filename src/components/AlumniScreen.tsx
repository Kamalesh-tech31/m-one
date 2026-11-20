import React, { useEffect, useMemo, useState } from 'react';
import { Building2, History, Search, Sparkles } from 'lucide-react';
import {
  normalizeCompanyName,
  VISIBLE_NORMALIZATION_RULES,
} from '../core/normalization';
import type { AppendEventInput } from '../core/store';
import type { CareerSource, PersonProfile } from '../core/types';

interface AlumniScreenProps {
  alumniList: PersonProfile[];
  actorName: string;
  readOnly?: boolean;
  onAppend: (input: AppendEventInput) => void;
  initialQuery?: string;
}

export const AlumniScreen: React.FC<AlumniScreenProps> = ({
  alumniList,
  actorName,
  readOnly = false,
  onAppend,
  initialQuery,
}) => {
  const [companyQuery, setCompanyQuery] = useState(initialQuery || 'TCS');
  const [includePastHistory, setIncludePastHistory] = useState(true);
  const [selectedAlumnusId, setSelectedAlumnusId] = useState<string>(
    alumniList[0]?.personId || 'P-2020-01'
  );

  useEffect(() => {
    if (initialQuery) {
      setCompanyQuery(initialQuery);
    }
  }, [initialQuery]);

  // Add career history event form (Admin only)
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newYear, setNewYear] = useState('2026');
  const [newSource, setNewSource] = useState<CareerSource>('self-reported');
  const [bannerMsg, setBannerMsg] = useState('');

  const queryNorm = useMemo(
    () => normalizeCompanyName(companyQuery),
    [companyQuery]
  );

  const matchingAlumni = useMemo(() => {
    const targetKey = queryNorm.canonicalKey;
    return alumniList
      .map((al) => {
        const currentNorm = al.currentCompany
          ? normalizeCompanyName(al.currentCompany)
          : null;
        const matchedEntries = al.careerHistory.filter((entry) => {
          const entryNorm = normalizeCompanyName(entry.company);
          if (!targetKey) return true;
          return (
            entryNorm.canonicalKey === targetKey ||
            entryNorm.canonicalKey.includes(targetKey)
          );
        });
        const currentMatches =
          !targetKey ||
          (currentNorm &&
            (currentNorm.canonicalKey === targetKey ||
              currentNorm.canonicalKey.includes(targetKey)));

        if (includePastHistory ? matchedEntries.length > 0 : currentMatches) {
          return {
            person: al,
            currentNorm,
            matchedEntries,
          };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [alumniList, queryNorm.canonicalKey, includePastHistory]);

  const activeAlumnus =
    alumniList.find((a) => a.personId === selectedAlumnusId) || alumniList[0];

  const handleAddCareerEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !activeAlumnus || !newCompany.trim() || !newRole.trim()) {
      return;
    }
    onAppend({
      type: 'CAREER_HISTORY_ADDED',
      personId: activeAlumnus.personId,
      cycleId: activeAlumnus.cycleId,
      actor: actorName,
      payload: {
        entryId: `CH-${Date.now().toString(36).toUpperCase()}`,
        company: newCompany.trim(),
        roleTitle: newRole.trim(),
        startYear: Number(newYear) || 2026,
        source: newSource,
      },
    });
    setNewCompany('');
    setNewRole('');
    setBannerMsg(
      `Career history appended for ${activeAlumnus.name} by ${actorName}. Current profile rebuilt by replaying events.`
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
                {readOnly ? 'Alumni Directory (Read-Only)' : 'Alumni Career Tracker'}
              </span>
              <span className="text-xs font-semibold tabular-nums text-neutral-600">
                {alumniList.length} tracked alumni profiles
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
              Replayable Career <span className="heading-highlight">History</span> & Company Query
            </h1>
            <p className="text-sm text-neutral-600">
              Current job profiles are built by replaying career events with source attribution and deterministic company name normalization.
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

      {/* Company Query + Visible Normalization Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="border-b border-neutral-200 pb-3">
            <p className="section-kicker">COMPANY NORMALIZATION QUERY</p>
            <h2 className="font-display text-lg font-bold text-neutral-950 mt-0.5">
              Query: &ldquo;Which alumni work at a given company?&rdquo;
            </h2>
            <p className="text-xs text-neutral-600">
              Try searching <span className="font-mono">TCS</span>,{' '}
              <span className="font-mono">Tata Consultancy Services Pvt Ltd</span>,{' '}
              <span className="font-mono">CTS</span>,{' '}
              <span className="font-mono">Zoho</span>, or{' '}
              <span className="font-mono">Infosys Limited</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Company name query"
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
                placeholder="Search company (e.g. TCS, Cognizant, Zoho)..."
                className="w-full border border-neutral-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700 whitespace-nowrap">
              <input
                type="checkbox"
                checked={includePastHistory}
                onChange={(e) => setIncludePastHistory(e.target.checked)}
              />
              <span>Include past roles</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              'TCS',
              'Tata Consultancy Services Pvt Ltd',
              'CTS',
              'Zoho',
              'Infosys Limited',
              'Freshworks',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setCompanyQuery(sample)}
                className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-mono text-neutral-900"
              >
                {sample}
              </button>
            ))}
          </div>

          {/* Live Normalization Trace */}
          {companyQuery.trim() && (
            <div className="border border-neutral-200 bg-neutral-50 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-neutral-500">Query normalized to: </span>
                <span className="font-bold text-neutral-950">
                  {queryNorm.normalized}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {queryNorm.appliedRules.length === 0 ? (
                  <span className="text-neutral-500">Exact canonical match</span>
                ) : (
                  queryNorm.appliedRules.map((rule) => (
                    <span
                      key={rule}
                      className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    >
                      {rule}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="py-2 pr-3 font-semibold">Alumnus</th>
                  <th className="py-2 pr-3 font-semibold">Raw Employer String</th>
                  <th className="py-2 pr-3 font-semibold">Normalized Company</th>
                  <th className="py-2 pr-3 font-semibold">Role</th>
                  <th className="py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {matchingAlumni.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-4 text-center text-neutral-500"
                    >
                      No alumni matched &ldquo;{companyQuery}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  matchingAlumni.map(({ person, matchedEntries }) => {
                    const entry =
                      matchedEntries[matchedEntries.length - 1] ||
                      person.careerHistory[person.careerHistory.length - 1];
                    const norm = entry
                      ? normalizeCompanyName(entry.company)
                      : null;
                    return (
                      <tr
                        key={person.personId}
                        className="hover:bg-neutral-50 cursor-pointer"
                        onClick={() => setSelectedAlumnusId(person.personId)}
                      >
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-neutral-950">
                            {person.name}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {person.region}
                            {person.roles.includes('anchor') && ' · Active Anchor'}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-neutral-700">
                          {entry?.company || person.currentCompany || '—'}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold text-neutral-950">
                          {norm?.normalized || '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-neutral-700">
                          {entry?.roleTitle || person.currentRoleTitle || '—'}
                        </td>
                        <td className="py-2.5">
                          <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                            {entry?.source || 'placement'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Visible Normalization Rules Card */}
        <section className="lg:col-span-5 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <Sparkles className="w-5 h-5 text-neutral-950" aria-hidden="true" />
            <div>
              <p className="section-kicker">DETERMINISTIC RULES</p>
              <h2 className="font-display text-lg font-bold text-neutral-950">
                Visible Normalization Rules
              </h2>
            </div>
          </div>

          <ul className="space-y-2 text-xs text-neutral-700">
            {VISIBLE_NORMALIZATION_RULES.map((rule) => (
              <li
                key={rule}
                className="p-2.5 rounded-xl border border-neutral-200 bg-neutral-50"
              >
                {rule}
              </li>
            ))}
          </ul>

          <div className="border-t border-neutral-200 pt-3">
            <p className="text-xs font-bold text-neutral-950 mb-2">
              Alias Table Highlights
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                TCS → Tata Consultancy Services
              </div>
              <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                CTS → Cognizant
              </div>
              <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                INFY → Infosys
              </div>
              <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                HCL → HCLTech
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Per-Alumnus Replayable Career History */}
      {activeAlumnus && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-neutral-950" aria-hidden="true" />
              <div>
                <h2 className="font-display text-lg font-bold text-neutral-950">
                  Career History Replay — {activeAlumnus.name}
                </h2>
                <p className="text-xs text-neutral-600">
                  Current role derived by folding {activeAlumnus.careerHistory.length} career events:{' '}
                  <span className="font-semibold text-neutral-950">
                    {activeAlumnus.currentRoleTitle || 'Engineer'} @{' '}
                    {activeAlumnus.currentCompany
                      ? normalizeCompanyName(activeAlumnus.currentCompany)
                          .normalized
                      : '—'}
                  </span>
                </p>
              </div>
            </div>

            <select
              aria-label="Select alumnus"
              value={activeAlumnus.personId}
              onChange={(e) => setSelectedAlumnusId(e.target.value)}
              className="w-full sm:w-auto max-w-full min-w-0 border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {alumniList.map((al) => (
                <option key={al.personId} value={al.personId}>
                  {al.name} ({al.personId})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <ol className={`${readOnly ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-2.5`}>
              {activeAlumnus.careerHistory.map((entry) => {
                const norm = normalizeCompanyName(entry.company);
                return (
                  <li
                    key={entry.entryId}
                    className="border border-neutral-200 rounded-xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <Building2
                        className="w-4 h-4 text-neutral-700 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-bold text-neutral-950">
                          {entry.roleTitle} · {norm.normalized}
                        </p>
                        <p className="text-xs text-neutral-600 font-mono tabular-nums">
                          Raw: &ldquo;{entry.company}&rdquo; · {entry.startYear}–
                          {entry.endYear || 'Present'}
                        </p>
                      </div>
                    </div>
                    <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                      {entry.source}
                    </span>
                  </li>
                );
              })}
            </ol>

            {!readOnly && (
              <form
                onSubmit={handleAddCareerEntry}
                className="lg:col-span-5 border border-neutral-200 rounded-xl p-4 space-y-3"
              >
                <h3 className="text-sm font-bold text-neutral-950">
                  Append Career Update Event
                </h3>
                <input
                  type="text"
                  aria-label="Company name"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Company (e.g. TCS Pvt Ltd, Zoho)"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <input
                  type="text"
                  aria-label="Job title"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="Role title (e.g. Senior Engineer)"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    aria-label="Start year"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm font-mono tabular-nums"
                  />
                  <select
                    aria-label="Career update source"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value as CareerSource)}
                    className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                  >
                    <option value="self-reported">self-reported</option>
                    <option value="referral">referral</option>
                    <option value="placement">placement</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded-xl text-sm font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b]"
                >
                  Append Career Event
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
