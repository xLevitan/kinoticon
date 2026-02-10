import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { context, requestExpandedMode } from '@devvit/web/client';
import {
  Button,
  Panel,
  ProgressBar,
  TextInput,
  Window,
  WindowContent,
  WindowHeader,
} from 'react95';
import { useGame } from '../hooks/useGame';
import { useSound } from '../hooks/useSound';
import { getTwemojiUrl, preloadTwemoji, UI_EMOJI } from '../utils/twemoji';

const STARTED_KEY_PREFIX = 'kinoticon-started-';

function getStartedKey(dayNumber: number): string {
  return `${STARTED_KEY_PREFIX}${dayNumber}`;
}

/** Tooltip that renders in a portal so it appears above the window (not clipped); Win95-style look */
function PortalTooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: r.left + r.width / 2,
      y: r.bottom + 4,
    });
  };

  useEffect(() => {
    if (!show) return;
    updatePosition();
  }, [show]);

  const tooltipEl = show && (
    <div
      role="tooltip"
      className="fixed px-2 py-1 text-xs max-w-[240px] text-center pointer-events-none z-[10000]"
      style={{
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, 0)',
        background: '#ffffe1',
        border: '1px solid #000',
        boxShadow: '2px 2px 0 rgba(0,0,0,0.1)',
      }}
    >
      {text}
    </div>
  );

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="inline-flex"
      >
        {children}
      </span>
      {tooltipEl && createPortal(tooltipEl, document.body)}
    </>
  );
}

/** Small X icon for window close button (react95 window-close variant hides children) */
const CloseIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M1 1l8 8M9 1L1 9" />
  </svg>
);

