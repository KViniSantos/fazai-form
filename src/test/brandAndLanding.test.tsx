import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrandMark from '@/components/BrandMark';
import LandingPage from '@/pages/LandingPage';

describe('FazAí brand presentation', () => {
  it('uses the official FazAí logo asset in the brand mark', () => {
    render(<BrandMark />);

    expect(screen.getByRole('img', { name: 'FazAí' })).toHaveAttribute('src', expect.stringContaining('fazai-brand-logo.png'));
  });

  it('explains that the Android app will be available on Google Play', () => {
    render(<LandingPage onStart={() => undefined} />);

    expect(screen.getByText(/em breve na google play/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /google play/i })).toBeInTheDocument();
  });
});
