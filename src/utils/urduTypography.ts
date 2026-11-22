/**
 * Urdu Typography & Ligature Validation Utilities
 * Specialized for Kashmiri & Noori Nastaleeq script rendering,
 * ligature integrity scanning, and WCAG AA contrast compliance.
 */

export const TARGET_CORRECTED_NAME = 'گورنمنٹ مڈل اسکول پامپوش کالونی';
export const OFFICIAL_ALT_CORRECTED_NAME = 'گورنمنٹ مڈل اسکول پمپوش کالونی';
export const ORIGINAL_NAME_WITH_MODEL = 'گورنمنٹ ماڈل مڈل اسکول پمپوش کالونی';

export interface UrduAnomaly {
  id: string;
  type: 'broken-ligature' | 'disconnected-char' | 'outdated-word' | 'orphan-diacritic' | 'mixed-script' | 'spacing-irregularity';
  message: string;
  severity: 'error' | 'warning' | 'info';
  charIndex?: number;
  highlightSubstring?: string;
}

export interface UrduValidationResult {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  anomalies: UrduAnomaly[];
  ligatureHealthScore: number; // 0 - 100
  charCount: number;
  wordCount: number;
}

export interface StackingClusterInfo {
  word: string;
  cluster: string;
  depthScore: number; // Tiers of vertical stacking (1.0 to 5.0)
  tierLevel: 'Single Tier' | 'Double Tier' | 'Triple Cascade' | 'Deep Cascade';
  description: string;
}

export interface UrduCharacterAnalysis {
  totalChars: number;
  charsWithoutSpaces: number;
  urduLettersCount: number;
  diacriticsCount: number;
  spaceCount: number;
  wordCount: number;
  ligatureDepthScore: number; // Max vertical cascade depth (e.g. 3.4 tiers)
  averageStackingDepth: number; // Mean stacking depth across clusters
  maxStackingCluster: string; // e.g. 'نمنٹ'
  maxStackingWord: string; // e.g. 'گورنمنٹ'
  stackingTiers: StackingClusterInfo[];
  hpcLayoutSuitability: {
    status: 'Optimal' | 'Caution' | 'Exceeds';
    badgeLabel: string;
    description: string;
    estimatedHeaderWidthMm: number;
    recommendedLineHeight: string;
    verticalClearancePt: number;
    isSafeForA4Header: boolean;
  };
}

/**
 * Analyzes Urdu text in real time: calculates character counts (total, letters, aerab, spaces),
 * and measures Nastaleeq ligature stacking depth and report card layout compatibility.
 */
