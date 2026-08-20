import { useEffect, useMemo, useState, type Dispatch } from 'react';
import BrandMark from '@/components/BrandMark';
import ErrorNotice from '@/components/ErrorNotice';
import ProgressHeader from '@/components/ProgressHeader';
import WizardNavigation from '@/components/WizardNavigation';
import ProfileStep from '@/components/steps/ProfileStep';
import ReviewStep from '@/components/steps/ReviewStep';
import ServiceAvailabilityStep from '@/components/steps/ServiceAvailabilityStep';
import ServiceDetailsStep from '@/components/steps/ServiceDetailsStep';
import ServiceImagesStep from '@/components/steps/ServiceImagesStep';
import OtpStep from '@/components/steps/OtpStep';
import SuccessPage from '@/pages/SuccessPage';
import { MAX_SERVICES } from '@/domain/constants';
import { issuesToFieldErrors, validateProfile, validateService, type FieldErrors } from '@/domain/validation';
import type { SubmissionServiceInput } from '@/infrastructure/supabase/preRegistrationRepository';
import type { PreRegistrationState, PreRegistrationAction } from '@/hooks/usePreRegistration';
import type { ServiceCategory, FortalezaCity } from '@/infrastructure/supabase/catalogRepository';
import type { PreRegistrationAppDependencies } from '@/infrastructure/appDependencies';
import type { ServiceDraft } from '@/domain/types';

interface PreRegistrationWizardProps {
  state: PreRegistrationState;
  dispatch: Dispatch<PreRegistrationAction>;
  dependencies: PreRegistrationAppDependencies;
}

