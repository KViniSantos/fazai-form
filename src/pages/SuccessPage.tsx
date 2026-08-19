import BrandMark from '@/components/BrandMark';

export default function SuccessPage({ serviceCount = 1 }: { serviceCount?: number }) {
  return (
    <main className="success-shell">
      <BrandMark />
      <div className="success-icon" aria-hidden="true">✓</div>
      <p className="eyebrow">Cadastro recebido</p>
      <h1>Seu serviço está aguardando análise</h1>
      <p>Recebemos {serviceCount === 1 ? 'seu serviço' : `seus ${serviceCount} serviços`}. A equipe do FazAí vai revisar as informações e as imagens antes da publicação em Fortaleza.</p>
      <p className="success-muted">Depois da aprovação, você poderá acessar a mesma conta pelo site ou aplicativo. Não há alterações disponíveis neste momento.</p>
    </main>
  );
}
