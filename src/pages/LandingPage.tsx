import BrandMark from '@/components/BrandMark';
import ProgressHeader from '@/components/ProgressHeader';

interface LandingPageProps {
  onStart: () => void;
  siteUrl?: string;
}

export default function LandingPage({ onStart, siteUrl = import.meta.env.VITE_SITE_URL || '' }: LandingPageProps) {
  const link = (path: string) => `${siteUrl.replace(/\/$/, '')}${path}` || path;

  return (
    <main className="public-shell">
      <header className="public-header"><BrandMark /><span>Pré-lançamento em Fortaleza</span></header>
      <ProgressHeader currentStep="landing" />
      <section className="landing-hero" aria-labelledby="landing-title">
        <p className="eyebrow">Oferta inicial FazAí</p>
        <h1 id="landing-title">Cadastre seu serviço no FazAí</h1>
        <p className="landing-lede">
          Uma plataforma para conectar pessoas que precisam de serviços a profissionais que oferecem seu trabalho.
        </p>
        <section className="landing-note landing-note--how-it-works" aria-labelledby="how-it-works-title">
          <h2 id="how-it-works-title">Como funciona</h2>
          <ol>
            <li><strong>Conte sobre o seu trabalho.</strong> Preencha seu perfil e os dados do serviço que você oferece.</li>
            <li><strong>Mostre o que você faz.</strong> Adicione fotos reais para apresentar o seu serviço.</li>
            <li><strong>Confirme seu e-mail.</strong> Revise as informações e use o código enviado para concluir.</li>
          </ol>
          <p>Cada serviço é analisado antes da publicação para manter a qualidade da plataforma.</p>
        </section>
        <div className="landing-actions">
          <button type="button" className="primary-button" onClick={onStart}>Começar cadastro</button>
          <span>Gratuito e feito para profissionais de Fortaleza.</span>
        </div>
      </section>

      <section className="benefit-grid" aria-label="Informações do pré-lançamento">
        <article><strong>Gratuito</strong><span>Cadastre seu trabalho de graça.</span></article>
        <article><strong>Primeiros profissionais</strong><span>Faça parte da construção da oferta inicial do FazAí.</span></article>
      </section>

      <section className="landing-note">
        <nav className="legal-links" aria-label="Informações legais">
          <a href={link('/termos')}>Termos de Uso</a>
          <a href={link('/termos-de-servico')}>Termos de Serviço</a>
          <a href={link('/privacidade')}>Política de Privacidade</a>
        </nav>
      </section>

      <section className="launch-callout" aria-label="Lançamento do aplicativo FazAí">
        <div className="launch-callout__logos">
          <BrandMark />
          <span className="launch-callout__plus" aria-hidden="true">+</span>
          <svg className="play-store-logo" role="img" aria-label="Google Play" viewBox="0 0 48 48">
            <path fill="#34A853" d="M4 4.8 27.7 24 4 43.2c-.7-.8-1.1-1.9-1.1-3.2V8c0-1.3.4-2.4 1.1-3.2Z" />
            <path fill="#4285F4" d="m4 4.8 28.4 15.9-4.7 3.3L4 4.8Z" />
            <path fill="#FBBC04" d="m4 43.2 23.7-19.1 4.7 3.3L4 43.2Z" />
            <path fill="#EA4335" d="m32.4 20.7 8.2 4.6c2 1.1 2 2.4 0 3.5l-8.2 4.6-4.7-6.3 4.7-6.4Z" />
          </svg>
        </div>
        <div>
          <strong>Em breve na Google Play</strong>
          <p>Quando o FazAí for lançado, você poderá acessar sua conta pelo site e baixar o aplicativo Android.</p>
        </div>
      </section>
    </main>
  );
}
