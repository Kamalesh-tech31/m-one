import React, { useEffect, useMemo, useState } from 'react';
import { Building2, History, Search, X } from 'lucide-react';
import { normalizeCompanyName } from '../core/normalization';
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
  const [companyQuery, setCompanyQuery] = useState(initialQuery || '');
  const [includePastHistory, setIncludePastHistory] = useState(true);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  const [selectedAlumnusId, setSelectedAlumnusId] = useState<string>(
    alumniList[0]?.personId || 'P-2020-01'
  );

  useEffect(() => {
    if (initialQuery !== undefined) {
      setCompanyQuery(initialQuery);
    }
  }, [initialQuery]);

  // Options derived dynamically from alumniList for LinkedIn-style filters
  const collegeOptions = useMemo(() => {
    const set = new Set<string>();
    alumniList.forEach((a) => {
      if (a.college?.trim()) set.add(a.college.trim());
    });
    return Array.from(set).sort();
  }, [alumniList]);

  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    alumniList.forEach((a) => {
      if (a.currentCompany?.trim()) {
        const norm = normalizeCompanyName(a.currentCompany).normalized;
        set.add(norm);
      }
      a.careerHistory.forEach((ch) => {
        if (ch.company?.trim()) {
          const norm = normalizeCompanyName(ch.company).normalized;
          set.add(norm);
        }
      });
    });
    return Array.from(set).sort();
  }, [alumniList]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    alumniList.forEach((a) => {
      if (a.currentRoleTitle?.trim()) set.add(a.currentRoleTitle.trim());
      a.careerHistory.forEach((ch) => {
        if (ch.roleTitle?.trim()) set.add(ch.roleTitle.trim());
      });
    });
    return Array.from(set).sort();
  }, [alumniList]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    alumniList.forEach((a) => {
      if (a.region?.trim()) set.add(a.region.trim());
    });
    return Array.from(set).sort();
  }, [alumniList]);

  const hasActiveFilters = Boolean(
    companyQuery.trim() ||
      selectedCollege ||
      selectedCompany ||
      selectedRole ||
      selectedLocation
  );

  const handleClearFilters = () => {
    setCompanyQuery('');
    setSelectedCollege('');
    setSelectedCompany('');
    setSelectedRole('');
    setSelectedLocation('');
  };

  // Add career history event form (Admin only)
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newYear, setNewYear] = useState('2026');
  const [newSource, setNewSource] = useState<CareerSource>('self-reported');
  const [bannerMsg, setBannerMsg] = useState('');

  useEffect(() => {
    if (bannerMsg) {
      const timer = setTimeout(() => setBannerMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [bannerMsg]);

  const queryNorm = useMemo(
    () => normalizeCompanyName(companyQuery),
    [companyQuery]
  );

  const matchingAlumni = useMemo(() => {
    const targetKey = queryNorm.canonicalKey;
    const selectedCompanyNorm = selectedCompany
      ? normalizeCompanyName(selectedCompany).canonicalKey
      : null;

    return alumniList
      .map((al) => {
        // 1. College filter
        if (selectedCollege && al.college !== selectedCollege) {
          return null;
        }

        // 2. Location filter
        if (selectedLocation && al.region !== selectedLocation) {
          return null;
        }

        // 3. Current company & role normalization
        const currentNorm = al.currentCompany
          ? normalizeCompanyName(al.currentCompany)
          : null;

        // 4. Job role check
        const roleMatchesCurrent = Boolean(
          !selectedRole ||
            (al.currentRoleTitle &&
              al.currentRoleTitle.toLowerCase().trim() ===
                selectedRole.toLowerCase().trim())
        );

        const matchedRoleEntries = al.careerHistory.filter((entry) => {
          if (!selectedRole) return true;
          return (
            entry.roleTitle &&
            entry.roleTitle.toLowerCase().trim() ===
              selectedRole.toLowerCase().trim()
          );
        });

        const passesRole = includePastHistory
          ? roleMatchesCurrent || matchedRoleEntries.length > 0
          : roleMatchesCurrent;

        if (!passesRole) {
          return null;
        }

        // 5. Company filter dropdown check
        const companyMatchesCurrent = Boolean(
          !selectedCompanyNorm ||
            (currentNorm &&
              (currentNorm.canonicalKey === selectedCompanyNorm ||
                currentNorm.canonicalKey.includes(selectedCompanyNorm)))
        );

        const matchedCompanyEntries = al.careerHistory.filter((entry) => {
          if (!selectedCompanyNorm) return true;
          const entryNorm = normalizeCompanyName(entry.company);
          return (
            entryNorm.canonicalKey === selectedCompanyNorm ||
            entryNorm.canonicalKey.includes(selectedCompanyNorm)
          );
        });

        const passesCompanyFilter = includePastHistory
          ? companyMatchesCurrent || matchedCompanyEntries.length > 0
          : companyMatchesCurrent;

        if (!passesCompanyFilter) {
          return null;
        }

        // 6. Search by company name (companyQuery)
        const matchedQueryEntries = al.careerHistory.filter((entry) => {
          if (!targetKey) return true;
          const entryNorm = normalizeCompanyName(entry.company);
          return (
            entryNorm.canonicalKey === targetKey ||
            entryNorm.canonicalKey.includes(targetKey) ||
            entry.company.toLowerCase().includes(companyQuery.toLowerCase().trim())
          );
        });

        const currentQueryMatches =
          !targetKey ||
          (currentNorm &&
            (currentNorm.canonicalKey === targetKey ||
              currentNorm.canonicalKey.includes(targetKey))) ||
          (al.currentCompany &&
            al.currentCompany
              .toLowerCase()
              .includes(companyQuery.toLowerCase().trim()));

        const passesCompanyQuery = includePastHistory
          ? currentQueryMatches || matchedQueryEntries.length > 0
          : currentQueryMatches;

        if (!passesCompanyQuery) {
          return null;
        }

        // Matched entries to display
        const matchedEntries = al.careerHistory.filter((entry) => {
          const entryNorm = normalizeCompanyName(entry.company);
          const qMatch =
            !targetKey ||
            entryNorm.canonicalKey === targetKey ||
            entryNorm.canonicalKey.includes(targetKey) ||
            entry.company
              .toLowerCase()
              .includes(companyQuery.toLowerCase().trim());
          const cMatch =
            !selectedCompanyNorm ||
            entryNorm.canonicalKey === selectedCompanyNorm ||
            entryNorm.canonicalKey.includes(selectedCompanyNorm);
          const rMatch =
            !selectedRole ||
            (entry.roleTitle &&
              entry.roleTitle.toLowerCase().trim() ===
                selectedRole.toLowerCase().trim());
          return qMatch && cMatch && rMatch;
        });

        return {
          person: al,
          currentNorm,
          matchedEntries,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [
    alumniList,
    queryNorm.canonicalKey,
    companyQuery,
    selectedCompany,
    selectedCollege,
    selectedRole,
    selectedLocation,
    includePastHistory,
  ]);

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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
            Alumni Career Tracker
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Query alumni by employer and inspect normalized career timelines.
          </p>
        </div>
        <div className="text-xs font-semibold tabular-nums text-neutral-600 self-start sm:self-center">
          {alumniList.length} tracked alumni profiles
        </div>
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

      {/* Alumni Search & Directory */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
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
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700 whitespace-nowrap self-center">
              <input
                type="checkbox"
                checked={includePastHistory}
                onChange={(e) => setIncludePastHistory(e.target.checked)}
              />
              <span>Include past roles</span>
            </label>
          </div>

          {/* LinkedIn-style Filters Bar */}
          <div className="border border-neutral-200 rounded-xl p-3.5 bg-neutral-50/70 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Filters
                </span>
                <span className="text-[11px] font-medium text-neutral-500">
                  ({matchingAlumni.length} of {alumniList.length} alumni)
                </span>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-900 hover:text-neutral-600 underline"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear filters</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* College Filter */}
              <div>
                <label
                  htmlFor="filter-college"
                  className="block text-[11px] font-semibold text-neutral-600 mb-1"
                >
                  College
                </label>
                <select
                  id="filter-college"
                  value={selectedCollege}
                  onChange={(e) => setSelectedCollege(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                >
                  <option value="">All Colleges</option>
                  {collegeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Filter */}
              <div>
                <label
                  htmlFor="filter-company"
                  className="block text-[11px] font-semibold text-neutral-600 mb-1"
                >
                  Company
                </label>
                <select
                  id="filter-company"
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                >
                  <option value="">All Companies</option>
                  {companyOptions.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Job Role Filter */}
              <div>
                <label
                  htmlFor="filter-role"
                  className="block text-[11px] font-semibold text-neutral-600 mb-1"
                >
                  Job Role
                </label>
                <select
                  id="filter-role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                >
                  <option value="">All Job Roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <label
                  htmlFor="filter-location"
                  className="block text-[11px] font-semibold text-neutral-600 mb-1"
                >
                  Location
                </label>
                <select
                  id="filter-location"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                >
                  <option value="">All Locations</option>
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-neutral-500 mr-1">
              Sample queries:
            </span>
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
                      No alumni matched the active filters.
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="ml-2 font-semibold text-neutral-900 underline"
                        >
                          Clear filters
                        </button>
                      )}
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
                            {person.college && ` · ${person.college}`}
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
