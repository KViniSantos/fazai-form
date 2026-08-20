import ImagePicker from '@/components/ImagePicker';
import type { ServiceDraft } from '@/domain/types';

export default function ServiceImagesStep({ service, onChange }: { service: ServiceDraft; onChange: (patch: Partial<ServiceDraft>) => void }) {
  return (
    <section className="form-card" aria-labelledby="images-title">
      <div className="section-heading"><p className="eyebrow">Etapa 4 de 6</p><h2 id="images-title">Mostre seu trabalho</h2><p>Adicione pelo menos uma imagem real do serviço. Elas serão compactadas antes do envio.</p></div>
      <ImagePicker images={service.imagens} onChange={(images) => onChange({ imagens: images, imagemCount: images.length })} />
    </section>
  );
}
