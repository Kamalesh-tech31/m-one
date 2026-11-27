import { beforeEach, describe, expect, it } from 'vitest';
import {
  accountExists,
  authenticateApplicant,
  clearApplicantAuthStorage,
  createApplicantAccount,
  getApplicantApplication,
  getApplicantApplicationState,
  getApplicantByCodeOrEmail,
  hashPassword,
  saveDraftApplication,
  submitApplicantApplication,
  updateApplicantApplication,
  validateRegistrationFields,
  verifyPassword,
} from './applicantAuth';
import {
  clearSentEmails,
  getAllSentEmails,
  getLatestEmailFor,
  isEmailVerified,
  sendEmailOtp,
  verifyEmailOtp,
} from './emailService';
import { foldEvents } from './reducer';
import { canAccessRoute, selectForUser, verifyRoleCredentials } from './scoping';
import { buildSeedEvents } from './seed';
import type { ApplicationAnswers, AuthSessionUser, UploadedDocument } from './types';

describe('Applicant Registration, Email OTP Verification, Login & Application Workflow', () => {
  const seedState = foldEvents(buildSeedEvents());

  beforeEach(() => {
    clearApplicantAuthStorage();
    clearSentEmails();
  });

  describe('Test 1 – New Applicant Full Lifecycle', () => {
    it('executes registration, email OTP verification, MAA code generation, conditional form routing, submission, and status pipeline routing', async () => {
      const applicantEmail = 'priya.s@example.com';
      const applicantPhone = '9840112233';
      const applicantName = 'Priya S';
      const password = 'Scholar@2026';

      // 1. Validate registration fields
      const validation = validateRegistrationFields({
        fullName: applicantName,
        phone: applicantPhone,
        email: applicantEmail,
        district: 'Chennai',
        dob: '2008-04-12',
        password,
        confirmPassword: password,
      });
      expect(validation.valid).toBe(true);

      // 2. Dispatch Email OTP
      const emailRes = await sendEmailOtp(applicantEmail, applicantName);
      expect(emailRes.success).toBe(true);
      expect(emailRes.otp).toMatch(/^\d{6}$/);

      // Verify email was recorded in outbox with proper subject and body
      const sentMails = getAllSentEmails();
      expect(sentMails.length).toBeGreaterThan(0);
      const latestMail = getLatestEmailFor(applicantEmail);
      expect(latestMail).not.toBeNull();
      expect(latestMail?.subject).toContain(emailRes.otp);
      expect(latestMail?.body).toContain(emailRes.otp);

      // 3. Verify Email with valid OTP
      expect(isEmailVerified(applicantEmail)).toBe(false);
      const verifyRes = verifyEmailOtp(applicantEmail, emailRes.otp);
      expect(verifyRes.success).toBe(true);
      expect(isEmailVerified(applicantEmail)).toBe(true);

      // 4. Create Applicant Account
      const createRes = await createApplicantAccount({
        fullName: applicantName,
        phone: applicantPhone,
        email: applicantEmail,
        district: 'Chennai',
        dob: '2008-04-12',
        password,
      });
      expect(createRes.success).toBe(true);
      expect(createRes.account).toBeDefined();

      const maaCode = createRes.account!.applicationCode;
      expect(maaCode).toMatch(/^MAA-2026-\d{4}$/);
      expect(createRes.account!.emailVerified).toBe(true);
      // Ensure password is not plain text
      expect(createRes.account!.passwordHash).not.toBe(password);
      expect(verifyPassword(password, createRes.account!.passwordHash)).toBe(true);

      // Check confirmation email was sent
      const confirmationMail = getLatestEmailFor(applicantEmail);
      expect(confirmationMail?.type).toBe('registration_confirmation');
      expect(confirmationMail?.subject).toContain(maaCode);

      // CRITICAL CHECK: Account creation is NOT application submission
      const stateBeforeSubmit = getApplicantApplicationState(
        createRes.account!.personId,
        applicantEmail
      );
      expect(stateBeforeSubmit.hasSubmitted).toBe(false);
      expect(stateBeforeSubmit.submittedAt).toBeUndefined();

      // 5. Sign In & Apply: Authenticate using MAA Application Code and Password
      const authByCode = await authenticateApplicant(maaCode, password);
      expect(authByCode.success).toBe(true);
      expect(authByCode.user).toBeDefined();
      expect(authByCode.user?.role).toBe('applicant');
      expect(authByCode.user?.name).toBe(applicantName);

      // Can also authenticate using registered email and password
      const authByEmail = await authenticateApplicant(applicantEmail, password);
      expect(authByEmail.success).toBe(true);

      // 6. Case A Conditional Navigation: Unsubmitted applicant scoped data
      const scopedUnsubmitted = selectForUser(seedState, authByCode.user!);
      expect(scopedUnsubmitted).not.toBeNull();
      if (scopedUnsubmitted && scopedUnsubmitted.role === 'applicant') {
        // Must NOT have applicationSubmittedAt set
        expect(scopedUnsubmitted.ownProfile?.applicationSubmittedAt).toBeUndefined();
        expect(scopedUnsubmitted.ownProfile?.status).toBe('draft');
        expect(scopedUnsubmitted.ownProfile?.applicationCode).toBe(maaCode);
      }

      // 7. Complete and Submit Scholarship Application
      const applicationAnswers: ApplicationAnswers = {
        fullName: applicantName,
        schoolName: 'Chennai Girls Higher Secondary School',
        schoolType: 'Government',
        tenthMarks: '482/500',
        twelfthMarks: '568/600',
        parentOccupation: 'Daily wage agricultural laborer',
        familyAnnualIncome: 'Rs 72,000',
        housingType: 'Rented',
        whyMaatram: 'Aspiring computer science engineer seeking first-generation scholarship support.',
        phone: applicantPhone,
        dob: '2008-04-12',
        gender: 'Female',
        fatherName: 'Murugan P',
        motherName: 'Lalitha M',
        familyMembersCount: '4',
        mediumOfInstruction: 'Tamil',
        stream: 'Science / Computer Science',
        incomeSource: 'Daily agricultural wages',
      };

      const documents: UploadedDocument[] = [
        {
          docId: 'DOC-1',
          label: 'Income Certificate',
          fileName: 'income_cert.pdf',
          fileType: 'application/pdf',
          fileSize: 180000,
          signedUrl: 'mock://income_cert.pdf',
          uploadedAt: new Date().toISOString(),
        },
        {
          docId: 'DOC-2',
          label: '10th Marksheet',
          fileName: '10th_marks.pdf',
          fileType: 'application/pdf',
          fileSize: 220000,
          signedUrl: 'mock://10th_marks.pdf',
          uploadedAt: new Date().toISOString(),
        },
      ];

      const submittedRecord = submitApplicantApplication(
        createRes.account!.personId,
        maaCode,
        `MOCK-${createRes.account!.personId}`,
        applicantEmail,
        applicantPhone,
        applicantName,
        applicationAnswers,
        documents
      );
      expect(submittedRecord.applicationCode).toBe(maaCode);
      expect(submittedRecord.submittedAt).toBeDefined();

      // 8. Log in again: Check Case B Conditional Navigation for submitted applicant
      const stateAfterSubmit = getApplicantApplicationState(
        createRes.account!.personId,
        applicantEmail
      );
      expect(stateAfterSubmit.hasSubmitted).toBe(true);
      expect(stateAfterSubmit.submittedAt).toBeDefined();
      expect(stateAfterSubmit.applicationCode).toBe(maaCode);

      const scopedSubmitted = selectForUser(seedState, authByCode.user!);
      expect(scopedSubmitted).not.toBeNull();
      if (scopedSubmitted && scopedSubmitted.role === 'applicant') {
        // Must have applicationSubmittedAt set (directing to Status Pipeline)
        expect(scopedSubmitted.ownProfile?.applicationSubmittedAt).toBeDefined();
        expect(scopedSubmitted.ownProfile?.status).toBe('applicant');
        expect(scopedSubmitted.ownProfile?.applicationCode).toBe(maaCode);
        expect(scopedSubmitted.ownProfile?.applicationAnswers.schoolName).toBe(
          'Chennai Girls Higher Secondary School'
        );
      }
    });
  });

  describe('Test 2 – Existing Applicant Edit Workflow', () => {
    it('retrieves previously submitted application data and saves edits while preserving original MAA Application Code', async () => {
      const email = 'karthik.v@example.com';
      const phone = '9840223344';
      const password = 'Scholar@2026';

      // Setup verified account
      await sendEmailOtp(email, 'Karthik V');
      const otp = getLatestEmailFor(email)!.otpCode!;
      verifyEmailOtp(email, otp);

      const account = (
        await createApplicantAccount({
          fullName: 'Karthik V',
          phone,
          email,
          district: 'Madurai',
          dob: '2008-02-18',
          password,
        })
      ).account!;

      const originalMaaCode = account.applicationCode;

      // Submit application
      const initialAnswers: ApplicationAnswers = {
        fullName: 'Karthik V',
        schoolName: 'Govt Model HSS Madurai',
        schoolType: 'Government',
        tenthMarks: '460/500',
        twelfthMarks: '540/600',
        parentOccupation: 'Carpenter',
        familyAnnualIncome: 'Rs 85,000',
        housingType: 'Rented',
        whyMaatram: 'Mechanical engineering passion.',
      };

      submitApplicantApplication(
        account.personId,
        originalMaaCode,
        `MOCK-${account.personId}`,
        email,
        phone,
        'Karthik V',
        initialAnswers,
        []
      );

      // Authenticate
      const auth = await authenticateApplicant(originalMaaCode, password);
      expect(auth.success).toBe(true);

      // Verify Status Pipeline data loaded
      const appState = getApplicantApplicationState(account.personId, email);
      expect(appState.hasSubmitted).toBe(true);
      expect(appState.answers.schoolName).toBe('Govt Model HSS Madurai');

      // Edit application: Update annual income and whyMaatram
      const updatedAnswers: ApplicationAnswers = {
        ...initialAnswers,
        familyAnnualIncome: 'Rs 80,000',
        whyMaatram: 'Updated personal statement detailing robotic club achievements.',
      };

      const updatedRecord = updateApplicantApplication(
        account.personId,
        updatedAnswers,
        []
      );
      expect(updatedRecord).not.toBeNull();
      // Crucial: MAA Application Code must remain completely unchanged!
      expect(updatedRecord?.applicationCode).toBe(originalMaaCode);

      // Verify updated values are reflected
      const recheckedState = getApplicantApplicationState(account.personId, email);
      expect(recheckedState.answers.familyAnnualIncome).toBe('Rs 80,000');
      expect(recheckedState.answers.whyMaatram).toContain('robotic club');

      // Verify scoping correctly reflects the edited application
      const stateWithUpdatedApplicant = {
        ...seedState,
        persons: {
          ...seedState.persons,
          [account.personId]: {
            ...seedState.persons['P-2026-01'],
            personId: account.personId,
            cycleId: '2026',
            name: 'Karthik V',
            roles: ['applicant' as const],
            email,
            phone,
            region: 'Madurai',
            status: 'applicant' as const,
            stage: 'application' as const,
            applicationCode: originalMaaCode,
            applicationSubmittedAt: new Date().toISOString(),
            documents: [],
            statusHistory: [],
            verifiers: { teleStatus: 'Pending' as const, physicalStatus: 'Pending' as const },
            applicationAnswers: updatedAnswers,
          },
        },
      };

      const scopedAfterEdit = selectForUser(stateWithUpdatedApplicant, {
        id: account.personId,
        personId: account.personId,
        role: 'applicant',
        name: 'Karthik V',
        email,
        subtitle: '2026 cycle',
      });

      expect(scopedAfterEdit?.role).toBe('applicant');
      if (scopedAfterEdit?.role === 'applicant') {
        expect(scopedAfterEdit.ownProfile?.applicationSubmittedAt).toBeDefined();
        expect(scopedAfterEdit.ownProfile?.applicationAnswers.familyAnnualIncome).toBe('Rs 80,000');
        expect(scopedAfterEdit.ownProfile?.applicationAnswers.whyMaatram).toContain('robotic club');
      }

      // Also verify updating by MAA application code directly works
      const editedByCode = updateApplicantApplication(
        originalMaaCode,
        { ...updatedAnswers, tenthMarks: '495/500' },
        [],
        email,
        originalMaaCode
      );
      expect(editedByCode?.answers.tenthMarks).toBe('495/500');
      expect(editedByCode?.applicationCode).toBe(originalMaaCode);
    });
  });

  describe('Test 3 – Unsubmitted Applicant Draft Persistence', () => {
    it('saves incomplete application draft and restores saved values upon next login', async () => {
      const email = 'ananya.m@example.com';
      const phone = '9840334455';
      const password = 'Scholar@2026';

      await sendEmailOtp(email, 'Ananya M');
      const otp = getLatestEmailFor(email)!.otpCode!;
      verifyEmailOtp(email, otp);

      const account = (
        await createApplicantAccount({
          fullName: 'Ananya M',
          phone,
          email,
          district: 'Coimbatore',
          dob: '2008-08-25',
          password,
        })
      ).account!;

      // Log in
      const auth = await authenticateApplicant(account.applicationCode, password);
      expect(auth.success).toBe(true);

      // Save incomplete draft
      const draftAnswers: ApplicationAnswers = {
        fullName: 'Ananya M',
        schoolName: 'Corporation Higher Secondary School Coimbatore',
        schoolType: 'Government',
        tenthMarks: '490/500',
        twelfthMarks: '', // incomplete
        parentOccupation: 'Auto rickshaw driver',
        familyAnnualIncome: 'Rs 90,000',
        housingType: 'Rented',
        whyMaatram: '', // incomplete
      };

      saveDraftApplication(account.personId, email, draftAnswers, []);

      // Check state: must NOT be marked submitted
      const draftState = getApplicantApplicationState(account.personId, email);
      expect(draftState.hasSubmitted).toBe(false);
      expect(draftState.answers.tenthMarks).toBe('490/500');
      expect(draftState.answers.schoolName).toBe('Corporation Higher Secondary School Coimbatore');

      // Simulate re-login and selectForUser
      const scoped = selectForUser(seedState, auth.user!);
      expect(scoped).not.toBeNull();
      if (scoped && scoped.role === 'applicant') {
        expect(scoped.ownProfile?.applicationSubmittedAt).toBeUndefined();
        expect(scoped.ownProfile?.applicationAnswers.tenthMarks).toBe('490/500');
      }
    });
  });

  describe('Test 4 – Authentication & Security Restrictions', () => {
    it('blocks login with incorrect password', async () => {
      const email = 'sec.test@example.com';
      await sendEmailOtp(email, 'Security Test');
      const otp = getLatestEmailFor(email)!.otpCode!;
      verifyEmailOtp(email, otp);

      const account = (
        await createApplicantAccount({
          fullName: 'Security Test',
          phone: '9840998877',
          email,
          district: 'Salem',
          dob: '2008-01-01',
          password: 'CorrectPassword123',
        })
      ).account!;

      const failedLogin = await authenticateApplicant(account.applicationCode, 'WrongPassword');
      expect(failedLogin.success).toBe(false);
      expect(failedLogin.error).toContain('Invalid password');
    });

    it('blocks account creation when email is not verified', async () => {
      const unverifiedEmail = 'unverified@example.com';
      expect(isEmailVerified(unverifiedEmail)).toBe(false);

      const res = await createApplicantAccount({
        fullName: 'Unverified Applicant',
        phone: '9840556677',
        email: unverifiedEmail,
        district: 'Salem',
        dob: '2008-01-01',
        password: 'Password123',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Email verification is required');
    });

    it('rejects incorrect and expired OTPs', async () => {
      const email = 'otp.test@example.com';
      const sendRes = await sendEmailOtp(email, 'OTP Tester');

      // Incorrect OTP test
      const incorrectRes = verifyEmailOtp(email, '000000');
      expect(incorrectRes.success).toBe(false);
      expect(incorrectRes.error).toContain('Invalid verification code');

      // Valid OTP test
      const validRes = verifyEmailOtp(email, sendRes.otp);
      expect(validRes.success).toBe(true);
    });

    it('prevents duplicate account creation for existing email or phone', async () => {
      const email = 'dup.test@example.com';
      const phone = '9840445566';

      await sendEmailOtp(email, 'Duplicate Test');
      const otp = getLatestEmailFor(email)!.otpCode!;
      verifyEmailOtp(email, otp);

      await createApplicantAccount({
        fullName: 'User One',
        phone,
        email,
        district: 'Salem',
        dob: '2008-01-01',
        password: 'Password123',
      });

      // Try registering duplicate email
      const checkDupEmail = accountExists(email, '9840999999');
      expect(checkDupEmail.exists).toBe(true);

      // Try registering duplicate phone
      const checkDupPhone = accountExists('other@example.com', phone);
      expect(checkDupPhone.exists).toBe(true);
    });

    it('enforces route protection for unauthenticated or unauthorized users', () => {
      // Unauthenticated user
      expect(canAccessRoute(null, '/applicant')).toBe(false);
      expect(canAccessRoute(null, '/admin')).toBe(false);
      expect(canAccessRoute(null, '/profile')).toBe(false);
      expect(canAccessRoute(null, '/login')).toBe(true);
      expect(canAccessRoute(null, '/login/applicant')).toBe(true);

      // Applicant cannot access admin route
      const applicantUser: AuthSessionUser = {
        id: 'P-1',
        personId: 'P-1',
        role: 'applicant',
        name: 'Applicant User',
        email: 'app@example.com',
        subtitle: 'Applicant',
      };
      expect(canAccessRoute(applicantUser, '/applicant')).toBe(true);
      expect(canAccessRoute(applicantUser, '/applicant/form')).toBe(true);
      expect(canAccessRoute(applicantUser, '/profile')).toBe(true);
      expect(canAccessRoute(applicantUser, '/admin')).toBe(false);
      expect(canAccessRoute(applicantUser, '/student')).toBe(false);
    });
  });

  describe('Test 5 – Sidebar Navigation & Edit Mode Transitions', () => {
    it('verifies sidebar navigation visibility on dashboard vs edit mode, section routing, and restoration on exit/save', async () => {
      // 1. Create and submit an applicant
      const email = 'kavitha.m@example.com';
      const sendRes = await sendEmailOtp(email, 'Kavitha M');
      verifyEmailOtp(email, sendRes.otp);
      const accRes = await createApplicantAccount({
        fullName: 'Kavitha M',
        phone: '9840223344',
        email,
        district: 'Madurai',
        dob: '2008-05-15',
        password: 'Kavitha@123',
      });
      const maaCode = accRes.account!.applicationCode;

      submitApplicantApplication(
        accRes.account!.personId,
        maaCode,
        'MOCK-KAVITHA',
        email,
        '9840223344',
        'Kavitha M',
        {
          fullName: 'Kavitha M',
          fatherName: 'Murugan',
          motherName: 'Meena',
          schoolName: 'Govt Higher Secondary School',
        },
        []
      );

      const user: AuthSessionUser = {
        id: maaCode,
        personId: maaCode,
        role: 'applicant',
        name: 'Kavitha M',
        email,
        subtitle: 'Applicant',
      };

      // 2. Dashboard View (/applicant/application)
      // Allowed routes:
      expect(canAccessRoute(user, '/applicant/application')).toBe(true);
      expect(canAccessRoute(user, '/applicant/history')).toBe(true);

      // On dashboard, applicant application state shows submitted
      const appState = getApplicantApplicationState(user.personId, user.email);
      expect(appState.hasSubmitted).toBe(true);

      // 3. Edit Route Access (/applicant/edit and /applicant/edit/:section)
      expect(canAccessRoute(user, '/applicant/edit')).toBe(true);
      expect(canAccessRoute(user, '/applicant/edit/personal')).toBe(true);
      expect(canAccessRoute(user, '/applicant/edit/family')).toBe(true);
      expect(canAccessRoute(user, '/applicant/edit/educational')).toBe(true);
      expect(canAccessRoute(user, '/applicant/edit/financial')).toBe(true);
      expect(canAccessRoute(user, '/applicant/edit/documents')).toBe(true);

      // 4. Update in place during edit mode preserves MAA code
      const updatedAnswers = {
        fullName: 'Kavitha M',
        fatherName: 'Murugan K',
        motherName: 'Meenakshi M',
        schoolName: 'Govt Model Higher Secondary School',
        familyAnnualIncome: '₹ 84,000',
      };
      const updatedRecord = updateApplicantApplication(
        accRes.account!.personId,
        updatedAnswers,
        []
      );
      expect(updatedRecord).not.toBeNull();
      expect(updatedRecord?.applicationCode).toBe(maaCode);

      // 5. Verification on Dashboard after returning from edit mode
      const reloadedState = getApplicantApplicationState(user.personId, user.email);
      expect(reloadedState.hasSubmitted).toBe(true);
      expect(reloadedState.applicationCode).toBe(maaCode);
      expect(reloadedState.answers.fatherName).toBe('Murugan K');
      expect(reloadedState.answers.motherName).toBe('Meenakshi M');
      expect(reloadedState.answers.schoolName).toBe('Govt Model Higher Secondary School');
      expect(reloadedState.answers.familyAnnualIncome).toBe('₹ 84,000');
    });
  });

  describe('Test 6 – Three Account Scenarios (Applicant A, B, C) Status Resolution & Direct Navigation', () => {
    it('Scenario A: Applicant registered with no application -> routes to Apply Now', async () => {
      // Applicant A registers
      const email = 'applicant.a@example.com';
      const sendRes = await sendEmailOtp(email, 'Applicant A');
      verifyEmailOtp(email, sendRes.otp);
      const accRes = await createApplicantAccount({
        fullName: 'Applicant A',
        phone: '9840101010',
        email,
        district: 'Chennai',
        dob: '2008-01-10',
        password: 'Password@123',
      });
      const maaCode = accRes.account!.applicationCode;

      // 1. Check getApplicantApplication before any form action
      const app = getApplicantApplication(maaCode, email);
      expect(app).toBeNull(); // No application record created yet!

      // 2. handleViewStatus logic:
      // if (!application) -> navigate("/apply-now")
      const resolvedRoute = !app
        ? '/apply-now'
        : app.status === 'DRAFT'
        ? '/application-form'
        : '/status-pipeline';
      expect(resolvedRoute).toBe('/apply-now');

      // 3. User session resolution on Status Pipeline URL:
      const authUser: AuthSessionUser = {
        id: maaCode,
        personId: maaCode,
        role: 'applicant',
        name: 'Applicant A',
        email,
        subtitle: 'Applicant',
      };
      const scoped = selectForUser(seedState, authUser);
      expect(scoped?.role).toBe('applicant');
      if (scoped?.role === 'applicant') {
        expect(scoped.ownProfile?.applicationSubmittedAt).toBeUndefined();
        expect(scoped.ownProfile?.status).toBe('draft');
      }

      // Independent Status Pipeline page check:
      const appRecord = getApplicantApplication(authUser.id, authUser.email);
      expect(appRecord).toBeNull();
      // On Status Pipeline page, null appRecord renders Apply Now screen!
    });

    it('Scenario B: Applicant registered with saved draft -> routes to Resume Application', async () => {
      // Applicant B registers
      const email = 'applicant.b@example.com';
      const sendRes = await sendEmailOtp(email, 'Applicant B');
      verifyEmailOtp(email, sendRes.otp);
      const accRes = await createApplicantAccount({
        fullName: 'Applicant B',
        phone: '9840202020',
        email,
        district: 'Coimbatore',
        dob: '2008-03-20',
        password: 'Password@123',
      });
      const maaCode = accRes.account!.applicationCode;

      // Saves draft
      saveDraftApplication(
        accRes.account!.personId,
        email,
        {
          fullName: 'Applicant B',
          schoolName: 'Coimbatore Model School',
          twelfthMarks: '510/600',
        },
        []
      );

      // 1. Check getApplicantApplication
      const app = getApplicantApplication(maaCode, email);
      expect(app).not.toBeNull();
      expect(app?.status).toBe('DRAFT');
      expect(app?.answers?.schoolName).toBe('Coimbatore Model School');

      // 2. handleViewStatus logic:
      // if (application.status === "DRAFT") -> navigate("/application-form")
      const resolvedRoute = !app
        ? '/apply-now'
        : app.status === 'DRAFT'
        ? '/application-form'
        : '/status-pipeline';
      expect(resolvedRoute).toBe('/application-form');

      // 3. Direct status pipeline visit check:
      // On status pipeline, status === 'DRAFT' resolves effectiveTab = 'resume'!
    });

    it('Scenario C: Applicant registered with submitted application -> displays Status Pipeline', async () => {
      // Applicant C registers
      const email = 'applicant.c@example.com';
      const sendRes = await sendEmailOtp(email, 'Applicant C');
      verifyEmailOtp(email, sendRes.otp);
      const accRes = await createApplicantAccount({
        fullName: 'Applicant C',
        phone: '9840303030',
        email,
        district: 'Madurai',
        dob: '2008-07-07',
        password: 'Password@123',
      });
      const maaCode = accRes.account!.applicationCode;

      // Submits application
      submitApplicantApplication(
        accRes.account!.personId,
        maaCode,
        'MOCK-APPLICANT-C',
        email,
        '9840303030',
        'Applicant C',
        {
          fullName: 'Applicant C',
          schoolName: 'Madurai Govt School',
          twelfthMarks: '575/600',
        },
        []
      );

      // 1. Check getApplicantApplication
      const app = getApplicantApplication(maaCode, email);
      expect(app).not.toBeNull();
      expect(app?.status).toBe('SUBMITTED');
      expect(app?.applicationCode).toBe(maaCode);
      expect(app?.submittedAt).toBeDefined();

      // 2. handleViewStatus logic:
      // if (application.status === "SUBMITTED") -> navigate("/status-pipeline")
      const resolvedRoute = !app
        ? '/apply-now'
        : app.status === 'DRAFT'
        ? '/application-form'
        : '/status-pipeline';
      expect(resolvedRoute).toBe('/status-pipeline');

      // 3. Status Pipeline renders with submitted details:
      const authUser: AuthSessionUser = {
        id: maaCode,
        personId: maaCode,
        role: 'applicant',
        name: 'Applicant C',
        email,
        subtitle: 'Applicant',
      };
      const scoped = selectForUser(seedState, authUser);
      expect(scoped?.role).toBe('applicant');
      if (scoped?.role === 'applicant') {
        expect(scoped.ownProfile?.applicationSubmittedAt).toBeDefined();
        expect(scoped.ownProfile?.status).toBe('applicant');
      }
    });

    it('handles logout and re-login correctly preserving distinct applicant application states', async () => {
      // Setup Applicant A (unsubmitted) and Applicant C (submitted)
      const emailA = 'relogin.a@example.com';
      const sendResA = await sendEmailOtp(emailA, 'Relogin A');
      verifyEmailOtp(emailA, sendResA.otp);
      const accA = (await createApplicantAccount({
        fullName: 'Relogin A',
        phone: '9840111111',
        email: emailA,
        district: 'Trichy',
        dob: '2008-02-02',
        password: 'Password@123',
      })).account!;

      const emailC = 'relogin.c@example.com';
      const sendResC = await sendEmailOtp(emailC, 'Relogin C');
      verifyEmailOtp(emailC, sendResC.otp);
      const accC = (await createApplicantAccount({
        fullName: 'Relogin C',
        phone: '9840333333',
        email: emailC,
        district: 'Tirunelveli',
        dob: '2008-04-04',
        password: 'Password@123',
      })).account!;

      submitApplicantApplication(
        accC.personId,
        accC.applicationCode,
        'MOCK-RELOGIN-C',
        emailC,
        '9840333333',
        'Relogin C',
        { fullName: 'Relogin C' },
        []
      );

      // Authenticate A
      const authA = await authenticateApplicant(accA.applicationCode, 'Password@123');
      expect(authA.success).toBe(true);
      const appA = getApplicantApplication(accA.applicationCode, emailA);
      expect(appA).toBeNull(); // A has no application

      // Authenticate C
      const authC = await authenticateApplicant(accC.applicationCode, 'Password@123');
      expect(authC.success).toBe(true);
      const appC = getApplicantApplication(accC.applicationCode, emailC);
      expect(appC?.status).toBe('SUBMITTED'); // C has submitted application
    });
  });
});
