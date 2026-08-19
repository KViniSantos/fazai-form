import FormField from '@/components/FormField';
import { maskDocument } from '@/lib/document';
import { maskBrazilianPhone } from '@/lib/phone';
import type { DocumentType, ProfileDraft } from '@/domain/types';

interface ProfileStepProps {
  profile: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
}

export default function ProfileStep({ profile, onChange }: ProfileStepProps) {
  const updateAddress = (field: keyof ProfileDraft['address'], value: string) => {
    onChange({ address: { ...profile.address, [field]: value } });
  };

  return (
    <section className="form-card" aria-labelledby="profile-title">
      <div className="section-heading"><p className="eyebrow">Etapa 1 de 4</p><h2 id="profile-title">Fale um pouco sobre você</h2><p>Esses dados ficam associados à sua conta de prestador.</p></div>
      <div className="form-grid two-columns">
        <FormField label="Nome" htmlFor="profile-name" required><input id="profile-name" value={profile.nome} onChange={(event) => onChange({ nome: event.target.value })} autoComplete="given-name" required /></FormField>
        <FormField label="Sobrenome" htmlFor="profile-last-name" required><input id="profile-last-name" value={profile.sobrenome} onChange={(event) => onChange({ sobrenome: event.target.value })} autoComplete="family-name" required /></FormField>
      </div>
      <div className="form-grid two-columns">
        <FormField label="Data de nascimento" htmlFor="profile-birth-date" required><input id="profile-birth-date" type="date" value={profile.dataNascimento} onChange={(event) => onChange({ dataNascimento: event.target.value })} required /></FormField>
        <FormField label="Telefone" htmlFor="profile-phone" required><input id="profile-phone" inputMode="tel" value={maskBrazilianPhone(profile.telefone)} onChange={(event) => onChange({ telefone: event.target.value })} autoComplete="tel" required /></FormField>
      </div>
      <FormField label="WhatsApp" htmlFor="profile-whatsapp" required hint="Usaremos este contato para facilitar o acesso dos clientes ao seu serviço."><input id="profile-whatsapp" inputMode="tel" value={maskBrazilianPhone(profile.whatsapp)} onChange={(event) => onChange({ whatsapp: event.target.value })} autoComplete="tel" required /></FormField>
      <div className="form-grid two-columns">
        <FormField label="Tipo de documento" htmlFor="profile-document-type"><select id="profile-document-type" value={profile.tipoDocumento} onChange={(event) => onChange({ tipoDocumento: event.target.value as DocumentType, documento: '' })}><option value="">Não informar</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option></select></FormField>
        <FormField label="CPF/CNPJ" htmlFor="profile-document"><input id="profile-document" inputMode="tel" value={maskDocument(profile.documento, profile.tipoDocumento)} onChange={(event) => onChange({ documento: event.target.value })} /></FormField>
      </div>
      <fieldset className="optional-address">
        <legend>Endereço em Fortaleza (opcional)</legend>
        <div className="form-grid two-columns">
          <FormField label="CEP" htmlFor="profile-cep"><input id="profile-cep" inputMode="numeric" value={profile.address.cep} onChange={(event) => updateAddress('cep', event.target.value)} autoComplete="postal-code" /></FormField>
          <FormField label="Número" htmlFor="profile-number"><input id="profile-number" value={profile.address.numero} onChange={(event) => updateAddress('numero', event.target.value)} /></FormField>
        </div>
        <FormField label="Rua" htmlFor="profile-street"><input id="profile-street" value={profile.address.logradouro} onChange={(event) => updateAddress('logradouro', event.target.value)} autoComplete="street-address" /></FormField>
        <div className="form-grid two-columns">
          <FormField label="Bairro" htmlFor="profile-neighborhood"><input id="profile-neighborhood" value={profile.address.bairro} onChange={(event) => updateAddress('bairro', event.target.value)} /></FormField>
          <FormField label="Complemento" htmlFor="profile-complement"><input id="profile-complement" value={profile.address.complemento} onChange={(event) => updateAddress('complemento', event.target.value)} /></FormField>
        </div>
      </fieldset>
    </section>
  );
}
