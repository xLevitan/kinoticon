import { useState, useEffect, useCallback, useRef } from 'react';
import {
  checkWordHash,
  checkWinConditionByHashes,
  decryptMovieInfo,
} from '../../shared/utils/wordCloud';
import { preloadTwemoji } from '../utils/twemoji';
import { getSessionId, storeSessionIdFromResponse } from '../utils/sessionId';

// Get testDay from localStorage for testing different days
function getStoredTestDay(): number | undefined {
  const stored = localStorage.getItem('kinoticon-testDay');
  return stored ? parseInt(stored, 10) : undefined;
}

/** UTC date YYYY-MM-DD — same for all subreddit visitors (posts are global, not per-locale). */
function getUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface GameState {
  emojis: string[];
  wordCloud: string[];
  titleHashes: string[];
  salt: string;
  encryptedMovie: string;
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
    titleHashes: [],
    salt: '',
    encryptedMovie: '',
    triesLeft: 6,
    gameOver: false,
    won: false,
    selectedWords: [],
    correctWords: [],
    wrongWords: [],
    dayNumber: 0,
    loading: true,
  });

  /** When opening a specific post, server tells us postId so we load that post’s day (not “today”). */
  const postIdRef = useRef<string | null>(null);

  const [stats, setStats] = useState<Stats>({
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    winRate: 0,
  });

  const [filter, setFilter] = useState('');

  // Get testDay from localStorage (for testing different days)
  const [testDay, setTestDayState] = useState<number | undefined>(() => getStoredTestDay());
  /** Only true when current user is moderator; controls dev menu visibility. */
  const [isModerator, setIsModerator] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/game/stats', {
        headers: { 'X-Session-Id': getSessionId() },
      });
      storeSessionIdFromResponse(response);
      const data = await response.json();

      if (data.status !== 'error') {
        setStats({
          gamesPlayed: data.gamesPlayed || 0,
          gamesWon: data.gamesWon || 0,
          currentStreak: data.currentStreak || 0,
          maxStreak: data.maxStreak || 0,
          winRate: data.gamesPlayed > 0 ? Math.round((data.gamesWon / data.gamesPlayed) * 100) : 0,
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  const loadGame = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));

      const ctxRes = await fetch('/api/context');
      const ctx = (await ctxRes.json()) as { postId?: string; isModerator?: boolean };
      postIdRef.current = ctx.postId ?? null;
      const isMod = ctx.isModerator ?? false;
      setIsModerator(isMod);

      // Use stored testDay so "Apply" works: setTestDay + reload() run in same tick, state not updated yet
      // In dev, explicit test day overrides postId so "Apply" actually changes the day
      const effectiveTestDay = getStoredTestDay();
      const params =
        isMod && effectiveTestDay
          ? `testDay=${effectiveTestDay}`
          : postIdRef.current
            ? `postId=${encodeURIComponent(postIdRef.current)}`
            : `date=${getUtcDateString()}`;
      const response = await fetch(`/api/game/daily?${params}`, {
        headers: { 'X-Session-Id': getSessionId() },
      });
      storeSessionIdFromResponse(response);
      const data = await response.json();

      if (data.status === 'error') {
        throw new Error(data.message);
      }

      // Wait for game emoji to load so they display instantly when screen appears
      await preloadTwemoji(data.emojis || []);

      // Decrypt movie info if game is already over
      const movieInfo =
        data.gameOver && data.encryptedMovie
          ? decryptMovieInfo(data.encryptedMovie, data.salt)
          : null;

      const loadedSelected = data.selectedWords || [];
      const loadedCorrect = data.correctWords || [];
      const loadedWrong = loadedSelected.filter((w: string) => !loadedCorrect.includes(w));

      setState({
        emojis: data.emojis || [],
        wordCloud: data.wordCloud || [],
        titleHashes: data.titleHashes || [],
        salt: data.salt || '',
        encryptedMovie: data.encryptedMovie || '',
        triesLeft: data.triesLeft ?? 6,
        gameOver: data.gameOver ?? false,
        won: data.won ?? false,
        selectedWords: loadedSelected,
        correctWords: loadedCorrect,
        wrongWords: loadedWrong,
        dayNumber: data.dayNumber || 0,
        ...(movieInfo ? { movieTitle: movieInfo.title, movieYear: movieInfo.year } : {}),
        loading: false,
      });

      void loadStats();
    } catch (error) {
      console.error('Failed to load game:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load game',
      }));
    }
  }, [loadStats]);

  // Load game on mount
  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  // Sync state to server (fire and forget)
  const syncToServer = useCallback(
    async (newState: {
      selectedWords: string[];
      correctWords: string[];
      triesLeft: number;
      gameOver: boolean;
      won: boolean;
    }) => {
      try {
        const syncRes = await fetch('/api/game/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
          body: JSON.stringify({
            ...newState,
            ...(postIdRef.current
              ? { postId: postIdRef.current }
              : (() => {
              const d = getStoredTestDay();
              return isModerator && d ? { testDay: d } : { date: getUtcDateString() };
            })()),
          }),
        });
        storeSessionIdFromResponse(syncRes);

        // Refresh stats if game ended
        if (newState.gameOver) {
          void loadStats();
        }
      } catch (error) {
        console.error('Failed to sync:', error);
      }
    },
    [isModerator, loadStats]
  );

  const makeGuess = useCallback(
    (word: string) => {
      if (state.gameOver) return;

      const wordLower = word.toLowerCase();
      if (state.selectedWords.includes(wordLower)) return;

      // Check locally using hash
      const isCorrect = checkWordHash(wordLower, state.titleHashes, state.salt);

      // Calculate new state
      const newSelectedWords = [...state.selectedWords, wordLower];
      const newCorrectWords = isCorrect ? [...state.correctWords, wordLower] : state.correctWords;
      const newWrongWords = !isCorrect ? [...state.wrongWords, wordLower] : state.wrongWords;
      const newTriesLeft = isCorrect ? state.triesLeft : state.triesLeft - 1;

      // Check win/lose
      const won =
        isCorrect && checkWinConditionByHashes(newSelectedWords, state.titleHashes, state.salt);
      const lost = newTriesLeft <= 0;
      const gameOver = won || lost;

      // Decrypt movie info immediately if game is over
      const movieInfo =
        gameOver && state.encryptedMovie
          ? decryptMovieInfo(state.encryptedMovie, state.salt)
          : null;

      // Update state immediately
      setState((prev) => ({
        ...prev,
        selectedWords: newSelectedWords,
        correctWords: newCorrectWords,
        wrongWords: newWrongWords,
        triesLeft: newTriesLeft,
        won,
        gameOver,
        ...(movieInfo ? { movieTitle: movieInfo.title, movieYear: movieInfo.year } : {}),
      }));

      // Sync to server in background
      void syncToServer({
        selectedWords: newSelectedWords,
        correctWords: newCorrectWords,
        triesLeft: newTriesLeft,
        gameOver,
        won,
      });
    },
    [
      state.gameOver,
      state.selectedWords,
      state.correctWords,
      state.wrongWords,
      state.triesLeft,
      state.titleHashes,
      state.salt,
      state.encryptedMovie,
      syncToServer,
    ]
  );

  // Get visible emojis based on tries left
  const visibleEmojis = state.emojis.map((emoji) => ({
    emoji,
    visible: true,
  }));

  // Filter word cloud
  const filteredWords = state.wordCloud.filter((word) =>
    word.toLowerCase().includes(filter.toLowerCase())
  );

  // Generate share text
  const getShareText = useCallback(() => {
    const circles = state.emojis
      .map((_, index) => {
        if (index < state.triesLeft) return '🟢';
        return '🔴';
      })
      .join('');

    const result = state.won ? '🎬' : '💀';

    return `Kinoticon Day ${state.dayNumber} ${result}\n${circles}\n\nPlay at reddit.com/r/kinoticon`;
  }, [state.emojis, state.triesLeft, state.won, state.dayNumber]);

  const resetDayResult = useCallback(async (): Promise<string | null> => {
    try {
      const effectiveTestDay = getStoredTestDay();
      const body = postIdRef.current
        ? { postId: postIdRef.current }
        : isModerator && effectiveTestDay
          ? { testDay: effectiveTestDay }
          : { date: getUtcDateString() };
      const res = await fetch('/api/dev/reset-day-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
        body: JSON.stringify(body),
      });
      storeSessionIdFromResponse(res);
      const data = await res.json();
      if (data.status === 'success') {
        setState((prev) => ({ ...prev, loading: true, gameOver: false, won: false }));
        await new Promise((r) => setTimeout(r, 150));
        await loadGame();
        return data.message ?? null;
      }
      return data.message ?? data.status ?? 'Failed';
    } catch (e) {
      console.error('Reset day result:', e);
      return 'Request failed';
    }
  }, [isModerator, loadGame]);

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
    loadStats,

    // Dev mode (only used when isModerator)
    isModerator,
    testDay,
    resetDayResult,
    setTestDay: (day: number | undefined) => {
      if (day) {
        localStorage.setItem('kinoticon-testDay', day.toString());
      } else {
        localStorage.removeItem('kinoticon-testDay');
      }
      setTestDayState(day);
    },
  };
}
