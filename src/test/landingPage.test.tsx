import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from '@/pages/LandingPage';

describe('public pre-registration landing page', () => {
  it('explains the factual Fortaleza pre-launch offer and starts the form', () => {
    render(<LandingPage onStart={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /cadastre seu serviço no fazaí/i })).toBeInTheDocument();
    expect(screen.getByText('Gratuito', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Pré-lançamento em Fortaleza', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/até 2 serviços/i)).toBeInTheDocument();
    expect(screen.getByText(/até 5 imagens/i)).toBeInTheDocument();
    expect(screen.getByText(/análise antes da publicação/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /começar cadastro/i })).toBeInTheDocument();
  });
});
