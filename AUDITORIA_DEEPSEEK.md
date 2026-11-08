# LAUDO DE AUDITORIA INDEPENDENTE - DEEPSEEK

- **Data/Hora:** 2026-11-08 13:02:56
- **Request ID (Oficial):** `4b2f93a8-10a5-4b28-9dd2-d155b2de8060`
- **Modelo Utilizado:** `deepseek-flash`
- **Tokens Consumidos:** 14823 (Prompt: 2730, Resposta: 12093)

---

### Cadeia de Raciocínio (DeepSeek R1):

```
The user wants an independent technical audit of this dossier. I need to be rigorous, impartial, find errors, divergences, weak premises. Let me carefully analyze the numbers.

Let me check the math.

**Obra 1: Reforma Piscina**

Original Excel:
- MO: R$ 23.088,50 (18 registros)
- MAT: R$ 35.874,38 (28 registros)
- OUTROS: R$ 8.618,31 (53 registros)
- EQUIP: R$ 0,00 (5 registros ignored)
- Total: R$ 67.581,19

Let me sum: 23.088,50 + 35.874,38 + 8.618,31 = 
23.088,50 + 35.874,38 = 58.962,88
58.962,88 + 8.618,31 = 67.581,19 ✓

Good, the sum matches.

Registros count: 18 + 28 + 53 = 99. Plus 5 EQUIP ignored = 104. ✓ Matches "104 itens".

Equipamentos subtotal: 400 + 400 + 49 + 40 + 234 = 1.123,00 ✓

Custo Real Total: 67.581,19 + 1.123,00 = 68.704,19 ✓
Saldo Líquido Real: 89.540,00 - 68.704,19 = 20.835,81 ✓

Medição líquida: Bruto 96.800,00. Desconto 7,5%: 96.800 × 0,075 = 7.260,00. Líquido = 96.800 - 7.260 = 89.540,00 ✓

Saldo apresentado no Excel: 89.540,00 - 67.581,19 = 21.958,81 ✓

OK so the Obra 1 math is internally consistent.

But wait — is there an issue here? The equipment items: some of them are "CONTEINER" at 400, "ESPACADORES" 49, "MISTURADOR" 40, "DRIVE E REFLETOR" 234. These are dated 09/09/2026, 22/09/2026, 14/10/2026, 19/10/2026. Wait, 2026? That's future dates. Hmm. The dates say 2026. That may be a typo in the dossier, or the project runs into 2026. But also — CONTEINER is a rental (locação), which could be considered equipment rental. Fine.

But there's a subtle issue: are these equipment items legitimately "costs" or should some be reclassified? "ESPACADORES" (spacers for tile/steel) is actually a material, not equipment. "CONTEINER" could be equipment rental. "MISTURADOR" equipment. "DRIVE E REFLETOR" could be lighting equipment rental/purchase. This is a classification issue worth flagging — not a math error.

Actually a bigger point: The audit says the Excel formula ignored these 5 items. But the audit should verify: are all 5 items genuinely "EQUIP" type? The dossier says "constavam com código TIPO = EQUIP". OK.

**Obra 2: Caixa Obra / Forro e Pintura**

- Contract: R$ 48.000,00
- Entrada 40%: R$ 19.200,00
- Medição Final 60%: R$ 28.800,00
- Sum: 19.200 + 28.800 = 48.000 ✓

NF 7,5%:
- Entrada líquida: 19.200 × 0,925 = 17.760,00 ✓
- Medição final líquida: 28.800 × 0,925 = 26.640,00 ✓
- Total líquido: 17.760 + 26.640 = 44.400,00
- Check: 48.000 × 0,925 = 44.400,00 ✓

Previsão de custo: R$ 8.100,00 a R$ 10.890,00. Hmm, 8.100 × 1,3444... no. Let me think: 10.890 / 8.100 = 1,3444. Or is it range? 8.100 to 10.890. That's a range. Hmm. Could be 8.100 base and 10.890 = 8.100 × 1,344. Weird. Maybe it's a percentage markup. Actually maybe 8.100 and 10.890 = some BDI. Let's see 10.890/8.100 = 1,3444 = 34,44%. Odd. Or maybe it's a different thing. Just report as given.

Total saídas: R$ 3.270,26
Excel showed TOTAL CUSTO OBRA = R$ 790,00 (wrong column).

Divergence: R$ 3.270,26 - R$ 790,00 = R$ 2.480,26.

**Margem calculations:**

Obra 1: 
- Receita bruta: 96.800,00
- Receita líquida: 89.540,00
- Custo real: 68.704,19
- Saldo: 20.835,81
- Margem sobre receita líquida: 20.835,81 / 89.540,00 = 23,27%
- Margem sobre receita bruta: 20.835,81 / 96.800,00 = 21,52%

Obra 2:
- Receita líquida: 44.400,00
- Custo real: 3.270,26
- Saldo: 44.400,00 - 3.270,26 = 41.129,74
- Margem: 41.129,74 / 44.400 = 92,6% (útil ainda em andamento, so meaningless)

That's a HUGE point — Obra 2 is clearly incomplete (only R$ 3.270 spent vs. R$ 8.100-10.890 predicted). So margem of 92% is a "phantom" margin because the obra is ongoing. Need to flag.

Also — is the R$ 8.100-10.890 "previsão" the budget or something else? The contract is 48.000, so if cost is only 8-11k, margin would be enormous. That seems odd for a painting/drywall obra. Maybe the 8-11k is just material cost and labor is separate/subcontracted. Or maybe the ranges represent something else. This is a red flag worth pointing out.

Wait, let me re-read: "Previsão de Custo lançada no Excel: R$ 8.100,00 a R$ 10.890,00". If the total contract is 48.000 and the predicted cost is only 8.100-10.890, the predicted margin is 77-83%. That's very high for construction. Possible explanations:
- Labor is being done in-house (Melo's own crew) and not accounted as cost? That would be wrong accounting.
- Or the 8-10k is only one category (material) and labor isn't in the prediction.
- Or the contract value includes something else.

This is a legitimate audit flag: The previsão de custo is inconsistent with realistic construction margins, suggesting incomplete cost accounting (labor may not be included) — or the numbers refer to a partial scope.

Also there's a subtle issue with the "40% entrada" — the entrada is usually a down payment that gets deducted from future medições. If you count it as separate revenue, that's fine, but it's a cash flow consideration. The NF: Does the entrada get an NF? Usually yes.

Also — is 7,5% the right tax? For construction services in Brazil, ISS + IR + PIS/COFINS + CSLL retention can be complex. 7,5% is presented as "desc 7,5% NF". Let me check: Typical retentions for serviços:
- ISS: 2-5%
- IRRF: 1,5% (for services)
- PIS/COFINS/CSLL: 4,65%
- INSS: 11% (if applicable)

7,5% could be ISS (2,5%) + IRRF (1,5%) + ... = not standard. But depending on the municipality, 7,5% could be a specific municipal withholding. This should be flagged: is 7,5% a "retenção" (tax retained) or a "desconto comercial"? If it's retention of taxes, it's recoverable in some cases. If it's a straight discount, it reduces revenue. The dashboard treats it as straight revenue reduction, which is conservative and acceptable for margin calculation, but the label should be precise.

Actually the key issue: "Desc. 7,5% NF" — if this is a tax retention (like ISS or IRRF), then it's not necessarily a permanent revenue loss (IRRF can be offset, PIS/COFINS are non-cumulative for some regimes). But for cash-flow/viability of an obra, treating it as revenue reduction is the conventional and conservative approach. So OK but with a caveat.

**Aderência funcional — Melo's 5 pillars:**

Pilar A - Simplicidade: The system has many tabs (5), many fields (Descrição, Classificação, Valor, Data, Titular, Forma de Pagamento, Vínculo a Empreiteiro). That's 7 fields for a simple launch. Melo said "bem simples, sem muita fórmula". Adding Titular, Forma de Pagamento, Vínculo a Empreiteiro goes beyond su simplicity requirement. This is a real aderência weakness — the system may be over-engineered for the "esposa" (wife) who just wants to enter costs. Flag this.

Pilar B - Classification: The system has MAT, MO, EQUIP, OUTROS, Alimentação, Combustível/Transporte. Melo asked for: material, mão de obra, equipamento, alimentação (and mentioned "tal, tal, tal" suggesting others). Transporte/combustível is reasonable. ✓

But — the mini-cards show 6 categories: MAT, MO, EQUIP, OUTROS, Alimentação, Combustível/Transporte. But the KPI 2 says "Mão de Obra + Material + Equipamento + Outros". Where do Alimentação and Transporte fit? If they're subsets of "Outros", then there's double counting risk. If they're separate, then KPI 2 omits them. This is a real inconsistency to flag: the taxonomy is not clearly hierarchical. Are Alimentação and Transporte separate top-level categories or sub-categories of OUTROS? The dashboard KPI 2 lists only 4 categories. If Alimentação is separate, it's not in KPI 2, causing underreporting. This is a significant audit finding.

Actually KPI 2 says "Custo Realizado Acumulado (Mão de Obra + Material + Equipamento + Outros)". If Alimentação/Transporte are their own categories, they need to be in the sum. This is ambiguous — flag it as a consistency risk requiring verification.

Pilar C - Multi-obras: ✓ (seletor dinâmico, nova obra)

Pilar D - Orçado vs Realizado: ✓ (Aba 2 with teto by category, barra percentual)

But one issue: the previsão de custo máximo is per category. What about per obra total? The KPI 4 "Limite Orçamentário" seems to be per obra total (teto = sum of categories). OK.

Pilar E - Medições atestadas: ✓ (Aba 3, status Atestada/Recebida vs Prevista, cálculo automático de retenção)

Important: only "Atestada/Recebida" should count toward revenue for viability. "Prevista" should not. If the KPI 1 counts both, that's a problem. The dossier says KPI 1 is "Medições Líquidas Atestadas" — good, but need to verify Prevista medições are excluded. Flag as verification point.

**Precision of the Excel audit:**

The 1.123,00 equipment error is arithmetically correct. But there are weak points:
- The audit doesn't verify whether the 5 items were truly classified as EQUIP in the original or whether the classification itself was correct (e.g., "ESPACADORES" is material, not equipment — should be reclassified, not just added as equip).
- Dates are in 2026 — future dates. Could be a typo in the source (2024?) or the project timeline is 2026. If dates are 2026 and today is 2025, then these are future-dated entries — an anomaly. Flag.

Actually wait — the current date context. The audit doesn't specify a date, but 2026 dates are suspicious. Let me flag it as "verify".

- The Obra 2 error "R$ 790,00 referencing entrada column" is described but not proven with detail. Which cell? What formula? The audit says "referenciando por equívoco a coluna de entradas" — but R$ 790,00 is not obviously any entrada value (entradas are 19.200 and 28.800). So where does 790 come from? This is unexplained. That's a weakness — the audit claims a cause ("referencia coluna de entradas") but 790 doesn't match any entrada. Unless there were multiple partial entradas summing to 790? No. So the explanation is unsubstantiated. This is a significant audit flag: the "root cause" of the R$790 error is asserted but not demonstrated. Empirical verification needed.

Actually, let me reconsider: maybe 790 is the sum of a partial or a single small entrada. Or maybe it's a completely different cell. The audit's claim is weak. This is a divergence to flag.

**Robustness and additional features:**

- Controle de empreitas: adds value for subcontracted labor, ties to "Mão de Obra" category. Good.
- Titular pagador: useful for reimbursement (EMTEC, Melo, Elon, Iago). But risk: if Melo pays personally, is it a company cost or a loan? Accounting treatment needs clarity. Flag.
- Export Excel/PDF: valuable.
- LocalStorage only: risk of data loss. Backup JSON is good, but "Backup em Nuvem" — is it actually cloud (server) or just JSON download? Dossier says "Persistência LocalStorage sincronizada com exportação e importação JSON de backup" and header has "Backup em Nuvem". If it's just local JSON download labeled as "nuvem", that's misleading. Flag — verify actual cloud backup implementation. This is a data integrity risk.

Also: LocalStorage has ~5-10MB limit. Chart.js, SheetJS fine. But multi-device sync? If Melo and his wife use different devices, LocalStorage won't sync. That's a critical operational limitation for "esposa atualiza" while Melo views. BIG flag.

**Mathematical consistency of margin:**

Margem % — over what base? Gross or net revenue? The system should be explicit. KPI 3 says "Margem de Lucro (% e R$)". If calculated over líquido, that's 23,27% for Obra 1. Over bruto, 21,52%. Ambiguity is a finding.

Also — the "saldo" is not the same as "lucro." Saldo = receita líquida - custo. Lucro would need to account for overhead, taxes on profit, etc. The system labels it "Margem de Lucro" which may overstate. Flag: it's a "margem bruta de contribuição" not "lucro líquido."

**Additional calculations to verify:**

Obra 1 total custo: 68.704,19. Medição líquida 89.540,00. Lucro bruto 20.835,81. Margem bruta = 23,27%.

But wait — is the 7,5% applied to the gross measurement only, or is there also a "medição" that's already net? The dossier says "MEDIÇÃO LÍQUIDA ATESTADA NO EXCEL (Desc. 7,5% NF): R$ 89.540,00 (Bruto: R$ 96.800,00)". So 96.800 × 0,925 = 89.540. ✓

**Check on total cost for KPI:**

KPI 2 says "Custo Realizado Acumulado (Mão de Obra + Material + Equipamento + Outros)". If Alimentação/Transporte are separate from Outros, they're missing. Also for Obra 1, are there alimentação/transporte items? The original data only shows MO, MAT, OUTROS, EQUIP. So for Obra 1, alimentação would be inside OUTROS (53 registros). OK. But for future obras, if the esposa selects "Alimentação" as a category, would it be in KPI 2? Need to check.

**Orçamento/budget:**

Obra 1 doesn't mention a previsão de custo máximo. So KPI 4 (limite orçamentário) may show no data or a default. That's a gap — Pilar D requires previsão for monitoring. For Obra 1, no budget was set. So the "limite orçamentário" KPI would be empty. Flag: the system should support obras without budget by inferring or alerting.

Obra 2: previsão 8.100-10.890, but is it per category or total? If total, then allocated to categories how?

**Viabilidade:**

Obra 2 viabilidade: based on 3.270,26 spent vs 44.400 líquido, it looks wildly viable (92% margin) — but this is because the obra is incomplete. The system would show "Obra Viável" which is misleading. The system needs a "obra em andamento" status that suppresses the viabilidade verdict or compares actual vs. previsão de custo (8.100-10.890) rather than vs. receita. Flag: viabilidade logic is incomplete for ongoing obras.

Actually — a better viabilidade metric would be: (receita líquida prevista) - (custo previsto máximo) ≥ 0. Using previsão, not realized. Obra 2: 44.400 - 10.890 = 33.510 projected margin. Realized to date is irrelevant until complete. The system's use of realized cost creates a "fake high margin" early in the obra — a dangerous decision-support flaw. STRONG flag.

Same for Obra 1: is it complete or ongoing? Saldo 20.835,81. If ongoing, same issue.

**Data integrity/consistency:**

- Duplicate detection for lançamentos? Not mentioned.
- Audit trail (who edited what, when)? Not mentioned. For a "centro de custos" this matters, especially with multiple users.
- Undo/edit history? Not mentioned.
- Currency formatting/locale? Should be BRL, pt-BR.
- Rounding: NF 7,5% — 96.800 × 0,075 = 7.260 exactly. Good. But for odd values, rounding policy? Minor.

**Chart.js donut** — distribution of desembolsos by category. Fine.

**SheetJS export** — good.

**Print/PDF report** — good.

**Conformidade com o áudio:**

Melo said "sem muita fórmula, sem nada". The system is arguably more complex than requested — 5 tabs, 7 fields, empreitas, titulares. This could violate Pilar A. However, the added features are optional if the primary flow is simple. Still, a real aderência concern.

Melo said "relatóriozinho de como é que tá os custos, se tá atingindo o máximo". The system has this ✓.

Melo said "previsão de custo máximo para tal" ✓.

Melo said "medições atestadas... medição 1, 2, 3" ✓.

Melo said "se aquela obra tá ou não sendo viável" ✓ but with the flawed early-stage logic noted.

**Final verdict:**

I'd say "COM RESSALVAS" — the core math of Obra 1 checks out, the Excel error identification (R$1.123) is arithmetically correct, but there are real issues:

1. Ambiguity in category taxonomy (Alimentação/Transporte vs Outros) in KPI 2.
2. Early-stage viabilidade logic can show false high margin.
3. Obra 2's R$790 root cause is unsubstantiated.
4. Obra 2's previsão de custo (8-11k vs 48k contract) is suspicious — likely incomplete cost accounting.
5. LocalStorage single-device limitation vs multi-user operation (Melo + esposa on different devices).
6. "Backup em Nuvem" may be mislabeled (JSON download ≠ cloud).
7. Data dates in 2026 — future dates need clarification.
8. Security/audit trail absent.
9. Margem % base ambiguity (bruto vs líquido).
10. Equipment classification issue (ESPACADORES is material, not equipment).
11. Over-engineering vs Pilar A (simplicity).

Actually the request asks me to audit and give a parecer. Let me structure the response properly.

Let me also double check: The "5 registros ignorados pela fórmula de soma do Excel" — the audit says "EQUIP: R$0,00 (5 registros ignorados)". This means the Excel SUMIF for EQUIP returned 0. But we're told 5 items sum to 1.123. So either the SUMIF was broken, or the type column had trailing spaces, or the type code was different. The root cause of WHY the formula ignored them is not established. Flag — the "audit" just adds them back, but doesn't diagnose the Excel formula error. For the new system to be trusted, we need to understand the failure mode (was it a broken SUMIF, a filter, a hidden row, a typo in TIPO?). The new system's validation should prevent this (e.g., referential integrity on categories).

Also — "EQUIP: R$0,00 (5 registros ignorados pela fórmula de soma do Excel)". But wait, if the formula was a SUMIF on TIPO="EQUIP", and 5 rows had TIPO="EQUIP", then it would sum them. Unless the 5 rows had TIPO="EQUIP " (with space) or "equip" (lowercase) or were filtered out. The audit doesn't diagnose. STRONG flag on forensic rigor.

Let me also reconsider the total: 99 counted + 5 ignored = 104. And the 104 is stated as "Total de registros de saída lançados". Good.

But hold on — for Obra 1, the MO count is 18, MAT 28, OUTROS 53. Sum = 99. + 5 EQUIP = 104. ✓ Good.

Hmm, but the audit says "EQUIPAMENTO (EQUIP): R$ 0,00 (5 registros ignorados pela fórmula de soma do Excel)". So the Excel's total 67.581,19 excludes the 1.123. The corrected total is 68.704,19. ✓

OK, let me also think about whether the audit's "Saldo Líquido Real" is correctly the basis for "viabilidade". Yes.

One more: "MEDIÇÃO LÍQUIDA ATESTADA NO EXCEL (Desc. 7,5% NF): R$ 89.540,00 (Bruto: R$ 96.800,00)". Then "SALDO APRESENTADO NO EXCEL: R$ 21.958,81". So the Excel showed this saldo. But the Excel's total was 67.581,19. 89.540 - 67.581,19 = 21.958,81. ✓ internally consistent.

Now the audit recommends the real saldo of 20.835,81. Difference = 1.123,00. ✓

**On Obra 2:**

Let me think about the NF. Entrada 19.200 with 7,5% → 17.760. So the 7,5% is deducted at the entrada too. But typically, the NF (and tax retention) is issued at each medição/payment, so yes, entradas might also have NF. OK, consistent.

But there's a cash-flow nuance: If the entrada is 40% and the medição final 60%, both are liquidated at 92,5%. Total líquido 44.400. ✓.

R$ 3.270,26 saídas. If the previsão is 8.100-10.890, the obra is only ~30-40% through the cost budget. Whether it's complete or not needs the system to track status. The system apparently shows viabilidade based on realized → misleading.

Also — the R$790 discrepancy: 3.270,26 - 790 = 2.480,26. The audit says "A célula 'TOTAL CUSTO OBRA' exibia R$ 790,00 (referenciando por equívoco a coluna de entradas)". But the entradas are 19.200 and 28.800, not 790. So the claim is wrong/unverified. Maybe the R$790 is the SUM of the "saídas" column but with a limited range (only some rows), or it's a SUMIF with a wrong criterion. The audit's explanation is not supported. STRONG flag.

Actually — maybe the R$790 is a "previsão" or "saldo" or some other figure. We don't know. The audit must verify cell-level. The audit as presented FAILS to substantiate the R$790 root cause.

Let me also note: The dossier says "Previsão de Custo lançada no Excel: R$ 8.100,00 a R$ 10.890,00". If these are the previsão de custo MÁXIMO (Pilar D), and the obra total is 48.000, that's a very low budget. But if labor is included and these are only material... Maybe the 8-10k is just material and the labor is the "Empreita Antônio Carlos Forro" (mentioned in Aba 4). So maybe labor is a separate empreita cost. If so, the total previsão is 8-10k (material) + empreita (value unknown). The system should aggregate. Flag: the previsão de custo must include ALL categories (material + MO/empreita + equip + outros), otherwise the orçado vs. realizado comparison is meaningless.

**On the empreitas:**

"Controle de saldo devedor a subempreiteiros (ex: Empreita Revestimento Piscina, Antônio Carlos Forro)." For Obra 1, the "Reforma Piscina" would have "Empreita Revestimento Piscina" — this matches. Good. But is the empreita cost already in the 23.088,50 MO or is it additional? If a sub-empreiteiro is paid, that's a cost. The system must avoid double counting if the empreita is also a "lançamento" with category MO. Flag: define whether empreitas are separate ledger or part of MO.

**Now the "Pilar A" usability concern:**

Melo's wife uses Excel because it's simple. The new system has 5 tabs. But "Lançamentos" tab is the primary. The other tabs are read-only/management. If the wife only uses the Lançamentos form (Descrição, Classificação, Valor, Data — 4 required, with Titular/Forma/Vínculo optional), it's arguably simpler than Excel. But the extra fields could confuse. Recommend: make Titular, Forma, Vínculo optional with defaults, and keep only 4 visible fields initially.

Also, the mini-cards are for Melo's monitoring, not the wife's input — fine.

**Summary of findings:**

I'll categorize:

1. APPROVED calculations:
- Obra 1 totals, saldo corrected (20.835,81), equip sum (1.123,00) — all math correct.
- NF 7,5% math correct for both obras.

2. Divergences/risks:
a. R$790 root cause unsubstantiated (Obra 2).
b. Category taxonomy ambiguity (Alimentação/Transporte vs KPI 2 "Outros").
c. Early-stage viabilidade uses realized cost → false margin in ongoing obras (Obra 2 shows 92% margin — unrealistic).
d. Obra 2 previsão 8-11k vs 48k contract → possible incomplete cost accounting (labor/empreita not in previsão?).
e. Equipment classification: ESPACADORES is material; CONTEINER/MISTURADOR/DRIVE E REFLETOR are equipment (rental/purchase). Mixed classification.
f. Future dates (2026) — anomaly.
g. LocalStorage single-device vs multi-user (Melo + wife).
h. "Backup em Nuvem" may be mislabeled.
i. Margin % base (bruto vs líquido) not specified.
j. "Lucro" vs "margem bruta" nomenclature.
k. No audit trail / user log.
l. Over-engineering vs Pilar A simplicity.
m. Excel SUMIF failure root cause not diagnosed (only symptom treated).
n. Empreita double-counting risk with MO.
o. Obra 1 has no previsão de custo máximo registered — KPI 4 empty, Pilar D not exercised.

3. Additional recs:
- Add "status da obra" (em andamento / concluída) and suppress viabilidade until complete or use previsão-based projection.
- Add duplicate detection and audit trail.
- Multi-device sync (Supabase/Firebase or similar) if wife and Melo use different devices.
- NF 7,5% parameterizable (some notas may have different retention).
- Backup export with versioning.

Verdict: COM RESSALVAS — the core engineering and the equipment audit are arithmetically correct, but there are material issues in (i) Obra 2's unproven error attribution, (ii) viabilidade logic for ongoing obras, (iii) category taxonomy consistency in KPI 2, (iv) platform limitations (LocalStorage single device), and (v) potential double-counting of empreitas.

Let me write it in Portuguese, structured as requested. I'll be rigorous, point out errors, not accept passive premises.

I should note: I'm auditing the dossier as presented — I don't have access to the actual Excel or site. So I'll state assumptions.

Let me structure:

1. RESUMO DA AUDITORIA: COM RESSALVAS (with a clear statement)
2. ANÁLISE DOS CÁLCULOS E PREMISSAS (verify each number, show re-computation)
3. DIVERGÊNCIAS ENCONTRADAS (numbered list)
4. PARECER CONCLUSIVO E RECOMENDAÇÕES

Let me write it thoroughly but not excessively long. Maybe 2000-2500 words. Let me aim for a solid, detailed but readable audit.

I'll include a verification table for the math.

Let me write.
```

