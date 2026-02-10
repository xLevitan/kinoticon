import express from 'express';
import type {
  DailyGameResponse,
  StatsResponse,
  PlayerStats,
  LeaderboardResponse,
} from '../shared/types/game';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { getDailyMovie } from '../shared/data/movies';
import {
  generateWordCloud,
  generateTitleHashes,
  encryptMovieInfo,
} from '../shared/utils/wordCloud';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

const router = express.Router();

// Helper to get current day key
function getDayKey(): string {
  const today = new Date();
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
}

// Helper to get player state key
function getPlayerStateKey(userId: string, dayKey: string): string {
  return `player:${userId}:${dayKey}`;
}

// Helper to get player stats key
function getPlayerStatsKey(userId: string): string {
  return `stats:${userId}`;
}

const LEADERBOARD_KEY = 'leaderboard:list';
const LEADERBOARD_MAX = 500;
const TOP_N = 100;
const AROUND_HALF = 4;

type LeaderboardRow = {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
};

async function getLeaderboardList(): Promise<LeaderboardRow[]> {
  const raw = await redis.get(LEADERBOARD_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LeaderboardRow[];
  } catch {
    return [];
  }
}

function sortLeaderboard(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    return (b.winRate ?? 0) - (a.winRate ?? 0);
  });
}

async function updateLeaderboardEntry(userId: string, stats: PlayerStats): Promise<void> {
  const winRate =
    stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  const rows = await getLeaderboardList();
  const idx = rows.findIndex((r) => r.userId === userId);
  const row: LeaderboardRow = {
    userId,
    gamesPlayed: stats.gamesPlayed,
    gamesWon: stats.gamesWon,
    winRate,
    currentStreak: stats.currentStreak,
    maxStreak: stats.maxStreak,
  };
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  const sorted = sortLeaderboard(rows).slice(0, LEADERBOARD_MAX);
  await redis.set(LEADERBOARD_KEY, JSON.stringify(sorted));
}

async function removeFromLeaderboard(userId: string): Promise<void> {
  const rows = await getLeaderboardList();
  const filtered = rows.filter((r) => r.userId !== userId);
  if (filtered.length === rows.length) return;
  await redis.set(LEADERBOARD_KEY, JSON.stringify(filtered));
}

const POST_DAY_KEY_PREFIX = 'post:day:';

/** Resolve day for this request: postId (stored when post was created) > testDay > date > UTC day. */
async function resolveDayForRequest(opts: {
  postId?: string | null;
  testDay?: number;
  date?: string | null;
}): Promise<{
  dayNumber: number;
  dayKey: string;
  movie: ReturnType<typeof getDailyMovie>['movie'];
}> {
  if (opts.postId) {
    const stored = await redis.get(POST_DAY_KEY_PREFIX + opts.postId);
    if (stored) {
      const dayNum = parseInt(stored, 10);
      if (!Number.isNaN(dayNum)) {
        const result = getDailyMovie(dayNum);
        return { dayNumber: result.dayNumber, dayKey: `post-day-${dayNum}`, movie: result.movie };
      }
    }
  }
  const testDay = opts.testDay;
  const dateParam = opts.date ?? undefined;
  const override: number | string | undefined = testDay ?? dateParam;
  const { movie, dayNumber } = getDailyMovie(override);
  const dayKey = testDay ? `test-day-${testDay}` : dateParam || getDayKey();
  return { dayNumber, dayKey, movie };
}

// Expose post context so client can send postId and we show this post’s day (not “today”)
router.get<object, { postId?: string; isDevSubreddit: boolean }>(
  '/api/context',
  async (_req, res): Promise<void> => {
    const ctx = context as { postId?: string; subredditName?: string };
    const isDevSubreddit = (ctx.subredditName ?? '').endsWith('_dev');
    res.json({
      ...(ctx.postId ? { postId: ctx.postId } : {}),
      isDevSubreddit,
    });
  }
);

// Reset 7-day test counter (callable from dev menu in game; dev sub only)
router.post<object, { status: string; message?: string }>(
  '/api/dev/reset-7-day-test',
  async (_req, res): Promise<void> => {
    try {
      const sub = (context as { subredditName?: string }).subredditName ?? '';
      if (!sub.endsWith('_dev')) {
        res.json({ status: 'skipped', message: 'Only on dev subreddit' });
        return;
      }
      const counterKey = 'scheduler:daily-post-test:count';
      await redis.del(counterKey);
      res.json({
        status: 'success',
        message: 'Counter reset. Scheduler will create Day 1..7 over the next 7 minutes.',
      });
    } catch (error) {
      console.error('Error resetting 7-day test:', error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to reset',
      });
    }
  }
);

