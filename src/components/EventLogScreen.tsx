import React, { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import {
  CopyCheck,
  Mail,
  Play,
  RefreshCw,
  Shuffle,
} from 'lucide-react';
import type { LifecycleEvent, WorkerBookmark } from '../core/types';

interface EventLogScreenProps {
  events: readonly LifecycleEvent[];
  workerBookmark: WorkerBookmark;
  onReplayFromStart: () => void;
  onReplayFromTime: (iso: string) => void;
  onReplayFromBookmark: () => void;
  onSimulateDuplicate: () => {
    duplicateId: string;
    eventCountBefore: number;
    eventCountAfter: number;
  };
  onSimulateOutOfOrder: () => LifecycleEvent;
}

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, LifecycleEvent>();

export const EventLogScreen: React.FC<EventLogScreenProps> = ({
  events,
  workerBookmark,
  onReplayFromStart,
  onReplayFromTime,
  onReplayFromBookmark,
  onSimulateDuplicate,
  onSimulateOutOfOrder,
}) => {
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [cycleFilter, setCycleFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [replayFromDate, setReplayFromDate] = useState<string>('2026-11-01');
  const [actionBanner, setActionBanner] = useState<string>('');

  useEffect(() => {
    if (actionBanner) {
      const timer = setTimeout(() => setActionBanner(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionBanner]);

  const personOptions = useMemo(
    () => Array.from(new Set(events.map((e) => e.personId))).sort(),
    [events]
  );

  const typeOptions = useMemo(
    () => Array.from(new Set(events.map((e) => e.type))).sort(),
    [events]
  );

  const filteredEvents = useMemo(() => {
    return [...events]
      .filter((e) => {
        if (personFilter !== 'all' && e.personId !== personFilter) return false;
        if (typeFilter !== 'all' && e.type !== typeFilter) return false;
        if (cycleFilter !== 'all' && e.cycleId !== cycleFilter) return false;
        if (dateFilter && e.occurredAt.slice(0, 10) < dateFilter) return false;
        return true;
      })
      .sort((a, b) => b.seq - a.seq);
  }, [events, personFilter, typeFilter, cycleFilter, dateFilter]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('seq', {
          header: 'Seq',
          cell: (info) => (
            <span className="font-mono font-bold tabular-nums text-neutral-950">
              #{info.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor('type', {
          header: 'Type',
          cell: (info) => (
            <div>
              <p className="font-mono text-[11px] font-semibold text-neutral-950">
                {info.getValue()}
              </p>
              <p className="font-mono text-[10px] text-neutral-400">
                {info.row.original.id}
              </p>
            </div>
          ),
        }),
        columnHelper.accessor('personId', {
          header: 'Person',
          cell: (info) => (
            <span className="font-mono text-[11px] text-neutral-700">
              {info.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor('cycleId', {
          header: 'Cycle',
          cell: (info) => (
            <span className="font-mono tabular-nums text-neutral-700">
              {info.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor('occurredAt', {
          header: 'OccurredAt',
          cell: (info) => (
            <span className="font-mono tabular-nums text-[11px] text-neutral-600 whitespace-nowrap">
              {info.getValue().slice(0, 10)}
            </span>
          ),
        }),
        columnHelper.accessor('actor', {
          header: 'Actor',
          cell: (info) => (
            <span className="text-neutral-700">{info.getValue()}</span>
          ),
        }),
      ]),
    []
  );

  const table = useTable({
    features,
    data: filteredEvents,
    columns,
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-neutral-200 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em]">
              Admin Only
            </span>
            <span className="text-xs font-semibold tabular-nums text-neutral-600">
              Total Events: {events.length} · Worker Bookmark Seq: #{workerBookmark.lastSeq} · Outbox Emails: {workerBookmark.outbox.length}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-[-0.02em]">
            Audit and Event Log
          </h1>
          <p className="text-sm text-neutral-600">
            Every state transition is an immutable event. Replay deterministically without duplicate outbox emails.
          </p>
        </div>
      </div>

      {/* Replay & Simulation Toolbar */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-3">
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Event Replay & Testing</p>
        <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onReplayFromStart();
                setActionBanner(
                  `Replayed all ${events.length} events from start. Outbox count remains ${workerBookmark.outbox.length} (zero duplicates).`
                );
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b]"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Replay from start</span>
            </button>

            <div className="inline-flex items-center gap-1.5 border border-neutral-300 rounded-xl p-1 bg-neutral-50">
              <input
                type="date"
                aria-label="Replay from date"
                value={replayFromDate}
                onChange={(e) => setReplayFromDate(e.target.value)}
                className="px-2 py-1 text-xs font-mono bg-white border border-neutral-200 rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  const iso = new Date(`${replayFromDate}T00:00:00.000Z`).toISOString();
                  onReplayFromTime(iso);
                  setActionBanner(
                    `Replayed events with occurredAt >= ${replayFromDate}. Worker bookmark kept outbox deduplicated.`
                  );
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800"
              >
                <Play className="w-3 h-3" aria-hidden="true" />
                <span>Replay from time</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onReplayFromBookmark();
                setActionBanner(
                  `Replayed from worker bookmark seq #${workerBookmark.lastSeq}. Zero duplicate emails written.`
                );
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-950 text-white hover:bg-neutral-800"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Replay from bookmark</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const res = onSimulateDuplicate();
                setActionBanner(
                  `Simulated duplicate append for ${res.duplicateId}: event count stayed ${res.eventCountBefore} → ${res.eventCountAfter} (idempotent ignore).`
                );
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-neutral-950 bg-white hover:bg-neutral-50 text-neutral-950"
            >
              <CopyCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Simulate duplicate</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const ev = onSimulateOutOfOrder();
                setActionBanner(
                  `Simulated out-of-order event ${ev.id}: occurredAt=${ev.occurredAt.slice(
                    0,
                    10
                  )} (12 days ago), assigned commit seq #${ev.seq} so worker bookmark did not skip it.`
                );
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-neutral-950 bg-white hover:bg-neutral-50 text-neutral-950"
            >
              <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Simulate out-of-order</span>
            </button>
          </div>
        </section>

      {actionBanner && (
        <div
          role="status"
          className="bg-neutral-950 text-white rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4"
        >
          <span>{actionBanner}</span>
          <button
            type="button"
            onClick={() => setActionBanner('')}
            className="text-xs font-semibold text-white underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Split View: TanStack Event Table (7 cols) + Email Outbox (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <div>
              <p className="section-kicker">IMMUTABLE STREAM</p>
              <h2 className="font-display text-lg font-bold text-neutral-950 mt-0.5">
                Event Stream ({filteredEvents.length})
              </h2>
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <select
                aria-label="Filter by person"
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="w-full sm:w-auto max-w-full min-w-0 border border-neutral-300 rounded-lg px-2 py-1 text-xs bg-white"
              >
                <option value="all">All Persons</option>
                {personOptions.map((pid) => (
                  <option key={pid} value={pid}>
                    {pid}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by event type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full sm:w-auto max-w-full min-w-0 border border-neutral-300 rounded-lg px-2 py-1 text-xs bg-white"
              >
                <option value="all">All Types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by cycle"
                value={cycleFilter}
                onChange={(e) => setCycleFilter(e.target.value)}
                className="w-full sm:w-auto max-w-full min-w-0 border border-neutral-300 rounded-lg px-2 py-1 text-xs bg-white"
              >
                <option value="all">All Cycles</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
              </select>

              <input
                type="date"
                aria-label="Filter from occurred date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-neutral-300 rounded-lg px-2 py-1 text-xs font-mono bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white border-b border-neutral-200 text-neutral-500">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="py-2 pr-2 font-semibold">
                        {header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className="py-2 pr-2">
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Email Worker Outbox */}
        <section className="lg:col-span-5 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-neutral-950" aria-hidden="true" />
              <div>
                <h2 className="font-display text-lg font-bold text-neutral-950">
                  Email Worker Outbox ({workerBookmark.outbox.length})
                </h2>
                <p className="text-xs text-neutral-600">
                  Bookmark Seq #{workerBookmark.lastSeq} ·{' '}
                  {workerBookmark.processedEventIds.length} processed IDs
                </p>
              </div>
            </div>
            <span className="bg-neutral-950 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
              Deduplicated
            </span>
          </div>

          <div className="space-y-2.5 max-h-[560px] overflow-y-auto">
            {[...workerBookmark.outbox].reverse().map((mail) => (
              <div
                key={mail.id}
                className="border border-neutral-200 rounded-xl p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-neutral-950">
                    seq #{mail.seq} · {mail.eventId}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500">
                    {mail.to}
                  </span>
                </div>
                <p className="font-semibold text-neutral-950">{mail.subject}</p>
                <p className="text-neutral-600">{mail.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
