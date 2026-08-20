import FormField from '@/components/FormField';
import type { ServiceDraft } from '@/domain/types';

export default function ServiceAvailabilityStep({ service, onChange }: { service: ServiceDraft; onChange: (patch: Partial<ServiceDraft>) => void }) {
  return (
    <section className="form-card" aria-labelledby="availability-title">
      <div className="section-heading"><p className="eyebrow">Disponibilidade e contato</p><h2 id="availability-title">Quando você atende?</h2><p>O WhatsApp informado no primeiro passo será usado como contato dos seus serviços.</p></div>
      <FormField label="Horário de atendimento" htmlFor="service-hours"><input id="service-hours" value={service.horarioAtendimento} onChange={(event) => onChange({ horarioAtendimento: event.target.value })} /></FormField>
      <FormField label="E-mail de contato" htmlFor="service-email"><input id="service-email" type="email" value={service.emailContato} onChange={(event) => onChange({ emailContato: event.target.value })} /></FormField>
      <label className="check-row"><input type="checkbox" checked={service.atendeEmergencia} onChange={(event) => onChange({ atendeEmergencia: event.target.checked })} /> Atendo chamadas de emergência</label>
      <label className="check-row"><input type="checkbox" checked={service.atendeFimDeSemana} onChange={(event) => onChange({ atendeFimDeSemana: event.target.checked })} /> Atendo aos fins de semana</label>
    </section>
  );
}
