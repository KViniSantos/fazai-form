import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App, { type PreRegistrationAppDependencies } from '@/App';

vi.mock('@/lib/imageCompression', () => ({
  validateImageFile: vi.fn(() => ({ valid: true })),
  validatePreparedImage: vi.fn(() => ({ valid: true })),
  compressImage: vi.fn(async (file: File) => new File([file], 'prepared.webp', { type: 'image/webp' })),
}));

afterEach(() => window.sessionStorage.clear());

function makeDependencies(): PreRegistrationAppDependencies {
  return {
    catalog: {
      loadCategories: vi.fn().mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111', nome: 'Elétrica' }]),
      loadFortaleza: vi.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', nome: 'Fortaleza', estado: 'CE' }),
    },
    repository: {
      requestEmailOtp: vi.fn(),
      verifyEmailOtp: vi.fn(),
      uploadPreparedImages: vi.fn(),
      submit: vi.fn(),
      removeUploadedImages: vi.fn(),
    } as never,
    siteUrl: 'https://fazai.example',
  };
}

describe('public provider pre-registration flow', () => {
  it('starts from the public landing page and loads the restricted Fortaleza catalog', async () => {
    const user = userEvent.setup();
    const dependencies = makeDependencies();
    render(<App dependencies={dependencies} storage={window.sessionStorage} />);

    expect(screen.getByRole('heading', { name: /cadastre seu servi\u00e7o no faza\u00ed/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /come\u00e7ar cadastro/i }));

    expect(await screen.findByRole('heading', { name: /fale um pouco sobre voc\u00ea/i })).toBeInTheDocument();
    expect(dependencies.catalog.loadCategories).toHaveBeenCalledTimes(1);
    expect(dependencies.catalog.loadFortaleza).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/pr\u00e9-cadastro em fortaleza/i)).toBeInTheDocument();
  });

  it('sends one complete Fortaleza service only after OTP and the final RPC resolve', async () => {
    const user = userEvent.setup();
    const dependencies = makeDependencies();
    let finishSubmit!: (value: { userId: string; serviceIds: string[]; status: 'pendente' }) => void;
    const submitPromise = new Promise<{ userId: string; serviceIds: string[]; status: 'pendente' }>((resolve) => { finishSubmit = resolve; });
    dependencies.repository = {
      requestEmailOtp: vi.fn().mockResolvedValue(undefined),
      verifyEmailOtp: vi.fn().mockResolvedValue({ userId: 'provider-1' }),
      uploadPreparedImages: vi.fn().mockResolvedValue([{ path: 'provider-1/image.webp', publicUrl: 'https://cdn.example/image.webp' }]),
      submit: vi.fn(() => submitPromise),
      removeUploadedImages: vi.fn().mockResolvedValue(undefined),
    } as never;

    render(<App dependencies={dependencies} storage={window.sessionStorage} />);
    await user.click(screen.getByRole('button', { name: /come\u00e7ar cadastro/i }));
    await screen.findByRole('heading', { name: /fale um pouco sobre voc\u00ea/i });

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/^Sobrenome/), { target: { value: 'Silva' } });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), { target: { value: '1990-01-15' } });
    fireEvent.change(screen.getByLabelText(/^WhatsApp do seu serviço/), { target: { value: '85999998888' } });
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    await screen.findByRole('heading', { name: /descreva seu servi\u00e7o/i });
    await user.selectOptions(screen.getByLabelText(/categoria/i), '11111111-1111-4111-8111-111111111111');
    fireEvent.change(screen.getByLabelText(/nome do servi\u00e7o/i), { target: { value: 'Instalação elétrica residencial' } });
    fireEvent.change(screen.getByLabelText(/descri\u00e7\u00e3o/i), { target: { value: 'A'.repeat(100) } });
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    await screen.findByRole('heading', { name: /mostre seu trabalho/i });
    const imageInput = screen.getByLabelText(/adicionar imagens/i);
    await user.upload(imageInput, new File(['image'], 'eletrica.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /revisar cadastro/i }));

    await screen.findByRole('heading', { name: /revise antes de enviar/i });
    for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: /enviar cadastro/i }));

    await screen.findByRole('heading', { name: /confirme seu e-mail/i });
    await user.type(screen.getByLabelText(/^e-mail/i), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: /enviar c\u00f3digo/i }));
    await user.type(await screen.findByLabelText(/c\u00f3digo de 8 d\u00edgitos/i), '12345678');
    await user.click(screen.getByRole('button', { name: /confirmar c\u00f3digo/i }));

    await waitFor(() => expect(dependencies.repository.submit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('heading', { name: /aguardando an\u00e1lise/i })).not.toBeInTheDocument();
    const submittedInput = (dependencies.repository.submit as never as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as { services: Array<{ service: { cidadeId: string } }> };
    expect(submittedInput.services).toHaveLength(1);
    expect(submittedInput.services[0]?.service.cidadeId).toBe('22222222-2222-4222-8222-222222222222');

    finishSubmit({ userId: 'provider-1', serviceIds: ['service-1'], status: 'pendente' });
    expect(await screen.findByRole('heading', { name: /aguardando an\u00e1lise/i })).toBeInTheDocument();
  }, 15000);
});
