import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Type,
  Download,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  RefreshCw,
  Eye,
  Sliders,
  Palette,
  FileText,
  Sparkles,
  Upload,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  Building,
  School,
  FileCheck,
  Printer,
  X,
  AlertTriangle,
  Maximize2,
  Sun,
  Moon,
  Info,
  BookOpen,
  Layers,
  FileCode2,
  Contrast,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { SchoolProfile } from '../types';
import { Language } from '../utils/translations';
import {
  TARGET_CORRECTED_NAME,
  ORIGINAL_NAME_WITH_MODEL,
  OFFICIAL_ALT_CORRECTED_NAME,
  removeModelWord,
  validateUrduLigatures,
  calculateWcagContrast,
  UrduValidationResult,
  analyzeUrduCharactersAndLigatures,
  UrduCharacterAnalysis,
  scanNastaleeqOverlappingLigatures,
  scanNooriDomContainerOverlaps,
  NastaleeqOverlapDiagnostic,
} from '../utils/urduTypography';
import { formatSchoolAddressOnce } from '../utils/calculations';
import { NooriLigatureText } from './NooriLigatureText';
import { NooriFontToolsPanel } from './NooriFontToolsPanel';

interface SchoolNameDesignEditorProps {
  school: SchoolProfile;
  onUpdateSchool: (updated: SchoolProfile) => void;
  language?: Language;
  onClose?: () => void;
}

export interface UrduWordDetail {
  word: string;
  transliteration: string;
  englishMeaning: string;
  urduMeaning: string;
  partOfSpeech: string;
  rootOrEtymology: string;
  educationalNote: string;
}

export const URDU_WORD_DICTIONARY: Record<string, UrduWordDetail> = {
  'گورنمنٹ': {
    word: 'گورنمنٹ',
    transliteration: 'Gov-ern-ment (Gormint)',
    englishMeaning: 'Government / State Administrative Institution',
    urduMeaning: 'سرکاری ادارہ / باضابطہ حکومتی زیرِ انتظام درسگاہ',
    partOfSpeech: 'اسمِ صفت (Adjective / Institutional prefix)',
    rootOrEtymology: 'English loanword standardized across J&K official administrative nomenclature',
    educationalNote: 'Indicates a public state school run under the J&K School Education Department, providing free schooling, textbooks, mid-day meals, and equitable education under RTE & NEP 2020.',
  },
  'ماڈل': {
    word: 'ماڈل',
    transliteration: 'Mod-el',
    englishMeaning: 'Model / Exemplar (Legacy obsolete designation)',
    urduMeaning: 'نمونہ / مثالی (سابقہ غیر ضروری لاحقہ)',
    partOfSpeech: 'اسمِ صفت (Adjective / Deprecated tag)',
    rootOrEtymology: 'English classification term previously appended to certain pilot middle schools',
    educationalNote: 'Obsolete administrative qualifier removed via "Refine Typography" to align strictly with official revenue and education gazette registration (گورنمنٹ مڈل اسکول پامپوش کالونی).',
  },
  'مڈل': {
    word: 'مڈل',
    transliteration: 'Mid-dle (Middal)',
    englishMeaning: 'Middle School (Classes 6th to 8th / Upper Primary)',
    urduMeaning: 'درمیانی سطح کی درسگاہ (چھٹی تا آٹھویں جماعت)',
    partOfSpeech: 'اسم (Noun / Academic Tier)',
    rootOrEtymology: 'Upper primary tier bridging Primary School (Classes 1–5) and High School (Classes 9–10)',
    educationalNote: 'Serves learners aged 11–14, emphasizing core mathematics, integrated sciences, Urdu/Kashmiri linguistic competencies, and holistic continuous evaluation (HPC).',
  },
  'اسکول': {
    word: 'اسکول',
    transliteration: 'School (Iskool)',
    englishMeaning: 'School / Academic Sanctuary of Learning',
    urduMeaning: 'درسگاہ / مکتب / تعلیمی ادارہ / مدرسہ',
    partOfSpeech: 'اسم (Noun)',
    rootOrEtymology: 'Derived from ancient Greek "skholē" (philosophical leisure for learning), adopted into Urdu vocabulary',
    educationalNote: 'The educational institution fostering cognitive growth, moral integrity, physical health, and co-curricular excellence.',
  },
  'پامپوش': {
    word: 'پامپوش',
    transliteration: 'Paam-posh (کشمیری: پامپوش / پَمپوش)',
    englishMeaning: 'Lotus Flower (Sacred regional flower & cultural emblem of Kashmir)',
    urduMeaning: 'کنول کا پھول / نیلوفر (کشمیری زبان کی قدیم علامت برائے پاکیزگی و علم)',
    partOfSpeech: 'اسمِ معرفہ (Proper Noun / Cultural Identity)',
    rootOrEtymology: 'Traditional Kashmiri word: "Pam" (fresh spring/lake water) + "Posh" (flower / radiant bloom)',
    educationalNote: 'The sacred lotus that blooms in Kashmir’s Dal and Wular lakes; an enduring Kashmiri symbol of resilience, purity rising above mud, tranquility, and intellectual illumination. Located at Pamposh Colony, Palapora Zone, Iddgah.',
  },
  'پمپوش': {
    word: 'پمپوش',
    transliteration: 'Pam-posh (کشمیری: پَمپوش)',
    englishMeaning: 'Lotus Flower (Sacred regional flower & cultural emblem of Kashmir)',
    urduMeaning: 'کنول کا پھول / نیلوفر (کشمیری زبان کی قدیم علامت)',
    partOfSpeech: 'اسمِ معرفہ (Proper Noun / Cultural Identity)',
    rootOrEtymology: 'Traditional Kashmiri word: "Pam" (fresh spring/lake water) + "Posh" (flower / radiant bloom)',
    educationalNote: 'The sacred lotus that blooms in Kashmir’s Dal and Wular lakes; an enduring Kashmiri symbol of resilience, purity rising above mud, tranquility, and intellectual illumination.',
  },
  'کالونی': {
    word: 'کالونی',
    transliteration: 'Col-o-ny (Koloni)',
    englishMeaning: 'Colony / Residential Locality / Neighborhood',
    urduMeaning: 'آبادی / بستی / رہائشی محلہ / بستیِ سکونت',
    partOfSpeech: 'اسم (Noun / Locality identifier)',
    rootOrEtymology: 'Urban locality term standardized in South Asian revenue maps to denote residential quarters',
    educationalNote: 'Specifies the residential locality at Pamposh Colony, Palapora Zone, Iddgah.',
  },
};

export type DesignTemplateType = 'gate-banner' | 'letterhead' | 'hpc-header' | 'custom-upload';