export const App = () => {
  const [started, setStarted] = useState(false);
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
      void reload();
    }
  };

  const [showStats, setShowStats] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<{
    top100: {
      rank: number;
      userId: string;
      gamesPlayed: number;
      gamesWon: number;
      winRate: number;
      currentStreak: number;
      maxStreak: number;
    }[];
    aroundMe: {
      rank: number;
      userId: string;
      gamesPlayed: number;
      gamesWon: number;
      winRate: number;
      currentStreak: number;
      maxStreak: number;
    }[];
    myRank: number | null;
  } | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoadingAfterPlay, setShowLoadingAfterPlay] = useState(false);
  const loadingStartRef = useRef<number | null>(null);

  const {
    enabled: soundEnabled,
    toggle: toggleSound,
    playClick,
    playCorrect,
    playWrong,
    playWin,
    playLose,
    playUISound,
    playUIMenu,
    playUIFullscreen,
    playUIStats,
    playUIClose,
    playUIType,
  } = useSound();

  // Preload UI emoji on mount so icons appear instantly
  useEffect(() => {
    void preloadTwemoji(UI_EMOJI);
  }, []);

  // Show loading screen when actually loading OR right after Play (so bar always runs 0→100)
  const isLoadingScreen =
    (loading && visibleEmojis.length === 0) || showLoadingAfterPlay;
  const LOADING_BAR_DURATION_MS = 1800;
  const LOADING_BAR_TICK_MS = 50;

  // ProgressBar: animate 0 → 95% over duration; only hit 100% when data is ready (no hang at 100%)
  const LOADING_BAR_CAP = 95;
  useEffect(() => {
    if (!isLoadingScreen) {
      setLoadingProgress(0);
      loadingStartRef.current = null;
      return;
    }
    if (loadingStartRef.current === null) {
      loadingStartRef.current = Date.now();
    }
    const start = loadingStartRef.current;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const value = Math.min(
        LOADING_BAR_CAP,
        (elapsed / LOADING_BAR_DURATION_MS) * LOADING_BAR_CAP
      );
      setLoadingProgress(Math.round(value));
    }, LOADING_BAR_TICK_MS);
    return () => clearInterval(id);
  }, [isLoadingScreen]);

  // When game data is ready, set 100% and transition immediately (no hang at 100%)
  useEffect(() => {
    if (!showLoadingAfterPlay || visibleEmojis.length === 0) return;
    setLoadingProgress(100);
    const t = setTimeout(() => setShowLoadingAfterPlay(false), 50);
    return () => clearTimeout(t);
  }, [showLoadingAfterPlay, visibleEmojis.length]);

  // Once we know the day: skip splash for days the user has already started
  useEffect(() => {
    if (dayNumber > 0 && localStorage.getItem(getStartedKey(dayNumber)) === '1') {
      setStarted(true);
    }
  }, [dayNumber]);

  // Debounce for type sound - play immediately but throttle rapid typing
  const typeSoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const prevStateRef = useRef({
    triesLeft,
    gameOver,
    won,
    correctWords: correctWords.length,
    wrongWords: wrongWords.length,
  });

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
    prevStateRef.current = {
      triesLeft,
      gameOver,
      won,
      correctWords: correctWords.length,
      wrongWords: wrongWords.length,
    };
  }, [
    triesLeft,
    gameOver,
    won,
    correctWords.length,
    wrongWords.length,
    playWin,
    playLose,
    playCorrect,
    playWrong,
  ]);

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

  const getWordStyle = (word: string): React.CSSProperties => {
    const wordLower = word.toLowerCase();
    const pressedText = '#fff';
    if (correctWords.includes(wordLower))
      return { backgroundColor: '#008000', color: pressedText, fontWeight: 600 };
    if (wrongWords.includes(wordLower))
      return { backgroundColor: '#c00', color: pressedText, fontWeight: 600 };
    if (selectedWords.includes(wordLower))
      return { backgroundColor: '#555', color: pressedText, fontWeight: 600 };
    return {};
  };

  // Splash screen before game starts — same layout as game: WordArt at top, then content, then footer
  if (!started) {
    return (
      <div
        className="h-screen h-[100dvh] flex flex-col items-center overflow-hidden"
        style={{ background: '#008080' }}
      >
        {/* WordArt: same position as in game */}
        <div className="shrink-0 pt-4 pb-2 sm:pt-6 sm:pb-3 flex justify-center w-full" aria-hidden>
          <span className="wordart-kinoticon">Kinoticon</span>
        </div>
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center px-3 sm:px-4">
          <Window className="max-w-sm w-full shrink-0">
            <WindowHeader className="flex items-center justify-center">
              <span>Kinoticon</span>
            </WindowHeader>
            <WindowContent className="flex flex-col items-center gap-3 py-4">
              <img
                src={getTwemojiUrl('🎬')}
                alt=""
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                draggable={false}
              />
              <p className="text-center text-sm">Guess the movie from emojis!</p>
              <p>Hey {context?.username ?? 'there'} 👋</p>
              <Button
                primary
                size="lg"
                onClick={() => {
                  playClick();
                  if (dayNumber > 0) {
                    localStorage.setItem(getStartedKey(dayNumber), '1');
                  }
                  setLoadingProgress(0);
                  setShowLoadingAfterPlay(true);
                  setStarted(true);
                }}
              >
                ▶ Play
              </Button>
              <p
                className={`text-xs select-none ${isDevSubreddit ? 'cursor-pointer' : ''}`}
                {...(isDevSubreddit ? { onClick: () => setShowDevMenu(true) } : {})}
              >
                Day {dayNumber}
                {isDevSubreddit && testDay ? ' (test)' : ''} • New puzzle daily
              </p>
            </WindowContent>
          </Window>
        </div>
        <footer
          className="shrink-0 mt-3 mb-2 sm:mt-4 sm:mb-3 text-center w-full text-[9px] sm:text-[10px]"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          Guess the movie from emojis • New puzzle daily
        </footer>
      </div>
    );
  }

  if (isLoadingScreen) {
    return (
      <div
        className="h-screen h-[100dvh] flex flex-col items-center justify-center overflow-hidden px-4"
        style={{ background: '#008080' }}
      >
        <Panel variant="well" className="w-full max-w-xs px-6 py-4 flex flex-col gap-3">
          <span>Loading...</span>
          <ProgressBar value={loadingProgress} className="w-full" />
        </Panel>
      </div>
    );
  }

  return (
    <div
      className="h-screen h-[100dvh] flex flex-col items-center overflow-hidden"
      style={{ background: '#008080' }}
    >
      {/* WordArt: fixed distance from top, like footer at bottom */}
      <div className="shrink-0 pt-4 pb-2 sm:pt-6 sm:pb-3 flex justify-center w-full" aria-hidden>
        <span className="wordart-kinoticon">Kinoticon</span>
      </div>

      {/* Window: always vertically centered; height = content so no extra space below word cloud */}
      <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center px-3 sm:px-4">
        <Window className="w-full max-w-2xl flex flex-col overflow-hidden shrink-0 max-h-full">
          <WindowHeader className="flex items-center justify-between gap-2 shrink-0">
          <span
            className="truncate select-none"
            {...(isDevSubreddit
              ? { onClick: () => setShowDevMenu(true), style: { cursor: 'pointer' } }
              : {})}
          >
            Kinoticon — Day {dayNumber}
            {isDevSubreddit && testDay ? ' (test)' : ''}
          </span>
          <div className="flex gap-1 shrink-0">
            {isDevSubreddit && (
              <Button
                variant="menu"
                size="sm"
                onClick={() => {
                  playUIMenu();
                  setShowDevMenu(true);
                }}
                title="Dev Mode - Change Day"
              >
                <img
                  src={getTwemojiUrl('🛠️')}
                  alt=""
                  className="w-5 h-5 object-contain"
                  draggable={false}
                />
              </Button>
            )}
            <Button
              variant="menu"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                playUIFullscreen();
                void requestExpandedMode(e.nativeEvent, 'game');
              }}
              title="Fullscreen"
            >
              <img
                src={getTwemojiUrl('↗️')}
                alt=""
                className="w-5 h-5 object-contain"
                draggable={false}
              />
            </Button>
            <Button
              variant="menu"
              size="sm"
              onClick={() => {
                toggleSound();
                playUISound();
              }}
              title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
            >
              <img
                src={getTwemojiUrl(soundEnabled ? '🔊' : '🔇')}
                alt=""
                className="w-5 h-5 object-contain"
                draggable={false}
              />
            </Button>
            <Button
              variant="menu"
              size="sm"
              onClick={() => {
                setShowStats(!showStats);
                playUIStats();
              }}
            >
              <img
                src={getTwemojiUrl('📊')}
                alt=""
                className="w-5 h-5 object-contain"
                draggable={false}
              />
            </Button>
          </div>
        </WindowHeader>

        {/* Breadcrumbs: white sunken bar, path only */}
        <div
          className="shrink-0 flex items-center gap-1 py-0.5 px-2 text-xs min-w-0 flex-wrap"
          style={{
            background: '#ffffff',
            border: '1px solid',
            borderColor: '#808080 #ffffff #ffffff #808080',
            boxShadow: 'inset 1px 1px 0 0 #808080',
          }}
          aria-label="Address"
        >
          <span style={{ color: '#000' }}>C:</span>
          <span style={{ color: '#808080' }}>&gt;</span>
          <span style={{ color: '#000' }}>Reddit</span>
          <span style={{ color: '#808080' }}>&gt;</span>
          <span style={{ color: '#000' }}>Kinoticon</span>
          <span style={{ color: '#808080' }}>&gt;</span>
          <span style={{ color: '#000' }}>Day {dayNumber}</span>
        </div>

        <WindowContent
          className={`flex flex-col py-2 px-2 sm:py-3 sm:px-3 overflow-hidden ${
            gameOver ? 'shrink-0' : 'shrink-0 min-h-0'
          }`}
        >
          <main
            className={`flex flex-col items-center w-full overflow-hidden pt-1 sm:pt-2 shrink-0 min-h-0`}
          >
            {/* Stats Modal */}
            {showStats && (
              <div
                className="fixed inset-0 flex items-center justify-center z-50 p-4"
                style={{ background: 'rgba(0,0,0,0.4)' }}
                onClick={() => {
                  playUIClose();
                  setShowStats(false);
                  setLeaderboardOpen(false);
                }}
              >
                <div
                  className="max-w-sm w-full max-h-[90vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Window>
                    <WindowHeader className="flex items-center justify-between w-full gap-2">
                      <span>Your Stats</span>
                      <Button
                        size="sm"
                        onClick={() => {
                          playUIClose();
                          setShowStats(false);
                          setLeaderboardOpen(false);
                        }}
                        title="Close"
                        style={{
                          minWidth: 21,
                          height: 21,
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CloseIcon />
                      </Button>
                    </WindowHeader>
                    <WindowContent className="flex flex-col gap-2">
                      <div className="grid grid-cols-4 gap-px text-center overflow-hidden border border-[#808080]">
                        <div className="bg-[#e8e8e8] p-2 border-b border-[#808080]">
                          <div className="text-[10px] sm:text-xs text-black/80">Played</div>
                          <div className="text-xl sm:text-2xl font-bold text-black">{stats.gamesPlayed}</div>
                        </div>
                        <div className="bg-[#c6efce] p-2 border-b border-[#808080]">
                          <div className="text-[10px] sm:text-xs text-black/80">Win %</div>
                          <div className="text-xl sm:text-2xl font-bold text-black">{stats.winRate}%</div>
                        </div>
                        <div className="bg-[#ffeb9c] p-2 border-b border-[#808080]">
                          <div className="text-[10px] sm:text-xs text-black/80">Streak</div>
                          <div className="text-xl sm:text-2xl font-bold text-black">{stats.currentStreak}</div>
                        </div>
                        <div className="bg-[#b4d7f0] p-2 border-b border-[#808080]">
                          <div className="text-[10px] sm:text-xs text-black/80">Max</div>
                          <div className="text-xl sm:text-2xl font-bold text-black">{stats.maxStreak}</div>
                        </div>
                      </div>
                      <Button
                        fullWidth
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
                      >
                        {leaderboardOpen ? 'Hide leaderboard' : 'Leaderboard'}
                      </Button>
                      {leaderboardOpen && leaderboardLoading && (
                        <div className="text-center text-sm">Loading...</div>
                      )}
                      {leaderboardOpen && !leaderboardLoading && leaderboardData && (
                        <div className="mt-1 flex-1 min-h-0 flex flex-col overflow-hidden border border-black border-t-gray-300 border-l-gray-300 pt-2">
                          {leaderboardData.myRank != null && (
                            <p className="text-xs mb-1 text-center">
                              Your rank: {leaderboardData.myRank}
                            </p>
                          )}
                          <div className="text-xs font-medium mb-1">Top 100</div>
                          <div className="overflow-y-auto flex-1 min-h-0 border border-gray-400 border-t-gray-200 border-l-gray-200">
                            <table className="w-full text-[10px] sm:text-xs border-collapse">
                              <thead className="sticky top-0 bg-[#7d7d7d] text-left text-white">
                                <tr>
                                  <th className="px-1 py-0.5 border border-[#606060]">#</th>
                                  <th className="px-1 py-0.5 truncate max-w-[80px] border border-[#606060]">User</th>
                                  <th className="px-1 py-0.5 border border-[#606060]">W</th>
                                  <th className="px-1 py-0.5 border border-[#606060]">%</th>
                                  <th className="px-1 py-0.5 border border-[#606060]">Str</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leaderboardData.top100.map((e, i) => (
                                  <tr
                                    key={e.rank}
                                    className={i % 2 === 0 ? 'bg-white' : 'bg-[#f0f0f0]'}
                                  >
                                    <td className="px-1 py-0.5 border border-[#d0d0d0]">{e.rank}</td>
                                    <td
                                      className="px-1 py-0.5 truncate max-w-[80px] border border-[#d0d0d0]"
                                      title={e.userId}
                                    >
                                      {e.userId}
                                    </td>
                                    <td className="px-1 py-0.5 border border-[#d0d0d0]">{e.gamesWon}</td>
                                    <td className="px-1 py-0.5 border border-[#d0d0d0]">{e.winRate}%</td>
                                    <td className="px-1 py-0.5 border border-[#d0d0d0]">{e.currentStreak}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {leaderboardData.aroundMe.length > 0 && (
                            <>
                              <div className="text-xs font-medium mt-2 mb-1">Around you</div>
                              <div className="overflow-y-auto max-h-24 border border-gray-400 border-t-gray-200 border-l-gray-200">
                                <table className="w-full text-[10px] sm:text-xs border-collapse">
                                  <thead className="sticky top-0 bg-[#7d7d7d] text-left text-white">
                                    <tr>
                                      <th className="px-1 py-0.5 border border-[#606060]">#</th>
                                      <th className="px-1 py-0.5 truncate max-w-[80px] border border-[#606060]">User</th>
                                      <th className="px-1 py-0.5 border border-[#606060]">W</th>
                                      <th className="px-1 py-0.5 border border-[#606060]">%</th>
                                      <th className="px-1 py-0.5 border border-[#606060]">Str</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {leaderboardData.aroundMe.map((e, i) => (
                                      <tr
                                        key={e.rank}
                                        className={i % 2 === 0 ? 'bg-white' : 'bg-[#f0f0f0]'}
                                      >
                                        <td className="px-1 py-0.5 border border-[#d0d0d0]">{e.rank}</td>
                                        <td
                                          className="px-1 py-0.5 truncate max-w-[80px] border border-[#d0d0d0]"
                                          title={e.userId}
                                        >
                                          {e.userId}
                                        </td>
                                        <td className="px-1 py-0.5 border border-[#d0d0d0]">{e.gamesWon}</td>
                                        <td className="px-1 py-0.5 border border-[#d0d0d0]">{e.winRate}%</td>
                                        <td className="px-1 py-0.5 border border-[#d0d0d0]">{e.currentStreak}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <Button
                        primary
                        fullWidth
                        onClick={() => {
                          playUIClose();
                          setShowStats(false);
                          setLeaderboardOpen(false);
                        }}
                      >
                        Close
                      </Button>
                    </WindowContent>
                  </Window>
                </div>
              </div>
            )}

            {/* Dev Menu Modal (only on dev subreddit) */}
            {isDevSubreddit && showDevMenu && (
              <div
                className="fixed inset-0 flex items-center justify-center z-50 p-4"
                style={{ background: 'rgba(0,0,0,0.4)' }}
                onClick={() => {
                  playUIClose();
                  setShowDevMenu(false);
                }}
              >
                <div className="max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                  <Window>
                    <WindowHeader className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getTwemojiUrl('🛠️')}
                          alt=""
                          className="w-5 h-5 object-contain shrink-0"
                          draggable={false}
                        />
                        <span>Dev Mode</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          playUIClose();
                          setShowDevMenu(false);
                        }}
                        title="Close"
                        style={{
                          minWidth: 21,
                          height: 21,
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CloseIcon />
                      </Button>
                    </WindowHeader>
                    <WindowContent className="flex flex-col gap-2">
                      <p className="text-sm">
                        Current: Day {dayNumber}
                        {testDay ? ` (test day ${testDay})` : ' (today)'}
                      </p>
                      <TextInput
                        placeholder="Enter day number (1-999)"
                        value={devDayInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          handleTypeSound();
                          setDevDayInput(e.target.value);
                        }}
                      />
                      <div className="flex gap-2">
                        <Button
                          fullWidth
                          onClick={() => {
                            setDevDayInput('');
                            setTestDay(undefined);
                            setShowDevMenu(false);
                            void reload();
                          }}
                        >
                          Reset to Today
                        </Button>
                        <Button primary fullWidth onClick={applyTestDay}>
                          Apply
                        </Button>
                      </div>
                      <Button
                        fullWidth
                        onClick={async () => {
                          setResetDayMessage(null);
                          const msg = await resetDayResult();
                          if (msg) setResetDayMessage(msg);
                        }}
                      >
                        Reset day result
                      </Button>
                      <Button
                        fullWidth
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
                          } catch {
                            setResetStatsMessage('Request failed');
                          }
                        }}
                      >
                        Reset stats
                      </Button>
                      <Button
                        fullWidth
                        variant="menu"
                        onClick={async () => {
                          setReset7DayMessage(null);
                          try {
                            const res = await fetch('/api/dev/reset-7-day-test', {
                              method: 'POST',
                            });
                            const data = await res.json();
                            setReset7DayMessage(data.message ?? data.status ?? 'Done');
                          } catch {
                            setReset7DayMessage('Request failed');
                          }
                        }}
                      >
                        Reset 7-day test counter
                      </Button>
                      {(resetDayMessage || reset7DayMessage || resetStatsMessage) && (
                        <p className="text-xs text-center">
                          {resetDayMessage ?? reset7DayMessage ?? resetStatsMessage}
                        </p>
                      )}
                    </WindowContent>
                  </Window>
                </div>
              </div>
            )}

            <div
              className={`w-full flex flex-col items-center max-w-lg gap-2 sm:gap-3 min-w-0 overflow-visible px-3 sm:px-1 pb-2 shrink-0`}
            >
              {/* Emoji row — white cell background for icon visibility; overflow-visible so tooltips aren't clipped */}
              <Panel variant="well" className="w-full p-2 sm:p-3 shrink-0 overflow-visible">
                <div className="grid grid-cols-6 gap-1 sm:gap-2 text-xl sm:text-2xl place-items-center bg-white border border-[#808080] p-1.5 overflow-visible">
                  {visibleEmojis.map(({ emoji }, index) => (
                    <PortalTooltip key={index} text="Film plot">
                      <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 cursor-default">
                        <img
                          src={getTwemojiUrl(emoji)}
                          alt=""
                          className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
                          draggable={false}
                        />
                      </span>
                    </PortalTooltip>
                  ))}
                </div>
              </Panel>

              {/* Tries (hitpoints) — Win95-style radio; each circle under its emoji, one Tooltip per circle so layout unchanged */}
              <div className="grid grid-cols-6 gap-1 sm:gap-2 w-full px-0 shrink-0 place-items-center">
                {Array.from({ length: 6 }).map((_, index) => {
                  const isLeft = index < triesLeft;
                  return (
                    <PortalTooltip
                      key={index}
                      text="These are your Hit Points. Green = remaining tries. Red = used."
                    >
                      <div
                        className="rounded-full transition-all duration-200 w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center"
                        style={{
                          backgroundColor: isLeft ? '#228b22' : '#b22222',
                          border: '2px solid',
                          borderColor: isLeft
                            ? '#7fff7f #004d00 #004d00 #7fff7f'
                            : '#4a0000 #ff6b6b #ff6b6b #4a0000',
                          boxShadow: isLeft
                            ? '1px 1px 0 0 rgba(255,255,255,0.6)'
                            : 'inset 2px 2px 0 0 rgba(0,0,0,0.4)',
                        }}
                        aria-hidden
                      />
                    </PortalTooltip>
                  );
                })}
              </div>

              {/* Game Over: result without border, button outside */}
              {gameOver && (
                <div className="w-full shrink-0 flex flex-col items-center animate-fade-in-up">
                  <div className="w-full text-center py-5 px-4 sm:py-6 sm:px-5">
                    <div className="text-lg sm:text-xl font-bold mb-2 flex items-center justify-center gap-2">
                      {won ? (
                        <>
                          <img
                            src={getTwemojiUrl('🎬')}
                            alt=""
                            className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0"
                            draggable={false}
                          />
                          You got it!
                        </>
                      ) : (
                        <>
                          <img
                            src={getTwemojiUrl('💀')}
                            alt=""
                            className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0"
                            draggable={false}
                          />
                          Game Over
                        </>
                      )}
                    </div>
                    <div className="text-sm sm:text-base">
                      <span className="font-semibold">{movieTitle || '...'}</span>
                      <span> ({movieYear || '...'})</span>
                    </div>
                  </div>
                  <Button
                    primary
                    className="mt-2 sm:mt-3 inline-flex items-center justify-center gap-2"
                    onClick={() => {
                      playClick();
                      void handleShare();
                    }}
                  >
                    {copied ? (
                      <>
                        <img
                          src={getTwemojiUrl('✅')}
                          alt=""
                          className="w-5 h-5 object-contain"
                          draggable={false}
                        />
                        Copied!
                      </>
                    ) : (
                      <>
                        <img
                          src={getTwemojiUrl('📋')}
                          alt=""
                          className="w-5 h-5 object-contain"
                          draggable={false}
                        />
                        Share Result
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Search Filter */}
              {!gameOver && (
                <div className="w-full min-w-0 shrink-0">
                  <TextInput
                    placeholder="Search words..."
                    value={filter}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      handleTypeSound();
                      setFilter(e.target.value);
                    }}
                  />
                </div>
              )}

              {/* Word cloud — content height so no extra space below; no scroll */}
              {!gameOver && (
                <div className="flex flex-wrap justify-center items-start gap-1 sm:gap-1.5 w-full min-w-0 overflow-hidden content-start pb-1 shrink-0">
                  {wordCloud.map((word) => (
                    <Button
                      key={word}
                      size="sm"
                      onClick={() => {
                        playClick();
                        makeGuess(word);
                      }}
                      disabled={loading || selectedWords.includes(word.toLowerCase())}
                      style={getWordStyle(word)}
                      className={
                        correctWords.includes(word.toLowerCase()) ||
                        wrongWords.includes(word.toLowerCase()) ||
                        selectedWords.includes(word.toLowerCase())
                          ? 'word-button-pressed'
                          : undefined
                      }
                    >
                      <span
                        className={
                          correctWords.includes(word.toLowerCase()) ||
                          wrongWords.includes(word.toLowerCase()) ||
                          selectedWords.includes(word.toLowerCase())
                            ? 'word-pressed-text'
                            : undefined
                        }
                        style={
                          correctWords.includes(word.toLowerCase()) ||
                          wrongWords.includes(word.toLowerCase()) ||
                          selectedWords.includes(word.toLowerCase())
                            ? { color: '#fff', WebkitTextFillColor: '#fff' }
                            : undefined
                        }
                      >
                        {word}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </main>
        </WindowContent>
      </Window>
      </div>

      <footer
        className="shrink-0 mt-3 mb-2 sm:mt-4 sm:mb-3 text-center w-full text-[9px] sm:text-[10px]"
        style={{ color: 'rgba(255,255,255,0.85)' }}
      >
        Guess the movie from emojis • New puzzle daily
      </footer>
    </div>
  );
};
