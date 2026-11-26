import { DISTRICTS_8, type ApplicationAnswers } from './types';

export interface GeneratedDemoApplicant {
  answers: ApplicationAnswers;
  email: string;
  region: string;
  otp: string;
  applicationCode: string;
  documents: Array<{
    label: string;
    fileName: string;
    size: number;
    fileType: string;
    description: string;
  }>;
}

const MALE_FIRST_NAMES = [
  'Karthik',
  'Vignesh',
  'Surya',
  'Aravind',
  'Harish',
  'Praveen',
  'Dinesh',
  'Saravanan',
  'Manikandan',
  'Vijayakumar',
  'Naveen Kumar',
  'Gokulnath',
  'Balaji',
  'Kishore Kumar',
  'Muthukumar',
  'Sanjay',
  'Ajith Kumar',
  'Pradeep',
];

const FEMALE_FIRST_NAMES = [
  'Priya',
  'Ananya',
  'Meena',
  'Divya',
  'Sneha',
  'Kaviya',
  'Soundarya',
  'Nithya',
  'Abirami',
  'Pavithra',
  'Dharshini',
  'Keerthana',
  'Janani',
  'Swetha',
  'Nandhini',
  'Sandhya',
  'Kowsalya',
  'Revathi',
];

const INITIALS = ['S', 'K', 'M', 'R', 'P', 'V', 'T', 'G', 'B', 'N', 'A', 'D'];

const FATHER_NAMES = [
  'Senthil Kumar M',
  'Murugan P',
  'Ramanathan K',
  'Arumugam S',
  'Govindaraj V',
  'Shanmugam R',
  'Velu M',
  'Palani K',
  'Selvam P',
  'Thangaraj N',
  'Subramanian C',
  'Mani K',
  'Ganesan S',
  'Rajendran T',
  'Moorthy V',
];

const MOTHER_NAMES = [
  'Lalitha S',
  'Lakshmi M',
  'Meenakshi R',
  'Valli A',
  'Selvi K',
  'Parvathi S',
  'Saradha V',
  'Mallika G',
  'Revathi P',
  'Kasthuri R',
  'Bhuvaneswari M',
  'Uma Devi K',
  'Chitra S',
  'Kalaivani N',
  'Rajalakshmi T',
];

