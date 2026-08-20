# Refinamento do formulário de pré-cadastro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar validações e experiência mobile do pré-cadastro, integrar ViaCEP e eliminar a falha 502 do envio de OTP sem criar fluxos paralelos.

**Architecture:** Preservar o wizard e o repositório Supabase atuais. Expor erros Zod como mapas por campo, encapsular ViaCEP em um cliente pequeno e reutilizar o WhatsApp como telefone do perfil. Diagnosticar o Auth Hook existente e alterar somente a função/configuração responsável pelo 502.

**Tech Stack:** React 18, TypeScript, Zod, Vitest, Testing Library, Supabase Auth/Edge Functions, Brevo e CSS responsivo.

---

### Task 1: Validação por campo e contato único

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/components/FormField.tsx`
- Modify: `src/components/steps/ProfileStep.tsx`
- Modify: `src/components/PreRegistrationWizard.tsx`
- Modify: `src/infrastructure/supabase/preRegistrationRepository.ts`
- Modify: `supabase/migrations/20260819120000_provider_preregistration.sql`
- Test: `src/test/domainValidation.test.ts`
- Test: `src/test/profileStep.test.tsx`
- Test: `src/test/preRegistrationRepository.test.ts`
- Test: `src/test/providerPreregistrationMigration.test.ts`

- [ ] **Step 1: Write failing tests**

Add assertions that a valid CPF (`52998224725`) and CNPJ (`11222333000181`) pass, invalid check digits fail on path `documento`, only `WhatsApp do seu serviço` is rendered, its error is below the input, and repository payload sends `profile.whatsapp` as both `telefone` and `whatsapp`. Assert the migration validates check digits instead of length only.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/test/domainValidation.test.ts src/test/profileStep.test.tsx src/test/preRegistrationRepository.test.ts src/test/providerPreregistrationMigration.test.ts`

Expected: FAIL because field errors are not passed to the step, `Telefone` still exists and SQL checks length only.

- [ ] **Step 3: Implement minimal field-error and WhatsApp flow**

Export a helper with this contract:

```ts
export type FieldErrors = Record<string, string>;

export function issuesToFieldErrors(
  result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } },
): FieldErrors {
  if (result.success) return {};
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  );
}
```

Remove `telefone` from `ProfileDraft`; validate required `whatsapp`; render only the WhatsApp field; pass errors into `ProfileStep`; add `aria-invalid` and a stable error id through `FormField`. In `serializeProfile`, use:

```ts
telefone: profile.whatsapp,
whatsapp: profile.whatsapp,
```

In PL/pgSQL, derive `v_phone_digits` from `p_profile->>'whatsapp'` and add immutable CPF/CNPJ digit-check helper functions used by `submit_pre_registration`.

- [ ] **Step 4: Run tests and verify GREEN**

Run the Task 1 command. Expected: PASS.

### Task 2: ViaCEP with manual fallback

**Files:**
- Create: `src/lib/cep.ts`
- Create: `src/infrastructure/viacep/viacepClient.ts`
- Modify: `src/components/steps/ProfileStep.tsx`
- Test: `src/test/cep.test.ts`
- Test: `src/test/profileStep.test.tsx`

- [ ] **Step 1: Write failing tests**

Specify `maskCep('60160196') === '60160-196'`; successful lookup fills `logradouro` and `bairro`; `{ erro: true }` shows `CEP não encontrado.` below CEP; network failure shows a local message while Rua and Bairro remain editable; a result outside Fortaleza is accepted.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/test/cep.test.ts src/test/profileStep.test.tsx`

Expected: FAIL because CEP helpers and lookup do not exist.

- [ ] **Step 3: Implement minimal ViaCEP client**

Use this public interface:

```ts
export interface CepAddress { cep: string; logradouro: string; bairro: string; localidade: string; uf: string }
export async function lookupCep(cep: string, fetcher: typeof fetch = fetch): Promise<CepAddress>
```

Normalize to eight digits, fetch `https://viacep.com.br/ws/${digits}/json/`, reject non-OK and `erro`, and map only required fields. Trigger lookup when CEP reaches eight digits, show `Buscando endereço…`, preserve number/complement, and never disable manual address inputs.

