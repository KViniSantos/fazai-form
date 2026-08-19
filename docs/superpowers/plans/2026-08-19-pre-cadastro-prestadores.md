# FazAí — Pré-cadastro de prestadores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, mobile-first provider pre-registration form that creates real FazAí accounts and up to two Fortaleza services in the shared Supabase ecosystem, always entering administrative moderation.

**Architecture:** `fazai-form` will be a small Vite/React application using only the Supabase anon client in the browser. A guarded shared-database RPC will update the existing provider profile and call the existing `secure_save_service` rules inside one transaction while forcing only this flow to `pendente`; the existing admin queue, Storage bucket, status functions and Brevo outbox remain the operational system of record.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, Zod, Supabase JS, browser Canvas compression, CSS tokens copied from the existing FazAí visual language.

---

## File map

Create the standalone app files:

- `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `eslint.config.js`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vitest.config.ts`.
- `src/main.tsx`, `src/App.tsx`, `src/index.css`.
- `src/domain/types.ts`, `src/domain/constants.ts`, `src/domain/validation.ts`.
- `src/lib/imageCompression.ts`, `src/lib/phone.ts`, `src/lib/document.ts`.
- `src/infrastructure/supabase/client.ts`, `src/infrastructure/supabase/catalogRepository.ts`, `src/infrastructure/supabase/preRegistrationRepository.ts`.
- `src/hooks/usePreRegistration.ts`.
- `src/components/BrandMark.tsx`, `src/components/ProgressHeader.tsx`, `src/components/FormField.tsx`, `src/components/ImagePicker.tsx`, `src/components/ServiceSummaryCard.tsx`.
- `src/pages/LandingPage.tsx`, `src/pages/PreRegistrationWizard.tsx`, `src/pages/SuccessPage.tsx`.
- `src/components/steps/ProfileStep.tsx`, `ServiceDetailsStep.tsx`, `ServiceAvailabilityStep.tsx`, `ServiceImagesStep.tsx`, `ReviewStep.tsx`, `OtpStep.tsx`.
- `src/test/setup.ts` and focused `src/test/*.test.ts(x)` files.
- `.env.example`, `README.md`, `docs/OPERATIONS.md`.
- `supabase/migrations/20260819120000_provider_preregistration.sql`.

Do not copy the site, mobile app or admin source trees into this repository. Use the existing Supabase contracts and the existing visual tokens only.

### Task 1: Bootstrap the standalone app and test harness

**Files:**

- Create: `package.json`, `index.html`, `vite.config.ts`, `eslint.config.js`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vitest.config.ts`.
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`, `src/test/app.test.tsx`.
- Modify: `.gitignore` only if generated files are not already ignored.

- [ ] **Step 1: Define the package and scripts.**

Create `package.json` with these scripts and dependencies:

```json
{
  "name": "fazai-provider-preregistration",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.110.8",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "lucide-react": "^0.462.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@vitejs/plugin-react-swc": "^4.3.2",
    "eslint": "^9.32.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "jsdom": "^29.1.1",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.38.0",
    "vite": "^7.3.6",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Install dependencies and verify the empty harness.**

Run: `npm install`

Expected: `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 3: Configure TypeScript, Vite, ESLint and the test environment.**

Set the `@/*` alias to `src/*` in both `tsconfig.app.json` and `vite.config.ts` using `fileURLToPath(new URL('./src', import.meta.url))`. Configure `vitest.config.ts` with `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']` and the same alias. Create `eslint.config.js` with the TypeScript parser, React Hooks rules and browser globals. In `src/test/setup.ts`, import `@testing-library/jest-dom`.

- [ ] **Step 4: Write the first failing application test.**

