import React, { useState, useEffect, useRef } from 'react';
import {
  BUNDLED_LOGO_DATA_URL,
  BUNDLED_LEHENGA_IMG_1_DATA_URL,
  BUNDLED_LEHENGA_IMG_2_DATA_URL,
} from '../data/bundledAssets';
import { resolveCloudMediaUrl } from '../services/firebaseSyncService';

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  priority?: boolean;
  isLogo?: boolean;
}

/**
 * Global path resolver for images and logos in Vite + Vercel production builds.
 * Only maps the exact initial seed filenames to bundled data URLs so newly uploaded
 * images are never overwritten by the default yellow lehenga image.
 */
export function resolveOptimizedImagePath(rawSrc?: string, isLogo = false): string {
  if (!rawSrc || !rawSrc.trim()) {
    return isLogo ? BUNDLED_LOGO_DATA_URL : BUNDLED_LEHENGA_IMG_1_DATA_URL;
  }

  const trimmed = rawSrc.trim();

  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('cloud-media://')
  ) {
    return trimmed;
  }

  // Only match the exact initial default logo files, NOT new uploads
  if (
    trimmed.includes('logo-top-1790531566115-6ys4f') ||
    trimmed.includes('logo-bottom-1790531569272-mgmg7')
  ) {
    return BUNDLED_LOGO_DATA_URL;
  }

  // Only match the exact initial default product photos, NOT new uploads
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

  // Normalize relative or `public/` paths to root-relative `/...`
  const cleaned = trimmed
    .replace(/^(\.\/)+/, '')
    .replace(/^public\//i, '')
    .replace(/^\/+/, '');

  return `/${cleaned}`;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  fallbackSrc,
  priority = false,
  isLogo = false,
  className = '',
  style,
  ...rest
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const resolvedPrimary = resolveOptimizedImagePath(src, isLogo);
  const [currentSrc, setCurrentSrc] = useState<string>(
    resolvedPrimary.startsWith('cloud-media://')
      ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      : resolvedPrimary
  );
  const [hasTriedFallback, setHasTriedFallback] = useState(false);

  useEffect(() => {
    let active = true;
    const nextResolved = resolveOptimizedImagePath(src, isLogo);
    setHasTriedFallback(false);
    if (nextResolved.startsWith('cloud-media://')) {
      resolveCloudMediaUrl(nextResolved).then((blobUrl) => {
        if (!active) return;
        if (blobUrl && !blobUrl.startsWith('cloud-media://')) {
          setCurrentSrc(blobUrl);
        } else {
          setCurrentSrc(isLogo ? BUNDLED_LOGO_DATA_URL : BUNDLED_LEHENGA_IMG_1_DATA_URL);
        }
      });
    } else {
      setCurrentSrc(nextResolved);
    }
    return () => {
      active = false;
    };
  }, [src, isLogo]);

  const handleError = () => {
    if (hasTriedFallback) return;
    setHasTriedFallback(true);

    if (fallbackSrc) {
      setCurrentSrc(resolveOptimizedImagePath(fallbackSrc, isLogo));
      return;
    }

    if (isLogo) {
      setCurrentSrc(BUNDLED_LOGO_DATA_URL);
    }
  };

  return (
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={handleError}
      style={style}
      className={className}
      {...rest}
    />
  );
};
