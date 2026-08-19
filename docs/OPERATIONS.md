# Operação do pré-cadastro

## Antes de abrir o link

1. Aplique `supabase/migrations/20260819120000_provider_preregistration.sql` no mesmo projeto Supabase usado pelo site, aplicativo e painel administrativo.
2. Confirme que existe uma única cidade operacional com `nome = 'Fortaleza'` e `estado = 'CE'`.
3. Confirme no Storage que o bucket `servicos-imagens` está com limite de 5 MB e aceita somente JPEG, PNG e WebP.
4. Configure apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL` e, quando existir, `VITE_PLAY_STORE_URL`. A chave `service_role` nunca deve ser colocada neste projeto.
5. Faça um cadastro real de teste com um e-mail controlado, uma imagem e um serviço.

## Revisão administrativa

Após a confirmação do e-mail, o serviço deve aparecer individualmente na visão existente `servicos_pendentes_admin`. Revise os dados, a localização, preço e imagens no painel `fazai_adm`.

- Use a ação de aprovação existente para colocar o serviço em `ativo`.
- Use a ação de rejeição existente quando os critérios não forem atendidos.
- Não altere a configuração global de aprovação automática para operar o pré-cadastro.
- O bloqueio `pre_cadastro_locked` impede edição pelo prestador após o envio; correções devem ser feitas pelo fluxo administrativo já existente.

## E-mails

O OTP é enviado pelo mecanismo de autenticação do Supabase. A aprovação ou rejeição continua acionando o mecanismo existente de moderação/Brevo. A tela de recebimento não envia uma senha e não cria uma senha por e-mail.

Antes do lançamento público, configure e teste a comunicação de lançamento no fluxo de e-mail já existente, incluindo o site e, somente quando publicado, o link da Google Play Store. Não habilite WhatsApp API, anúncios ou novos provedores de e-mail para esta etapa.

## Monitoramento

Para a meta inicial de pelo menos 200 serviços aprovados, acompanhe no painel:

- cadastros recebidos e serviços pendentes;
- quantidade aprovada e rejeitada individualmente;
- imagens e descrições incompletas que exigem contato;
- falhas de OTP, Storage e RPC nos logs do Supabase.

Faça um novo teste controlado depois de qualquer alteração na migration, nas políticas do bucket ou nas funções de aprovação.
