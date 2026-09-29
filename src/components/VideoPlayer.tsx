import React, { useRef, useEffect, useState } from 'react';
import {
  BUNDLED_LOGO_DATA_URL,
  BUNDLED_LEHENGA_IMG_1_DATA_URL,
  BUNDLED_LEHENGA_IMG_2_DATA_URL,
  BUNDLED_VIDEO_MP4_BASE64,
} from '../data/bundledAssets';
import { resolveCloudMediaUrl } from '../services/firebaseSyncService';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  fallbackSrc?: string;
}

let cachedBundledVideoBlobUrl: string | null = null;

export function getBundledVideoBlobUrl(): string {
  if (cachedBundledVideoBlobUrl) return cachedBundledVideoBlobUrl;
  try {
    const binary = atob(BUNDLED_VIDEO_MP4_BASE64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'video/mp4' });
    cachedBundledVideoBlobUrl = URL.createObjectURL(blob);
    return cachedBundledVideoBlobUrl;
  } catch {
    return '/lehenga-reel.mp4';
  }
}

/**
 * Resolves video and poster paths without overwriting newly uploaded videos or photos.
 */
export function resolvePublicVideoPath(rawSrc: string): string {
  if (!rawSrc) return getBundledVideoBlobUrl();
  const trimmed = rawSrc.trim();

  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('cloud-media://')
  ) {
    return trimmed;
  }

  // Only match the exact initial seed logo/image filenames, never new uploads
  if (
    trimmed.includes('logo-top-1790531566115-6ys4f') ||
    trimmed.includes('logo-bottom-1790531569272-mgmg7')
  ) {
    return BUNDLED_LOGO_DATA_URL;
  }

  if (trimmed.includes('lehenga-img-1-1790531510903-9ca8r')) {
    return BUNDLED_LEHENGA_IMG_1_DATA_URL;
  }

  if (trimmed.includes('lehenga-img-2-1790531542661-de25a')) {
    return BUNDLED_LEHENGA_IMG_2_DATA_URL;
  }

  if (trimmed === '/uploads/hero-poster.jpg' || trimmed === 'uploads/hero-poster.jpg') {
    return '/hero-poster.jpg';
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const cleaned = trimmed
    .replace(/^(\.\/)+/, '')
    .replace(/^public\//i, '')
    .replace(/^\/+/, '');

  if (cleaned.startsWith('uploads/') && /\.mp4$/i.test(cleaned)) {
    return `/${cleaned}?v=h264`;
  }

  return `/${cleaned}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  className = 'w-full h-full object-cover',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentSrc, setCurrentSrc] = useState<string>(() => {
    const initial = resolvePublicVideoPath(src);
    return initial.startsWith('cloud-media://') ? '' : initial;
  });
  const resolvedPoster = poster ? resolvePublicVideoPath(poster) : undefined;

  useEffect(() => {
    let active = true;
    const resolved = resolvePublicVideoPath(src);
    if (resolved.startsWith('cloud-media://')) {
      resolveCloudMediaUrl(resolved).then((blobUrl) => {
        if (!active) return;
        if (blobUrl && !blobUrl.startsWith('cloud-media://')) {
          setCurrentSrc(blobUrl);
        } else {
          setCurrentSrc(getBundledVideoBlobUrl());
        }
      });
    } else {
      setCurrentSrc(resolved);
    }
    return () => {
      active = false;
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSrc) return;

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

  if (!currentSrc) {
    return <div className={className} />;
  }

  return (
    <video
      ref={videoRef}
      key={currentSrc}
      src={currentSrc}
      poster={resolvedPoster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        v.muted = true;
        v.play().catch(() => {});
      }}
      onCanPlay={(e) => {
        const v = e.currentTarget;
        if (v.paused) {
          v.muted = true;
          v.play().catch(() => {});
        }
      }}
      className={className}
    />
  );
};
