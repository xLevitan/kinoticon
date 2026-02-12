/**
 * Нормализация слов из названий фильмов: составные слова, дефисы, числа, римские цифры.
 */

const TITLE_OVERRIDES: Record<string, string[]> = {
  'WALL·E': ['walle'],
  'C.R.A.Z.Y.': ['crazy'],
};

function applyPrefixOverrides(title: string): string[] | null {
  if (title.includes('Wreck-It')) {
    const rest = title.replace(/Wreck-It/i, '');
    const restWords = extractStandardWords(rest);
    return ['wreck', ...restWords];
  }
  return null;
}

const NUMBER_TO_WORDS: Record<string, string[]> = {
  '0': ['zero'],
  '1': ['one'],
  '2': ['two'],
  '3': ['three'],
  '4': ['four'],
  '6': ['six'],
  '7': ['seven'],
  '9': ['nine'],
  '10': ['ten'],
  '12': ['twelve'],
  '21': ['twenty', 'one'],
  '50': ['fifty'],
  '300': ['three', 'hundred'],
  '500': ['five', 'hundred'],
  '1917': ['nineteen', 'seventeen'],
  '2001': ['two', 'thousand', 'one'],
  '2049': ['twenty', 'forty', 'nine'],
};

const ROMAN_TO_WORD: Record<string, string> = {
  'ii': 'two',
  'iii': 'three',
  'iv': 'four',
  'vi': 'six',
  'vii': 'seven',
  'viii': 'eight',
  'ix': 'nine',
};

const VALID_SINGLE_LETTERS = new Set(['x', 'v', 'i']);

const COMPOUND_WORDS: Record<string, string[]> = {
  'wilderpeople': ['wilder', 'people'],
  'wolfwalkers': ['wolf', 'walkers'],
  'mockingbird': ['mocking', 'bird'],
  'birdman': ['bird', 'man'],
};

const SPECIAL_WORDS: Record<string, string> = {
  'se7en': 'seven',
  'la': 'la',
  'walle': 'walle',
  'mr': 'mister',
  'dr': 'doctor',
  'vs': 'versus',
};

export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for', 'is', 'on',
  'at', 'by', 'with', 'from', 'as', 'part', 'chapter', 'vol', 'volume',
  'episode', 'movie', 'story', 'tale', 'not', 'can', 'you', 'advance', 'it'
]);

function extractStandardWords(text: string): string[] {
  let cleaned = text.replace(/([A-Z])\.([A-Z])\.([A-Z])\.([A-Z])\.([A-Z])\./g, '$1$2$3$4$5');
  cleaned = cleaned.replace(/([A-Z])\.([A-Z])\./g, '$1$2');
  cleaned = cleaned.replace(/([A-Z][a-z]+)\./g, '$1');
  cleaned = cleaned.replace(/[·]/g, '');
  cleaned = cleaned.replace(/[:\-—&]/g, ' ');
  cleaned = cleaned.replace(/\.\.\./, '');
  cleaned = cleaned.replace(/[^a-zA-Z0-9 ]/g, '');

  const tokens = cleaned.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const words: string[] = [];

  for (const token of tokens) {
    if (token.length === 1) {
      if (VALID_SINGLE_LETTERS.has(token)) {
        words.push(token);
      }
      continue;
    }
    if (COMPOUND_WORDS[token]) {
      words.push(...COMPOUND_WORDS[token]);
      continue;
    }
    if (SPECIAL_WORDS[token]) {
      words.push(SPECIAL_WORDS[token]);
      continue;
    }
    if (NUMBER_TO_WORDS[token]) {
      words.push(...NUMBER_TO_WORDS[token]);
      continue;
    }
    if (ROMAN_TO_WORD[token]) {
      words.push(ROMAN_TO_WORD[token]);
      continue;
    }
    if (token.length >= 2 && !STOP_WORDS.has(token)) {
      words.push(token);
    }
  }

  return words.filter(w => !STOP_WORDS.has(w));
}

export function extractWordsFromTitle(title: string): string[] {
  if (TITLE_OVERRIDES[title]) {
    return TITLE_OVERRIDES[title];
  }
  const prefixResult = applyPrefixOverrides(title);
  if (prefixResult) {
    return Array.from(new Set(prefixResult));
  }
  const cleaned = title.replace(/\([^)]+\)/g, '');
  const words = extractStandardWords(cleaned);
  return Array.from(new Set(words));
}

export function matchesWord(selectedWord: string, titleWord: string): boolean {
  const selected = selectedWord.toLowerCase();
  const title = titleWord.toLowerCase();

  if (selected === title) return true;

  for (const [, parts] of Object.entries(COMPOUND_WORDS)) {
    if (parts.includes(selected) && parts.includes(title)) {
      return true;
    }
  }

  if (SPECIAL_WORDS[selected] === title || SPECIAL_WORDS[title] === selected) {
    return true;
  }

  if (ROMAN_TO_WORD[selected] === title || ROMAN_TO_WORD[title] === selected) {
    return true;
  }

  for (const [, parts] of Object.entries(NUMBER_TO_WORDS)) {
    if (parts.includes(selected) && parts.includes(title)) {
      return true;
    }
  }

  return false;
}
