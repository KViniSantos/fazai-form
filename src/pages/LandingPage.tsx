import BrandMark from '@/components/BrandMark';

interface LandingPageProps {
  onStart: () => void;
  siteUrl?: string;
}

export default function LandingPage({ onStart, siteUrl = import.meta.env.VITE_SITE_URL || '' }: LandingPageProps) {
  const link = (path: string) => `${siteUrl.replace(/\/$/, '')}${path}` || path;

  return (
    <main className="public-shell">
      <header className="public-header"><BrandMark /><span>Pré-lançamento em Fortaleza</span></header>
      <section className="landing-hero" aria-labelledby="landing-title">
        <p className="eyebrow">Oferta inicial FazAí</p>
        <h1 id="landing-title">Cadastre seu serviço no FazAí</h1>
        <p className="landing-lede">
          Uma plataforma para conectar pessoas que precisam de serviços a profissionais que oferecem seu trabalho.
        </p>
        <div className="landing-actions">
          <button type="button" className="primary-button" onClick={onStart}>Começar cadastro</button>
          <span>Gratuito e feito para profissionais de Fortaleza.</span>
        </div>
      </section>

      <section className="benefit-grid" aria-label="Informações do pré-lançamento">
        <article><strong>Gratuito</strong><span>Cadastre seu trabalho sem custo nesta fase.</span></article>
        <article><strong>Primeiros profissionais</strong><span>Faça parte da construção da oferta inicial do FazAí.</span></article>
        <article><strong>Até 2 serviços</strong><span>Você pode enviar até dois serviços por conta.</span></article>
        <article><strong>Até 5 imagens</strong><span>Mostre seu serviço com imagens leves e preparadas.</span></article>
      </section>

      <section className="landing-note">
        <h2>Como funciona</h2>
        <p>O cadastro é enviado para análise antes da publicação. Nesta fase, o foco é Fortaleza/CE; a aprovação é individual para cada serviço.</p>
        <nav className="legal-links" aria-label="Informações legais">
          <a href={link('/termos')}>Termos de Uso</a>
          <a href={link('/termos-de-servico')}>Termos de Serviço</a>
          <a href={link('/privacidade')}>Política de Privacidade</a>
        </nav>
      </section>
    </main>
  );
}
