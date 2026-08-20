import { normalizeCep } from '@/lib/cep';

export interface CepAddress {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

interface ViaCepResponse extends Partial<CepAddress> {
  erro?: boolean;
}

export async function lookupCep(cep: string, fetcher: typeof fetch = fetch): Promise<CepAddress> {
  const digits = normalizeCep(cep);
  if (digits.length !== 8) throw new Error('Informe um CEP válido.');

  let response: Response;
  try {
    response = await fetcher(`https://viacep.com.br/ws/${digits}/json/`);
  } catch {
    throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
  }

  if (!response.ok) throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
  const data = await response.json() as ViaCepResponse;
  if (data.erro) throw new Error('CEP não encontrado.');

  return {
    cep: data.cep ?? maskFallback(digits),
    logradouro: data.logradouro ?? '',
    bairro: data.bairro ?? '',
    localidade: data.localidade ?? '',
    uf: data.uf ?? '',
  };
}

function maskFallback(digits: string): string {
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
