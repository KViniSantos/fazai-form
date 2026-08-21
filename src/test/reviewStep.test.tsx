import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ReviewStep from '@/components/steps/ReviewStep';
import { makeEmptyProfile, makeEmptyService, type PreparedImage } from '@/domain/types';

function makeImage(): PreparedImage {
  const file = new Blob(['image'], { type: 'image/webp' });
  return { id: 'image-1', name: 'image.webp', type: 'image/webp', size: file.size, file, previewUrl: 'blob:image-1' };
}

describe('pre-registration review step', () => {
  it('shows the exact provider, service, price, Fortaleza and image data before sending', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const profile = { ...makeEmptyProfile(), nome: 'Ana', sobrenome: 'Silva', whatsapp: '85999998888' };
    const service = { ...makeEmptyService(), titulo: 'Instalação elétrica', descricao: 'A'.repeat(100), tipoPreco: 'fixo' as const, precoMinimo: 150, cidadeNome: 'Fortaleza', estado: 'CE', imagens: [makeImage()], imagemCount: 1 };
    function ReviewHarness() {
      const [consents, setConsents] = useState({ termsAccepted: false, serviceTermsAccepted: false, privacyAccepted: false, publicationConsent: false, securityAcknowledged: false });
      return <ReviewStep profile={profile} services={[service]} consents={consents} onConsentChange={(patch) => setConsents((current) => ({ ...current, ...patch }))} onSubmit={onSubmit} />;
    }
    render(<ReviewHarness />);

    expect(screen.getByText(/Ana Silva/i)).toBeInTheDocument();
    expect(screen.getByText(/Instalação elétrica/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*150/i)).toBeInTheDocument();
    expect(screen.getByText(/Fortaleza/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /imagem do serviço/i })).toBeInTheDocument();
    expect(screen.getByText(/ficarão bloqueados para edição/i)).toBeInTheDocument();
    expect(screen.getByText(/Atenção a golpes/i)).toBeInTheDocument();
    expect(screen.getByText(/nunca solicita senhas, tokens ou códigos/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Entendi e estou ciente das orientações de segurança/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar cadastro/i })).toBeDisabled();

    const checks = screen.getAllByRole('checkbox');
    for (const checkbox of checks) await user.click(checkbox);
    expect(screen.getByRole('button', { name: /enviar cadastro/i })).toBeEnabled();
  });
});