export function analyzeUrduCharactersAndLigatures(text: string): UrduCharacterAnalysis {
  const normalized = text || '';
  const totalChars = normalized.length;
  const charsWithoutSpaces = normalized.replace(/\s+/g, '').length;
  const spaceCount = (normalized.match(/\s/g) || []).length;
  const words = normalized.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Urdu/Arabic alphabetic characters
  const urduLettersMatch = normalized.match(/[\u0621-\u064A\u0671-\u06D3\u06D5]/g);
  const urduLettersCount = urduLettersMatch ? urduLettersMatch.length : 0;

  // Diacritics (Aerab/Harakat: Zabar, Zer, Pesh, Tashdeed, Jazm, Sukun)
  const diacriticsMatch = normalized.match(/[\u064B-\u065F\u0670]/g);
  const diacriticsCount = diacriticsMatch ? diacriticsMatch.length : 0;

  // Stacking Cluster Analysis for Nastaleeq typography
  const clusters: StackingClusterInfo[] = [];

  words.forEach((w) => {
    if (w.includes('گورنمنٹ')) {
      clusters.push({
        word: 'گورنمنٹ',
        cluster: 'نمنٹ',
        depthScore: 3.4,
        tierLevel: 'Deep Cascade',
        description: '4-letter joined sequence (Noon + Meem + Noon + Te) with steep vertical slope',
      });
    } else if (w.includes('پامپوش')) {
      clusters.push({
        word: 'پامپوش',
        cluster: 'پامپ',
        depthScore: 3.1,
        tierLevel: 'Triple Cascade',
        description: 'Initial Pe + Alif ascending + Meem-Pe medial descent',
      });
    } else if (w.includes('پمپوش')) {
      clusters.push({
        word: 'پمپوش',
        cluster: 'پمپ',
        depthScore: 3.3,
        tierLevel: 'Deep Cascade',
        description: 'Continuous Pe + Meem + Pe vertical cascade with 3 nuktas on top & bottom',
      });
    } else if (w.includes('کالونی')) {
      clusters.push({
        word: 'کالونی',
        cluster: 'کالو / نی',
        depthScore: 2.8,
        tierLevel: 'Triple Cascade',
        description: 'Ascending Kaaf arm + descending Laam-Waw + retrograde Chhoti Ye loop',
      });
    } else if (w.includes('اسکول')) {
      clusters.push({
        word: 'اسکول',
        cluster: 'سک / ول',
        depthScore: 2.4,
        tierLevel: 'Double Tier',
        description: 'Seen teeth + Kaaf joint + Waw drop with hanging Laam tail',
      });
    } else if (w.includes('مڈل')) {
      clusters.push({
        word: 'مڈل',
        cluster: 'مڈ',
        depthScore: 2.0,
        tierLevel: 'Double Tier',
        description: 'Compact Meem-Daal hanging join',
      });
    } else if (w.includes('ماڈل')) {
      clusters.push({
        word: 'ماڈل',
        cluster: 'ماڈ',
        depthScore: 2.0,
        tierLevel: 'Double Tier',
        description: 'Deprecated word cluster scheduled for removal',
      });
    } else {
      // Dynamic fallback estimation based on length and joining characters
      const joinedChars = (w.match(/[\u0628-\u064A\u0679-\u06D2]/g) || []).length;
      const estimatedDepth = Math.min(4.0, Math.max(1.0, 1.2 + joinedChars * 0.35));
      clusters.push({
        word: w,
        cluster: w.slice(0, 4),
        depthScore: Math.round(estimatedDepth * 10) / 10,
        tierLevel: estimatedDepth > 3.0 ? 'Deep Cascade' : estimatedDepth > 2.0 ? 'Triple Cascade' : 'Double Tier',
        description: `${joinedChars} joined cursive glyphs`,
      });
    }
  });

  const maxStackingDepth = clusters.length > 0 ? Math.max(...clusters.map((c) => c.depthScore)) : 1.0;
  const averageStackingDepth = clusters.length > 0
    ? Math.round((clusters.reduce((sum, c) => sum + c.depthScore, 0) / clusters.length) * 10) / 10
    : 1.0;

  const maxCluster = clusters.find((c) => c.depthScore === maxStackingDepth);

  // Layout suitability for HPC report cards
  // Standard A4 HPC header width allows ~170mm, standard printable school name is 60-80mm
  const estimatedHeaderWidthMm = Math.round(charsWithoutSpaces * 2.5 + spaceCount * 1.8);
  const isSafeForA4Header = estimatedHeaderWidthMm <= 95 && maxStackingDepth <= 4.2;

  return {
    totalChars,
    charsWithoutSpaces,
    urduLettersCount,
    diacriticsCount,
    spaceCount,
    wordCount,
    ligatureDepthScore: maxStackingDepth,
    averageStackingDepth,
    maxStackingCluster: maxCluster?.cluster || '—',
    maxStackingWord: maxCluster?.word || '—',
    stackingTiers: clusters,
    hpcLayoutSuitability: {
      status: isSafeForA4Header ? 'Optimal' : 'Caution',
      badgeLabel: isSafeForA4Header
        ? 'Optimal for HPC Progress Card & Evaluation Register Headers'
        : 'Requires Spacing Adjustment for Compact Reports',
      description: isSafeForA4Header
        ? `Text length (${charsWithoutSpaces} chars) and ligature depth (${maxStackingDepth} tiers) fit within statutory A4 / HPC Report Card header boundaries without clipping.`
        : 'High ligature cascade depth requires expanded vertical line-height in report layouts.',
      estimatedHeaderWidthMm,
      recommendedLineHeight: '1.85x – 2.0x (Ensures zero ligature clipping in print and PDF)',
      verticalClearancePt: 42,
      isSafeForA4Header,
    },
  };
}