// Reset developer stats (dev sub only)
router.post<object, { status: string; message?: string }>(
  '/api/dev/reset-stats',
  async (_req, res): Promise<void> => {
    try {
      const sub = (context as { subredditName?: string }).subredditName ?? '';
      if (!sub.endsWith('_dev')) {
        res.json({ status: 'skipped', message: 'Only on dev subreddit' });
        return;
      }
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const statsKey = getPlayerStatsKey(userId);
      await redis.del(statsKey);
      await removeFromLeaderboard(userId);
      res.json({ status: 'success', message: 'Stats reset.' });
    } catch (error) {
      console.error('Error resetting stats:', error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to reset stats',
      });
    }
  }
);

// Reset current day result for dev account (dev sub only)
router.post<object, { status: string; message?: string }>(
  '/api/dev/reset-day-result',
  async (req, res): Promise<void> => {
    try {
      const sub = (context as { subredditName?: string }).subredditName ?? '';
      if (!sub.endsWith('_dev')) {
        res.json({ status: 'skipped', message: 'Only on dev subreddit' });
        return;
      }
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const body = req.body as { postId?: string; testDay?: number; date?: string };
      const postId = typeof body.postId === 'string' ? body.postId : null;
      const testDay = typeof body.testDay === 'number' ? body.testDay : undefined;
      const dateParam =
        typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
      const resolveOpts: Parameters<typeof resolveDayForRequest>[0] = {
        postId,
        date: dateParam,
      };
      if (testDay !== undefined) resolveOpts.testDay = testDay;
      const resolved = await resolveDayForRequest(resolveOpts);
      const playerStateKey = getPlayerStateKey(userId, resolved.dayKey);
      await redis.del(playerStateKey);
      res.json({
        status: 'success',
        message: 'Day result reset. Reload to play again.',
      });
    } catch (error) {
      console.error('Error resetting day result:', error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to reset',
      });
    }
  }
);

// Initialize/Get daily game state
router.get<object, DailyGameResponse | { status: string; message: string }>(
  '/api/game/daily',
  async (req, res): Promise<void> => {
    try {
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';

      const postId =
        (typeof req.query.postId === 'string' && req.query.postId) ||
        (context as { postId?: string }).postId;
      const testDay = req.query.testDay ? parseInt(req.query.testDay as string, 10) : undefined;
      const dateParam =
        typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
          ? req.query.date
          : undefined;

      const resolveOpts: Parameters<typeof resolveDayForRequest>[0] = {
        postId: postId ?? null,
        date: dateParam ?? null,
      };
      if (testDay !== undefined) resolveOpts.testDay = testDay;
      const resolved = await resolveDayForRequest(resolveOpts);
      const { movie, dayNumber, dayKey } = resolved;
      const playerStateKey = getPlayerStateKey(userId, dayKey);

      const wordCloud = generateWordCloud(movie, dayNumber);

      // Generate title hashes for client-side verification
      const salt = dayKey; // Use day as salt
      const titleHashes = generateTitleHashes(movie, salt);

      // Encrypt movie info for client-side reveal (instant display on game over)
      const encryptedMovie = encryptMovieInfo(movie.title, movie.year, salt);

      // Check if player already has state for today
      const existingState = await redis.get(playerStateKey);

      if (existingState) {
        const state = JSON.parse(existingState);
        res.json({
          emojis: movie.emojis,
          wordCloud,
          titleHashes,
          salt,
          encryptedMovie,
          triesLeft: state.triesLeft ?? 6,
          gameOver: state.gameOver ?? false,
          won: state.won ?? false,
          selectedWords: state.selectedWords ?? [],
          correctWords: state.correctWords ?? [],
          dayNumber,
          alreadyPlayed: state.gameOver,
        });
        return;
      }

      // New game state
      const newState = {
        triesLeft: 6,
        gameOver: false,
        won: false,
        selectedWords: [] as string[],
        correctWords: [] as string[],
      };

      await redis.set(playerStateKey, JSON.stringify(newState));

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
    } catch (error) {
      console.error('Error getting daily game:', error);
      res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get daily game',
      });
    }
  }
);

