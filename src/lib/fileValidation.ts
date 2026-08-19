import {
  FINAL_IMAGE_MAX_BYTES,
  MAX_IMAGES_PER_SERVICE,
  ORIGINAL_IMAGE_MAX_BYTES,
} from '@/domain/constants';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function validateImageFile(file: Pick<File, 'name' | 'type' | 'size'>): { valid: boolean; message?: string } {
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
    return { valid: false, message: 'Use uma imagem JPG, PNG ou WebP.' };
  }
  if (file.size > ORIGINAL_IMAGE_MAX_BYTES) {
    return { valid: false, message: 'A imagem original deve ter no máximo 10 MB.' };
  }
  return { valid: true };
}

export function validatePreparedImage(file: Pick<File, 'type' | 'size'>): { valid: boolean; message?: string } {
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
    return { valid: false, message: 'A imagem preparada tem um formato inválido.' };
  }
  if (file.size > FINAL_IMAGE_MAX_BYTES) {
    return { valid: false, message: 'A imagem preparada deve ter no máximo 5 MB.' };
  }
  return { valid: true };
}

export function canAddImage(currentCount: number): boolean {
  return currentCount >= 0 && currentCount < MAX_IMAGES_PER_SERVICE;
}