const OCCUPATION_FINANCIAL_PROFILES = [
  {
    occupation: 'Daily wage agricultural laborer',
    source: 'Paddy field daily wages',
    annualIncome: 'Rs 68,000',
    monthlyRent: 'Rs 2,000',
    schoolFees: 'Rs 1,500',
    electricityBill: 'Rs 450',
    householdExpenses: 'Rs 3,500/month',
    loans: 'Rs 25,000 (Self-help group loan)',
  },
  {
    occupation: 'Daily wage carpenter',
    source: 'Carpentry daily wage labor',
    annualIncome: 'Rs 85,000',
    monthlyRent: 'Rs 3,000',
    schoolFees: 'Rs 2,200',
    electricityBill: 'Rs 600',
    householdExpenses: 'Rs 4,200/month',
    loans: 'Rs 30,000 (Local cooperative credit)',
  },
  {
    occupation: 'Auto rickshaw driver',
    source: 'Daily passenger auto fares',
    annualIncome: 'Rs 92,000',
    monthlyRent: 'Rs 3,500',
    schoolFees: 'Rs 2,500',
    electricityBill: 'Rs 700',
    householdExpenses: 'Rs 4,500/month',
    loans: 'Rs 40,000 (Auto purchase EMI balance)',
  },
  {
    occupation: 'Construction bricklayer',
    source: 'Civil construction daily labor',
    annualIncome: 'Rs 78,000',
    monthlyRent: 'Rs 2,800',
    schoolFees: 'Rs 1,800',
    electricityBill: 'Rs 550',
    householdExpenses: 'Rs 3,800/month',
    loans: 'Rs 20,000 (Emergency medical debt)',
  },
  {
    occupation: 'Power-loom textile worker',
    source: 'Weaving unit piece-rate wages',
    annualIncome: 'Rs 84,000',
    monthlyRent: 'Rs 2,900',
    schoolFees: 'Rs 2,000',
    electricityBill: 'Rs 620',
    householdExpenses: 'Rs 4,000/month',
    loans: 'Rs 35,000 (Family hand loan)',
  },
  {
    occupation: 'Street vegetable & fruit vendor',
    source: 'Daily roadside produce sales',
    annualIncome: 'Rs 72,000',
    monthlyRent: 'Rs 2,500',
    schoolFees: 'Rs 1,600',
    electricityBill: 'Rs 500',
    householdExpenses: 'Rs 3,600/month',
    loans: 'Rs 15,000 (Microfinance loan)',
  },
  {
    occupation: 'Contract security guard',
    source: 'Monthly private security duty',
    annualIncome: 'Rs 96,000',
    monthlyRent: 'Rs 3,800',
    schoolFees: 'Rs 2,800',
    electricityBill: 'Rs 750',
    householdExpenses: 'Rs 4,800/month',
    loans: 'Rs 45,000 (Housing repair loan)',
  },
  {
    occupation: 'Municipal sanitation worker',
    source: 'Civic sanitation contract work',
    annualIncome: 'Rs 74,000',
    monthlyRent: 'Rs 2,600',
    schoolFees: 'Rs 1,700',
    electricityBill: 'Rs 520',
    householdExpenses: 'Rs 3,700/month',
    loans: 'Rs 18,000 (Sanitation cooperative loan)',
  },
  {
    occupation: 'Tea stall assistant',
    source: 'Tea stall daily assistance',
    annualIncome: 'Rs 60,000',
    monthlyRent: 'Rs 1,800',
    schoolFees: 'Rs 1,200',
    electricityBill: 'Rs 400',
    householdExpenses: 'Rs 3,200/month',
    loans: 'Rs 12,000 (Informal community loan)',
  },
];

const DISTRICT_SCHOOLS: Record<string, string[]> = {
  Chennai: [
    'Govt Model Higher Secondary School, Saidapet',
    'Govt Higher Secondary School, Ashok Nagar',
    'Corporation Higher Secondary School, Nungambakkam',
    'Govt Higher Secondary School, Tambaram',
  ],
  Coimbatore: [
    'Corporation Higher Secondary School, RS Puram, Coimbatore',
    'Govt Higher Secondary School, Singanallur',
    'Govt Higher Secondary School, Thondamuthur',
  ],
  Madurai: [
    'Govt Higher Secondary School, Othakadai, Madurai',
    'Sethupathi Higher Secondary School, Madurai',
    'Govt Model Girls Higher Secondary School, Madurai',
  ],
  Salem: [
    'Govt Boys Higher Secondary School, Salem Fort',
    'Govt Higher Secondary School, Suramangalam',
    'Municipal Higher Secondary School, Shevapet',
  ],
  Tiruchirappalli: [
    'Govt Model Girls Higher Secondary School, Tiruchirappalli',
    'Govt Higher Secondary School, Srirangam',
    'Govt Higher Secondary School, Ponmalai',
  ],
  Tirunelveli: [
    'Municipal Higher Secondary School, Tirunelveli Town',
    'Govt Higher Secondary School, Palayamkottai',
    'Govt Higher Secondary School, Pettai',
  ],
  Vellore: [
    'Govt Higher Secondary School, Katpadi, Vellore',
    'Govt Muslim Higher Secondary School, Vellore',
    'Govt Higher Secondary School, Sathuvachari',
  ],
  Erode: [
    'Govt Higher Secondary School, Perundurai, Erode',
    'Govt Girls Higher Secondary School, Bhavani',
    'Govt Higher Secondary School, Modakkurichi',
  ],
};

