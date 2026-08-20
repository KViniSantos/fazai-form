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
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'servicos-imagens';

CREATE OR REPLACE FUNCTION public.is_valid_cpf(p_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(p_value, '[^0-9]', '', 'g');
  v_sum integer := 0;
  v_digit integer;
  v_index integer;
BEGIN
  IF length(v_digits) <> 11 OR v_digits ~ '^(.)\1{10}$' THEN
    RETURN false;
  END IF;
  FOR v_index IN 1..9 LOOP
    v_sum := v_sum + substring(v_digits FROM v_index FOR 1)::integer * (11 - v_index);
  END LOOP;
  v_digit := 11 - (v_sum % 11);
  IF v_digit >= 10 THEN v_digit := 0; END IF;
  IF v_digit <> substring(v_digits FROM 10 FOR 1)::integer THEN RETURN false; END IF;
  v_sum := 0;
  FOR v_index IN 1..10 LOOP
    v_sum := v_sum + substring(v_digits FROM v_index FOR 1)::integer * (12 - v_index);
  END LOOP;
  v_digit := 11 - (v_sum % 11);
  IF v_digit >= 10 THEN v_digit := 0; END IF;
  RETURN v_digit = substring(v_digits FROM 11 FOR 1)::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_cnpj(p_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(p_value, '[^0-9]', '', 'g');
  v_first_weights integer[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  v_second_weights integer[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_sum integer := 0;
  v_digit integer;
  v_index integer;
BEGIN
  IF length(v_digits) <> 14 OR v_digits ~ '^(.)\1{13}$' THEN
    RETURN false;
  END IF;
  FOR v_index IN 1..12 LOOP
    v_sum := v_sum + substring(v_digits FROM v_index FOR 1)::integer * v_first_weights[v_index];
  END LOOP;
  v_digit := CASE WHEN (v_sum % 11) < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
  IF v_digit <> substring(v_digits FROM 13 FOR 1)::integer THEN RETURN false; END IF;
  v_sum := 0;
  FOR v_index IN 1..13 LOOP
    v_sum := v_sum + substring(v_digits FROM v_index FOR 1)::integer * v_second_weights[v_index];
  END LOOP;
  v_digit := CASE WHEN (v_sum % 11) < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
  RETURN v_digit = substring(v_digits FROM 14 FOR 1)::integer;
END;
$$;

-- Preserve the existing three-argument secure-save contract. The local flag
-- is only set by the guarded pre-registration transaction below.
CREATE OR REPLACE FUNCTION public.secure_save_service(
  p_service_id uuid DEFAULT NULL,
  p_publish boolean DEFAULT false,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  id uuid,
  status public.status_servico,
  is_free_offer boolean,
  applied boolean,
  revision_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.usuarios%ROWTYPE;
  v_existing public.servicos%ROWTYPE;
  v_has_subscription boolean := false;
  v_limit integer := 2;
  v_current_count integer := 0;
  v_status public.status_servico;
  v_auto_approve boolean := true;
  v_is_free_offer boolean := true;
  v_service_id uuid;
  v_revision_status text;
  v_rate_ok boolean;
BEGIN
  PERFORM public.expire_monetization_states();

  SELECT user_record.* INTO v_user
  FROM public.usuarios AS user_record
  WHERE user_record.auth_user_id = auth.uid()
    AND user_record.status_usuario = 'ativo'
  LIMIT 1;

  IF v_user.id IS NULL OR v_user.tipo_usuario <> 'prestador' THEN
    RAISE EXCEPTION 'Usuario autenticado precisa ser prestador ativo';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user.id::text, 0));
  SELECT public.check_rate_limit(
    'service-user:' || v_user.id::text,
    'create-service',
    3,
    300
  ) INTO v_rate_ok;
  IF COALESCE(v_rate_ok, false) <> true THEN
    RAISE EXCEPTION 'Muitas tentativas de salvar anuncio. Aguarde alguns minutos.';
  END IF;

  SELECT true, plan_record.limite_servicos
    INTO v_has_subscription, v_limit
  FROM public.assinaturas AS subscription_record
  JOIN public.planos AS plan_record ON plan_record.id = subscription_record.plano_id
  WHERE subscription_record.usuario_id = v_user.id
    AND subscription_record.status_assinatura = 'ativa'
    AND subscription_record.fim > now()
    AND plan_record.ativo = true
  ORDER BY plan_record.limite_servicos DESC, subscription_record.fim DESC
  LIMIT 1;

  v_has_subscription := COALESCE(v_has_subscription, false);
  v_limit := CASE
    WHEN v_has_subscription THEN GREATEST(COALESCE(v_limit, 2), 2)
    ELSE 2
  END;
  v_is_free_offer := NOT v_has_subscription;

  SELECT COALESCE(lower(config.valor) = 'true', true) INTO v_auto_approve
  FROM (
    SELECT COALESCE(
      (SELECT setting_record.valor
       FROM public.configuracoes AS setting_record
       WHERE setting_record.chave = 'auto_aprovar_servicos'),
      'true'
    ) AS valor
  ) AS config;

  IF COALESCE(current_setting('app.pre_registration_submission', true), 'false') = 'true' THEN
    v_auto_approve := false;
  END IF;

  IF p_service_id IS NOT NULL THEN
    SELECT existing_service.* INTO v_existing
    FROM public.servicos AS existing_service
    WHERE existing_service.id = p_service_id
    FOR UPDATE;
    IF v_existing.id IS NULL OR v_existing.usuario_id <> v_user.id THEN
      RAISE EXCEPTION 'Servico nao encontrado para este usuario';
    END IF;
  ELSE
    SELECT count(*)::integer INTO v_current_count
    FROM public.servicos AS counted_service
    WHERE counted_service.usuario_id = v_user.id
      AND counted_service.status IN ('rascunho', 'ativo', 'pendente');
    IF v_current_count >= v_limit THEN
      RAISE EXCEPTION 'Limite de % anuncios atingido para o plano atual', v_limit;
    END IF;
  END IF;

  IF p_publish OR (
    p_service_id IS NOT NULL
    AND v_existing.status = 'ativo'::public.status_servico
  ) THEN
    PERFORM public.validate_service_payload(p_payload, v_user.id);
  END IF;

  IF p_service_id IS NOT NULL
     AND v_existing.status = 'ativo'::public.status_servico
     AND (NOT p_publish OR NOT v_auto_approve) THEN
    v_revision_status := CASE WHEN p_publish THEN 'pendente' ELSE 'rascunho' END;
    INSERT INTO public.servico_revisoes AS target_revision(
      servico_id, usuario_id, proposed_data, status, updated_at
    )
    VALUES (p_service_id, v_user.id, p_payload, v_revision_status, now())
    ON CONFLICT (servico_id)
      WHERE target_revision.status IN ('rascunho', 'pendente')
    DO UPDATE SET
      proposed_data = EXCLUDED.proposed_data,
      status = EXCLUDED.status,
      motivo_rejeicao = NULL,
      analisado_por = NULL,
      analisado_em = NULL,
      updated_at = now();
    RETURN QUERY
    SELECT returned_service.id, returned_service.status,
           returned_service.is_free_offer, false, v_revision_status
    FROM public.servicos AS returned_service
    WHERE returned_service.id = p_service_id;
    RETURN;
  END IF;

  IF p_publish THEN
    v_status := CASE
      WHEN v_auto_approve THEN 'ativo'::public.status_servico
      ELSE 'pendente'::public.status_servico
    END;
  ELSE
    v_status := COALESCE(v_existing.status, 'rascunho'::public.status_servico);
  END IF;

  PERFORM set_config('app.secure_service_rpc', 'true', true);

  IF p_service_id IS NULL THEN
    INSERT INTO public.servicos (
      usuario_id, titulo, descricao, categoria_id, cidade_id, cidade_nome_manual,
      tipo_preco, preco_minimo, preco_maximo, atendimento_remoto,
      horario_atendimento, atende_emergencia, atende_fim_de_semana, whatsapp,
      email_contato, foto_principal, fotos_adicionais, status, publicado_em,
      is_free_offer, estado_manual
    )
    VALUES (
      v_user.id,
      COALESCE(NULLIF(trim(p_payload->>'titulo'), ''), 'Rascunho sem titulo'),
      NULLIF(p_payload->>'descricao', ''),
      NULLIF(p_payload->>'categoria_id', '')::uuid,
      NULLIF(p_payload->>'cidade_id', '')::uuid,
      NULLIF(trim(p_payload->>'cidade_nome_manual'), ''),
      COALESCE(NULLIF(p_payload->>'tipo_preco', '')::public.tipo_preco,
               'a_combinar'::public.tipo_preco),
      NULLIF(p_payload->>'preco_minimo', '')::numeric,
      NULLIF(p_payload->>'preco_maximo', '')::numeric,
      COALESCE((p_payload->>'atendimento_remoto')::boolean, false),
      NULLIF(p_payload->>'horario_atendimento', ''),
      COALESCE((p_payload->>'atende_emergencia')::boolean, false),
      COALESCE((p_payload->>'atende_fim_de_semana')::boolean, false),
      NULLIF(p_payload->>'whatsapp', ''),
      NULLIF(p_payload->>'email_contato', ''),
      NULLIF(p_payload->>'foto_principal', ''),
      CASE WHEN jsonb_typeof(p_payload->'fotos_adicionais') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'fotos_adicionais'))
        ELSE NULL END,
      v_status,
      CASE WHEN v_status = 'ativo'::public.status_servico THEN now() ELSE NULL END,
      v_is_free_offer,
      NULLIF(p_payload->>'estado_manual', '')
    )
    RETURNING servicos.id INTO v_service_id;
  ELSE
    UPDATE public.servicos AS target_service
    SET
      titulo = trim(p_payload->>'titulo'),
      descricao = NULLIF(p_payload->>'descricao', ''),
      categoria_id = NULLIF(p_payload->>'categoria_id', '')::uuid,
      cidade_id = NULLIF(p_payload->>'cidade_id', '')::uuid,
      cidade_nome_manual = NULLIF(trim(p_payload->>'cidade_nome_manual'), ''),
      estado_manual = NULLIF(trim(p_payload->>'estado_manual'), ''),
      tipo_preco = COALESCE(NULLIF(p_payload->>'tipo_preco', '')::public.tipo_preco,
                            'a_combinar'::public.tipo_preco),
      preco_minimo = NULLIF(p_payload->>'preco_minimo', '')::numeric,
      preco_maximo = NULLIF(p_payload->>'preco_maximo', '')::numeric,
      atendimento_remoto = COALESCE((p_payload->>'atendimento_remoto')::boolean, false),
      horario_atendimento = NULLIF(p_payload->>'horario_atendimento', ''),
      atende_emergencia = COALESCE((p_payload->>'atende_emergencia')::boolean, false),
      atende_fim_de_semana = COALESCE((p_payload->>'atende_fim_de_semana')::boolean, false),
      whatsapp = NULLIF(p_payload->>'whatsapp', ''),
      email_contato = NULLIF(p_payload->>'email_contato', ''),
      foto_principal = NULLIF(p_payload->>'foto_principal', ''),
      fotos_adicionais = CASE WHEN jsonb_typeof(p_payload->'fotos_adicionais') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'fotos_adicionais'))
        ELSE NULL END,
      status = v_status,
      publicado_em = CASE WHEN v_status = 'ativo'::public.status_servico
        THEN COALESCE(target_service.publicado_em, now()) ELSE NULL END,
      is_free_offer = CASE WHEN v_has_subscription THEN false
        ELSE target_service.is_free_offer END,
      motivo_rejeicao = NULL,
      updated_at = now()
    WHERE target_service.id = p_service_id
    RETURNING target_service.id INTO v_service_id;
  END IF;

  RETURN QUERY
  SELECT returned_service.id, returned_service.status,
         returned_service.is_free_offer, true, NULL::text
  FROM public.servicos AS returned_service
  WHERE returned_service.id = v_service_id;
