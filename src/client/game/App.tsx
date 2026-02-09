import { useState, useEffect, useRef } from 'react';
import { context, requestExpandedMode } from '@devvit/web/client';
import { useGame } from '../hooks/useGame';
import { useSound } from '../hooks/useSound';
import { useTheme } from '../hooks/useTheme';
import { getTwemojiUrl, preloadTwemoji, UI_EMOJI } from '../utils/twemoji';

const STARTED_KEY = 'kinoticon-started';

export const App = () => {
  const [started, setStarted] = useState(() => localStorage.getItem(STARTED_KEY) === '1');
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [devDayInput, setDevDayInput] = useState('');
  const [reset7DayMessage, setReset7DayMessage] = useState<string | null>(null);
  const [resetDayMessage, setResetDayMessage] = useState<string | null>(null);
  const [resetStatsMessage, setResetStatsMessage] = useState<string | null>(null);

  const {
    visibleEmojis,
    wordCloud,
    triesLeft,
    gameOver,
    won,
    selectedWords,
    correctWords,
    wrongWords,
    dayNumber,
    movieTitle,
    movieYear,
    loading,
    stats,
    filter,
    setFilter,
    makeGuess,
    getShareText,
    reload,
    loadStats,
    isDevSubreddit,
    testDay,
    resetDayResult,
    setTestDay,
  } = useGame();

  // Dev mode: apply test day (only on dev subreddit)
  const applyTestDay = () => {
    const day = devDayInput.trim() === '' ? undefined : parseInt(devDayInput.trim(), 10);
    if (day === undefined || day > 0) {
      setTestDay(day);
      setShowDevMenu(false);
      reload();
    }
  };

  const [showStats, setShowStats] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<{
    top100: { rank: number; userId: string; gamesPlayed: number; gamesWon: number; winRate: number; currentStreak: number; maxStreak: number }[];
    aroundMe: { rank: number; userId: string; gamesPlayed: number; gamesWon: number; winRate: number; currentStreak: number; maxStreak: number }[];
    myRank: number | null;
  } | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { enabled: soundEnabled, toggle: toggleSound, playClick, playCorrect, playWrong, playWin, playLose, playUISound, playUIMenu, playUITheme, playUIFullscreen, playUIStats, playUIClose, playUIType } = useSound();
  const { isDark, toggle: toggleTheme } = useTheme();

  // Preload UI emoji on mount so icons appear instantly
  useEffect(() => {
    preloadTwemoji(UI_EMOJI);
  }, []);
  
  // Debounce for type sound - play immediately but throttle rapid typing
  const typeSoundTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypeSoundTimeRef = useRef<number>(0);
  const handleTypeSound = () => {
    const now = Date.now();
    // Play immediately if enough time has passed since last sound
    if (now - lastTypeSoundTimeRef.current > 30) {
      playUIType();
      lastTypeSoundTimeRef.current = now;
    } else {
      // Throttle rapid typing
      if (typeSoundTimeoutRef.current) {
        clearTimeout(typeSoundTimeoutRef.current);
      }
      typeSoundTimeoutRef.current = setTimeout(() => {
        playUIType();
        lastTypeSoundTimeRef.current = Date.now();
      }, 30);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typeSoundTimeoutRef.current) {
        clearTimeout(typeSoundTimeoutRef.current);
      }
    };
  }, []);
  
  // Track previous state for sound effects
  const prevStateRef = useRef({ triesLeft, gameOver, won, correctWords: correctWords.length, wrongWords: wrongWords.length });

  // Play sounds based on state changes
  useEffect(() => {
    const prev = prevStateRef.current;
    
    // Game ended
    if (!prev.gameOver && gameOver) {
      if (won) {
        playWin();
      } else {
        playLose();
      }
    }
    // Correct guess (new correct word added)
    else if (correctWords.length > prev.correctWords) {
      playCorrect();
    }
    // Wrong guess (new wrong word added)
    else if (wrongWords.length > prev.wrongWords) {
      playWrong();
    }
    
    // Update ref
    prevStateRef.current = { triesLeft, gameOver, won, correctWords: correctWords.length, wrongWords: wrongWords.length };
  }, [triesLeft, gameOver, won, correctWords.length, wrongWords.length, playWin, playLose, playCorrect, playWrong]);

  const handleShare = async () => {
    const text = getShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      console.log(text);
    }
  };

  const getWordClass = (word: string) => {
    const wordLower = word.toLowerCase();
    if (correctWords.includes(wordLower)) return 'bg-green-500 text-white';
    if (wrongWords.includes(wordLower)) return 'bg-red-500 text-white';
    if (selectedWords.includes(wordLower)) return 'bg-gray-400 dark:bg-gray-600 text-white';
    return 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200';
  };

  // Splash screen before game starts
  if (!started) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen min-h-[100dvh] bg-gray-50 dark:bg-gray-900 p-4 gap-4 sm:gap-6">
        <img src={getTwemojiUrl('🎬')} alt="" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" draggable={false} />
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 mb-1 sm:mb-2">Kinoticon</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Guess the movie from emojis!</p>
        </div>
        <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300">
          Hey {context?.username ?? 'there'} 👋
        </p>
        <button
          onClick={() => {
            playClick();
            localStorage.setItem(STARTED_KEY, '1');
            setStarted(true);
          }}
          className="px-6 sm:px-8 py-2.5 sm:py-3 bg-green-500 text-white text-base sm:text-lg font-medium rounded-full hover:bg-green-600 transition-colors shadow-lg"
        >
          ▶ Play
        </button>
        <p 
          className={`text-xs sm:text-sm text-gray-500 dark:text-gray-400 select-none ${isDevSubreddit ? 'cursor-pointer' : ''}`}
          {...(isDevSubreddit ? { onClick: () => setShowDevMenu(true) } : {})}
        >
          Day {dayNumber}{isDevSubreddit && testDay ? ' (test)' : ''} • New puzzle daily
        </p>
      </div>
    );
  }

  if (loading && visibleEmojis.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen min-h-[100dvh] bg-gray-50 dark:bg-gray-900">
        <div className="text-xl text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-gray-50 dark:bg-gray-900 p-3 sm:p-4 transition-colors">
      {/* Header with buttons */}
      <header className="flex items-center justify-between gap-2 shrink-0">
        {/* Title */}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 truncate">Kinoticon</h1>
          <p 
            className={`text-xs text-gray-500 dark:text-gray-400 select-none ${isDevSubreddit ? 'cursor-pointer' : ''}`}
            {...(isDevSubreddit ? { onClick: () => setShowDevMenu(true) } : {})}
          >
            Day {dayNumber}{isDevSubreddit && testDay ? ' (test)' : ''}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-1 shrink-0">
          {isDevSubreddit && (
            <button
              onClick={() => { playUIMenu(); setShowDevMenu(true); }}
              className="w-8 h-8 rounded-full bg-yellow-200 dark:bg-yellow-700 flex items-center justify-center text-sm hover:bg-yellow-300 dark:hover:bg-yellow-600 transition-colors"
              title="Dev Mode - Change Day"
            >
              <img src={getTwemojiUrl('🛠️')} alt="" className="w-5 h-5 object-contain" draggable={false} />
            </button>
          )}
          <button
            onClick={() => { toggleTheme(); playUITheme(); }}
            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            <img src={getTwemojiUrl(isDark ? '☀️' : '🌙')} alt="" className="w-5 h-5 object-contain" draggable={false} />
          </button>
          <button
            onClick={(e) => { playUIFullscreen(); requestExpandedMode(e.nativeEvent, 'game'); }}
            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title="Fullscreen"
          >
            <img src={getTwemojiUrl('↗️')} alt="" className="w-5 h-5 object-contain" draggable={false} />
          </button>
          <button
            onClick={() => { toggleSound(); playUISound(); }}
            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          >
            <img src={getTwemojiUrl(soundEnabled ? '🔊' : '🔇')} alt="" className="w-5 h-5 object-contain" draggable={false} />
          </button>
          <button
            onClick={() => { setShowStats(!showStats); playUIStats(); }}
            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <img src={getTwemojiUrl('📊')} alt="" className="w-5 h-5 object-contain" draggable={false} />
          </button>
        </div>
      </header>

      {/* Main content - centered vertically */}
      <main className="flex-1 flex flex-col justify-center py-4 sm:py-6">

      {/* Stats Modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { playUIClose(); setShowStats(false); setLeaderboardOpen(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 max-w-sm w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-center dark:text-white">Your Stats</h2>
            <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.gamesPlayed}</div>
                <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Played</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.winRate}%</div>
                <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Win %</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.currentStreak}</div>
                <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Streak</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.maxStreak}</div>
                <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Max</div>
              </div>
            </div>
            <button
              onClick={async () => {
                if (leaderboardOpen) {
                  setLeaderboardOpen(false);
                  return;
                }
                setLeaderboardOpen(true);
                if (!leaderboardData) {
                  setLeaderboardLoading(true);
                  try {
                    const res = await fetch('/api/game/leaderboard');
                    const data = await res.json();
                    if (data.top100) setLeaderboardData(data);
                  } catch {
                    // ignore
                  }
                  setLeaderboardLoading(false);
                }
              }}
              className="mt-3 w-full py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              {leaderboardOpen ? 'Hide leaderboard' : 'Leaderboard'}
            </button>
            {leaderboardOpen && leaderboardLoading && (
              <div className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</div>
            )}
            {leaderboardOpen && !leaderboardLoading && leaderboardData && (
              <div className="mt-3 flex-1 min-h-0 flex flex-col overflow-hidden border-t border-gray-200 dark:border-gray-600 pt-3">
                {leaderboardData.myRank != null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Your rank: {leaderboardData.myRank}</p>
                )}
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Top 100</div>
                <div className="overflow-y-auto flex-1 min-h-0 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <table className="w-full text-[10px] sm:text-xs">
                    <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 text-left">
                      <tr>
                        <th className="px-1 py-0.5">#</th>
                        <th className="px-1 py-0.5 truncate max-w-[80px]">User</th>
                        <th className="px-1 py-0.5">W</th>
                        <th className="px-1 py-0.5">%</th>
                        <th className="px-1 py-0.5">Str</th>
                      </tr>
                    </thead>
                    <tbody className="dark:text-gray-200">
                      {leaderboardData.top100.map((e) => (
                        <tr key={e.rank} className="border-t border-gray-100 dark:border-gray-600">
                          <td className="px-1 py-0.5">{e.rank}</td>
                          <td className="px-1 py-0.5 truncate max-w-[80px]" title={e.userId}>{e.userId}</td>
                          <td className="px-1 py-0.5">{e.gamesWon}</td>
                          <td className="px-1 py-0.5">{e.winRate}%</td>
                          <td className="px-1 py-0.5">{e.currentStreak}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {leaderboardData.aroundMe.length > 0 && (
                  <>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 mb-1">Around you</div>
                    <div className="overflow-y-auto max-h-24 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <table className="w-full text-[10px] sm:text-xs">
                        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 text-left">
                          <tr>
                            <th className="px-1 py-0.5">#</th>
                            <th className="px-1 py-0.5 truncate max-w-[80px]">User</th>
                            <th className="px-1 py-0.5">W</th>
                            <th className="px-1 py-0.5">%</th>
                            <th className="px-1 py-0.5">Str</th>
                          </tr>
                        </thead>
                        <tbody className="dark:text-gray-200">
                          {leaderboardData.aroundMe.map((e) => (
                            <tr key={e.rank} className="border-t border-gray-100 dark:border-gray-600">
                              <td className="px-1 py-0.5">{e.rank}</td>
                              <td className="px-1 py-0.5 truncate max-w-[80px]" title={e.userId}>{e.userId}</td>
                              <td className="px-1 py-0.5">{e.gamesWon}</td>
                              <td className="px-1 py-0.5">{e.winRate}%</td>
                              <td className="px-1 py-0.5">{e.currentStreak}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => { playUIClose(); setShowStats(false); setLeaderboardOpen(false); }}
              className="mt-3 sm:mt-4 w-full py-2 bg-green-500 text-white text-sm sm:text-base rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Dev Menu Modal (only on dev subreddit) */}
      {isDevSubreddit && showDevMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { playUIClose(); setShowDevMenu(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-3 text-center dark:text-white flex items-center justify-center gap-2">
              <img src={getTwemojiUrl('🛠️')} alt="" className="w-5 h-5 object-contain" draggable={false} />
              Dev Mode
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Current: Day {dayNumber}{testDay ? ` (test day ${testDay})` : ' (today)'}
            </p>
            <input
              type="number"
              placeholder="Enter day number (1-999)"
              value={devDayInput}
              onChange={(e) => { handleTypeSound(); setDevDayInput(e.target.value); }}
              className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-white border-none outline-none focus:ring-2 focus:ring-green-500 mb-3"
              min="1"
              max="999"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setDevDayInput(''); setTestDay(undefined); setShowDevMenu(false); reload(); }}
                className="flex-1 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white text-sm rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Reset to Today
              </button>
              <button
                onClick={applyTestDay}
                className="flex-1 py-2 bg-green-500 text-white text-sm rounded-lg font-medium hover:bg-green-600 transition-colors"
              >
                Apply
              </button>
            </div>
            <button
              onClick={async () => {
                setResetDayMessage(null);
                const msg = await resetDayResult();
                if (msg) setResetDayMessage(msg);
              }}
              className="mt-2 w-full py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Reset day result
            </button>
            <button
              onClick={async () => {
                setResetStatsMessage(null);
                try {
                  const res = await fetch('/api/dev/reset-stats', { method: 'POST' });
                  const data = await res.json();
                  if (data.status === 'success') {
                    await loadStats();
                    setResetStatsMessage(data.message ?? 'Stats reset.');
                  } else {
                    setResetStatsMessage(data.message ?? data.status ?? 'Failed');
                  }
                } catch (e) {
                  setResetStatsMessage('Request failed');
                }
              }}
              className="mt-2 w-full py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Reset stats
            </button>
            <button
              onClick={async () => {
                setReset7DayMessage(null);
                try {
                  const res = await fetch('/api/dev/reset-7-day-test', { method: 'POST' });
                  const data = await res.json();
                  setReset7DayMessage(data.message ?? data.status ?? 'Done');
                } catch (e) {
                  setReset7DayMessage('Request failed');
                }
              }}
              className="mt-2 w-full py-2 bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100 text-sm rounded-lg font-medium hover:bg-amber-300 dark:hover:bg-amber-600 transition-colors"
            >
              Reset 7-day test counter
            </button>
            {(resetDayMessage || reset7DayMessage || resetStatsMessage) && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center">
                {resetDayMessage ?? reset7DayMessage ?? resetStatsMessage}
              </p>
            )}
          </div>
        </div>
      )}

        {/* Emoji Display (Twemoji from same-origin /emoji/) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-md max-w-md mx-auto w-full">
          <div className="grid grid-cols-6 gap-2 sm:gap-3 text-2xl sm:text-3xl place-items-center">
            {visibleEmojis.map(({ emoji, visible }, index) => (
              <img
                key={index}
                src={getTwemojiUrl(emoji)}
                alt=""
                className={`w-8 h-8 sm:w-9 sm:h-9 object-contain transition-all duration-300 ${
                  visible ? 'opacity-100 scale-100' : 'opacity-20 grayscale scale-90'
                }`}
                draggable={false}
              />
            ))}
          </div>
        </div>

        {/* Tries indicator — 6-column grid, circles under each emoji */}
        <div className="grid grid-cols-6 gap-2 sm:gap-3 my-3 sm:my-4 max-w-md mx-auto w-full px-3 sm:px-4 place-items-center">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-colors ${
                index < triesLeft ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
          ))}
        </div>

        {/* Game Over Message */}
        {gameOver && (
          <div className={`text-center p-3 sm:p-4 rounded-xl max-w-md mx-auto w-full animate-fade-in-up ${won ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            <div className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 dark:text-white flex items-center justify-center gap-2">
              {won ? (
                <>
                  <img src={getTwemojiUrl('🎬')} alt="" className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0" draggable={false} />
                  You got it!
                </>
              ) : (
                <>
                  <img src={getTwemojiUrl('💀')} alt="" className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0" draggable={false} />
                  Game Over
                </>
              )}
            </div>
            <div className="text-base sm:text-lg">
              <span className="font-semibold dark:text-white">{movieTitle || '...'}</span>
              <span className="text-gray-500 dark:text-gray-400"> ({movieYear || '...'})</span>
            </div>
            <button
              onClick={() => { playClick(); handleShare(); }}
              className="mt-2 sm:mt-3 px-4 sm:px-6 py-2 bg-green-500 text-white text-sm sm:text-base rounded-lg font-medium hover:bg-green-600 transition-colors inline-flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <img src={getTwemojiUrl('✅')} alt="" className="w-5 h-5 object-contain" draggable={false} />
                  Copied!
                </>
              ) : (
                <>
                  <img src={getTwemojiUrl('📋')} alt="" className="w-5 h-5 object-contain" draggable={false} />
                  Share Result
                </>
              )}
            </button>
          </div>
        )}

        {/* Search Filter */}
        {!gameOver && (
          <input
            type="text"
            placeholder="Search words..."
            value={filter}
            onChange={(e) => { handleTypeSound(); setFilter(e.target.value); }}
            className="w-full max-w-md mx-auto px-3 sm:px-4 py-2 text-sm sm:text-base rounded-full bg-gray-200 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 border-none outline-none focus:ring-2 focus:ring-green-500"
          />
        )}

        {/* Word cloud — wider on desktop, tighter buttons to reduce scroll */}
        {!gameOver && (
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto px-1 mt-3 sm:mt-4">
            {wordCloud.map((word) => (
              <button
                key={word}
                onClick={() => { playClick(); makeGuess(word); }}
                disabled={loading || selectedWords.includes(word.toLowerCase())}
                className={`px-2 sm:px-2.5 lg:px-2 py-1 sm:py-1 lg:py-1 rounded-full text-xs sm:text-sm font-medium transition-all ${getWordClass(word)} ${
                  loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="shrink-0 pt-2 sm:pt-4 text-center text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
        Guess the movie from emojis • New puzzle daily
      </footer>
    </div>
  );
};
