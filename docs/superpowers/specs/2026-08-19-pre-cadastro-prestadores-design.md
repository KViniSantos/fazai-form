# FazAí — Pré-cadastro de prestadores

## Objetivo

Criar uma aplicação pública, independente e mobile-first para captar prestadores reais de Fortaleza antes do lançamento do FazAí. O fluxo deve produzir contas e serviços reais no mesmo ecossistema Supabase usado pelo site, aplicativo Android e painel administrativo existentes, com meta operacional de pelo menos 200 serviços aprovados.

O formulário não será um marketplace paralelo: ele apenas coleta e envia dados para as tabelas, funções, Storage, autenticação, status e comunicações já existentes.

## Contexto encontrado

- Site principal: `C:\Users\carlo\Desktop\fazai_site\fazaih`.
- Aplicativo Android: `C:\Users\carlo\Desktop\fazai_apk\mobile\mobile-clean`, um WebView do site.
- Painel administrativo: `C:\Users\carlo\Desktop\fazai_adm\fazaiadmin`.
- Criação atual de serviços: `src/pages/CreateServiceNew.tsx`, `src/hooks/useServiceCreation.ts` e `src/components/create-service/steps/*`.
- Conta de prestador atual: `src/pages/CompletarPerfil.tsx`.
- Autenticação atual: Supabase Auth com e-mail/senha, recuperação de senha e Google; o pré-cadastro usará OTP por e-mail sem criar ou enviar senha.
- Serviço existente: tabela `servicos`, RPC `secure_save_service`, status `rascunho`, `ativo`, `pendente`, `expirado` e `suspenso`.
- Limite atual da oferta gratuita: dois serviços por conta, aplicado pelo `secure_save_service`.
- Imagens: bucket público `servicos-imagens`, com objetos no diretório do usuário autenticado.
- Moderação: view `servicos_pendentes_admin` e RPCs `aprovar_servico_pendente`/`rejeitar_servico_pendente`.
- Comunicação: `email_outbox`, worker `process-email-outbox`, Brevo e trigger de moderação de serviços.
- Termos disponíveis no site: `/termos`, `/termos-de-servico` e `/privacidade`. Não foi encontrada uma tabela persistente de aceites jurídicos.

## Experiência do usuário

### Página de entrada

A rota pública apresenta, de forma objetiva:

- o FazAí como plataforma que conecta clientes e profissionais;
- cadastro gratuito;
- oportunidade de estar entre os primeiros prestadores;
- possibilidade de o serviço estar disponível no lançamento, sem prometer clientes, renda ou volume de demanda;
- foco inicial em Fortaleza/CE;
- máximo de dois serviços por conta;
- máximo de cinco imagens por serviço;
- análise administrativa antes da publicação.

O CTA inicia o wizard. O layout é responsivo, com foco em uso por celular, e mantém a identidade visual do FazAí sem depender de navegação do site principal.

### Wizard

1. **Perfil:** nome, sobrenome, data de nascimento, telefone/WhatsApp, endereço opcional e CPF/CNPJ opcional. A idade mínima é 18 anos.
2. **Serviço:** categoria, título, descrição, tipo de preço, valores, dias/horários, atendimento de emergência e fim de semana.
3. **Localização:** Fortaleza/CE fixa; não existe seletor de outras cidades nesta fase.
4. **Imagens:** uma a cinco imagens por serviço, com possibilidade de adicionar o segundo serviço.
5. **Revisão:** mostra perfil, contatos, serviços, preços, localização e todas as imagens.
6. **Consentimento:** aceite dos termos existentes e autorização específica para publicação dos dados e imagens.
7. **E-mail e envio:** o usuário informa o e-mail apenas ao finalizar, recebe OTP e confirma o envio na mesma tela.
8. **Conclusão:** informa que o cadastro foi recebido e está aguardando análise. A aplicação não oferece edição posterior.

O formulário mantém temporariamente os campos textuais em `sessionStorage` para reduzir perda por recarregamento. Arquivos ficam em memória até o upload autenticado; nenhum código OTP ou senha é salvo localmente.

## Autenticação e submissão

Ao final, a aplicação chama `signInWithOtp`/`verifyOtp` do Supabase. O OTP pode criar uma conta nova ou autenticar uma conta existente pelo e-mail. Depois da confirmação:

