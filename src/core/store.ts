import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  applyEvent,
  DEFAULT_APPLICATION_ANSWERS,
  foldEvents,
  INITIAL_STATE,
  processEmailWorker,
  replayFromStart,
  replayFromTime,
} from './reducer';
import { buildSeedEvents, SEED_BASE_TIME } from './seed';
import type {
  AppState,
  AuthSessionUser,
  EventType,
  LifecycleEvent,
} from './types';

export const STORAGE_KEY = 'maatram_one_events_v3';

export interface AppendEventInput {
  id?: string;
  type: EventType;
  personId: string;
  payload: Record<string, unknown>;
  occurredAt?: string;
  recordedAt?: string;
  actor: string;
  cycleId: string;
}

export function nextDeterministicTimestamp(seq: number): string {
  const baseMs = Date.parse(SEED_BASE_TIME);
  return new Date(baseMs + seq * 60_000).toISOString();
}

export function nextDeterministicEventId(seq: number): string {
  return `EVT-M1-${String(seq).padStart(4, '0')}`;
}

interface MaatramStoreState {
  events: LifecycleEvent[];
  derived: AppState;
  currentUser: AuthSessionUser | null;
  adminOtpVerified: boolean;
  append: (input: AppendEventInput) => {
    appended: boolean;
    event: LifecycleEvent;
    state: AppState;
  };
  loginUser: (user: AuthSessionUser) => void;
  logoutUser: () => void;
  updateCurrentUserName: (name: string) => void;
  startPublicApplicationDraft: () => AuthSessionUser;
  replayStart: () => AppState;
  replayTime: (occurredAtIso: string) => AppState;
  replayBookmark: () => AppState;
  simulateDuplicate: () => {
    duplicateId: string;
    eventCountBefore: number;
    eventCountAfter: number;
  };
  simulateOutOfOrder: () => LifecycleEvent;
  setAdminOtpVerified: (verified: boolean) => void;
}

const initialSeed = buildSeedEvents();
const initialDerived = foldEvents(initialSeed);

