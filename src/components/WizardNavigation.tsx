interface WizardNavigationProps {
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  isNextDisabled?: boolean;
}

export default function WizardNavigation({ onBack, onNext, nextLabel = 'Continuar', isNextDisabled = false }: WizardNavigationProps) {
  return (
    <div className="wizard-navigation">
      <button type="button" className="secondary-button" onClick={onBack}>Voltar</button>
      {onNext ? <button type="button" className="primary-button" onClick={onNext} disabled={isNextDisabled}>{nextLabel}</button> : null}
    </div>
  );
}
