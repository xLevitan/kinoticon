import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAssetUrl } from '../utils/assetUrl';

// SND01 "sine" pack from snd.dev - local WAV files (paths resolved via getAssetUrl for webview)
const SOUND_PATHS = {
  tap: ['tap_01.wav', 'tap_02.wav', 'tap_03.wav', 'tap_04.wav', 'tap_05.wav'],
  type: ['type_01.wav', 'type_02.wav', 'type_03.wav', 'type_04.wav', 'type_05.wav'],
  select: 'select.wav',
  caution: 'caution.wav',
  celebration: 'celebration.wav',
  button: 'button.wav',
  transition_up: 'transition_up.wav',
  transition_down: 'transition_down.wav',
  toggle_on: 'toggle_on.wav',
  toggle_off: 'toggle_off.wav',
} as const;

function resolveSoundUrls(): {
  tap: readonly string[];
  type: readonly string[];
  select: string;
  caution: string;
  celebration: string;
  button: string;
  transition_up: string;
  transition_down: string;
  toggle_on: string;
  toggle_off: string;
} {
  return {
    tap: SOUND_PATHS.tap.map((p) => getAssetUrl(p)),
    type: SOUND_PATHS.type.map((p) => getAssetUrl(p)),
    select: getAssetUrl(SOUND_PATHS.select),
    caution: getAssetUrl(SOUND_PATHS.caution),
    celebration: getAssetUrl(SOUND_PATHS.celebration),
    button: getAssetUrl(SOUND_PATHS.button),
    transition_up: getAssetUrl(SOUND_PATHS.transition_up),
    transition_down: getAssetUrl(SOUND_PATHS.transition_down),
    toggle_on: getAssetUrl(SOUND_PATHS.toggle_on),
    toggle_off: getAssetUrl(SOUND_PATHS.toggle_off),
  };
}

export function useSound() {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem('soundEnabled');
    return stored !== 'false';
  });

  const SOUND_URLS = useMemo(() => resolveSoundUrls(), []);
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

    const refsToClean = audioRefs.current;
    return () => {
      Object.values(refsToClean).forEach((a) => {
        a.pause();
        a.src = '';
      });
    };
  }, [SOUND_URLS]);

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
      } catch {
        // Ignore play errors
      }
    },
    [enabled]
  );

  const playTap = useCallback(() => {
    const urls = SOUND_URLS.tap;
    const url = urls[Math.floor(Math.random() * urls.length)];
    if (url) play(url);
  }, [play]);

  const playType = useCallback(() => {
    if (!enabled) return;
    const urls = SOUND_URLS.type;
    const url = urls[Math.floor(Math.random() * urls.length)];
    if (!url) return;
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