// Sync game state (client validates locally, server saves)
router.post<object, { status: string; movieTitle?: string; movieYear?: number }>(
  '/api/game/sync',
  async (req, res): Promise<void> => {
    try {
      const {
        selectedWords,
        correctWords,
        triesLeft,
        gameOver,
        won,
        testDay: bodyTestDay,
        date: bodyDate,
        postId: bodyPostId,
      } = req.body as {
        selectedWords: string[];
        correctWords: string[];
        triesLeft: number;
        gameOver: boolean;
        won: boolean;
        testDay?: number;
        date?: string;
        postId?: string;
      };

      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';

      const postId =
        bodyPostId ||
        (typeof req.query.postId === 'string' ? req.query.postId : undefined) ||
        (context as { postId?: string }).postId;
      const testDay =
        bodyTestDay ?? (req.query.testDay ? parseInt(req.query.testDay as string, 10) : undefined);
      const dateParam =
        typeof bodyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bodyDate) ? bodyDate : undefined;
      const resolveOpts: Parameters<typeof resolveDayForRequest>[0] = {
        postId: postId ?? null,
        date: dateParam ?? null,
      };
      if (testDay !== undefined) resolveOpts.testDay = testDay;
      const resolved = await resolveDayForRequest(resolveOpts);
      const { movie, dayNumber, dayKey } = resolved;
      const playerStateKey = getPlayerStateKey(userId, dayKey);

      // Save state
      const state = {
        selectedWords,
        correctWords,
        triesLeft,
        gameOver,
        won,
      };

      await redis.set(playerStateKey, JSON.stringify(state));

      // Update stats if game ended
      if (gameOver) {
        await updatePlayerStats(userId, won, dayNumber);
      }

      res.json(
        gameOver
          ? { status: 'ok', movieTitle: movie.title, movieYear: movie.year }
          : { status: 'ok' }
      );
    } catch (error) {
      console.error('Error making guess:', error);
      res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to make guess',
      } as { status: string; message: string });
    }
  }
);

// Get player stats
router.get<object, StatsResponse | { status: string; message: string }>(
  '/api/game/stats',
  async (_req, res): Promise<void> => {
    try {
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const statsKey = getPlayerStatsKey(userId);

      const statsData = await redis.get(statsKey);

      if (!statsData) {
        res.json({
          gamesPlayed: 0,
          gamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          winRate: 0,
        });
        return;
      }

      const stats: PlayerStats = JSON.parse(statsData);
      const winRate =
        stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

      res.json({
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        currentStreak: stats.currentStreak,
        maxStreak: stats.maxStreak,
        winRate,
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get stats',
      });
    }
  }
);

// Get leaderboard: top 100 + 8 around current user
router.get<object, LeaderboardResponse | { status: string; message: string }>(
  '/api/game/leaderboard',
  async (_req, res): Promise<void> => {
    try {
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const statsKey = getPlayerStatsKey(userId);
      const statsData = await redis.get(statsKey);
      if (statsData) {
        const stats = JSON.parse(statsData) as PlayerStats;
        await updateLeaderboardEntry(userId, stats);
      }
      const rows = await getLeaderboardList();
      const sorted = sortLeaderboard(rows);
      const top100 = sorted.slice(0, TOP_N).map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        gamesPlayed: r.gamesPlayed,
        gamesWon: r.gamesWon,
        winRate: r.winRate,
        currentStreak: r.currentStreak,
        maxStreak: r.maxStreak,
      }));
      const myIdx = sorted.findIndex((r) => r.userId === userId);
      const myRank = myIdx >= 0 ? myIdx + 1 : null;
      let aroundMe: typeof top100 = [];
      if (myRank !== null) {
        const start = Math.max(0, myIdx - AROUND_HALF);
        const end = Math.min(sorted.length, myIdx + AROUND_HALF + 1);
        aroundMe = sorted.slice(start, end).map((r, i) => ({
          rank: start + i + 1,
          userId: r.userId,
          gamesPlayed: r.gamesPlayed,
          gamesWon: r.gamesWon,
          winRate: r.winRate,
          currentStreak: r.currentStreak,
          maxStreak: r.maxStreak,
        }));
      }
      res.json({ top100, aroundMe, myRank });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get leaderboard',
      });
    }
  }
);

