# FazAí — pré-cadastro de prestadores

Aplicação pública e mobile-first para captar prestadores da oferta inicial do FazAí em Fortaleza/CE. O cadastro alimenta as tabelas existentes `usuarios` e `servicos`, usa o Storage `servicos-imagens`, mantém cada serviço como `pendente` e deixa a aprovação para o painel administrativo atual.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com as credenciais públicas do projeto Supabase compartilhado. Nunca coloque uma chave `service_role` no frontend ou no arquivo `.env`.
3. Instale e execute:

```text
npm install
npm run dev
```

Os comandos de verificação são:

```text
npm test
npm run lint
npm run build
```

## Configuração do backend

Aplique `supabase/migrations/20260819120000_provider_preregistration.sql` no projeto Supabase existente. A migration apenas estende o contrato atual: não cria uma segunda estrutura de usuários, não cria avaliações e não substitui a fila administrativa.

Depois da aplicação, siga o checklist em [docs/OPERATIONS.md](docs/OPERATIONS.md) antes de divulgar o link do pré-cadastro.
