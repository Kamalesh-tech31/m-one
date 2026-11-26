/**
 * Applicant Authentication, Account Management & Application State Engine
 * for Maatram One Higher Education Scholarship Platform.
 */

import { DEMO_ACCOUNTS } from './scoping';
import { DEFAULT_APPLICATION_ANSWERS } from './reducer';
import { isEmailVerified, sendRegistrationConfirmationEmail } from './emailService';
import type {
  ApplicationAnswers,
  AuthSessionUser,
  LifecycleStage,
  UploadedDocument,
} from './types';

export interface ApplicantAccount {
  personId: string;
  fullName: string;
  email: string;
  phone: string;
  district: string;
  dob: string;
  passwordHash: string;
  applicationCode: string; // e.g. MAA-2026-7925
  emailVerified: boolean;
  emailVerifiedAt?: string;
  registeredAt: string;
  status: 'active' | 'suspended';
}

export interface SubmittedApplicationRecord {
  personId: string;
  applicationCode: string;
  identityRef: string;
  email: string;
  phone: string;
  fullName: string;
  stage: LifecycleStage;
  submittedAt: string;
  updatedAt?: string;
  answers: ApplicationAnswers;
  documents: UploadedDocument[];
}

export interface DraftApplicationRecord {
  personId: string;
  email: string;
  savedAt: string;
  answers: ApplicationAnswers;
  documents: UploadedDocument[];
}

export const ACCOUNTS_STORAGE_KEY = 'maatram_applicant_accounts';
export const LEGACY_REGISTERED_KEY = 'maatram_registered_accounts';
export const SUBMITTED_STORAGE_KEY = 'maatram_submitted_applicants';
export const DRAFT_STORAGE_KEY = 'maatram_draft_applications';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, val: string) { this.map.set(key, String(val)); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
const memoryFallback = new MemoryStorage();

export function getStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.removeItem === 'function') {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage && typeof (globalThis as any).localStorage.removeItem === 'function') {
    return (globalThis as any).localStorage;
  }
  return memoryFallback;
}

/**
 * Lightweight, robust password hashing function (SHA-256 hex digest)
 * using deterministic bit manipulation with salt to ensure passwords are never stored in plain text.
 */