---

### Parecer Conclusivo:

# DOSSIÊ DE AUDITORIA TÉCNICA INDEPENDENTE
## Sistema de Centro de Custos EMTEC — Revisão Crítica

> **Nota de escopo:** A auditoria foi realizada sobre o dossiê documental apresentado. Não houve acesso direto ao arquivo Excel original, à interface em produção, ao código-fonte nem ao LocalStorage. As conclusões matemáticas são verificáveis; as conclusões operacionais são condicionais à validação in loco. Onde o dossiê apresenta premissa em vez de prova, isso é explicitamente registrado.

---

## 1. RESUMO DA AUDITORIA

**PARECER PRELIMINAR: COM RESSALVAS**

**Fundamentação sumária:** A aritmética central da Obra 1 está correta (somatórios, correção de equipamentos, saldo líquido e margem). A identificação do erro de R$ 1.123,00 em equipamentos é numericamente exata. Contudo, a auditoria do Excel é **incompleta em sua forense** (não diagnostica a causa-raiz dos erros), a lógica de viabilidade do sistema é **conceitualmente frágil para obras em andamento** (produz margens fictícias), há **ambiguidade na taxonomia de categorias** que pode gerar omissão ou dupla contagem no KPI 2, e a arquitetura de persistência (LocalStorage) é **incompatível com o uso multiusuário** descrito no próprio dossiê (Melo + esposa em dispositivos distintos). São ressalvas materiais, não cosméticas.

