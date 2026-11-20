export interface CompanyAliasRule {
  alias: string;
  canonical: string;
}

export const COMPANY_ALIAS_TABLE: CompanyAliasRule[] = [
  { alias: 'tcs', canonical: 'Tata Consultancy Services' },
  { alias: 'tata consultancy', canonical: 'Tata Consultancy Services' },
  { alias: 'tata consultancy services', canonical: 'Tata Consultancy Services' },
  { alias: 'cts', canonical: 'Cognizant' },
  { alias: 'cognizant technology solutions', canonical: 'Cognizant' },
  { alias: 'cognizant', canonical: 'Cognizant' },
  { alias: 'infy', canonical: 'Infosys' },
  { alias: 'infosys', canonical: 'Infosys' },
  { alias: 'wipro', canonical: 'Wipro' },
  { alias: 'wipro technologies', canonical: 'Wipro' },
  { alias: 'zoho', canonical: 'Zoho Corporation' },
  { alias: 'zoho corp', canonical: 'Zoho Corporation' },
  { alias: 'zoho corporation', canonical: 'Zoho Corporation' },
  { alias: 'hcl', canonical: 'HCLTech' },
  { alias: 'hcl technologies', canonical: 'HCLTech' },
  { alias: 'hcltech', canonical: 'HCLTech' },
  { alias: 'freshworks', canonical: 'Freshworks' },
  { alias: 'msft', canonical: 'Microsoft' },
  { alias: 'microsoft', canonical: 'Microsoft' },
  { alias: 'amzn', canonical: 'Amazon' },
  { alias: 'amazon', canonical: 'Amazon' },
  { alias: 'amazon development centre', canonical: 'Amazon' },
];

export const SUFFIX_PATTERNS: RegExp[] = [
  /\bprivate\s+limited\b/gi,
  /\bpvt\.?\s*ltd\.?\b/gi,
  /\blimited\b/gi,
  /\bltd\.?\b/gi,
  /\bincorporated\b/gi,
  /\binc\.?\b/gi,
  /\bllp\b/gi,
  /\bcorporation\b/gi,
  /\bcorp\.?\b/gi,
  /\btechnologies\b/gi,
  /\bindia\b/gi,
];

export const VISIBLE_NORMALIZATION_RULES: string[] = [
  '1. Trim whitespace and collapse repeated spaces.',
  '2. Case-insensitive comparison (e.g. "tcs" and "TCS" match).',
  '3. Strip legal & regional suffixes: Pvt Ltd, Private Limited, Limited, Ltd, Inc, LLP, Corp, Corporation, India.',
  '4. Resolve known employer aliases (e.g. TCS = Tata Consultancy Services, CTS = Cognizant, INFY = Infosys, HCL = HCLTech).',
];

export interface NormalizationResult {
  raw: string;
  stripped: string;
  normalized: string;
  canonicalKey: string;
  appliedRules: string[];
}

export function normalizeCompanyName(raw: string): NormalizationResult {
  const appliedRules: string[] = [];
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return {
      raw,
      stripped: '',
      normalized: '',
      canonicalKey: '',
      appliedRules: [],
    };
  }

  const lower = trimmed.toLowerCase();
  if (trimmed !== lower) {
    appliedRules.push('case-insensitive fold');
  }

  // First check exact alias before stripping words like "Technologies" or "Corporation"
  const directAlias = COMPANY_ALIAS_TABLE.find((entry) => entry.alias === lower);
  if (directAlias) {
    appliedRules.push(`alias match (${trimmed} → ${directAlias.canonical})`);
    return {
      raw,
      stripped: trimmed,
      normalized: directAlias.canonical,
      canonicalKey: directAlias.canonical.toLowerCase(),
      appliedRules,
    };
  }

  let working = trimmed.replace(/[.,]+$/g, '');
  let strippedSomething = false;
  for (const pattern of SUFFIX_PATTERNS) {
    const next = working.replace(pattern, '').replace(/[.,]+$/g, '').replace(/\s+/g, ' ').trim();
    if (next !== working && next.length > 0) {
      strippedSomething = true;
      working = next;
    }
  }
  if (strippedSomething) {
    appliedRules.push('stripped legal/corporate suffix');
  }

  const postStripLower = working.toLowerCase();
  const postAlias = COMPANY_ALIAS_TABLE.find((entry) => entry.alias === postStripLower);
  if (postAlias) {
    appliedRules.push(`alias match (${working} → ${postAlias.canonical})`);
    return {
      raw,
      stripped: working,
      normalized: postAlias.canonical,
      canonicalKey: postAlias.canonical.toLowerCase(),
      appliedRules,
    };
  }

  const titleCased = working
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    raw,
    stripped: working,
    normalized: titleCased,
    canonicalKey: postStripLower,
    appliedRules,
  };
}