1. O backend identifica `auth.uid()` e associa a linha existente de `usuarios`.
2. O perfil é atualizado para `tipo_usuario = 'prestador'` usando campos nativos.
3. CPF/CNPJ, quando informado, passa pela validação e regra de unicidade existentes.
4. O endereço opcional é persistido em `enderecos`.
5. É validado o limite total de dois serviços por conta.
6. Os serviços são submetidos usando as validações do `secure_save_service`.
7. O status inicial desses envios é forçado para `pendente`, independentemente da aprovação automática configurada para o site principal.
8. O envio é concluído de modo transacional para não deixar apenas parte dos serviços cadastrados quando ocorrer uma falha.

A mudança de backend será uma extensão protegida e nativa do contrato existente, sem nova tabela de usuários, serviços, avaliações ou status. O RPC de pré-cadastro apenas orquestra perfil e serviços e reaproveita as validações de payload, limite, propriedade das imagens e regras de escrita já existentes.

## Imagens

Antes do upload, o navegador:

- aceita JPEG, PNG e WebP;
- rejeita arquivos originais acima de 10 MB;
- reduz a maior dimensão para no máximo 1600 px;
- remove metadados EXIF, inclusive localização;
- converte fotos para WebP quando suportado e usa JPEG como fallback;
- mira arquivo final de até 2 MB;
- rejeita o arquivo se o resultado ainda exceder o limite absoluto de 5 MB.

O Storage existente `servicos-imagens` continuará sendo usado. Sua configuração também terá limite de 5 MB e tipos MIME permitidos. O caminho seguirá o diretório do usuário autenticado e o backend validará a propriedade de cada URL. Uploads criados durante uma tentativa que falhar serão removidos.

## Moderação e estados

Cada serviço será independente na aprovação, sempre começando como `pendente`. O admin atual continuará usando:

- `servicos_pendentes_admin` para a fila;
- `aprovar_servico_pendente` para publicar como `ativo`;
- `rejeitar_servico_pendente` para marcar como `suspenso` e registrar o motivo.

O usuário do formulário não receberá rotas de edição, alteração de status ou criação de avaliações. O acesso posterior pela aplicação principal seguirá as regras já existentes.

## Consentimento e privacidade

O envio exige os Termos de Uso, Termos de Serviço, Política de Privacidade e uma autorização explícita para usar os dados e imagens na divulgação do serviço no FazAí. Os links apontam para as páginas legais já existentes.

Como o banco atual não possui uma estrutura persistente de aceites, a migration acrescentará somente os campos nativos necessários para registrar horário e versão do consentimento associado ao envio. Não será criada uma plataforma jurídica ou tabela de consentimento paralela.

## E-mails

- OTP: mecanismo de autenticação do Supabase, usando a configuração de e-mail já existente.
- Recebimento: confirmação imediata na interface; não será criado um novo serviço de e-mail.
- Aprovação/rejeição: trigger atual de moderação, `email_outbox`, worker existente e Brevo.
- Lançamento: será preparado um template/evento compatível com `email_outbox`, com URLs configuráveis para o site e, quando existir, Google Play. O disparo será uma operação posterior de lançamento, não uma campanha automática desta entrega.
- Não haverá WhatsApp API, anúncios, pixel, chat, pagamentos ou avaliações neste fluxo.

## Erros e segurança

- Nenhuma chave de service role ficará no navegador.
- O backend exigirá sessão autenticada para atualizar perfil, fazer upload e criar serviços.
- Validações de limite, cidade, status, imagens e payload serão repetidas no backend.
- Falhas de OTP, Storage, limite ou RPC mostrarão mensagens acionáveis e não confirmarão o cadastro prematuramente.
- Em caso de resposta perdida após o envio, o cliente consultará os serviços pendentes recentes da conta antes de tentar duplicar a submissão.
- O sucesso somente será mostrado depois de a operação final retornar confirmação.

## Verificação

Serão criados testes para validação de perfil e serviços, limite de dois serviços, Fortaleza/CE, consentimentos, compressão e limites de imagem, fluxo OTP, bloqueio após envio e compatibilidade dos payloads com o Supabase. Também serão executados lint, testes completos e build.

O aceite manual incluirá: cadastro em viewport mobile, seleção de cinco imagens, tentativa de sexto arquivo, envio de dois serviços, tentativa de terceiro, confirmação OTP, visualização na fila administrativa, aprovação, rejeição e recebimento dos e-mails existentes.

## Fora do escopo

- edição posterior dos serviços pelo formulário;
- múltiplas cidades;
- avaliações;
- pagamentos, chat e WhatsApp API;
- campanhas de marketing e mídia paga;
- autenticação por senha no pré-cadastro;
- novo painel administrativo;
- nova aplicação mobile nativa.