Create `src/test/app.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '@/App';

describe('FazAí provider pre-registration app', () => {
  it('explains the Fortaleza pre-launch registration on the public entry screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /cadastre seu serviço no fazaí/i })).toBeInTheDocument();
    expect(screen.getByText(/fortaleza/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /começar cadastro/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the failing test.**

Run: `npm test -- src/test/app.test.tsx`

Expected: FAIL because `src/App.tsx` does not yet render the entry screen.

- [ ] **Step 6: Implement the minimal app shell.**

Create `src/main.tsx` with `createRoot(document.getElementById('root')!).render(<App />)`, create `src/App.tsx` with the heading, Fortaleza copy and CTA, and create `src/index.css` using the existing FazAí tokens: Space Grotesk headings, DM Sans body, `hsl(350 80% 52%)` primary, light background `hsl(225 20% 97%)`, white cards, rounded corners and responsive container styles.

- [ ] **Step 7: Verify the first test passes.**

Run: `npm test -- src/test/app.test.tsx`

Expected: PASS with one test and zero failures.

- [ ] **Step 8: Commit the bootstrap.**

Run:

```text
git add package.json package-lock.json index.html vite.config.ts tsconfig*.json vitest.config.ts src
git commit -m "chore: bootstrap provider preregistration app"
```

### Task 2: Add domain types and validation rules

**Files:**

- Create: `src/domain/constants.ts`, `src/domain/types.ts`, `src/domain/validation.ts`.
- Create: `src/lib/phone.ts`, `src/lib/document.ts`.
- Create: `src/test/domainValidation.test.ts`.

- [ ] **Step 1: Write failing validation tests.**

The tests must cover the exact business rules:

```ts
import { describe, expect, it } from 'vitest';
import { validateProfile, validateService, validateSubmission } from '@/domain/validation';
import { makeEmptyProfile, makeEmptyService } from '@/domain/types';

