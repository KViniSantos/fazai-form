import ServiceSummaryCard from '@/components/ServiceSummaryCard';
import type { ProfileDraft, ServiceDraft } from '@/domain/types';

type ConsentState = {
  termsAccepted: boolean;
  serviceTermsAccepted: boolean;
  privacyAccepted: boolean;
  publicationConsent: boolean;
};

interface ReviewStepProps {
  profile: ProfileDraft;
  services: ServiceDraft[];
  consents: ConsentState;
  onConsentChange: (patch: Partial<ConsentState>) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export default function ReviewStep({ profile, services, consents, onConsentChange, onSubmit, isSubmitting = false }: ReviewStepProps) {
  const allConsents = Object.values(consents).every(Boolean);
  return (
    <section className="form-card" aria-labelledby="review-title">
      <div className="section-heading"><p className="eyebrow">Etapa 4 de 4</p><h2 id="review-title">Revise antes de enviar</h2><p>Confira os dados que serão encaminhados para análise.</p></div>
      <div className="review-provider"><span>Prestador</span><strong>{`${profile.nome} ${profile.sobrenome}`.trim() || 'Nome não informado'}</strong><small>{profile.whatsapp || profile.telefone || 'Contato não informado'}</small></div>
      <div className="summary-list">{services.map((service, index) => <ServiceSummaryCard key={`${service.titulo}-${index}`} service={service} index={index} />)}</div>
      <div className="review-lock-notice"><strong>Importante</strong><p>Após o envio, os dados ficarão bloqueados para edição e serão encaminhados para análise administrativa.</p></div>
      <fieldset className="consent-list"><legend>Confirmações necessárias</legend>
        <label className="check-row"><input type="checkbox" checked={consents.termsAccepted} onChange={(event) => onConsentChange({ termsAccepted: event.target.checked })} /> Aceito os Termos de Uso.</label>
        <label className="check-row"><input type="checkbox" checked={consents.serviceTermsAccepted} onChange={(event) => onConsentChange({ serviceTermsAccepted: event.target.checked })} /> Aceito os Termos de Serviço.</label>
        <label className="check-row"><input type="checkbox" checked={consents.privacyAccepted} onChange={(event) => onConsentChange({ privacyAccepted: event.target.checked })} /> Li e aceito a Política de Privacidade.</label>
        <label className="check-row"><input type="checkbox" checked={consents.publicationConsent} onChange={(event) => onConsentChange({ publicationConsent: event.target.checked })} /> Autorizo a publicação dos dados e imagens do serviço no FazAí.</label>
      </fieldset>
      <button type="button" className="primary-button full-width" disabled={!allConsents || isSubmitting} onClick={onSubmit}>{isSubmitting ? 'Enviando…' : 'Enviar cadastro'}</button>
    </section>
  );
}
