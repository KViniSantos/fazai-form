import { useEffect, useRef, useState } from 'react';
import FormField from '@/components/FormField';
import { maskCep, normalizeCep } from '@/lib/cep';
import { maskDocument } from '@/lib/document';
import { maskBrazilianPhone } from '@/lib/phone';
import type { DocumentType, ProfileDraft } from '@/domain/types';
import type { FieldErrors } from '@/domain/validation';
import { lookupCep, type CepAddress } from '@/infrastructure/viacep/viacepClient';

interface ProfileStepProps {
  profile: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
  errors?: FieldErrors;
  cepLookup?: (cep: string) => Promise<CepAddress>;
}

export default function ProfileStep({ profile, onChange, errors = {}, cepLookup = lookupCep }: ProfileStepProps) {
  const [cepError, setCepError] = useState('');
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const lastLookup = useRef('');

  const updateAddress = (field: keyof ProfileDraft['address'], value: string) => {
    onChange({ address: { ...profile.address, [field]: value } });
  };

  useEffect(() => {
    const digits = normalizeCep(profile.address.cep);
    if (digits.length !== 8) {
      lastLookup.current = '';
      setCepError('');
      setIsLookingUpCep(false);
      return;
    }
    if (lastLookup.current === digits) return;
    lastLookup.current = digits;
    let active = true;
    setCepError('');
    setIsLookingUpCep(true);
    cepLookup(digits)
      .then((address) => {
        if (!active) return;
        onChange({
          address: {
            ...profile.address,
            cep: maskCep(address.cep || digits),
            logradouro: address.logradouro,
            bairro: address.bairro,
          },
        });
      })
      .catch((caughtError) => {
        if (!active) return;
        setCepError(caughtError instanceof Error ? caughtError.message : 'Não foi possível consultar o CEP.');
      })
      .finally(() => {
        if (active) setIsLookingUpCep(false);
      });
    return () => { active = false; };
  }, [cepLookup, onChange, profile.address]);

  return (
    <section className="form-card" aria-labelledby="profile-title">
      <div className="section-heading"><p className="eyebrow">Etapa 2 de 6</p><h2 id="profile-title">Fale um pouco sobre você</h2><p>Esses dados ficam associados à sua conta de prestador.</p></div>
      <div className="form-grid two-columns">
        <FormField label="Nome" htmlFor="profile-name" required><input id="profile-name" value={profile.nome} onChange={(event) => onChange({ nome: event.target.value })} autoComplete="given-name" required /></FormField>
        <FormField label="Sobrenome" htmlFor="profile-last-name" required><input id="profile-last-name" value={profile.sobrenome} onChange={(event) => onChange({ sobrenome: event.target.value })} autoComplete="family-name" required /></FormField>
      </div>
      <div className="form-grid two-columns">
        <FormField label="Data de nascimento" htmlFor="profile-birth-date" required error={errors.dataNascimento}><input id="profile-birth-date" type="date" value={profile.dataNascimento} onChange={(event) => onChange({ dataNascimento: event.target.value })} aria-invalid={Boolean(errors.dataNascimento)} aria-describedby={errors.dataNascimento ? 'profile-birth-date-error' : undefined} required /></FormField>
        <FormField label="WhatsApp do seu serviço" htmlFor="profile-whatsapp" required error={errors.whatsapp} hint="Este será o número de contato exibido aos clientes."><input id="profile-whatsapp" inputMode="tel" value={maskBrazilianPhone(profile.whatsapp)} onChange={(event) => onChange({ whatsapp: event.target.value })} autoComplete="tel" aria-invalid={Boolean(errors.whatsapp)} aria-describedby={errors.whatsapp ? 'profile-whatsapp-error' : undefined} required /></FormField>
      </div>
      <div className="form-grid two-columns">
        <FormField label="Tipo de documento" htmlFor="profile-document-type"><select id="profile-document-type" value={profile.tipoDocumento} onChange={(event) => onChange({ tipoDocumento: event.target.value as DocumentType, documento: '' })}><option value="">Não informar</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option></select></FormField>
        <FormField label="CPF/CNPJ" htmlFor="profile-document" error={errors.documento}><input id="profile-document" inputMode="tel" value={maskDocument(profile.documento, profile.tipoDocumento)} onChange={(event) => onChange({ documento: event.target.value })} aria-invalid={Boolean(errors.documento)} aria-describedby={errors.documento ? 'profile-document-error' : undefined} /></FormField>
      </div>
      <fieldset className="optional-address">
        <legend>Endereço em Fortaleza (opcional)</legend>
        <div className="form-grid two-columns">
          <FormField label="CEP" htmlFor="profile-cep" error={cepError || errors['address.cep']} hint={isLookingUpCep ? 'Buscando endereço…' : 'Digite os 8 números para preencher rua e bairro.'}><input id="profile-cep" inputMode="numeric" value={maskCep(profile.address.cep)} onChange={(event) => updateAddress('cep', maskCep(event.target.value))} autoComplete="postal-code" aria-invalid={Boolean(cepError || errors['address.cep'])} aria-describedby={cepError || errors['address.cep'] ? 'profile-cep-error' : undefined} /></FormField>
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
