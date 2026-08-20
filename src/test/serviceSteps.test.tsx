import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ServiceDetailsStep from '@/components/steps/ServiceDetailsStep';
import ServiceAvailabilityStep from '@/components/steps/ServiceAvailabilityStep';
import { makeEmptyService } from '@/domain/types';

describe('provider service steps', () => {
  it('shows active categories, fixed Fortaleza/CE and price controls without city or review controls', () => {
    render(
      <ServiceDetailsStep
        service={makeEmptyService()}
        categories={[{ id: 'category-1', nome: 'Elétrica' }]}
        onChange={vi.fn()}
        errors={{ descricao: 'Descreva o serviço com pelo menos 100 caracteres.' }}
      />,
    );

    expect(screen.getByRole('option', { name: 'Elétrica' })).toBeInTheDocument();
    expect(screen.getByText(/Fortaleza\/CE/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo de preço/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preço mínimo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preço mínimo/i)).toHaveClass('price-input');
    expect(screen.getByLabelText(/preço máximo/i)).toHaveClass('price-input');
    expect(screen.getByText('0/2.000')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Descrição/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Descreva o serviço com pelo menos 100 caracteres.')).toBeInTheDocument();
    expect(screen.queryByText('O foco desta etapa é uma única cidade.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cidade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/avalia/i)).not.toBeInTheDocument();
  });

  it('uses the provider WhatsApp instead of asking for another service phone number', () => {
    render(<ServiceAvailabilityStep service={makeEmptyService()} onChange={vi.fn()} />);

    expect(screen.queryByLabelText(/WhatsApp do serviço/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /telefone/i })).not.toBeInTheDocument();
  });
});