---

## 2. ANÁLISE DOS CÁLCULOS E PREMISSAS

### 2.1 Obra 1 — "Reforma Piscina" (reconferência independente)

| Verificação | Cálculo | Resultado | Status |
|---|---|---|---|
| Soma das categorias originais | 23.088,50 + 35.874,38 + 8.618,31 | **67.581,19** | ✅ Confere |
| Contagem de registros | 18 + 28 + 53 = 99; + 5 EQUIP | **104** | ✅ Confere |
| Subtotal equipamentos | 400 + 400 + 49 + 40 + 234 | **1.123,00** | ✅ Confere |
| Custo real auditado | 67.581,19 + 1.123,00 | **68.704,19** | ✅ Confere |
| Receita líquida NF 7,5% | 96.800,00 × 0,925 | **89.540,00** | ✅ Confere |
| Saldo do Excel (original) | 89.540,00 − 67.581,19 | **21.958,81** | ✅ Confere |
| Saldo real auditado | 89.540,00 − 68.704,19 | **20.835,81** | ✅ Confere |
| Margem s/ receita líquida | 20.835,81 ÷ 89.540,00 | **23,27%** | ✅ Confere |
| Margem s/ receita bruta | 20.835,81 ÷ 96.800,00 | **21,52%** | ✅ Confere |
| Δ de correção | 1.123,00 | **Exato** | ✅ Confere |

