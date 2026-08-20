# Landing Terms Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir uma mensagem de contexto sobre os termos acima dos links legais da tela de boas-vindas.

**Architecture:** A página inicial já possui uma seção visual para links legais. O texto será inserido nela, antes da navegação, sem criar estado, checkbox ou validação adicional. Um teste de renderização protege a presença da mensagem.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

---

### Task 1: Mensagem de contexto dos termos

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Modify: `src/test/landingPage.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Em `src/test/landingPage.test.tsx`, incluir após a verificação de gratuidade:

```tsx
expect(screen.getByText(
  'Ao continuar, você confirma que leu e concorda com os termos de uso, termos de serviço e política de privacidade do FazAí.',
)).toBeInTheDocument();
```

- [ ] **Step 2: Executar o teste para confirmar a falha**

Run: `rtk npm test -- --run src/test/landingPage.test.tsx`

Expected: FAIL porque a mensagem ainda não está presente na página.

- [ ] **Step 3: Inserir a mensagem antes dos links legais**

Em `src/pages/LandingPage.tsx`, alterar a seção com `className="landing-note"` para conter:

```tsx
<section className="landing-note">
  <p>Ao continuar, você confirma que leu e concorda com os termos de uso, termos de serviço e política de privacidade do FazAí.</p>
  <nav className="legal-links" aria-label="Informações legais">
    <a href={link('/termos')}>Termos de Uso</a>
    <a href={link('/termos-de-servico')}>Termos de Serviço</a>
    <a href={link('/privacidade')}>Política de Privacidade</a>
  </nav>
</section>
```

- [ ] **Step 4: Executar o teste para confirmar o comportamento**

Run: `rtk npm test -- --run src/test/landingPage.test.tsx`

Expected: PASS com 1 teste aprovado.

- [ ] **Step 5: Verificação final e commit**

Run: `rtk npm test; rtk npm run lint; rtk npm run build; rtk git diff --check`

Expected: 51 testes aprovados, lint sem erros, build concluído e diff sem erros de espaço.

```bash
git add src/pages/LandingPage.tsx src/test/landingPage.test.tsx
git commit -m "feat: explain terms on landing page"
```
