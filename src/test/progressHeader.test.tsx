import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressHeader from '@/components/ProgressHeader';

describe('ProgressHeader', () => {
  it('identifies the current step and exposes a compact mobile summary', () => {
    render(<ProgressHeader currentStep="images" />);

    expect(screen.getByText('Etapa 4 de 6')).toBeInTheDocument();
    expect(screen.getByText('Imagens', { selector: '.progress-header__mobile-title' })).toBeInTheDocument();
    expect(screen.getByText('Imagens', { selector: '[aria-current="step"]' })).toBeInTheDocument();
  });

  it('distinguishes completed, current and upcoming desktop steps', () => {
    render(<ProgressHeader currentStep="review" />);

    expect(screen.getByText('Perfil', { selector: '.is-complete' })).toBeInTheDocument();
    expect(screen.getByText('Revisão', { selector: '.is-current' })).toBeInTheDocument();
    expect(screen.getByText('Confirmação', { selector: '.is-upcoming' })).toBeInTheDocument();
  });
});
