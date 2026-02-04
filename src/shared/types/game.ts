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
  triesLeft: number;
  gameOver: boolean;
  won: boolean;
  selectedWords: string[];
  dayNumber: number;
  alreadyPlayed: boolean;
  movieTitle?: string; // Only revealed when game is over
  movieYear?: number;
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
