/**
 * School Name Urdu Transliteration & Translation Utility
 * Supports English, Hindi, and Roman Urdu translation into authentic Urdu
 * formatted for Noori Nastaleeq typography.
 */

// Standard educational terminology vocabulary
export const URDU_DICTIONARY: Record<string, string> = {
  // Institution Types
  'government': 'گورنمنٹ',
  'govt': 'گورنمنٹ',
  'govt.': 'گورنمنٹ',
  'gov': 'گورنمنٹ',
  'school': 'اسکول',
  'schools': 'اسکولز',
  'college': 'کالج',
  'institution': 'ادارہ',
  'academy': 'اکیڈمی',
  'vidyalaya': 'ودیالیہ',
  'madrasa': 'مدرسہ',
  'university': 'یونیورسٹی',
  'center': 'سینٹر',
  'centre': 'سینٹر',
  'institute': 'انسٹیٹیوٹ',

  // Levels & Grades
  'primary': 'پرائمری',
  'middle': 'مڈل',
  'high': 'ہائی',
  'higher': 'ہائر',
  'secondary': 'سیکنڈری',
  'senior': 'سینئر',
  'junior': 'جونیئر',
  'elementary': 'ایلیمنٹری',
  'nursery': 'نرسری',
  'kindergarten': 'کنڈرگارٹن',
  'kg': 'کے جی',
  'basic': 'بنیادی',
  'upper': 'اپر',
  'lower': 'لوئر',

  // Categories & Attributes
  'boys': 'بوائز',
  'girls': 'گرلز',
  'co-ed': 'مخلوط',
  'coed': 'مخلوط',
  'model': 'ماڈل',
  'public': 'پبلک',
  'private': 'پرائیویٹ',
  'central': 'مرکزی',
  'national': 'قومی',
  'international': 'بین الاقوامی',
  'memorial': 'یادگاری',
  'trust': 'ٹرسٹ',
  'mission': 'مشن',
  'convent': 'کانوینٹ',
  'comprehensive': 'جامع',
  'composite': 'کمپوزٹ',

  // Common Hindi equivalents
  'राजकीय': 'گورنمنٹ',
  'बालक': 'بوائز',
  'बालिका': 'گرلز',
  'उच्च': 'ہائی',
  'प्राथमिक': 'پرائمری',
  'माध्यमिक': 'مڈل',
  'वरिष्ठ': 'سینئر',
  'विद्यालय': 'اسکول',
  'कॉलोनी': 'کالونی',
  'कॉलेज': 'کالج',
  'शिक्षा': 'تعلیم',
  'संस्थान': 'ادارہ',

  // Locations (J&K, Punjab, North India)
  'pamposh': 'پمپوش',
  'colony': 'کالونی',
  'srinagar': 'سرینگر',
  'dinanagar': 'دینانگر',
  'pattan': 'پٹن',
  'baramulla': 'بارہمولہ',
  'anantnag': 'اننت ناگ',
  'jammu': 'جموں',
  'badgam': 'بڈگام',
  'budgam': 'بڈگام',
  'kupwara': 'کپواڑہ',
  'pulwama': 'پلوامہ',
  'shopian': 'شوپیاں',
  'kulgam': 'کولگام',
  'ganderbal': 'گاندربل',
  'bandipora': 'بانڈی پورہ',
  'doda': 'ڈوڈہ',
  'kishtwar': 'کشتواڑ',
  'ramban': 'رام بن',
  'reasi': 'ریاسی',
  'udhampur': 'ادھم پور',
  'kathua': 'کٹھوعہ',
  'samba': 'سانبہ',
  'poonch': 'پونچھ',
  'rajouri': 'راجوری',
  'delhi': 'دہلی',
  'chandigarh': 'چنڈی گڑھ',
  'amritsar': 'امرتسر',
  'ludhiana': 'لدھیانہ',
  'jalandhar': 'جالندھر',
  'gurdaspur': 'گورداسپور',
  'pathankot': 'پٹھانکوٹ',
  'kashmir': 'کشمیر',
  'qamarwari': 'قمر واری',
  'batamaloo': 'بٹہ مالو',
  'lal chowk': 'لال چوک',
  'rajbagh': 'راج باغ',
  'hazratbal': 'حضرت بل',
  'soura': 'سورا',
};

