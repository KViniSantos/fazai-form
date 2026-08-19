import { describe, expect, it, vi } from 'vitest';
import {
  loadCategories,
  loadFortaleza,
  type CatalogClient,
} from '@/infrastructure/supabase/catalogRepository';

function makeClient(): {
  client: CatalogClient;
  from: ReturnType<typeof vi.fn>;
  categoryQuery: Record<string, ReturnType<typeof vi.fn>>;
  cityQuery: Record<string, ReturnType<typeof vi.fn>>;
} {
  const categoryQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
  };
  const cityQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
  };

  categoryQuery.select.mockReturnValue(categoryQuery);
  categoryQuery.eq.mockReturnValue(categoryQuery);
  categoryQuery.order.mockResolvedValue({
    data: [{ id: 'category-1', nome: 'Elétrica' }],
    error: null,
  });
  cityQuery.select.mockReturnValue(cityQuery);
  cityQuery.eq.mockReturnValue(cityQuery);
  cityQuery.single.mockResolvedValue({
    data: { id: 'city-1', nome: 'Fortaleza', estado: 'CE' },
    error: null,
  });

  const from = vi.fn((table: string) => table === 'categorias_servico' ? categoryQuery : cityQuery);
  return {
    client: { from },
    from,
    categoryQuery,
    cityQuery,
  } as unknown as {
    client: CatalogClient;
    from: ReturnType<typeof vi.fn>;
    categoryQuery: Record<string, ReturnType<typeof vi.fn>>;
    cityQuery: Record<string, ReturnType<typeof vi.fn>>;
  };
}

describe('Supabase public catalog repository', () => {
  it('loads only active categories ordered by the existing catalog order', async () => {
    const { client, from, categoryQuery } = makeClient();

    await expect(loadCategories(client)).resolves.toEqual([{ id: 'category-1', nome: 'Elétrica' }]);
    expect(from).toHaveBeenCalledWith('categorias_servico');
    expect(categoryQuery.select).toHaveBeenCalledWith('id,nome');
    expect(categoryQuery.eq).toHaveBeenCalledWith('ativo', true);
    expect(categoryQuery.order).toHaveBeenCalledWith('ordem');
  });

  it('loads exactly the Fortaleza/CE city used by the preregistration flow', async () => {
    const { client, from, cityQuery } = makeClient();

    await expect(loadFortaleza(client)).resolves.toEqual({ id: 'city-1', nome: 'Fortaleza', estado: 'CE' });
    expect(from).toHaveBeenCalledWith('cidades');
    expect(cityQuery.select).toHaveBeenCalledWith('id,nome,estado');
    expect(cityQuery.eq).toHaveBeenNthCalledWith(1, 'nome', 'Fortaleza');
    expect(cityQuery.eq).toHaveBeenNthCalledWith(2, 'estado', 'CE');
    expect(cityQuery.single).toHaveBeenCalledOnce();
  });
});
