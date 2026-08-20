import { LEGAL_VERSION } from '@/domain/constants';
import type { PreparedImage, ProfileDraft, ServiceDraft, SubmissionResult } from '@/domain/types';
import { validatePreparedImage } from '@/lib/fileValidation';

const IMAGE_BUCKET = 'servicos-imagens';

interface SupabaseError {
  message: string;
}

interface SupabaseResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface AuthApi {
  signInWithOtp(input: { email: string; options: { shouldCreateUser: boolean } }): Promise<SupabaseResult<unknown>>;
  verifyOtp(input: { email: string; token: string; type: 'email' }): Promise<SupabaseResult<{ user: { id: string } | null }>>;
}

interface ProfileQuery extends PromiseLike<SupabaseResult<{ id: string }>> {
  select(columns: string): ProfileQuery;
  eq(column: string, value: string): ProfileQuery;
  single(): PromiseLike<SupabaseResult<{ id: string }>>;
}

interface StorageBucket {
  upload(path: string, file: Blob, options: {
    cacheControl: string;
    contentType: string;
    upsert: boolean;
  }): Promise<SupabaseResult<unknown>>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
  remove(paths: string[]): Promise<SupabaseResult<unknown>>;
}

export interface PreRegistrationClient {
  auth: AuthApi;
  from(table: string): ProfileQuery;
  storage: { from(bucket: string): StorageBucket };
  rpc(name: string, params: Record<string, unknown>): Promise<SupabaseResult<unknown>>;
}

export interface UploadedImage {
  path: string;
  publicUrl: string;
}

export interface SubmissionServiceInput {
  service: ServiceDraft;
  images: UploadedImage[];
}