const SAMPLE_ADDRESSES: Record<string, string[]> = {
  Chennai: [
    '14/2, Pillaiyar Koil Street, Saidapet, Chennai 600015',
    '28, Kannagi Nagar, Thoraipakkam, Chennai 600097',
    '5, Bharathiyar Street, Tambaram Sanatorium, Chennai 600047',
  ],
  Coimbatore: [
    '42, Gandhi Puram 3rd Street, Coimbatore 641012',
    '18/4, Ramanathapuram Main Road, Coimbatore 641045',
  ],
  Madurai: [
    '9, Meenakshi Nagar, Othakadai, Madurai 625107',
    '23, Anna Main Street, Villapuram, Madurai 625012',
  ],
  Salem: [
    '11, Fort Main Road, Salem 636001',
    '34, Shevapet Bazaar Street, Salem 636002',
  ],
  Tiruchirappalli: [
    '7, Srirangam West Car Street, Tiruchirappalli 620006',
    '15, Ponmalai Railway Colony, Tiruchirappalli 620004',
  ],
  Tirunelveli: [
    '8, Town Car Street, Tirunelveli 627006',
    '19, Palayamkottai Market Road, Tirunelveli 627002',
  ],
  Vellore: [
    '12, Katpadi Railway Station Road, Vellore 632007',
    '25, Muslimpur Street, Vaniyambadi, Vellore 635751',
  ],
  Erode: [
    '16, Perundurai Road, Erode 638011',
    '31, Bhavani Kooduthurai Street, Erode 638301',
  ],
};

const STREAMS = [
  'Computer Science / Mathematics',
  'Biology / Mathematics',
  'Pure Science (Physics / Chemistry / Biology)',
  'Commerce with Computer Applications',
  'Vocational Electronics & Communication',
];

const WHY_MAATRAM_STATEMENTS = [
  'First-generation college aspirant seeking financial aid and mentorship for B.Tech Computer Science degree.',
  'Aspiring to become the first graduate engineer in my family to support my parents and uplift our village community.',
  'Determined to pursue B.Sc Data Science or IT; seeking Maatram scholarship to overcome severe financial hardship.',
  'Passionate about Electronics & Communication; need tuition support as family income is solely from daily farm wages.',
  'First graduate applicant dreaming of pursuing Artificial Intelligence to build accessible education tools.',
  'Seeking Maatram scholarship for B.Com / CA foundation to achieve financial independence and educate my younger siblings.',
  'Committed to pursuing Mechanical Engineering with Maatram guidance to break the cycle of generational poverty.',
];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Creates a safe, programmatic demonstration Blob in the browser.
 * Clearly marked as a DEMO / SAMPLE file, not an authentic government certificate.
 */
export function createSafeDemoBlob(
  label: string,
  fileName: string,
  applicantName: string
): Blob {
  const isImage = fileName.endsWith('.jpg') || fileName.endsWith('.png');
  const mimeType = isImage ? 'image/jpeg' : 'application/pdf';
  const textContent = `[DEMO / SAMPLE DOCUMENT - NOT AN AUTHENTIC GOVERNMENT CERTIFICATE]

Document Type: ${label}
File Name: ${fileName}
Applicant Name: ${applicantName}
Academic Cycle: 2026-2027
Timestamp: ${new Date().toISOString()}

Notice:
This document is programmatically generated exclusively for the Maatram One
frontend prototype demonstration. It contains mock test data and does not
represent or replace any official government, school, or financial record.
`;
  return new Blob([textContent], { type: mimeType });
}

/**
 * Creates a real, programmatic sample File object in the browser.
 * Clearly marked as a DEMO FILE.
 */
export function createSafeDemoFile(
  label: string,
  fileName: string,
  applicantName?: string
): File {
  const isFileNameFirst = label.includes('.');
  const actualFileName = isFileNameFirst ? label : fileName;
  const actualLabel = isFileNameFirst ? (applicantName || 'Document') : label;
  const actualApplicant = applicantName || 'Demo Applicant';
  const isImage =
    actualFileName.endsWith('.jpg') ||
    actualFileName.endsWith('.png') ||
    actualFileName.endsWith('.jpeg');
  const mimeType = isImage ? 'image/jpeg' : 'application/pdf';
  const textContent = `[DEMO / SAMPLE DOCUMENT - NOT AN AUTHENTIC GOVERNMENT CERTIFICATE]

Document Type: ${actualLabel}
File Name: ${actualFileName}
Applicant Name: ${actualApplicant}
Academic Cycle: 2026-2027
Timestamp: ${new Date().toISOString()}

Notice:
This document is programmatically generated exclusively for the Maatram One
frontend prototype demonstration. It contains mock test data and does not
represent or replace any official government, school, or financial record.
`;
  const blob = new Blob([textContent], { type: mimeType });
  return new File([blob], actualFileName, { type: mimeType, lastModified: Date.now() });
}

