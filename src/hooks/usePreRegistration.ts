import { useEffect, useReducer, useRef } from 'react';
import { MAX_SERVICES } from '@/domain/constants';
import {
  makeEmptyAddress,
  makeEmptyProfile,
  makeEmptyService,
  type PreparedImage,
  type ProfileDraft,
  type ServiceDraft,
  type SubmissionResult,
} from '@/domain/types';

export const DRAFT_STORAGE_KEY = 'fazai:provider-preregistration';
export const DRAFT_VERSION = 1;

export type WizardStep = 'landing' | 'profile' | 'service' | 'images' | 'review' | 'otp' | 'success';

export interface PreRegistrationState {
  step: WizardStep;
  profile: ProfileDraft;
  services: ServiceDraft[];
  activeServiceIndex: number;
  email: string;
  verifiedUserId: string | null;
  termsAccepted: boolean;
  serviceTermsAccepted: boolean;
  privacyAccepted: boolean;
  publicationConsent: boolean;
  submitted: boolean;
  result: SubmissionResult | null;
}

export type PreRegistrationAction =
  | { type: 'START' }
  | { type: 'UPDATE_PROFILE'; patch: Partial<ProfileDraft> }
  | { type: 'UPDATE_SERVICE'; index: number; patch: Partial<ServiceDraft> }
  | { type: 'ADD_SERVICE' }
  | { type: 'REMOVE_SERVICE'; index: number }
  | { type: 'SET_ACTIVE_SERVICE'; index: number }
  | { type: 'SET_IMAGES'; index: number; images: PreparedImage[] }
  | { type: 'SET_CONSENTS'; patch: Partial<Pick<PreRegistrationState, 'termsAccepted' | 'serviceTermsAccepted' | 'privacyAccepted' | 'publicationConsent'>> }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GO_TO_STEP'; step: WizardStep }
  | { type: 'REQUEST_OTP'; email: string }
  | { type: 'VERIFY_OTP'; userId: string }
  | { type: 'SUBMIT_SUCCESS'; result: SubmissionResult }
  | { type: 'RESET' };

export const initialPreRegistrationState: PreRegistrationState = {
  step: 'landing',
  profile: makeEmptyProfile(),
  services: [makeEmptyService()],
  activeServiceIndex: 0,
  email: '',
  verifiedUserId: null,
  termsAccepted: false,
  serviceTermsAccepted: false,
  privacyAccepted: false,
  publicationConsent: false,
  submitted: false,
  result: null,
};

const steps: WizardStep[] = ['landing', 'profile', 'service', 'images', 'review', 'otp', 'success'];

function updateServiceAt(state: PreRegistrationState, index: number, service: ServiceDraft): PreRegistrationState {
  if (index < 0 || index >= state.services.length) return state;
  const services = state.services.slice();
  services[index] = service;
  return { ...state, services };
}

export function preRegistrationReducer(
  state: PreRegistrationState,
  action: PreRegistrationAction,
): PreRegistrationState {
  if (state.submitted && action.type !== 'RESET') return state;

  switch (action.type) {
    case 'START':
      return { ...state, step: 'profile' };
    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'UPDATE_SERVICE': {
      const current = state.services[action.index];
      if (!current) return state;
      return updateServiceAt(state, action.index, { ...current, ...action.patch });
    }
    case 'ADD_SERVICE':
      if (state.services.length >= MAX_SERVICES) return state;
      return {
        ...state,
        services: [...state.services, makeEmptyService()],
        activeServiceIndex: state.activeServiceIndex,
      };
    case 'REMOVE_SERVICE':
      if (state.services.length <= 1 || !state.services[action.index]) return state;
      return {
        ...state,
        services: state.services.filter((_, index) => index !== action.index),
        activeServiceIndex: Math.min(state.activeServiceIndex, state.services.length - 2),
      };
    case 'SET_ACTIVE_SERVICE':
      return {
        ...state,
        activeServiceIndex: Math.max(0, Math.min(action.index, state.services.length - 1)),
      };
    case 'SET_IMAGES': {
      const service = state.services[action.index];
      if (!service) return state;
      return updateServiceAt(state, action.index, {
        ...service,
        imagens: action.images,
        imagemCount: action.images.length,
      });
    }
    case 'SET_CONSENTS':
      return { ...state, ...action.patch };
    case 'NEXT': {
      const nextIndex = Math.min(steps.indexOf(state.step) + 1, steps.length - 1);
      return { ...state, step: steps[nextIndex] };
    }
    case 'BACK': {
      const previousIndex = Math.max(steps.indexOf(state.step) - 1, 0);
      return { ...state, step: steps[previousIndex] };
    }
    case 'GO_TO_STEP':
      return { ...state, step: action.step };
    case 'REQUEST_OTP':
      return { ...state, email: action.email.trim().toLowerCase(), step: 'otp' };
    case 'VERIFY_OTP':
      return { ...state, verifiedUserId: action.userId };
    case 'SUBMIT_SUCCESS':
      return { ...state, submitted: true, result: action.result, step: 'success' };
    case 'RESET':
      return { ...initialPreRegistrationState, profile: makeEmptyProfile(), services: [makeEmptyService()] };
    default:
      return state;
  }
}

