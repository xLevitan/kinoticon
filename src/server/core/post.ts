import { reddit } from '@devvit/web/server';
import { getDailyMovie } from '../../shared/data/movies';

export const createPost = async () => {
  const { dayNumber } = getDailyMovie();
  
  return await reddit.submitCustomPost({
    title: `🎬 Kinoticon - Day ${dayNumber} - Guess the Movie from Emojis!`,
  });
};