**Conclusão parcial:** A aritmética da Obra 1 é impecável e a correção de equipamentos está matematicamente correta. **O erro de R$ 1.123,00 é real e foi quantificado com exatidão.**

**PORÉM — ressalva de forensic:** O dossiê afirma que os 5 itens "não entraram no somatório do Excel", mas **não diagnostica a causa**. As hipóteses técnicas não testadas são: (i) SUMIF quebrado / intervalo errado; (ii) código TIPO com espaço residual ("EQUIP "); (iii) caixa divergente ("equip"); (iv) linhas filtradas/ocultas; (v) tabela dinâmica não atualizada. **Sem o diagnóstico da causa-raiz, não há garantia de que o novo sistema não reproduza o mesmo modo de falha.** A auditoria identifica o sintoma, mas não a falha. Recomendação: exigir a análise da célula-fórmula original antes de declarar a Obra 1 encerrada.

### 2.2 Obra 2 — "Caixa Obra / Forro e Pintura"

| Verificação | Cálculo | Resultado | Status |
|---|---|---|---|
| Contrato | 19.200 + 28.800 | **48.000,00** | ✅ Confere |
| Entrada líquida (7,5%) | 19.200 × 0,925 | **17.760,00** | ✅ Confere |
| Medição final líquida (7,5%) | 28.800 × 0,925 | **26.640,00** | ✅ Confere |
| Receita líquida total | 17.760 + 26.640 | **44.400,00** | ✅ Confere |
| Conferência cruzada | 48.000 × 0,925 | **44.400,00** | ✅ Confere |
| Saldo aparente (realizado) | 44.400,00 − 3.270,26 | **41.129,74** | ⚠️ Ver §3.1 |
| Margem aparente | 41.129,74 ÷ 44.400 | **92,6%** | ❌ **Inverossímil** |

