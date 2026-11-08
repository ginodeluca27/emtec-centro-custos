const STORAGE_KEY = "EMTEC_SISTEMA_CUSTOS_V1";
let estado = carregarEstado();
let obraAtualId = estado.obras[0]?.id || "";
let chartInstance = null;

function carregarEstado() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      if (parsed && Array.isArray(parsed.obras) && parsed.obras.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Erro ao carregar localStorage:", e);
  }
  return JSON.parse(JSON.stringify(window.INITIAL_EMTEC_DATA));
}

function salvarEstado() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  const badge = document.getElementById("cloudBadge");
  if (badge) {
    badge.textContent = "✓ Salvo agora";
    setTimeout(() => { badge.textContent = "Salvo Automaticamente"; }, 2000);
  }
}

function getObraAtual() {
  return estado.obras.find(o => o.id === obraAtualId) || estado.obras[0];
}

function formatBRL(val) {
  return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataBR(iso) {
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

function detectarSubtipo(desc, tipoEscolhido) {
  if (tipoEscolhido === "ENTRADA_CAIXA") return "CAIXA";
  if (tipoEscolhido === "ALIM" || tipoEscolhido === "TRANSP") return tipoEscolhido;
  const d = (desc || "").toUpperCase();
  if (["ALMOÇO", "ALMOCO", "JANTA", "REFEIÇ", "REFEIC", "CAFÉ", "CAFE", "PÃO", "MISTURA", "GELO", "VALE ALIMENTA"].some(k => d.includes(k))) {
    return "ALIM";
  }
  if (["GASOLINA", "COMBUSTIVEL", "ABASTECIMENTO", "UBER", "PASSAGEM", "PASSAGENS", "OLEO MOTO", "ÓLEO MOTO", "FRETE"].some(k => d.includes(k))) {
    return "TRANSP";
  }
  return tipoEscolhido;
}

function normalizarTipoOficial(tipoEscolhido) {
  if (tipoEscolhido === "ALIM" || tipoEscolhido === "TRANSP") return "OUTROS";
  return tipoEscolhido;
}

function calcularMetricasObra(obra) {
  const saidas = obra.lancamentos.filter(l => l.movimento !== "ENTRADA_CAIXA");
  const entradasCaixa = obra.lancamentos.filter(l => l.movimento === "ENTRADA_CAIXA");

  const porTipoOficial = { MAT: 0, MO: 0, EQUIP: 0, OUTROS: 0 };
  const porSubtipoReal = { MAT: 0, MO: 0, EQUIP: 0, ALIM: 0, TRANSP: 0, OUTROS: 0 };
  const porTitular = {};

  let custoTotal = 0;
  for (const item of saidas) {
    const v = Number(item.valor || 0);
    custoTotal += v;
    const tOf = porTipoOficial[item.tipo] !== undefined ? item.tipo : "OUTROS";
    porTipoOficial[tOf] += v;

    const sub = item.subtipo || detectarSubtipo(item.descricao, item.tipo);
    if (porSubtipoReal[sub] !== undefined) {
      porSubtipoReal[sub] += v;
    } else {
      porSubtipoReal.OUTROS += v;
    }

    const tit = item.titular || "OUTRO";
    porTitular[tit] = (porTitular[tit] || 0) + v;
  }

  const totalEntradasCaixa = entradasCaixa.reduce((acc, i) => acc + Number(i.valor || 0), 0);

  let medBrutaRecebida = 0;
  let medLiquidaRecebida = 0;
  let medLiquidaTotalContrato = 0;

  for (const m of (obra.medicoes || [])) {
    const bruto = Number(m.valorBruto || 0);
    const desc = Number(m.descontoNotaPerc ?? obra.aliquotaImposto ?? 7.5);
    const liq = m.valorLiquido ? Number(m.valorLiquido) : bruto * (1 - desc / 100);
    medLiquidaTotalContrato += liq;
    if (m.status === "Recebida") {
      medBrutaRecebida += bruto;
      medLiquidaRecebida += liq;
    }
  }

  const orc = obra.orcamentoPrevisto || {};
  const tetoTotal = Object.values(orc).reduce((a, b) => a + Number(b || 0), 0);

  const saldoAtual = medLiquidaRecebida - custoTotal;
  const saldoProjetadoContrato = medLiquidaTotalContrato - custoTotal;

  return {
    qtdSaidas: saidas.length,
    custoTotal,
    porTipoOficial,
    porSubtipoReal,
    porTitular,
    totalEntradasCaixa,
    medBrutaRecebida,
    medLiquidaRecebida,
    medLiquidaTotalContrato,
    tetoTotal,
    saldoAtual,
    saldoProjetadoContrato
  };
}

function inicializarApp() {
  const hoje = new Date().toISOString().split("T")[0];
  const inputData = document.getElementById("lancData");
  if (inputData) inputData.value = hoje;

  renderizarSeletorObras();
  atualizarTudo();
}

function renderizarSeletorObras() {
  const sel = document.getElementById("obraSelect");
  sel.innerHTML = estado.obras.map(o =>
    `<option value="${o.id}" ${o.id === obraAtualId ? "selected" : ""}>🏗️ ${o.nome}</option>`
  ).join("");
}

function trocarObra(id) {
  obraAtualId = id;
  limparFormLancamento();
  atualizarTudo();
}

function atualizarTudo() {
  const obra = getObraAtual();
  if (!obra) return;
  const m = calcularMetricasObra(obra);

  // Header da Obra
  document.getElementById("obraTitulo").textContent = obra.nome;
  document.getElementById("obraClienteTag").textContent = `${obra.cliente || "Contrato"} • Início: ${formatDataBR(obra.dataInicio)}`;
  document.getElementById("kpiDescNotaTag").textContent = `-${obra.aliquotaImposto || 7.5}% NF`;

  // KPI 1: Medições
  document.getElementById("kpiMedicaoLiquida").textContent = formatBRL(m.medLiquidaRecebida);
  document.getElementById("kpiMedicaoSub").textContent =
    m.medLiquidaTotalContrato > m.medLiquidaRecebida
      ? `Bruto: ${formatBRL(m.medBrutaRecebida)} | Previsto Total Líq: ${formatBRL(m.medLiquidaTotalContrato)}`
      : `Valor Bruto Atestado: ${formatBRL(m.medBrutaRecebida)}`;

  // KPI 2: Custo Total
  document.getElementById("kpiCustoTotal").textContent = formatBRL(m.custoTotal);
  document.getElementById("kpiQtdLancamentos").textContent = `${m.qtdSaidas} lançamentos`;
  document.getElementById("kpiCustoSub").textContent =
    `MAT: ${formatBRL(m.porTipoOficial.MAT)} | MO: ${formatBRL(m.porTipoOficial.MO)}`;

  // KPI 3: Saldo / Viabilidade
  const badgeViab = document.getElementById("viabilidadeBadge");
  const cardSaldoBox = document.getElementById("cardSaldoBox");
  const kpiSaldoFinal = document.getElementById("kpiSaldoFinal");
  const kpiMargemPerc = document.getElementById("kpiMargemPerc");

  const baseReceita = m.medLiquidaRecebida > 0 ? m.medLiquidaRecebida : m.medLiquidaTotalContrato;
  const margem = baseReceita > 0 ? (m.saldoAtual / baseReceita) * 100 : 0;

  kpiSaldoFinal.textContent = formatBRL(m.saldoAtual);
  kpiMargemPerc.textContent = `${margem.toFixed(1)}% margem`;

  if (m.saldoAtual >= 0) {
    badgeViab.className = "text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 text-emerald-800";
    badgeViab.textContent = "✅ OBRA VIÁVEL • SALDO POSITIVO";
    cardSaldoBox.className = "rounded-xl p-4 bg-emerald-50/70 border border-emerald-200";
    kpiSaldoFinal.className = "text-2xl font-extrabold text-emerald-700 mt-1.5";
  } else {
    badgeViab.className = "text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-100 text-rose-800";
    badgeViab.textContent = "🚨 ATENÇÃO • CUSTO ACIMA DO RECEBIDO";
    cardSaldoBox.className = "rounded-xl p-4 bg-rose-50/70 border border-rose-200";
    kpiSaldoFinal.className = "text-2xl font-extrabold text-rose-700 mt-1.5";
  }

  // KPI 4: Teto de Custo
  const percTeto = m.tetoTotal > 0 ? (m.custoTotal / m.tetoTotal) * 100 : 0;
  document.getElementById("kpiTetoValor").textContent = formatBRL(m.tetoTotal);
  const badgeTeto = document.getElementById("kpiTetoPercBadge");
  const barTeto = document.getElementById("kpiTetoBar");
  badgeTeto.textContent = `${percTeto.toFixed(1)}% usado`;
  barTeto.style.width = `${Math.min(percTeto, 100)}%`;

  if (percTeto < 80) {
    badgeTeto.className = "text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800";
    barTeto.className = "bg-emerald-500 h-2 rounded-full transition-all duration-300";
  } else if (percTeto <= 100) {
    badgeTeto.className = "text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800";
    barTeto.className = "bg-amber-500 h-2 rounded-full transition-all duration-300";
  } else {
    badgeTeto.className = "text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800";
    barTeto.className = "bg-rose-600 h-2 rounded-full transition-all duration-300";
  }

  const restanteTeto = m.tetoTotal - m.custoTotal;
  document.getElementById("kpiTetoSub").textContent =
    restanteTeto >= 0
      ? `Fôlego restante no orçamento: ${formatBRL(restanteTeto)}`
      : `⚠️ Teto ultrapassado em ${formatBRL(Math.abs(restanteTeto))}`;

  // Banner de Auditoria específico das duas obras da planilha
  const bannerAud = document.getElementById("alertaAuditoriaBanner");
  if (obra.id === "obra-piscina") {
    bannerAud.classList.remove("hidden");
    document.getElementById("alertaAuditoriaTitulo").textContent = "Auditoria da Planilha Reforma Piscina:";
    document.getElementById("alertaAuditoriaTexto").textContent =
      "No seu Excel, a linha EQUIPAMENTO estava com R$ 0,00 e ignorava 5 compras (R$ 1.123,00). O custo real é R$ 68.704,19 (e não R$ 67.581,19) e o lucro líquido real é R$ 20.835,81.";
  } else if (obra.id === "obra-caixa-forro") {
    bannerAud.classList.remove("hidden");
    document.getElementById("alertaAuditoriaTitulo").textContent = "Auditoria da Planilha Caixa Obra:";
    document.getElementById("alertaAuditoriaTexto").textContent =
      "No seu Excel, o quadro RESUMO marcava apenas R$ 790,00 de custo, mas a soma real das saídas lançadas já é R$ 3.270,26.";
  } else {
    bannerAud.classList.add("hidden");
  }

  // Atualizar select de empreitas no form
  const selEmp = document.getElementById("lancEmpreitaId");
  selEmp.innerHTML = `<option value="">— Não vinculado a contrato de empreita —</option>` +
    (obra.empreitas || []).map(e => {
      const falta = Math.max(0, Number(e.valorContratado) - Number(e.valorPago));
      return `<option value="${e.id}">👷 ${e.fornecedor} (Falta pagar: ${formatBRL(falta)})</option>`;
    }).join("");

  renderizarMiniCards(m);
  renderizarTabelaLancamentos();
  renderizarAbaResumo(obra, m);
  renderizarAbaMedicoes(obra, m);
  renderizarAbaEmpreitasETitulares(obra, m);
}

function renderizarMiniCards(m) {
  const cards = [
    { label: "🧱 Material (MAT)", val: m.porTipoOficial.MAT, sub: "Insumos de obra", cor: "border-blue-200 bg-blue-50/50 text-blue-900" },
    { label: "👷 Mão de Obra (MO)", val: m.porTipoOficial.MO, sub: `Pura: ${formatBRL(m.porSubtipoReal.MO)}`, cor: "border-purple-200 bg-purple-50/50 text-purple-900" },
    { label: "🛠️ Equipamento (EQUIP)", val: m.porTipoOficial.EQUIP, sub: "Contêiner / Ferram.", cor: "border-amber-200 bg-amber-50/60 text-amber-900" },
    { label: "📋 Outros (Oficial)", val: m.porTipoOficial.OUTROS, sub: "Taxas, Comissões, etc.", cor: "border-slate-200 bg-white text-slate-900" },
    { label: "🍱 Só Alimentação", val: m.porSubtipoReal.ALIM, sub: "Almoços, Jantas, Café", cor: "border-orange-200 bg-orange-50/50 text-orange-900" },
    { label: "⛽ Só Combustível/Uber", val: m.porSubtipoReal.TRANSP, sub: "Gasolina, S10, Passagens", cor: "border-cyan-200 bg-cyan-50/50 text-cyan-900" }
  ];

  document.getElementById("miniCardsCategorias").innerHTML = cards.map(c => `
    <div class="rounded-xl p-3 border ${c.cor} card-shadow">
      <div class="text-[11px] font-bold uppercase opacity-80">${c.label}</div>
      <div class="text-base sm:text-lg font-extrabold mt-0.5">${formatBRL(c.val)}</div>
      <div class="text-[10px] opacity-75 mt-0.5">${c.sub}</div>
    </div>
  `).join("");
}

function renderizarTabelaLancamentos() {
  const obra = getObraAtual();
  const busca = (document.getElementById("filtroBusca")?.value || "").toLowerCase().trim();
  const cat = document.getElementById("filtroCategoria")?.value || "TODOS";
  const tit = document.getElementById("filtroTitular")?.value || "TODOS";
  const mes = document.getElementById("filtroMes")?.value || "TODOS";

  const filtrados = obra.lancamentos.filter(item => {
    if (busca && !item.descricao.toLowerCase().includes(busca) && !(item.pagamento || "").toLowerCase().includes(busca)) {
      return false;
    }
    if (cat !== "TODOS") {
      if (cat === "ENTRADA_CAIXA") {
        if (item.movimento !== "ENTRADA_CAIXA") return false;
      } else if (cat === "SUB_ALIM") {
        if (item.subtipo !== "ALIM") return false;
      } else if (cat === "SUB_TRANSP") {
        if (item.subtipo !== "TRANSP") return false;
      } else {
        if (item.movimento === "ENTRADA_CAIXA" || item.tipo !== cat) return false;
      }
    }
    if (tit !== "TODOS" && item.titular !== tit) return false;
    if (mes !== "TODOS" && !(item.data || "").startsWith(mes)) return false;
    return true;
  });

  // Ordenar mais recentes primeiro (ou manter ordem da planilha)
  const totalFiltrado = filtrados.reduce((acc, i) => {
    return acc + (i.movimento === "ENTRADA_CAIXA" ? 0 : Number(i.valor || 0));
  }, 0);
  document.getElementById("totalFiltradoValor").textContent = `${formatBRL(totalFiltrado)} (${filtrados.length} itens)`;

  const badgeTipo = {
    MAT: `<span class="px-2 py-0.5 rounded font-bold text-[11px] bg-blue-100 text-blue-800">MAT</span>`,
    MO: `<span class="px-2 py-0.5 rounded font-bold text-[11px] bg-purple-100 text-purple-800">MO</span>`,
    EQUIP: `<span class="px-2 py-0.5 rounded font-bold text-[11px] bg-amber-100 text-amber-900">EQUIP</span>`,
    OUTROS: `<span class="px-2 py-0.5 rounded font-bold text-[11px] bg-slate-200 text-slate-800">OUTROS</span>`
  };

  const badgeSub = {
    MAT: `<span class="text-xs text-blue-700 font-medium">🧱 Material</span>`,
    MO: `<span class="text-xs text-purple-700 font-medium">👷 Mão de Obra</span>`,
    EQUIP: `<span class="text-xs text-amber-800 font-medium">🛠️ Equipamento</span>`,
    ALIM: `<span class="text-xs text-orange-700 font-semibold">🍱 Alimentação</span>`,
    TRANSP: `<span class="text-xs text-cyan-700 font-semibold">⛽ Transporte/Comb.</span>`,
    OUTROS: `<span class="text-xs text-slate-600">📋 Outros/Taxas</span>`,
    CAIXA: `<span class="text-xs text-emerald-700 font-bold">💵 Entrada Caixa (+)</span>`
  };

  const tbody = document.getElementById("tbodyLancamentos");
  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">Nenhum lançamento encontrado para este filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(item => {
    const isEntrada = item.movimento === "ENTRADA_CAIXA";
    const dataCorrigidaTag = item.dataOriginal && item.dataOriginal !== item.data
      ? `<span class="block text-[10px] text-amber-700 font-semibold" title="Na planilha estava ${item.dataOriginal}">⚡ Corrigido (${item.dataOriginal})</span>`
      : "";

    return `
      <tr class="hover:bg-slate-50 transition ${isEntrada ? "bg-emerald-50/40" : ""}">
        <td class="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
          ${formatDataBR(item.data)}
          ${dataCorrigidaTag}
        </td>
        <td class="py-2.5 px-3 font-semibold text-slate-900">${item.descricao}</td>
        <td class="py-2.5 px-3">${isEntrada ? `<span class="px-2 py-0.5 rounded font-bold text-[11px] bg-emerald-100 text-emerald-800">ENTRADA</span>` : (badgeTipo[item.tipo] || item.tipo)}</td>
        <td class="py-2.5 px-3">${badgeSub[item.subtipo] || item.subtipo}</td>
        <td class="py-2.5 px-3 text-slate-600 text-xs">${item.pagamento || "-"}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800">${item.titular || "-"}</span>
        </td>
        <td class="py-2.5 px-3 text-right font-extrabold whitespace-nowrap ${isEntrada ? "text-emerald-700" : "text-slate-900"}">
          ${isEntrada ? "+ " : ""}${formatBRL(item.valor)}
        </td>
        <td class="py-2.5 px-3 text-center whitespace-nowrap no-print">
          <button onclick="editarLancamento('${item.id}')" class="text-xs text-blue-600 hover:underline font-semibold mr-2">Editar</button>
          <button onclick="excluirLancamento('${item.id}')" class="text-xs text-rose-600 hover:underline font-semibold">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");
}

function salvarLancamento(e) {
  e.preventDefault();
  const obra = getObraAtual();
  const id = document.getElementById("lancId").value;
  const descricao = document.getElementById("lancDescricao").value.trim().toUpperCase();
  const tipoEscolhido = document.getElementById("lancTipo").value;
  const valor = parseFloat(document.getElementById("lancValor").value);
  const data = document.getElementById("lancData").value;
  const titular = document.getElementById("lancTitular").value;
  const pagamento = document.getElementById("lancPagamento").value;
  const empreitaId = document.getElementById("lancEmpreitaId").value;

  const movimento = tipoEscolhido === "ENTRADA_CAIXA" ? "ENTRADA_CAIXA" : "SAIDA";
  const tipoOficial = tipoEscolhido === "ENTRADA_CAIXA" ? "MO" : normalizarTipoOficial(tipoEscolhido);
  const subtipo = detectarSubtipo(descricao, tipoEscolhido);

  if (id) {
    const idx = obra.lancamentos.findIndex(l => l.id === id);
    if (idx >= 0) {
      obra.lancamentos[idx] = {
        ...obra.lancamentos[idx],
        descricao,
        tipo: tipoOficial,
        subtipo,
        valor,
        data,
        pagamento,
        titular,
        movimento
      };
    }
  } else {
    obra.lancamentos.unshift({
      id: "lanc-" + Date.now(),
      descricao,
      tipo: tipoOficial,
      subtipo,
      valor,
      data,
      dataOriginal: data,
      pagamento,
      titular,
      movimento
    });

    if (empreitaId) {
      const emp = (obra.empreitas || []).find(em => em.id === empreitaId);
      if (emp) {
        emp.valorPago = Number(emp.valorPago || 0) + valor;
      }
    }
  }

  salvarEstado();
  limparFormLancamento();
  atualizarTudo();
}

function editarLancamento(id) {
  const obra = getObraAtual();
  const item = obra.lancamentos.find(l => l.id === id);
  if (!item) return;

  document.getElementById("lancId").value = item.id;
  document.getElementById("lancDescricao").value = item.descricao;
  document.getElementById("lancTipo").value = item.movimento === "ENTRADA_CAIXA" ? "ENTRADA_CAIXA" : (item.subtipo || item.tipo);
  document.getElementById("lancValor").value = item.valor;
  document.getElementById("lancData").value = item.data;
  document.getElementById("lancTitular").value = item.titular;
  document.getElementById("lancPagamento").value = item.pagamento;

  document.getElementById("formLancTitulo").textContent = "✏️ Editando Lançamento: " + item.descricao;
  document.getElementById("btnSalvarLancTexto").textContent = "💾 Atualizar Lançamento";
  document.getElementById("btnCancelarEdicao").classList.remove("hidden");
  document.getElementById("boxFormLancamento").scrollIntoView({ behavior: "smooth" });
}

function limparFormLancamento() {
  document.getElementById("lancId").value = "";
  document.getElementById("lancDescricao").value = "";
  document.getElementById("lancValor").value = "";
  document.getElementById("lancEmpreitaId").value = "";
  document.getElementById("formLancTitulo").textContent = "Novo Lançamento de Custo na Obra";
  document.getElementById("btnSalvarLancTexto").textContent = "✅ Salvar Lançamento na Obra";
  document.getElementById("btnCancelarEdicao").classList.add("hidden");
}

function excluirLancamento(id) {
  if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
  const obra = getObraAtual();
  obra.lancamentos = obra.lancamentos.filter(l => l.id !== id);
  salvarEstado();
  atualizarTudo();
}

function renderizarAbaResumo(obra, m) {
  const cats = [
    { key: "MAT", nome: "🧱 Material de Construção (MAT)", gasto: m.porSubtipoReal.MAT },
    { key: "MO", nome: "👷 Mão de Obra Direta / Empreitas (MO)", gasto: m.porSubtipoReal.MO },
    { key: "EQUIP", nome: "🛠️ Equipamentos & Locação (EQUIP)", gasto: m.porSubtipoReal.EQUIP },
    { key: "ALIM", nome: "🍱 Alimentação (Almoços / Jantas / Café)", gasto: m.porSubtipoReal.ALIM },
    { key: "TRANSP", nome: "⛽ Combustível / Uber / Passagens", gasto: m.porSubtipoReal.TRANSP },
    { key: "OUTROS", nome: "📋 Outros (Comissões / ART / Taxas)", gasto: m.porSubtipoReal.OUTROS }
  ];

  const orc = obra.orcamentoPrevisto || {};
  const container = document.getElementById("listaBarrasOrcamento");

  container.innerHTML = cats.map(c => {
    const teto = Number(orc[c.key] || 0);
    const perc = teto > 0 ? (c.gasto / teto) * 100 : 0;
    const corBarra = perc < 80 ? "bg-emerald-500" : perc <= 100 ? "bg-amber-500" : "bg-rose-600";
    const saldoCat = teto - c.gasto;

    return `
      <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs sm:text-sm font-bold text-slate-900">${c.nome}</span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">Teto Previsto R$:</span>
            <input type="number" step="100" data-orc-key="${c.key}" value="${teto}"
              class="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-right bg-white" />
          </div>
        </div>
        <div class="flex items-center justify-between text-xs mt-2">
          <span>Gasto Real: <strong class="text-slate-900">${formatBRL(c.gasto)}</strong> (${perc.toFixed(1)}%)</span>
          <span class="${saldoCat >= 0 ? "text-emerald-700" : "text-rose-600 font-bold"}">
            ${saldoCat >= 0 ? `Disponível: ${formatBRL(saldoCat)}` : `Estourado em: ${formatBRL(Math.abs(saldoCat))}`}
          </span>
        </div>
        <div class="w-full bg-slate-200 h-2.5 rounded-full mt-1.5 overflow-hidden">
          <div class="${corBarra} h-2.5 rounded-full" style="width: ${Math.min(perc, 100)}%"></div>
        </div>
      </div>
    `;
  }).join("");

  // Resumo comparativo lateral
  document.getElementById("resumoComparativoBox").innerHTML = `
    <div class="flex justify-between"><span>Total Mão de Obra (Oficial Planilha):</span><strong>${formatBRL(m.porTipoOficial.MO)}</strong></div>
    <div class="flex justify-between"><span>Total Material (Oficial Planilha):</span><strong>${formatBRL(m.porTipoOficial.MAT)}</strong></div>
    <div class="flex justify-between"><span>Total Equipamento (Corrigido):</span><strong class="text-amber-700">${formatBRL(m.porTipoOficial.EQUIP)}</strong></div>
    <div class="flex justify-between"><span>Total Outros (Oficial Planilha):</span><strong>${formatBRL(m.porTipoOficial.OUTROS)}</strong></div>
    <div class="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-slate-900">
      <span>CUSTO TOTAL AUDITADO:</span><span>${formatBRL(m.custoTotal)}</span>
    </div>
  `;

  // Gráfico Chart.js
  const ctx = document.getElementById("chartCategorias");
  if (ctx) {
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Material", "Mão de Obra Pura", "Equipamento", "Alimentação", "Combustível/Transp.", "Outros/Comissões"],
        datasets: [{
          data: [
            m.porSubtipoReal.MAT,
            m.porSubtipoReal.MO,
            m.porSubtipoReal.EQUIP,
            m.porSubtipoReal.ALIM,
            m.porSubtipoReal.TRANSP,
            m.porSubtipoReal.OUTROS
          ],
          backgroundColor: ["#2563eb", "#7c3aed", "#d97706", "#ea580c", "#0891b2", "#475569"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }
}

function salvarTetosOrcamento() {
  const obra = getObraAtual();
  if (!obra.orcamentoPrevisto) obra.orcamentoPrevisto = {};
  document.querySelectorAll("[data-orc-key]").forEach(inp => {
    const k = inp.getAttribute("data-orc-key");
    obra.orcamentoPrevisto[k] = parseFloat(inp.value || 0);
  });
  salvarEstado();
  atualizarTudo();
  alert("Previsão de teto de custos atualizada com sucesso!");
}

function renderizarAbaMedicoes(obra, m) {
  const tbody = document.getElementById("tbodyMedicoes");
  const lista = obra.medicoes || [];

  tbody.innerHTML = lista.map(med => {
    const bruto = Number(med.valorBruto || 0);
    const desc = Number(med.descontoNotaPerc ?? 7.5);
    const liq = med.valorLiquido ? Number(med.valorLiquido) : bruto * (1 - desc / 100);
    const isRec = med.status === "Recebida";

    return `
      <tr class="hover:bg-slate-50">
        <td class="py-3 px-3 font-bold text-slate-900">
          ${med.titulo}
          <span class="block text-xs text-slate-400 font-normal">${med.observacao || ""}</span>
        </td>
        <td class="py-3 px-3">
          <button onclick="alternarStatusMedicao('${med.id}')" class="px-2.5 py-1 rounded-full text-xs font-bold ${isRec ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}">
            ${isRec ? "✅ Atestada / Recebida" : "⏳ Prevista (Clique p/ Atestar)"}
          </button>
        </td>
        <td class="py-3 px-3 text-right font-semibold">${formatBRL(bruto)}</td>
        <td class="py-3 px-3 text-right text-slate-500">-${desc}%</td>
        <td class="py-3 px-3 text-right font-extrabold text-emerald-700">${formatBRL(liq)}</td>
        <td class="py-3 px-3 text-center no-print">
          <button onclick="excluirMedicao('${med.id}')" class="text-xs text-rose-600 font-semibold hover:underline">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");
}

function salvarMedicao(e) {
  e.preventDefault();
  const obra = getObraAtual();
  const titulo = document.getElementById("medTitulo").value.trim();
  const valorBruto = parseFloat(document.getElementById("medValorBruto").value);
  const descontoNotaPerc = parseFloat(document.getElementById("medDescPerc").value || 7.5);
  const status = document.getElementById("medStatus").value;
  const valorLiquido = Math.round(valorBruto * (1 - descontoNotaPerc / 100) * 100) / 100;

  if (!obra.medicoes) obra.medicoes = [];
  obra.medicoes.push({
    id: "med-" + Date.now(),
    titulo,
    data: new Date().toISOString().split("T")[0],
    valorBruto,
    descontoNotaPerc,
    valorLiquido,
    status,
    observacao: "Lançada no sistema"
  });

  document.getElementById("medTitulo").value = "";
  document.getElementById("medValorBruto").value = "";
  salvarEstado();
  atualizarTudo();
}

function alternarStatusMedicao(id) {
  const obra = getObraAtual();
  const med = (obra.medicoes || []).find(m => m.id === id);
  if (med) {
    med.status = med.status === "Recebida" ? "Pendente" : "Recebida";
    salvarEstado();
    atualizarTudo();
  }
}

function excluirMedicao(id) {
  if (!confirm("Excluir esta medição?")) return;
  const obra = getObraAtual();
  obra.medicoes = (obra.medicoes || []).filter(m => m.id !== id);
  salvarEstado();
  atualizarTudo();
}

function renderizarAbaEmpreitasETitulares(obra, m) {
  const divEmp = document.getElementById("listaEmpreitas");
  const emps = obra.empreitas || [];

  divEmp.innerHTML = emps.map(e => {
    const contratado = Number(e.valorContratado || 0);
    const pago = Number(e.valorPago || 0);
    const falta = Math.max(0, contratado - pago);
    const perc = contratado > 0 ? Math.min(100, (pago / contratado) * 100) : 0;

    return `
      <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${e.fornecedor}</h4>
            <p class="text-xs text-slate-500">${e.servico || ""} ${e.observacao ? "• " + e.observacao : ""}</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-extrabold ${falta === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}">
            ${falta === 0 ? "✅ QUITADO" : `FALTA PAGAR: ${formatBRL(falta)}`}
          </span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs mt-3 pt-2 border-t border-slate-200/80">
          <div>Combinado: <strong class="text-slate-900">${formatBRL(contratado)}</strong></div>
          <div>Já Pago: <strong class="text-emerald-700">${formatBRL(pago)}</strong></div>
          <div class="text-right">Progresso: <strong>${perc.toFixed(0)}%</strong></div>
        </div>
      </div>
    `;
  }).join("");

  // Titulares
  const divTit = document.getElementById("listaTitulares");
  const titularesEntries = Object.entries(m.porTitular).sort((a, b) => b[1] - a[1]);

  let htmlTit = titularesEntries.map(([tit, val]) => {
    const perc = m.custoTotal > 0 ? (val / m.custoTotal) * 100 : 0;
    return `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <span class="text-xs font-extrabold px-2 py-0.5 rounded bg-slate-900 text-white">${tit}</span>
          <p class="text-xs text-slate-500 mt-1">${perc.toFixed(1)}% dos pagamentos da obra</p>
        </div>
        <div class="text-right">
          <p class="text-base font-extrabold text-slate-900">${formatBRL(val)}</p>
        </div>
      </div>
    `;
  }).join("");

  if (obra.enviosCaixa && obra.enviosCaixa.length > 0) {
    const totalEnvios = obra.enviosCaixa.reduce((a, b) => a + Number(b.valor || 0), 0);
    htmlTit += `
      <div class="p-4 rounded-xl bg-blue-50 border border-blue-200 mt-3 text-xs space-y-1">
        <div class="font-extrabold text-blue-950 uppercase">💵 Controle de Caixa Enviado (Adiantamentos)</div>
        <div class="flex justify-between"><span>Total Enviado / Entradas Caixa:</span><strong>${formatBRL(totalEnvios)}</strong></div>
        <div class="flex justify-between"><span>Total Saídas Lançadas na Obra:</span><strong>${formatBRL(m.custoTotal)}</strong></div>
        <div class="flex justify-between pt-1 border-t border-blue-200 font-bold text-blue-950">
          <span>Diferença (Caixa - Saídas):</span><span>${formatBRL(totalEnvios - m.custoTotal)}</span>
        </div>
      </div>
    `;
  }

  divTit.innerHTML = htmlTit;
}

function salvarEmpreita(e) {
  e.preventDefault();
  const obra = getObraAtual();
  const fornecedor = document.getElementById("empFornecedor").value.trim();
  const valorContratado = parseFloat(document.getElementById("empContratado").value || 0);
  const valorPago = parseFloat(document.getElementById("empPago").value || 0);

  if (!obra.empreitas) obra.empreitas = [];
  obra.empreitas.push({
    id: "emp-" + Date.now(),
    fornecedor,
    servico: "Contrato de Empreita",
    valorContratado,
    valorPago,
    observacao: ""
  });

  document.getElementById("empFornecedor").value = "";
  document.getElementById("empContratado").value = "";
  document.getElementById("empPago").value = "";
  salvarEstado();
  atualizarTudo();
}

function mudarAba(aba) {
  ["lancamentos", "resumo", "medicoes", "empreitas", "auditoria"].forEach(a => {
    document.getElementById(`aba-${a}`).classList.toggle("hidden", a !== aba);
    const btn = document.getElementById(`tab-btn-${a}`);
    if (btn) btn.classList.toggle("active", a === aba);
  });
  if (aba === "resumo") {
    const obra = getObraAtual();
    atualizarTudo();
  }
}

function irParaLancamento() {
  mudarAba("lancamentos");
  document.getElementById("lancDescricao").focus();
}

function abrirModalNovaObra() {
  document.getElementById("modalNovaObra").classList.remove("hidden");
  document.getElementById("modalNovaObra").classList.add("flex");
}

function fecharModalNovaObra() {
  document.getElementById("modalNovaObra").classList.add("hidden");
  document.getElementById("modalNovaObra").classList.remove("flex");
}

function criarNovaObra(e) {
  e.preventDefault();
  const nome = document.getElementById("novaObraNome").value.trim();
  const cliente = document.getElementById("novaObraCliente").value.trim() || "Contrato";
  const aliquotaImposto = parseFloat(document.getElementById("novaObraImposto").value || 7.5);
  const valorContrato = parseFloat(document.getElementById("novaObraValorContrato").value || 0);
  const tetoCusto = parseFloat(document.getElementById("novaObraTetoCusto").value || 0);

  const nova = {
    id: "obra-" + Date.now(),
    nome,
    cliente,
    status: "Em Andamento",
    dataInicio: new Date().toISOString().split("T")[0],
    aliquotaImposto,
    orcamentoPrevisto: {
      MAT: Math.round(tetoCusto * 0.5),
      MO: Math.round(tetoCusto * 0.35),
      EQUIP: Math.round(tetoCusto * 0.05),
      ALIM: Math.round(tetoCusto * 0.04),
      TRANSP: Math.round(tetoCusto * 0.03),
      OUTROS: Math.round(tetoCusto * 0.03)
    },
    medicoes: valorContrato > 0 ? [
      {
        id: "med-init-" + Date.now(),
        titulo: "1ª Medição / Contrato Fechado",
        data: new Date().toISOString().split("T")[0],
        valorBruto: valorContrato,
        descontoNotaPerc: aliquotaImposto,
        valorLiquido: Math.round(valorContrato * (1 - aliquotaImposto / 100) * 100) / 100,
        status: "Pendente",
        observacao: "Medição inicial cadastrada na abertura da obra"
      }
    ] : [],
    empreitas: [],
    enviosCaixa: [],
    lancamentos: []
  };

  estado.obras.push(nova);
  obraAtualId = nova.id;
  salvarEstado();
  renderizarSeletorObras();
  fecharModalNovaObra();
  atualizarTudo();
}

function abrirModalNuvem() {
  document.getElementById("modalNuvem").classList.remove("hidden");
  document.getElementById("modalNuvem").classList.add("flex");
}

function fecharModalNuvem() {
  document.getElementById("modalNuvem").classList.add("hidden");
  document.getElementById("modalNuvem").classList.remove("flex");
}

function exportarBackupJSON() {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup-custos-emtec-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
}

function importarBackupJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (parsed && Array.isArray(parsed.obras)) {
        estado = parsed;
        obraAtualId = estado.obras[0]?.id || "";
        salvarEstado();
        renderizarSeletorObras();
        atualizarTudo();
        fecharModalNuvem();
        alert("Backup importado com sucesso!");
      }
    } catch (err) {
      alert("Arquivo de backup inválido.");
    }
  };
  reader.readAsText(file);
}

