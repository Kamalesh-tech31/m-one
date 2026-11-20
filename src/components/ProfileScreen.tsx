import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  Plus,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';
import { normalizeCompanyName } from '../core/normalization';
import type { AppendEventInput } from '../core/store';
import type { AuthSessionUser, CareerSource, PersonProfile } from '../core/types';

interface ProfileScreenProps {
  user: AuthSessionUser;
  profile: PersonProfile | null;
  actorName: string;
  onAppend: (input: AppendEventInput) => void;
  onUpdateSessionName: (name: string) => void;
  showToast: (msg: string) => void;
}

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required.'),
  phone: z.string().trim().min(5, 'Phone number is required.'),
  email: z.string().trim().email('Valid email is required.'),
  college: z.string().trim().optional(),
  degree: z.string().trim().optional(),
  newPassword: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  profile,
  actorName,
  onAppend,
  onUpdateSessionName,
  showToast,
}) => {
  const [photoError, setPhotoError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    profile?.photoUrl || null
  );
  const [showPassword, setShowPassword] = useState(false);

  // Anchor Career Entry Form states
  const [companyInput, setCompanyInput] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [startYearInput, setStartYearInput] = useState('2024');
  const [endYearInput, setEndYearInput] = useState('');
  const [sourceInput, setSourceInput] = useState<CareerSource>('self-reported');
  const [careerError, setCareerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || user.name || '',
      phone: profile?.phone || '+91 98400 00000',
      email: profile?.email || user.email || '',
      college: profile?.college || '',
      degree: profile?.degree || '',
      newPassword: '',
    },
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png'];
    const ext = file.name.toLowerCase();
    const hasAllowedExt =
      ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png');

    if (!allowed.includes(file.type) && !hasAllowedExt) {
      setPhotoError('Only JPG or PNG images are allowed for profile photo.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Profile photo size exceeds 5 MB limit.');
      return;
    }

    // Set local simulated photo preview
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
    showToast('Photo uploaded.');
  };

  const onProfileSubmit = (data: ProfileFormValues) => {
    onAppend({
      type: 'profile.updated',
      personId: user.personId,
      cycleId: profile?.cycleId || '2026',
      actor: actorName || user.name,
      payload: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        college: data.college || profile?.college || '',
        degree: data.degree || profile?.degree || '',
        photoUrl: photoPreview || profile?.photoUrl || '',
        passwordChanged: Boolean(data.newPassword),
      },
    });

    onUpdateSessionName(data.name);
    showToast('Profile updated successfully.');
  };

  const handleAddCareerEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setCareerError('');

    if (!companyInput.trim()) {
      setCareerError('Company name is required.');
      return;
    }
    if (!roleInput.trim()) {
      setCareerError('Role title is required.');
      return;
    }
    const startYr = Number(startYearInput);
    if (!startYr || startYr < 1990 || startYr > 2030) {
      setCareerError('Valid start year is required.');
      return;
    }
    const endYr = endYearInput ? Number(endYearInput) : undefined;
    if (endYr && endYr < startYr) {
      setCareerError('End year cannot be earlier than start year.');
      return;
    }

    onAppend({
      type: 'CAREER_HISTORY_ADDED',
      personId: user.personId,
      cycleId: profile?.cycleId || '2026',
      actor: actorName || user.name,
      payload: {
        entryId: `CH-${Date.now().toString(36).toUpperCase()}`,
        company: companyInput.trim(),
        roleTitle: roleInput.trim(),
        startYear: startYr,
        endYear: endYr,
        source: sourceInput,
      },
    });

    setCompanyInput('');
    setRoleInput('');
    setEndYearInput('');
    showToast('Career entry added and recorded in event history.');
  };

  // Replay current job for Anchor
  const isAnchor = user.role === 'anchor';
  const careerHistory = profile?.careerHistory || [];
  const latestCareer =
    careerHistory.length > 0 ? careerHistory[careerHistory.length - 1] : null;
  const currentJobCompany =
    profile?.currentCompany || latestCareer?.company || 'None recorded';
  const currentJobRole =
    profile?.currentRoleTitle || latestCareer?.roleTitle || 'Alumni Mentor';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-neutral-950">
            My Profile
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Manage your personal information and account credentials.
          </p>
        </div>
      </div>

      {/* Anchor Only: Current Job Header Banner & Verified Volunteering Counts */}
      {isAnchor && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                CURRENT EMPLOYMENT
              </span>
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-neutral-800 shrink-0" />
                <h2 className="font-display text-lg sm:text-xl font-bold text-neutral-950">
                  {currentJobRole} at {currentJobCompany}
                </h2>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-neutral-100 text-neutral-800 rounded-full shrink-0">
              Replayed from event log
            </span>
          </div>

          {/* Read-only strip of verified volunteering counts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-neutral-900">
                Verified Volunteering Contributions
              </p>
              <span className="text-[11px] text-neutral-500 italic">
                (Synced from Volunteer Portal)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                <p className="text-xs text-neutral-500">Tele-verifications</p>
                <p className="text-xl font-mono font-bold text-neutral-950 mt-1">
                  {profile?.volunteeringCounts.teleVerifications || 0}
                </p>
              </div>
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                <p className="text-xs text-neutral-500">Physical Verifications</p>
                <p className="text-xl font-mono font-bold text-neutral-950 mt-1">
                  {profile?.volunteeringCounts.physicalVerifications || 0}
                </p>
              </div>
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                <p className="text-xs text-neutral-500">School Outreach</p>
                <p className="text-xl font-mono font-bold text-neutral-950 mt-1">
                  {profile?.volunteeringCounts.schoolVisits || 0}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Personal Details Form (All Roles) */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="border-b border-neutral-100 pb-3">
          <h2 className="font-display text-lg font-bold text-neutral-950">
            Personal Details
          </h2>
          <p className="text-xs text-neutral-500">
            Updating your profile writes an append-only event to the log.
          </p>
        </div>

        <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-name"
                className="block text-xs font-bold text-neutral-900"
              >
                Full Name
              </label>
              <input
                id="profile-name"
                type="text"
                {...register('name')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 text-sm"
              />
              {errors.name && (
                <p className="text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-email"
                className="block text-xs font-bold text-neutral-900"
              >
                Email Address
              </label>
              <input
                id="profile-email"
                type="email"
                {...register('email')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 text-sm"
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-phone"
                className="block text-xs font-bold text-neutral-900"
              >
                Phone Number
              </label>
              <input
                id="profile-phone"
                type="text"
                {...register('phone')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 text-sm"
              />
              {errors.phone && (
                <p className="text-xs text-red-600">{errors.phone.message}</p>
              )}
            </div>

            {/* College */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-college"
                className="block text-xs font-bold text-neutral-900"
              >
                College / Institution
              </label>
              <input
                id="profile-college"
                type="text"
                {...register('college')}
                placeholder="e.g. Anna University — CEG"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 text-sm"
              />
            </div>

            {/* Branch / Degree or Batch */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-degree"
                className="block text-xs font-bold text-neutral-900"
              >
                Branch / Degree or Batch
              </label>
              <input
                id="profile-degree"
                type="text"
                {...register('degree')}
                placeholder="e.g. B.E. Computer Science · 2026 Batch"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 text-sm"
              />
            </div>

            {/* Change Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-password"
                className="block text-xs font-bold text-neutral-900"
              >
                Change Password (optional)
              </label>
              <div className="relative">
                <input
                  id="profile-password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('newPassword')}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-950 text-sm"
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
          </div>

          {/* Profile Photo (JPG/PNG only, max 5 MB) */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold text-neutral-900">
              Profile Photo (JPG / PNG only, max 5 MB)
            </label>
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile preview"
                  className="w-14 h-14 rounded-full object-cover border border-neutral-300"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center text-neutral-400 text-xs font-bold">
                  No photo
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={handlePhotoUpload}
                  className="text-xs text-neutral-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-neutral-300 file:text-xs file:font-semibold file:bg-white file:text-neutral-900 hover:file:bg-neutral-50"
                />
                {photoError && (
                  <p className="text-xs text-red-600 mt-1">{photoError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#FFC20E] text-neutral-950 hover:bg-[#e5ae0b] transition-colors"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      </section>

      {/* Anchor Only: Career History & Add Career Entry Form */}
      {isAnchor && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="font-display text-lg font-bold text-neutral-950">
              Career History
            </h2>
            <p className="text-xs text-neutral-500">
              Past career entries are immutable in the event log. Additions and corrections are appended as new events.
            </p>
          </div>

          {/* Past entries table / list */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Recorded Career Timeline
            </h3>

            {careerHistory.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-3">
                No career history entries recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-neutral-200 rounded-xl overflow-hidden">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Raw Company</th>
                      <th className="py-2.5 px-3 font-semibold">Normalized Company</th>
                      <th className="py-2.5 px-3 font-semibold">Role Title</th>
                      <th className="py-2.5 px-3 font-semibold">Timeline</th>
                      <th className="py-2.5 px-3 font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {careerHistory.map((item, idx) => {
                      const norm = normalizeCompanyName(item.company);
                      return (
                        <tr key={item.entryId || idx} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-3 font-medium text-neutral-900">
                            {item.company}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-neutral-950 bg-neutral-100 px-2 py-0.5 rounded">
                              {norm.normalized}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-800">
                            {item.roleTitle}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-neutral-600">
                            {item.startYear} – {item.endYear || 'Present'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-neutral-100 text-neutral-700 capitalize">
                              {item.source}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Career Entry Form */}
          <div className="pt-4 border-t border-neutral-100 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Add Career Entry
            </h3>

            {careerError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-medium">
                {careerError}
              </div>
            )}

            <form onSubmit={handleAddCareerEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyInput}
                  onChange={(e) => setCompanyInput(e.target.value)}
                  placeholder="e.g. Tata Consultancy Services Pvt Ltd"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  Role Title *
                </label>
                <input
                  type="text"
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  Start Year *
                </label>
                <input
                  type="number"
                  value={startYearInput}
                  onChange={(e) => setStartYearInput(e.target.value)}
                  placeholder="2024"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  End Year (optional)
                </label>
                <input
                  type="number"
                  value={endYearInput}
                  onChange={(e) => setEndYearInput(e.target.value)}
                  placeholder="Leave blank if current"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-900">
                  Source *
                </label>
                <select
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value as CareerSource)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-neutral-950"
                >
                  <option value="self-reported">Self-reported</option>
                  <option value="referral">Referral</option>
                  <option value="placement">Placement</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs bg-neutral-950 text-white hover:bg-neutral-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Append Career Event</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
};