**Conclusão parcial:** A aritmética de receita líquida está correta. **A "margem" resultante de 92,6% é matematicamente válida, mas economicamente absurda para obra civil** — e isso expõe uma falha conceitual do sistema, não um erro de conta (ver §3.1).

### 2.3 Premissas que NÃO estão demonstradas

1. **Causa do R$ 790,00 na Obra 2.** O dossiê afirma que a célula "referenciava por equívoco a coluna de entradas". **Isso é falso ou não demonstrado:** a soma de entradas da obra é 19.200 + 28.800 = 48.000, não R$ 790,00. Nenhuma combinação de entradas conhecidas produz R$ 790,00. A explicação é **não sustentada** — ver §3.2.
2. **Composição da "previsão de custo" de R$ 8.100 a R$ 10.890.** Não se informa se inclui mão de obra, empreita, material, equipamento. Frente a um contrato de R$ 48.000, uma previsão de custo máximo de R$ 10.890 implica **margem bruta prevista de 77–83%** — atípica em construção civil. Ver §3.3.
3. **Base da "margem %".** O sistema informa "Margem de Lucro (% e R$)" sem especificar se o denominador é receita bruta ou líquida. Há diferença de ~1,75 p.p. na Obra 1 (21,52% vs 23,27%). Ambiguidade contábil inaceitável em painel executivo. Ver §3.7.
4. **Datas dos lançamentos (2026).** Os 5 equipamentos estão datados de 09/09/2026 a 19/10/2026. **São datas futuras** em relação ao presente. Ou o dossiê tem erro de digitação (2024/2025?), ou há lançamentos pré-datados — ambos exigem verificação. Ver §3.6.