function resetarDadosOriginais() {
  if (!confirm("Restaurar os dados originais corrigidos da planilha do Melo?")) return;
  localStorage.removeItem(STORAGE_KEY);
  estado = JSON.parse(JSON.stringify(window.INITIAL_EMTEC_DATA));
  obraAtualId = estado.obras[0].id;
  salvarEstado();
  renderizarSeletorObras();
  atualizarTudo();
  fecharModalNuvem();
}

function exportarExcelObra() {
  const obra = getObraAtual();
  const m = calcularMetricasObra(obra);

  const rowsLanc = obra.lancamentos.map(l => ({
    "DATA": formatDataBR(l.data),
    "DESCRIÇÃO": l.descricao,
    "TIPO OFICIAL": l.tipo,
    "CLASSIFICAÇÃO REAL": l.subtipo,
    "MOVIMENTO": l.movimento,
    "VALOR (R$)": Number(l.valor),
    "PAGAMENTO": l.pagamento,
    "TITULAR": l.titular
  }));

  const rowsResumo = [
    { "INDICADOR": "Obra", "VALOR": obra.nome },
    { "INDICADOR": "Total Gastos Mão de Obra (MO)", "VALOR": m.porTipoOficial.MO },
    { "INDICADOR": "Total Gastos Material (MAT)", "VALOR": m.porTipoOficial.MAT },
    { "INDICADOR": "Total Equipamento (EQUIP - Corrigido)", "VALOR": m.porTipoOficial.EQUIP },
    { "INDICADOR": "Total Outros", "VALOR": m.porTipoOficial.OUTROS },
    { "INDICADOR": "CUSTO TOTAL DA OBRA", "VALOR": m.custoTotal },
    { "INDICADOR": "Total Medições Líquidas Recebidas", "VALOR": m.medLiquidaRecebida },
    { "INDICADOR": "SALDO FINAL DE OBRA (LUCRO)", "VALOR": m.saldoAtual }
  ];

  const wb = XLSX.utils.book_new();
  const wsLanc = XLSX.utils.json_to_sheet(rowsLanc);
  const wsRes = XLSX.utils.json_to_sheet(rowsResumo);
  XLSX.utils.book_append_sheet(wb, wsLanc, "Lançamentos Auditados");
  XLSX.utils.book_append_sheet(wb, wsRes, "Resumo & Viabilidade");

  XLSX.writeFile(wb, `Centro_Custo_${obra.nome.replace(/\s+/g, "_")}_Corrigido.xlsx`);
}

window.addEventListener("DOMContentLoaded", inicializarApp);