// Helper to update player stats
async function updatePlayerStats(userId: string, won: boolean, dayNumber: number): Promise<void> {
  const statsKey = getPlayerStatsKey(userId);
  const statsData = await redis.get(statsKey);

  const stats: PlayerStats = statsData
    ? JSON.parse(statsData)
    : {
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        lastPlayedDay: 0,
      };

  stats.gamesPlayed++;

  if (won) {
    stats.gamesWon++;

    // Check if this continues a streak (played yesterday or first game)
    if (stats.lastPlayedDay === dayNumber - 1 || stats.lastPlayedDay === 0) {
      stats.currentStreak++;
    } else {
      stats.currentStreak = 1;
    }

    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }

  stats.lastPlayedDay = dayNumber;

  await redis.set(statsKey, JSON.stringify(stats));
  await updateLeaderboardEntry(userId, stats);
}

// Create post on app install
router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();
    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Create post from menu
router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();
    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Scheduled job: Create daily post automatically at 00:00 UTC
router.post('/internal/scheduler/daily-post', async (_req, res): Promise<void> => {
  try {
    const dayKey = getDayKey();
    const schedulerKey = `scheduler:daily-post:${dayKey}`;

    // Check if we already created a post today (idempotency)
    const alreadyCreated = await redis.get(schedulerKey);
    if (alreadyCreated) {
      console.log(`Daily post already created for ${dayKey}, skipping`);
      res.json({
        status: 'skipped',
        message: `Post already created for ${dayKey}`,
        postId: alreadyCreated,
      });
      return;
    }

    const post = await createPost();
    const { dayNumber: dayNum } = getDailyMovie();
    await redis.set(POST_DAY_KEY_PREFIX + post.id, String(dayNum), {
      EX: 86400 * 400,
    } as Parameters<typeof redis.set>[2]); // ~1 year
    await redis.set(schedulerKey, post.id, { EX: 90000 } as Parameters<typeof redis.set>[2]);

    console.log(`Daily post created successfully: ${post.id} (Day ${dayNum})`);
    res.json({
      status: 'success',
      postId: post.id,
      dayKey,
    });
  } catch (error) {
    console.error(`Error in scheduled daily-post: ${error}`);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create daily post',
    });
  }
});

// Test scheduler: one post per minute on dev sub only, 7 “days” (Day 1..7)
const TEST_SUBREDDIT_SUFFIX = '_dev';
const TEST_DAYS_MAX = 7;
router.post('/internal/scheduler/daily-post-test', async (_req, res): Promise<void> => {
  try {
    const sub = context.subredditName ?? '';
    if (!sub.endsWith(TEST_SUBREDDIT_SUFFIX)) {
      res.json({
        status: 'skipped',
        message: 'Only runs on dev subreddit',
      });
      return;
    }
    const counterKey = 'scheduler:daily-post-test:count';
    const raw = await redis.get(counterKey);
    const count = raw ? parseInt(raw, 10) + 1 : 1;
    if (count > TEST_DAYS_MAX) {
      res.json({
        status: 'skipped',
        message: `Test run complete (${TEST_DAYS_MAX} days)`,
        count,
      });
      return;
    }
    await redis.set(counterKey, String(count), { EX: 600 } as Parameters<typeof redis.set>[2]);
    const post = await createPost(count);
    await redis.set(POST_DAY_KEY_PREFIX + post.id, String(count), { EX: 600 } as Parameters<
      typeof redis.set
    >[2]);
    console.log(`Test daily post ${count}/${TEST_DAYS_MAX} created: ${post.id}`);
    res.json({
      status: 'success',
      postId: post.id,
      dayNumber: count,
    });
  } catch (error) {
    console.error('Error in daily-post-test:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create test post',
    });
  }
});

// Reset 7-day test counter so scheduler can create Day 1..7 again (dev sub only)
router.post('/internal/menu/reset-7-day-test', async (_req, res): Promise<void> => {
  try {
    const sub = context.subredditName ?? '';
    if (!sub.endsWith(TEST_SUBREDDIT_SUFFIX)) {
      res.json({
        status: 'skipped',
        message: 'Only on dev subreddit',
      });
      return;
    }
    const counterKey = 'scheduler:daily-post-test:count';
    await redis.del(counterKey);
    console.log('7-day test counter reset');
    res.json({
      status: 'success',
      message: 'Counter reset. Scheduler will create Day 1..7 over the next 7 minutes.',
      navigateTo: `https://reddit.com/r/${sub}`,
    });
  } catch (error) {
    console.error('Error resetting 7-day test:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to reset',
    });
  }
});

app.use(router);

const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
