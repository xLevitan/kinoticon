/**
 * Local preview server without Devvit playtest.
 * Serves built client + mock API. Use ?day=6 in URL or set localStorage kinoticon-testDay=6.
 *
 * Usage: npm run build && npx tsx scripts/preview-server.ts
 * Then open http://localhost:5174/game.html?day=6
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDailyMovie } from '../src/shared/data/movies';
import {
  generateWordCloud,
  generateTitleHashes,
  encryptMovieInfo,
} from '../src/shared/utils/wordCloud';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const clientDir = path.join(projectRoot, 'dist/client');

const app = express();
const PORT_START = 5174;

// In-memory game state per session (keyed by dayKey)
const stateStore = new Map<string, { selectedWords: string[]; correctWords: string[]; triesLeft: number; gameOver: boolean; won: boolean }>();

function getStateKey(dayKey: string): string {
  return `preview:${dayKey}`;
}

app.use(express.json());

// Mock /api/context — isModerator so testDay from localStorage works
app.get('/api/context', (_req, res) => {
  res.json({ isModerator: true });
});

// Mock /api/game/daily — supports ?testDay=N and ?day=N (from URL)
app.get('/api/game/daily', (req, res) => {
  try {
    const testDayParam = req.query.testDay ?? req.query.day;
    const testDay = testDayParam ? parseInt(String(testDayParam), 10) : undefined;
    const startDate = new Date().toISOString().slice(0, 10);
    const { movie, dayNumber } = getDailyMovie(
      testDay ?? startDate,
      startDate
    );
    const dayKey = testDay ? `test-day-${testDay}` : `date-${startDate}`;

    const wordCloud = generateWordCloud(movie, dayNumber);
    const salt = dayKey;
    const titleHashes = generateTitleHashes(movie, salt);
    const encryptedMovie = encryptMovieInfo(movie.title, movie.year, salt);

    const stateKey = getStateKey(dayKey);
    const existing = stateStore.get(stateKey);

    if (existing) {
      res.json({
        emojis: movie.emojis,
        wordCloud,
        titleHashes,
        salt,
        encryptedMovie,
        triesLeft: existing.triesLeft,
        gameOver: existing.gameOver,
        won: existing.won,
        selectedWords: existing.selectedWords,
        correctWords: existing.correctWords,
        dayNumber,
        alreadyPlayed: existing.gameOver,
      });
      return;
    }

    const newState = {
      selectedWords: [] as string[],
      correctWords: [] as string[],
      triesLeft: 6,
      gameOver: false,
      won: false,
    };
    stateStore.set(stateKey, newState);

    res.json({
      emojis: movie.emojis,
      wordCloud,
      titleHashes,
      salt,
      encryptedMovie,
      triesLeft: 6,
      gameOver: false,
      won: false,
      selectedWords: [],
      correctWords: [],
      dayNumber,
      alreadyPlayed: false,
    });
  } catch (err) {
    console.error('Error in /api/game/daily:', err);
    res.status(500).json({ status: 'error', message: String(err) });
  }
});

// Mock /api/game/sync
app.post('/api/game/sync', (req, res) => {
  try {
    const { selectedWords, correctWords, triesLeft, gameOver, won, testDay, date } = req.body;
    const dayKey = testDay ? `test-day-${testDay}` : `date-${date ?? new Date().toISOString().slice(0, 10)}`;
    stateStore.set(getStateKey(dayKey), {
      selectedWords: selectedWords ?? [],
      correctWords: correctWords ?? [],
      triesLeft: triesLeft ?? 6,
      gameOver: gameOver ?? false,
      won: won ?? false,
    });
    res.json({ status: 'ok' });
  } catch {
    res.status(500).json({ status: 'error' });
  }
});

// Mock /api/game/stats
app.get('/api/game/stats', (_req, res) => {
  res.json({
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    winRate: 0,
  });
});

// Static files
app.use(express.static(clientDir));

app.get('/', (_req, res) => {
  res.redirect('/game.html');
});

function tryListen(port: number): import('http').Server {
  const server = app.listen(port, () => {
    console.log(`\n🎬 Kinoticon preview: http://localhost:${port}/game.html`);
    console.log(`   Day N: http://localhost:${port}/game.html?day=6`);
    console.log(`   Or set localStorage kinoticon-testDay=6 and reload\n`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && port < 5180) {
      server.close();
      tryListen(port + 1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
  return server;
}
const server = tryListen(PORT_START);

// Keep process alive (workaround for Windows/concurrently early exit)
const keepAlive = setInterval(() => {}, 86400000);

process.on('SIGTERM', () => {
  clearInterval(keepAlive);
  process.exit(0);
});