END;
$$;

REVOKE ALL ON FUNCTION public.secure_save_service(uuid, boolean, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secure_save_service(uuid, boolean, jsonb)
  TO authenticated;

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
  p_profile jsonb,
  p_services jsonb,
  p_terms_version text,
  p_publication_version text
)
RETURNS TABLE(service_id uuid, status public.status_servico)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_auth_email text;
  v_user_id uuid;
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
  v_saved_service record;
  v_service_count integer;
  v_max_services integer := 2;
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
  IF length(trim(COALESCE(p_terms_version, ''))) = 0
     OR length(trim(COALESCE(p_publication_version, ''))) = 0 THEN
    RAISE EXCEPTION 'Versoes legais sao obrigatorias';
  END IF;

  SELECT lower(trim(auth_user.email)) INTO v_auth_email
  FROM auth.users AS auth_user
  WHERE auth_user.id = v_auth_user_id;
  IF v_auth_email IS NULL OR v_auth_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Email da conta indisponivel';
  END IF;

  v_service_count := jsonb_array_length(p_services);
  IF v_service_count < 1 OR v_service_count > v_max_services THEN
    RAISE EXCEPTION 'Voce pode cadastrar de 1 a 2 servicos';
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

  v_phone_digits := regexp_replace(COALESCE(p_profile->>'whatsapp', ''), '[^0-9]', '', 'g');
  v_phone_local := CASE WHEN v_phone_digits LIKE '55%'
    THEN substring(v_phone_digits FROM 3) ELSE v_phone_digits END;
  IF length(v_phone_local) NOT IN (10, 11) OR left(v_phone_local, 2) = '00' THEN
    RAISE EXCEPTION 'Telefone brasileiro invalido';
  END IF;

  v_document := NULLIF(regexp_replace(COALESCE(p_profile->>'documento', ''), '[^0-9]', '', 'g'), '');
  v_document_type := NULLIF(lower(trim(COALESCE(p_profile->>'tipo_documento', ''))), '');
  IF v_document IS NOT NULL THEN
    IF v_document_type = 'cpf' AND NOT public.is_valid_cpf(v_document) THEN
      RAISE EXCEPTION 'CPF invalido';
    ELSIF v_document_type = 'cnpj' AND NOT public.is_valid_cnpj(v_document) THEN
      RAISE EXCEPTION 'CNPJ invalido';
    ELSIF v_document_type IS NULL OR v_document_type NOT IN ('cpf', 'cnpj') THEN
      RAISE EXCEPTION 'Tipo de documento invalido';
    END IF;
  ELSE
    v_document_type := NULL;
  END IF;

  SELECT id INTO v_fortaleza_id
  FROM public.cidades
  WHERE nome = 'Fortaleza' AND estado = 'CE'
  LIMIT 1;
  IF v_fortaleza_id IS NULL THEN
    RAISE EXCEPTION 'Fortaleza/CE nao esta cadastrada';
  END IF;

  SELECT id, status_usuario INTO v_user_id, v_user_status
  FROM public.usuarios
  WHERE auth_user_id = v_auth_user_id
  FOR UPDATE;
  IF v_user_id IS NULL THEN
    INSERT INTO public.usuarios(auth_user_id, nome, sobrenome, status_usuario)
    VALUES (v_auth_user_id, v_name, v_last_name, 'ativo'::public.status_usuario)
    RETURNING id, status_usuario INTO v_user_id, v_user_status;
  END IF;
  IF v_user_status <> 'ativo'::public.status_usuario THEN
    RAISE EXCEPTION 'Perfil do usuario nao esta disponivel';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.servicos AS servico_existente
    WHERE servico_existente.usuario_id = v_user_id
      AND (servico_existente.status = 'pendente' OR servico_existente.pre_cadastro_locked = true)
  ) THEN
    RAISE EXCEPTION 'Este pre-cadastro ja foi enviado e esta bloqueado para edicao';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  SELECT count(*)::integer INTO v_existing_count
  FROM public.servicos AS servico_contado
  WHERE servico_contado.usuario_id = v_user_id
    AND servico_contado.status IN ('rascunho', 'ativo', 'pendente');
  IF v_existing_count + v_service_count > v_max_services THEN
    RAISE EXCEPTION 'Limite de 2 servicos por conta atingido';
  END IF;

  PERFORM set_config('app.upgrading_to_prestador', 'true', true);
  UPDATE public.usuarios
  SET
    nome = v_name,
    sobrenome = v_last_name,
    data_nascimento = v_birth_date,
    telefone = CASE WHEN v_phone_digits LIKE '55%' THEN '+' || v_phone_digits ELSE '+55' || v_phone_digits END,
    documento = CASE WHEN v_document IS NULL THEN documento ELSE v_document END,
    tipo_documento = CASE WHEN v_document IS NULL THEN tipo_documento
      ELSE v_document_type::public.tipo_documento END,
    tipo_usuario = CASE WHEN tipo_usuario = 'comum'::public.tipo_usuario
      THEN 'prestador'::public.tipo_usuario ELSE tipo_usuario END,
    updated_at = now()
  WHERE id = v_user_id;

  v_profile_address := p_profile->'address';
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
    WHERE usuario_id = v_user_id AND is_principal = true;
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

  PERFORM set_config('app.pre_registration_submission', 'true', true);
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

    v_image_count := CASE WHEN length(trim(COALESCE(v_service->>'foto_principal', ''))) > 0 THEN 1 ELSE 0 END;
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
      'fotos_adicionais', CASE WHEN jsonb_typeof(v_service->'fotos_adicionais') = 'array'
        THEN v_service->'fotos_adicionais' ELSE '[]'::jsonb END
    );

    SELECT saved.* INTO v_saved_service
    FROM public.secure_save_service(NULL, true, v_service_payload) AS saved;
    IF v_saved_service.id IS NULL OR v_saved_service.status <> 'pendente'::public.status_servico THEN
      RAISE EXCEPTION 'O servico nao entrou na fila de analise';
    END IF;

    PERFORM set_config('app.secure_service_rpc', 'true', true);
    UPDATE public.servicos AS servico_enviado
    SET
      pre_cadastro_locked = true,
      pre_cadastro_submitted_at = v_now,
      termos_aceitos_em = v_now,
      termos_versao = trim(p_terms_version),
      privacidade_aceita_em = v_now,
      privacidade_versao = trim(p_terms_version),
      consentimento_publicacao_em = v_now,
      consentimento_publicacao_versao = trim(p_publication_version),
      updated_at = now()
    WHERE servico_enviado.id = v_saved_service.id
      AND servico_enviado.status = 'pendente'::public.status_servico;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'Nao foi possivel bloquear o servico enviado';
    END IF;

    service_id := v_saved_service.id;
    status := 'pendente'::public.status_servico;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_pre_registration(jsonb, jsonb, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_pre_registration(jsonb, jsonb, text, text)
  TO authenticated;
