import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfileStep from '@/components/steps/ProfileStep';
import { makeEmptyProfile } from '@/domain/types';

describe('provider profile step', () => {
  it('requires the core contact data while keeping CPF/CNPJ optional', () => {
    render(<ProfileStep profile={makeEmptyProfile()} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/^Nome/)).toBeRequired();
    expect(screen.getByLabelText(/^Data de nascimento/)).toBeRequired();
    expect(screen.getByLabelText(/^WhatsApp/)).toBeRequired();
    expect(screen.getByLabelText(/^CPF\/CNPJ/)).not.toBeRequired();
    expect(screen.getByLabelText(/^WhatsApp/)).toHaveAttribute('inputmode', 'tel');
  });
});
