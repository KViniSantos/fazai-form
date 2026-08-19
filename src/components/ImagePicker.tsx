import { useEffect, useRef, useState } from 'react';
import { MAX_IMAGES_PER_SERVICE } from '@/domain/constants';
import type { PreparedImage } from '@/domain/types';
import { compressImage, validateImageFile, validatePreparedImage } from '@/lib/imageCompression';

interface ImagePickerProps {
  images: PreparedImage[];
  onChange: (images: PreparedImage[]) => void;
}

function makePreviewUrl(file: File): string {
  if (typeof URL.createObjectURL === 'function') return URL.createObjectURL(file);
  return '';
}

export default function ImagePicker({ images, onChange }: ImagePickerProps) {
  const [error, setError] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const createdUrls = useRef(new Set<string>());

  useEffect(() => () => {
    for (const url of createdUrls.current) URL.revokeObjectURL(url);
  }, []);

  const handleFiles = async (files: File[]) => {
    setError('');
    if (images.length + files.length > MAX_IMAGES_PER_SERVICE) {
      setError('Cada serviço pode ter até 5 imagens.');
      return;
    }

    setIsPreparing(true);
    try {
      const prepared: PreparedImage[] = [];
      for (const file of files) {
        const originalValidation = validateImageFile(file);
        if (!originalValidation.valid) throw new Error(originalValidation.message);
        const compressed = await compressImage(file);
        const preparedValidation = validatePreparedImage(compressed);
        if (!preparedValidation.valid) throw new Error(preparedValidation.message);
        const previewUrl = makePreviewUrl(compressed);
        if (previewUrl) createdUrls.current.add(previewUrl);
        prepared.push({
          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${prepared.length}`,
          name: compressed.name,
          type: compressed.type === 'image/webp' ? 'image/webp' : 'image/jpeg',
          size: compressed.size,
          file: compressed,
          previewUrl,
        });
      }
      onChange([...images, ...prepared]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível preparar a imagem.');
    } finally {
      setIsPreparing(false);
    }
  };

  const removeImage = (image: PreparedImage) => {
    if (image.previewUrl && createdUrls.current.has(image.previewUrl)) {
      URL.revokeObjectURL(image.previewUrl);
      createdUrls.current.delete(image.previewUrl);
    }
    onChange(images.filter((item) => item.id !== image.id));
  };

  return (
    <div className="image-picker">
      <label className="upload-dropzone" htmlFor="service-images-input">
        <strong>{isPreparing ? 'Preparando imagens…' : 'Adicionar imagens'}</strong>
        <small>JPG, PNG ou WebP · até 10 MB por original · máximo de 5</small>
      </label>
      <input id="service-images-input" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={isPreparing} onChange={(event) => { void handleFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {images.length > 0 ? (
        <div className="image-grid" aria-label="Imagens selecionadas">
          {images.map((image, index) => (
            <figure key={image.id} className="image-tile">
              {image.previewUrl ? <img src={image.previewUrl} alt={`Prévia da imagem ${index + 1}`} /> : <span className="image-placeholder">Imagem {index + 1}</span>}
              <figcaption>Imagem {index + 1}</figcaption>
              <button type="button" className="image-remove" onClick={() => removeImage(image)} aria-label={`Remover imagem ${index + 1}`}>Remover</button>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
