import FormField from '@/components/FormField';
import type { ServiceCategory } from '@/infrastructure/supabase/catalogRepository';
import type { PriceType, ServiceDraft } from '@/domain/types';
import type { FieldErrors } from '@/domain/validation';

interface ServiceDetailsStepProps {
  service: ServiceDraft;
  categories: ServiceCategory[];
  onChange: (patch: Partial<ServiceDraft>) => void;
  errors?: FieldErrors;
}

export default function ServiceDetailsStep({ service, categories, onChange, errors = {} }: ServiceDetailsStepProps) {
  const descriptionLength = service.descricao.length;
  const remainingMinimum = Math.max(0, 100 - descriptionLength);

  return (
    <section className="form-card" aria-labelledby="service-title">
      <div className="section-heading"><p className="eyebrow">Etapa 2 de 4</p><h2 id="service-title">Descreva seu serviço</h2><p>Conte com clareza o que você oferece para clientes de Fortaleza.</p></div>
      <FormField label="Categoria" htmlFor="service-category" required error={errors.categoriaId}><select id="service-category" value={service.categoriaId} onChange={(event) => onChange({ categoriaId: event.target.value })} aria-invalid={Boolean(errors.categoriaId)} aria-describedby={errors.categoriaId ? 'service-category-error' : undefined} required><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</select></FormField>
      <FormField label="Nome do serviço" htmlFor="service-name" required error={errors.titulo}><input id="service-name" value={service.titulo} onChange={(event) => onChange({ titulo: event.target.value })} maxLength={60} aria-invalid={Boolean(errors.titulo)} aria-describedby={errors.titulo ? 'service-name-error' : undefined} required /></FormField>
      <FormField label="Descrição" htmlFor="service-description" required error={errors.descricao}>
        <textarea id="service-description" value={service.descricao} onChange={(event) => onChange({ descricao: event.target.value })} minLength={100} maxLength={2000} rows={7} aria-invalid={Boolean(errors.descricao)} aria-describedby={errors.descricao ? 'service-description-error' : 'service-description-count'} required />
        <div id="service-description-count" className="character-count" aria-live="polite"><span>{remainingMinimum > 0 ? `Faltam ${remainingMinimum} caracteres para o mínimo.` : 'Descrição pronta para revisão.'}</span><strong>{descriptionLength.toLocaleString('pt-BR')}/2.000</strong></div>
      </FormField>
      <div className="form-grid two-columns">
        <FormField label="Tipo de preço" htmlFor="service-price-type" required><select id="service-price-type" value={service.tipoPreco} onChange={(event) => onChange({ tipoPreco: event.target.value as PriceType })} required><option value="a_combinar">A combinar</option><option value="fixo">Preço fixo</option><option value="por_hora">Por hora</option></select></FormField>
        <div className="location-lock" aria-label="Localização fixa">Atendimento em <strong>Fortaleza/CE</strong></div>
      </div>
      <div className="form-grid two-columns">
        <FormField label="Preço mínimo" htmlFor="service-min-price" error={errors.precoMinimo} hint="Opcional quando o preço é a combinar."><input className="price-input" id="service-min-price" type="number" min="0" step="0.01" value={service.precoMinimo ?? ''} onChange={(event) => onChange({ precoMinimo: event.target.value ? Number(event.target.value) : null })} aria-invalid={Boolean(errors.precoMinimo)} aria-describedby={errors.precoMinimo ? 'service-min-price-error' : undefined} /></FormField>
        <FormField label="Preço máximo" htmlFor="service-max-price" error={errors.precoMaximo}><input className="price-input" id="service-max-price" type="number" min="0" step="0.01" value={service.precoMaximo ?? ''} onChange={(event) => onChange({ precoMaximo: event.target.value ? Number(event.target.value) : null })} aria-invalid={Boolean(errors.precoMaximo)} aria-describedby={errors.precoMaximo ? 'service-max-price-error' : undefined} /></FormField>
      </div>
    </section>
  );
}