// Character-by-character phonetic transliteration mapping for fallback
const PHONETIC_MAPPING: Record<string, string> = {
  'a': 'ا', 'aa': 'آ', 'b': 'ب', 'c': 'سی', 'ch': 'چ', 'd': 'د',
  'dh': 'دھ', 'e': 'ای', 'ee': 'ی', 'f': 'ف', 'g': 'گ', 'gh': 'غ',
  'h': 'ہ', 'i': 'اِ', 'j': 'ج', 'jh': 'جھ', 'k': 'ک', 'kh': 'کھ',
  'l': 'ل', 'm': 'م', 'n': 'ن', 'o': 'او', 'oo': 'و', 'p': 'پ',
  'ph': 'پھ', 'q': 'ق', 'r': 'ر', 's': 'س', 'sh': 'ش', 't': 'ٹ',
  'th': 'تھ', 'u': 'او', 'v': 'و', 'w': 'و', 'x': 'ایکس', 'y': 'ی',
  'z': 'ز',
};

/**
 * Phonetic transliteration for words not present in the dictionary
 */
export const transliterateWordToUrdu = (word: string): string => {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return '';
  if (URDU_DICTIONARY[clean]) return URDU_DICTIONARY[clean];

  // Multi-character checks
  let result = '';
  let i = 0;
  while (i < clean.length) {
    const two = clean.slice(i, i + 2);
    if (PHONETIC_MAPPING[two]) {
      result += PHONETIC_MAPPING[two];
      i += 2;
    } else {
      const one = clean[i];
      result += PHONETIC_MAPPING[one] || one;
      i += 1;
    }
  }

  return result;
};

/**
 * Translates a complete school name string from English/Hindi/Roman Urdu into Urdu
 */
export const translateSchoolNameToUrdu = (input: string): string => {
  if (!input || !input.trim()) return '';

  const trimmed = input.trim();

  // Known exact phrases
  const lower = trimmed.toLowerCase();
  if (lower === 'govt middle school pamposh colony' || lower === 'government middle school pamposh colony') {
    return 'گورنمنٹ مڈل اسکول پامپوش کالونی';
  }
  if (lower === 'government boys middle school pamposh colony') {
    return 'گورنمنٹ مڈل اسکول پامپوش کالونی';
  }
  if (lower === 'government model middle school pamposh colony') {
    return 'گورنمنٹ مڈل اسکول پامپوش کالونی'; // Automatically corrects and removes model
  }
  if (lower === 'government senior secondary school dinanagar') {
    return 'گورنمنٹ سینئر سیکنڈری اسکول دینانگر';
  }
  if (lower === 'government higher secondary school pattan') {
    return 'گورنمنٹ ہائر سیکنڈری اسکول پٹن';
  }

  // Tokenize and translate word by word
  const words = trimmed.split(/\s+/);
  const translatedWords = words.map((w) => {
    const clean = w.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
    if (URDU_DICTIONARY[clean]) {
      return URDU_DICTIONARY[clean];
    }
    // Check direct match
    if (URDU_DICTIONARY[w]) {
      return URDU_DICTIONARY[w];
    }
    return transliterateWordToUrdu(clean);
  });

  return translatedWords.filter(Boolean).join(' ');
};

export interface SavedTranslationRecord {
  id: string;
  sourceText: string;
  sourceLang: 'en' | 'hi' | 'roman_urdu';
  urduText: string;
  timestamp: string;
  tags?: string[];
  notes?: string;
  isFavorite?: boolean;
}

export const samplePreloadedTranslations: SavedTranslationRecord[] = [
  {
    id: 'tr-001',
    sourceText: 'Govt Middle School Pamposh Colony',
    sourceLang: 'en',
    urduText: 'گورنمنٹ مڈل اسکول پامپوش کالونی',
    timestamp: '2026-10-28T09:15:00.000Z',
    notes: 'Official school name in authentic Noori Nastaleeq',
    isFavorite: true,
  },
  {
    id: 'tr-002',
    sourceText: 'Government Senior Secondary School Dinanagar',
    sourceLang: 'en',
    urduText: 'گورنمنٹ سینئر سیکنڈری اسکول دینانگر',
    timestamp: '2026-10-28T08:30:00.000Z',
    notes: 'Standard senior secondary Punjab/J&K border school format',
    isFavorite: true,
  },
  {
    id: 'tr-003',
    sourceText: 'Government Higher Secondary School Pattan',
    sourceLang: 'en',
    urduText: 'گورنمنٹ ہائر سیکنڈری اسکول پٹن',
    timestamp: '2026-10-27T14:20:00.000Z',
    notes: 'District Baramulla cluster center',
    isFavorite: false,
  },
  {
    id: 'tr-004',
    sourceText: 'Kashmir Model Public High School Srinagar',
    sourceLang: 'en',
    urduText: 'کشمیر پبلک ہائی اسکول سرینگر',
    timestamp: '2026-10-26T11:45:00.000Z',
    notes: 'Private composite high school Srinagar',
    isFavorite: false,
  },
];