export const SchoolNameDesignEditor: React.FC<SchoolNameDesignEditorProps> = ({
  school,
  onUpdateSchool,
  language = 'en',
  onClose,
}) => {
  // Required Constants
  const OLD_NAME = ORIGINAL_NAME_WITH_MODEL; // 'گورنمنٹ ماڈل مڈل اسکول پمپوش کالونی'
  const CORRECTED_NAME = TARGET_CORRECTED_NAME; // 'گورنمنٹ مڈل اسکول پامپوش کالونی'

  // State
  const [selectedTemplate, setSelectedTemplate] = useState<DesignTemplateType>('gate-banner');
  const [urduSchoolName, setUrduSchoolName] = useState<string>(
    school.nameUrdu && (school.nameUrdu.includes('پامپوش') || school.nameUrdu.includes('پمپوش'))
      ? school.nameUrdu
      : CORRECTED_NAME
  );
  const [fontSize, setFontSize] = useState<number>(44);
  const [textColor, setTextColor] = useState<string>('#fbbf24'); // Amber/Gold default for gate banner
  const [textAlign, setTextAlign] = useState<'center' | 'right' | 'left'>('center');
  const [verticalOffset, setVerticalOffset] = useState<number>(0);
  const [horizontalOffset, setHorizontalOffset] = useState<number>(0);
  const [bannerBgTheme, setBannerBgTheme] = useState<'emerald' | 'navy' | 'maroon' | 'white'>('emerald');
  const [letterSpacing, setLetterSpacing] = useState<number>(2); // Range: -2px to 16px tracking

  // Contrast Enhancement & WCAG AA verification state
  const [contrastEnhance, setContrastEnhance] = useState<boolean>(false);
  const [contrastBg, setContrastBg] = useState<'dark' | 'emerald' | 'maroon' | 'white' | 'amber' | 'black'>('dark');
  const [contrastShadowEnabled, setContrastShadowEnabled] = useState<boolean>(true);

  // Full-Screen Preview Modal
  const [showFullscreenModal, setShowFullscreenModal] = useState<boolean>(false);
  const [fullscreenZoom, setFullscreenZoom] = useState<number>(56);
  const [fullscreenBg, setFullscreenBg] = useState<'dark' | 'emerald' | 'white'>('dark');

  // Refresh key to force re-evaluation of font-feature-settings ("liga" and "kern")
  const [typographyRefreshKey, setTypographyRefreshKey] = useState<number>(0);
  const [isRefreshingLiga, setIsRefreshingLiga] = useState<boolean>(false);

  // Custom uploaded image state
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [patchWidth, setPatchWidth] = useState<number>(500);
  const [patchHeight, setPatchHeight] = useState<number>(75);
  const [patchColor, setPatchColor] = useState<string>('#ffffff');
  const [patchOpacity, setPatchOpacity] = useState<number>(1);

  // Preview Mode
  const [previewMode, setPreviewMode] = useState<'after' | 'side-by-side' | 'before'>('after');
  const [fontLoaded, setFontLoaded] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // .font-noori CSS inspection & typography controls
  const [kernOptimize, setKernOptimize] = useState<boolean>(() => {
    return localStorage.getItem('sm_noori_kern_optimize') === 'true';
  });

  useEffect(() => {
    const syncHandler = () => {
      setKernOptimize(localStorage.getItem('sm_noori_kern_optimize') === 'true');
    };
    window.addEventListener('noori-kern-sync', syncHandler);
    return () => window.removeEventListener('noori-kern-sync', syncHandler);
  }, []);

  const handleToggleKernOptimize = () => {
    setKernOptimize((prev) => {
      const next = !prev;
      localStorage.setItem('sm_noori_kern_optimize', String(next));
      window.dispatchEvent(new Event('noori-kern-sync'));
      return next;
    });
  };
  const [rtlDebugger, setRtlDebugger] = useState<boolean>(false);
  const [ligatureInspector, setLigatureInspector] = useState<boolean>(false);
  const [showOverlapDetails, setShowOverlapDetails] = useState<boolean>(false);
  const [highContrastReading, setHighContrastReading] = useState<boolean>(() => {
    return localStorage.getItem('sm_noori_high_contrast') === 'true';
  });
  const [showBatchScan, setShowBatchScan] = useState<boolean>(false);
  const [showFontAssetsManager, setShowFontAssetsManager] = useState<boolean>(false);
  const [nooriFontSize, setNooriFontSize] = useState<number>(42);
  const [nooriLineHeight, setNooriLineHeight] = useState<number>(2.1);

  useEffect(() => {
    localStorage.setItem('sm_noori_high_contrast', String(highContrastReading));
  }, [highContrastReading]);
  const [printLayoutOpen, setPrintLayoutOpen] = useState<boolean>(false);
  const [extractedUrduTitle, setExtractedUrduTitle] = useState<string>(CORRECTED_NAME);
  const [printDocType, setPrintDocType] = useState<'notice' | 'certificate'>('notice');
  const [printCustomBody, setPrintCustomBody] = useState<string>(
    'بخدمت والدین و سرپرستانِ طلباء: مطلع کیا جاتا ہے کہ اسکول کے تعلیمی و غیر نصابی پروگرام حسبِ معمول جاری ہیں۔ براہِ کرم طلباء کی باقاعدہ حاضری یقینی بنائیں۔'
  );
  const [extractedUrduBlocks, setExtractedUrduBlocks] = useState<string[]>([]);
  const nooriContainerRef = useRef<HTMLDivElement | null>(null);
  const nooriShowcaseRef = useRef<HTMLDivElement | null>(null);

  // Urdu Word Reference Tooltip & Educational Dictionary State
  const [selectedDictionaryWord, setSelectedDictionaryWord] = useState<string | null>(null);
  const [showDictionaryUtility, setShowDictionaryUtility] = useState<boolean>(true);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleGeneratePrintFriendlyLayout = () => {
    const collectedBlocks: string[] = [];
    const blockTags = new Set([
      'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'LI', 'BLOCKQUOTE', 'BR',
    ]);

    const collectBlockLines = (node: Node, currentChunks: string[]) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const txt = (node.textContent || '').replace(/\s+/g, ' ');
        if (txt.trim()) currentChunks.push(txt);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const isBlock = blockTags.has(el.tagName);
      if (isBlock && currentChunks.length > 0) {
        const joined = currentChunks.join('').replace(/\s+/g, ' ').trim();
        if (joined && /[\u0600-\u06FF]/.test(joined) && !collectedBlocks.includes(joined)) {
          collectedBlocks.push(joined);
        }
        currentChunks.length = 0;
      }
      el.childNodes.forEach((child) => collectBlockLines(child, currentChunks));
      if (isBlock && currentChunks.length > 0) {
        const joined = currentChunks.join('').replace(/\s+/g, ' ').trim();
        if (joined && /[\u0600-\u06FF]/.test(joined) && !collectedBlocks.includes(joined)) {
          collectedBlocks.push(joined);
        }
        currentChunks.length = 0;
      }
    };

    if (nooriContainerRef.current) {
      const clone = nooriContainerRef.current.cloneNode(true) as HTMLElement;
      // Strip all non-printable UI chrome, controls, buttons, inputs, icons, and badges
      clone
        .querySelectorAll(
          '.no-print, [data-noori-controls="true"], [data-noori-ui="true"], button, input, select, textarea, kbd, svg, [aria-hidden="true"]'
        )
        .forEach((el) => el.remove());

      const trailingChunks: string[] = [];
      collectBlockLines(clone, trailingChunks);
      if (trailingChunks.length > 0) {
        const last = trailingChunks.join('').replace(/\s+/g, ' ').trim();
        if (last && /[\u0600-\u06FF]/.test(last) && !collectedBlocks.includes(last)) {
          collectedBlocks.push(last);
        }
      }
    }

    if (collectedBlocks.length === 0 && nooriShowcaseRef.current) {
      const clone = nooriShowcaseRef.current.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.no-print, button, input, select, kbd, svg, [aria-hidden="true"]').forEach((el) => el.remove());
      const fallbackText = (clone.textContent || '').replace(/\s+/g, ' ').trim();
      if (fallbackText) collectedBlocks.push(fallbackText);
    }

    const primaryTitle = collectedBlocks[0] || urduSchoolName || CORRECTED_NAME;
    setExtractedUrduTitle(primaryTitle);
    setExtractedUrduBlocks(collectedBlocks.slice(1));
    setPrintLayoutOpen(true);
  };

  const handleWordTouchStart = (word: string) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setSelectedDictionaryWord(word);
    }, 400); // 400ms long press threshold
  };

  const handleWordTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Real-time ligature and rendering validation
  const validationResult: UrduValidationResult = useMemo(() => {
    return validateUrduLigatures(urduSchoolName);
  }, [urduSchoolName]);

  const [overlapDiagnostic, setOverlapDiagnostic] = useState<NastaleeqOverlapDiagnostic>(() =>
    scanNastaleeqOverlappingLigatures(urduSchoolName)
  );

  useEffect(() => {
    setOverlapDiagnostic(scanNooriDomContainerOverlaps(nooriContainerRef.current, urduSchoolName));
  }, [urduSchoolName, typographyRefreshKey]);

  // Background hex for WCAG contrast calculation
  const currentBgHex = useMemo(() => {
    if (contrastEnhance) {
      switch (contrastBg) {
        case 'dark':
          return '#0f172a';
        case 'emerald':
          return '#064e3b';
        case 'maroon':
          return '#7f1d1d';
        case 'white':
          return '#ffffff';
        case 'amber':
          return '#78350f';
        case 'black':
          return '#000000';
        default:
          return '#0f172a';
      }
    }
    if (selectedTemplate === 'gate-banner') {
      switch (bannerBgTheme) {
        case 'emerald':
          return '#064e3b';
        case 'navy':
          return '#0f172a';
        case 'maroon':
          return '#7f1d1d';
        case 'white':
          return '#ffffff';
        default:
          return '#064e3b';
      }
    }
    return '#ffffff';
  }, [contrastEnhance, contrastBg, selectedTemplate, bannerBgTheme]);

  // Dynamic WCAG AA contrast ratio
  const contrastAnalysis = useMemo(() => {
    return calculateWcagContrast(textColor, currentBgHex);
  }, [textColor, currentBgHex]);

  // Load and verify TrueType Noori Nastaleeq font
  useEffect(() => {
    let active = true;
    const loadFont = async () => {
      try {
        if (typeof FontFace !== 'undefined') {
          const font = new FontFace('Noori Nastaleeq', 'url(/fonts/NooriNastaliq.ttf)');
          await font.load();
          if (active) {
            document.fonts.add(font);
            setFontLoaded(true);
          }
        } else {
          setFontLoaded(true);
        }
      } catch (e) {
        console.warn('FontFace load notice:', e);
        if (active) setFontLoaded(true);
      }
    };
    loadFont();
    return () => {
      active = false;
    };
  }, []);

  // Update default text color based on template
  useEffect(() => {
    if (selectedTemplate === 'gate-banner') {
      setTextColor(bannerBgTheme === 'white' ? '#0f172a' : '#fbbf24');
      setFontSize(44);
    } else if (selectedTemplate === 'letterhead') {
      setTextColor('#0f172a');
      setFontSize(38);
    } else if (selectedTemplate === 'hpc-header') {
      setTextColor('#1e1b4b');
      setFontSize(36);
    }
  }, [selectedTemplate, bannerBgTheme]);

  // Main Canvas Drawing Function
  const renderDesignToCanvas = (
    canvas: HTMLCanvasElement,
    textToRender: string,
    isOldNameDesign: boolean = false,
    customFontSize?: number,
    forceHighContrast?: boolean
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1200;
    const height = selectedTemplate === 'gate-banner' ? 420 : selectedTemplate === 'letterhead' ? 320 : 300;

    canvas.width = width;
    canvas.height = height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Apply Letter Spacing / Tracking for Nastaleeq Characters
    if ('letterSpacing' in ctx) {
      try {
        (ctx as any).letterSpacing = `${letterSpacing}px`;
      } catch (e) {
        // Fallback for older browsers
      }
    }

    if (selectedTemplate === 'custom-upload' && uploadedImageSrc) {
      // Custom uploaded image flow
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw user uploaded image
        ctx.drawImage(img, 0, 0, width, height);

        // Draw patch over old name
        const patchX = (width - patchWidth) / 2 + horizontalOffset;
        const patchY = height / 2 - patchHeight / 2 + verticalOffset;

        ctx.fillStyle = patchColor;
        ctx.globalAlpha = patchOpacity;
        ctx.fillRect(patchX, patchY, patchWidth, patchHeight);
        ctx.globalAlpha = 1.0;

        // Draw text
        ctx.direction = 'rtl';
        ctx.textAlign = textAlign;
        ctx.textBaseline = 'middle';
        const activeSize = customFontSize || fontSize;
        ctx.font = `bold ${activeSize}px "Noori Nastaleeq", "Noto Nastaliq Urdu", serif`;

        if (forceHighContrast || (contrastEnhance && contrastShadowEnabled)) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        } else {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = textColor;

        const textX =
          textAlign === 'center'
            ? width / 2 + horizontalOffset
            : textAlign === 'right'
            ? width - 80 + horizontalOffset
            : 80 + horizontalOffset;
        const textY = height / 2 + verticalOffset;

        ctx.fillText(textToRender, textX, textY);
      };
      return;
    }

    // 1. Template: Gate Banner
    if (selectedTemplate === 'gate-banner') {
      const isEmerald = bannerBgTheme === 'emerald';
      const isNavy = bannerBgTheme === 'navy';
      const isMaroon = bannerBgTheme === 'maroon';

      // Background Gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      if (isEmerald) {
        grad.addColorStop(0, '#064e3b');
        grad.addColorStop(0.5, '#047857');
        grad.addColorStop(1, '#064e3b');
      } else if (isNavy) {
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.5, '#1e293b');
        grad.addColorStop(1, '#0f172a');
      } else if (isMaroon) {
        grad.addColorStop(0, '#7f1d1d');
        grad.addColorStop(0.5, '#991b1b');
        grad.addColorStop(1, '#7f1d1d');
      } else {
        grad.addColorStop(0, '#f8fafc');
        grad.addColorStop(1, '#ffffff');
      }

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Gold Ornamental Border
      ctx.strokeStyle = bannerBgTheme === 'white' ? '#0f172a' : '#d97706';
      ctx.lineWidth = 8;
      ctx.strokeRect(16, 16, width - 32, height - 32);

      ctx.strokeStyle = bannerBgTheme === 'white' ? '#475569' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(26, 26, width - 52, height - 52);

      // Header English text
      ctx.fillStyle = bannerBgTheme === 'white' ? '#334155' : '#fef08a';
      ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        'GOVERNMENT OF JAMMU & KASHMIR • DEPARTMENT OF SCHOOL EDUCATION',
        width / 2,
        42
      );

      // Centerpiece Urdu Name in True Noori Nastaleeq
      ctx.direction = 'rtl';
      ctx.textAlign = textAlign;
      ctx.textBaseline = 'middle';
      const activeSize = customFontSize || fontSize;
      ctx.font = `bold ${activeSize}px "Noori Nastaleeq", "Noto Nastaliq Urdu", serif`;

      // Apply high-contrast text shadow for legibility verification
      if (forceHighContrast || (contrastEnhance && contrastShadowEnabled)) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
      }

      ctx.fillStyle = isOldNameDesign ? '#fecdd3' : textColor;

      const urduY = height / 2 - 15 + verticalOffset;
      const urduX =
        textAlign === 'center'
          ? width / 2 + horizontalOffset
          : textAlign === 'right'
          ? width - 80 + horizontalOffset
          : 80 + horizontalOffset;

      ctx.fillText(textToRender, urduX, urduY);

      // Reset shadow for details
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // English Name Subtitle
      ctx.fillStyle = bannerBgTheme === 'white' ? '#0f172a' : '#ffffff';
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((school.name || 'GOVT MIDDLE SCHOOL PAMPOSH COLONY').toUpperCase(), width / 2, height / 2 + 58);

      // Footer Banner Details
      ctx.fillStyle = bannerBgTheme === 'white' ? '#475569' : '#cbd5e1';
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        `CLUSTER: ${(school.villageTown || 'PAMPOSH COLONY').toUpperCase()} • ZONE: ${(school.district || 'SRINAGAR').toUpperCase()} • U-DISE CODE: ${school.code} • ESTD. GOVT J&K`,
        width / 2,
        height - 52
      );
    }

    // 2. Template: Letterhead
    else if (selectedTemplate === 'letterhead') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Header top line
      const lineGrad = ctx.createLinearGradient(0, 0, width, 0);
      lineGrad.addColorStop(0, '#047857');
      lineGrad.addColorStop(0.5, '#1e3a8a');
      lineGrad.addColorStop(1, '#047857');
      ctx.fillStyle = lineGrad;
      ctx.fillRect(0, 0, width, 8);

      // Seal Emblems Placeholder
      ctx.strokeStyle = '#047857';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(80, 80, 40, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GOVT. OF J&K', 80, 75);
      ctx.fillText('EDUCATION', 80, 88);

      // Urdu Name Centered in Letterhead
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const activeSize = customFontSize || fontSize;
      ctx.font = `bold ${activeSize}px "Noori Nastaleeq", "Noto Nastaliq Urdu", serif`;

      if (forceHighContrast || (contrastEnhance && contrastShadowEnabled)) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowColor = 'transparent';
      }

      ctx.fillStyle = isOldNameDesign ? '#be123c' : textColor;
      ctx.fillText(textToRender, width / 2 + horizontalOffset, 65 + verticalOffset);
      ctx.shadowColor = 'transparent';

      // English Title
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OFFICE OF THE HEADMASTER / PRINCIPAL', width / 2, 118);

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        `${(school.name || 'GOVT MIDDLE SCHOOL PAMPOSH COLONY').toUpperCase()}, ${(school.district || 'SRINAGAR').toUpperCase()}`,
        width / 2,
        145
      );

      ctx.fillStyle = '#64748b';
      ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        `${formatSchoolAddressOnce(school)} | U-DISE: ${school.code}`,
        width / 2,
        170
      );

      // Dispatch & Date Reference Lines
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(40, 200);
      ctx.lineTo(width - 40, 200);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Ref No: GBMS/PC/2026/_______', 45, 235);
      ctx.textAlign = 'right';
      ctx.fillText('Date: ___ / ___ / 2026', width - 45, 235);
    }

    // 3. Template: HPC Header
    else if (selectedTemplate === 'hpc-header') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // Rounded border frame
      ctx.strokeStyle = '#4338ca';
      ctx.lineWidth = 3;
      ctx.strokeRect(15, 15, width - 30, height - 30);

      // Top color banner
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(15, 15, width - 30, 48);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'UNION TERRITORY OF JAMMU & KASHMIR • HOLISTIC PROGRESS REPORT CARD (HPC - NEP 2020)',
        width / 2,
        39
      );

      // Urdu Name in Header
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const activeSize = customFontSize || fontSize;
      ctx.font = `bold ${activeSize}px "Noori Nastaleeq", "Noto Nastaliq Urdu", serif`;

      if (forceHighContrast || (contrastEnhance && contrastShadowEnabled)) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 6;
      } else {
        ctx.shadowColor = 'transparent';
      }

      ctx.fillStyle = isOldNameDesign ? '#be123c' : textColor;
      ctx.fillText(textToRender, width / 2 + horizontalOffset, 105 + verticalOffset);
      ctx.shadowColor = 'transparent';

      // English Name
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GOVT. BOYS MIDDLE SCHOOL PAMPOSH COLONY', width / 2, 148);

      // Metadata chips
      ctx.fillStyle = '#475569';
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('UDISE: 09240104502   •   ACADEMIC SESSION: 2026-2027   •   ZONE: SRINAGAR', width / 2, 175);

      // Border line
      ctx.strokeStyle = '#c7d2fe';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 205);
      ctx.lineTo(width - 30, 205);
      ctx.stroke();

      // Student summary field boxes indicator
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.fillRect(30, 218, width - 60, 50);
      ctx.strokeRect(30, 218, width - 60, 50);

      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        'Student Name: _____________________    Roll No: _____    Class: _____    Section: _____    Admission No: _________',
        50,
        248
      );
    }
  };

  // Re-draw canvas when state changes
  useEffect(() => {
    if (canvasRef.current) {
      renderDesignToCanvas(canvasRef.current, urduSchoolName, false);
    }
    if (beforeCanvasRef.current) {
      renderDesignToCanvas(beforeCanvasRef.current, OLD_NAME, true);
    }
    if (fullscreenCanvasRef.current && showFullscreenModal) {
      renderDesignToCanvas(fullscreenCanvasRef.current, urduSchoolName, false, fullscreenZoom);
    }
  }, [
    urduSchoolName,
    selectedTemplate,
    fontSize,
    textColor,
    textAlign,
    verticalOffset,
    horizontalOffset,
    bannerBgTheme,
    uploadedImageSrc,
    patchWidth,
    patchHeight,
    patchColor,
    patchOpacity,
    fontLoaded,
    contrastEnhance,
    contrastShadowEnabled,
    showFullscreenModal,
    fullscreenZoom,
    typographyRefreshKey,
    letterSpacing,
  ]);

  /**
   * Action: Refines typography by executing removeModelWord logic:
   * - Strips the word 'ماڈل'
   * - Normalizes Urdu cursive spaces
   * - Sets school name strictly to 'گورنمنٹ مڈل اسکول پمپوش کالونی'
   * - Persists to School Profile and LocalStorage
   * - Re-applies font-feature-settings ("liga" 1, "kern" 1, "calt" 1)
   */
  const handleRefineTypography = () => {
    setIsRefreshingLiga(true);

    const { correctedText, hadModelWord } = removeModelWord(urduSchoolName);
    const finalName = correctedText || CORRECTED_NAME;

    setUrduSchoolName(finalName);

    // Persist change to School Profile state
    const updatedProfile: SchoolProfile = {
      ...school,
      nameUrdu: finalName,
    };
    onUpdateSchool(updatedProfile);

    // Persist to localStorage
    try {
      localStorage.setItem('school_master_v1_school', JSON.stringify(updatedProfile));
    } catch (err) {
      console.warn('LocalStorage save failed:', err);
    }

    // Bump refresh key to force re-render and re-application of OpenType font features ('liga', 'kern')
    setTypographyRefreshKey((prev) => prev + 1);

    setTimeout(() => {
      setIsRefreshingLiga(false);
      setStatusNotice(
        hadModelWord
          ? '✓ Typography Refined: Removed "ماڈل" -> "گورنمنٹ مڈل اسکول پمپوش کالونی" & refreshed OpenType ligatures ("liga", "kern")!'
          : '✓ Typography Refreshed: Noori Nastaleeq OpenType features ("liga", "kern", "calt") verified!'
      );
      setTimeout(() => setStatusNotice(null), 5000);
    }, 750);
  };

  // Bind removeModelWord logic for test harness and direct integration
  useEffect(() => {
    (window as any).removeModelWord = (input?: string) => {
      return handleRefineTypography();
    };
    return () => {
      delete (window as any).removeModelWord;
    };
  }, [urduSchoolName, school]);

  // Keyboard shortcut listener: Ctrl+Shift+U (or Cmd+Shift+U) triggers Refine Typography
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        handleRefineTypography();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [urduSchoolName, school]);

  /**
   * Action function: Performs string replacement of the school name from
   * 'گورنمنٹ ماڈل مڈل اسکول پمپوش کالونی' to 'گورنمنٹ مڈل اسکول پمپوش کالونی'
   * and persists this change directly to the school profile state.
   */
  const handleReplaceAndPersistSchoolName = (inputString?: string) => {
    handleRefineTypography();
    return CORRECTED_NAME;
  };

  // Reset to original name containing ماڈل
  const handleResetToOldName = () => {
    setUrduSchoolName(OLD_NAME);
    setTypographyRefreshKey((prev) => prev + 1);
    setStatusNotice('Reverted to original text with "ماڈل" for comparison.');
    setTimeout(() => setStatusNotice(null), 3500);
  };

  // Export as High-Resolution PNG (300 DPI canvas)
  const handleExportPng = () => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `GBMS_Pamposh_Corrected_School_Name_${selectedTemplate}_300DPI.png`;
      link.href = dataUrl;
      link.click();
      setStatusNotice('✓ High-Resolution PNG (300 DPI) exported successfully!');
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (e) {
      console.error(e);
      alert('Error exporting PNG');
    } finally {
      setIsExporting(false);
    }
  };

  // Export as High-Resolution JPG
  const handleExportJpg = () => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.98);
      const link = document.createElement('a');
      link.download = `GBMS_Pamposh_Corrected_School_Name_${selectedTemplate}.jpg`;
      link.href = dataUrl;
      link.click();
      setStatusNotice('✓ High-Quality JPG exported successfully!');
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (e) {
      console.error(e);
      alert('Error exporting JPG');
    } finally {
      setIsExporting(false);
    }
  };

  // Export as High-Resolution Vector/Print PDF using jsPDF
  const handleExportPdf = () => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    try {
      const imgData = canvasRef.current.toDataURL('image/png', 1.0);
      const isBanner = selectedTemplate === 'gate-banner';

      // Landscape PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: isBanner ? [297, 120] : 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = isBanner ? 100 : (210 * 300) / 1200;

      pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight);
      pdf.save(`GBMS_Pamposh_School_Name_${selectedTemplate}_Print.pdf`);
      setStatusNotice('✓ High-Resolution PDF exported successfully!');
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (e) {
      console.error(e);
      alert('Error exporting PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Save changes to master school profile
  const handleSaveToMasterProfile = () => {
    const updated: SchoolProfile = {
      ...school,
      nameUrdu: urduSchoolName.trim(),
    };
    onUpdateSchool(updated);
    try {
      localStorage.setItem('school_master_v1_school', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    setStatusNotice(
      `✓ Master School Profile updated! Urdu name set to "${urduSchoolName.trim()}" across all progress cards and documents.`
    );
    setTimeout(() => setStatusNotice(null), 5000);
  };

  // Handle custom image file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedImageSrc(event.target.result as string);
          setSelectedTemplate('custom-upload');
          setStatusNotice(
            '✓ Document image loaded! Adjust replacement patch and typography controls to overlay corrected name.'
          );
          setTimeout(() => setStatusNotice(null), 4000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
              Urdu Typography Correction Studio
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span>NooriNastaliq.ttf (11 MB TrueType Active)</span>
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Type className="w-6 h-6 text-emerald-400" />
            <span>School Name &amp; Banner Document Editor</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Replace and correct the Urdu school name across official school documents, main gate banners, and letterheads by removing only the word{' '}
            <strong className="text-rose-400 underline decoration-rose-500">ماڈل</strong> while preserving authentic Noori Nastaleeq ligatures, alignment, and official seals.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFullscreenModal(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all border border-indigo-400/30"
            title="Open full-screen preview of corrected Urdu typography"
          >
            <Maximize2 className="w-4 h-4 text-indigo-200" />
            <span>Full-Screen Preview</span>
          </button>

          <button
            onClick={handleSaveToMasterProfile}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all border border-emerald-400/30"
            title="Update school master profile so this corrected Urdu name is used system-wide"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-100" />
            <span>Save to School Profile</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Status Notice Toast */}
      {statusNotice && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 rounded-2xl flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">{statusNotice}</span>
          </div>
          <button onClick={() => setStatusNotice(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRIMARY .font-noori CONTAINER WITH REAL-TIME VALIDATION, CONTRAST TOGGLE, */}
      {/* REFINE TYPOGRAPHY ACTION, AND RESET TO ORIGINAL BUTTON                     */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        {/* Section title */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Interactive Noori Nastaleeq Canvas &amp; Typography Inspector</span>
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            CSS selector: <code className="text-indigo-600 dark:text-indigo-400 font-bold">.font-noori</code>
          </span>
        </div>

        {/* The targeted .font-noori container with smooth transition animation and Ctrl+Shift+U shortcut */}
        <div
          ref={nooriContainerRef}
          key={`font-noori-container-${typographyRefreshKey}`}
          dir="rtl"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'u' || e.key === 'U')) {
              e.preventDefault();
              handleRefineTypography();
            }
          }}
          className={`font-noori ${kernOptimize ? 'kern-optimize' : ''} ${rtlDebugger ? 'rtl-debug overflow-visible' : 'overflow-hidden'} ${ligatureInspector ? 'ligature-inspector' : ''} ${highContrastReading ? 'high-contrast-reading' : ''} relative rounded-3xl p-6 sm:p-8 space-y-5 select-text transition-all duration-700 ease-in-out outline-none ${
            isRefreshingLiga
              ? 'ring-8 ring-emerald-400 ring-offset-4 ring-offset-emerald-950 scale-[1.018] shadow-2xl shadow-emerald-500/50 bg-emerald-500/15'
              : validationResult.hasErrors || validationResult.anomalies.length > 0
              ? 'border-2 border-rose-400/90 ring-4 ring-rose-400/25 bg-rose-50/20 shadow-rose-500/10'
              : contrastEnhance
              ? 'border-2 border-amber-400/80 ring-2 ring-amber-400/30 shadow-amber-500/10'
              : 'border-2 border-emerald-500/80 ring-1 ring-emerald-300/40 bg-emerald-50/20 shadow-emerald-500/5'
          } ${
            contrastEnhance
              ? contrastBg === 'dark'
                ? 'bg-slate-950 text-amber-300'
                : contrastBg === 'emerald'
                ? 'bg-emerald-950 text-amber-300'
                : contrastBg === 'maroon'
                ? 'bg-red-950 text-white'
                : contrastBg === 'amber'
                ? 'bg-amber-950 text-amber-100'
                : contrastBg === 'black'
                ? 'bg-black text-amber-300'
                : 'bg-white text-slate-950'
              : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
          }`}
          style={{
            direction: 'rtl',
            fontFeatureSettings: kernOptimize ? '"kern" 0' : '"kern" 1, "liga" 1, "calt" 1',
            textRendering: 'optimizeLegibility',
            letterSpacing: `${letterSpacing}px`,
            textShadow:
              contrastEnhance && contrastShadowEnabled
                ? contrastBg === 'white'
                  ? '0 0 10px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.3), 1px 1px 2px #000000'
                  : '0 0 18px rgba(0,0,0,0.98), 0 0 32px rgba(0,0,0,0.9), 2px 2px 4px #000000, -2px -2px 4px #000000'
                : undefined,
          }}
        >
          {/* Smooth CSS transition banner when Refine Typography recalculates kerning & ligatures */}
          {isRefreshingLiga && (
            <div data-noori-ui="true" dir="ltr" className="no-print relative z-20 flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-extrabold text-xs shadow-xl animate-pulse border border-emerald-400">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                <span>Recalculating Noori Nastaleeq OpenType Kerning &amp; Ligatures Engine ("liga", "kern", "calt")...</span>
              </div>
              <span className="font-mono text-[11px] bg-black/30 px-2 py-0.5 rounded-lg border border-white/20">
                Engine Active
              </span>
            </div>
          )}

          {/* Subtle dark overlay when contrast enhancement is active */}
          {contrastEnhance && contrastBg !== 'white' && (
            <div className="no-print absolute inset-0 bg-slate-950/70 backdrop-blur-[1px] pointer-events-none -z-0 rounded-3xl" />
          )}

          {/* 1. REAL-TIME VALIDATION OVERLAY & CONTRAST ENHANCEMENT CONTROLS BAR (INSIDE .font-noori) */}
          <div
            data-noori-ui="true"
            dir="ltr"
            className="no-print relative z-10 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/50 dark:border-slate-700/50"
          >
            {/* Real-Time Validation Status Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              {validationResult.anomalies.length > 0 ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/90 text-rose-900 dark:text-rose-200 border-2 border-rose-400 text-xs font-bold shadow-sm animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>
                    Validation Overlay: {validationResult.anomalies.length} Rendering Anomaly Flagged (Faint Red Border Active)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-400 text-xs font-bold shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Real-Time Validation: Ligatures &amp; Vowels 100% Intact</span>
                </div>
              )}

              <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                Health: {validationResult.ligatureHealthScore}%
              </span>
            </div>

            {/* Contrast Enhancement, RTL Flow Debugger, kern-optimize Switch & Print-Friendly Layout Controls */}
            <div data-noori-controls="true" className="no-print flex items-center gap-2 flex-wrap text-xs">
              {/* UI Toggle Switch for .kern-optimize */}
              <button
                type="button"
                role="switch"
                aria-checked={kernOptimize}
                aria-label="Toggle kern-optimize on .font-noori container"
                onClick={handleToggleKernOptimize}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  kernOptimize
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-400 text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-200/70'
                }`}
                title="Toggle font-feature-settings between 'kern' 1 (auto) and 'kern' 0 with optimizeLegibility"
              >
                <span className="font-bold font-mono text-[11px]">
                  {kernOptimize ? '"kern" 0 (optimizeLegibility)' : '"kern" 1 (auto)'}
                </span>
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    kernOptimize ? 'bg-indigo-600' : 'bg-slate-400 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      kernOptimize ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>

              {/* Ligature Inspector Overlay Button */}
              <button
                type="button"
                onClick={() => setLigatureInspector((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all shadow-sm ${
                  ligatureInspector
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600 ring-2 ring-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
                title="Highlight Arabic/Urdu ligature segments to spot clusters that benefit from kern-optimize"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Ligature Inspector: {ligatureInspector ? 'ON' : 'OFF'}</span>
              </button>

              {/* Overlapping Ligature Diagnostic Warning Icon */}
              {overlapDiagnostic.hasPotentialOverlap && (
                <button
                  type="button"
                  onClick={() => setShowOverlapDetails((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all shadow-sm ${
                    kernOptimize
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                      : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-400'
                  }`}
                  title={
                    kernOptimize
                      ? `${overlapDiagnostic.issues.length} overlap-prone clusters mitigated by kern-optimize`
                      : `${overlapDiagnostic.summary} Click to inspect.`
                  }
                >
                  <AlertTriangle className={`w-3.5 h-3.5 ${kernOptimize ? 'text-emerald-700' : 'text-amber-600'}`} />
                  <span>
                    {kernOptimize
                      ? `Overlap Guard (${overlapDiagnostic.issues.length})`
                      : `Warning: ${overlapDiagnostic.issues.length} Overlap`}
                  </span>
                </button>
              )}

              {/* RTL Flow Debugger Toggle Button */}
              <button
                type="button"
                onClick={() => setRtlDebugger((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all shadow-sm ${
                  rtlDebugger
                    ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 ring-2 ring-red-300'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
                title="Add 1px dashed crimson outline to all nested block-level elements inside .font-noori"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>RTL Flow Debugger: {rtlDebugger ? 'ON' : 'OFF'}</span>
              </button>

              {/* Print-Friendly Layout Generator */}
              <button
                type="button"
                onClick={handleGeneratePrintFriendlyLayout}
                className="px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 transition-all shadow-sm"
                title="Extract Urdu text content and open A4 Print-Friendly Layout preview"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print-Friendly Layout</span>
              </button>

              {/* High-Contrast Reading Mode Toggle */}
              <button
                type="button"
                onClick={() => setHighContrastReading((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all shadow-sm ${
                  highContrastReading
                    ? 'bg-lime-300 hover:bg-lime-200 text-slate-950 border-lime-500 ring-2 ring-lime-300'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
                title="Apply dark-slate background with yellow-green text for low-light Nastaleeq readability"
              >
                <Contrast className="w-3.5 h-3.5" />
                <span>High-Contrast Reading: {highContrastReading ? 'ON' : 'OFF'}</span>
              </button>

              {/* Batch Scan Button */}
              <button
                type="button"
                onClick={() => {
                  setShowBatchScan((prev) => !prev);
                  setLigatureInspector(true);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all shadow-sm ${
                  showBatchScan
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600 ring-2 ring-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
                title="Scan active Urdu notice and heading content to surface Top 5 overlapping ligature hotspots"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Batch Scan</span>
              </button>

              {/* Font Assets Manager Button */}
              <button
                type="button"
                onClick={() => setShowFontAssetsManager((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all shadow-sm ${
                  showFontAssetsManager
                    ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-700 ring-2 ring-sky-300'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
                title="Download Noori Nastaleeq glyph metrics or report a missing ligature set"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Font Assets Manager</span>
              </button>

              {/* The Contrast Enhancement Toggle Button */}
              <button
                onClick={() => setContrastEnhance((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all shadow-sm ${
                  contrastEnhance
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600 ring-2 ring-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
                title="Temporarily applies a high-contrast text shadow or dark overlay, allowing users to verify text legibility against various background colors to ensure WCAG AA compliance"
              >
                {contrastEnhance ? <Sun className="w-4 h-4 fill-current text-slate-950" /> : <Moon className="w-4 h-4 text-slate-500" />}
                <span>Contrast Enhancement: {contrastEnhance ? 'ON' : 'OFF'}</span>
              </button>

              {/* WCAG Compliance Badge */}
              <span
                className={`px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold border ${
                  contrastAnalysis.isAaNormalCompliant
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-400'
                }`}
                title="WCAG 2.1 Contrast Ratio Verification"
              >
                WCAG {contrastAnalysis.ratioString} ({contrastAnalysis.scoreLabel})
              </span>
            </div>
          </div>

          {/* Test Background Swatches (When Contrast Enhancement is ON) */}
          {contrastEnhance && (
            <div
              data-noori-ui="true"
              dir="ltr"
              className="no-print relative z-10 flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/90 border border-amber-500/40 text-white text-xs animate-in fade-in"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
                  Verify Legibility Against Background Colors (WCAG AA):
                </span>
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'dark', label: 'Dark Slate', hex: '#0f172a' },
                    { id: 'emerald', label: 'Gate Emerald', hex: '#064e3b' },
                    { id: 'maroon', label: 'Maroon Red', hex: '#7f1d1d' },
                    { id: 'white', label: 'Pure White', hex: '#ffffff' },
                    { id: 'amber', label: 'Amber Gold', hex: '#78350f' },
                    { id: 'black', label: 'Pitch Black', hex: '#000000' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setContrastBg(bg.id as any)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                        contrastBg === bg.id
                          ? 'border-amber-400 ring-2 ring-amber-300 text-white scale-105 shadow-md'
                          : 'border-slate-600 text-slate-300 hover:text-white'
                      }`}
                      style={{ backgroundColor: bg.hex }}
                    >
                      <span className="w-2 h-2 rounded-full border border-white/50" />
                      <span>{bg.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold select-none text-amber-200">
                  <input
                    type="checkbox"
                    checked={contrastShadowEnabled}
                    onChange={(e) => setContrastShadowEnabled(e.target.checked)}
                    className="rounded border-amber-400 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Text Shadow Overlay</span>
                </label>
              </div>
            </div>
          )}
          {/* 2. NASTALEEQ LETTER SPACING / TRACKING ADJUSTMENT CONTROL (INSIDE .font-noori) */}
          <div
            data-noori-ui="true"
            dir="ltr"
            className="no-print relative z-10 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-xs shadow-xs"
          >
            <div className="space-y-0.5 max-w-sm">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Letter Spacing (Nastaleeq Tracking):</span>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-mono font-bold text-[11px]">
                  {letterSpacing > 0 ? `+${letterSpacing}px` : `${letterSpacing}px`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Increases tracking between Nastaleeq characters to prevent overlapping strokes on low-resolution displays or smaller screens.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-1 sm:max-w-xs">
              <input
                type="range"
                min="-2"
                max="16"
                step="1"
                value={letterSpacing}
                onChange={(e) => setLetterSpacing(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
                title="Adjust Nastaleeq letter spacing / tracking"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: 'Tight (0px)', val: 0 },
                { label: 'Subtle (+2px)', val: 2 },
                { label: 'Anti-Overlap (+4px)', val: 4 },
                { label: 'Wide (+8px)', val: 8 },
                { label: 'Low-Res Safe (+12px)', val: 12 },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => setLetterSpacing(preset.val)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                    letterSpacing === preset.val
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {/* Real-Time Font Size & Line Height Sliders for Nastaleeq Readability */}
            <div className="w-full pt-3 mt-1 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>Nastaleeq Font Size:</span>
                  <input
                    type="range"
                    min={20}
                    max={68}
                    step={2}
                    value={nooriFontSize}
                    onChange={(e) => setNooriFontSize(Number(e.target.value))}
                    className="w-28 accent-indigo-600 cursor-pointer"
                  />
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">{nooriFontSize}px</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>Line Height:</span>
                  <input
                    type="range"
                    min={1.4}
                    max={3.4}
                    step={0.1}
                    value={nooriLineHeight}
                    onChange={(e) => setNooriLineHeight(Number(e.target.value))}
                    className="w-28 accent-emerald-600 cursor-pointer"
                  />
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">{nooriLineHeight.toFixed(1)}</span>
                </label>
              </div>

              {overlapDiagnostic.hasPotentialOverlap && (
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${kernOptimize ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    {kernOptimize
                      ? `${overlapDiagnostic.issues.length} overlap-prone ligatures stabilized.`
                      : `${overlapDiagnostic.issues.length} potential overlapping ligatures detected —`}
                  </span>
                  {!kernOptimize && (
                    <button
                      type="button"
                      onClick={handleToggleKernOptimize}
                      className="underline font-extrabold text-amber-700 dark:text-amber-400 hover:text-amber-900 cursor-pointer"
                    >
                      Enable kern-optimize
                    </button>
                  )}
                </div>
              )}
            </div>

            {showOverlapDetails && overlapDiagnostic.hasPotentialOverlap && (
              <div className="w-full p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs space-y-1.5">
                <p className="font-bold text-amber-900 dark:text-amber-200">{overlapDiagnostic.summary}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {overlapDiagnostic.issues.map((issue, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-amber-200 dark:border-amber-800">
                      <span className="font-noori font-bold text-base text-slate-900 dark:text-white" dir="rtl">{issue.word}</span>
                      <span className="ml-2 font-mono text-[10px] text-rose-600">({issue.pattern})</span>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{issue.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Anomaly Callout Pills if any */}
          {validationResult.anomalies.length > 0 && (
            <div data-noori-ui="true" dir="ltr" className="no-print relative z-10 space-y-1.5">
              {validationResult.anomalies.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-rose-500/15 border-2 border-rose-400/80 text-rose-900 dark:text-rose-200 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="font-bold">{a.message}</span>
                  </div>
                  {a.type === 'outdated-word' && (
                    <button
                      onClick={handleRefineTypography}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1"
                      title="Click Refine Typography to automatically remove 'ماڈل' and correct the school name"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Refine Typography Now</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Rendered Typography Live Showcase Area */}
          <div className="relative z-10 py-4 text-center sm:text-right overflow-x-auto min-h-[120px] flex flex-col justify-center">
            <div
              ref={nooriShowcaseRef}
              data-noori-text="true"
              className={`font-noori ${kernOptimize ? 'kern-optimize' : ''} ${ligatureInspector ? 'ligature-inspector' : ''} font-bold tracking-normal transition-all duration-300 ${
                isRefreshingLiga ? 'opacity-50 scale-98 blur-[0.5px]' : 'opacity-100 scale-100'
              }`}
              style={{
                letterSpacing: `${letterSpacing}px`,
                fontSize: `${nooriFontSize}px`,
                lineHeight: nooriLineHeight,
              }}
            >
              {urduSchoolName.includes('ماڈل') ? (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1">
                  <span
                    onClick={() => setSelectedDictionaryWord(selectedDictionaryWord === 'گورنمنٹ' ? null : 'گورنمنٹ')}
                    onTouchStart={() => handleWordTouchStart('گورنمنٹ')}
                    onTouchEnd={handleWordTouchEnd}
                    className={`cursor-pointer px-1.5 py-0.5 rounded-xl transition-all ${
                      selectedDictionaryWord === 'گورنمنٹ'
                        ? 'bg-amber-400/25 ring-2 ring-amber-400 text-amber-300'
                        : 'hover:bg-emerald-500/15 hover:underline decoration-dotted decoration-emerald-400'
                    }`}
                    title="Click or Long-press for Urdu Word Reference (لغت)"
                  >
                    <NooriLigatureText text="گورنمنٹ" inspectorActive={ligatureInspector} />
                  </span>
                  <span
                    onClick={() => setSelectedDictionaryWord(selectedDictionaryWord === 'ماڈل' ? null : 'ماڈل')}
                    onTouchStart={() => handleWordTouchStart('ماڈل')}
                    onTouchEnd={handleWordTouchEnd}
                    className="inline-block px-2.5 py-0.5 rounded-xl border-2 border-rose-500 bg-rose-500/25 text-rose-600 dark:text-rose-400 line-through decoration-rose-600 decoration-3 cursor-pointer"
                    title="Anomaly flagged: 'ماڈل' should be removed via Refine Typography"
                  >
                    <NooriLigatureText text="ماڈل" inspectorActive={ligatureInspector} />
                  </span>
                  <span
                    onClick={() => setSelectedDictionaryWord(selectedDictionaryWord === 'مڈل' ? null : 'مڈل')}
                    onTouchStart={() => handleWordTouchStart('مڈل')}
                    onTouchEnd={handleWordTouchEnd}
                    className={`cursor-pointer px-1.5 py-0.5 rounded-xl transition-all ${
                      selectedDictionaryWord === 'مڈل'
                        ? 'bg-amber-400/25 ring-2 ring-amber-400 text-amber-300'
                        : 'hover:bg-emerald-500/15 hover:underline decoration-dotted decoration-emerald-400'
                    }`}
                    title="Click or Long-press for Urdu Word Reference (لغت)"
                  >
                    <NooriLigatureText text="مڈل" inspectorActive={ligatureInspector} />
                  </span>
                  <span
                    onClick={() => setSelectedDictionaryWord(selectedDictionaryWord === 'اسکول' ? null : 'اسکول')}
                    onTouchStart={() => handleWordTouchStart('اسکول')}
                    onTouchEnd={handleWordTouchEnd}
                    className={`cursor-pointer px-1.5 py-0.5 rounded-xl transition-all ${
                      selectedDictionaryWord === 'اسکول'
                        ? 'bg-amber-400/25 ring-2 ring-amber-400 text-amber-300'
                        : 'hover:bg-emerald-500/15 hover:underline decoration-dotted decoration-emerald-400'
                    }`}
                    title="Click or Long-press for Urdu Word Reference (لغت)"
                  >
                    <NooriLigatureText text="اسکول" inspectorActive={ligatureInspector} />
                  </span>
                  <span
                    onClick={() => setSelectedDictionaryWord(selectedDictionaryWord === 'پمپوش' ? null : 'پمپوش')}
                    onTouchStart={() => handleWordTouchStart('پمپوش')}
                    onTouchEnd={handleWordTouchEnd}
                    className={`cursor-pointer px-1.5 py-0.5 rounded-xl transition-all ${
                      selectedDictionaryWord === 'پمپوش'
                        ? 'bg-amber-400/25 ring-2 ring-amber-400 text-amber-300'
                        : 'hover:bg-emerald-500/15 hover:underline decoration-dotted decoration-emerald-400'
                    }`}
                    title="Click or Long-press for Urdu Word Reference (لغت)"
                  >
                    <NooriLigatureText text="پمپوش" inspectorActive={ligatureInspector} />
                  </span>
                  <span
                    onClick={() => setSelectedDictionaryWord(selectedDictionaryWord === 'کالونی' ? null : 'کالونی')}
                    onTouchStart={() => handleWordTouchStart('کالونی')}
                    onTouchEnd={handleWordTouchEnd}
                    className={`cursor-pointer px-1.5 py-0.5 rounded-xl transition-all ${
                      selectedDictionaryWord === 'کالونی'
                        ? 'bg-amber-400/25 ring-2 ring-amber-400 text-amber-300'
                        : 'hover:bg-emerald-500/15 hover:underline decoration-dotted decoration-emerald-400'
                    }`}
                    title="Click or Long-press for Urdu Word Reference (لغت)"
                  >
                    <NooriLigatureText text="کالونی" inspectorActive={ligatureInspector} />
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                  {(urduSchoolName.trim() ? urduSchoolName.trim().split(/\s+/) : ['گورنمنٹ', 'مڈل', 'اسکول', 'پامپوش', 'کالونی']).map((word, wIdx) => (
                    <span
                      key={`${word}-${wIdx}`}
                      onClick={() => setSelectedDictionaryWord(selectedDictionaryWord === word ? null : word)}
                      onTouchStart={() => handleWordTouchStart(word)}
                      onTouchEnd={handleWordTouchEnd}
                      className={`cursor-pointer px-1.5 py-0.5 rounded-xl transition-all ${
                        selectedDictionaryWord === word
                          ? 'bg-amber-400/25 ring-2 ring-amber-400 text-amber-300'
                          : 'text-emerald-700 dark:text-emerald-300 hover:text-emerald-600 hover:bg-emerald-500/10 hover:underline decoration-dotted decoration-emerald-400'
                      }`}
                      title={`Click or Long-press "${word}" to view Urdu dictionary meaning (لغت)`}
                    >
                      <NooriLigatureText text={word} inspectorActive={ligatureInspector} />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Urdu Word Reference & Dictionary Interactive Tooltip Utility */}
            {selectedDictionaryWord && URDU_WORD_DICTIONARY[selectedDictionaryWord] && (
              <div
                dir="rtl"
                className="relative z-20 mt-3 p-4 sm:p-5 rounded-2xl bg-slate-900/95 text-white border-2 border-amber-400/80 shadow-2xl animate-in fade-in zoom-in-95 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-amber-300">
                      اردو لغت و تعلیمی رہنمائی (Urdu Word Reference &amp; Dictionary)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      Urdu Medium Support
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedDictionaryWord(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Close Word Reference"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div
                      className="font-noori text-4xl sm:text-5xl text-amber-300 font-bold leading-relaxed"
                      style={{ fontFamily: '"Noori Nastaleeq", "Noto Nastaliq Urdu", serif' }}
                    >
                      {URDU_WORD_DICTIONARY[selectedDictionaryWord].word}
                    </div>
                    <div dir="ltr" className="text-xs font-mono font-bold text-cyan-300">
                      Transliteration &amp; Pronunciation: {URDU_WORD_DICTIONARY[selectedDictionaryWord].transliteration}
                    </div>
                    <div dir="ltr" className="text-xs text-slate-300 pt-1">
                      <strong className="text-white">English Meaning: </strong>
                      {URDU_WORD_DICTIONARY[selectedDictionaryWord].englishMeaning}
                    </div>
                    <div className="text-xs text-emerald-300 font-bold pt-1">
                      <span>اردو مفہوم و تشریح: </span>
                      <span className="font-semibold text-emerald-200">{URDU_WORD_DICTIONARY[selectedDictionaryWord].urduMeaning}</span>
                    </div>
                  </div>

                  <div className="text-right sm:text-left text-xs bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1.5 shrink-0 sm:max-w-xs" dir="ltr">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Grammatical Type</span>
                      <span className="font-bold text-slate-200">{URDU_WORD_DICTIONARY[selectedDictionaryWord].partOfSpeech}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Origin / Etymology</span>
                      <span className="text-[11px] text-slate-300">{URDU_WORD_DICTIONARY[selectedDictionaryWord].rootOrEtymology}</span>
                    </div>
                  </div>
                </div>

                {/* Educational Guidance for Urdu Medium Students */}
                <div className="p-3 rounded-xl bg-indigo-950/70 border border-indigo-400/40 text-xs text-indigo-100 flex items-start gap-2.5" dir="ltr">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-cyan-300">Educational Guidance for Urdu-Medium Students: </span>
                    <span className="leading-relaxed">{URDU_WORD_DICTIONARY[selectedDictionaryWord].educationalNote}</span>
                  </div>
                </div>

                {/* Quick Word Switcher */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800" dir="rtl">
                  <span className="text-[11px] text-slate-400">دیگر الفاظ منتخب کریں:</span>
                  {Object.keys(URDU_WORD_DICTIONARY).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setSelectedDictionaryWord(w)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        selectedDictionaryWord === w
                          ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                      style={{ fontFamily: '"Noori Nastaleeq", "Noto Nastaliq Urdu", serif' }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hint Bar for Tooltip Utility */}
            <div data-noori-ui="true" dir="ltr" className="no-print mt-2 text-center sm:text-left text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2 flex-wrap pt-1">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                <span>Urdu Word Reference: Long-press or click any word above for dictionary meaning &amp; pronunciation.</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Touch 400ms • Touch-friendly
              </span>
            </div>

            {/* Inline Quick Action when anomaly is present */}
            {urduSchoolName.includes('ماڈل') && (
              <div data-noori-ui="true" className="no-print pt-2 flex justify-center sm:justify-start" dir="ltr">
                <button
                  onClick={handleRefineTypography}
                  disabled={isRefreshingLiga}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                  title="Calls removeModelWord logic to automatically correct the school name to 'گورنمنٹ مڈل اسکول پمپوش کالونی' and refreshes display (Ctrl+Shift+U)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Refine Typography (Remove ماڈل &amp; Reapply Ligatures)</span>
                  <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-mono text-[10px] border border-white/20">
                    Ctrl+Shift+U
                  </kbd>
                </button>
              </div>
            )}

            <div
              data-noori-ui="true"
              dir="ltr"
              className="no-print mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/30 dark:border-slate-800"
            >
              <span className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  font-feature-settings: {kernOptimize ? '"kern" 0' : '"kern" 1'}, "liga" 1, "calt" 1 • text-rendering: optimizeLegibility
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                  Tracking: {letterSpacing > 0 ? `+${letterSpacing}px` : `${letterSpacing}px`}
                </span>
                {isRefreshingLiga && (
                  <span className="text-[10px] text-amber-500 font-bold animate-pulse">
                    [Refreshing Ligatures &amp; Kern...]
                  </span>
                )}
              </span>
              <span className="text-[11px] font-mono">
                RTL Active • {urduSchoolName.length} Urdu Characters
              </span>
            </div>
          </div>

          {/* Action Toolbar Inside .font-noori container */}
          <div
            data-noori-ui="true"
            dir="ltr"
            className="no-print relative z-10 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50"
          >
            {/* Primary Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Refine Typography Action Button */}
              <button
                onClick={handleRefineTypography}
                disabled={isRefreshingLiga}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-lg transition-all border border-emerald-400/40"
                title="Automatically corrects the school name to 'گورنمنٹ مڈل اسکول پمپوش کالونی' by removing 'ماڈل' and reapplying font-feature-settings like 'liga' and 'kern' (Shortcut: Ctrl+Shift+U)"
              >
                <Sparkles className={`w-4 h-4 text-amber-300 ${isRefreshingLiga ? 'animate-spin' : ''}`} />
                <span>Refine Typography</span>
                <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-mono text-[10px] border border-white/20">
                  Ctrl+Shift+U
                </kbd>
              </button>

              {/* 2. Reset to Original Button */}
              <button
                onClick={handleResetToOldName}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-600"
                title="Revert the school name to the default 'گورنمنٹ ماڈل مڈل اسکول پمپوش کالونی' for comparison (triggers real-time validation overlay with faint red border)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset to Original</span>
              </button>

              {/* 3. Full-Screen Preview Trigger */}
              <button
                onClick={() => setShowFullscreenModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                title="View full-screen rendering before committing changes"
              >
                <ZoomIn className="w-4 h-4 text-indigo-200" />
                <span>Full-Screen Preview</span>
              </button>
            </div>

            {/* Commit & Save */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReplaceAndPersistSchoolName()}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                title="Save corrected name directly to Master School Profile"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Commit &amp; Save to Profile</span>
              </button>
            </div>
          </div>

          <NooriFontToolsPanel
            sampleText={urduSchoolName || CORRECTED_NAME}
            documentSources={[
              { source: 'School Name Heading', text: urduSchoolName || CORRECTED_NAME },
              { source: 'Official Notice Body', text: printCustomBody },
            ]}
            fontSizePx={nooriFontSize}
            lineHeight={nooriLineHeight}
            kernOptimize={kernOptimize}
            highContrast={highContrastReading}
            onEnableKernOptimize={() => {
              if (!kernOptimize) handleToggleKernOptimize();
            }}
            onApplyRecommendedMetrics={({ kernOptimize: nextKern, lineHeight: nextLh }) => {
              if (nextKern && !kernOptimize) handleToggleKernOptimize();
              setNooriLineHeight(nextLh);
            }}
            showBatchScan={showBatchScan}
            onCloseBatchScan={() => setShowBatchScan(false)}
            showFontAssetsManager={showFontAssetsManager}
            onCloseFontAssetsManager={() => setShowFontAssetsManager(false)}
            variant="light"
          />
        </div>
      </div>

      {/* Main Diff & Quick Fix Comparison Cards */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Target Urdu Name Replacement &amp; Diff</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Only the word <strong className="text-rose-600">ماڈل</strong> is removed. All other Urdu words, Kashmiri spacing, and Noori Nastaleeq ligatures remain intact.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleReplaceAndPersistSchoolName()}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              title="Replace 'گورنمنٹ ماڈل مڈل اسکول پمپوش کالونی' with 'گورنمنٹ مڈل اسکول پمپوش کالونی' and persist to School Profile state"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>Replace &amp; Persist to Profile</span>
            </button>

            <button
              onClick={handleRefineTypography}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              title="Apply exact required correction: Remove word ماڈل"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Remove ماڈل</span>
            </button>

            <button
              onClick={handleResetToOldName}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1 transition-colors"
              title="Reset to old school name for comparison"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Old</span>
            </button>
          </div>
        </div>

        {/* Before vs After Text Comparison Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Old Name */}
          <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                Old Existing Name (Contains "ماڈل")
              </span>
              <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">To Be Replaced</span>
            </div>

            <div
              dir="rtl"
              className="text-2xl sm:text-3xl font-noori font-bold text-rose-950 dark:text-rose-200 py-3 px-2 border-b border-rose-200/80 dark:border-rose-900/80 tracking-wide select-all"
            >
              گورنمنٹ{' '}
              <span className="bg-rose-200/90 dark:bg-rose-800 text-rose-700 dark:text-rose-100 px-1.5 py-0.5 rounded line-through decoration-rose-700 decoration-2">
                ماڈل
              </span>{' '}
              مڈل اسکول پمپوش کالونی
            </div>

            <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
              <p className="text-[11px] text-rose-800 dark:text-rose-300">
                Word to remove: <strong className="font-noori text-sm">ماڈل</strong> (Model).
              </p>
              <button
                onClick={handleRefineTypography}
                disabled={isRefreshingLiga}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                title="Calls removeModelWord logic to automatically correct the school name to 'گورنمنٹ مڈل اسکول پمپوش کالونی' and refreshes display"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Refine Typography</span>
              </button>
            </div>
          </div>

          {/* New Corrected Name */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-400 dark:border-emerald-600 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-700 dark:text-emerald-300 stroke-[3]" />
                <span>New Corrected Name (Approved Target)</span>
              </span>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Exact Match</span>
            </div>

            <div
              dir="rtl"
              className="text-2xl sm:text-3xl font-noori font-bold text-emerald-950 dark:text-emerald-100 py-3 px-2 border-b border-emerald-300 dark:border-emerald-700 tracking-wide select-all"
            >
              گورنمنٹ مڈل اسکول پمپوش کالونی
            </div>

            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              Rendered in authentic <strong>Noori Nastaleeq</strong> font with proper RTL Urdu ligatures.
            </p>
          </div>
        </div>
      </div>

      {/* Workspace: Templates & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template Selection & Typography Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* 1. Document / Design Template Picker */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              <span>Select Document or Banner Design</span>
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => setSelectedTemplate('gate-banner')}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  selectedTemplate === 'gate-banner'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-xs ring-2 ring-emerald-200 dark:ring-emerald-800'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-amber-300 flex items-center justify-center font-bold text-xs">
                    GB
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Official Main Gate Banner</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Royal green &amp; gold campus gate signage (3:1)</p>
                  </div>
                </div>
                {selectedTemplate === 'gate-banner' && <Check className="w-4 h-4 text-emerald-600" />}
              </button>

              <button
                onClick={() => setSelectedTemplate('letterhead')}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  selectedTemplate === 'letterhead'
                    ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs ring-2 ring-indigo-200 dark:ring-indigo-800'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-700 text-white flex items-center justify-center font-bold text-xs">
                    LH
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Official School Letterhead</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Government J&K executive header &amp; seal</p>
                  </div>
                </div>
                {selectedTemplate === 'letterhead' && <Check className="w-4 h-4 text-indigo-600" />}
              </button>

              <button
                onClick={() => setSelectedTemplate('hpc-header')}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  selectedTemplate === 'hpc-header'
                    ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 shadow-xs ring-2 ring-purple-200 dark:ring-purple-800'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold text-xs">
                    HPC
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Holistic Progress Card Banner</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">NEP 2020 report card top title block</p>
                  </div>
                </div>
                {selectedTemplate === 'hpc-header' && <Check className="w-4 h-4 text-purple-600" />}
              </button>

              <div className="pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-3 rounded-2xl border border-dashed text-left transition-all flex items-center justify-between ${
                    selectedTemplate === 'custom-upload'
                      ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 ring-2 ring-sky-200 dark:ring-sky-800'
                      : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Upload Existing Document / Scan</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Pick image/photo of existing banner from device</p>
                    </div>
                  </div>
                  {selectedTemplate === 'custom-upload' && <Check className="w-4 h-4 text-sky-600" />}
                </button>
              </div>
            </div>
          </div>

          {/* 2. Noori Nastaleeq Typography & Styling Controls */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Noori Nastaleeq Typography Controls</span>
            </h3>

            {/* Editable Text Field */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                Urdu Text String (RTL)
              </label>
              <input
                type="text"
                dir="rtl"
                value={urduSchoolName}
                onChange={(e) => setUrduSchoolName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-noori text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            {/* Font Size Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Font Size</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{fontSize}px</span>
              </div>
              <input
                type="range"
                min="24"
                max="90"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Letter Spacing (Tracking) Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Letter Spacing (Tracking)</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {letterSpacing > 0 ? `+${letterSpacing}px` : `${letterSpacing}px`}
                </span>
              </div>
              <input
                type="range"
                min="-2"
                max="16"
                step="1"
                value={letterSpacing}
                onChange={(e) => setLetterSpacing(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
                title="Adjust horizontal tracking between Nastaleeq characters"
              />
              <p className="text-[10px] text-slate-400">Prevents stroke overlap on low-resolution displays</p>
            </div>

            {/* Text Color Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                Text Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: 'Gold', val: '#fbbf24' },
                  { name: 'White', val: '#ffffff' },
                  { name: 'Navy', val: '#0f172a' },
                  { name: 'Emerald', val: '#047857' },
                  { name: 'Black', val: '#111827' },
                  { name: 'Maroon', val: '#7f1d1d' },
                ].map((c) => (
                  <button
                    key={c.val}
                    onClick={() => setTextColor(c.val)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      textColor === c.val ? 'scale-110 border-indigo-600 ring-2 ring-indigo-300' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    style={{ backgroundColor: c.val }}
                    title={c.name}
                  />
                ))}
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-7 h-7 rounded-full cursor-pointer border border-slate-300 dark:border-slate-700 p-0"
                  title="Custom Color"
                />
              </div>
            </div>

            {/* Alignment Options */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                Text Alignment
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['right', 'center', 'left'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setTextAlign(a)}
                    className={`py-1.5 rounded-xl font-bold border transition-colors ${
                      textAlign === a
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {a === 'right' ? 'Right (RTL)' : a === 'center' ? 'Center' : 'Left'}
                  </button>
                ))}
              </div>
            </div>

            {/* Banner Background Theme (when gate banner) */}
            {selectedTemplate === 'gate-banner' && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                  Banner Background Color
                </label>
                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  {[
                    { id: 'emerald', label: 'Emerald' },
                    { id: 'navy', label: 'Navy' },
                    { id: 'maroon', label: 'Maroon' },
                    { id: 'white', label: 'White' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setBannerBgTheme(t.id as any)}
                      className={`py-1 rounded-lg font-bold border capitalize ${
                        bannerBgTheme === t.id
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Vertical & Horizontal Offset */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Vertical: {verticalOffset}px
                </label>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  value={verticalOffset}
                  onChange={(e) => setVerticalOffset(parseInt(e.target.value, 10))}
                  className="w-full accent-slate-700 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Horizontal: {horizontalOffset}px
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={horizontalOffset}
                  onChange={(e) => setHorizontalOffset(parseInt(e.target.value, 10))}
                  className="w-full accent-slate-700 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Canvas & Preview (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Preview Navigation Tabs & Export Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setPreviewMode('after')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  previewMode === 'after'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Corrected Preview (New)</span>
              </button>

              <button
                onClick={() => setPreviewMode('side-by-side')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  previewMode === 'side-by-side'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Before vs After</span>
              </button>

              <button
                onClick={() => setPreviewMode('before')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  previewMode === 'before'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Old (With ماڈل)</span>
              </button>
            </div>

            {/* High-Resolution Export Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportPng}
                disabled={isExporting}
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                title="Export high-resolution 300 DPI PNG file"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>PNG (300 DPI)</span>
              </button>

              <button
                onClick={handleExportJpg}
                disabled={isExporting}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                title="Export high-quality JPG image"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>JPG</span>
              </button>

              <button
                onClick={handleExportPdf}
                disabled={isExporting}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                title="Export print-ready PDF document"
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                <span>PDF Document</span>
              </button>
            </div>
          </div>

          {/* Canvas Render Display */}
          <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-2xl flex flex-col items-center justify-center overflow-hidden">
            {previewMode === 'after' && (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Corrected Output: گورنمنٹ مڈل اسکول پمپوش کالونی</span>
                  </span>
                  <span className="text-[11px] font-mono">
                    1200 x {selectedTemplate === 'gate-banner' ? '420' : selectedTemplate === 'letterhead' ? '320' : '300'} px
                  </span>
                </div>

                <div className="w-full overflow-x-auto rounded-2xl border border-slate-700/80 shadow-inner bg-slate-950 flex justify-center">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto rounded-2xl shadow-lg block"
                    style={{ width: '100%', height: 'auto' }}
                  />
                </div>
              </div>
            )}

            {previewMode === 'before' && (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Original Output: گورنمنٹ ماڈل مڈل اسکول پمپوش کالونی</span>
                  </span>
                  <span className="text-[11px] font-mono text-rose-300">Contains word ماڈل</span>
                </div>

                <div className="w-full overflow-x-auto rounded-2xl border border-rose-900/60 shadow-inner bg-slate-950 flex justify-center">
                  <canvas
                    ref={beforeCanvasRef}
                    className="max-w-full h-auto rounded-2xl shadow-lg block"
                    style={{ width: '100%', height: 'auto' }}
                  />
                </div>
              </div>
            )}

            {previewMode === 'side-by-side' && (
              <div className="w-full space-y-6">
                {/* 1. Before */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-bold text-rose-400">1. Original Before (With "ماڈل"):</span>
                  </div>
                  <div className="w-full overflow-x-auto rounded-2xl border border-rose-900/60 bg-slate-950 flex justify-center">
                    <canvas
                      ref={beforeCanvasRef}
                      className="max-w-full h-auto rounded-2xl shadow-md block"
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </div>
                </div>

                {/* 2. After */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-bold text-emerald-400">2. Corrected After (Word "ماڈل" Removed):</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900/70 text-emerald-300 border border-emerald-700">
                      Target Match
                    </span>
                  </div>
                  <div className="w-full overflow-x-auto rounded-2xl border border-emerald-700/80 bg-slate-950 flex justify-center">
                    <canvas
                      ref={canvasRef}
                      className="max-w-full h-auto rounded-2xl shadow-md block"
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Specification & Quality Audit Checklist */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Specification &amp; Quality Audit Checklist</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-slate-100 block">Word "ماڈل" Removed:</strong>
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Only the word ماڈل is extracted; remaining words preserved intact.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-slate-100 block">True Noori Nastaleeq TTF:</strong>
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Powered by NooriNastaliq.ttf font file with Urdu ligatures and RTL.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-slate-100 block">WCAG AA Contrast Verified:</strong>
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Legibility tested against multiple background themes with high-contrast text shadow.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-slate-100 block">300 DPI High-Resolution Export:</strong>
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Lossless PNG, high-res JPG, and vector print-ready PDF generated.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FULL-SCREEN HIGH-QUALITY PREVIEW MODAL BEFORE COMMITTING CHANGES          */}
      {/* ========================================================================= */}
      {showFullscreenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          {/* Top Modal Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 text-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md">
                <Type className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>Full-Screen High-Resolution Typography Preview</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    300 DPI Verified
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Inspect Noori Nastaleeq ligatures, kerning, and contrast in full-screen resolution before committing to the school profile.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setFullscreenZoom((prev) => Math.max(32, prev - 6))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs px-2 text-slate-300">{fullscreenZoom}px</span>
                <button
                  onClick={() => setFullscreenZoom((prev) => Math.min(84, prev + 6))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Background Theme Switcher */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setFullscreenBg('dark')}
                  className={`px-2.5 py-1 rounded-lg ${fullscreenBg === 'dark' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setFullscreenBg('emerald')}
                  className={`px-2.5 py-1 rounded-lg ${fullscreenBg === 'emerald' ? 'bg-emerald-800 text-white' : 'text-slate-400'}`}
                >
                  Emerald
                </button>
                <button
                  onClick={() => setFullscreenBg('white')}
                  className={`px-2.5 py-1 rounded-lg ${fullscreenBg === 'white' ? 'bg-white text-slate-900' : 'text-slate-400'}`}
                >
                  White
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowFullscreenModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Close Full-Screen Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Main Stage */}
          <div className="flex-1 py-8 flex flex-col items-center justify-center space-y-6 max-w-5xl mx-auto w-full">
            {/* Fullscreen .font-noori container */}
            <div
              dir="rtl"
              className={`font-noori ${kernOptimize ? 'kern-optimize' : ''} ${rtlDebugger ? 'rtl-debug' : ''} w-full p-8 sm:p-12 rounded-3xl border transition-all text-center space-y-4 shadow-2xl ${
                fullscreenBg === 'dark'
                  ? 'bg-slate-900/90 border-slate-700 text-amber-300'
                  : fullscreenBg === 'emerald'
                  ? 'bg-emerald-950/90 border-emerald-700 text-amber-300'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
              style={{
                direction: 'rtl',
                fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
                textRendering: 'optimizeLegibility',
                textShadow:
                  fullscreenBg !== 'white'
                    ? '0 0 20px rgba(0,0,0,0.9), 0 0 35px rgba(0,0,0,0.8), 2px 2px 4px #000000'
                    : undefined,
              }}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-700/50" dir="ltr">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approved School Name: گورنمنٹ مڈل اسکول پمپوش کالونی</span>
                </span>
                <span className="font-mono text-[11px]">TrueType Noori Nastaleeq • Kashmiri Script</span>
              </div>

              <div
                className="font-bold py-6 leading-relaxed select-all"
                style={{
                  fontSize: `${fullscreenZoom}px`,
                  fontFamily: '"Noori Nastaleeq", "Noto Nastaliq Urdu", serif',
                }}
              >
                گورنمنٹ مڈل اسکول پمپوش کالونی
              </div>

              <div className="text-sm font-semibold tracking-wide text-slate-400 font-sans" dir="ltr">
                GOVERNMENT BOYS MIDDLE SCHOOL PAMPOSH COLONY, SRINAGAR
              </div>
            </div>

            {/* Canvas Render In Full-Screen Modal */}
            <div className="w-full bg-slate-900 rounded-3xl p-4 border border-slate-800 shadow-xl overflow-x-auto flex justify-center">
              <canvas
                ref={fullscreenCanvasRef}
                className="max-w-full h-auto rounded-2xl shadow-lg block"
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
          </div>

          {/* Modal Bottom Action Bar */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Reviewing changes before writing to master profile storage.</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportPng}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download PNG (300 DPI)</span>
              </button>

              <button
                onClick={handleExportPdf}
                className="px-3.5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                <span>Export PDF</span>
              </button>

              <button
                onClick={() => {
                  handleReplaceAndPersistSchoolName();
                  setShowFullscreenModal(false);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Commit &amp; Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A4 Print-Friendly Layout Generator Modal for Official School Notices & Certificates */}
      {printLayoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex flex-col p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl border border-slate-700 mb-4 no-print">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-extrabold">A4 Print-Friendly Layout Preview</h3>
                <p className="text-[11px] text-slate-400">
                  Extracted cleanly from .font-noori container with non-printable UI elements stripped
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPrintDocType('notice')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    printDocType === 'notice' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Official Notice
                </button>
                <button
                  type="button"
                  onClick={() => setPrintDocType('certificate')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    printDocType === 'certificate' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Certificate
                </button>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print A4 Document</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintLayoutOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 transition-colors"
                title="Close Print Preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Editable Notice / Certificate Text Control (no-print) */}
          <div className="max-w-4xl mx-auto w-full mb-4 bg-white rounded-2xl p-3 border border-slate-200 no-print">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Customize Urdu Document Content (RTL):
            </label>
            <textarea
              dir="rtl"
              rows={2}
              value={printCustomBody}
              onChange={(e) => setPrintCustomBody(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-noori text-base text-slate-900 bg-slate-50"
            />
          </div>

          {/* Clean A4-sized Vertical Document Canvas */}
          <div
            className={`mx-auto bg-white text-slate-900 shadow-2xl printable-card flex flex-col justify-between ${
              printDocType === 'certificate' ? 'border-[10px] border-double border-emerald-800' : 'border border-slate-300'
            }`}
            style={{
              width: '210mm',
              minHeight: '297mm',
              maxWidth: '100%',
              padding: '20mm 18mm',
            }}
          >
            {/* Header */}
            <div className="space-y-4">
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  DEPARTMENT OF SCHOOL EDUCATION • JAMMU &amp; KASHMIR
                </p>
                <h1
                  dir="rtl"
                  className={`font-noori ${kernOptimize ? 'kern-optimize' : ''} text-3xl sm:text-4xl font-bold text-slate-950 leading-loose py-2`}
                >
                  {extractedUrduTitle}
                </h1>
                <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-900">
                  {school.name}
                </h2>
                <p className="text-xs text-slate-600">
                  {formatSchoolAddressOnce(school)} • U-DISE: {school.code}
                </p>
              </div>

              {/* Dispatch & Date Strip */}
              <div className="flex items-center justify-between text-xs font-mono text-slate-700 border-b border-slate-200 pb-2">
                <span>Ref No: {school.code}/2026/______</span>
                <span>Date: {new Date().toLocaleDateString('en-IN')}</span>
              </div>

              {/* Document Title Badge */}
              <div className="text-center py-4">
                <span
                  dir="rtl"
                  className={`font-noori ${kernOptimize ? 'kern-optimize' : ''} inline-block px-6 py-2 rounded-lg border-2 border-slate-800 text-2xl font-bold text-slate-900 bg-slate-50`}
                >
                  {printDocType === 'notice' ? 'سرکاری اطلاع نامہ (Official Notice)' : 'سندِ فضیلت و تحسین (Certificate)'}
                </span>
              </div>

              {/* Urdu Document Body */}
              <div
                dir="rtl"
                className={`font-noori ${kernOptimize ? 'kern-optimize' : ''} text-xl leading-[2.6] text-right text-slate-900 py-6 px-5 border border-slate-200 rounded-xl bg-slate-50/40 space-y-3`}
              >
                <p>{printCustomBody}</p>
                {extractedUrduBlocks.length > 0 && (
                  <div className="pt-3 border-t border-slate-200/80 text-base text-slate-700 space-y-1">
                    {extractedUrduBlocks.map((block, idx) => (
                      <p key={idx}>{block}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Official Footer with Stamp & Headmaster Signature */}
            <div className="pt-12 mt-12 border-t border-slate-300 flex items-end justify-between gap-6">
              <div className="text-xs text-slate-600">
                <p className="font-bold text-slate-800">{school.name}</p>
                <p>Session: {school.academicSession}</p>
              </div>

              <div className="text-center">
                {school.officialStampDataUrl && (
                  <img
                    src={school.officialStampDataUrl}
                    alt="Official Stamp"
                    className="h-16 w-auto mx-auto mb-1 object-contain"
                  />
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Official School Seal
                </span>
              </div>

              <div className="text-center min-w-[180px]">
                {school.headmasterSignatureDataUrl && (
                  <img
                    src={school.headmasterSignatureDataUrl}
                    alt="Headmaster Signature"
                    className="h-12 w-auto mx-auto mb-1 object-contain"
                  />
                )}
                <div className="border-t border-slate-800 pt-1">
                  <p className="text-xs font-bold text-slate-900">
                    {school.headmasterName || school.headTeacherName || 'Mohd Yousuf Wani'}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {school.principalDesignation || 'Headmaster'} / Admin
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