---

## 3. DIVERGÊNCIAS ENCONTRADAS

### 🔴 DIV-01 — Lógica de viabilidade falha para obras em andamento (GRAVE)

**Problema:** O KPI 3 calcula "Saldo Final / Margem de Lucro" como `Receita líquida − Custo realizado`. Para a Obra 2, isso resulta em **92,6% de margem**, porque a obra apenas começou (R$ 3.270,26 gastos contra previsão de R$ 8.100–10.890). O sistema exibirá o selo **"Obra Viável • Saldo Positivo"** com margem fictícia, induzindo o gestor a uma decisão errada.

**Risco:** A viabilidade deve ser medida contra o **custo previsto máximo**, não contra o realizado parcial. A fórmula correta para obra em andamento é:
`Viabilidade = Receita líquida prevista − Custo previsto máximo ≥ 0`
(valor projetado), sendo a margem realizada exibida apenas quando a obra estiver **concluída**. O sistema precisa de um campo **"Status da Obra: Em Andamento / Concluída"** e de **supressão do selo de viabilidade** enquanto em andamento.

### 🔴 DIV-02 — Causa-raiz do erro de R$ 790,00 não demonstrada (GRAVE — auditoria do Excel)

**Problema:** Conforme §2.3, o dossiê atribui o R$ 790,00 ao "equívoco de referenciar a coluna de entradas", mas **a aritmética não sustenta essa explicação**. R$ 790,00 não é soma, subtotal ou célula de entrada conhecida. A auditoria do Excel fica **incompleta e potencialmente incorreta**. Recomenda-se: (i) identificar a célula e a fórmula exatas; (ii) verificar se R$ 790,00 corresponde a um SUMIF parcial, a uma linha-filtro ou a um valor manualmente sobrescrito; (iii) documentar no Quadro Comparativo da Aba 5 com evidência (print/fórmula).

