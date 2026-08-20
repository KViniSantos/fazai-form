import type { WizardStep } from '@/hooks/usePreRegistration';

const labels: Array<{ step: WizardStep; label: string }> = [
  { step: 'landing', label: 'Boas-vindas' },
  { step: 'profile', label: 'Perfil' },
  { step: 'service', label: 'Serviço' },
  { step: 'images', label: 'Imagens' },
  { step: 'review', label: 'Revisão' },
  { step: 'otp', label: 'Confirmação' },
];

export default function ProgressHeader({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = Math.max(labels.findIndex(({ step }) => step === currentStep), 0);
  const currentLabel = labels[currentIndex].label;

  return (
    <nav className="progress-header" aria-label="Progresso do cadastro">
      <div className="progress-header__mobile">
        <div className="progress-header__mobile-copy">
          <span>Etapa {currentIndex + 1} de {labels.length}</span>
          <strong className="progress-header__mobile-title">{currentLabel}</strong>
        </div>
        <div
          className="progress-header__mobile-track"
          role="progressbar"
          aria-label="Progresso do formulário"
          aria-valuemin={1}
          aria-valuemax={labels.length}
          aria-valuenow={currentIndex + 1}
        >
          <span style={{ width: `${((currentIndex + 1) / labels.length) * 100}%` }} />
        </div>
      </div>

      <ol className="progress-header__steps">
        {labels.map((item, index) => (
          <li key={item.step}>
            <span
              className={`progress-header__marker ${index < currentIndex ? 'is-complete' : index === currentIndex ? 'is-current' : 'is-upcoming'}`}
              aria-hidden="true"
            >
              {index < currentIndex ? '✓' : index + 1}
            </span>
            <span
              className={`progress-header__label ${index < currentIndex ? 'is-complete' : index === currentIndex ? 'is-current' : 'is-upcoming'}`}
              aria-current={index === currentIndex ? 'step' : undefined}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
