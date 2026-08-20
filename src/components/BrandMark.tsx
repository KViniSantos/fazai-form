import officialLogo from '@/assets/fazai-brand-logo.png';

export default function BrandMark() {
  return (
    <div className="brand-mark" aria-label="FazAí">
      <img className="brand-mark__logo" src={officialLogo} alt="FazAí" />
      <span>FazAí</span>
    </div>
  );
}