export const useMaatramStore = create<MaatramStoreState>()(
  persist(
    (set, get) => ({
      events: initialSeed,
      derived: initialDerived,
      currentUser: null,
      adminOtpVerified: false,

      append: (input) => {
        const currentEvents = get().events;
        const currentDerived = get().derived;
        const seq = currentDerived.nextSeq;
        const id = input.id || nextDeterministicEventId(seq);

        if (currentDerived.seenIds[id]) {
          const existing =
            currentEvents.find((e) => e.id === id) ||
            ({
              id,
              seq,
              type: input.type,
              personId: input.personId,
              payload: input.payload,
              occurredAt: input.occurredAt || nextDeterministicTimestamp(seq),
              recordedAt: input.recordedAt || nextDeterministicTimestamp(seq),
              actor: input.actor,
              cycleId: input.cycleId,
            } satisfies LifecycleEvent);
          return { appended: false, event: existing, state: currentDerived };
        }

        const ts = nextDeterministicTimestamp(seq);
        const event: LifecycleEvent = {
          id,
          seq,
          type: input.type,
          personId: input.personId,
          payload: input.payload,
          occurredAt: input.occurredAt || ts,
          recordedAt: input.recordedAt || ts,
          actor: input.actor,
          cycleId: input.cycleId,
        };

        const nextEvents = [...currentEvents, event];
        const nextFolded = applyEvent(currentDerived, event);
        const nextBookmark = processEmailWorker(
          nextEvents,
          currentDerived.workerBookmark,
          nextFolded.persons
        );
        const nextState: AppState = {
          ...nextFolded,
          workerBookmark: nextBookmark,
        };

        set({ events: nextEvents, derived: nextState });
        return { appended: true, event, state: nextState };
      },

      loginUser: (user) => {
        set((s) => ({
          currentUser: user,
          adminOtpVerified: user.role === 'admin' ? s.adminOtpVerified : false,
        }));
      },

      logoutUser: () => {
        set({
          currentUser: null,
          adminOtpVerified: false,
        });
      },

      updateCurrentUserName: (name) => {
        set((s) =>
          s.currentUser && name.trim()
            ? { currentUser: { ...s.currentUser, name: name.trim() } }
            : s
        );
      },

      startPublicApplicationDraft: () => {
        const persons = get().derived.persons;
        let num = 8;
        while (persons[`P-2026-${String(num).padStart(2, '0')}`]) {
          num += 1;
        }
        const pid = `P-2026-${String(num).padStart(2, '0')}`;
        const email = `applicant${num}@maatram-synthetic.edu.in`;
        const draftUser: AuthSessionUser = {
          id: pid,
          personId: pid,
          role: 'applicant',
          name: `New Applicant (${pid})`,
          email,
          subtitle: '2026 cycle · Draft saved',
        };

        get().append({
          type: 'APPLICATION_DRAFT_SAVED',
          personId: pid,
          cycleId: '2026',
          actor: draftUser.name,
          payload: {
            email,
            region: 'Chennai',
            answers: { ...DEFAULT_APPLICATION_ANSWERS },
          },
        });

        set({
          currentUser: draftUser,
          adminOtpVerified: false,
        });

        return draftUser;
      },

      replayStart: () => {
        const next = replayFromStart(get().events);
        set({ derived: next });
        return next;
      },

      replayTime: (occurredAtIso) => {
        const next = replayFromTime(
          get().events,
          occurredAtIso,
          get().derived.workerBookmark
        );
        set({ derived: next });
        return next;
      },

      replayBookmark: () => {
        const current = get().derived;
        const nextBookmark = processEmailWorker(
          get().events,
          current.workerBookmark,
          current.persons
        );
        const next = { ...current, workerBookmark: nextBookmark };
        set({ derived: next });
        return next;
      },

      simulateDuplicate: () => {
        const currentEvents = get().events;
        const target =
          currentEvents.find((e) => e.type === 'APPLICANT_SELECTED') ||
          currentEvents[currentEvents.length - 1];
        const before = currentEvents.length;
        if (target) {
          get().append({
            id: target.id,
            type: target.type,
            personId: target.personId,
            payload: target.payload,
            occurredAt: target.occurredAt,
            actor: target.actor,
            cycleId: target.cycleId,
          });
        }
        return {
          duplicateId: target?.id || 'NONE',
          eventCountBefore: before,
          eventCountAfter: get().events.length,
        };
      },

      simulateOutOfOrder: () => {
        const baseMs = Date.parse(SEED_BASE_TIME);
        const lateOccurredAt = new Date(
          baseMs - 12 * 24 * 60 * 60 * 1000
        ).toISOString();
        const { event } = get().append({
          type: 'STAGE_ADVANCED',
          personId: 'P-2026-02',
          cycleId: '2026',
          occurredAt: lateOccurredAt,
          actor: 'Field Sync (Delayed Offline Batch)',
          payload: {
            stage: 'tele_verification',
            reason:
              'Late-arriving offline tele-verification log (occurred 12 days earlier).',
          },
        });
        return event;
      },

      setAdminOtpVerified: (verified) => set({ adminOtpVerified: verified }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
      ),
      partialize: (state) => ({
        events: state.events,
        currentUser: state.currentUser,
        adminOtpVerified: state.adminOtpVerified,
      }),
      onRehydrateStorage: () => (rehydrated) => {
        if (
          rehydrated &&
          Array.isArray(rehydrated.events) &&
          rehydrated.events.length > 0
        ) {
          rehydrated.derived = foldEvents(rehydrated.events);
        }
      },
    }
  )
);

/**
 * Pure EventStore class retained for deterministic unit testing and non-React helpers.
 */
export class EventStore {
  private events: LifecycleEvent[];
  private state: AppState;

  constructor(initialEvents?: LifecycleEvent[]) {
    this.events = initialEvents ? [...initialEvents] : buildSeedEvents();
    this.state = foldEvents(this.events);
  }

  getEvents(): readonly LifecycleEvent[] {
    return this.events;
  }

  getState(): AppState {
    return this.state;
  }

  append(input: AppendEventInput): {
    appended: boolean;
    event: LifecycleEvent;
    state: AppState;
  } {
    const seq = this.state.nextSeq;
    const id = input.id || nextDeterministicEventId(seq);
    const ts = nextDeterministicTimestamp(seq);

    if (this.state.seenIds[id]) {
      const existing =
        this.events.find((e) => e.id === id) ||
        ({
          id,
          seq,
          type: input.type,
          personId: input.personId,
          payload: input.payload,
          occurredAt: input.occurredAt || ts,
          recordedAt: input.recordedAt || ts,
          actor: input.actor,
          cycleId: input.cycleId,
        } satisfies LifecycleEvent);
      return { appended: false, event: existing, state: this.state };
    }

    const event: LifecycleEvent = {
      id,
      seq,
      type: input.type,
      personId: input.personId,
      payload: input.payload,
      occurredAt: input.occurredAt || ts,
      recordedAt: input.recordedAt || ts,
      actor: input.actor,
      cycleId: input.cycleId,
    };

    this.events = [...this.events, event];
    const nextFolded = applyEvent(this.state, event);
    const nextBookmark = processEmailWorker(
      this.events,
      this.state.workerBookmark,
      nextFolded.persons
    );
    this.state = { ...nextFolded, workerBookmark: nextBookmark };
    return { appended: true, event, state: this.state };
  }
}
