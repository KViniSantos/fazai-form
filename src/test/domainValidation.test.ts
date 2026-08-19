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
      telefone: '85999998888',
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
      telefone: '85999998888',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === 'dataNascimento')).toBe(true);
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