/**
 * Section 1: Generates dummy Personal Details.
 */
export function generateDemoPersonalDetails() {
  const isFemale = Math.random() < 0.5;
  const firstName = isFemale ? pickRandom(FEMALE_FIRST_NAMES) : pickRandom(MALE_FIRST_NAMES);
  const initial = pickRandom(INITIALS);
  const fullName = `${firstName} ${initial}`;
  const gender = isFemale ? 'Female' : 'Male';

  const birthYear = 2008;
  const birthMonth = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0');
  const birthDay = String(Math.floor(1 + Math.random() * 28)).padStart(2, '0');
  const dob = `${birthYear}-${birthMonth}-${birthDay}`;

  const region = pickRandom(DISTRICTS_8);
  const uniqueCode = Math.floor(1000 + Math.random() * 9000);
  const identityRef = `MOCK-TN-2026-${uniqueCode}`;

  const nameSlug = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const email = `${nameSlug}.${initial.toLowerCase()}${uniqueCode}@demo.local`;

  const phonePrefix = pickRandom(['9840', '9444', '9841', '8939', '7358', '9940']);
  const phoneSuffix = Math.floor(100000 + Math.random() * 900000);
  const phone = `${phonePrefix}${phoneSuffix}`;

  const addresses = SAMPLE_ADDRESSES[region] || SAMPLE_ADDRESSES['Chennai'];
  const address = pickRandom(addresses);
  const state = 'Tamil Nadu';

  return {
    fullName,
    email,
    phone,
    gender,
    dob,
    region,
    identityRef,
    address,
    state,
  };
}

/**
 * Section 2: Generates dummy Family Details.
 */
export function generateDemoFamilyDetails() {
  const fatherName = pickRandom(FATHER_NAMES);
  const motherName = pickRandom(MOTHER_NAMES);
  const finProfile = pickRandom(OCCUPATION_FINANCIAL_PROFILES);
  const housingType = Math.random() < 0.7 ? 'Rented' : 'Own';
  const familyMembersCount = String(Math.floor(3 + Math.random() * 3));

  return {
    fatherName,
    motherName,
    parentOccupation: finProfile.occupation,
    familyMembersCount,
    housingType,
  };
}

/**
 * Section 3: Generates dummy Educational Details.
 */
export function generateDemoEducationalDetails(region?: string) {
  const selectedRegion = region && DISTRICTS_8.includes(region as any) ? region : pickRandom(DISTRICTS_8);
  const regionSchools = DISTRICT_SCHOOLS[selectedRegion] || DISTRICT_SCHOOLS['Chennai'];
  const schoolName = pickRandom(regionSchools);
  const schoolType = Math.random() < 0.85 ? 'Government' : 'Private';
  const mediumOfInstruction = Math.random() < 0.7 ? 'Tamil' : 'English';
  const stream = pickRandom(STREAMS);
  const academicYear = '2026–2027';

  const tenthObtained = Math.floor(450 + Math.random() * 45); // 450 to 494
  const tenthTotal = 500;
  const tenthPct = ((tenthObtained / tenthTotal) * 100).toFixed(1);
  const tenthMarks = `${tenthObtained} / ${tenthTotal} (${tenthPct}%)`;

  const twelfthObtained = Math.floor(535 + Math.random() * 55); // 535 to 589
  const twelfthTotal = 600;
  const twelfthPct = ((twelfthObtained / twelfthTotal) * 100).toFixed(1);
  const twelfthMarks = `${twelfthObtained} / ${twelfthTotal} (${twelfthPct}%)`;

  return {
    schoolName,
    schoolType,
    mediumOfInstruction,
    stream,
    academicYear,
    tenthMarks,
    twelfthMarks,
    previousMarks: String(tenthObtained),
    totalMarks: String(twelfthObtained),
    percentage: `${twelfthPct}%`,
  };
}

