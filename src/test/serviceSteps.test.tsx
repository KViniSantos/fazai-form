import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ServiceDetailsStep from '@/components/steps/ServiceDetailsStep';
import { makeEmptyService } from '@/domain/types';

describe('provider service steps', () => {
  it('shows active categories, fixed Fortaleza/CE and price controls without city or review controls', () => {
    render(
      <ServiceDetailsStep
        service={makeEmptyService()}
        categories={[{ id: 'category-1', nome: 'Elétrica' }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('option', { name: 'Elétrica' })).toBeInTheDocument();
    expect(screen.getByText(/Fortaleza\/CE/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo de preço/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preço mínimo/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/cidade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/avalia/i)).not.toBeInTheDocument();
  });
});
