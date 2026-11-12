import React, { useEffect, useState } from 'react';
import { getFamilyPhotoUrlAction } from '../../services/dataActions';

interface FamilyImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
}

/**
 * Resolves a stored photo path to a short-lived signed URL before rendering.
 * External URLs and data URIs pass through unchanged (also in demo mode).
 */
export const FamilyImage: React.FC<FamilyImageProps> = ({
  src,
  alt = '',
  ...rest
}) => {
  const [resolved, setResolved] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolved(src);

    if (!src) return;

    getFamilyPhotoUrlAction(src)
      .then((url) => {
        if (!cancelled) setResolved(url);
      })
      .catch((error) => {
        console.error('[FamilyImage] Could not resolve image:', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) {
    return (
      <div
        className={`bg-stone-100 flex items-center justify-center text-stone-400 text-[10px] ${
          rest.className ?? ''
        }`}
      >
        Image unavailable
      </div>
    );
  }

  return <img src={resolved} alt={alt} {...rest} />;
};
