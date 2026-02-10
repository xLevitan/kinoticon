// Movie type definition
export interface Movie {
  title: string;
  year: number;
  emojis: string[];
}

// Game state
export interface GameState {
  movieIndex: number;
  triesLeft: number;
  selectedWords: string[];
  gameOver: boolean;
  won: boolean;
  dayNumber: number;
}

// Player stats
export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDay: number;
}

// API responses
export interface DailyGameResponse {
  emojis: string[];
  wordCloud: string[];
  titleHashes: string[];
  salt: string;
  triesLeft: number;
  gameOver: boolean;
  won: boolean;
  selectedWords: string[];
  correctWords?: string[];
  dayNumber: number;
  alreadyPlayed: boolean;
  encryptedMovie?: string; // Encrypted movie info for instant reveal
}

export interface GuessResponse {
  correct: boolean;
  triesLeft: number;
  gameOver: boolean;
  won: boolean;
  movieTitle?: string;
  movieYear?: number;
}

export interface StatsResponse {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  winRate: number;
}

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
};

export type LeaderboardResponse = {
  top100: LeaderboardEntry[];
  aroundMe: LeaderboardEntry[];
  myRank: number | null;
};
