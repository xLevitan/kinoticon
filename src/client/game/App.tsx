import { useState } from 'react';
import { useGame } from '../hooks/useGame';

export const App = () => {
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
  } = useGame();

  const [showStats, setShowStats] = useState(false);
  const [copied, setCopied] = useState(false);

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
    if (selectedWords.includes(wordLower)) return 'bg-gray-400 text-white';
    return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
  };

  if (loading && visibleEmojis.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <header className="text-center mb-4">
        <h1 className="text-3xl font-bold text-green-600">Kinoticon</h1>
        <p className="text-sm text-gray-500">Day {dayNumber}</p>
      </header>

      {/* Stats Button */}
      <button
        onClick={() => setShowStats(!showStats)}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg hover:bg-gray-300 transition-colors"
      >
        📊
      </button>

      {/* Stats Modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowStats(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 text-center">Your Stats</h2>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.gamesPlayed}</div>
                <div className="text-xs text-gray-500">Played</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.winRate}%</div>
                <div className="text-xs text-gray-500">Win %</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.currentStreak}</div>
                <div className="text-xs text-gray-500">Streak</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.maxStreak}</div>
                <div className="text-xs text-gray-500">Max</div>
              </div>
            </div>
            <button
              onClick={() => setShowStats(false)}
              className="mt-4 w-full py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Emoji Display */}
      <div className="bg-white rounded-xl p-4 shadow-md mb-4 max-w-md mx-auto w-full">
        <div className="flex justify-center gap-3 text-3xl">
          {visibleEmojis.map(({ emoji, visible }, index) => (
            <span
              key={index}
              className={`transition-all duration-300 ${
                visible ? 'opacity-100 scale-100' : 'opacity-20 grayscale scale-90'
              }`}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>

      {/* Tries Indicator */}
      <div className="flex justify-center gap-2 mb-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className={`w-4 h-4 rounded-full transition-colors ${
              index < triesLeft ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
        ))}
      </div>

      {/* Game Over Message */}
      {gameOver && (
        <div className={`text-center mb-4 p-4 rounded-xl ${won ? 'bg-green-100' : 'bg-red-100'}`}>
          <div className="text-2xl font-bold mb-2">
            {won ? '🎬 You got it!' : '💀 Game Over'}
          </div>
          <div className="text-lg">
            <span className="font-semibold">{movieTitle}</span>
            <span className="text-gray-500"> ({movieYear})</span>
          </div>
          <button
            onClick={handleShare}
            className="mt-3 px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
          >
            {copied ? '✓ Copied!' : '📋 Share Result'}
          </button>
        </div>
      )}

      {/* Search Filter */}
      {!gameOver && (
        <input
          type="text"
          placeholder="Search words..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-md mx-auto px-4 py-2 rounded-full bg-gray-200 border-none outline-none focus:ring-2 focus:ring-green-500 mb-4"
        />
      )}

      {/* Word Cloud */}
      {!gameOver && (
        <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
          {wordCloud.map((word) => (
            <button
              key={word}
              onClick={() => makeGuess(word)}
              disabled={loading || selectedWords.includes(word.toLowerCase())}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${getWordClass(word)} ${
                loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {word}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto pt-4 text-center text-xs text-gray-400">
        Guess the movie from emojis • New puzzle daily
      </footer>
    </div>
  );
};