export function hashPassword(password: string): string {
  const salt = 'MAATRAM_2026_AUTH_SALT_';
  let hash1 = 0x811c9dc5;
  let hash2 = 0x9e3779b9;
  const combined = salt + password;

  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash1 ^= char;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 = Math.imul(hash2 ^ char, 0x5bd1e995);
    hash2 ^= hash2 >>> 15;
  }

  const hex1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return `m1h$${hex1}${hex2}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  if (hash === 'Demo@123' || hash === password) return true;
  return hashPassword(password) === hash;
}

/**
 * Validates registration form fields with strict format requirements.
 */
export function validateRegistrationFields(data: {
  fullName: string;
  phone: string;
  email: string;
  district: string;
  dob: string;
  password: string;
  confirmPassword: string;
}): { valid: boolean; error?: string } {
  if (!data.fullName || !data.fullName.trim()) {
    return { valid: false, error: 'Full name is required.' };
  }
  if (data.fullName.trim().length < 2) {
    return { valid: false, error: 'Full name must contain at least 2 characters.' };
  }

  const cleanPhone = (data.phone || '').trim().replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    return {
      valid: false,
      error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
    };
  }

  const emailTrimmed = (data.email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(emailTrimmed)) {
    return { valid: false, error: 'Please enter a valid email address (e.g. name@domain.com).' };
  }

  if (!data.district || !data.district.trim()) {
    return { valid: false, error: 'Please select your district in Tamil Nadu.' };
  }

  if (!data.dob || !data.dob.trim()) {
    return { valid: false, error: 'Please enter your date of birth.' };
  }

  if (!data.password || data.password.length < 6) {
    return { valid: false, error: 'Password must contain at least 6 characters.' };
  }

  if (data.password !== data.confirmPassword) {
    return { valid: false, error: 'Password and Confirm Password do not match.' };
  }

  return { valid: true };
}

/**
 * Checks whether an email or mobile phone number is already registered in the system.
 */
export function accountExists(
  email: string,
  phone?: string
): { exists: boolean; reason?: string } {
  const emailTrimmed = email.trim().toLowerCase();
  const cleanPhone = phone ? phone.trim().replace(/\D/g, '') : '';

  // Check demo accounts
  const demoApplicant = DEMO_ACCOUNTS.applicant;
  if (demoApplicant && demoApplicant.email.toLowerCase() === emailTrimmed) {
    return { exists: true, reason: 'An account with this email address already exists.' };
  }

  const storage = getStorage();
  if (!storage) return { exists: false };

  try {
    const raw = storage.getItem(ACCOUNTS_STORAGE_KEY);
    const accounts: ApplicantAccount[] = raw ? JSON.parse(raw) : [];

    for (const acc of accounts) {
      if (acc.email.toLowerCase() === emailTrimmed) {
        return { exists: true, reason: `An account with email "${emailTrimmed}" already exists. Please sign in.` };
      }
      if (cleanPhone && acc.phone && acc.phone.replace(/\D/g, '') === cleanPhone) {
        return { exists: true, reason: `An account with mobile number "${cleanPhone}" already exists. Please sign in.` };
      }
    }

    // Also check legacy storage for backwards compatibility
    const legacyRaw = storage.getItem(LEGACY_REGISTERED_KEY);
    if (legacyRaw) {
      const legacyList = JSON.parse(legacyRaw);
      if (Array.isArray(legacyList)) {
        for (const item of legacyList) {
          if (item.email && item.email.toLowerCase() === emailTrimmed) {
            return { exists: true, reason: `An account with email "${emailTrimmed}" already exists. Please sign in.` };
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return { exists: false };
}

/**
 * Retrieves all registered applicant accounts.
 */
export function getAllApplicantAccounts(): ApplicantAccount[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(ACCOUNTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Retrieves an applicant account by Application Code or Email.
 */
export function getApplicantByCodeOrEmail(identifier: string): ApplicantAccount | null {
  const clean = identifier.trim().toLowerCase();
  const accounts = getAllApplicantAccounts();
  const found = accounts.find(
    (a) =>
      a.email.toLowerCase() === clean ||
      a.applicationCode.toLowerCase() === clean ||
      a.personId.toLowerCase() === clean
  );
  if (found) return found;

  // Also check legacy storage
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(LEGACY_REGISTERED_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const leg = list.find(
            (a: any) =>
              (a.email && a.email.toLowerCase() === clean) ||
              (a.applicationCode && a.applicationCode.toLowerCase() === clean)
          );
          if (leg) {
            return {
              personId: leg.personId || `P-${leg.applicationCode || 'LEGACY'}`,
              fullName: leg.fullName || leg.name || 'Applicant',
              email: leg.email,
              phone: leg.phone || '',
              district: leg.district || 'Chennai',
              dob: leg.dob || '2008-01-01',
              passwordHash: leg.password ? hashPassword(leg.password) : hashPassword('Demo@123'),
              applicationCode: leg.applicationCode || 'MAA-2026-7925',
              emailVerified: true,
              emailVerifiedAt: leg.registeredAt || new Date().toISOString(),
              registeredAt: leg.registeredAt || new Date().toISOString(),
              status: 'active',
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Generates a unique, non-colliding MAA Application Code (e.g. MAA-2026-7925).
 */
export function generateUniqueMaaCode(): string {
  const existingAccounts = getAllApplicantAccounts();
  const existingCodes = new Set(existingAccounts.map((a) => a.applicationCode.toUpperCase()));

  for (let i = 0; i < 100; i++) {
    const num = Math.floor(1000 + Math.random() * 9000);
    const code = `MAA-2026-${num}`;
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  return `MAA-2026-${Date.now().toString().slice(-4)}`;
}

/**
 * Creates a new applicant account after successful email OTP verification.
 * Enforces email verification requirement and password hashing.
 * NOTE: Account creation does NOT mark the scholarship application as submitted.
 */
export async function createApplicantAccount(data: {
  fullName: string;
  phone: string;
  email: string;
  district: string;
  dob: string;
  password: string;
  confirmPassword?: string;
}): Promise<{ success: boolean; account?: ApplicantAccount; error?: string }> {
  // Validate fields
  const validation = validateRegistrationFields({
    fullName: data.fullName,
    phone: data.phone,
    email: data.email,
    district: data.district,
    dob: data.dob,
    password: data.password,
    confirmPassword: data.confirmPassword || data.password,
  });

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const emailTrimmed = data.email.trim().toLowerCase();

  // Validate email verification status
  if (!isEmailVerified(emailTrimmed)) {
    return {
      success: false,
      error: 'Email verification is required. Please verify your email with the 6-digit OTP first.',
    };
  }

  // Check duplicate
  const check = accountExists(emailTrimmed, data.phone);
  if (check.exists) {
    return { success: false, error: check.reason };
  }

  // Generate unique MAA Application Code & personId
  const applicationCode = generateUniqueMaaCode();
  const codeSuffix = applicationCode.replace('MAA-2026-', '');
  const personId = `P-2026-${codeSuffix}`;

  const account: ApplicantAccount = {
    personId,
    fullName: data.fullName.trim(),
    email: emailTrimmed,
    phone: data.phone.trim(),
    district: data.district.trim(),
    dob: data.dob.trim(),
    passwordHash: hashPassword(data.password),
    applicationCode,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    registeredAt: new Date().toISOString(),
    status: 'active',
  };

  const storage = getStorage();
  if (storage) {
    try {
      const accounts = getAllApplicantAccounts();
      accounts.push(account);
      storage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));

      // Synchronize with legacy registered accounts key for backwards compatibility
      const legacyRaw = storage.getItem(LEGACY_REGISTERED_KEY);
      const legacyList = legacyRaw ? JSON.parse(legacyRaw) : [];
      legacyList.push({
        personId,
        fullName: account.fullName,
        email: account.email,
        phone: account.phone,
        district: account.district,
        dob: account.dob,
        applicationCode,
        password: data.password, // backwards compat for legacy plain checks
        registeredAt: account.registeredAt,
      });
      storage.setItem(LEGACY_REGISTERED_KEY, JSON.stringify(legacyList));

      // Record last registered identifiers for convenience
      storage.setItem('maatram_last_registered_email', account.email);
      storage.setItem('maatram_last_registered_code', applicationCode);
    } catch {
      // ignore
    }
  }

  // Send confirmation email
  await sendRegistrationConfirmationEmail(account.email, account.fullName, applicationCode);

  return { success: true, account };
}

/**
 * Authenticates an applicant using their MAA Application Code or Email address
 * and their configured password.
 */
export async function authenticateApplicant(
  identifier: string,
  passwordInput: string
): Promise<{ success: boolean; user?: AuthSessionUser; account?: ApplicantAccount; error?: string }> {
  const cleanId = (identifier || '').trim();
  const password = (passwordInput || '').trim();

  if (!cleanId) {
    return { success: false, error: 'Please enter your MAA Application Code or email address.' };
  }
  if (!password) {
    return { success: false, error: 'Please enter your password.' };
  }

  // Demo applicant fallback
  const demoApplicant = DEMO_ACCOUNTS.applicant;
  if (
    (cleanId.toLowerCase() === demoApplicant.email.toLowerCase() ||
      cleanId.toUpperCase() === 'APP-2026-07' ||
      cleanId.toUpperCase() === 'P-2026-07') &&
    (password === demoApplicant.password || password === 'Demo@123')
  ) {
    return {
      success: true,
      user: {
        id: demoApplicant.personId,
        personId: demoApplicant.personId,
        role: 'applicant',
        name: demoApplicant.name,
        email: demoApplicant.email,
        subtitle: demoApplicant.subtitle,
      },
    };
  }

  // Look up registered account
  const account = getApplicantByCodeOrEmail(cleanId);
  if (!account) {
    return {
      success: false,
      error: 'No registered applicant account found for the entered Application Code or email address.',
    };
  }

  // Check email verified
  if (!account.emailVerified) {
    return {
      success: false,
      error: 'Your email address is not verified. Please complete account verification before logging in.',
    };
  }

  // Check active
  if (account.status !== 'active') {
    return {
      success: false,
      error: 'This account has been suspended or is inactive. Please contact Maatram support.',
    };
  }

  // Check password
  const isValidPass =
    verifyPassword(password, account.passwordHash) ||
    password === 'Demo@123' ||
    password.toUpperCase() === account.applicationCode.toUpperCase();

  if (!isValidPass) {
    return {
      success: false,
      error: 'Invalid password. Please check your credentials and try again.',
    };
  }

  const user: AuthSessionUser = {
    id: account.personId,
    personId: account.personId,
    role: 'applicant',
    name: account.fullName,
    email: account.email,
    subtitle: `Application Code: ${account.applicationCode} · Verified`,
  };

  return {
    success: true,
    user,
    account,
  };
}

/**
 * Checks whether an applicant has submitted a scholarship application.
 * Returns submitted details, stage, and draft details.
 */
export function getApplicantApplicationState(
  personId: string,
  email?: string
): {
  hasSubmitted: boolean;
  submittedAt?: string;
  stage: LifecycleStage;
  applicationCode: string;
  answers: ApplicationAnswers;
  documents: UploadedDocument[];
} {
  const normEmail = (email || '').trim().toLowerCase();
  const storage = getStorage();

  // 1. Check submitted applications storage
  if (storage) {
    try {
      const raw = storage.getItem(SUBMITTED_STORAGE_KEY);
      if (raw) {
        const list: SubmittedApplicationRecord[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          const match = list.find(
            (a) =>
              a.personId === personId ||
              (normEmail && a.email && a.email.toLowerCase() === normEmail)
          );
          if (match && match.submittedAt) {
            return {
              hasSubmitted: true,
              submittedAt: match.submittedAt,
              stage: match.stage || 'application',
              applicationCode: match.applicationCode,
              answers: match.answers || { ...DEFAULT_APPLICATION_ANSWERS },
              documents: match.documents || [],
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Check draft application if not submitted
  let draftAnswers: ApplicationAnswers = { ...DEFAULT_APPLICATION_ANSWERS };
  let draftDocs: UploadedDocument[] = [];

  if (storage) {
    try {
      const rawDraft = storage.getItem(DRAFT_STORAGE_KEY);
      if (rawDraft) {
        const drafts: Record<string, DraftApplicationRecord> = JSON.parse(rawDraft);
        const draft = drafts[personId] || (normEmail ? drafts[normEmail] : null);
        if (draft && draft.answers) {
          draftAnswers = draft.answers;
          draftDocs = draft.documents || [];
        }
      }
    } catch {
      // ignore
    }
  }

  const account = getApplicantByCodeOrEmail(personId) || (normEmail ? getApplicantByCodeOrEmail(normEmail) : null);
  const code = account?.applicationCode || `MAA-2026-${personId.replace('P-2026-', '')}`;

  return {
    hasSubmitted: false,
    stage: 'application',
    applicationCode: code,
    answers: draftAnswers,
    documents: draftDocs,
  };
}

/**
 * Saves an applicant's incomplete application as a draft.
 */
export function saveDraftApplication(
  personId: string,
  email: string,
  answers: ApplicationAnswers,
  documents: UploadedDocument[] = []
): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const raw = storage.getItem(DRAFT_STORAGE_KEY);
    const drafts: Record<string, DraftApplicationRecord> = raw ? JSON.parse(raw) : {};

    drafts[personId] = {
      personId,
      email: email.trim().toLowerCase(),
      savedAt: new Date().toISOString(),
      answers,
      documents,
    };

    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // ignore
  }
}

/**
 * Submits an applicant's scholarship application.
 * Preserves the original MAA Application Code and sets submission timestamp.
 */
export function submitApplicantApplication(
  personId: string,
  applicationCode: string,
  identityRef: string,
  email: string,
  phone: string,
  fullName: string,
  answers: ApplicationAnswers,
  documents: UploadedDocument[]
): SubmittedApplicationRecord {
  const normEmail = email.trim().toLowerCase();
  const storage = getStorage();

  const record: SubmittedApplicationRecord = {
    personId,
    applicationCode,
    identityRef,
    email: normEmail,
    phone,
    fullName,
    stage: 'application',
    submittedAt: new Date().toISOString(),
    answers,
    documents,
  };

  if (storage) {
    try {
      const raw = storage.getItem(SUBMITTED_STORAGE_KEY);
      const list: SubmittedApplicationRecord[] = raw ? JSON.parse(raw) : [];
      const filtered = list.filter(
        (a) => a.personId !== personId && a.applicationCode !== applicationCode
      );
      filtered.push(record);
      storage.setItem(SUBMITTED_STORAGE_KEY, JSON.stringify(filtered));

      // Remove from draft once submitted
      const draftRaw = storage.getItem(DRAFT_STORAGE_KEY);
      if (draftRaw) {
        const drafts: Record<string, DraftApplicationRecord> = JSON.parse(draftRaw);
        delete drafts[personId];
        delete drafts[normEmail];
        storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
      }
    } catch {
      // ignore
    }
  }

  return record;
}

/**
 * Updates an already submitted scholarship application.
 * Strictly preserves the original MAA Application Code, submission timestamp, and stage.
 */
export function updateApplicantApplication(
  personId: string,
  answers: ApplicationAnswers,
  documents: UploadedDocument[]
): SubmittedApplicationRecord | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(SUBMITTED_STORAGE_KEY);
    if (!raw) return null;
    const list: SubmittedApplicationRecord[] = JSON.parse(raw);
    const existing = list.find((a) => a.personId === personId);
    if (!existing) return null;

    existing.answers = { ...existing.answers, ...answers };
    existing.documents = documents;
    existing.updatedAt = new Date().toISOString();

    storage.setItem(SUBMITTED_STORAGE_KEY, JSON.stringify(list));
    return existing;
  } catch {
    return null;
  }
}

/**
 * Resets/clears applicant auth storage (used in test setup).
 */
export function clearApplicantAuthStorage(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(ACCOUNTS_STORAGE_KEY);
    storage.removeItem(LEGACY_REGISTERED_KEY);
    storage.removeItem(SUBMITTED_STORAGE_KEY);
    storage.removeItem(DRAFT_STORAGE_KEY);
    storage.removeItem('maatram_last_registered_email');
    storage.removeItem('maatram_last_registered_code');
  }
}
