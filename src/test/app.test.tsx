import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '@/App';

describe('FazAí provider pre-registration app', () => {
  it('explains the Fortaleza pre-launch registration on the public entry screen', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /cadastre seu serviço no fazaí/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/fortaleza/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /começar cadastro/i })).toBeInTheDocument();
  });
});
