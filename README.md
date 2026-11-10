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
5. **Sincronização em nuvem (Vercel Blob)**:
   - API com mesclagem por ID e gravação condicional. Em caso de conflito de gravação, relê e mescla novamente.
   - Ao editar o mesmo registro em dois aparelhos, prevalece a edição com a data e hora mais recente.
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

## Atualização de uma instalação em uso

1. Confirme que os aparelhos da equipe mostram a nuvem sincronizada. Exporte o backup JSON pela interface e guarde uma cópia da base atual em local restrito.
2. Configure `EMTEC_PIN` na Vercel. O acesso padrão foi removido. Se o PIN mudar, os aparelhos pedirão o novo PIN e manterão a cópia local.
3. Para usar Blob privado, mantenha `BLOB_READ_WRITE_TOKEN` apontando para o armazenamento atual e configure `EMTEC_BLOB_PRIVADO_TOKEN` com o token de um armazenamento privado novo. A primeira sincronização copia e mescla a base pública quando a privada ainda está vazia. Faça a troca em um período sem lançamentos e evite usar versões antigas do site durante a conferência.
4. Compare quantidade de obras, despesas, medições, baixas e totais entre o backup e o ambiente atualizado. Depois valide um lançamento novo em dois aparelhos. Retire o acesso à base pública antiga após conferir a migração e a retenção do backup.
5. A base inicial deixa de acompanhar os arquivos estáticos. Uma instalação nova usa os dados da nuvem ou começa vazia. Em instalações existentes, o app mantém o mesmo armazenamento local e envia os lançamentos ainda pendentes para mesclagem.

Sem `EMTEC_BLOB_PRIVADO_TOKEN`, a API continua usando o armazenamento público já configurado. A versão antiga e o histórico do Git podem conservar a planilha de dados que era distribuída pelo site.
