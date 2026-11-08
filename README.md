# EMTEC Engenharia — Centro de Custos e Viabilidade de Obras

Sistema web mobile-first para gestão de custos, controle orçamentário, medições de contrato e projeção de viabilidade (EVM / EAC) de obras da EMTEC Engenharia.

---

## 🏗️ Funcionalidades

1. **Gestão Multiobras**: Abertura e acompanhamento de múltiplos centros de custos com tetos orçamentários independentes.
2. **Lançamento Rápido no Canteiro**: Interface mobile pensada para registro de despesas em menos de 5 segundos (valores em destaque, categorias em um toque).
3. **Auditoria Forense Integrada**:
   - Resolução das divergências da planilha original (`C. CUSTO REFORMA PISCINA.xlsx`).
   - Inclusão dos R$ 1.123,00 de equipamentos omitidos nas fórmulas originais.
   - Diagnóstico pericial da aba `IAGO`: correção do apontamento para coluna C (Entradas R$ 790,00) em vez da coluna D (Saídas R$ 3.270,26).
4. **Engenharia de Custos (EVM / EAC)**:
   - Projeção de viabilidade até o término da obra ($EAC = CustoReal + EmpreitasPendentes + CustoRestanteEstimado$).
   - Alertas preventivos de estouro de teto e margem líquida contratual.
5. **Sincronização em Nuvem Concorrente (Vercel Blob)**:
   - API Serverless (`/api/sync`) com mesclagem inteligente por ID (merge seguro sem sobrescrita de lançamentos simultâneos entre dispositivos).
   - Cache offline local no navegador com sincronização automática em segundo plano.
6. **Cards Mobile Nativos**:
   - Listagem de despesas e medições em formato de cards verticais com alto contraste WCAG.

---

## 🎨 Identidade Visual (Carmen Rios)

- **Azul-marinho**: `#23396B` (Base de autoridade e engenharia)
- **Azul Médio**: `#4395D8` (Elementos de apoio e gráficos)
- **Laranja**: `#FF8C00` (Botões de ação primária com texto escuro `#0F172A` para contraste WCAG AAA)
- **Verde**: `#16A34A` / `#DCFCE7` (Exclusivo para resultados positivos e margem)
- **Tipografia**: *Plus Jakarta Sans* (interface e números) e *Sora* (títulos executivos)

---

## 🚀 Deploy e Infraestrutura

- **Hospedagem**: Vercel (Produção automática via GitHub)
- **Storage**: Vercel Blob (`emtec-database.json`)
- **Repositório**: [ginodeluca27/emtec-centro-custos](https://github.com/ginodeluca27/emtec-centro-custos)
- **URL Oficial**: [emtec-centro-custos.vercel.app](https://emtec-centro-custos.vercel.app)
