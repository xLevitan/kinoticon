import type { Movie } from '../types/game';
import { movieDatabase } from '../data/movies';

// Common words to exclude (articles, prepositions, etc.)
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'is', 'it', 'as', 'by', 'be', 'this', 'that', 'from', 'are', 'was', 'were', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'can', 'shall', 'vs', 'vol', 'part', 'episode', 'chapter'
]);

// Base word list for decoys (common movie-related words)
const BASE_WORD_LIST = [
  'action', 'adventure', 'love', 'war', 'death', 'life', 'dream', 'night', 'day',
  'king', 'queen', 'prince', 'princess', 'hero', 'villain', 'monster', 'ghost',
  'city', 'world', 'space', 'time', 'future', 'past', 'secret', 'mystery',
  'dark', 'light', 'fire', 'water', 'earth', 'sky', 'star', 'moon', 'sun',
  'man', 'woman', 'boy', 'girl', 'child', 'family', 'friend', 'enemy',
  'home', 'house', 'castle', 'island', 'mountain', 'forest', 'ocean', 'river',
  'gold', 'silver', 'diamond', 'magic', 'power', 'force', 'spirit', 'soul',
  'blood', 'heart', 'mind', 'eye', 'hand', 'shadow', 'storm', 'wind',
  'game', 'story', 'tale', 'legend', 'myth', 'saga', 'chronicles', 'journey',
  'battle', 'fight', 'quest', 'mission', 'escape', 'revenge', 'return',
  'final', 'last', 'first', 'new', 'old', 'great', 'little', 'big', 'small',
  'wild', 'lost', 'hidden', 'broken', 'fallen', 'rising', 'coming', 'going',
  'american', 'iron', 'steel', 'stone', 'wood', 'glass', 'metal', 'robot',
  'alien', 'human', 'animal', 'bird', 'fish', 'dragon', 'wolf', 'lion', 'bear'
];

// Extract words from a movie title
function extractWordsFromTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

// Generate word cloud for a movie
export function generateWordCloud(movie: Movie, seed: number = 0): string[] {
  const titleWords = extractWordsFromTitle(movie.title);
  const wordSet = new Set<string>();
  
  // Add all words from the target movie title
  titleWords.forEach(word => wordSet.add(word));
  
  // Add some words from other random movies as decoys (fewer = less scroll on desktop)
  const usedDecoyWords = new Set<string>();
  const numDecoys = Math.min(11, movieDatabase.length);
  
  for (let i = 0; i < numDecoys; i++) {
    const randomIndex = (seed + i * 7) % movieDatabase.length;
    const decoyMovie = movieDatabase[randomIndex];
    
    if (decoyMovie.title !== movie.title) {
      const decoyWords = extractWordsFromTitle(decoyMovie.title);
      decoyWords.forEach(word => {
        // Only add if it's not in the target title
        if (!titleWords.includes(word)) {
          usedDecoyWords.add(word);
        }
      });
    }
  }
  
  // Add decoy words from other movies
  usedDecoyWords.forEach(word => wordSet.add(word));
  
  // Add some base words as additional decoys
  const numBaseWords = 7;
  for (let i = 0; i < numBaseWords; i++) {
    const randomIndex = (seed + i * 13) % BASE_WORD_LIST.length;
    const baseWord = BASE_WORD_LIST[randomIndex];
    if (!titleWords.includes(baseWord)) {
      wordSet.add(baseWord);
    }
  }
  
  // Convert to array and shuffle
  const words = Array.from(wordSet);
  return shuffleArray(words, seed);
}

// Shuffle array with a seed for reproducibility
function shuffleArray<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let currentSeed = seed;
  
  for (let i = result.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff;
    const j = currentSeed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

// Check if a word is part of the movie title
export function isWordInTitle(word: string, movie: Movie): boolean {
  const titleLower = movie.title.toLowerCase();
  const wordLower = word.toLowerCase();
  return titleLower.includes(wordLower);
}

// Check if enough words have been correctly guessed to win
export function checkWinCondition(selectedWords: string[], movie: Movie): boolean {
  const titleWords = extractWordsFromTitle(movie.title);
  
  if (titleWords.length === 0) return false;
  
  // Count how many important title words have been matched
  let matchedCount = 0;
  
  for (const titleWord of titleWords) {
    for (const selectedWord of selectedWords) {
      const selectedLower = selectedWord.toLowerCase();
      if (titleWord.includes(selectedLower) || selectedLower.includes(titleWord)) {
        matchedCount++;
        break;
      }
    }
  }
  
  // Win if at least 70% of important words are matched
  const winThreshold = Math.ceil(titleWords.length * 0.7);
  return matchedCount >= winThreshold;
}

// Simple hash function for client-side word verification
// Using a basic hash to avoid exposing the actual title words
export function hashWord(word: string, salt: string): string {
  const str = word.toLowerCase() + salt;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// Generate hashes for all valid title words
export function generateTitleHashes(movie: Movie, salt: string): string[] {
  const titleWords = extractWordsFromTitle(movie.title);
  return titleWords.map(word => hashWord(word, salt));
}

// Check if a word matches any of the title hashes
export function checkWordHash(word: string, hashes: string[], salt: string): boolean {
  const wordHash = hashWord(word.toLowerCase(), salt);
  return hashes.includes(wordHash);
}

// Calculate win condition based on matched hashes
export function checkWinConditionByHashes(
  selectedWords: string[], 
  titleHashes: string[], 
  salt: string
): boolean {
  if (titleHashes.length === 0) return false;
  
  let matchedCount = 0;
  const matchedHashes = new Set<string>();
  
  for (const word of selectedWords) {
    const wordHash = hashWord(word.toLowerCase(), salt);
    if (titleHashes.includes(wordHash) && !matchedHashes.has(wordHash)) {
      matchedHashes.add(wordHash);
      matchedCount++;
    }
  }
  
  const winThreshold = Math.ceil(titleHashes.length * 0.7);
  return matchedCount >= winThreshold;
}

// Simple XOR encryption for movie info (obfuscation, not security)
// Uses hex encoding to handle Unicode characters safely
export function encryptMovieInfo(title: string, year: number, salt: string): string {
  const data = JSON.stringify({ t: title, y: year });
  const key = salt + 'kinoticon';
  const bytes: number[] = [];
  for (let i = 0; i < data.length; i++) {
    bytes.push(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function decryptMovieInfo(encrypted: string, salt: string): { title: string; year: number } | null {
  try {
    const key = salt + 'kinoticon';
    const bytes: number[] = [];
    for (let i = 0; i < encrypted.length; i += 2) {
      bytes.push(parseInt(encrypted.substring(i, i + 2), 16));
    }
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
    }
    const parsed = JSON.parse(result);
    return { title: parsed.t, year: parsed.y };
  } catch {
    return null;
  }
}