/**
 * Section 4: Generates dummy Financial Details.
 */
export function generateDemoFinancialDetails() {
  const finProfile = pickRandom(OCCUPATION_FINANCIAL_PROFILES);
  const whyMaatram = pickRandom(WHY_MAATRAM_STATEMENTS);

  return {
    familyAnnualIncome: finProfile.annualIncome,
    incomeSource: finProfile.source,
    monthlyRent: finProfile.monthlyRent,
    schoolFees: finProfile.schoolFees,
    electricityBillAmount: finProfile.electricityBill,
    otherExpenses: finProfile.householdExpenses,
    outstandingLoans: finProfile.loans,
    whyMaatram,
  };
}

/**
 * Generates sample account registration details for New Account Creation demo helper.
 */
export function generateSampleRegistrationDetails() {
  const personal = generateDemoPersonalDetails();
  return {
    name: personal.fullName,
    phone: personal.phone,
    email: personal.email,
    district: personal.region,
    dob: personal.dob || '2008-05-14',
    password: 'DemoApplicant@123',
  };
}

/**
 * Generates sample academic details for Profile Management demo helper.
 */
export function generateDemoProfileAcademicDetails() {
  const samples = [
    {
      college: 'Anna University — College of Engineering Guindy (CEG)',
      degree: 'B.E. Computer Science and Engineering · 2026 Batch',
    },
    {
      college: 'Madras Institute of Technology (MIT), Chromepet',
      degree: 'B.Tech Information Technology · 2026 Batch',
    },
    {
      college: 'Government College of Technology (GCT), Coimbatore',
      degree: 'B.E. Electronics & Communication Engineering · 2026 Batch',
    },
    {
      college: 'PSG College of Technology, Coimbatore',
      degree: 'B.Tech Artificial Intelligence & Data Science · 2026 Batch',
    },
    {
      college: 'Thiagarajar College of Engineering, Madurai',
      degree: 'B.E. Mechanical Engineering · 2026 Batch',
    },
  ];
  return samples[Math.floor(Math.random() * samples.length)];
}

/**
 * Generates sample career entry for Anchor Profile demo helper.
 */
export function generateDemoCareerEntry() {
  const samples = [
    {
      company: 'Freshworks Inc.',
      roleTitle: 'Software Engineer II',
      startYear: 2024,
    },
    {
      company: 'Zoho Corporation',
      roleTitle: 'Product Developer',
      startYear: 2023,
    },
    {
      company: 'Cognizant Technology Solutions',
      roleTitle: 'Senior Systems Associate',
      startYear: 2024,
    },
    {
      company: 'Tata Consultancy Services',
      roleTitle: 'Full-Stack Developer',
      startYear: 2023,
    },
  ];
  return samples[Math.floor(Math.random() * samples.length)];
}

/**
 * Generates a complete, internally consistent, randomized demo applicant dataset.
 * Combines all sections.
 */
