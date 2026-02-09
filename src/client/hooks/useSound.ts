import { useCallback, useEffect, useRef, useState } from 'react';

// SND01 "sine" pack from snd.dev - local WAV files
const SOUND_URLS = {
  tap: ['/tap_01.wav', '/tap_02.wav', '/tap_03.wav', '/tap_04.wav', '/tap_05.wav'],
  type: ['/type_01.wav', '/type_02.wav', '/type_03.wav', '/type_04.wav', '/type_05.wav'],
  select: '/select.wav',
  caution: '/caution.wav',
  celebration: '/celebration.wav',
  button: '/button.wav',
  transition_up: '/transition_up.wav',
  transition_down: '/transition_down.wav',
  toggle_on: '/toggle_on.wav',
  toggle_off: '/toggle_off.wav',
} as const;

export function useSound() {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem('soundEnabled');
    return stored !== 'false';
  });

  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const themeToggleStateRef = useRef<'on' | 'off'>('off');

  // Preload audio elements for SND01 sounds we use
  useEffect(() => {
    const urls = [
      ...SOUND_URLS.tap,
      ...SOUND_URLS.type,
      SOUND_URLS.select,
      SOUND_URLS.caution,
      SOUND_URLS.celebration,
      SOUND_URLS.button,
      SOUND_URLS.transition_up,
      SOUND_URLS.transition_down,
      SOUND_URLS.toggle_on,
      SOUND_URLS.toggle_off,
    ];
    urls.forEach((url) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = 0.5;
      // Handle load errors
      audio.addEventListener('error', () => {
        console.warn('Failed to load sound:', url);
      });
      audioRefs.current[url] = audio;
    });

    return () => {
      Object.values(audioRefs.current).forEach((a) => {
        a.pause();
        a.src = '';
      });
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('soundEnabled', String(enabled));
  }, [enabled]);

  const play = useCallback(
    (url: string) => {
      if (!enabled) return;
      const audio = audioRefs.current[url];
      if (!audio) return;
      try {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } catch {}
    },
    [enabled]
  );

  const playTap = useCallback(() => {
    const urls = SOUND_URLS.tap;
    const url = urls[Math.floor(Math.random() * urls.length)];
    play(url);
  }, [play]);

  const playType = useCallback(() => {
    if (!enabled) return;
    const urls = SOUND_URLS.type;
    const url = urls[Math.floor(Math.random() * urls.length)];
    try {
      // Create new Audio element for each keystroke to allow overlapping sounds
      const audio = new Audio(url);
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Silent fail - autoplay may be blocked
      });
    } catch (err) {
      // Silent fail
    }
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((prev) => !prev), []);

  return {
    enabled,
    toggle,
    loaded: true,
    playClick: playTap,
    playCorrect: useCallback(() => play(SOUND_URLS.select), [play]),
    playWrong: useCallback(() => play(SOUND_URLS.caution), [play]),
    playWin: useCallback(() => play(SOUND_URLS.celebration), [play]),
    playLose: useCallback(() => play(SOUND_URLS.caution), [play]),
    playUISound: useCallback(() => play(SOUND_URLS.button), [play]),
    playUIMenu: useCallback(() => play(SOUND_URLS.transition_up), [play]),
    playUITheme: useCallback(() => {
      const state = themeToggleStateRef.current;
      play(state === 'on' ? SOUND_URLS.toggle_off : SOUND_URLS.toggle_on);
      themeToggleStateRef.current = state === 'on' ? 'off' : 'on';
    }, [play]),
    playUIFullscreen: useCallback(() => play(SOUND_URLS.transition_up), [play]),
    playUIStats: useCallback(() => play(SOUND_URLS.transition_up), [play]),
    playUIClose: useCallback(() => play(SOUND_URLS.transition_down), [play]),
    playUIType: playType,
  };
}
