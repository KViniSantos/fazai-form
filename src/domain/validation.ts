import { z } from 'zod';
import {
  FORTALEZA,
  MAX_IMAGES_PER_SERVICE,
  MAX_SERVICES,
} from './constants';
import type { ProfileDraft, ServiceDraft } from './types';
import { isValidCpfOrCnpj } from '@/lib/document';
import { isValidBrazilianPhone } from '@/lib/phone';

const requiredText = (message: string) => z.string().trim().min(1, message);
const uuid = z.string().uuid('Selecione uma opção válida.');

function calculateAge(dateValue: string): number {
  const birthDate = new Date(`${dateValue}T12:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

const profileSchema = z.object({
  nome: requiredText('Informe seu nome.'),
  sobrenome: requiredText('Informe seu sobrenome.'),
  dataNascimento: z.string().refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && calculateAge(value) >= 18;
  }, 'Você precisa ter pelo menos 18 anos.'),
  telefone: z.string().refine(isValidBrazilianPhone, 'Informe um telefone brasileiro válido.'),
  whatsapp: z.string().refine((value) => !value.trim() || isValidBrazilianPhone(value), 'Informe um WhatsApp válido.'),
  documento: z.string(),
  tipoDocumento: z.enum(['', 'cpf', 'cnpj']),
  address: z.object({
    cep: z.string(),
    logradouro: z.string(),
    numero: z.string(),
    complemento: z.string(),
    bairro: z.string(),
  }),
}).superRefine((profile, context) => {
  if (!profile.documento.trim()) return;
  if (!profile.tipoDocumento || !isValidCpfOrCnpj(profile.documento, profile.tipoDocumento)) {
    context.addIssue({ code: 'custom', path: ['documento'], message: 'Informe um CPF ou CNPJ válido.' });
  }
});

const serviceSchema = z.object({
  titulo: z.string().trim().min(2, 'Informe o nome do serviço.').max(60, 'Use até 60 caracteres.'),
  descricao: z.string().trim().min(100, 'Descreva o serviço com pelo menos 100 caracteres.').max(2000, 'Use até 2.000 caracteres.'),
  categoriaId: uuid,
  cidadeId: uuid,
  cidadeNome: z.string().refine((value) => value.trim().toLocaleLowerCase('pt-BR') === FORTALEZA.name.toLocaleLowerCase('pt-BR'), 'O pré-cadastro está restrito a Fortaleza.'),
  estado: z.literal(FORTALEZA.state),
  tipoPreco: z.enum(['fixo', 'por_hora', 'a_combinar']),
  precoMinimo: z.number().finite().nonnegative().nullable(),
  precoMaximo: z.number().finite().nonnegative().nullable(),
  atendimentoRemoto: z.literal(false),
  horarioAtendimento: z.string(),
  atendeEmergencia: z.boolean(),
  atendeFimDeSemana: z.boolean(),
  whatsapp: z.string().refine((value) => !value.trim() || isValidBrazilianPhone(value), 'Informe um WhatsApp válido.'),
  emailContato: z.string().email('Informe um e-mail válido.').or(z.literal('')),
  exibirEmailContato: z.boolean(),
  imagens: z.array(z.unknown()),
  imagemCount: z.number().int().min(1, 'Adicione pelo menos uma imagem.').max(MAX_IMAGES_PER_SERVICE, 'Adicione até cinco imagens.'),
}).superRefine((service, context) => {
  if (service.tipoPreco === 'a_combinar') return;
  if (service.precoMinimo === null || service.precoMinimo <= 0) {
    context.addIssue({ code: 'custom', path: ['precoMinimo'], message: 'Informe um preço maior que zero.' });
  }
  if (service.precoMaximo !== null && service.precoMinimo !== null && service.precoMaximo < service.precoMinimo) {
    context.addIssue({ code: 'custom', path: ['precoMaximo'], message: 'O preço máximo deve ser maior ou igual ao mínimo.' });
  }
});

export function validateProfile(profile: ProfileDraft) {
  return profileSchema.safeParse(profile);
}

export function validateService(service: ServiceDraft) {
  return serviceSchema.safeParse(service);
}

export function validateSubmission(input: {
  profile: ProfileDraft;
  services: ServiceDraft[];
  email: string;
  termsAccepted: boolean;
  serviceTermsAccepted: boolean;
  privacyAccepted: boolean;
  publicationConsent: boolean;
}) {
  const result = z.object({
    profile: profileSchema,
    services: z.array(serviceSchema).min(1, 'Adicione pelo menos um serviço.').max(MAX_SERVICES, 'Você pode cadastrar até dois serviços.'),
    email: z.string().trim().email('Informe um e-mail válido.'),
    termsAccepted: z.literal(true, { error: 'Aceite os Termos de Uso.' }),
    serviceTermsAccepted: z.literal(true, { error: 'Aceite os Termos de Serviço.' }),
    privacyAccepted: z.literal(true, { error: 'Aceite a Política de Privacidade.' }),
    publicationConsent: z.literal(true, { error: 'Autorize a publicação do serviço.' }),
  }).safeParse(input);

  return result;
}