describe('provider pre-registration validation', () => {
  it('allows an omitted CPF/CNPJ while requiring the remaining provider data', () => {
    const result = validateProfile({
      ...makeEmptyProfile(),
      nome: 'Ana',
      sobrenome: 'Silva',
      dataNascimento: '1990-01-15',
      telefone: '85999998888',
      documento: '',
      tipoDocumento: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a provider younger than eighteen', () => {
    const result = validateProfile({
      ...makeEmptyProfile(),
      nome: 'Ana',
      dataNascimento: '2012-01-15',
      telefone: '85999998888',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === 'dataNascimento')).toBe(true);
  });

  it('requires a Fortaleza service with one image and a complete description', () => {
    const result = validateService({
      ...makeEmptyService(),
      categoriaId: '11111111-1111-4111-8111-111111111111',
      titulo: 'Instalação elétrica residencial',
      descricao: 'A'.repeat(100),
      cidadeId: '22222222-2222-4222-8222-222222222222',
      imagemCount: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects more than two services and missing publication consent', () => {
    const result = validateSubmission({
      profile: makeEmptyProfile(),
      services: [makeEmptyService(), makeEmptyService(), makeEmptyService()],
      termsAccepted: true,
      publicationConsent: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['services', 'publicationConsent']),
    );
  });
});
```

- [ ] **Step 2: Run the tests and confirm the expected missing-module failure.**

Run: `npm test -- src/test/domainValidation.test.ts`

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 3: Implement the domain model.**

Define `ProfileDraft`, `AddressDraft`, `ServiceDraft`, `PreparedImage`, `PreRegistrationDraft`, `PriceType`, `DocumentType` and `SubmissionResult` in `src/domain/types.ts`. `makeEmptyProfile()` and `makeEmptyService()` must return deterministic empty values. Put these constants in `src/domain/constants.ts`:

```ts
export const FORTALEZA = { name: 'Fortaleza', state: 'CE' } as const;
export const MAX_SERVICES = 2;
export const MAX_IMAGES_PER_SERVICE = 5;
export const ORIGINAL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const FINAL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const TARGET_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;
export const LEGAL_VERSION = 'fazai-pre-cadastro-2026-08-19';
```

- [ ] **Step 4: Implement Zod-backed validation.**

`validateProfile` must require name, valid date, age >= 18 and a valid Brazilian phone. Document validation runs only when `documento.trim()` is non-empty. `validateService` must require a category UUID, title length 2–60, description length 100–2000, Fortaleza city ID, valid price range when the type is not `a_combinar`, and 1–5 prepared images. `validateSubmission` must require 1–2 services, both consent flags and a non-empty e-mail.

Implement `normalizeBrazilianPhone`/`isValidBrazilianPhone` in `src/lib/phone.ts` with the same DDD and 10/11-digit rules used by the site, and `normalizeDocument`/`isValidCpfOrCnpj` in `src/lib/document.ts`. The validation module must call these helpers instead of duplicating digit rules.

- [ ] **Step 5: Run the tests and commit.**

Run: `npm test -- src/test/domainValidation.test.ts`

Expected: PASS with four tests.

Commit with: `git add src/domain src/test/domainValidation.test.ts && git commit -m "feat: add preregistration domain validation"`

### Task 3: Implement image validation and compression

**Files:**

- Create: `src/lib/imageCompression.ts`, `src/lib/fileValidation.ts`.
- Create: `src/test/imageCompression.test.ts`.

- [ ] **Step 1: Write failing pure-function tests.**

Test accepted MIME types, original size limit, output size limit, output extension selection and the image count limit. The pure API must be:

```ts
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export function validateImageFile(file: Pick<File, 'name' | 'type' | 'size'>): { valid: boolean; message?: string };
export function chooseOutputType(inputType: string): 'image/webp' | 'image/jpeg';
export function validatePreparedImage(file: Pick<File, 'type' | 'size'>): { valid: boolean; message?: string };
```

Assertions must prove a 10 MB file is accepted for processing, a 10 MB + 1 byte file is rejected, a prepared 5 MB file is accepted, a prepared file over 5 MB is rejected, SVG is rejected and six selected images cannot be added to a five-slot service.

- [ ] **Step 2: Run the tests and verify they fail for missing implementation.**

Run: `npm test -- src/test/imageCompression.test.ts`

Expected: FAIL because `src/lib/imageCompression.ts` does not exist.

- [ ] **Step 3: Implement browser compression.**

`compressImage(file)` must load the image with `createImageBitmap` when available and fall back to an `HTMLImageElement`, draw it to a Canvas whose largest edge is at most 1600 px, and call `canvas.toBlob` first as WebP quality `0.82`, then JPEG quality `0.82` if WebP is unavailable. Re-run at quality `0.72` once if the output exceeds 2 MB. Reject if the final output exceeds 5 MB. The resulting `File` must use a UUID-based name with `.webp` or `.jpg`, contain no original EXIF metadata, and revoke all temporary object URLs.

- [ ] **Step 4: Verify compression and commit.**

Run: `npm test -- src/test/imageCompression.test.ts`

Expected: PASS. Commit with `git add src/lib src/test/imageCompression.test.ts && git commit -m "feat: compress provider service images"`.

### Task 4: Add Supabase client and public catalog reads

**Files:**

- Create: `.env.example`, `src/infrastructure/supabase/client.ts`, `src/infrastructure/supabase/catalogRepository.ts`.
- Create: `src/test/catalogRepository.test.ts`.

- [ ] **Step 1: Write repository contract tests.**

Use a small injected Supabase query interface so tests can assert that catalog loading requests active categories and exactly one `Fortaleza`/`CE` city. The test must fail before the repository exists.

- [ ] **Step 2: Implement environment validation and client creation.**

Read only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and optional `VITE_SITE_URL`. Throw a clear startup error when either public Supabase variable is absent. Never read or ship a service-role key.

- [ ] **Step 3: Implement catalog reads.**

`loadCategories()` calls `.from('categorias_servico').select('id,nome').eq('ativo', true).order('ordem')`. `loadFortaleza()` calls `.from('cidades').select('id,nome,estado').eq('nome','Fortaleza').eq('estado','CE').single()` and rejects if no row exists. Cache both results in the wizard hook for the current session.

- [ ] **Step 4: Run tests and commit.**

Run: `npm test -- src/test/catalogRepository.test.ts`

Expected: PASS. Commit with `git add .env.example src/infrastructure/supabase src/test/catalogRepository.test.ts && git commit -m "feat: connect preregistration catalog to Supabase"`.

### Task 5: Add the shared Supabase migration and contract tests

**Files:**

- Create: `supabase/migrations/20260819120000_provider_preregistration.sql`.
- Create: `src/test/providerPreregistrationMigration.test.ts`.

- [ ] **Step 1: Write migration contract tests before SQL.**

Read the migration as text and assert it contains:

```ts
expect(sql).toContain('submit_pre_registration');
expect(sql).toContain("status = 'pendente'");
expect(sql).toContain("nome = 'Fortaleza'");
expect(sql).toContain("estado = 'CE'");
expect(sql).toContain('servicos-imagens');
expect(sql).toContain('v_max_services integer := 2');
expect(sql).not.toContain('CREATE TABLE public.avaliacoes');
expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.submit_pre_registration');
```

Run: `npm test -- src/test/providerPreregistrationMigration.test.ts`

Expected: FAIL because the migration is absent.

- [ ] **Step 2: Add native consent fields and Storage limits.**

In the migration, use idempotent statements:

```sql
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS termos_aceitos_em timestamptz,
  ADD COLUMN IF NOT EXISTS termos_versao text,
  ADD COLUMN IF NOT EXISTS consentimento_publicacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS consentimento_publicacao_versao text;

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'servicos-imagens';
```

- [ ] **Step 3: Extend the current secure-save behavior without changing public callers.**

Recreate the latest `public.secure_save_service(uuid, boolean, jsonb)` body from `supabase/migrations/20260809120000_allow_incomplete_service_drafts.sql`, preserving its return columns and grants. Immediately after its current `v_auto_approve` lookup, add:

```sql
IF current_setting('app.pre_registration_submission', true) = 'true' THEN
  v_auto_approve := false;
END IF;
```

This keeps all existing three-argument callers unchanged while making the flag effective only inside the new guarded transaction.

- [ ] **Step 4: Implement the guarded transaction RPC.**

Create `public.submit_pre_registration(p_profile jsonb, p_services jsonb, p_terms_version text, p_publication_version text)` as `SECURITY DEFINER`, `SET search_path = public`, returning `TABLE(service_id uuid, status public.status_servico)`. It must:

1. Require `auth.uid()` and an active `usuarios` row or create that row using the OTP user's metadata and submitted name.
2. Set `v_max_services integer := 2` and reject arrays with fewer than 1 or more than `v_max_services` services.
3. Validate non-empty legal version strings.
4. Select the single `Fortaleza`/`CE` city and reject if it is unavailable.
5. Set `app.upgrading_to_prestador = true`, update the current user's name, surname, date of birth, optional document/type, phone and `tipo_usuario = 'prestador'`, then restore the transaction-local setting.
6. Replace the existing address only when a non-empty `logradouro` is submitted; otherwise preserve an existing address.
7. Set `app.pre_registration_submission = true` and call `secure_save_service(NULL, true, service_payload)` once for each service. The current RPC enforces the existing two-service limit and payload/image ownership checks; the local flag makes each result `pendente`.
8. Set the four consent fields on each saved service with `now()` and the passed legal versions under `app.secure_service_rpc = true`.
9. Return every saved service ID and `pendente` status. Any exception must roll back all profile/service changes.

Revoke execution from `PUBLIC` and `anon`, grant it only to `authenticated`, and do not grant direct service-table writes to the form.

- [ ] **Step 5: Verify the migration contract and commit.**

Run: `npm test -- src/test/providerPreregistrationMigration.test.ts`

Expected: PASS. Commit with `git add supabase src/test/providerPreregistrationMigration.test.ts && git commit -m "feat: add moderated preregistration transaction"`.

### Task 6: Implement authenticated submission and cleanup repositories

**Files:**

- Create: `src/infrastructure/supabase/preRegistrationRepository.ts`.
- Create: `src/test/preRegistrationRepository.test.ts`.

- [ ] **Step 1: Write failing repository tests.**

Cover these behaviors with injected Supabase/Storage clients:

- `requestEmailOtp(email)` calls `auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`.
- `verifyEmailOtp(email, token)` calls `auth.verifyOtp({ email, token, type: 'email' })`.
- `uploadPreparedImages` writes to `servicos-imagens/{authUserId}/{uuid}.{ext}` with `upsert: false`, returns public URLs and object paths.
- `submit` invokes `submit_pre_registration` with profile, services, `LEGAL_VERSION` and publication version.
- any submit failure removes all object paths uploaded in that attempt.
- no repository method calls `from('avaliacoes')` or sends a password.

- [ ] **Step 2: Run the tests and confirm the expected failure.**

Run: `npm test -- src/test/preRegistrationRepository.test.ts`

Expected: FAIL because the repository is absent.

- [ ] **Step 3: Implement the repository.**

Expose this API:

```ts
export type PreRegistrationRepository = {
  requestEmailOtp(email: string): Promise<void>;
  verifyEmailOtp(email: string, token: string): Promise<{ userId: string }>;
  uploadPreparedImages(userId: string, images: PreparedImage[]): Promise<UploadedImage[]>;
  submit(input: SubmissionInput): Promise<SubmissionResult>;
  removeUploadedImages(paths: string[]): Promise<void>;
};
```

Do not show success until the RPC returns. On a failed RPC, call Storage `.remove(paths)` and preserve the text draft so the user can retry after fixing the error.

- [ ] **Step 4: Run tests and commit.**

Run: `npm test -- src/test/preRegistrationRepository.test.ts`

Expected: PASS. Commit with `git add src/infrastructure/supabase/preRegistrationRepository.ts src/test/preRegistrationRepository.test.ts && git commit -m "feat: submit preregistration through Supabase"`.

### Task 7: Build the wizard state machine

**Files:**

- Create: `src/hooks/usePreRegistration.ts`.
- Create: `src/test/preRegistrationState.test.ts`.

- [ ] **Step 1: Write failing state-transition tests.**

Test that the state starts on landing, moves through profile/service/images/review/OTP, adds at most two services, preserves edits when navigating back, stores only serializable text fields in `sessionStorage`, clears the draft after success and never exposes an edit transition after `submitted = true`.

- [ ] **Step 2: Run the tests and verify missing-hook failure.**

Run: `npm test -- src/test/preRegistrationState.test.ts`

Expected: FAIL because the hook is absent.

- [ ] **Step 3: Implement the reducer and hook.**

Use a reducer with explicit actions `START`, `UPDATE_PROFILE`, `UPDATE_SERVICE`, `ADD_SERVICE`, `REMOVE_SERVICE`, `SET_IMAGES`, `NEXT`, `BACK`, `REQUEST_OTP`, `VERIFY_OTP`, `SUBMIT_SUCCESS`, `RESET`. The reducer must refuse `ADD_SERVICE` when `services.length === 2` and refuse all mutating actions after `submitted` except `RESET`.

Persist a JSON object containing profile text, service text, current step and consent flags under `fazai:provider-preregistration`. Never serialize `File` or OTP values. Restore only records with the current draft version.

- [ ] **Step 4: Run tests and commit.**

Run: `npm test -- src/test/preRegistrationState.test.ts`

Expected: PASS. Commit with `git add src/hooks src/test/preRegistrationState.test.ts && git commit -m "feat: add preregistration wizard state"`.

### Task 8: Implement the public landing page and profile/service steps

**Files:**

- Modify: `src/App.tsx`.
- Create/modify: `src/pages/LandingPage.tsx`, `src/pages/PreRegistrationWizard.tsx`.
- Create: `src/components/BrandMark.tsx`, `src/components/ProgressHeader.tsx`, `src/components/FormField.tsx`.
- Create: `src/components/steps/ProfileStep.tsx`, `ServiceDetailsStep.tsx`, `ServiceAvailabilityStep.tsx`.
- Create: `src/test/landingPage.test.tsx`, `src/test/profileStep.test.tsx`, `src/test/serviceSteps.test.tsx`.

- [ ] **Step 1: Write failing component tests.**

Assert the entry page states “gratuito”, “Fortaleza”, “até 2 serviços”, “até 5 imagens” and “análise antes da publicação”. Assert the profile step marks name, birth date and WhatsApp as required while rendering CPF/CNPJ as optional. Assert the service step renders active categories, fixed Fortaleza/CE and price controls; it must not render a city selector or review creation controls.

- [ ] **Step 2: Run tests and confirm failures.**

Run: `npm test -- src/test/landingPage.test.tsx src/test/profileStep.test.tsx src/test/serviceSteps.test.ts`

Expected: FAIL because the components are absent.

- [ ] **Step 3: Implement the mobile-first UI.**

Use a centered `max-width: 720px` shell, a sticky progress header on mobile, cards with the existing FazAí tokens, large touch targets, inline field errors and clear “Voltar/Continuar” controls. Keep the landing copy factual and use links to `VITE_SITE_URL/termos`, `/termos-de-servico` and `/privacidade`.

Profile fields must use `inputMode="tel"` and the Brazilian phone/CPF/CNPJ masks from `src/lib/phone.ts` and `src/lib/document.ts`. Service details must preserve the existing payload names (`titulo`, `descricao`, `categoria_id`, `tipo_preco`, `preco_minimo`, `preco_maximo`, `horario_atendimento`, `atende_emergencia`, `atende_fim_de_semana`, `whatsapp`, `email_contato`, `cidade_id`).

- [ ] **Step 4: Run tests and commit.**

Run: `npm test -- src/test/landingPage.test.tsx src/test/profileStep.test.tsx src/test/serviceSteps.test.ts`

Expected: PASS. Commit with `git add src/App.tsx src/pages src/components src/test && git commit -m "feat: add preregistration landing and service steps"`.

### Task 9: Implement image step, review, consent and OTP screens

**Files:**

- Create: `src/components/ImagePicker.tsx`, `src/components/ServiceSummaryCard.tsx`.
- Create: `src/components/steps/ServiceImagesStep.tsx`, `ReviewStep.tsx`, `OtpStep.tsx`.
- Create: `src/pages/SuccessPage.tsx`.
- Create: `src/test/imageStep.test.tsx`, `src/test/reviewStep.test.tsx`, `src/test/otpStep.test.tsx`.

- [ ] **Step 1: Write failing component tests.**

Cover:

- one through five prepared image previews render;
- a sixth image is rejected with a clear message;
- image deletion updates the service draft;
- review shows provider data, all services, prices, Fortaleza and image previews;
- the continue/send action is disabled until terms and publication consent are checked;
- review copy says the data will be locked after sending;
- OTP screen sends only an e-mail, accepts a six-digit code and allows requesting another code after the rate-limit cooldown;
- success screen says the services are awaiting analysis and offers no edit button.

- [ ] **Step 2: Run the tests and verify they fail.**

Run: `npm test -- src/test/imageStep.test.tsx src/test/reviewStep.test.tsx src/test/otpStep.test.tsx`

Expected: FAIL because these screens are absent.

- [ ] **Step 3: Implement the image, review and OTP flow.**

`ImagePicker` validates the original file, calls `compressImage`, validates the prepared result, creates a preview URL and revokes it on removal/unmount. `ReviewStep` renders the exact data that will be sent and has no direct submit until the consent flags are true. `OtpStep` calls the repository’s OTP methods, then uploads compressed images and invokes the transaction RPC. The button shows progress for OTP, image upload and final submission.

- [ ] **Step 4: Implement success reset.**

After the RPC returns, dispatch `SUBMIT_SUCCESS`, remove `fazai:provider-preregistration` from `sessionStorage`, release preview URLs and render `SuccessPage`. A browser back navigation must not re-open an editable submitted draft.

- [ ] **Step 5: Run tests and commit.**

Run: `npm test -- src/test/imageStep.test.tsx src/test/reviewStep.test.tsx src/test/otpStep.test.tsx`

Expected: PASS. Commit with `git add src/components src/pages src/test && git commit -m "feat: add review otp and submission screens"`.

### Task 10: Wire routes, loading/errors and operational documentation

**Files:**

- Modify: `src/App.tsx`, `src/pages/PreRegistrationWizard.tsx`.
- Create: `src/components/ErrorNotice.tsx`.
- Create/modify: `.env.example`, `README.md`, `docs/OPERATIONS.md`.
- Create: `src/test/appFlow.test.tsx`.

- [ ] **Step 1: Write the end-to-end component contract test.**

Using a fake repository, simulate landing → profile → one service → five images → review → consent → OTP → success. Assert that the fake repository receives two services only when the second is added, receives the Fortaleza city ID, and success is not rendered before the final RPC resolves.

- [ ] **Step 2: Run the test and verify it fails before wiring.**

Run: `npm test -- src/test/appFlow.test.tsx`

Expected: FAIL because the full route/state integration is not wired.

- [ ] **Step 3: Wire the application flow.**

Use `LandingPage` as the initial screen, keep all wizard states in `usePreRegistration`, load categories/city before the service step, show retryable error notices for catalog, OTP, Storage and RPC errors, and prevent duplicate clicks while any operation is pending.

- [ ] **Step 4: Document configuration and rollout.**

`.env.example` must contain:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SITE_URL=https://fazaih.lovable.app
VITE_PLAY_STORE_URL=
```

`README.md` must explain local setup, `npm test`, `npm run build`, environment variables and that the migration is applied to the existing Supabase project. `docs/OPERATIONS.md` must explain: apply the migration, verify Fortaleza exists, verify Storage limits, run a real test submission, find it in `servicos_pendentes_admin`, approve/reject it in the existing admin, verify Brevo delivery, and use the launch template later. It must explicitly say not to put a service-role key in `.env`.

- [ ] **Step 5: Run integration test and commit.**

Run: `npm test -- src/test/appFlow.test.tsx`

Expected: PASS. Commit with `git add src README.md docs/OPERATIONS.md .env.example && git commit -m "feat: wire preregistration flow and operations docs"`.

### Task 11: Full verification and handoff

**Files:**

- Modify only files needed to correct failures found by verification.

- [ ] **Step 1: Run the complete test suite.**

Run: `npm test`

Expected: every test passes with zero failures.

- [ ] **Step 2: Run lint and TypeScript/build verification.**

Run: `npm run lint`

Expected: exit code 0 with no lint errors.

Run: `npm run build`

Expected: exit code 0 and a generated `dist/` directory.

- [ ] **Step 3: Inspect the final diff and working tree.**

Run:

```text
git diff --check
git status --short
git log --oneline -12
```

Expected: no whitespace errors, only intentional tracked files, and one commit per completed task.

- [ ] **Step 4: Perform the manual acceptance checklist.**

Run the Vite app in a mobile-sized browser and verify: entry copy, mandatory/optional profile fields, fixed Fortaleza, one and two services, five images, sixth-image rejection, compression feedback, full review, required consents, OTP, final pending state, refresh behavior, no edit button, and error cleanup. Validate the created service in the existing admin repository’s moderation queue and test both approval and rejection paths.

- [ ] **Step 5: Report the handoff.**

Report the app URL/configuration requirements, migration path, exact verification commands and any external steps still required (Supabase migration deployment, Brevo template IDs, domain hosting and later launch email activation). Do not claim the feature is production-ready until the fresh test, lint and build outputs are read and successful.
