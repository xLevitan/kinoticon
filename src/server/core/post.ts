import { reddit } from '@devvit/web/server';
import { getDailyMovie } from '../../shared/data/movies';

/** Create a daily post. overrideDay = 1..7 for test (dev sub). startDate: dev=today, release=Redis. */
export const createPost = async (
  overrideDay?: number,
  startDate?: string
): Promise<{ id: string }> => {
  const { dayNumber } =
    overrideDay != null ? getDailyMovie(overrideDay, startDate) : getDailyMovie(undefined, startDate);
  return await reddit.submitCustomPost({
    title: `🎬 Kinoticon - Day ${dayNumber} - Guess the Movie from Emojis!`,
  });
};
