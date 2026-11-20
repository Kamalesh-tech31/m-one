import { z } from 'zod';
import type { ApplicationAnswers } from './types';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'] as const;
export const DEMO_ADMIN_OTP = '123456';

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUploadFile(file: {
  name: string;
  type: string;
  size: number;
}): UploadValidationResult {
  const lowerName = file.name.trim().toLowerCase();
  const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const mime = (file.type || '').trim().toLowerCase();
  const hasAllowedMime = (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);

  const typeValid = mime ? hasAllowedMime && (!lowerName.includes('.') || hasAllowedExt) : hasAllowedExt;

  if (!typeValid) {
    return {
      valid: false,
      error: `Unsupported file type "${file.name}". Only PDF, JPG, or PNG files are accepted.`,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: `File "${file.name}" is empty (0 bytes). Please upload a valid document.`,
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File "${file.name}" is ${sizeMb} MB, which exceeds the 5.00 MB upload limit.`,
    };
  }

  return { valid: true };
}

export const applicationSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  schoolName: z.string().trim().min(1, 'School name is required.'),
  schoolType: z.enum(['Government', 'Private']),
  tenthMarks: z.string().trim().min(1, '10th board marks are required.'),
  twelfthMarks: z.string().trim().min(1, '12th board marks are required.'),
  parentOccupation: z
    .string()
    .trim()
    .min(1, 'Parent or guardian occupation is required.'),
  familyAnnualIncome: z
    .string()
    .trim()
    .min(1, 'Family annual income is required.'),
  housingType: z.enum(['Rented', 'Own']),
  whyMaatram: z
    .string()
    .trim()
    .min(
      20,
      'Please share at least 20 characters explaining why you are applying to Maatram.'
    ),
});

export interface ApplicationValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof ApplicationAnswers, string>>;
}

export function validateApplicationAnswers(
  answers: ApplicationAnswers
): ApplicationValidationResult {
  const parsed = applicationSchema.safeParse(answers);
  if (parsed.success) {
    return { valid: true, errors: {} };
  }
  const errors: Partial<Record<keyof ApplicationAnswers, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof ApplicationAnswers;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return { valid: false, errors };
}

export function verifyAdminOtp(otpInput: string): {
  valid: boolean;
  error?: string;
} {
  const cleaned = otpInput.trim();
  if (!cleaned) {
    return { valid: false, error: 'Please enter the 6-digit OTP.' };
  }
  if (!/^\d{6}$/.test(cleaned)) {
    return { valid: false, error: 'OTP must be a 6-digit number.' };
  }
  if (cleaned !== DEMO_ADMIN_OTP) {
    return {
      valid: false,
      error: `Invalid OTP "${cleaned}". Use demo OTP ${DEMO_ADMIN_OTP}.`,
    };
  }
  return { valid: true };
}

export function validateLeaveRequest(input: {
  reason: string;
  proofFile: { name: string; type: string; size: number } | null;
}): { valid: boolean; error?: string } {
  if (!input.reason.trim() || input.reason.trim().length < 5) {
    return {
      valid: false,
      error: 'A clear leave reason (at least 5 characters) is required.',
    };
  }
  if (!input.proofFile) {
    return {
      valid: false,
      error: 'A supporting proof document (PDF/JPG/PNG, max 5 MB) is required.',
    };
  }
  const fileCheck = validateUploadFile(input.proofFile);
  if (!fileCheck.valid) {
    return { valid: false, error: fileCheck.error };
  }
  return { valid: true };
}

/**
 * Deterministic 1-per-25 cohort sampling (returns at least 1 person when cohort is non-empty).
 */
export function selectSampledCohort(
  cohortPersonIds: string[],
  ratio = 25,
  seedOffset = 0
): string[] {
  const sorted = [...cohortPersonIds].sort();
  if (sorted.length === 0) return [];
  const step = Math.max(1, ratio);
  const count = Math.max(1, Math.ceil(sorted.length / step));
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (i * step + (seedOffset % sorted.length)) % sorted.length;
    if (!picked.includes(sorted[idx])) {
      picked.push(sorted[idx]);
    }
  }
  return picked;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