### 🔴 DIV-03 — Taxonomia de categorias inconsistente com o KPI 2 (GRAVE)

**Problema:** O KPI 2 (Custo Realizado Acumulado) soma explicitamente **"Mão de Obra + Material + Equipamento + Outros"**. Mas a Aba 1 possui **6 mini-cards**: MAT, MO, EQUIP, OUTROS, **Alimentação**, **Combustível/Transporte**. Não está definido se Alimentação e Transporte são:
- (a) subcategorias **dentro** de OUTROS → então o KPI 2 está correto, mas os mini-cards são apenas desdobramento visual; ou
- (b) categorias **top-level independentes** → então **o KPI 2 as OMITE**, subnotificando o custo total e inflando a margem.

**Risco:** Se (b), o custo da Obra fica artificialmente baixo. Na Obra 1, parte dos 53 lançamentos "OUTROS" provavelmente inclui alimentação/transporte — mas isso é **suposição**, não prova. **Exigir a definição formal da hierarquia** e a garantia de que todo lançamento é classificado em exatamente uma categoria contabilizável.

### 🟠 DIV-04 — Classificação mista dos "equipamentos" (MÉDIA)

**Problema:** Dos 5 itens reclassificados como EQUIP, a natureza é heterogênea:
- **CONTEINER** (×2) — locação de equipamento/instalação: aderente a EQUIP.
- **MISTURADOR** e **DRIVE E REFLETOR** — equipamento: aderente a EQUIP.
- **ESPACADORES** (R$ 49,00) — **é MATERIAL** (espaçadores de assentamento), não equipamento.

A correção somou todos em EQUIP. A conta fecha, mas a **classificação contábil está errada para o item 3**. Recomenda-se reclassificar ESPACADORES para MATERIAL, o que **não altera o total** (R$ 68.704,19) mas corrige a **distribuição por categoria** — relevantíssima para o Orçado vs. Realizado (Pilar D).

### 🟠 DIV-05 — Previsão de custo da Obra 2 provavelmente incompleta (MÉDIA-GRAVE)

**Problema:** Contrato de R$ 48.000 com previsão de custo de R$ 8.100–10.890 (margem prevista de 77–83%) é atípico em forro e pintura. **Hipótese mais provável:** a previsão contempla apenas material, ficando a mão de obra/empreita (ex.: "Antônio Carlos Forro") fora do teto. O sistema possui a Aba 4 (Empreitas & Titulares), mas **não há garantia de que o custo da empreita seja somado ao Orçado vs. Realizado**. Sem isso, o Pilar D é inócuo. **Exigir consolidação obrigatória: Custo Previsto Total = Material + MO + Empreita + Equip + Outros.** Verificar também se o valor da empreita lançado como "saldo devedor" está sendo contabilizado como custo (evitando dupla contagem com lançamentos MO).

### 🟠 DIV-06 — Datas em 2026 (MÉDIA)

**Problema:** Ver §2.3.4. Datas futuras podem ser erro de digitação ou pré-datamento. Se forem reais, distorcem filtros por mês e a curva de desembolso. **Verificar e corrigir a base.**

### 🟠 DIV-07 — LocalStorage × uso multiusuário (GRAVE para operação)

**Problema:** O dossiê afirma explicitamente que **"é minha mulher que atualiza"** — e o sistema usa **LocalStorage** (persistência no navegador do dispositivo). Se a esposa lança no computador dela e Melo consulta no celular/dele, **os dados não sincronizam**. O "Backup em Nuvem" citado no header precisa ser verificado: se for apenas **download/upload manual de JSON**, **não é nuvem** — é backup local disfarçado. Para um sistema de centro de custos com dois usuários, isso é **limitação operacional crítica**. Recomendação: backend leve (Supabase/Firebase/Vercel Postgres) com autenticação simples, mantendo o offline-first como fallback.

### 🟡 DIV-08 — Ausência de trilha de auditoria (MÉDIA)

Não se menciona log de quem editou/excluiu lançamentos nem histórico de alterações. Em controle de custos, com múltiplos titulares pagadores (EMTEC, Melo, Elon, Iago), a **rastreabilidade é indispensável** para evitar disputas de reembolso.

### 🟡 DIV-09 — "Lucro" × "Margem bruta de contribuição" (MÉDIA)

O rótulo "Margem de Lucro" é tecnicamente impróprio: o cálculo `Receita líquida − Custo direto` produz **margem bruta de contribuição**, não lucro (que exigiria dedução de overhead, despesas administrativas e tributos sobre o lucro). Recomenda-se renomear para **"Margem Bruta da Obra"** e explicitar a base (bruta ou líquida).

