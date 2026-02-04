import express from 'express';
import type { DailyGameResponse, GuessResponse, StatsResponse, PlayerStats } from '../shared/types/game';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { getDailyMovie } from '../shared/data/movies';
import { generateWordCloud, isWordInTitle, checkWinCondition } from '../shared/utils/wordCloud';

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

// Initialize/Get daily game state
router.get<object, DailyGameResponse | { status: string; message: string }>(
  '/api/game/daily',
  async (_req, res): Promise<void> => {
    try {
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const dayKey = getDayKey();
      const playerStateKey = getPlayerStateKey(userId, dayKey);
      
      // Get today's movie
      const { movie, dayNumber } = getDailyMovie();
      const wordCloud = generateWordCloud(movie, dayNumber);
      
      // Check if player already has state for today
      const existingState = await redis.get(playerStateKey);
      
      if (existingState) {
        const state = JSON.parse(existingState);
        res.json({
          emojis: movie.emojis,
          wordCloud,
          triesLeft: state.triesLeft,
          gameOver: state.gameOver,
          won: state.won,
          selectedWords: state.selectedWords,
          dayNumber,
          alreadyPlayed: state.gameOver,
          movieTitle: state.gameOver ? movie.title : undefined,
          movieYear: state.gameOver ? movie.year : undefined,
        });
        return;
      }
      
      // New game state
      const newState = {
        triesLeft: 6,
        gameOver: false,
        won: false,
        selectedWords: [] as string[],
      };
      
      await redis.set(playerStateKey, JSON.stringify(newState));
      
      res.json({
        emojis: movie.emojis,
        wordCloud,
        triesLeft: 6,
        gameOver: false,
        won: false,
        selectedWords: [],
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

// Make a guess
router.post<object, GuessResponse | { status: string; message: string }>(
  '/api/game/guess',
  async (req, res): Promise<void> => {
    try {
      const { word } = req.body as { word: string };
      
      if (!word) {
        res.status(400).json({ status: 'error', message: 'Word is required' });
        return;
      }
      
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const dayKey = getDayKey();
      const playerStateKey = getPlayerStateKey(userId, dayKey);
      
      // Get today's movie
      const { movie, dayNumber } = getDailyMovie();
      
      // Get current state
      const existingState = await redis.get(playerStateKey);
      if (!existingState) {
        res.status(400).json({ status: 'error', message: 'Game not initialized' });
        return;
      }
      
      const state = JSON.parse(existingState);
      
      if (state.gameOver) {
        res.json({
          correct: false,
          triesLeft: state.triesLeft,
          gameOver: true,
          won: state.won,
          movieTitle: movie.title,
          movieYear: movie.year,
        });
        return;
      }
      
      // Check if word is correct
      const isCorrect = isWordInTitle(word, movie);
      
      // Add to selected words if not already there
      if (!state.selectedWords.includes(word.toLowerCase())) {
        state.selectedWords.push(word.toLowerCase());
      }
      
      if (!isCorrect) {
        state.triesLeft--;
      }
      
      // Check win condition
      if (isCorrect && checkWinCondition(state.selectedWords, movie)) {
        state.gameOver = true;
        state.won = true;
        await updatePlayerStats(userId, true, dayNumber);
      } else if (state.triesLeft <= 0) {
        state.gameOver = true;
        state.won = false;
        await updatePlayerStats(userId, false, dayNumber);
      }
      
      // Save state
      await redis.set(playerStateKey, JSON.stringify(state));
      
      res.json({
        correct: isCorrect,
        triesLeft: state.triesLeft,
        gameOver: state.gameOver,
        won: state.won,
        movieTitle: state.gameOver ? movie.title : undefined,
        movieYear: state.gameOver ? movie.year : undefined,
      });
    } catch (error) {
      console.error('Error making guess:', error);
      res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to make guess',
      });
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
      const winRate = stats.gamesPlayed > 0 
        ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) 
        : 0;
      
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

// Helper to update player stats
async function updatePlayerStats(userId: string, won: boolean, dayNumber: number): Promise<void> {
  const statsKey = getPlayerStatsKey(userId);
  const statsData = await redis.get(statsKey);
  
  let stats: PlayerStats = statsData 
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

app.use(router);

const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
