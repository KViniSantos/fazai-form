import { useCallback, useEffect, useState } from 'react';
import LandingPage from '@/pages/LandingPage';
import PreRegistrationWizard from '@/components/PreRegistrationWizard';
import { usePreRegistration } from '@/hooks/usePreRegistration';
import { createDefaultAppDependencies } from '@/infrastructure/appDependencies';
import type { PreRegistrationAppDependencies } from '@/infrastructure/appDependencies';

export type { PreRegistrationAppDependencies } from '@/infrastructure/appDependencies';

interface AppProps {
  dependencies?: PreRegistrationAppDependencies;
  storage?: Storage;
}

export default function App({ dependencies: providedDependencies, storage }: AppProps) {
  const { state, dispatch } = usePreRegistration(storage);
  const [dependencies, setDependencies] = useState<PreRegistrationAppDependencies | null>(providedDependencies ?? null);
  const [dependencyError, setDependencyError] = useState('');

  const initialize = useCallback(() => {
    if (dependencies) return true;
    try {
      setDependencies(createDefaultAppDependencies());
      setDependencyError('');
      return true;
    } catch (caughtError) {
      setDependencyError(caughtError instanceof Error ? caughtError.message : 'Configure o ambiente do pré-cadastro.');
      return false;
    }
  }, [dependencies]);

  useEffect(() => {
    if (state.step !== 'landing') initialize();
  }, [initialize, state.step]);

  if (state.step === 'landing') {
    return <LandingPage onStart={() => { if (initialize()) dispatch({ type: 'START' }); }} siteUrl={dependencies?.siteUrl} />;
  }

  if (!dependencies) {
    return <main className="wizard-shell"><p className="error-notice" role="alert">{dependencyError || 'Preparando o cadastro…'}</p></main>;
  }

  return <PreRegistrationWizard state={state} dispatch={dispatch} dependencies={dependencies} />;
}
