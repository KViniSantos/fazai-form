export type PriceType = 'fixo' | 'por_hora' | 'a_combinar';
export type DocumentType = '' | 'cpf' | 'cnpj';

export interface AddressDraft {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
}

export interface ProfileDraft {
  nome: string;
  sobrenome: string;
  dataNascimento: string;
  telefone: string;
  whatsapp: string;
  documento: string;
  tipoDocumento: DocumentType;
  address: AddressDraft;
}

export interface PreparedImage {
  id: string;
  name: string;
  type: 'image/webp' | 'image/jpeg';
  size: number;
  file: Blob;
  previewUrl?: string;
}

export interface ServiceDraft {
  titulo: string;
  descricao: string;
  categoriaId: string;
  cidadeId: string;
  cidadeNome: string;
  estado: string;
  tipoPreco: PriceType;
  precoMinimo: number | null;
  precoMaximo: number | null;
  atendimentoRemoto: boolean;
  horarioAtendimento: string;
  atendeEmergencia: boolean;
  atendeFimDeSemana: boolean;
  whatsapp: string;
  emailContato: string;
  exibirEmailContato: boolean;
  imagens: PreparedImage[];
  imagemCount: number;
}

export interface PreRegistrationDraft {
  profile: ProfileDraft;
  email: string;
  services: ServiceDraft[];
  termsAccepted: boolean;
  serviceTermsAccepted: boolean;
  privacyAccepted: boolean;
  publicationConsent: boolean;
}

export interface SubmissionResult {
  userId: string;
  serviceIds: string[];
  status: 'pendente';
}

export function makeEmptyAddress(): AddressDraft {
  return {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
  };
}

export function makeEmptyProfile(): ProfileDraft {
  return {
    nome: '',
    sobrenome: '',
    dataNascimento: '',
    telefone: '',
    whatsapp: '',
    documento: '',
    tipoDocumento: '',
    address: makeEmptyAddress(),
  };
}

export function makeEmptyService(): ServiceDraft {
  return {
    titulo: '',
    descricao: '',
    categoriaId: '',
    cidadeId: '',
    cidadeNome: 'Fortaleza',
    estado: 'CE',
    tipoPreco: 'a_combinar',
    precoMinimo: null,
    precoMaximo: null,
    atendimentoRemoto: false,
    horarioAtendimento: '08:00 às 18:00',
    atendeEmergencia: false,
    atendeFimDeSemana: false,
    whatsapp: '',
    emailContato: '',
    exibirEmailContato: true,
    imagens: [],
    imagemCount: 0,
  };
}
