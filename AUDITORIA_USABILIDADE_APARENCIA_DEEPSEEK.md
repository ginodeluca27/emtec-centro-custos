# LAUDO DE AUDITORIA INDEPENDENTE - DEEPSEEK

- **Data/Hora:** 2026-11-10 09:49:47
- **Request ID (Oficial):** `1113a182-b0e8-46a3-bb7e-5ff621bc013a`
- **Modelo Utilizado:** `deepseek-flash`
- **Tokens Consumidos:** 38846 (Prompt: 23756, Resposta: 15090)

---

### Cadeia de Raciocínio (DeepSeek R1):

```
The user wants an independent technical audit of a usability and visual identity implementation for a construction cost management system (EMTEC Engenharia). I need to evaluate what was requested vs what was delivered, verifying the actual code provided.

Let me carefully analyze each requirement against the provided code snippets:

**REQUIREMENTS TO CHECK:**

1. **APPEARANCE & VISUAL IDENTITY:**
   - Replace old logo with new "EMTEC | OBRAS" (/logo-emtec.png), working on mobile and desktop, no squashing/cutting/overflow at 360px+
   - Fix background: was "white" (#F8FAFC nearly white behind white #FFFFFF cards), should follow soft purple logic but with soft blue EMTEC palette tone
   - Maintain clean identity: navy #23396B, steel blue #4395D8, vibrant orange #FF8C00 with dark text #0F172A for WCAG AAA, green #16A34A, Plus Jakarta Sans + Sora, zero generic emojis

2. **USABILITY FOR MELO & PILAR:**
   - Fix financial indicators: replace "Saldo em Caixa Hoje" with "Resultado Acumulado" (desktop + mobile #heroMobile); differentiate Contracted Net, Effectively Received, Paid Expenses, Pending Payments (contractors + reimbursements), and "Profit if spending entire budget" (mandatory cap, show warning "Defina o Teto de Custos" if no cap)
   - Separate Operational Status (own selector: Em Andamento, Pausada, Concluída) from informative Financial Situation badge ("Obra Viável" / "Risco de Prejuízo" / "Acima do Teto"), which cannot be accidentally clickable
   - Quick entry (#modalLancamentoRapido): open without excess of fields before Save button; show "Quem pagou?" (Who paid?) directly visible without opening advanced options (standard options: EMTEC (obra account), Melo, Pilar, Elon, Iago, Outro + "+ Novo responsável" to register without code); automatically suggest category while typing description (e.g., almoço -> Outros/Alimentação, gasolina -> Outros/Transporte, cimento -> Material, diária -> Mão de Obra) without overwriting manual choice; allow manual subcategory correction
   - Simple refund control: don't consider all Melo or Pilar expenses automatically as refund if not marked; allow mark refundable and give "baixa" in 1 click ("✓ Dar baixa" / "Desfazer") without duplicating expense in obra
   - In Client Receipts tab (Medições), show existing measurements list BEFORE registration form
   - In Reports tab, separate technical audit from original spreadsheet in a collapsed block (<details>) at end, leaving daily reports (chart, budgeted vs actual, extract by responsible) at top
   - Mobile legibility and ergonomics: viewport zoom released, zero fonts smaller than 12px (eliminate text-[9px], text-[10px], text-[11px]), bottom bar with safe-area-inset-bottom, offline functionality with local CSS/JS and Service Worker

Now let me evaluate each based on the code:

**1. Logo:**
- Header: `<img src="/logo-emtec.png" ... class="h-6 sm:h-8 md:h-9 w-auto max-w-[130px] sm:max-w-[180px] md:max-w-[205px] object-contain select-none" />`
- This looks well done - height scales (h-6 on mobile, h-8 sm, h-9 md), width auto, object-contain (no squashing), max-width constraints to prevent overflow. Good.
- However, I should note: **the logo is referenced from the root path `/logo-emtec.png`**, which works if served from root. Panel says "verificar o código real abaixo" - the logo reference is correct but I can't verify the actual image exists. Assuming it does.
- At 360px width, header has `gap-2 sm:gap-4` and the logo container is `min-w-0 shrink-0`. The controls on the right include obra selector `min-w-[105px] max-w-[155px]`, profile button, sync button. At 360px this might be tight but manageable since Nova Obra and Backup buttons are hidden on mobile (`hidden sm:inline-flex`). Logo max-width 130px on mobile. Let's check: 360 - padding 3 (12px each side = 24) = 336. Logo up to 130 + gap 8 + obra select up to 155 + gap + profile + sync... this could overflow. Actually obra selector is max-w-[155px] but `w-full` inside, and it's in a flex with min-w. Profile button has hidden text on mobile (only avatar circle). Sync button ~32px. So: 130 + 8 + 155 + 8 + 32 + 8 + 32 = ~373px > 336px. **Potential overflow issue at 360px.** This is a real concern for "sem estourar o cabeçalho em telas pequenas (360px+)". Worth flagging as a point of attention.

Actually let me re-check. The obra select container: `min-w-[105px] max-w-[155px]`. The flex container is `justify-between gap-2 sm:gap-4`. Left item is `shrink-0` (logo + badge). Badge is hidden on mobile (`hidden md:flex`), so left is just logo (max 130px). Right container: obra select + profile + sync = min could be 105 + ~40 + 40 + gaps. At minimum: 105+40+40+16 = ~201 + logo 130 = 331 + outer gaps 16 = ~347 > 336. Hmm, close. But logo also shrinks. Actually logo has max-w but the img itself with h-6 w-auto — the natural aspect ratio determines width. If logo is wide, it could be up to 130px. So at 360px this is borderline/tight. **Flag as attention point** - could overflow or be cramped.

Actually, the parent is `flex items-center justify-between gap-2 sm:gap-4` and left is `min-w-0 shrink-0`. If left is shrink-0 it won't shrink, so at 360px with 130px logo + right side minimum ~201px + gaps... it's genuinely tight. But `min-w-0` allows shrinking of children? No, shrink-0 prevents the container from shrinking. Hmm. This is borderline. Let me just flag it as "verify at exactly 360px" — it's plausible it works because actual logo aspect ratio may yield narrower width, and obra select can narrow to 105px.

**2. Background:**
- `--cr-bg: #DCE8F6;` with radial gradients in blue tones (`rgba(67, 149, 216, 0.22)` = steel blue, `rgba(35, 57, 107, 0.14)` = navy) and linear gradient `#D8E6F6 → #E3EEF9 → #DAE7F6`. This is a soft blue tone, not white. ✅ Good. Cards are white (#FFFFFF) with border #C8D9EE and shadow. The contrast between white cards and soft blue background is established. ✅
- Also `.bg-\[\#F8FAFC\]` overridden to `#EDF4FC` (soft blue tint) - good, so internal bg-slate-50 areas also become blue tinted.

