/** Widths offered in a photo's `srcset`, in pixels. */
export const PHOTO_WIDTHS: readonly number[] = [320, 640, 960, 1280];
/** Width of the `src` fallback for browsers without `srcset`. */
const FALLBACK_WIDTH = 640;
/** Media lists are one column, at most 45rem wide. */
export const PHOTO_SIZES = '(min-width: 48rem) 45rem, 100vw';

/** What an `<img>` needs to load a Cloudinary photo in responsive sizes. */
export interface CloudinaryImage {
  sizes: string;
  src: string;
  srcset: string;
}

/** A Cloudinary delivery URL: best format and quality for the browser, scaled to `width` (AC7.5). */
export const cloudinaryUrl = (cloudName: string, publicId: string, width: number): string =>
  `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;

/** The responsive `src`, `srcset` and `sizes` of a photo; no width above the original but the smallest. */
export function cloudinaryImage(
  cloudName: string,
  publicId: string,
  photoWidth: number
): CloudinaryImage {
  const widths = PHOTO_WIDTHS.filter((width, index) => index === 0 || width <= photoWidth);
  return {
    sizes: PHOTO_SIZES,
    src: cloudinaryUrl(cloudName, publicId, FALLBACK_WIDTH),
    srcset: widths
      .map((width) => `${cloudinaryUrl(cloudName, publicId, width)} ${width}w`)
      .join(', '),
  };
}
