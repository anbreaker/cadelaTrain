import { cloudinaryImage, cloudinaryUrl, PHOTO_SIZES } from './cloudinary-url';

const CLOUD = 'demo-cloud';
const ID = 'dela/h1/abc123';

describe('cloudinaryUrl (AC7.5)', () => {
  it('should deliver an auto-format, auto-quality image at the given width', () => {
    expect(cloudinaryUrl(CLOUD, ID, 640)).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto,w_640/dela/h1/abc123'
    );
  });
});

describe('cloudinaryImage (AC7.5)', () => {
  const url = (width: number): string => cloudinaryUrl(CLOUD, ID, width);

  it('should offer every responsive width a large photo reaches', () => {
    const image = cloudinaryImage(CLOUD, ID, 4000);

    expect(image.src).toBe(url(640));
    expect(image.srcset).toBe(
      [320, 640, 960, 1280].map((width) => `${url(width)} ${width}w`).join(', ')
    );
    expect(image.sizes).toBe(PHOTO_SIZES);
  });

  it('should not offer widths above a small photo, keeping the smallest one', () => {
    expect(cloudinaryImage(CLOUD, ID, 700).srcset).toBe(`${url(320)} 320w, ${url(640)} 640w`);
    expect(cloudinaryImage(CLOUD, ID, 200).srcset).toBe(`${url(320)} 320w`);
  });
});