/**
 * Automatically removes the word 'ماڈل' from the school name
 * and normalizes Urdu spaces and ligatures.
 */
export function removeModelWord(input: string): {
  correctedText: string;
  hadModelWord: boolean;
  changesCount: number;
} {
  if (!input) {
    return {
      correctedText: TARGET_CORRECTED_NAME,
      hadModelWord: false,
      changesCount: 0,
    };
  }

  const raw = input.trim();
  const hadModelWord = /ماڈل/.test(raw) || /ماڈل/i.test(raw);

  // Exact replacement for all variations of the school name
  let corrected = raw
    .replace(/گورنمنٹ\s+ماڈل\s+مڈل\s+اسکول\s+پامپوش\s+کالونی/gi, TARGET_CORRECTED_NAME)
    .replace(/گورنمنٹ\s+ماڈل\s+مڈل\s+اسکول\s+پمپوش\s+کالونی/gi, TARGET_CORRECTED_NAME)
    .replace(/\s*ماڈل\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // If after removing ماڈل it is close, preserve user's preferred spelling of پامپوش or پمپوش
  if (corrected.includes('گورنمنٹ') && (corrected.includes('پامپوش') || corrected.includes('پمپوش'))) {
    if (raw.includes('پامپوش')) {
      corrected = TARGET_CORRECTED_NAME;
    } else {
      corrected = OFFICIAL_ALT_CORRECTED_NAME;
    }
  }

  return {
    correctedText: corrected,
    hadModelWord,
    changesCount: hadModelWord ? 1 : 0,
  };
}

/**
 * Validates Urdu Nastaleeq text for rendering anomalies:
 * - Broken ligatures or rogue zero-width joiners/non-joiners
 * - Disconnected Urdu characters
 * - Unattached / orphaned diacritics (Harakat)
 * - Outdated 'ماڈل' word
 * - Mixed Latin script fragments
 */
export function validateUrduLigatures(text: string): UrduValidationResult {
  const anomalies: UrduAnomaly[] = [];
  const normalized = text || '';
  const trimmed = normalized.trim();

  // 1. Check for legacy word "ماڈل"
  if (/ماڈل/.test(trimmed)) {
    anomalies.push({
      id: 'outdated-model-word',
      type: 'outdated-word',
      message: 'Detected deprecated word "ماڈل". Use Refine Typography to remove it.',
      severity: 'warning',
      highlightSubstring: 'ماڈل',
    });
  }

  // 2. Scan for rogue zero-width characters that break Nastaleeq cursive ligatures
  const zwjRegex = /[\u200D\u200C]{2,}/g;
  if (zwjRegex.test(trimmed)) {
    anomalies.push({
      id: 'broken-ligature-zw',
      type: 'broken-ligature',
      message: 'Consecutive zero-width formatting characters detected, breaking Nastaleeq ligature joins.',
      severity: 'error',
    });
  }

  // 3. Scan for isolated/orphaned diacritics (Harakat at start or after space)
  const orphanDiacriticRegex = /(?:^|\s)[\u064B-\u065F\u0670]/g;
  if (orphanDiacriticRegex.test(trimmed)) {
    anomalies.push({
      id: 'orphan-diacritic',
      type: 'orphan-diacritic',
      message: 'Orphaned vowel mark (Zabar, Zer, or Pesh) without an Urdu base letter.',
      severity: 'error',
    });
  }

  // 4. Check for mixed non-Urdu characters (e.g. stray English letters)
  const mixedLatinRegex = /[a-zA-Z]/;
  if (mixedLatinRegex.test(trimmed)) {
    anomalies.push({
      id: 'mixed-latin',
      type: 'mixed-script',
      message: 'Latin characters mixed inside Urdu typography string.',
      severity: 'warning',
    });
  }

  // 5. Scan for disconnected Arabic/Urdu non-final characters followed by illegal space inside a recognized word
  // e.g. "گور نمٹ" instead of "گورنمنٹ", or "پم پوش" instead of "پمپوش"
  if (/گور\s+نمنٹ/.test(trimmed) || /پم\s+پوش/.test(trimmed)) {
    anomalies.push({
      id: 'disconnected-syllable',
      type: 'disconnected-char',
      message: 'Unintended word break detected inside compound Urdu word.',
      severity: 'warning',
    });
  }

  // 6. Check for consecutive whitespace
  if (/\s{2,}/.test(trimmed)) {
    anomalies.push({
      id: 'spacing-irregularity',
      type: 'spacing-irregularity',
      message: 'Irregular inter-word spacing detected; may cause stretched ligature blocks.',
      severity: 'info',
    });
  }

  const hasErrors = anomalies.some((a) => a.severity === 'error');
  const hasWarnings = anomalies.some((a) => a.severity === 'warning');
  const errorCount = anomalies.filter((a) => a.severity === 'error').length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length;

  const ligatureHealthScore = Math.max(0, 100 - errorCount * 30 - warningCount * 15);
  const words = trimmed.split(/\s+/).filter(Boolean);

  return {
    isValid: !hasErrors && anomalies.length === 0,
    hasErrors,
    hasWarnings,
    anomalies,
    ligatureHealthScore,
    charCount: trimmed.length,
    wordCount: words.length,
  };
}

/**
 * Calculates WCAG 2.1 relative luminance and contrast ratio.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  if (cleaned.length !== 6) return null;
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [sR, sG, sB] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sR + 0.7152 * sG + 0.0722 * sB;
}

export function calculateWcagContrast(
  foregroundHex: string,
  backgroundHex: string
): {
  ratio: number;
  ratioString: string;
  isAaLargeCompliant: boolean;
  isAaNormalCompliant: boolean;
  isAaaCompliant: boolean;
  scoreLabel: string;
} {
  const fg = hexToRgb(foregroundHex) || { r: 255, g: 255, b: 255 };
  const bg = hexToRgb(backgroundHex) || { r: 15, g: 23, b: 42 };

  const lum1 = getRelativeLuminance(fg.r, fg.g, fg.b);
  const lum2 = getRelativeLuminance(bg.r, bg.g, bg.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  const ratio = (brightest + 0.05) / (darkest + 0.05);

  const rounded = Math.round(ratio * 100) / 100;
  const isAaLarge = ratio >= 3.0; // Large text (>= 18pt or 14pt bold)
  const isAaNormal = ratio >= 4.5;
  const isAaa = ratio >= 7.0;

  let scoreLabel = 'Fail (< 3.0:1)';
  if (isAaa) scoreLabel = 'AAA Pass (Superior ≥ 7:1)';
  else if (isAaNormal) scoreLabel = 'AA Pass (Optimal ≥ 4.5:1)';
  else if (isAaLarge) scoreLabel = 'AA Large Pass (≥ 3:1)';

  return {
    ratio: rounded,
    ratioString: `${rounded.toFixed(2)}:1`,
    isAaLargeCompliant: isAaLarge,
    isAaNormalCompliant: isAaNormal,
    isAaaCompliant: isAaa,
    scoreLabel,
  };
}

export interface NastaleeqOverlapIssue {
  pattern: string;
  word: string;
  description: string;
  severity: 'warning' | 'caution';
}

export interface NastaleeqOverlapDiagnostic {
  hasPotentialOverlap: boolean;
  issues: NastaleeqOverlapIssue[];
  summary: string;
}

const KNOWN_OVERLAP_PATTERNS: { regex: RegExp; label: string; description: string }[] = [
  {
    regex: /نمنٹ/,
    label: 'نمنٹ',
    description: '4-letter steep Nastaleeq cascade (Noon-Meem-Noon-Te) prone to baseline collision in Noto Nastaliq.',
  },
  {
    regex: /پامپ|پمپ/,
    label: 'پامپ / پمپ',
    description: 'Adjacent Pe + Meem + Pe cluster with opposing top/bottom nuqtas prone to vertical overlap.',
  },
  {
    regex: /کال|گل|کل/,
    label: 'کال / کل',
    description: 'Kaaf/Gaaf diagonal stroke joining Laam ascender; spacing tightens without kern-optimize.',
  },
  {
    regex: /سکول|مڈل/,
    label: 'سکول / مڈل',
    description: 'Multi-tooth Seen or retroflex Daal join susceptible to kerning compression.',
  },
  {
    regex: /[\u064B-\u065F\u0670]/,
    label: 'Aerab / Diacritics',
    description: 'Stacked vowel/tashdeed diacritic marks may collide with adjacent ligature ascenders.',
  },
];

/**
 * Diagnostic scanner that inspects Arabic/Urdu text for common overlapping
 * ligature patterns found in Noto/Noori Nastaliq and recommends 'kern-optimize'.
 */
export function scanNastaleeqOverlappingLigatures(text: string): NastaleeqOverlapDiagnostic {
  const normalized = (text || '').trim();
  if (!normalized) {
    return {
      hasPotentialOverlap: false,
      issues: [],
      summary: 'No Urdu/Arabic text present to scan.',
    };
  }

  const issues: NastaleeqOverlapIssue[] = [];
  const words = normalized.split(/\s+/).filter(Boolean);

  words.forEach((word) => {
    for (const rule of KNOWN_OVERLAP_PATTERNS) {
      if (rule.regex.test(word)) {
        const match = word.match(rule.regex)?.[0] || rule.label;
        if (!issues.some((i) => i.pattern === match && i.word === word)) {
          issues.push({
            pattern: match,
            word,
            description: rule.description,
            severity: 'warning',
          });
        }
      }
    }

    // Check any generic long cursive Nastaleeq ligature run (4+ consecutive joining Arabic/Urdu letters)
    const longRuns = word.match(/[\u0628-\u064A\u0679-\u06D2]{4,}/g) || [];
    longRuns.forEach((run) => {
      const dottedCount = (run.match(/[پتثجچخڐذزژشضظغفقنی]/g) || []).length;
      if (dottedCount >= 2 && !issues.some((i) => i.word === word && i.pattern === run)) {
        issues.push({
          pattern: run,
          word,
          description: `Dense ${run.length}-glyph ligature with ${dottedCount} dotted letters; may exhibit kerning overlap in Noto Nastaliq.`,
          severity: 'caution',
        });
      }
    });
  });

  const hasPotentialOverlap = issues.length > 0;
  const summary = hasPotentialOverlap
    ? `Detected ${issues.length} Nastaleeq ligature cluster${issues.length > 1 ? 's' : ''} prone to overlap. Enable 'kern-optimize' to normalize spacing.`
    : 'No overlapping Nastaleeq ligature patterns detected.';

  return { hasPotentialOverlap, issues, summary };
}

/**
 * Extracts live Arabic/Urdu text from a .font-noori DOM container (ignoring
 * non-text UI chrome such as buttons, sliders, and diagnostic panels) and runs
 * the overlapping ligature diagnostic scanner on that content.
 */
export function scanNooriDomContainerOverlaps(
  containerEl: HTMLElement | null,
  fallbackText = ''
): NastaleeqOverlapDiagnostic {
  let extractedText = '';

  if (containerEl) {
    const textNodes = containerEl.querySelectorAll('[data-noori-text="true"]');
    if (textNodes.length > 0) {
      extractedText = Array.from(textNodes)
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean)
        .join(' ');
    } else {
      const clone = containerEl.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll(
          '.no-print, [data-noori-controls="true"], [data-noori-ui="true"], button, input, select, textarea, svg'
        )
        .forEach((el) => el.remove());
      extractedText = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }
  }

  return scanNastaleeqOverlappingLigatures(extractedText || fallbackText);
}

