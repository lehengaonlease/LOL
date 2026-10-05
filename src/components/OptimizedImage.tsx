import React, { useState, useEffect, useRef } from 'react';
import {
  BUNDLED_LOGO_DATA_URL,
  BUNDLED_LEHENGA_IMG_1_DATA_URL,
  BUNDLED_LEHENGA_IMG_2_DATA_URL,
} from '../data/bundledAssets';
import { getBundledCatalogImage } from '../data/bundledCatalogMedia';
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
 * Integrates bundled catalog WebP data URLs for zero-fail rendering on Vercel.
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

  // On Vercel, resolve bundled catalog image immediately to avoid 404 network roundtrips
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  if (isVercel) {
    const bundled = getBundledCatalogImage(trimmed);
    if (bundled) {
      return bundled;
    }
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

  // Strip container-specific .run.app origin from /uploads/... so ais-dev and ais-pre share URLs
  const runAppUploadsMatch = trimmed.match(/^https?:\/\/[^/]+\.run\.app(\/uploads\/.+)$/i);
  if (runAppUploadsMatch) {
    return runAppUploadsMatch[1];
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

    // 1. Check bundled catalog image first (resolves immediately from memory)
    const bundled = getBundledCatalogImage(currentSrc) || getBundledCatalogImage(src);
    if (bundled) {
      setCurrentSrc(bundled);
      return;
    }

    // 2. If an /uploads/<fileName> image failed on this container, resolve directly from Firestore media_assets
    const uploadMatch = currentSrc.match(/\/uploads\/([^?#]+)/);
    if (uploadMatch && uploadMatch[1]) {
      const fileName = decodeURIComponent(uploadMatch[1]).replace(/[^a-zA-Z0-9._-]/g, '_');
      resolveCloudMediaUrl(`cloud-media://${fileName}`).then((blobUrl) => {
        if (blobUrl && !blobUrl.startsWith('cloud-media://')) {
          setCurrentSrc(blobUrl);
        } else if (fallbackSrc) {
          setCurrentSrc(resolveOptimizedImagePath(fallbackSrc, isLogo));
        } else if (isLogo) {
          setCurrentSrc(BUNDLED_LOGO_DATA_URL);
        } else {
          setCurrentSrc(BUNDLED_LEHENGA_IMG_1_DATA_URL);
        }
      }).catch(() => {
        setCurrentSrc(fallbackSrc ? resolveOptimizedImagePath(fallbackSrc, isLogo) : BUNDLED_LEHENGA_IMG_1_DATA_URL);
      });
      return;
    }

    if (fallbackSrc) {
      setCurrentSrc(resolveOptimizedImagePath(fallbackSrc, isLogo));
      return;
    }

    if (isLogo) {
      setCurrentSrc(BUNDLED_LOGO_DATA_URL);
    } else {
      setCurrentSrc(BUNDLED_LEHENGA_IMG_1_DATA_URL);
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