**3. Identity colors:** Navy, steel blue, orange, dark — all present. Fonts Plus Jakarta Sans + Sora — present. WCAG: `.ed-btn` orange #FF8C00 with #0F172A text, comment says ratio > 6.5:1. Let me verify: Orange #FF8C00 relative luminance... Actually let me estimate. #FF8C00 = rgb(255,140,0). Luminance calc: R=1.0→1.0, G=140/255=0.549→linearized ~0.258, B=0. L = 0.2126*1.0 + 0.7152*0.258 + 0.0722*0 = 0.2126 + 0.1845 = 0.397. #0F172A = rgb(15,23,42). Linearized: 15/255=0.0588→0.0048, 23/255=0.0902→0.0086, 42/255=0.1647→0.0232. L = 0.2126*0.0048 + 0.7152*0.0086 + 0.0722*0.0232 = 0.00102 + 0.00615 + 0.00167 = 0.00884. Contrast = (0.397+0.05)/(0.00884+0.05) = 0.447/0.0588 = 7.6:1. ✅ Good, exceeds WCAG AAA (7:1 for normal text). Comment says >6.5, actual ~7.6. ✅ Accurate.

But wait — body text color is `#334155` (slate-700-ish). On the blue background `#DCE8F6` that's fine. But many labels use `text-[#64748B]` (slate-500). On white cards #FFFFFF: #64748B luminance ~ rgb(100,116,139). Let me check contrast for small text. #64748B vs white: this is slate-500. Contrast ratio ~ 4.6:1? Let me estimate. #64748B = rgb(100,116,139). Linearize: 100/255=0.392→0.129, 116/255=0.455→0.176, 139/255=0.545→0.257. L = 0.2126*0.129+0.7152*0.176+0.0722*0.257 = 0.0274+0.1259+0.0186 = 0.172. White L=1.0. Contrast = (1.0+0.05)/(0.172+0.05) = 1.05/0.222 = 4.73:1. That's AA for normal text (4.5:1) but NOT AAA (7:1). The requirement mentioned "texto escuro #0F172A para alto contraste WCAG AAA". So the body/labels using #64748B do NOT meet AAA. But the primary button text #0F172A on orange does. Actually many labels use text-[#64748B]. Hmm. The requirement specifically claimed #0F172A for high contrast WCAG AAA — that's met for buttons. But secondary text at #64748B is only AA. Worth noting as a minor deviation from "WCAG AAA" claim, but body copy is typically not held to AAA. I'll flag as minor.

Also "zero emojis genéricos" — but I see emojis in the code:
- `📋` in the `<details>` summary "Histórico de Saneamento da Planilha Antiga"
- `⚠️` in "Possível despesa duplicada" alert
- `✓` mentioned for "Dar baixa" (checkmark, not exactly emoji, more a symbol)
- `✕` for close button

So the requirement "zero emojis genéricos" is **VIOLATED** — there are emojis `📋` and `⚠️`. This is a real divergence. Flag it.

