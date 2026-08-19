import {
  FINAL_IMAGE_MAX_BYTES,
  MAX_IMAGE_EDGE,
  TARGET_IMAGE_BYTES,
} from '@/domain/constants';
import {
  IMAGE_TYPES,
  validateImageFile,
  validatePreparedImage,
} from './fileValidation';

export { IMAGE_TYPES, validateImageFile, validatePreparedImage } from './fileValidation';

export function chooseOutputType(inputType: string): 'image/webp' | 'image/jpeg' {
  return IMAGE_TYPES.includes(inputType as (typeof IMAGE_TYPES)[number])
    ? 'image/webp'
    : 'image/jpeg';
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function loadImage(file: File, objectUrl: string): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    element.src = objectUrl;
  });

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => undefined,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeCanvas(canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg'): Promise<Blob> {
  let blob = await canvasToBlob(canvas, type, 0.82);

  if (!blob || (blob.type && blob.type !== type)) {
    if (type === 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
      type = 'image/jpeg';
    }
  }

  if (!blob) throw new Error('Não foi possível preparar a imagem.');

  if (blob.size > TARGET_IMAGE_BYTES) {
    const smallerBlob = await canvasToBlob(canvas, type, 0.72);
    if (smallerBlob) blob = smallerBlob;
  }

  if (blob.size > FINAL_IMAGE_MAX_BYTES) {
    throw new Error('A imagem continua maior que 5 MB após a compressão.');
  }

  return blob;
}

export async function compressImage(file: File): Promise<File> {
  const originalValidation = validateImageFile(file);
  if (!originalValidation.valid) throw new Error(originalValidation.message);

  const objectUrl = URL.createObjectURL(file);
  let loadedImage: LoadedImage | null = null;

  try {
    loadedImage = await loadImage(file, objectUrl);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(loadedImage.width, loadedImage.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(loadedImage.width * scale));
    canvas.height = Math.max(1, Math.round(loadedImage.height * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não conseguiu preparar a imagem.');
    context.drawImage(loadedImage.source, 0, 0, canvas.width, canvas.height);

    const preferredType = chooseOutputType(file.type);
    const blob = await encodeCanvas(canvas, preferredType);
    const outputType = blob.type === 'image/jpeg' ? 'image/jpeg' : preferredType;
    const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
    const preparedFile = new File([blob], `fazai-${makeId()}.${extension}`, {
      type: outputType,
      lastModified: Date.now(),
    });
    const preparedValidation = validatePreparedImage(preparedFile);
    if (!preparedValidation.valid) throw new Error(preparedValidation.message);
    return preparedFile;
  } finally {
    loadedImage?.close();
    URL.revokeObjectURL(objectUrl);
  }
}
