import { describe, expect, it, vi } from 'vitest';
import {
  createPreRegistrationRepository,
  type PreRegistrationClient,
  type SubmissionInput,
} from '@/infrastructure/supabase/preRegistrationRepository';
import { makeEmptyProfile, makeEmptyService } from '@/domain/types';
import type { PreparedImage } from '@/domain/types';
import { LEGAL_VERSION } from '@/domain/constants';

function makeClient() {
  const auth = {
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({
      data: { user: { id: 'auth-user-1' }, session: { access_token: 'session-token' } },
      error: null,
    }),
  };
  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'provider-1' }, error: null }),
  };
  const from = vi.fn().mockReturnValue(profileQuery);
  const bucket = {
    upload: vi.fn().mockResolvedValue({ data: { path: 'provider-1/image.webp' }, error: null }),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } })),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const storage = { from: vi.fn().mockReturnValue(bucket) };
  const rpc = vi.fn().mockResolvedValue({
    data: [{ service_id: 'service-1', status: 'pendente' }],
    error: null,
  });
  const client = { auth, from, storage, rpc } as unknown as PreRegistrationClient;
  return { client, auth, from, profileQuery, bucket, storage, rpc };
}

function makeImage(): PreparedImage {
  const file = new Blob(['prepared-image'], { type: 'image/webp' });
  return {
    id: 'image-1',
    name: 'prepared.webp',
    type: 'image/webp',
    size: file.size,
    file,
  };
}

function makeSubmission(uploadedImages: SubmissionInput['services'][number]['images']): SubmissionInput {
  return {
    userId: 'provider-1',
    profile: {
      ...makeEmptyProfile(),
      nome: 'Ana',
      sobrenome: 'Silva',
      dataNascimento: '1990-01-15',
      telefone: '85999998888',
    },
    services: [{
      service: {
        ...makeEmptyService(),
        titulo: 'Instalação elétrica residencial',
        descricao: 'A'.repeat(100),
        categoriaId: '11111111-1111-4111-8111-111111111111',
        cidadeId: '22222222-2222-4222-8222-222222222222',
      },
      images: uploadedImages,
    }],
    termsAccepted: true,
    serviceTermsAccepted: true,
    privacyAccepted: true,
    publicationConsent: true,
  };
}

describe('pre-registration Supabase repository', () => {
  it('requests and verifies an email OTP without creating or sending a password', async () => {
    const { client, auth } = makeClient();
    const repository = createPreRegistrationRepository(client);

    await repository.requestEmailOtp(' prestador@example.com ');
    await repository.verifyEmailOtp('prestador@example.com', '123456');

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'prestador@example.com',
      options: { shouldCreateUser: true },
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'prestador@example.com',
      token: '123456',
      type: 'email',
    });
    expect(auth.signInWithOtp.mock.calls.flat()).not.toContain('password');
  });

  it('uploads prepared images under the existing provider-owned Storage folder', async () => {
    const { client, bucket } = makeClient();
    const repository = createPreRegistrationRepository(client);

    const uploaded = await repository.uploadPreparedImages('provider-1', [makeImage()]);

    expect(bucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^provider-1\/[0-9a-f-]+\.webp$/i),
      expect.any(Blob),
      expect.objectContaining({ upsert: false, contentType: 'image/webp' }),
    );
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]?.path).toMatch(/^provider-1\/[0-9a-f-]+\.webp$/i);
    expect(uploaded[0]?.publicUrl).toBe(`https://cdn.example/${uploaded[0]?.path}`);
  });

  it('submits through the guarded RPC with legal versions and cleans uploaded images on failure', async () => {
    const { client, rpc, bucket } = makeClient();
    const repository = createPreRegistrationRepository(client);
    const uploadedImages = [{ path: 'provider-1/image.webp', publicUrl: 'https://cdn.example/provider-1/image.webp' }];

    await expect(repository.submit(makeSubmission(uploadedImages))).resolves.toMatchObject({
      serviceIds: ['service-1'],
      status: 'pendente',
    });
    expect(rpc).toHaveBeenCalledWith('submit_pre_registration', expect.objectContaining({
      p_terms_version: LEGAL_VERSION,
      p_publication_version: LEGAL_VERSION,
    }));
    expect(client.from).not.toHaveBeenCalledWith('avaliacoes');

    rpc.mockResolvedValueOnce({ data: null, error: new Error('Falha no envio') });
    await expect(repository.submit(makeSubmission(uploadedImages))).rejects.toThrow('Falha no envio');
    expect(bucket.remove).toHaveBeenCalledWith(['provider-1/image.webp']);
  });
});