export interface SubmissionInput {
  userId: string;
  profile: ProfileDraft;
  services: SubmissionServiceInput[];
  termsAccepted: boolean;
  serviceTermsAccepted: boolean;
  privacyAccepted: boolean;
  publicationConsent: boolean;
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    const value = character === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

function imageExtension(image: PreparedImage): 'webp' | 'jpg' {
  return image.type === 'image/webp' ? 'webp' : 'jpg';
}

function errorFrom(value: SupabaseError | null, fallback: string): Error | null {
  return value ? new Error(value.message || fallback) : null;
}

function emailOtpError(value: SupabaseError | null): Error | null {
  if (!value) return null;
  if (/status code returned from hook:\s*5\d\d/i.test(value.message)) {
    return new Error('Não foi possível enviar o código agora. Tente novamente em alguns minutos.');
  }
  return errorFrom(value, 'Não foi possível enviar o código.');
}

function verifyEmailOtpError(value: SupabaseError | null): Error | null {
  if (!value) return null;
  if (/token has expired or is invalid/i.test(value.message)) {
    return new Error('O código expirou ou é inválido. Peça um novo código e tente novamente.');
  }
  return errorFrom(value, 'Não foi possível confirmar o código.');
}

function serializeProfile(profile: ProfileDraft): Record<string, unknown> {
  return {
    nome: profile.nome.trim(),
    sobrenome: profile.sobrenome.trim(),
    data_nascimento: profile.dataNascimento,
    telefone: profile.whatsapp,
    whatsapp: profile.whatsapp,
    documento: profile.documento.trim() || null,
    tipo_documento: profile.tipoDocumento || null,
    address: {
      cep: profile.address.cep,
      logradouro: profile.address.logradouro,
      numero: profile.address.numero,
      complemento: profile.address.complemento,
      bairro: profile.address.bairro,
    },
  };
}

function serializeService(input: SubmissionServiceInput): Record<string, unknown> {
  const { service, images } = input;
  return {
    titulo: service.titulo.trim(),
    descricao: service.descricao.trim(),
    categoria_id: service.categoriaId,
    cidade_id: service.cidadeId,
    tipo_preco: service.tipoPreco,
    preco_minimo: service.precoMinimo,
    preco_maximo: service.precoMaximo,
    atendimento_remoto: false,
    horario_atendimento: service.horarioAtendimento,
    atende_emergencia: service.atendeEmergencia,
    atende_fim_de_semana: service.atendeFimDeSemana,
    whatsapp: service.whatsapp || null,
    email_contato: service.emailContato || null,
    foto_principal: images[0]?.publicUrl ?? null,
    fotos_adicionais: images.slice(1).map((image) => image.publicUrl),
  };
}

export type PreRegistrationRepository = ReturnType<typeof createPreRegistrationRepository>;

export function createPreRegistrationRepository(client: PreRegistrationClient) {
  const removeUploadedImages = async (paths: string[]): Promise<void> => {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    if (uniquePaths.length === 0) return;
    const { error } = await client.storage.from(IMAGE_BUCKET).remove(uniquePaths);
    if (error) console.warn('Falha ao remover imagens sem referencia:', error.message);
  };

  const requestEmailOtp = async (email: string): Promise<void> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error('Informe um e-mail.');

    const { error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });
    const requestError = emailOtpError(error);
    if (requestError) throw requestError;
  };

  const verifyEmailOtp = async (email: string, token: string): Promise<{ userId: string }> => {
    const { data, error } = await client.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    });
    const verifyError = verifyEmailOtpError(error);
    if (verifyError) throw verifyError;
    if (!data?.user?.id) throw new Error('A sessão autenticada não foi criada.');

    const { data: profile, error: profileError } = await client
      .from('usuarios')
      .select('id')
      .eq('auth_user_id', data.user.id)
      .single();
    const lookupError = errorFrom(profileError, 'O perfil do prestador não foi criado.');
    if (lookupError) throw lookupError;
    if (!profile?.id) throw new Error('O perfil do prestador não foi criado.');
    return { userId: profile.id };
  };

  const uploadPreparedImages = async (userId: string, images: PreparedImage[]): Promise<UploadedImage[]> => {
    const bucket = client.storage.from(IMAGE_BUCKET);
    const uploaded: UploadedImage[] = [];
    const uploadedPaths: string[] = [];

    try {
      for (const image of images) {
        const validation = validatePreparedImage(image);
        if (!validation.valid) throw new Error(validation.message);

        const path = `${userId}/${makeUuid()}.${imageExtension(image)}`;
        const { error } = await bucket.upload(path, image.file, {
          cacheControl: '3600',
          contentType: image.type,
          upsert: false,
        });
        const uploadError = errorFrom(error, 'Não foi possível enviar a imagem.');
        if (uploadError) throw uploadError;

        uploadedPaths.push(path);
        const { data } = bucket.getPublicUrl(path);
        if (!data.publicUrl) throw new Error('Não foi possível obter o endereço da imagem.');
        uploaded.push({ path, publicUrl: data.publicUrl });
      }
      return uploaded;
    } catch (error) {
      await removeUploadedImages(uploadedPaths);
      throw error;
    }
  };

  const submit = async (input: SubmissionInput): Promise<SubmissionResult> => {
    const paths = input.services.flatMap(({ images }) => images.map((image) => image.path));

    try {
      if (!input.termsAccepted || !input.serviceTermsAccepted || !input.privacyAccepted || !input.publicationConsent) {
        throw new Error('Aceite os termos e autorize a publicação antes de enviar.');
      }

      const { data, error } = await client.rpc('submit_pre_registration', {
        p_profile: serializeProfile(input.profile),
        p_services: input.services.map(serializeService),
        p_terms_version: LEGAL_VERSION,
        p_publication_version: LEGAL_VERSION,
      });
      const submitError = errorFrom(error, 'Não foi possível enviar o pré-cadastro.');
      if (submitError) throw submitError;

      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const serviceIds = rows
        .map((row) => (row as { service_id?: string }).service_id)
        .filter((serviceId): serviceId is string => Boolean(serviceId));
      if (serviceIds.length !== input.services.length) {
        throw new Error('O servidor não confirmou todos os serviços enviados.');
      }

      return {
        userId: input.userId,
        serviceIds,
        status: 'pendente',
      };
    } catch (error) {
      await removeUploadedImages(paths);
      throw error;
    }
  };

  return {
    requestEmailOtp,
    verifyEmailOtp,
    uploadPreparedImages,
    submit,
    removeUploadedImages,
  };
}