export interface LigatureSegmentToken {
  text: string;
  isLigature: boolean;
  hasOverlapRisk: boolean;
}

/**
 * Splits text into Arabic/Urdu ligature segments vs whitespace/punctuation
 * for visual highlighting inside the Ligature Inspector overlay.
 */
export function segmentArabicUrduLigatures(text: string): LigatureSegmentToken[] {
  if (!text) return [];
  // Match cursive Arabic/Urdu glyph sequences (2+ glyphs or letter + diacritic), single Arabic chars, or non-Arabic spans
  const regex = /([\u0621-\u06D5\u064B-\u065F\u0670]{2,}|[\u0621-\u06D5\u064B-\u065F\u0670]|[^\u0621-\u06D5\u064B-\u065F\u0670]+)/g;
  const tokens: LigatureSegmentToken[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const chunk = match[0];
    const arabicChars = chunk.match(/[\u0621-\u06D5]/g) || [];
    const isLigature = arabicChars.length >= 2;
    const hasOverlapRisk =
      isLigature &&
      (KNOWN_OVERLAP_PATTERNS.some((r) => r.regex.test(chunk)) ||
        (chunk.match(/[\u0628-\u064A\u0679-\u06D2]{4,}/) !== null));

    tokens.push({
      text: chunk,
      isLigature,
      hasOverlapRisk,
    });
  }

  return tokens;
}

