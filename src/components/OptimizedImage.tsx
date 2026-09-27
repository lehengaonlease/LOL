import React, { useState, useEffect, useRef } from 'react';
import {
  BUNDLED_LOGO_DATA_URL,
  BUNDLED_LEHENGA_IMG_1_DATA_URL,
  BUNDLED_LEHENGA_IMG_2_DATA_URL,
  BUNDLED_HERO_POSTER_DATA_URL,
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
 * Maps runtime `/uploads/` paths and relative `public/` paths to bundled production
 * assets or clean root-relative URLs so images never 404 on Vercel.
 */
export function resolveOptimizedImagePath(rawSrc?: string, isLogo = false): string {
  if (!rawSrc || !rawSrc.trim()) {
    return isLogo ? BUNDLED_LOGO_DATA_URL : BUNDLED_LEHENGA_IMG_1_DATA_URL;
  }

  const trimmed = rawSrc.trim();

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('cloud-media://')) {
    return trimmed;
  }

  // Resolve known brand logos
  if (
    isLogo ||
    trimmed.includes('logo-top') ||
    trimmed.includes('logo-bottom')
  ) {
    return BUNDLED_LOGO_DATA_URL;
  }

  // Resolve known studio product photos & hero poster
  if (trimmed.includes('lehenga-img-1')) {
    return BUNDLED_LEHENGA_IMG_1_DATA_URL;
  }

  if (trimmed.includes('lehenga-img-2')) {
    return BUNDLED_LEHENGA_IMG_2_DATA_URL;
  }

  if (trimmed.includes('hero-poster')) {
    return BUNDLED_HERO_POSTER_DATA_URL;
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
      ? isLogo
        ? BUNDLED_LOGO_DATA_URL
        : BUNDLED_LEHENGA_IMG_1_DATA_URL
      : resolvedPrimary
  );
  const [hasTriedFallback, setHasTriedFallback] = useState(false);

  useEffect(() => {
    let active = true;
    const nextResolved = resolveOptimizedImagePath(src, isLogo);
    setHasTriedFallback(false);
    if (nextResolved.startsWith('cloud-media://')) {
      resolveCloudMediaUrl(nextResolved).then((blobUrl) => {
        if (active && blobUrl) {
          setCurrentSrc(blobUrl);
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

    setCurrentSrc(isLogo ? BUNDLED_LOGO_DATA_URL : BUNDLED_LEHENGA_IMG_1_DATA_URL);
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
