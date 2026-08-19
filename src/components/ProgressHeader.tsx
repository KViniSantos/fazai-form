import type { WizardStep } from '@/hooks/usePreRegistration';

const labels: Array<{ step: WizardStep; label: string }> = [
  { step: 'profile', label: 'Perfil' },
  { step: 'service', label: 'Serviço' },
  { step: 'images', label: 'Imagens' },
  { step: 'review', label: 'Revisão' },
  { step: 'otp', label: 'Confirmação' },
];

export default function ProgressHeader({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = Math.max(labels.findIndex(({ step }) => step === currentStep), 0);
  return (
    <div className="progress-header" aria-label="Progresso do cadastro">
      <div className="progress-header__track" aria-hidden="true">
        <span style={{ width: `${(currentIndex / (labels.length - 1)) * 100}%` }} />
      </div>
      <div className="progress-header__labels">
        {labels.map((item, index) => (
          <span key={item.step} className={index <= currentIndex ? 'is-active' : ''}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
