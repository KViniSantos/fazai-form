import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ProfileStep from '@/components/steps/ProfileStep';
import { makeEmptyProfile } from '@/domain/types';

describe('provider profile step', () => {
  it('requires the core contact data while keeping CPF/CNPJ optional', () => {
    render(<ProfileStep profile={makeEmptyProfile()} onChange={vi.fn()} errors={{ documento: 'Informe um CPF válido.' }} />);

    expect(screen.getByLabelText(/^Nome/)).toBeRequired();
    expect(screen.getByLabelText(/^Data de nascimento/)).toBeRequired();
    expect(screen.getByLabelText(/^WhatsApp do seu serviço/)).toBeRequired();
    expect(screen.getByLabelText(/^CPF\/CNPJ/)).not.toBeRequired();
    expect(screen.getByLabelText(/^WhatsApp do seu serviço/)).toHaveAttribute('inputmode', 'tel');
    expect(screen.queryByLabelText(/^Telefone/)).not.toBeInTheDocument();
    const documentInput = screen.getByLabelText(/^CPF\/CNPJ/);
    expect(documentInput).toHaveAttribute('aria-invalid', 'true');
    expect(documentInput.nextElementSibling).toHaveTextContent('Informe um CPF válido.');
  });

  it('looks up a complete CEP and keeps the address editable even outside Fortaleza', async () => {
    const user = userEvent.setup();
    const cepLookup = vi.fn().mockResolvedValue({
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    });

    function Harness() {
      const [profile, setProfile] = useState(makeEmptyProfile());
      return <ProfileStep profile={profile} onChange={(patch) => setProfile((current) => ({ ...current, ...patch }))} cepLookup={cepLookup} />;
    }

    render(<Harness />);
    await user.type(screen.getByLabelText(/^CEP/), '01310100');

    await waitFor(() => expect(screen.getByLabelText(/^Rua/)).toHaveValue('Avenida Paulista'));
    expect(screen.getByLabelText(/^Bairro/)).toHaveValue('Bela Vista');
    expect(screen.getByLabelText(/^Rua/)).toBeEnabled();
    expect(screen.getByLabelText(/^CEP/)).toHaveValue('01310-100');
  });

  it('shows a ViaCEP failure below the CEP and allows manual address input', async () => {
    const user = userEvent.setup();
    const cepLookup = vi.fn().mockRejectedValue(new Error('CEP não encontrado.'));

    function Harness() {
      const [profile, setProfile] = useState(makeEmptyProfile());
      return <ProfileStep profile={profile} onChange={(patch) => setProfile((current) => ({ ...current, ...patch }))} cepLookup={cepLookup} />;
    }

    render(<Harness />);
    await user.type(screen.getByLabelText(/^CEP/), '00000000');

    expect(await screen.findByText('CEP não encontrado.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Rua/)).toBeEnabled();
    await user.type(screen.getByLabelText(/^Rua/), 'Rua informada manualmente');
    expect(screen.getByLabelText(/^Rua/)).toHaveValue('Rua informada manualmente');
  });
});