interface PersistedDraft {
  version: number;
  step: WizardStep;
  profile: ProfileDraft;
  services: Array<Omit<ServiceDraft, 'imagens'> & { imagens: [] }>;
  activeServiceIndex: number;
  email: string;
  termsAccepted: boolean;
  serviceTermsAccepted: boolean;
  privacyAccepted: boolean;
  publicationConsent: boolean;
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function toPersistedDraft(state: PreRegistrationState): PersistedDraft {
  return {
    version: DRAFT_VERSION,
    step: state.step,
    profile: state.profile,
    services: state.services.map((service) => ({
      ...service,
      imagens: [],
      imagemCount: 0,
    })),
    activeServiceIndex: state.activeServiceIndex,
    email: state.email,
    termsAccepted: state.termsAccepted,
    serviceTermsAccepted: state.serviceTermsAccepted,
    privacyAccepted: state.privacyAccepted,
    publicationConsent: state.publicationConsent,
  };
}

export function saveDraft(state: PreRegistrationState, storage?: Storage): void {
  const target = resolveStorage(storage);
  if (!target || state.submitted) return;
  target.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toPersistedDraft(state)));
}

export function loadDraft(storage?: Storage): PreRegistrationState | null {
  const target = resolveStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedDraft>;
    if (parsed.version !== DRAFT_VERSION || !parsed.profile || !Array.isArray(parsed.services)) return null;

    const services = parsed.services
      .slice(0, MAX_SERVICES)
      .map((service) => ({ ...makeEmptyService(), ...service, imagens: [], imagemCount: 0 }));
    return {
      ...initialPreRegistrationState,
      step: steps.includes(parsed.step ?? 'landing') ? parsed.step ?? 'landing' : 'landing',
      profile: {
        ...makeEmptyProfile(),
        ...parsed.profile,
        address: { ...makeEmptyAddress(), ...parsed.profile.address },
      },
      services: services.length > 0 ? services : [makeEmptyService()],
      activeServiceIndex: Math.min(parsed.activeServiceIndex ?? 0, Math.max(services.length - 1, 0)),
      email: parsed.email ?? '',
      termsAccepted: parsed.termsAccepted ?? false,
      serviceTermsAccepted: parsed.serviceTermsAccepted ?? false,
      privacyAccepted: parsed.privacyAccepted ?? false,
      publicationConsent: parsed.publicationConsent ?? false,
    };
  } catch {
    return null;
  }
}

export function clearDraft(storage?: Storage): void {
  resolveStorage(storage)?.removeItem(DRAFT_STORAGE_KEY);
}

export function usePreRegistration(storage?: Storage) {
  const storageRef = useRef<Storage | undefined>(storage);
  const [state, dispatch] = useReducer(
    preRegistrationReducer,
    undefined,
    () => loadDraft(storageRef.current) ?? initialPreRegistrationState,
  );

  useEffect(() => {
    if (state.submitted) clearDraft(storageRef.current);
    else saveDraft(state, storageRef.current);
  }, [state]);

  return { state, dispatch };
}
