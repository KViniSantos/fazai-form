import { describe, expect, it, vi } from 'vitest';
import {
  DRAFT_STORAGE_KEY,
  DRAFT_VERSION,
  clearDraft,
  initialPreRegistrationState,
  loadDraft,
  preRegistrationReducer,
  saveDraft,
} from '@/hooks/usePreRegistration';

describe('provider pre-registration wizard state', () => {
  it('starts on landing and preserves profile/service edits while navigating', () => {
    const started = preRegistrationReducer(initialPreRegistrationState, { type: 'START' });
    const withProfile = preRegistrationReducer(started, {
      type: 'UPDATE_PROFILE',
      patch: { nome: 'Ana', sobrenome: 'Silva' },
    });
    const onService = preRegistrationReducer(withProfile, { type: 'NEXT' });
    const withService = preRegistrationReducer(onService, {
      type: 'UPDATE_SERVICE',
      index: 0,
      patch: { titulo: 'Instalação elétrica residencial' },
    });
    const onImages = preRegistrationReducer(withService, { type: 'NEXT' });
    const backOnService = preRegistrationReducer(onImages, { type: 'BACK' });

    expect(initialPreRegistrationState.step).toBe('landing');
    expect(backOnService.step).toBe('service');
    expect(backOnService.profile.nome).toBe('Ana');
    expect(backOnService.services[0]?.titulo).toBe('Instalação elétrica residencial');
  });

  it('allows at most two services', () => {
    const started = preRegistrationReducer(initialPreRegistrationState, { type: 'START' });
    const withSecond = preRegistrationReducer(started, { type: 'ADD_SERVICE' });
    const withThird = preRegistrationReducer(withSecond, { type: 'ADD_SERVICE' });

    expect(withSecond.services).toHaveLength(2);
    expect(withSecond.activeServiceIndex).toBe(0);
    expect(withThird.services).toHaveLength(2);
  });

  it('can route the wizard to a specific service without changing the draft', () => {
    const started = preRegistrationReducer(initialPreRegistrationState, { type: 'START' });
    const withSecond = preRegistrationReducer(started, { type: 'ADD_SERVICE' });
    const onSecond = preRegistrationReducer(withSecond, { type: 'SET_ACTIVE_SERVICE', index: 1 });
    const onSecondService = preRegistrationReducer(onSecond, { type: 'GO_TO_STEP', step: 'service' });

    expect(onSecondService.activeServiceIndex).toBe(1);
    expect(onSecondService.step).toBe('service');
    expect(onSecondService.services).toHaveLength(2);
  });

  it('persists only the serializable draft and restores the current version', () => {
    const storageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = storageMock as unknown as Storage;
    const state = preRegistrationReducer(initialPreRegistrationState, {
      type: 'UPDATE_SERVICE',
      index: 0,
      patch: { titulo: 'Serviço salvo' },
    });

    saveDraft(state, storage);
    expect(storageMock.setItem).toHaveBeenCalledWith(DRAFT_STORAGE_KEY, expect.any(String));
    const serialized = JSON.parse(storageMock.setItem.mock.calls[0]?.[1] as string) as Record<string, unknown>;
    expect(serialized.version).toBe(DRAFT_VERSION);
    expect(serialized).not.toHaveProperty('otp');
    expect(serialized.services).toEqual([expect.not.objectContaining({ file: expect.anything() })]);

    storageMock.getItem.mockReturnValue(JSON.stringify(serialized));
    expect(loadDraft(storage)?.services[0]?.titulo).toBe('Serviço salvo');
    storageMock.getItem.mockReturnValue(JSON.stringify({ ...serialized, version: DRAFT_VERSION + 1 }));
    expect(loadDraft(storage)).toBeNull();
    clearDraft(storage);
    expect(storageMock.removeItem).toHaveBeenCalledWith(DRAFT_STORAGE_KEY);
  });

  it('refuses edits after submission and only RESET can unlock the state', () => {
    const submitted = preRegistrationReducer(initialPreRegistrationState, {
      type: 'SUBMIT_SUCCESS',
      result: { userId: 'user-1', serviceIds: ['service-1'], status: 'pendente' },
    });
    const edited = preRegistrationReducer(submitted, {
      type: 'UPDATE_PROFILE',
      patch: { nome: 'Tentativa' },
    });
    const reset = preRegistrationReducer(submitted, { type: 'RESET' });

    expect(submitted.submitted).toBe(true);
    expect(edited).toEqual(submitted);
    expect(reset.submitted).toBe(false);
    expect(reset.step).toBe('landing');
  });
});