### 🟡 DIV-10 — Complexidade vs. Pilar A (Simplicidade) (MÉDIA)

Melo foi explícito: *"bem simples, sem muita fórmula"*. O formulário de lançamento tem **7 campos** (Descrição, Classificação, Valor, Data, Titular, Forma de Pagamento, Vínculo a Empreiteiro). Para a esposa, isso é mais complexo que o Excel atual. **Recomendação:** manter visíveis apenas 4 campos obrigatórios (Descrição, Classificação, Valor, Data) e mover os demais para "Detalhes adicionais (opcional)", com valores default. A aderência funcional ao Pilar A fica **comprometida** na configuração atual.

### 🟡 DIV-11 — Obra 1 sem teto orçamentário (MÉDIA)

O Pilar D exige "previsão de custo máximo". Para a Obra 1 **não há previsão registrada** — logo o KPI 4 (Limite Orçamentário) fica vazio e a barra percentual não opera. O sistema deve **alertar** o gestor quando uma obra estiver sem teto cadastrado, sob pena de o Pilar D nunca ser exercido na prática.

### 🟡 DIV-12 — Parameters fiscais fixos em 7,5% (BAIXA-MÉDIA)

A alíquota está hardcoded em 7,5%. Diferentes notas/municípios podem ter retenções distintas (ISS 2–5%, IRRF 1,5%, PIS/COFINS/CSLL 4,65%). Recomenda-se **parametrizar a alíquota por obra/medição** para não distorcer obras futuras.

---

## 4. PARECER CONCLUSIVO E RECOMENDAÇÕES

### 4.1 Parecer

**APROVADO COM RESSALVAS.**

- A **aritmética da Obra 1** está correta e a **correção do erro de equipamentos (R$ 1.123,00)** é exata.
- A **matemática da Obra 2** (receita líquida) está correta, mas a **atribuição de causa do erro de R$ 790,00 é não demonstrada** — ponto de auditoria **reprovado em forense**.
- A **lógica de viabilidade** é **conceitualmente falha para obras em andamento** e precisa ser corrigida antes de ser usada como ferramenta de decisão.
- A **taxonomia de categorias** exige definição formal para evitar omissão/dupla contagem no KPI 2.
- A **arquitetura LocalStorage** é incompatível com o cenário multiusuário declarado; o "Backup em Nuvem" precisa ser comprovado.
- A **complexidade do formulário** tensiona o Pilar A (simplicidade).

### 4.2 Recomendações priorizadas

| Prioridade | Ação |
|---|---|
| **P1 — Bloqueante** | Corrigir a lógica de viabilidade: introduzir status "Em Andamento/Concluída" e calcular viabilidade sobre **previsão de custo**, não sobre realizado parcial. |
| **P1 — Bloqueante** | Demonstrar a causa-raiz do R$ 790,00 (Obra 2) e do SUMIF de EQUIP (Obra 1) com célula/fórmula/print. Sem isso, a "Aba 5 — Auditoria Técnica" do sistema é **afirmação sem prova**. |
| **P1 — Bloqueante** | Definir hierarquia formal de categorias (Alimentação e Transporte dentro ou fora de OUTROS) e garantir que o KPI 2 capture 100% dos desembolsos. |
| **P2 — Alta** | Consolidar o custo previsto total incluindo empreitas (evitar previsão subdimensionada da Obra 2) e impedir dupla contagem empreita × MO. |
| **P2 — Alta** | Substituir/augmentar LocalStorage por persistência em nuvem (Supabase/Firebase) com autenticação simples, ou comprovar que o "Backup em Nuvem" é real. |
| **P2 — Alta** | Simplificar o formulário de lançamento (4 campos visíveis + detalhes opcionais) para aderir ao Pilar A. |
| **P2 — Alta** | Adicionar trilha de auditoria (quem/quando editou) e detecção de duplicidade. |
| **P3 — Média** | Reclassificar ESPACADORES (material) e parametrizar a alíquota de NF por obra/medição. |
| **P3 — Média** | Renomear "Margem de Lucro" para "Margem Bruta da Obra" e explicitar base bruta/líquida no painel. |
| **P3 — Média** | Verificar datas 2026 na base original. |
| **P3 — Média** | Alerta automático para obras sem teto orçamentário (caso Obra 1). |
| **P4 — Baixa** | Arredondamento monetário, formatação BRL/pt-BR, moeda e locale padronizados. |

### 4.3 Síntese executiva

O sistema **acerta o que mais importa** (números da Obra 1, dedução de NF, soma de equipamentos) e **agrega valor real** com empreitas, titulares, exportação e relatório. Contudo, a **auditoria do Excel apresentada é parcial** (diagnostica sintomas, não causas), a **lógica de viabilidade induz a erro de decisão em obras em andamento**, e a **plataforma (LocalStorage) não sustenta o modelo de uso multiusuário** declarado pelo próprio gestor. **Nenhuma dessas falhas é irreparável** — são ajustes de engenharia de software e de contabilidade gerencial, não de arquitetura fundamental.

**Recomendação final:** Liberar o sistema para **uso controlado em paralelo** ao Excel por 30 dias, com as correções P1 implementadas antes da **substituição definitiva** da planilha. A "Aba 5 — Auditoria Técnica" só deve declarar as correções como "validadas" após a apresentação da **evidência forense** (fórmula original, print da célula, célula de destino). Do contrário, a aba de auditoria do sistema vira **autodeclaração sem verificação** — exatamente o oposto do que se espera de um módulo de auditoria.