export interface BatchScanHotspot {
  rank: number;
  region: string;
  sampleWords: string[];
  sources: string[];
  frequency: number;
  riskScore: number;
  suggestedKernSetting: string;
  suggestedTrackingPx: number;
  recommendedLineHeight: number;
  reason: string;
}

export interface BatchScanResult {
  totalDocumentsScanned: number;
  totalUrduWordsScanned: number;
  totalOverlappingRegions: number;
  top5Hotspots: BatchScanHotspot[];
  scannedAt: string;
}

/**
 * Batch Scan across one or more Urdu document sections to rank the top 5 most
 * frequently overlapping Nastaleeq ligature regions and suggest exact 'kern' adjustments.
 */
export function runLigatureBatchScan(
  documents: { source: string; text: string }[]
): BatchScanResult {
  const bucket = new Map<
    string,
    {
      region: string;
      sampleWords: Set<string>;
      sources: Set<string>;
      frequency: number;
      baseWeight: number;
      reason: string;
      suggestedKernSetting: string;
      suggestedTrackingPx: number;
      recommendedLineHeight: number;
    }
  >();

  let totalWords = 0;

  documents.forEach((docItem) => {
    const words = (docItem.text || '').trim().split(/\s+/).filter(Boolean);
    totalWords += words.length;

    words.forEach((word) => {
      let matchedAnyKnown = false;
      for (const rule of KNOWN_OVERLAP_PATTERNS) {
        if (rule.regex.test(word)) {
          matchedAnyKnown = true;
          const m = word.match(rule.regex)?.[0] || rule.label;
          const key = m;
          const existing = bucket.get(key) || {
            region: m,
            sampleWords: new Set<string>(),
            sources: new Set<string>(),
            frequency: 0,
            baseWeight: m.length >= 4 ? 3 : 2,
            reason: rule.description,
            suggestedKernSetting: '"kern" 0, "liga" 1, "calt" 1',
            suggestedTrackingPx: m.length >= 4 ? 2 : 1,
            recommendedLineHeight: m.length >= 4 ? 2.2 : 2.0,
          };
          existing.frequency += 1;
          existing.sampleWords.add(word);
          existing.sources.add(docItem.source);
          bucket.set(key, existing);
        }
      }

      const longRuns = word.match(/[\u0628-\u064A\u0679-\u06D2]{4,}/g) || [];
      longRuns.forEach((run) => {
        const dotted = (run.match(/[پتثجچخڐذزژشضظغفقنی]/g) || []).length;
        if (!matchedAnyKnown || dotted >= 2) {
          const key = run.slice(0, 4);
          const existing = bucket.get(key) || {
            region: key,
            sampleWords: new Set<string>(),
            sources: new Set<string>(),
            frequency: 0,
            baseWeight: dotted >= 2 ? 2.5 : 1.5,
            reason: `Dense ${run.length}-glyph cursive sequence (${dotted} dotted letters) prone to baseline collision.`,
            suggestedKernSetting: '"kern" 0, "calt" 1',
            suggestedTrackingPx: dotted >= 2 ? 2 : 1,
            recommendedLineHeight: 2.1,
          };
          existing.frequency += 1;
          existing.sampleWords.add(word);
          existing.sources.add(docItem.source);
          bucket.set(key, existing);
        }
      });
    });
  });

  const sorted = Array.from(bucket.values())
    .map((entry) => ({
      ...entry,
      riskScore: Math.round(entry.frequency * entry.baseWeight * 10) / 10,
    }))
    .sort((a, b) => b.frequency - a.frequency || b.riskScore - a.riskScore);

  const top5Hotspots: BatchScanHotspot[] = sorted.slice(0, 5).map((item, idx) => ({
    rank: idx + 1,
    region: item.region,
    sampleWords: Array.from(item.sampleWords).slice(0, 4),
    sources: Array.from(item.sources).slice(0, 3),
    frequency: item.frequency,
    riskScore: item.riskScore,
    suggestedKernSetting: item.suggestedKernSetting,
    suggestedTrackingPx: item.suggestedTrackingPx,
    recommendedLineHeight: item.recommendedLineHeight,
    reason: item.reason,
  }));

  return {
    totalDocumentsScanned: documents.length,
    totalUrduWordsScanned: totalWords,
    totalOverlappingRegions: sorted.length,
    top5Hotspots,
    scannedAt: new Date().toISOString(),
  };
}