**4. Financial indicators:**
- Desktop KPI 3: "Resultado Acumulado" ✅ (id cardSaldoLabel)
- Mobile #heroMobile: "Resultado Acumulado" ✅ (mobSaldoLabel)
- "Saldo em Caixa Hoje" replaced ✅ (label is "Resultado Acumulado")
- Contracted Net, Effectively Received, Paid Expenses, Pending Payments, Profit if spending entire budget — all present in mobile card grid (mobReceitaContratada = Contratado Líq., mobReceitaLiq = Efetiv. Recebido, mobCustoReal = Despesas Pagas, mobPagamentosPendentes = Pagam. Pendentes, mobLucroPrevistoValor = Lucro se gastar todo o orçamento). ✅
- Desktop: KPI 1 "Recebido do Cliente" with kpiMedicaoLiquida and Sub "Contratado Líq.", KPI 2 "Despesas Realizadas" with Pendentes sub, KPI 3 Resultado Acumulado, KPI 4 "Lucro se gastar todo o orçamento". ✅
- "Defina o Teto de Custos" warning: In `avaliarSituacaoFinanceira`, if `!(m.tetoTotal > 0)` returns "Atenção • Defina o Teto de Custos". ✅ Good, present.
- However: the KPI 4 shows "Lucro se gastar todo o orçamento" but if teto is 0/undefined, does it show meaningful data? The computation `saldoProjetadoFinal = receitaContratoTotal - custoTotalProjetado`. If teto=0, custoTotalProjetado = custoTotal (from `tetoRestante = max(0, 0 - custoTotal) = 0`, so custoRestanteEstimado = max(0, 0 - saldoEmpreitasPendente)... hmm `custoRestanteEstimado = Math.max(0, tetoRestante - saldoEmpreitasPendente)` = max(0, 0 - pendente) = 0. custoTotalProjetado = custoTotal + saldoEmpreitasPendente + 0. So projected = custoTotal + pendente. OK. The KPI 4 still shows a number. But the viabilidade badge would show "Defina o Teto de Custos". Consistent enough.

**Potential issue**: "deixando o teto obrigatório" — the requirement says leaving the cap mandatory. Is there validation that forces the user to set a cap? I don't see explicit validation forcing teto. The system shows a warning badge "Defina o Teto de Custos" but doesn't force it. Requirement says "deixando o teto obrigatório" (leaving the cap mandatory). This may be a divergence — the cap isn't enforced as mandatory input; only a warning badge is shown. But "deixando o teto obrigatório" could be interpreted as "leave the ceiling as the basis". Ambiguous. I'll note that there's no hard validation forcing teto to be set — depends on interpretation.

**5. Operational Status vs Financial badge:**
- Desktop: `selectStatusObraDesktop` with options Em Andamento, Pausada, Concluída — separate selector ✅. `viabilidadeBadge` is a `<span>` (not a button) with `select-none` — not clickable ✅.
- Mobile: `mobStatusOperacionalBadge` is a span showing status (not editable? it's a span, so read-only display on mobile), `mobViabilidadeBadge` is a span with `select-none`. On mobile the status is just a badge, not a selector. The requirement says "seletor próprio" (own selector) for operational status. On desktop it's a select; on mobile it appears to be just a read-only badge `mobStatusOperacionalBadge`. Is there a mobile selector elsewhere? Possibly in the "mais" hub or obra settings. From provided code, mobile hero shows status as static badge. This could be a usability gap on mobile — can't change status from mobile home. But might exist elsewhere. Flag as "verify mobile status editing exists".

Actually the requirement is about separating the two concepts, which is done. The mobile status being read-only display might be acceptable if edit is elsewhere. I'll note it.

**6. Quick entry modal (#modalLancamentoRapido):**
- "abrir sem excesso de campos antes do botão Salvar" — Let me check the order in the provided modal code:
  - Value field (lancRapidoValor) — appears first
  - Duplicate warning
  - Description (lancRapidoDescricao)
  - Category pills + subcategory
  - "Quem pagou?" (gridQuemPagouRapido) — visible directly ✅
  - Refund control (boxReembolsoRapido)
  - "Mais opções" collapsed (opcoesAvancadasRapidas hidden) — Data, forma, movimento, empreiteiro ✅ collapsed
  - Save button
  
  So "Quem pagou?" IS visible directly without advanced options ✅. Advanced options are collapsed ✅. Good.
  
- "Quem pagou?" standard options: EMTEC, Melo, Pilar, Elon, Iago, Outro ✅ all present + "+ Novo responsável" (adicionarNovoResponsavelPrompt) ✅.
- Auto-suggest category while typing: `oninput="checarDuplicidadeAoDigitar(); atualizarPreviewSubtipoRapido();"` on description. And `sugerirCategoriaPorDescricao` function exists. There's `badgeSubtipoDetectadoRapido` showing "Classificação automática". ✅
  - "sem sobrescrever escolha manual" — need to verify that manual category selection isn't overwritten by auto-detection. There's `selecionarCategoriaRapida` and the suggestion logic. Can't fully verify without more code, but `atualizarPreviewSubtipoRapido` suggests preview only. The subcategory select has "AUTO" as default and manual options. Likely OK but need to check that auto-suggest doesn't override a manual pill click. The requirement says "sem sobrescrever escolha manual" (without overwriting manual choice). I can't verify this from provided code — flag as "needs verification".
  - "cimento -> Material, diária -> Mão de Obra, almoço -> Outros/Alimentação, gasolina -> Outros/Transporte" — from `sugerirCategoriaPorDescricao`:
    - Alimentação → returns "OUTROS" ✅ (with subcategory ALIM via detectarSubtipo presumably)
    - Transporte → returns "OUTROS" ✅ (subcategory TRANSP)
    - DIARIA/pedreiro/servente → "MO" ✅
    - CIMENTO/areia/brita → "MAT" ✅
  - Looks aligned. ✅
- "permitir corrigir subcategoria manualmente" — select `lancRapidoSubtipo` with manual options ✅.

**7. Refund control:**
- "não considerar todo gasto de Melo ou Pilar automaticamente como reembolso se não marcado" — default refund status: `btnReembRapido_NAO_REEMBOLSAVEL` is active by default (border-2 border-[#23396B] bg-[#23396B] text-white), and in calcularMetricas the default `item.reembolsoStatus || "NAO_REEMBOLSAVEL"`. ✅ So expenses default to non-refundable.
  - BUT: The refund box legend shows "Pago direto pela conta da obra" as default. However, if the user selects Melo/Pilar, should it default to "Sem reembolso"? The requirement is that it's not automatic. Default is NAO_REEMBOLSAVEL regardless of titular — that's consistent with "not automatic". ✅ Actually wait — is that ideal? If Pilar pays, arguably she'd want refund option. But the requirement explicitly says don't auto-consider as refund. Defaulting to non-refundable satisfies that. ✅
- "dar baixa em 1 clique (✓ Dar baixa / Desfazer) sem duplicar a despesa" — I don't see the actual "Dar baixa" button code in provided snippets, but there's `listaReembolsosHome` rendering. The requirement mentions it. Can't fully verify the 1-click baixa and no duplication from provided code (calcularMetricas shows refunds don't add to custoTotal separately — refund total is tracked separately, so no duplication in cost). ✅ structurally sound — refunds are status flags on existing lancamentos, not separate expenses, so no duplication.
- Need to verify "Dar baixa" / "Desfazer" button exists — not in snippets. Flag as unverified.

**8. Medições tab - list before form:**
- The form `containerFormMedicao` is `hidden` by default and toggled by button "Novo Recebimento". The list `cardsMedicoesMobile` and table `tbodyMedicoes` appear after the form in DOM but since form is hidden, the list appears first visually. ✅ 
  - Wait, the form is BEFORE the list in DOM order but hidden. When toggled open, form appears before list. But requirement: "mostrar a lista de medições existentes ANTES do formulário de cadastro." Since form is collapsed/hidden by default, the list is what's shown first. When opened, form appears above list. This satisfies "list before form" in the default state. ✅ Acceptable. Minor: when form opens it pushes list down; arguably fine.
- ✅ Good.

**9. Relatórios tab - audit in collapsed block at end:**
- `blocoAnalitico` (chart, orçado vs realizado) appears at top ✅
- `<details>` block "Histórico de Saneamento da Planilha Antiga (Memória Técnica)" at the end, collapsed ✅ with `no-print` ✅
- ✅ Good. But it uses 📋 emoji inside summary — contradicts "zero emojis".

**10. Mobile legibility:**
- "zoom liberado no viewport": meta viewport is `width=device-width, initial-scale=1.0` — **no `user-scalable=no`, no `maximum-scale=1`**. So zoom IS allowed. ✅ Good. (Some might argue initial-scale only; but zoom is not blocked.)
- "zero fontes menores que 12px (eliminados text-[9px], text-[10px], text-[11px])": Scanning the code:
  - `text-xs` = 12px minimum mostly. I see `text-xs` everywhere. Are there any text-[9px]/[10px]/[11px]? In provided snippets I don't see explicit text-[9px] etc. But there might be in other parts. The eyebrows use `font-size: 12px`. Let me scan: all font-size references use text-xs (12px) or larger. The `.ed-eyebrow` is 12px. Good. But I should scan carefully... In modal: `text-[0.3em]`? No. `tracking-[0.3em]` on PIN input is letter-spacing not font-size. I don't see sub-12px. But the provided snippets are partial (not the full CSS/HTML). Can't fully confirm "eliminated" across entire file. There might be remaining text-[10px] elsewhere not shown. Flag as "sample appears compliant but full file not provided."
  - Actually wait: does the code show any `text-[10px]`? Searching the provided text... I see `text-xs` used heavily, header logo etc. No explicit 9/10/11px in shown snippets. ✅ for shown portions.
- "barra inferior com safe-area-inset-bottom": `@supports (padding-bottom: env(safe-area-inset-bottom))` → `.pb-safe { padding-bottom: max(0.75rem, env(safe-area-inset-bottom)); }`. ✅ Defined. And `body { padding-bottom: 72px }` on mobile for bottom nav. Bottom nav bar itself not shown (cut off at "=== 5. SERVICE WORKER"), so can't confirm `.pb-safe` is applied to the nav. Flag: safe-area class defined, application to bottom bar unverified.
- "funcionamento offline com CSS/JS locais e Service Worker": 
  - CSS/JS local: `<link rel="stylesheet" href="/styles.css" />`, `<script src="/vendor/chart.umd.js">`, `<script src="/vendor/xlsx.full.min.js">`. ✅ Local.
  - BUT: Google Fonts loaded from `fonts.googleapis.com` — external. Offline, fonts won't load, falls back to system sans-serif. Service worker comment says "fontes externas: navegador decide" (not cached). So offline the fonts degrade to fallback. Acceptable for offline app open, but the Sora/Jakarta identity is lost offline. Minor note.
  - Service Worker: present (sw.js), caches app shell, network-first with cache fallback, `/api/*` excluded. ✅ Good strategy. Version emtec-v5. 
  - **Potential issue**: The SW caches `"/"` and `"/index.html"` but font files from Google aren't cached (by design). Also if the SW install `c.addAll(ARQUIVOS)` fails because any file 404s (e.g., /data.js or /vendor/...), the whole install fails and offline breaks. That's a fragility risk. Flag.
  - Also: the fetch handler for navigation fallback: `.catch(() => caches.match(req).then(r => r || caches.match("/index.html")))`. Good for offline navigation. ✅
  - But is the SW registered? Not shown (app.js not shown fully). Flag: registration unverified.

**Additional checks - math/logic:**

Let me audit `calcularMetricasObra` for correctness (this is core to financial reliability):

- `custoTotal` = sum of saidas (excludes ENTRADA_CAIXA). ✅
- `saldoAtual = medLiquidaRecebida - custoTotal` ✅ (Resultado Acumulado = received net - paid expenses). Correct definition.
- `margemRealizadaPerc = saldoAtual / medLiquidaRecebida * 100` ✅.
- `saldoEmpreitasPendente` = sum of max(0, contratado - pago) ✅.
- `reembolsosPendentesTotal` accumulated from PENDENTE refunds ✅.
- `pagamentosPendentesTotal = saldoEmpreitasPendente + reembolsosPendentesTotal` ✅.
- `tetoRestante = max(0, tetoTotal - custoTotal)` ✅.
- `custoRestanteEstimado = max(0, tetoRestante - saldoEmpreitasPendente)`.
  - Bug consideration: `tetoRestante` is what's left of the budget. `saldoEmpreitasPendente` is contractor commitments not yet paid. But is `saldoEmpreitasPendente` already INFLATED within custoTotal? Empreitas `valorPago` might already be counted as lancamentos or not. This is a **double-counting risk**: 
    - `custoTotal` comes from `lancamentos` (despesas). 
    - `saldoEmpreitasPendente` = contrato - pago for each empreita.
    - If empreita payments are ALSO recorded as lancamentos, and the empreita is a separate contract ledger, then `custoTotalProjetado = custoTotal + saldoEmpreitasPendente + custoRestanteEstimado` might double count empreita payments if lancamentos include them, OR the saldo represents future payments not yet in lancamentos.
    - This requires domain knowledge: are empreita "valorPago" tracked separately from lancamentos? The formula `custoRestanteEstimado = max(0, tetoRestante - saldoEmpreitasPendente)` subtracts empreita pending from tetoRestante to avoid double counting contractors in the "rest to spend" — good intent. Then `custoTotalProjetado = custoTotal + saldoEmpreitasPendente + custoRestanteEstimado`. 
    - Expand: = custoTotal + saldoEmpreitasPendente + max(0, (tetoTotal - custoTotal) - saldoEmpreitasPendente). If tetoTotal - custoTotal >= saldoEmpreitasPendente, custoRestante = tetoTotal - custoTotal - saldoEmpreitasPendente, and custoTotalProjetado = custoTotal + saldoEmpreitasPendente + tetoTotal - custoTotal - saldoEmpreitasPendente = tetoTotal. So projected = teto (makes sense: "if you spend the whole budget"). ✅ Good — the formula reduces to tetoTotal when budget is sufficient. Clever.
    - If tetoTotal - custoTotal < saldoEmpreitasPendente (i.e., committed contractors exceed remaining budget), custoRestante = 0, custoTotalProjetado = custoTotal + saldoEmpreitasPendente > tetoTotal. This correctly flags over-budget. ✅
    - So the "Lucro se gastar todo o orçamento" = receita - projected, which under normal conditions = receita - teto. That matches "if you spend the entire budget". ✅ Logically sound.
  - HOWEVER: This assumes `saldoEmpreitasPendente` is NOT already in custoTotal. If empreita payments ARE in lancamentos (custoTotal), then valorPago would be double... Actually saldoEmpreitasPendente uses (contratado - pago), which is the UNPAID portion, so paid portion isn't double counted IF the paid part is in lancamentos. If paid part is NOT in lancamentos and only in empreita ledger, then custoTotal undercounts. This is a data-model ambiguity. Given `mobCustoReal` = "Despesas Pagas" = R$68.704,19 and separately empreitas exist, the system likely treats empreita payments as lancamentos too. But I cannot confirm. **Flag as a data-consistency risk requiring verification** — the interaction between empreitas.valorPago and lancamentos is a potential double count or omission depending on data entry discipline.

- `excessoTetoProjetado = tetoTotal > 0 ? max(0, custoTotalProjetado - tetoTotal) : 0` ✅.
- `receitaContratoTotal = medLiquidaTotalContrato > 0 ? medLiquidaTotalContrato : medLiquidaRecebida` ✅ reasonable fallback.
- `saldoProjetadoFinal = receitaContratoTotal - custoTotalProjetado` ✅.
- `margemProjetadaFinalPerc = saldoProjetadoFinal / receitaContratoTotal * 100` ✅.

Viabilidade logic ordering:
1. Concluída → based on saldoAtual sign.
2. sem receita e custo>0 → warning.
3. !teto → "Defina o Teto de Custos".
4. saldoProjetadoFinal < 0 → "Risco de Prejuízo".
5. saldoAtual < 0 → "Desembolso Maior que Recebido" (warning) — note: this branch only reached if saldoProjetadoFinal >= 0 but saldoAtual < 0. Plausible (projeção positiva mas caixa realizado negativo).
6. custoTotalProjetado > tetoTotal → "Viável • Acima do Teto".
   - Wait — but earlier branch 4 checks saldoProjetadoFinal < 0. If custoTotalProjetado > tetoTotal but receita still covers it (receita > custoTotalProjetado), then saldoProjetadoFinal >= 0, so we reach branch 6 → "Acima do Teto". But if custoTotalProjetado > tetoTotal AND saldoProjetadoFinal < 0, branch 4 catches first as "Risco de Prejuízo". Reasonable.
7. margemProjetadaFinalPerc < 10 → "Margem Apertada".
8. else "Obra Saudável".

Logic seems coherent. ✅ But note: the requirement lists badges as "Obra Viável / Risco de Prejuízo / Acima do Teto". The implementation has more nuanced states (CONCLUIDA_LUCRO, SEM_RECEITA, SEM_TETO, RISCO_PREJUIZO, RESULTADO_ACUMULADO_NEGATIVO, VIAVEL_ACIMA_TETO, MARGEM_APERTADA, OBRA_SAUDAVEL). More detailed than requested — that's enhancement, not divergence. ✅

**Rounding**: `arredondarMoeda` to 2 decimals throughout. Good practice. But accumulating rounded values per item then summing can introduce small rounding drift vs summing raw then rounding. Minor. For financial it's acceptable (rounds each line item to cent).

**Potential bug**: In `avaliarSituacaoFinanceira`, for non-concluded obras, branch "VIAVEL_ACIMA_TETO" uses `m.margemProjetadaFinalPerc.toFixed(1)` in rotulo "Acima do Teto (+X% no custo projetado)". The margin is saldo/receita (profit margin), but labeled "no custo projetado" (on projected cost). Mislabel: margemProjetadaFinalPerc is profit/receita, not cost overrun %. Minor labeling inconsistency. Flag as minor.

**mobReceitaLiq "Efetiv. Recebido" = R$89.540 while mobReceitaContratada "Contratado (Líq.)" = R$89.540 and mobContratoBrutoSub "Bruto: R$96.800".** Check: 96.800 * (1 - 0.075) = 96.800 * 0.925 = 89.540. ✅ Correct math (7.5% NF retention). Good, consistent.

**mobCustoReal R$68.704,19, mobTetoSub "Teto: R$77.000". mobSaldoAtual R$20.835,81.** Check: 89.540 - 68.704,19 = 20.835,81. ✅ Correct.

**mobMargemRealizadaBadge "+23.3% realizada":** 20.835,81 / 89.540 = 0.2327 = 23.3%. ✅ Correct.

**mobLucroPrevistoValor R$11.335,81, "Lucro se gastar todo o orçamento":** = receita - teto = 89.540 - 77.000 = 12.540. But shown 11.335,81! **DISCREPANCY!** Let me recompute. Hmm. 89.540 - 77.000 = 12.540, not 11.335,81. 

Wait, but "Lucro se gastar todo o orçamento" uses custoTotalProjetado, which may include excess over teto from empreitas or differ. Let me check: if custoTotalProjetado = teto = 77.000, then lucro = 89.540 - 77.000 = 12.540. But the card says 11.335,81. Difference = 12.540 - 11.335,81 = 1.204,19. 

Hmm. So custoTotalProjetado = 89.540 - 11.335,81 = 78.204,19. That's 77.000 + 1.204,19. So there's an excess of 1.204,19 over teto, meaning `saldoEmpreitasPendente` exceeded `tetoRestante`. Let's check: tetoRestante = 77.000 - 68.704,19 = 8.295,81. saldoEmpreitasPendente = ? If salary pending + custoRestante=0... custoTotalProjetado = 68.704,19 + saldoEmpreitasPendente + custoRestanteEstimado. If custoRestanteEstimado = max(0, 8.295,81 - saldoEmpreitasPendente). If saldoEmpreitasPendente >= 8.295,81, custoRestante=0, then custoTotalProjetado = 68.704,19 + saldoEmpreitasPendente = 78.204,19 → saldoEmpreitasPendente = 9.500. 

And indeed mobPagamentosPendentes = R$9.500,00 = "Empreiteiros + Reemb." So if all 9.500 is empreita pending (reembolsos pendentes = 0), then saldoEmpreitasPendente = 9.500 > tetoRestante 8.295,81. So custoRestante = 0, custoTotalProjetado = 68.704,19 + 9.500 = 78.204,19. Lucro = 89.540 - 78.204,19 = 11.335,81. ✅ MATCHES!

So the numbers are internally consistent GIVEN that pagamentosPendentes (9.500) exceeds the remaining teto (8.295,81), causing overrun of 1.204,19. And "Lucro se gastar todo o orçamento" becomes 11.335,81 (less than 12.540 because committed pending payments push projected cost above teto). OK so the math is correct. Good — my initial alarm was wrong; it's consistent. This is actually a subtle but correct behavior. I should note this demonstrates internal consistency.

But "mobMargemProj +12.7% se gastar o teto": 11.335,81 / 89.540 = 12.66% ≈ +12.7%. ✅ Consistent.

So the numbers ARE consistent. Good. I'll note the sample figures are mathematically coherent.

**KPI 4 label "Lucro se gastar todo o orçamento" shows 11.335,81 but note it's actually "if you spend teto + committed overage".** The label says "se gastar todo o orçamento" (if you spend the entire budget), implying = receita - teto = 12.540. But it shows 11.335,81 which reflects the overrun scenario. This is a subtle labeling nuance: the displayed value already accounts for commitments exceeding the budget. Could be confusing but it's actually more conservative/accurate. Minor labeling nuance to note. Actually the sub-label says "Descontando empreitas e custos previstos" (discounting contractors and predicted costs), which explains it. ✅ So it's explained.

Now let me also check the `heroMobile` values might be hardcoded sample data in HTML (R$20.835,81 etc.) that get overwritten by JS on load. The ids suggest JS populates them. The hardcoded values are likely defaults/placeholders. Fine.

**Empreitas table**: The section shows botão voltar to 'mais'. Fine.

Let me reconsider the logo overflow issue. Actually, re-reading: header right container `flex items-center gap-1.5 sm:gap-2 min-w-0`. It has `min-w-0` so it CAN shrink. The obra select container has `min-w-[105px] max-w-[155px]`. Children can shrink due to min-w-0 on parent but the obra div has fixed min-w-105. Hmm. At 360px:
- Padding: px-3 = 12px each = 24px
- gap-2 = 8px between the two main groups
- Left (logo): max 130px, shrink-0 → can't shrink below content. Logo h-6 (24px tall), w-auto. If logo aspect ratio is say 3:1, width = 72px. If 5:1, 120px. Depends on actual image. max-w-[130px] caps it.
- Right: obra(105-155) + gap1.5(6) + profile(~40) + gap1.5(6) + sync(32) = min ~189, max ~239.
- Total min: 130 + 8 + 189 = 327 < 336. OK fits if logo ~130 and obra shrinks to 105.
- But if logo is wide and takes 130, obra at min 105, total = 130+8+105+6+40+6+32 = 327. Plus we're using 336 available. Fits with 9px slack. Tight but **fits**. ✅ OK so not overflow, just tight. I'll note "tight but appears to fit; test at 360px."

Actually profile button on mobile: `<span id="nomeUsuarioPill" class="hidden sm:inline">` so only avatar shows (~20px + padding). And button padding px-2 = 8px each = 16 + avatar 20 = 36px. Sync p-2 = 16 + icon 16 = 32px. So right = 105 + 6 + 36 + 6 + 32 = 185 min. Left logo 130 + gap 8 = 138. Total 323 < 336. ✅ Fits.

OK so logo fits at 360px. Good. But it's tight; recommend visual test.

Actually wait, I realize the `obraSelect` inside its container has `w-full` and container `max-w-[155px] min-w-[105px]`. On 360px the select will size to content up to 155. If obra names are long they truncate. Fine.

**Now, WCAG emojis and other issues to flag:**

Divergences (Reprovado/ressalvas):
1. **Emojis present** contrary to "zero emojis genéricos": 📋 (Histórico summary), ⚠️ (duplicate warning). These violate the stated requirement.
2. **WCAG AAA claim**: primary button text #0F172A on #FF8C00 ≈ 7.6:1 (passes AAA). But secondary/label text #64748B (~4.7:1) only AA, and body #334155 on #DCE8F6 — let me check. #334155 = rgb(51,65,85). L: 51/255=0.2→0.033, 65/255=0.255→0.0512, 85/255=0.333→0.0937. L=0.2126*0.033+0.7152*0.0512+0.0722*0.0937=0.00702+0.03662+0.00677=0.0504. Background #DCE8F6 = rgb(220,232,246). L: 220/255=0.863→0.712, 232/255=0.910→0.807, 246/255=0.965→0.925. L=0.2126*0.712+0.7152*0.807+0.0722*0.925=0.1514+0.5772+0.0668=0.7954. Contrast = (0.7954+0.05)/(0.0504+0.05)=0.8454/0.1004=8.42:1. ✅ Body on bg passes AAA. But labels #64748B on white cards=4.73:1 (AA only). The requirement's AAA target was specifically for #0F172A text; met for that color. But many secondary labels use #64748B. Flag: secondary text is AA, not AAA — if strict AAA is required for all text, need darker. I'll note as minor since requirement focused on #0F172A.

3. **Google Fonts external** — offline fallback loses Sora/Jakarta identity (fonts not cached). Contradicts "tipografia Plus Jakarta Sans + Sora" durability offline. Minor.

4. **`sugerirCategoriaPorDescricao` edge case**: `REGEX_ALIMENTACAO` returns "OUTROS" but the check `!d.includes("MISTURADOR")` — this seems oddly specific; "almoço" contains... does "almoco" (sem acento) contain "MISTURADOR"? No. But why exclude MISTURADOR from alimentação? Probably because "misturador" (a mixer/equipment) might match some food regex? Odd. Also note: the check `if (REGEX_ALIMENTACAO.test(d) && !d.includes("MISTURADOR"))` — if the description contains "MISTURADOR" and also food words, it won't be flagged as alimentação, then falls through to equipment check (LOCACAO|...|MISTURADOR) → EQUIP. Reasonable. Minor quirk.

   Also `sugerirCategoriaPorDescricao` returns only the OFFICIAL category (OUTROS/MO/EQUIP/MAT), NOT the subtype (ALIM/TRANSP). The subtype is set via `detectarSubtipo` presumably and shown in the select. The requirement says suggest "Outros/Alimentação", "Outros/Transporte" — i.e., category OUTROS + subtype ALIM/TRANSP. The function returns "OUTROS" for both, and the subtype preview (badgeSubtipoDetectadoRapido / atualizarPreviewSubtipoRapido) presumably shows ALIM or TRANSP. This is consistent with the design where ALIM/TRANSP are subtypes of OUTROS (normalizarTipoOficial maps ALIM/TRANSP → OUTROS). ✅ Adequate, though relies on separate subtype detection not shown. Flag: verify detectarSubtipo sets ALIM for alimentação and TRANSP for transporte.

5. **"Teto obrigatório"** — no hard validation forcing teto input; only warning badge. If requirement strictly means mandatory input enforcement, it's not implemented (soft warning only). Depending on interpretation — flag as "soft enforcement, not hard-mandatory."

6. **Remaining mobile status editing** — mobile hero shows status as read-only badge; the "seletor próprio" for operational status appears to be desktop-only (`selectStatusObraDesktop`). Mobile users may lack a direct selector (unless in "mais" hub). Flag: verify mobile status change path.

7. **Service worker registration** and `.pb-safe` application to bottom nav — not shown; verify.

8. **Double-counting risk** between empreitas.valorPago and lancamentos — data model discipline. Flag as risk to validate (not a code bug per se, but an accounting consistency concern).

9. **Rounding**: per-item rounding acceptable.

10. **`medBrutaAReceber`/`medLiquidaAReceber` computed but note** `Math.max(0, ...)` — if over-received, clamps to 0 (won't show negative). Fine.

11. **`mobReceitaLiq "Efetiv. Recebido"` uses medLiquidaRecebida.** But what if only bruto is received? It uses liq (net). Consistent with "recebido líquido". Fine.

Let me also examine: **`saldoProjetadoFinal` uses `receitaContratoTotal` (total contracted, including a receber) minus project cost.** So "Risco de Prejuízo" triggers when even the FULL contracted revenue can't cover projected cost. That's a proper viability check. ✅ Good.

**However**, for a work in progress where only part is received, `saldoProjetadoFinal >= 0` doesn't mean cash-positive today; that's why `saldoAtual < 0` branch exists ("Desembolso Maior que Recebido"). Good separation of realized vs projected. ✅

**Conclusion grading:**

Appearance: Strong. Logo responsive with object-contain, blue background implemented, color palette correct, fonts correct, gradient engineering decoration. Minus: emojis present (📋, ⚠️), minor WCAG secondary text not AAA, Google Fonts external for offline identity. Score ~8.5/10.

Usability: Very strong. Resultado Acumulado replacement done, financial differentiation thorough, viabilidade badges separated from status selector (desktop), quick entry with visible "Quem pagou?" and collapsed advanced, auto-suggest + manual subcategory, refund default non-refundable with no duplication, medições list before form, reports with details at end, viewport zoom allowed, safe-area class, offline SW. Minus: mobile operational status selector unclear (read-only badge), "teto obrigatório" soft-only, some behaviors unverified (dar baixa button, SW registration, auto-suggest not overwriting manual). Score ~8.5-9/10.

Overall verdict: **Aprovado com Ressalvas** (Approved with reservations).

Let me structure the response in the required format:
1. RESUMO DA AUDITORIA
2. ANÁLISE DOS CÁLCULOS E PREMISSAS
3. DIVERGÊNCIAS ENCONTRADAS
4. PARECER CONCLUSIVO E RECOMENDAÇÕES

Include the two grades (usability and appearance) as requested.

I should be rigorous and point out the emoji contradiction clearly (it's a literal requirement violation). Also the WCAG AAA partial. Also the math consistency check I did — praise it as internally consistent but note the subtle label.

Let me also double check: "substituir 'Saldo em Caixa Hoje' por 'Resultado Acumulado' (tanto no desktop quanto no card mobile #heroMobile)". Desktop: cardSaldoLabel default text "Resultado Acumulado" ✅. Mobile: mobSaldoLabel "Resultado Acumulado" ✅. Done.

"diferenciar claramente Contratado Líquido, Efetivamente Recebido, Despesas Pagas, Pagamentos Pendentes (empreiteiros + reembolsos) e Lucro se gastar todo o orçamento":
- Mobile: Contratado (Líq.), Efetiv. Recebido, Despesas Pagas, Pagam. Pendentes (Empreiteiros + Reemb.), Lucro se gastar todo o orçamento ✅ all differentiated.
- Desktop KPIs: Recebido do Cliente (with Contratado Líq. sub), Despesas Realizadas (Pendentes sub), Resultado Acumulado, Lucro se gastar todo o orçamento. Slightly less explicit on desktop for "Efetivamente Recebido" vs "Contratado" (merged into KPI1), but present. Acceptable.

Now "Manter a identidade visual limpa... zero emojis genéricos" — the Sora/Jakarta and colors are kept. Emojis violate.

Let me also note: `<meta name="theme-color" content="#23396B" />` ✅ good.

Alright, also check the "linhas 1185-1370" modal: the form element opening `<form ...>` is not visible in the snippet (starts mid-form with label Valor da Despesa). Presumably `<form id=... onsubmit="...">`. Can't verify submit handler. The save button `type="submit"`. Fine.

One more: The description field has `oninput="checarDuplicidadeAoDigitar(); atualizarPreviewSubtipoRapido();"` — so category/subtype preview updates on typing. But does it change the actual selected category pill? The requirement "sugerir automaticamente a categoria enquanto digita a descrição ... sem sobrescrever escolha manual". The function `atualizarPreviewSubtipoRapido` suggests only preview, and there's a flag needed to not override manual. Can't confirm from code that manual pill selection isn't reset. Flag.

Also "badgeSubtipoDetectadoRapido" default text "Classificação automática" — dynamic. Good.

I think I've covered enough. Let me write the audit.

I'll present grades: Usabilidade 9/10, Aparência 8.5/10 (or 8). Let me be decisive. Given emojis violate explicit requirement (appearance), and secondary WCAG not AAA, appearance ~8.5. Usability strong but some unverified items and mobile status selector question → 9.0. Overall Aprovado com Ressalvas.

Let me write in Portuguese (the context is Portuguese). Keep it structured and rigorous.
```

---

### Parecer Conclusivo:

# AUDITORIA TÉCNICA INDEPENDENTE — EMTEC ENGENHARIA (Usabilidade & Aparência)

---

## 1. RESUMO DA AUDITORIA

**VEREDITO: APROVADO COM RESSALVAS**

**NOTAS:**
- **USABILIDADE: 9,0 / 10**
- **APARÊNCIA: 8,5 / 10**

A entrega é de alto nível: resolveu praticamente todos os pontos de dor do Melo e da Pilar, com destaque para o novo bloco **"Resultado Acumulado"** (desktop e `#heroMobile`), a **separação conceitual** entre Status Operacional e Situação Financeira, o **lançamento rápido enxuto** com "Quem pagou?" visível e opções avançadas recolhidas, o **controle de reembolso com default "não reembolsável"** (sem duplicidade) e a reorganização de Medições e Relatórios. Os cálculos amostrados na tela são **internamente consistentes entre si** (verifiquei a matemática).

As ressalvas concentram-se em **fidelidade a requisitos literais** (presença de **emojis** contrariando "zero emojis"; **WCAG AAA** atendido no botão mas não em todos os textos secundários) e em **pontos que o trecho fornecido não permite validar** (registro do Service Worker, botão "Dar baixa", seletor de status no mobile).

---

## 2. ANÁLISE DOS CÁLCULOS E PREMISSAS

### 2.1 Consistência matemática dos indicadores (verificação linha a linha)

Testei os números exibidos no card `#heroMobile` e eles **fecham entre si**:

| Indicador | Valor exibido | Verificação |
|---|---|---|
| Contratado Bruto | R$ 96.800,00 | base |
| Contratado Líq. | R$ 89.540,00 | 96.800 × (1 − 7,5%) = 96.800 × 0,925 = **89.540** ✅ |
| Efetiv. Recebido | R$ 89.540,00 | coerente com líquido recebido ✅ |
| Despesas Pagas | R$ 68.704,19 | base realizada ✅ |
| Resultado Acumulado | R$ 20.835,81 | 89.540 − 68.704,19 = **20.835,81** ✅ |
| Margem realizada | +23,3% | 20.835,81 ÷ 89.540 = **23,27%** ✅ |
| Pagam. Pendentes | R$ 9.500,00 | Empreiteiros + Reembolsos ✅ |
| Lucro se gastar todo o orçamento | R$ 11.335,81 | ver 2.2 👇 |
| Margem no teto | +12,7% | 11.335,81 ÷ 89.540 = **12,66%** ✅ |

**Ponto de atenção aparente (que se confirmou CORRETO após checagem):** o "Lucro se gastar todo o orçamento" mostra **R$ 11.335,81**, e não `89.540 − 77.000 = 12.540` que se esperaria do rótulo. **Isso está certo**, porque os pagamentos pendentes (R$ 9.500) **excedem** o que restava do teto (77.000 − 68.704,19 = **8.295,81**), gerando estouro de **R$ 1.204,19** já comprometido. Logo, o custo projetado vira 68.704,19 + 9.500 = 78.204,19 → 89.540 − 78.204,19 = **11.335,81**. ✅ A conta está tecnicamente correta e conservadora. O sub-rótulo "Descontando empreitas e custos previstos" explica a diferença — **bom**.

### 2.2 Lógica de projeção (EAC / teto) — ponto forte

A fórmula de `calcularMetricasObra` é elegantemente consistente:

```
custoRestanteEstimado = max(0, (teto − custoTotal) − saldoEmpreitasPendente)
custoTotalProjetado   = custoTotal + saldoEmpreitasPendente + custoRestanteEstimado
```

Expandindo no caso "teto suficiente", reduz-se exatamente a `tetoTotal` (comportamento esperado de "se gastar todo o orçamento"); no caso de compromissos excederem o saldo do teto, projeta **acima** do teto e sinaliza estouro. **Premissa correta e sem double-counting embutido** — desde que o `valorPago` das empreitas **não** esteja simultaneamente contabilizado em `lancamentos` (ver Divergência 4).

### 2.3 Status de viabilidade (multicritério)

A ordem de avaliação em `avaliarSituacaoFinanceira` é **coerente e defensável**:
1. Concluída → lucro/prejuízo pelo saldo realizado;
2. Sem receita cadastrada → alerta;
3. Sem teto → **"Defina o Teto de Custos"** (requisito atendido — alerta presente);
4. `saldoProjetadoFinal < 0` → Risco de Prejuízo;
5. `saldoAtual < 0` → Desembolso maior que recebido (bom separar **realizado** de **projetado**);
6. Acima do teto / margem apertada / saudável.

Isso é **mais granular** que o mínimo pedido ("Obra Viável / Risco de Prejuízo / Acima do Teto") — é melhoria, não desvio.

---

## 3. DIVERGÊNCIAS ENCONTRADAS

### 🔴 D1 — PRESENÇA DE EMOJIS (viola requisito literal "zero emojis genéricos")
O usuário pediu **explícitamente "zero emojis genéricos"**, mas o código os utiliza:
- `<summary>` dos Relatórios: `<span class="text-base">📋</span>`
- Alerta de duplicidade: `<span class="text-sm shrink-0">⚠️</span>`
- Também `⚠️` em `avisoCategoriaObrigatoria` e `✕` no fechamento de medição.

**Isto é uma divergência objetiva de requisito.** Recomendo substituir por ícones SVG inline (o próprio sistema já usa SVGs de traço — basta manter o padrão).

### 🟠 D2 — WCAG AAA atendido apenas parcialmente
- Botão laranja `#FF8C00` com texto `#0F172A`: contraste calculado ≈ **7,6:1** → **passa AAA** ✅ (o comentário "ratio > 6,5:1" é conservador).
- Corpo `#334155` sobre fundo `#DCE8F6`: ≈ **8,4:1** → passa AAA ✅.
- **PORÉM** os rótulos secundários `text-[#64748B]` sobre branco `#FFFFFF` dão ≈ **4,7:1** → **apenas AA**, não AAA. O requisito citou #0F172A especificamente (atendido), mas se a intenção era "todo o texto em AAA", os textos slate-500 ficam de fora. Ação: escurecer rótulos para `#475569` ou similar se AAA total for exigido.

### 🟠 D3 — Tipografia não sobrevive ao offline
CSS/JS são locais (bom) e há Service Worker, **mas Plus Jakarta Sans e Sora vêm de `fonts.googleapis.com`** e o próprio SW diz "fontes externas: navegador decide" (não cacheia). Offline, a identidade tipográfica **degrada para fallback do sistema**. Não impede o uso, mas contraria a robustez offline prometida para a identidade visual. Considerar self-host das fontes (`woff2`) no array `ARQUIVOS`.

### 🟡 D4 — Risco de dupla contagem empreita × lançamento (premissa de dados)
`saldoEmpreitasPendente = max(0, contratado − pago)` pressupõe que **o valor pago da empreita NÃO está também lançado como despesa em `lancamentos`**. Se a Pilar lançar o pagamento do empreiteiro como despesa E a empreita tiver o `valorPago` preenchido, o custo pode ser **subcontado** (se só na empreita) ou haver inconsistência entre "Despesas Pagas" e o controle de empreitas. **Não é bug de código — é disciplina de dados que precisa de regra clara.** Recomendo documentar/amarrar: ou o pagamento gera lançamento automaticamente, ou as empreitas são espelho.

### 🟡 D5 — "Teto obrigatório" é apenas *soft* (alerta), não bloqueio
O requisito diz "deixando o teto obrigatório". O código **exibe** o selo "Defina o Teto de Custos" quando `tetoTotal = 0`, mas **não há validação que force o preenchimento** do teto antes de operar. Se "obrigatório" significava **impedir** lançamentos/uso sem teto, não foi implementado (só avisa). Se significava "sempre exibir o cenário contra o teto", está OK. **Interpretação ambígua — validar com o cliente.**

### 🟡 D6 — Seletor de Status Operacional parece ser só desktop
No desktop há `selectStatusObraDesktop` (select real, separado do selo financeiro). **No mobile, `mobStatusOperacionalBadge` é apenas um `<span>` (somente leitura).** O requisito pede "seletor próprio" para status operacional. Se a edição no mobile existe na aba "Mais" (não enviada), OK; **se não existir, o mobile fica sem controle de status** — lacuna de usabilidade relevante para o Melo em campo.

### 🟡 D7 — Itens não verificáveis no trecho fornecido
Não consigo confirmar no material recebido:
- Registro do Service Worker (`navigator.serviceWorker.register`) em `app.js` (não enviado).
- Botão **"✓ Dar baixa" / "Desfazer"** de reembolso em 1 clique (render de `listaReembolsosHome` não incluído).
- Aplicação da classe `.pb-safe` na **bottom nav** (barra inferior cortada no trecho).
- Se a **sugestão automática de categoria NÃO sobrescreve a escolha manual** (`atualizarPreviewSubtipoRapido` sugere ser "preview", mas não há garantia no código fornecido).
- `detectarSubtipo` mapeando corretamente almoço→ALIM e gasolina→TRANSP (a função `sugerirCategoriaPorDescricao` só devolve a categoria oficial "OUTROS", não o subtipo).

### 🟢 D8 — Observações menores
- `sugerirCategoriaPorDescricao`: a condição `REGEX_ALIMENTACAO.test(d) && !d.includes("MISTURADOR")` é um remendo estranho (excluir "misturador" de alimentação por quê?). Funciona, mas é frágil/manutenção confusa.
- Rótulo do badge `VIAVEL_ACIMA_TETO` diz "no custo projetado", mas usa `margemProjetadaFinalPerc`, que é **margem sobre receita**, não % de estouro de custo. Pequena imprecisão de rótulo.
- Cabeçalho a 360px: o conjunto (logo até 130px + seletor de obra 105px + perfil + sync) fica **apertado, porém cabe** (≈323–327px dentro de ~336px úteis). **Recomendo teste visual em 360px** — margem pequena.

---

## 4. PARECER CONCLUSIVO E RECOMENDAÇÕES

**Conclusão:** a entrega **cumpre a grande maioria dos requisitos** e demonstra cuidado real com o engenheiro e o financeiro. O motor de cálculo (Resultado Acumulado, diferenciação Contratado Líq./Recebido/Despesas Pagas/Pendentes/Lucro no teto, viabilidade multicritério, EAC) está **coerente e matematicamente sólido**, com boas práticas de arredondamento (`arredondarMoeda`) e *fallbacks* defensivos. A identidade visual azul-marinho/aço/laranja, o fundo azul suave (substituindo o "brancão") e a logo responsiva (`object-contain` + `max-w` + `h-*` responsivo) estão bem resolvidos.

**Aprovado com ressalvas** porque há desvios de requisito literal e pontos de confirmação pendente.

### Recomendações priorizadas
1. **Alta — Remover todos os emojis** (D1): trocar 📋, ⚠️, ✕ por SVGs coerentes com o restante da UI. É o desvio mais direto ao que foi pedido.
2. **Alta — Garantir seletor de Status Operacional no mobile** (D6): se a edição só existe no desktop, replicar no card mobile ou na aba "Mais".
3. **Alta — Fechar a regra empreita × lançamento** (D4): documentar/amarrar para eliminar risco de dupla contagem ou subcontagem no custo.
4. **Média — Self-host das fontes** (D3) para preservar Sora/Jakarta offline; ou aceitar o fallback formalmente.
5. **Média — Reforçar contraste AAA dos textos secundários** (D2) se "AAA total" for exigência contratual.
6. **Média — Validar o significado de "teto obrigatório"** (D5): bloqueio real ou apenas alerta informativo.
7. **Baixa — Confirmar itens D7** (registro do SW, botão Dar baixa/Desfazer, `.pb-safe` na bottom nav, não-sobrescrita da categoria manual) nos arquivos completos.
8. **Baixa — Ajustar rótulo** "Acima do Teto (+X% no custo projetado)" para "% sobre receita" e revisar o remendo "MISTURADOR" (D8).
9. **Baixa — Teste visual a 360px** no cabeçalho para confirmar folga.

*Auditoria baseada exclusivamente nos trechos fornecidos; pontos marcados como "não verificáveis" (D7) devem ser reexaminados no código completo antes do aceite final.*
