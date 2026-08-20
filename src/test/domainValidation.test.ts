import { describe, expect, it } from 'vitest';
import { validateProfile, validateService, validateSubmission } from '@/domain/validation';
import { makeEmptyProfile, makeEmptyService } from '@/domain/types';

describe('provider pre-registration validation', () => {
  it('allows an omitted CPF/CNPJ while requiring the remaining provider data', () => {
    const result = validateProfile({
      ...makeEmptyProfile(),
      nome: 'Ana',
      sobrenome: 'Silva',
      dataNascimento: '1990-01-15',
      whatsapp: '85999998888',
      documento: '',
      tipoDocumento: '',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a provider younger than eighteen', () => {
    const result = validateProfile({
      ...makeEmptyProfile(),
      nome: 'Ana',
      dataNascimento: '2012-01-15',
      whatsapp: '85999998888',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === 'dataNascimento')).toBe(true);
  });

  it.each([
    ['cpf', '52998224725'],
    ['cnpj', '11222333000181'],
  ] as const)('accepts a valid %s when the optional document is provided', (tipoDocumento, documento) => {
    const result = validateProfile({
      ...makeEmptyProfile(),
      nome: 'Ana',
      sobrenome: 'Silva',
      dataNascimento: '1990-01-15',
      whatsapp: '85999998888',
      tipoDocumento,
      documento,
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ['cpf', '52998224724'],
    ['cnpj', '11222333000180'],
  ] as const)('rejects an invalid %s check digit at the document field', (tipoDocumento, documento) => {
    const result = validateProfile({
      ...makeEmptyProfile(),
      nome: 'Ana',
      sobrenome: 'Silva',
      dataNascimento: '1990-01-15',
      whatsapp: '85999998888',
      tipoDocumento,
      documento,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['documento'] }),
    ]));
  });

  it('requires a Fortaleza service with one image and a complete description', () => {
    const result = validateService({
      ...makeEmptyService(),
      categoriaId: '11111111-1111-4111-8111-111111111111',
      titulo: 'Instalação elétrica residencial',
      descricao: 'A'.repeat(100),
      cidadeId: '22222222-2222-4222-8222-222222222222',
      imagemCount: 1,
    });

    expect(result.success).toBe(true);
  });

  it('rejects more than two services and missing publication consent', () => {
    const result = validateSubmission({
      profile: makeEmptyProfile(),
      services: [makeEmptyService(), makeEmptyService(), makeEmptyService()],
      termsAccepted: true,
      serviceTermsAccepted: true,
      privacyAccepted: true,
      publicationConsent: false,
      email: 'prestador@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['services', 'publicationConsent']),
    );
  });
});