function firstIssue(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string {
  return result.success ? '' : result.error?.issues[0]?.message || 'Revise os campos desta etapa.';
}

export default function PreRegistrationWizard({ state, dispatch, dependencies }: PreRegistrationWizardProps) {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [fortaleza, setFortaleza] = useState<FortalezaCity | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [serviceErrors, setServiceErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    Promise.all([dependencies.catalog.loadCategories(), dependencies.catalog.loadFortaleza()])
      .then(([loadedCategories, loadedFortaleza]) => {
        if (!active) return;
        setCategories(loadedCategories);
        setFortaleza(loadedFortaleza);
      })
      .catch((caughtError) => {
        if (active) setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível carregar os dados do cadastro.');
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => { active = false; };
  }, [dependencies]);

  useEffect(() => {
    if (!fortaleza) return;
    state.services.forEach((service, index) => {
      if (service.cidadeId !== fortaleza.id || service.cidadeNome !== fortaleza.nome || service.estado !== fortaleza.estado) {
        dispatch({ type: 'UPDATE_SERVICE', index, patch: { cidadeId: fortaleza.id, cidadeNome: fortaleza.nome, estado: fortaleza.estado, atendimentoRemoto: false } });
      }
    });
  }, [fortaleza, state.services, dispatch]);

  const currentService = state.services[state.activeServiceIndex] ?? state.services[0];
  const isCatalogReady = !catalogLoading && Boolean(fortaleza);
  const consentState = useMemo(() => ({
    termsAccepted: state.termsAccepted,
    serviceTermsAccepted: state.serviceTermsAccepted,
    privacyAccepted: state.privacyAccepted,
    publicationConsent: state.publicationConsent,
  }), [state.termsAccepted, state.serviceTermsAccepted, state.privacyAccepted, state.publicationConsent]);

  if (state.submitted || state.step === 'success') return <SuccessPage serviceCount={state.result?.serviceIds.length ?? state.services.length} />;

  const goBack = () => {
    setError('');
    if (state.step === 'service' && state.activeServiceIndex > 0) {
      dispatch({ type: 'SET_ACTIVE_SERVICE', index: state.activeServiceIndex - 1 });
      dispatch({ type: 'GO_TO_STEP', step: 'images' });
      return;
    }
    dispatch({ type: 'BACK' });
  };

  const goFromProfile = () => {
    const validation = validateProfile(state.profile);
    if (!validation.success) {
      setProfileErrors(issuesToFieldErrors(validation));
      setError('');
      return;
    }
    setProfileErrors({});
    setError('');
    dispatch({ type: 'NEXT' });
  };

  const goFromService = () => {
    if (!currentService) { setError('Adicione pelo menos um serviço.'); return; }
    if (!isCatalogReady || !fortaleza) { setError('Aguarde o carregamento das categorias e da cidade.'); return; }
    const validation = validateService({ ...currentService, cidadeId: fortaleza.id, cidadeNome: fortaleza.nome, estado: fortaleza.estado, imagemCount: Math.max(1, currentService.imagemCount) });
    if (!validation.success) {
      setServiceErrors(issuesToFieldErrors(validation));
      setError('');
      return;
    }
    setServiceErrors({});
    setError('');
    dispatch({ type: 'NEXT' });
  };

  const goFromImages = () => {
    if (!currentService || currentService.imagens.length < 1) {
      setError('Adicione pelo menos uma imagem para este serviço.');
      return;
    }
    setError('');
    if (state.activeServiceIndex < state.services.length - 1) {
      dispatch({ type: 'SET_ACTIVE_SERVICE', index: state.activeServiceIndex + 1 });
      dispatch({ type: 'GO_TO_STEP', step: 'service' });
    } else {
      dispatch({ type: 'GO_TO_STEP', step: 'review' });
    }
  };

  const goFromReview = () => {
    const profileValidation = validateProfile(state.profile);
    if (!profileValidation.success) { setError(firstIssue(profileValidation)); return; }
    const serviceValidation = state.services
      .map((service) => validateService(service))
      .find((validation) => !validation.success);
    if (serviceValidation && !serviceValidation.success) { setError(firstIssue(serviceValidation)); return; }
    if (!Object.values(consentState).every(Boolean)) { setError('Aceite todas as confirmações para continuar.'); return; }
    setError('');
    dispatch({ type: 'GO_TO_STEP', step: 'otp' });
  };

  const requestOtp = async (email: string): Promise<boolean> => {
    try {
      await dependencies.repository.requestEmailOtp(email);
      dispatch({ type: 'REQUEST_OTP', email });
      setError('');
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível enviar o código.');
      return false;
    }
  };

  const verifyOtp = async (token: string) => {
    setIsSubmitting(true);
    setError('');
    const uploadedByService: SubmissionServiceInput[] = [];
    const uploadedPaths: string[] = [];
    try {
      const { userId } = await dependencies.repository.verifyEmailOtp(state.email, token);
      dispatch({ type: 'VERIFY_OTP', userId });

      for (const service of state.services) {
        const uploaded = await dependencies.repository.uploadPreparedImages(userId, service.imagens);
        uploadedByService.push({ service, images: uploaded });
        uploadedPaths.push(...uploaded.map((image) => image.path));
      }

      const result = await dependencies.repository.submit({
        userId,
        profile: state.profile,
        services: uploadedByService,
        ...consentState,
      });
      dispatch({ type: 'SUBMIT_SUCCESS', result });
    } catch (caughtError) {
      if (uploadedPaths.length > 0) await dependencies.repository.removeUploadedImages(uploadedPaths);
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateService = (patch: Partial<ServiceDraft>) => {
    if (!currentService) return;
    dispatch({ type: 'UPDATE_SERVICE', index: state.activeServiceIndex, patch });
  };

  return (
    <main className="wizard-shell">
      <header className="wizard-topbar"><BrandMark /><span>Pré-cadastro em Fortaleza</span></header>
      <ProgressHeader currentStep={state.step} />
      <ErrorNotice message={error} />

      {state.step === 'profile' ? <>
        <ProfileStep profile={state.profile} errors={profileErrors} onChange={(patch) => dispatch({ type: 'UPDATE_PROFILE', patch })} />
        <WizardNavigation onBack={goBack} onNext={goFromProfile} />
      </> : null}

      {state.step === 'service' && currentService ? <>
        <div className="service-toolbar"><span>Serviço {state.activeServiceIndex + 1} de {state.services.length}</span><button type="button" className="text-button" onClick={() => dispatch({ type: 'ADD_SERVICE' })} disabled={state.services.length >= MAX_SERVICES}>+ Adicionar outro serviço</button></div>
        <ServiceDetailsStep service={currentService} categories={categories} errors={serviceErrors} onChange={updateService} />
        <ServiceAvailabilityStep service={currentService} onChange={updateService} />
        <WizardNavigation onBack={goBack} onNext={goFromService} isNextDisabled={catalogLoading} />
      </> : null}

      {state.step === 'images' && currentService ? <>
        <ServiceImagesStep service={currentService} onChange={updateService} />
        <WizardNavigation onBack={goBack} onNext={goFromImages} nextLabel={state.activeServiceIndex < state.services.length - 1 ? 'Próximo serviço' : 'Revisar cadastro'} />
      </> : null}

      {state.step === 'review' ? <>
        <ReviewStep profile={state.profile} services={state.services} consents={consentState} onConsentChange={(patch) => dispatch({ type: 'SET_CONSENTS', patch })} onSubmit={goFromReview} />
        <WizardNavigation onBack={goBack} />
      </> : null}

      {state.step === 'otp' ? <>
        <OtpStep initialEmail={state.email} onRequestCode={requestOtp} onVerifyCode={verifyOtp} isLoading={isSubmitting} />
        <WizardNavigation onBack={goBack} />
      </> : null}
    </main>
  );
}