export function generateRandomApplicantData(): GeneratedDemoApplicant {
  const personal = generateDemoPersonalDetails();
  const family = generateDemoFamilyDetails();
  const edu = generateDemoEducationalDetails(personal.region);
  const fin = generateDemoFinancialDetails();

  const eligibilityProofType = pickRandom([
    'govt_school_attendance',
    'govt_school_attendance',
    'school_fee_receipt',
    'employment_proof',
  ]) as 'govt_school_attendance' | 'school_fee_receipt' | 'employment_proof';

  const appCodeSuffix = String(Math.floor(10 + Math.random() * 90));
  const applicationCode = `APP-2026-${appCodeSuffix}`;
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  const answers: ApplicationAnswers = {
    fullName: personal.fullName,
    phone: personal.phone,
    gender: personal.gender,
    dob: personal.dob,
    identityRef: personal.identityRef,
    fatherName: family.fatherName,
    motherName: family.motherName,
    parentOccupation: family.parentOccupation,
    familyMembersCount: family.familyMembersCount,
    housingType: family.housingType as 'Rented' | 'Own',
    schoolName: edu.schoolName,
    schoolType: edu.schoolType as 'Government' | 'Private',
    mediumOfInstruction: edu.mediumOfInstruction,
    stream: edu.stream,
    tenthMarks: edu.tenthMarks,
    twelfthMarks: edu.twelfthMarks,
    familyAnnualIncome: fin.familyAnnualIncome,
    incomeSource: fin.incomeSource,
    whyMaatram: fin.whyMaatram,
    eligibilityProofType,

    address: personal.address,
    district: personal.region,
    state: personal.state,
    academicYear: edu.academicYear,
    previousMarks: edu.previousMarks,
    totalMarks: edu.totalMarks,
    percentage: edu.percentage,
    monthlyRent: fin.monthlyRent,
    schoolFees: fin.schoolFees,
    electricityBillAmount: fin.electricityBillAmount,
    otherExpenses: fin.otherExpenses,
    outstandingLoans: fin.outstandingLoans,
  };

  const eligibilityFileName =
    eligibilityProofType === 'school_fee_receipt'
      ? 'school_fee_proof_demo.pdf'
      : eligibilityProofType === 'employment_proof'
        ? 'current_employment_proof_demo.pdf'
        : 'govt_school_attendance_demo.pdf';

  const eligibilityLabel =
    eligibilityProofType === 'school_fee_receipt'
      ? 'Previous-Year School Fee Receipt'
      : eligibilityProofType === 'employment_proof'
        ? 'Current Employment Proof'
        : 'Government School Attendance Proof';

  const housingProofLabel =
    family.housingType === 'Own' ? 'House Tax / Property Proof' : 'House Rent Receipt';
  const housingProofFileName =
    family.housingType === 'Own' ? 'property_tax_receipt_demo.pdf' : 'house_rent_receipt_demo.pdf';

  const documents = [
    {
      label: 'Income Certificate',
      fileName: 'income_certificate_demo.pdf',
      size: 245000 + Math.floor(Math.random() * 30000),
      fileType: 'application/pdf',
      description: 'DEMO / SAMPLE · Income Certificate',
    },
    {
      label: housingProofLabel,
      fileName: housingProofFileName,
      size: 185000 + Math.floor(Math.random() * 25000),
      fileType: 'application/pdf',
      description: `DEMO / SAMPLE · ${housingProofLabel}`,
    },
    {
      label: eligibilityLabel,
      fileName: eligibilityFileName,
      size: 210000 + Math.floor(Math.random() * 20000),
      fileType: 'application/pdf',
      description: `DEMO / SAMPLE · ${eligibilityLabel}`,
    },
    {
      label: 'Electricity Bill',
      fileName: 'electricity_bill_demo.pdf',
      size: 195000 + Math.floor(Math.random() * 20000),
      fileType: 'application/pdf',
      description: 'DEMO / SAMPLE · Electricity Bill',
    },
    {
      label: '10th Marksheet',
      fileName: 'marksheet_10th_demo.pdf',
      size: 310000 + Math.floor(Math.random() * 40000),
      fileType: 'application/pdf',
      description: 'DEMO / SAMPLE · 10th Board Marksheet',
    },
    {
      label: '12th Marksheet',
      fileName: 'marksheet_12th_demo.pdf',
      size: 325000 + Math.floor(Math.random() * 40000),
      fileType: 'application/pdf',
      description: 'DEMO / SAMPLE · 12th Board Marksheet',
    },
    {
      label: 'One House Photo',
      fileName: 'residence_front_demo.jpg',
      size: 450000 + Math.floor(Math.random() * 50000),
      fileType: 'image/jpeg',
      description: 'DEMO / SAMPLE · Residence Front Exterior Photo',
    },
  ];

  return {
    answers,
    email: personal.email,
    region: personal.region,
    otp,
    applicationCode,
    documents,
  };
}
