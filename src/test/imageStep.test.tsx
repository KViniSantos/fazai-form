import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ImagePicker from '@/components/ImagePicker';
import type { PreparedImage } from '@/domain/types';

vi.mock('@/lib/imageCompression', () => ({
  validateImageFile: vi.fn(() => ({ valid: true })),
  validatePreparedImage: vi.fn(() => ({ valid: true })),
  compressImage: vi.fn(async (file: File) => new File([file], 'prepared.webp', { type: 'image/webp' })),
}));

function makeImage(index: number): PreparedImage {
  const file = new Blob([`image-${index}`], { type: 'image/webp' });
  return { id: `image-${index}`, name: `image-${index}.webp`, type: 'image/webp', size: file.size, file, previewUrl: `blob:image-${index}` };
}

describe('service image step', () => {
  it('renders one through five prepared image previews', () => {
    render(<ImagePicker images={[1, 2, 3, 4, 5].map(makeImage)} onChange={vi.fn()} />);
    expect(screen.getAllByRole('img', { name: /prévia da imagem/i })).toHaveLength(5);
  });

  it('rejects a sixth image with a clear limit message', async () => {
    const user = userEvent.setup();
    render(<ImagePicker images={[1, 2, 3, 4, 5].map(makeImage)} onChange={vi.fn()} />);
    const input = screen.getByLabelText(/adicionar imagens/i);
    await user.upload(input, new File(['sixth'], 'sixth.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByText(/até 5 imagens/i)).toBeInTheDocument();
  });

  it('removes a selected image and emits the updated list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ImagePicker images={[makeImage(1), makeImage(2)]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /remover imagem 1/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'image-2' })]));
  });
});
