import type { ServiceDraft } from '@/domain/types';

function formatPrice(service: ServiceDraft): string {
  if (service.tipoPreco === 'a_combinar') return 'A combinar';
  if (service.precoMinimo === null) return 'Preço não informado';
  const minimum = service.precoMinimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (service.precoMaximo === null) return minimum;
  return `${minimum} – ${service.precoMaximo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
}

export default function ServiceSummaryCard({ service, index }: { service: ServiceDraft; index: number }) {
  return (
    <article className="summary-card">
      <div className="summary-card__heading"><span>Serviço {index + 1}</span><strong>{service.titulo || 'Sem título'}</strong></div>
      <p>{service.descricao || 'Descrição não preenchida.'}</p>
      <dl><div><dt>Preço</dt><dd>{formatPrice(service)}</dd></div><div><dt>Localização</dt><dd>Fortaleza/CE</dd></div><div><dt>Imagens</dt><dd>{service.imagens.length} de 5</dd></div></dl>
      {service.imagens[0]?.previewUrl ? <img src={service.imagens[0].previewUrl} alt={`Imagem do serviço ${index + 1}`} /> : null}
    </article>
  );
}
