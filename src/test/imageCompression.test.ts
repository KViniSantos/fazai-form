import { describe, expect, it } from 'vitest';
import {
  chooseOutputType,
  validateImageFile,
  validatePreparedImage,
} from '@/lib/imageCompression';
import { canAddImage } from '@/lib/fileValidation';

describe('provider service image handling', () => {
  it('accepts an image at the original processing limit', () => {
    expect(validateImageFile({
      name: 'fachada.jpg',
      type: 'image/jpeg',
      size: 10 * 1024 * 1024,
    }).valid).toBe(true);
  });

  it('rejects an image above the original processing limit and rejects SVG', () => {
    expect(validateImageFile({
      name: 'fachada.jpg',
      type: 'image/jpeg',
      size: 10 * 1024 * 1024 + 1,
    }).valid).toBe(false);
    expect(validateImageFile({
      name: 'arte.svg',
      type: 'image/svg+xml',
      size: 10,
    }).valid).toBe(false);
  });

  it('accepts a prepared image at 5 MB and rejects a larger output', () => {
    expect(validatePreparedImage({ type: 'image/webp', size: 5 * 1024 * 1024 }).valid).toBe(true);
    expect(validatePreparedImage({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }).valid).toBe(false);
  });

  it('prefers WebP output and enforces the five-image service limit', () => {
    expect(chooseOutputType('image/png')).toBe('image/webp');
    expect(chooseOutputType('image/svg+xml')).toBe('image/jpeg');
    expect(canAddImage(4)).toBe(true);
    expect(canAddImage(5)).toBe(false);
    expect(canAddImage(6)).toBe(false);
  });
});
