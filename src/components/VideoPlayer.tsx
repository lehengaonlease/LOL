import React, { useRef, useEffect, useState } from 'react';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  fallbackSrc?: string;
}

/**
 * Normalizes a video path so files stored in Vite's `public/` directory
 * are always referenced via an absolute root path (e.g. `/lehenga-reel.mp4`).
 */
export function resolvePublicVideoPath(rawSrc: string): string {
  if (!rawSrc) return '/lehenga-reel.mp4';
  const trimmed = rawSrc.trim();

  // Keep external http(s), blob:, or data: URLs intact
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  // Strip accidental "public/" or "./" prefixes
  const cleaned = trimmed
    .replace(/^(\.\/)+/, '')
    .replace(/^public\//i, '')
    .replace(/^\/+/, '');

  return `/${cleaned}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  className = 'w-full h-full object-cover',
  fallbackSrc,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const normalizedPrimary = resolvePublicVideoPath(src);
  const [currentSrc, setCurrentSrc] = useState<string>(normalizedPrimary);
  const [triedFallback, setTriedFallback] = useState(false);

  useEffect(() => {
    setCurrentSrc(resolvePublicVideoPath(src));
    setTriedFallback(false);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Explicitly set DOM properties & attributes for iOS Safari / Android Chrome autoplay policies
    video.defaultMuted = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('loop', '');

    const attemptPlay = async () => {
      if (!video) return;
      try {
        video.muted = true;
        await video.play();
      } catch {
        video.muted = true;
        video.play().catch(() => {});
      }
    };

    attemptPlay();

    // Resume playback when scrolling into viewport on mobile-first layouts
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && video.paused) {
              video.muted = true;
              video.play().catch(() => {});
            }
          });
        },
        { threshold: 0.15 }
      );
      observer.observe(video);
    }

    // Unlock playback on first mobile touch/scroll interaction if browser deferred autoplay
    const unlockOnInteraction = () => {
      if (video && video.paused) {
        video.muted = true;
        video.play().catch(() => {});
      }
    };

    window.addEventListener('touchstart', unlockOnInteraction, { passive: true });
    window.addEventListener('scroll', unlockOnInteraction, { passive: true });
    window.addEventListener('click', unlockOnInteraction, { passive: true });

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('touchstart', unlockOnInteraction);
      window.removeEventListener('scroll', unlockOnInteraction);
      window.removeEventListener('click', unlockOnInteraction);
    };
  }, [currentSrc]);

  const handleVideoError = () => {
    if (triedFallback) return;
    setTriedFallback(true);

    // Strip query string or fallback to root public video if /uploads path fails on static host
    const withoutQuery = currentSrc.split('?')[0];
    if (withoutQuery !== currentSrc) {
      setCurrentSrc(withoutQuery);
      return;
    }

    if (fallbackSrc) {
      setCurrentSrc(resolvePublicVideoPath(fallbackSrc));
      return;
    }

    if (currentSrc.includes('hero')) {
      setCurrentSrc('/hero-banner.mp4');
    } else if (currentSrc !== '/lehenga-reel.mp4') {
      setCurrentSrc('/lehenga-reel.mp4');
    }
  };

  return (
    <video
      ref={videoRef}
      key={currentSrc}
      src={currentSrc}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onLoadedData={(e) => {
        e.currentTarget.muted = true;
        e.currentTarget.play().catch(() => {});
      }}
      onCanPlay={(e) => {
        e.currentTarget.muted = true;
        e.currentTarget.play().catch(() => {});
      }}
      onError={handleVideoError}
      className={className}
    />
  );
};
