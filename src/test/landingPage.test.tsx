import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from '@/pages/LandingPage';

describe('public pre-registration landing page', () => {
  it('explains the factual Fortaleza pre-launch offer and starts the form', () => {
    render(<LandingPage onStart={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /cadastre seu serviço no fazaí/i })).toBeInTheDocument();
    expect(screen.getByText('Gratuito', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Pré-lançamento em Fortaleza', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Cadastre seu trabalho de graça.')).toBeInTheDocument();
    expect(screen.queryByText(/até 2 serviços/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/até 5 imagens/i)).not.toBeInTheDocument();
    expect(screen.getByText(/analisado antes da publicação/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /começar cadastro/i })).toBeInTheDocument();
  });
});
