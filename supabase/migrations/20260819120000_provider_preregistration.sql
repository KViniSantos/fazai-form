-- Provider pre-registration feeds the existing usuarios/servicos workflow.
-- It intentionally does not change the global auto-approval setting.

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS pre_cadastro_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_cadastro_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS termos_aceitos_em timestamptz,
  ADD COLUMN IF NOT EXISTS termos_versao text,
  ADD COLUMN IF NOT EXISTS privacidade_aceita_em timestamptz,
  ADD COLUMN IF NOT EXISTS privacidade_versao text,
  ADD COLUMN IF NOT EXISTS consentimento_publicacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS consentimento_publicacao_versao text;

UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'servicos-imagens';

CREATE OR REPLACE FUNCTION public.block_locked_pre_registration_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.pre_cadastro_locked
     AND TG_OP IN ('UPDATE', 'DELETE')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND NOT public.is_privileged_user() THEN
    RAISE EXCEPTION 'O cadastro enviado para analise nao pode ser editado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_locked_pre_registration_service ON public.servicos;
CREATE TRIGGER block_locked_pre_registration_service
  BEFORE UPDATE OR DELETE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.block_locked_pre_registration_service();

CREATE OR REPLACE FUNCTION public.submit_pre_registration(
  p_profile jsonb DEFAULT '{}'::jsonb,
  p_services jsonb DEFAULT '[]'::jsonb,
  p_email text DEFAULT NULL,
  p_terms_accepted boolean DEFAULT false,
  p_service_terms_accepted boolean DEFAULT false,
  p_privacy_accepted boolean DEFAULT false,
  p_publication_consent boolean DEFAULT false
)
RETURNS TABLE(
  user_id uuid,
  service_ids uuid[],
  status public.status_servico
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_auth_email text;
  v_user_id uuid;
  v_user_type public.tipo_usuario;
  v_user_status public.status_usuario;
  v_profile_address jsonb;
  v_name text;
  v_last_name text;
  v_phone_digits text;
  v_phone_local text;
  v_birth_date date;
  v_document text;
  v_document_type text;
  v_fortaleza_id uuid;
  v_service jsonb;
  v_service_payload jsonb;
  v_service_id uuid;
  v_service_ids uuid[] := ARRAY[]::uuid[];
  v_max_services integer := 2;
  v_service_count integer;
  v_existing_count integer;
  v_image_count integer;
  v_now timestamptz := now();
  v_rows integer;
  v_service_whatsapp text;
  v_service_email text;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_profile IS NULL OR jsonb_typeof(p_profile) <> 'object' THEN
    RAISE EXCEPTION 'Dados do prestador invalidos';
  END IF;
  IF p_services IS NULL OR jsonb_typeof(p_services) <> 'array' THEN
    RAISE EXCEPTION 'Lista de servicos invalida';
  END IF;
  IF NOT COALESCE(p_terms_accepted, false)
     OR NOT COALESCE(p_service_terms_accepted, false)
     OR NOT COALESCE(p_privacy_accepted, false)
     OR NOT COALESCE(p_publication_consent, false) THEN
    RAISE EXCEPTION 'Todos os consentimentos sao obrigatorios';
  END IF;

  SELECT lower(trim(auth_user.email))
    INTO v_auth_email
  FROM auth.users AS auth_user
  WHERE auth_user.id = v_auth_user_id;

  IF v_auth_email IS NULL
     OR lower(trim(COALESCE(p_email, ''))) <> v_auth_email
     OR v_auth_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'O email do cadastro nao corresponde a conta autenticada';
  END IF;

  v_service_count := jsonb_array_length(p_services);
  IF v_service_count < 1 OR v_service_count > v_max_services THEN
    RAISE EXCEPTION 'Voce pode cadastrar de 1 a 2 servicos';
  END IF;

  SELECT id, tipo_usuario, status_usuario
    INTO v_user_id, v_user_type, v_user_status
  FROM public.usuarios
  WHERE auth_user_id = v_auth_user_id
  FOR UPDATE;

  IF v_user_id IS NULL OR v_user_status <> 'ativo'::public.status_usuario THEN
    RAISE EXCEPTION 'Perfil do usuario nao esta disponivel';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.servicos
    WHERE usuario_id = v_user_id
      AND (status = 'pendente' OR pre_cadastro_locked = true)
  ) THEN
    RAISE EXCEPTION 'Este pre-cadastro ja foi enviado e esta bloqueado para edicao';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  SELECT count(*)::integer
    INTO v_existing_count
  FROM public.servicos
  WHERE usuario_id = v_user_id
    AND status IN ('rascunho', 'ativo', 'pendente');

  IF v_existing_count + v_service_count > v_max_services THEN
    RAISE EXCEPTION 'Limite de 2 servicos por conta atingido';
  END IF;

  v_name := trim(COALESCE(p_profile->>'nome', ''));
  v_last_name := trim(COALESCE(p_profile->>'sobrenome', ''));
  IF length(v_name) < 2 OR length(v_name) > 120
     OR length(v_last_name) < 2 OR length(v_last_name) > 120 THEN
    RAISE EXCEPTION 'Nome e sobrenome sao obrigatorios';
  END IF;

  BEGIN
    v_birth_date := NULLIF(trim(p_profile->>'data_nascimento'), '')::date;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Data de nascimento invalida';
  END;
  IF v_birth_date IS NULL OR v_birth_date > (current_date - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'O prestador precisa ter pelo menos 18 anos';
  END IF;

  v_phone_digits := regexp_replace(COALESCE(p_profile->>'telefone', ''), '[^0-9]', '', 'g');
  v_phone_local := CASE
    WHEN v_phone_digits LIKE '55%' THEN substring(v_phone_digits FROM 3)
    ELSE v_phone_digits
  END;
  IF length(v_phone_local) NOT IN (10, 11) OR left(v_phone_local, 2) = '00' THEN
    RAISE EXCEPTION 'Telefone brasileiro invalido';
  END IF;

  v_document := NULLIF(regexp_replace(COALESCE(p_profile->>'documento', ''), '[^0-9]', '', 'g'), '');
  v_document_type := NULLIF(lower(trim(COALESCE(p_profile->>'tipo_documento', ''))), '');
  IF v_document IS NOT NULL THEN
    IF v_document_type = 'cpf' AND length(v_document) <> 11 THEN
      RAISE EXCEPTION 'CPF invalido';
    ELSIF v_document_type = 'cnpj' AND length(v_document) <> 14 THEN
      RAISE EXCEPTION 'CNPJ invalido';
    ELSIF v_document_type IS NULL OR v_document_type NOT IN ('cpf', 'cnpj') THEN
      RAISE EXCEPTION 'Tipo de documento invalido';
    END IF;
  ELSE
    v_document_type := NULL;
  END IF;

  SELECT id
    INTO v_fortaleza_id
  FROM public.cidades
  WHERE nome = 'Fortaleza'
    AND estado = 'CE'
  LIMIT 1;
  IF v_fortaleza_id IS NULL THEN
    RAISE EXCEPTION 'Fortaleza/CE nao esta cadastrada';
  END IF;

  -- The existing user trigger allows only the normal comum -> prestador path
  -- when this transaction-local onboarding flag is present.
  PERFORM set_config('app.upgrading_to_prestador', 'true', true);
  UPDATE public.usuarios
  SET
    nome = v_name,
    sobrenome = v_last_name,
    data_nascimento = v_birth_date,
    telefone = CASE WHEN v_phone_digits LIKE '55%' THEN '+' || v_phone_digits ELSE '+55' || v_phone_digits END,
    documento = CASE WHEN v_document IS NULL THEN documento ELSE v_document END,
    tipo_documento = CASE
      WHEN v_document IS NULL THEN tipo_documento
      ELSE v_document_type::public.tipo_documento
    END,
    tipo_usuario = CASE
      WHEN tipo_usuario = 'comum'::public.tipo_usuario THEN 'prestador'::public.tipo_usuario
      ELSE tipo_usuario
    END,
    updated_at = now()
  WHERE id = v_user_id;

  IF v_profile_address IS NULL THEN
    v_profile_address := p_profile->'address';
  END IF;
  IF jsonb_typeof(v_profile_address) = 'object'
     AND length(trim(COALESCE(v_profile_address->>'logradouro', ''))) > 0 THEN
    UPDATE public.enderecos
    SET
      logradouro = trim(v_profile_address->>'logradouro'),
      numero = NULLIF(trim(v_profile_address->>'numero'), ''),
      complemento = NULLIF(trim(v_profile_address->>'complemento'), ''),
      bairro = NULLIF(trim(v_profile_address->>'bairro'), ''),
      cidade_id = v_fortaleza_id,
      cep = NULLIF(trim(v_profile_address->>'cep'), ''),
      is_principal = true
    WHERE usuario_id = v_user_id
      AND is_principal = true;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      INSERT INTO public.enderecos(usuario_id, logradouro, numero, complemento, bairro, cidade_id, cep, is_principal)
      VALUES (
        v_user_id,
        trim(v_profile_address->>'logradouro'),
        NULLIF(trim(v_profile_address->>'numero'), ''),
        NULLIF(trim(v_profile_address->>'complemento'), ''),
        NULLIF(trim(v_profile_address->>'bairro'), ''),
        v_fortaleza_id,
        NULLIF(trim(v_profile_address->>'cep'), ''),
        true
      );
    END IF;
  END IF;

  PERFORM set_config('app.secure_service_rpc', 'true', true);

  FOR v_service IN SELECT value FROM jsonb_array_elements(p_services)
  LOOP
    IF jsonb_typeof(v_service) <> 'object' THEN
      RAISE EXCEPTION 'Dados do servico invalidos';
    END IF;

    v_service_whatsapp := COALESCE(
      NULLIF(trim(v_service->>'whatsapp'), ''),
      NULLIF(trim(p_profile->>'whatsapp'), ''),
      CASE WHEN v_phone_digits LIKE '55%' THEN '+' || v_phone_digits ELSE '+55' || v_phone_digits END
    );
    v_service_email := COALESCE(NULLIF(trim(v_service->>'email_contato'), ''), v_auth_email);

    IF NULLIF(trim(v_service->>'cidade_id'), '')::uuid <> v_fortaleza_id THEN
      RAISE EXCEPTION 'O pre-cadastro esta restrito a Fortaleza/CE';
    END IF;

    IF jsonb_typeof(v_service->'fotos_adicionais') IS NOT NULL
       AND jsonb_typeof(v_service->'fotos_adicionais') <> 'array' THEN
      RAISE EXCEPTION 'Lista de imagens do servico invalida';
    END IF;

    v_image_count := CASE
      WHEN length(trim(COALESCE(v_service->>'foto_principal', ''))) > 0 THEN 1
      ELSE 0
    END;
    IF jsonb_typeof(v_service->'fotos_adicionais') = 'array' THEN
      v_image_count := v_image_count + jsonb_array_length(v_service->'fotos_adicionais');
    END IF;
    IF v_image_count < 1 OR v_image_count > 5 THEN
      RAISE EXCEPTION 'Cada servico deve ter de 1 a 5 imagens';
    END IF;

    v_service_payload := jsonb_build_object(
      'titulo', trim(COALESCE(v_service->>'titulo', '')),
      'descricao', trim(COALESCE(v_service->>'descricao', '')),
      'categoria_id', NULLIF(trim(COALESCE(v_service->>'categoria_id', '')), ''),
      'cidade_id', NULLIF(trim(COALESCE(v_service->>'cidade_id', '')), ''),
      'tipo_preco', COALESCE(NULLIF(trim(v_service->>'tipo_preco'), ''), 'a_combinar'),
      'preco_minimo', NULLIF(trim(COALESCE(v_service->>'preco_minimo', '')), ''),
      'preco_maximo', NULLIF(trim(COALESCE(v_service->>'preco_maximo', '')), ''),
      'atendimento_remoto', false,
      'horario_atendimento', NULLIF(trim(COALESCE(v_service->>'horario_atendimento', '')), ''),
      'atende_emergencia', COALESCE((v_service->>'atende_emergencia')::boolean, false),
      'atende_fim_de_semana', COALESCE((v_service->>'atende_fim_de_semana')::boolean, false),
      'whatsapp', v_service_whatsapp,
      'email_contato', v_service_email,
      'foto_principal', NULLIF(trim(COALESCE(v_service->>'foto_principal', '')), ''),
      'fotos_adicionais', CASE
        WHEN jsonb_typeof(v_service->'fotos_adicionais') = 'array'
          THEN v_service->'fotos_adicionais'
        ELSE '[]'::jsonb
      END
    );

    PERFORM public.validate_service_payload(v_service_payload, v_user_id);

    INSERT INTO public.servicos(
      usuario_id,
      titulo,
      descricao,
      categoria_id,
      cidade_id,
      tipo_preco,
      preco_minimo,
      preco_maximo,
      atendimento_remoto,
      horario_atendimento,
      atende_emergencia,
      atende_fim_de_semana,
      whatsapp,
      email_contato,
      foto_principal,
      fotos_adicionais,
      status,
      publicado_em,
      is_free_offer,
      pre_cadastro_locked,
      pre_cadastro_submitted_at,
      termos_aceitos_em,
      termos_versao,
      privacidade_aceita_em,
      privacidade_versao,
      consentimento_publicacao_em,
      consentimento_publicacao_versao
    )
    VALUES(
      v_user_id,
      v_service_payload->>'titulo',
      v_service_payload->>'descricao',
      (v_service_payload->>'categoria_id')::uuid,
      (v_service_payload->>'cidade_id')::uuid,
      (v_service_payload->>'tipo_preco')::public.tipo_preco,
      NULLIF(v_service_payload->>'preco_minimo', '')::numeric,
      NULLIF(v_service_payload->>'preco_maximo', '')::numeric,
      false,
      v_service_payload->>'horario_atendimento',
      COALESCE((v_service_payload->>'atende_emergencia')::boolean, false),
      COALESCE((v_service_payload->>'atende_fim_de_semana')::boolean, false),
      v_service_payload->>'whatsapp',
      v_service_payload->>'email_contato',
      v_service_payload->>'foto_principal',
      ARRAY(SELECT jsonb_array_elements_text(v_service_payload->'fotos_adicionais')),
      'pendente'::public.status_servico,
      NULL,
      true,
      true,
      v_now,
      v_now,
      'fazai-pre-cadastro-2026-08-19',
      v_now,
      'fazai-pre-cadastro-2026-08-19',
      v_now,
      'fazai-pre-cadastro-2026-08-19'
    )
    RETURNING id INTO v_service_id;

    v_service_ids := array_append(v_service_ids, v_service_id);
  END LOOP;

  RETURN QUERY SELECT v_user_id, v_service_ids, 'pendente'::public.status_servico;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_pre_registration(jsonb, jsonb, text, boolean, boolean, boolean, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_pre_registration(jsonb, jsonb, text, boolean, boolean, boolean, boolean)
  TO authenticated;