- [ ] **Step 4: Run tests and verify GREEN**

Run the Task 2 command. Expected: PASS.

### Task 3: Serviço, contador e consistência de preço

**Files:**
- Modify: `src/components/steps/ServiceDetailsStep.tsx`
- Modify: `src/components/PreRegistrationWizard.tsx`
- Test: `src/test/serviceSteps.test.tsx`

- [ ] **Step 1: Write failing tests**

Assert the removed city-focus sentence is absent, the counter starts at `0/2.000`, updates after typing, description errors render below the textarea and min/max price inputs share class `price-input`.

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- src/test/serviceSteps.test.tsx`

Expected: FAIL for missing counter, inline errors and shared class.

- [ ] **Step 3: Implement the service refinements**

Pass a `FieldErrors` map to `ServiceDetailsStep`, render description feedback with current length and remaining minimum, remove the secondary location text, and assign the same class and input attributes to both price controls.

- [ ] **Step 4: Run test and verify GREEN**

Run the Task 3 command. Expected: PASS.

### Task 4: Auth Hook error translation and root-cause diagnosis

**Files:**
- Modify: `src/infrastructure/supabase/preRegistrationRepository.ts`
- Modify or create after download: `supabase/functions/send-auth-email/index.ts`
- Test: `src/test/preRegistrationRepository.test.ts`

- [ ] **Step 1: Write a failing frontend regression test**

Mock `signInWithOtp` with message `Unexpected status code returned from hook: 502` and assert the repository rejects with `Não foi possível enviar o código agora. Tente novamente em alguns minutos.`

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- src/test/preRegistrationRepository.test.ts`

Expected: FAIL because the raw hook message is exposed.

- [ ] **Step 3: Gather backend evidence before changing it**

Download/inspect the deployed `send-auth-email` source, inspect Edge Function logs for the failed timestamp, list required secret names without printing their values, and compare the function response with Supabase Send Email Hook requirements. Record the exact failing boundary: hook authentication, missing secret, Brevo request, or response envelope.

- [ ] **Step 4: Implement the confirmed minimal fix**

Normalize the known hook error in the frontend. In the Edge Function, change only the confirmed failing boundary, preserve Brevo and return the hook response/status required by Supabase Auth. Do not add retries until logs show a transient failure.

- [ ] **Step 5: Verify OTP behavior**

Run the Task 4 test and invoke one controlled OTP request. Expected: test PASS and Supabase Auth returns success rather than 502.

### Task 5: Responsive visual refinement

**Files:**
- Modify: `src/index.css`
- Test: `src/test/appFlow.test.tsx`

- [ ] **Step 1: Add structural regression assertions**

Assert field controls retain shared classes/markup, navigation remains reachable and mobile-specific content is not duplicated.

- [ ] **Step 2: Apply CSS refinement**

Use one consistent control height, stronger heading/body scale, clearer error/focus states, compact mobile shell/card spacing, full-width mobile controls and buttons, two-column desktop grids only above `640px`, and safe wrapping for progress/header labels.

- [ ] **Step 3: Verify responsive behavior**

Run `npm test -- src/test/appFlow.test.tsx`, then inspect at 320px, 375px, 768px and desktop widths. Expected: no horizontal overflow, clipped labels or mismatched controls.

### Task 6: Full verification and commit

**Files:**
- Modify: `README.md` or `docs/OPERATIONS.md` only if ViaCEP/Auth Hook operation needs documentation.

- [ ] **Step 1: Run all automated checks**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run lint`

Expected: exit code 0 with no errors.

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 2: Verify migration SQL**

Run the migration contract test and `git diff --check`. Expected: valid contracts and no whitespace errors.

- [ ] **Step 3: Commit implementation**

```bash
git add src supabase docs
git commit -m "feat: refine provider preregistration form"
```
