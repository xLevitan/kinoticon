import { useState, useEffect, useCallback } from 'react';

interface GameState {
  emojis: string[];
  wordCloud: string[];
  triesLeft: number;
  gameOver: boolean;
  won: boolean;
  selectedWords: string[];
  correctWords: string[];
  wrongWords: string[];
  dayNumber: number;
  movieTitle?: string;
  movieYear?: number;
  loading: boolean;
  error?: string;
}

interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  winRate: number;
}

export function useGame() {
  const [state, setState] = useState<GameState>({
    emojis: [],
    wordCloud: [],
    triesLeft: 6,
    gameOver: false,
    won: false,
    selectedWords: [],
    correctWords: [],
    wrongWords: [],
    dayNumber: 0,
    loading: true,
  });
  
  const [stats, setStats] = useState<Stats>({
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    winRate: 0,
  });
  
  const [filter, setFilter] = useState('');

  // Load game on mount
  useEffect(() => {
    loadGame();
  }, []);

  const loadGame = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      
      const response = await fetch('/api/game/daily');
      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }
      
      // Separate selected words into correct and wrong
      const correctWords: string[] = [];
      const wrongWords: string[] = [];
      
      if (data.selectedWords) {
        // We'll need to re-check which words are correct
        // For now, assume all selected words that led to a win were correct
        // This will be updated when we make guesses
      }
      
      setState({
        emojis: data.emojis || [],
        wordCloud: data.wordCloud || [],
        triesLeft: data.triesLeft ?? 6,
        gameOver: data.gameOver ?? false,
        won: data.won ?? false,
        selectedWords: data.selectedWords || [],
        correctWords,
        wrongWords,
        dayNumber: data.dayNumber || 0,
        movieTitle: data.movieTitle,
        movieYear: data.movieYear,
        loading: false,
      });
      
      // Load stats
      loadStats();
    } catch (error) {
      console.error('Failed to load game:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load game',
      }));
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/game/stats');
      const data = await response.json();
      
      if (data.status !== 'error') {
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  const makeGuess = useCallback(async (word: string) => {
    if (state.gameOver || state.loading) return;
    
    // Check if already selected
    const wordLower = word.toLowerCase();
    if (state.selectedWords.includes(wordLower)) return;
    
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch('/api/game/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: wordLower }),
      });
      
      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }
      
      setState(prev => ({
        ...prev,
        triesLeft: data.triesLeft,
        gameOver: data.gameOver,
        won: data.won,
        selectedWords: [...prev.selectedWords, wordLower],
        correctWords: data.correct 
          ? [...prev.correctWords, wordLower]
          : prev.correctWords,
        wrongWords: !data.correct 
          ? [...prev.wrongWords, wordLower]
          : prev.wrongWords,
        movieTitle: data.movieTitle,
        movieYear: data.movieYear,
        loading: false,
      }));
      
      // Reload stats if game ended
      if (data.gameOver) {
        loadStats();
      }
    } catch (error) {
      console.error('Failed to make guess:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to make guess',
      }));
    }
  }, [state.gameOver, state.loading, state.selectedWords, loadStats]);

  // Get visible emojis based on tries left
  const visibleEmojis = state.emojis.map((emoji, index) => ({
    emoji,
    visible: index < state.triesLeft,
  }));

  // Filter word cloud
  const filteredWords = state.wordCloud.filter(word =>
    word.toLowerCase().includes(filter.toLowerCase())
  );

  // Generate share text
  const getShareText = useCallback(() => {
    const squares = state.emojis.map((_, index) => {
      if (index < state.triesLeft) return '🟩';
      return '⬛';
    }).join('');
    
    const result = state.won ? '🎬' : '💀';
    const tries = state.won ? `${6 - state.triesLeft + 1}/6` : 'X/6';
    
    return `Kinoticon Day ${state.dayNumber} ${result}\n${tries}\n${squares}\n\nPlay at reddit.com/r/kinoticon`;
  }, [state.emojis, state.triesLeft, state.won, state.dayNumber]);

  return {
    // State
    emojis: state.emojis,
    visibleEmojis,
    wordCloud: filteredWords,
    allWords: state.wordCloud,
    triesLeft: state.triesLeft,
    gameOver: state.gameOver,
    won: state.won,
    selectedWords: state.selectedWords,
    correctWords: state.correctWords,
    wrongWords: state.wrongWords,
    dayNumber: state.dayNumber,
    movieTitle: state.movieTitle,
    movieYear: state.movieYear,
    loading: state.loading,
    error: state.error,
    stats,
    filter,
    
    // Actions
    setFilter,
    makeGuess,
    getShareText,
    reload: loadGame,
  };
}