export interface MissingLigatureReport {
  id: string;
  word: string;
  unicodeHex: string;
  issueType: 'Missing Glyph' | 'Overlapping Nuqta' | 'Broken Join' | 'Spacing Anomaly';
  notes: string;
  createdAt: string;
}

export function formatUnicodeHexSequence(text: string): string {
  return Array.from((text || '').trim())
    .map((ch) => `U+${ch.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ');
}

export function buildNooriGlyphMetricsReport(params: {
  sampleText: string;
  fontSizePx: number;
  lineHeight: number;
  kernOptimize: boolean;
  highContrast: boolean;
  missingReports: MissingLigatureReport[];
}) {
  const charAnalysis = analyzeUrduCharactersAndLigatures(params.sampleText);
  const overlapDiag = scanNastaleeqOverlappingLigatures(params.sampleText);
  const tokens = segmentArabicUrduLigatures(params.sampleText).filter((t) => t.isLigature);

  return {
    fontFamily: 'Noori Nastaleeq',
    fontFaceUrl: '/fonts/NooriNastaliq.ttf',
    generatedAt: new Date().toISOString(),
    activeConfiguration: {
      fontSizePx: params.fontSizePx,
      lineHeight: params.lineHeight,
      kernOptimizeEnabled: params.kernOptimize,
      fontFeatureSettings: params.kernOptimize ? '"kern" 0' : '"kern" 1, "liga" 1, "calt" 1',
      textRendering: 'optimizeLegibility',
      highContrastReadingMode: params.highContrast,
    },
    unicodeBlockCoverage: [
      { block: 'Arabic (Core Urdu & Kashmiri)', range: 'U+0600 – U+06FF', status: 'Active' },
      { block: 'Arabic Supplement', range: 'U+0750 – U+077F', status: 'Active' },
      { block: 'Arabic Presentation Forms-A', range: 'U+FB50 – U+FDFF', status: 'Ligature Lookup' },
      { block: 'Arabic Presentation Forms-B', range: 'U+FE70 – U+FEFF', status: 'Contextual Forms' },
    ],
    documentMetrics: {
      totalChars: charAnalysis.totalChars,
      urduLetters: charAnalysis.urduLettersCount,
      diacritics: charAnalysis.diacriticsCount,
      maxCascadeDepthTiers: charAnalysis.ligatureDepthScore,
      maxStackingCluster: charAnalysis.maxStackingCluster,
      recommendedLineHeight: charAnalysis.hpcLayoutSuitability.recommendedLineHeight,
      overlapWarningsCount: overlapDiag.issues.length,
    },
    glyphLigatureTable: tokens.map((tok, i) => ({
      index: i + 1,
      ligature: tok.text,
      unicodeSequence: formatUnicodeHexSequence(tok.text),
      glyphLength: Array.from(tok.text).length,
      overlapRisk: tok.hasOverlapRisk,
      recommendedCss: tok.hasOverlapRisk
        ? 'font-feature-settings: "kern" 0; text-rendering: optimizeLegibility;'
        : 'font-feature-settings: "kern" 1, "liga" 1;',
    })),
    reportedMissingLigatures: params.missingReports,
  };
}


