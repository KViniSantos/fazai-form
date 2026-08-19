import FormField from '@/components/FormField';
import type { ServiceCategory } from '@/infrastructure/supabase/catalogRepository';
import type { PriceType, ServiceDraft } from '@/domain/types';

interface ServiceDetailsStepProps {
  service: ServiceDraft;
  categories: ServiceCategory[];
  onChange: (patch: Partial<ServiceDraft>) => void;
}

export default function ServiceDetailsStep({ service, categories, onChange }: ServiceDetailsStepProps) {
  return (
    <section className="form-card" aria-labelledby="service-title">
      <div className="section-heading"><p className="eyebrow">Etapa 2 de 4</p><h2 id="service-title">Descreva seu serviço</h2><p>Conte com clareza o que você oferece para clientes de Fortaleza.</p></div>
      <FormField label="Categoria" htmlFor="service-category" required><select id="service-category" value={service.categoriaId} onChange={(event) => onChange({ categoriaId: event.target.value })} required><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</select></FormField>
      <FormField label="Nome do serviço" htmlFor="service-name" required><input id="service-name" value={service.titulo} onChange={(event) => onChange({ titulo: event.target.value })} maxLength={60} required /></FormField>
      <FormField label="Descrição" htmlFor="service-description" required hint="Use pelo menos 100 caracteres para explicar seu trabalho, experiência e o que está incluído."><textarea id="service-description" value={service.descricao} onChange={(event) => onChange({ descricao: event.target.value })} minLength={100} maxLength={2000} rows={7} required /></FormField>
      <div className="form-grid two-columns">
        <FormField label="Tipo de preço" htmlFor="service-price-type" required><select id="service-price-type" value={service.tipoPreco} onChange={(event) => onChange({ tipoPreco: event.target.value as PriceType })} required><option value="a_combinar">A combinar</option><option value="fixo">Preço fixo</option><option value="por_hora">Por hora</option></select></FormField>
        <div className="location-lock" aria-label="Localização fixa">Atendimento em <strong>Fortaleza/CE</strong><small>O foco desta etapa é uma única cidade.</small></div>
      </div>
      <div className="form-grid two-columns">
        <FormField label="Preço mínimo" htmlFor="service-min-price" hint="Opcional quando o preço é a combinar."><input id="service-min-price" type="number" min="0" step="0.01" value={service.precoMinimo ?? ''} onChange={(event) => onChange({ precoMinimo: event.target.value ? Number(event.target.value) : null })} /></FormField>
        <FormField label="Preço máximo" htmlFor="service-max-price"><input id="service-max-price" type="number" min="0" step="0.01" value={service.precoMaximo ?? ''} onChange={(event) => onChange({ precoMaximo: event.target.value ? Number(event.target.value) : null })} /></FormField>
      </div>
    </section>
  );
}
