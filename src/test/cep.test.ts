import { describe, expect, it, vi } from 'vitest';
import { maskCep, normalizeCep } from '@/lib/cep';
import { lookupCep } from '@/infrastructure/viacep/viacepClient';

describe('CEP helpers and ViaCEP client', () => {
  it('normalizes and masks a CEP', () => {
    expect(normalizeCep('60.160-196')).toBe('60160196');
    expect(maskCep('60160196')).toBe('60160-196');
  });

  it('maps a valid ViaCEP response from any Brazilian city', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    }), { status: 200 }));

    await expect(lookupCep('01310-100', fetcher)).resolves.toEqual({
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    });
    expect(fetcher).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/');
  });

  it('rejects an unknown CEP with a user-facing message', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: true }), { status: 200 }));

    await expect(lookupCep('00000-000', fetcher)).rejects.toThrow('CEP não encontrado.');
  });
});
