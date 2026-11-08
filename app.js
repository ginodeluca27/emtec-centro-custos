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
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-[#34B442]"></span> Salvo agora`;
    setTimeout(() => {
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-[#34B442]"></span> Sincronizado`;
    }, 2000);
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
    `<option value="${o.id}" ${o.id === obraAtualId ? "selected" : ""}>${o.nome}</option>`
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

  document.getElementById("obraTitulo").textContent = obra.nome;
  document.getElementById("obraClienteTag").textContent = `${obra.cliente || "CONTRATO"} • INÍCIO ${formatDataBR(obra.dataInicio)}`;
  document.getElementById("kpiDescNotaTag").textContent = `-${obra.aliquotaImposto || 7.5}% NF`;

  document.getElementById("kpiMedicaoLiquida").textContent = formatBRL(m.medLiquidaRecebida);
  document.getElementById("kpiMedicaoSub").textContent =
    m.medLiquidaTotalContrato > m.medLiquidaRecebida
      ? `Bruto: ${formatBRL(m.medBrutaRecebida)} | Contrato Líq: ${formatBRL(m.medLiquidaTotalContrato)}`
      : `Faturamento Bruto Atestado: ${formatBRL(m.medBrutaRecebida)}`;

  document.getElementById("kpiCustoTotal").textContent = formatBRL(m.custoTotal);
  document.getElementById("kpiQtdLancamentos").textContent = `${m.qtdSaidas} registros`;
  document.getElementById("kpiCustoSub").textContent =
    `MAT: ${formatBRL(m.porTipoOficial.MAT)} | MO: ${formatBRL(m.porTipoOficial.MO)}`;

  const isEmAndamento = obra.status !== "Concluída";
  const badgeViab = document.getElementById("viabilidadeBadge");
  const cardSaldoBox = document.getElementById("cardSaldoBox");
  const cardSaldoLabel = document.getElementById("cardSaldoLabel");
  const kpiSaldoFinal = document.getElementById("kpiSaldoFinal");
  const kpiMargemPerc = document.getElementById("kpiMargemPerc");
  const kpiSaldoSub = document.getElementById("kpiSaldoSub");

  // Viabilidade Projetada sobre Teto Orçado vs Margem de Caixa Momentâneo (Resolve DIV-01 da Auditoria)
  const baseReceitaContrato = m.medLiquidaTotalContrato > 0 ? m.medLiquidaTotalContrato : m.medLiquidaRecebida;
  const margemProjetada = baseReceitaContrato > 0 && m.tetoTotal > 0
    ? ((baseReceitaContrato - m.tetoTotal) / baseReceitaContrato) * 100
    : 0;
  const margemRealizada = baseReceitaContrato > 0
    ? (m.saldoAtual / baseReceitaContrato) * 100
    : 0;

  kpiSaldoFinal.textContent = formatBRL(m.saldoAtual);

  if (isEmAndamento) {
    if (cardSaldoLabel) cardSaldoLabel.textContent = "Saldo de Caixa Atual";
    if (kpiMargemPerc) kpiMargemPerc.textContent = `${margemProjetada >= 0 ? "+" : ""}${margemProjetada.toFixed(1)}% projetada`;
    if (kpiSaldoSub) kpiSaldoSub.textContent = `Em caixa (Recebido - Gasto). Margem projetada no término.`;

    if (m.tetoTotal > 0 && m.custoTotal > m.tetoTotal) {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/40 cursor-pointer";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> Em Andamento • Teto Excedido`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-rose-500/15 border border-rose-400/40 backdrop-blur-xs";
    } else if (m.saldoAtual < 0) {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/40 cursor-pointer";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#FF8C00]"></span> Em Andamento • Caixa Descoberto`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-[#FF8C00]/15 border border-[#FF8C00]/40 backdrop-blur-xs";
    } else {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full bg-[#A6CE38]/20 text-[#A6CE38] border border-[#A6CE38]/40 cursor-pointer";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#A6CE38]"></span> Em Andamento • Viável (${margemProjetada.toFixed(0)}% proj.)`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-[#A6CE38]/15 border border-[#A6CE38]/45 backdrop-blur-xs";
    }
  } else {
    if (cardSaldoLabel) cardSaldoLabel.textContent = "Resultado Líquido Final";
    if (kpiMargemPerc) kpiMargemPerc.textContent = `${margemRealizada.toFixed(1)}% final`;
    if (kpiSaldoSub) kpiSaldoSub.textContent = `Obra Concluída: Faturamento Líquido menos Custo Total.`;

    if (m.saldoAtual >= 0) {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full bg-[#34B442]/25 text-[#34B442] border border-[#34B442]/50 cursor-pointer";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#34B442]"></span> Obra Concluída • Lucro Realizado`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-[#34B442]/15 border border-[#34B442]/45 backdrop-blur-xs";
    } else {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/40 cursor-pointer";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> Obra Concluída • Prejuízo`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-rose-500/15 border border-rose-400/40 backdrop-blur-xs";
    }
  }

  const percTeto = m.tetoTotal > 0 ? (m.custoTotal / m.tetoTotal) * 100 : 0;
  document.getElementById("kpiTetoValor").textContent = formatBRL(m.tetoTotal);
  const badgeTeto = document.getElementById("kpiTetoPercBadge");
  const barTeto = document.getElementById("kpiTetoBar");
  badgeTeto.textContent = `${percTeto.toFixed(1)}% utilizado`;
  barTeto.style.width = `${Math.min(percTeto, 100)}%`;

  if (percTeto < 80) {
    barTeto.className = "bg-[#A6CE38] h-1.5 rounded-full transition-all duration-300";
  } else if (percTeto <= 100) {
    barTeto.className = "bg-[#FF8C00] h-1.5 rounded-full transition-all duration-300";
  } else {
    barTeto.className = "bg-rose-400 h-1.5 rounded-full transition-all duration-300";
  }

  const restanteTeto = m.tetoTotal - m.custoTotal;
  document.getElementById("kpiTetoSub").textContent =
    restanteTeto >= 0
      ? `Saldo disponível no teto: ${formatBRL(restanteTeto)}`
      : `Excedente sobre o limite: ${formatBRL(Math.abs(restanteTeto))}`;

  const bannerAud = document.getElementById("alertaAuditoriaBanner");
  if (obra.id === "obra-piscina") {
    bannerAud.classList.remove("hidden");
    document.getElementById("alertaAuditoriaTitulo").textContent = "Conferência Reforma Piscina:";
    document.getElementById("alertaAuditoriaTexto").textContent =
      "Os 5 lançamentos de Equipamento (R$ 1.123,00) ignorados na fórmula do Excel original foram somados. Custo real: R$ 68.704,19 | Saldo líquido: R$ 20.835,81.";
  } else if (obra.id === "obra-caixa-forro") {
    bannerAud.classList.remove("hidden");
    document.getElementById("alertaAuditoriaTitulo").textContent = "Conferência Caixa Obra:";
    document.getElementById("alertaAuditoriaTexto").textContent =
      "O resumo da planilha original exibia R$ 790,00 de custo, porém o somatório real de saídas lançadas totaliza R$ 3.270,26.";
  } else {
    bannerAud.classList.add("hidden");
  }

  const selEmp = document.getElementById("lancEmpreitaId");
  selEmp.innerHTML = `<option value="">Não vinculado a contrato de empreita</option>` +
    (obra.empreitas || []).map(e => {
      const falta = Math.max(0, Number(e.valorContratado) - Number(e.valorPago));
      return `<option value="${e.id}">${e.fornecedor} (Saldo a pagar: ${formatBRL(falta)})</option>`;
    }).join("");

  renderizarMiniCards(m);
  renderizarTabelaLancamentos();
  renderizarAbaResumo(obra, m);
  renderizarAbaMedicoes(obra, m);
  renderizarAbaEmpreitasETitulares(obra, m);
}

function renderizarMiniCards(m) {
  const cards = [
    { label: "Material (MAT)", val: m.porTipoOficial.MAT, sub: "Insumos e materiais", dot: "bg-[#23396B]" },
    { label: "Mão de Obra (MO)", val: m.porTipoOficial.MO, sub: `Direta: ${formatBRL(m.porSubtipoReal.MO)}`, dot: "bg-[#4395D8]" },
    { label: "Equipamento (EQUIP)", val: m.porTipoOficial.EQUIP, sub: "Locação e ferramentas", dot: "bg-[#FF8C00]" },
    { label: "Outros (Oficial)", val: m.porTipoOficial.OUTROS, sub: "Taxas, ART e comissões", dot: "bg-[#6C757D]" },
    { label: "Alimentação", val: m.porSubtipoReal.ALIM, sub: "Refeições de equipe", dot: "bg-[#34B442]" },
    { label: "Combustível / Transp.", val: m.porSubtipoReal.TRANSP, sub: "Abastecimento e deslocamento", dot: "bg-[#002E6E]" }
  ];

  document.getElementById("miniCardsCategorias").innerHTML = cards.map(c => `
    <div class="ed-card p-4 hover:border-[#4395D8] transition">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full ${c.dot}"></span>
        <span class="text-[11px] font-bold uppercase tracking-wider text-[#6C757D]">${c.label}</span>
      </div>
      <div class="font-display text-base sm:text-lg font-extrabold text-[#23396B] mt-1.5">${formatBRL(c.val)}</div>
      <div class="text-[11px] text-[#6C757D] mt-0.5">${c.sub}</div>
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

  const totalFiltrado = filtrados.reduce((acc, i) => {
    return acc + (i.movimento === "ENTRADA_CAIXA" ? 0 : Number(i.valor || 0));
  }, 0);
  document.getElementById("totalFiltradoValor").textContent = `${formatBRL(totalFiltrado)} (${filtrados.length} itens)`;

  const badgeTipo = {
    MAT: `<span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wider bg-[#4395D8]/15 text-[#23396B] border border-[#4395D8]/30">MAT</span>`,
    MO: `<span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wider bg-[#23396B] text-white">MO</span>`,
    EQUIP: `<span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wider bg-[#FF8C00]/15 text-[#FF6B12] border border-[#FF8C00]/30">EQUIP</span>`,
    OUTROS: `<span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wider bg-[#F8F9FA] text-[#495057] border border-[#DEE2E6]">OUTROS</span>`
  };

  const badgeSub = {
    MAT: `<span class="text-xs text-[#23396B] font-medium">Material</span>`,
    MO: `<span class="text-xs text-[#4395D8] font-semibold">Mão de Obra</span>`,
    EQUIP: `<span class="text-xs text-[#FF8C00] font-semibold">Equipamento</span>`,
    ALIM: `<span class="text-xs text-[#34B442] font-semibold">Alimentação</span>`,
    TRANSP: `<span class="text-xs text-[#002E6E] font-semibold">Transporte / Comb.</span>`,
    OUTROS: `<span class="text-xs text-[#6C757D]">Outros / Taxas</span>`,
    CAIXA: `<span class="text-xs text-[#34B442] font-bold">Entrada de Caixa (+)</span>`
  };

  const tbody = document.getElementById("tbodyLancamentos");
  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-[#6C757D]">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(item => {
    const isEntrada = item.movimento === "ENTRADA_CAIXA";
    const dataCorrigidaTag = item.dataOriginal && item.dataOriginal !== item.data
      ? `<span class="block text-[10px] text-[#FF8C00] font-semibold">Corrigido (${item.dataOriginal})</span>`
      : "";

    return `
      <tr class="hover:bg-[#F8F9FA] transition ${isEntrada ? "bg-[#34B442]/5" : ""}">
        <td class="py-3 px-3.5 whitespace-nowrap font-medium text-[#343A40]">
          ${formatDataBR(item.data)}
          ${dataCorrigidaTag}
        </td>
        <td class="py-3 px-3.5 font-semibold text-[#23396B]">${item.descricao}</td>
        <td class="py-3 px-3.5">${isEntrada ? `<span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-[#34B442]/15 text-[#34B442]">ENTRADA</span>` : (badgeTipo[item.tipo] || item.tipo)}</td>
        <td class="py-3 px-3.5">${badgeSub[item.subtipo] || item.subtipo}</td>
        <td class="py-3 px-3.5 text-[#6C757D] text-xs">${item.pagamento || "-"}</td>
        <td class="py-3 px-3.5">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F8F9FA] border border-[#DEE2E6] text-[#23396B]">${item.titular || "-"}</span>
        </td>
        <td class="py-3 px-3.5 text-right font-display font-bold whitespace-nowrap ${isEntrada ? "text-[#34B442]" : "text-[#23396B]"}">
          ${isEntrada ? "+ " : ""}${formatBRL(item.valor)}
        </td>
        <td class="py-3 px-3.5 text-center whitespace-nowrap no-print">
          <button onclick="editarLancamento('${item.id}')" class="text-xs text-[#4395D8] hover:text-[#23396B] hover:underline font-semibold mr-3">Editar</button>
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
  const titular = document.getElementById("lancTitular")?.value || "EMTEC";
  const pagamento = document.getElementById("lancPagamento")?.value || "PIX";
  const empreitaId = document.getElementById("lancEmpreitaId")?.value || "";

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

  document.getElementById("formLancTitulo").textContent = "Editando Registro: " + item.descricao;
  document.getElementById("btnSalvarLancTexto").textContent = "Atualizar Registro";
  document.getElementById("btnCancelarEdicao").classList.remove("hidden");
  document.getElementById("boxFormLancamento").scrollIntoView({ behavior: "smooth" });
}

function limparFormLancamento() {
  document.getElementById("lancId").value = "";
  document.getElementById("lancDescricao").value = "";
  document.getElementById("lancValor").value = "";
  document.getElementById("lancEmpreitaId").value = "";
  document.getElementById("formLancTitulo").textContent = "Lançar Custo na Obra";
  document.getElementById("btnSalvarLancTexto").textContent = "Registrar Lançamento";
  document.getElementById("btnCancelarEdicao").classList.add("hidden");
}

function excluirLancamento(id) {
  if (!confirm("Confirma a exclusão deste lançamento?")) return;
  const obra = getObraAtual();
  obra.lancamentos = obra.lancamentos.filter(l => l.id !== id);
  salvarEstado();
  atualizarTudo();
}

function renderizarAbaResumo(obra, m) {
  const cats = [
    { key: "MAT", nome: "Material de Construção (MAT)", gasto: m.porSubtipoReal.MAT },
    { key: "MO", nome: "Mão de Obra Direta / Empreitas (MO)", gasto: m.porSubtipoReal.MO },
    { key: "EQUIP", nome: "Equipamentos & Locação (EQUIP)", gasto: m.porSubtipoReal.EQUIP },
    { key: "ALIM", nome: "Alimentação (Almoços / Jantas / Café)", gasto: m.porSubtipoReal.ALIM },
    { key: "TRANSP", nome: "Combustível / Uber / Passagens", gasto: m.porSubtipoReal.TRANSP },
    { key: "OUTROS", nome: "Outros (Comissões / ART / Taxas)", gasto: m.porSubtipoReal.OUTROS }
  ];

  const orc = obra.orcamentoPrevisto || {};
  const container = document.getElementById("listaBarrasOrcamento");

  container.innerHTML = cats.map(c => {
    const teto = Number(orc[c.key] || 0);
    const perc = teto > 0 ? (c.gasto / teto) * 100 : 0;
    const corBarra = perc < 80 ? "bg-[#23396B]" : perc <= 100 ? "bg-[#FF8C00]" : "bg-rose-600";
    const saldoCat = teto - c.gasto;

    return `
      <div class="p-4 rounded-2xl bg-[#F8F9FA] border border-[#DEE2E6]">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs sm:text-sm font-bold text-[#23396B]">${c.nome}</span>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold uppercase text-[#6C757D]">Teto R$:</span>
            <input type="number" step="100" data-orc-key="${c.key}" value="${teto}"
              class="w-28 rounded-xl border border-[#CBD5E1] px-2.5 py-1 text-xs font-bold text-right bg-white text-[#23396B]" />
          </div>
        </div>
        <div class="flex items-center justify-between text-xs mt-2">
          <span class="text-[#6C757D]">Realizado: <strong class="text-[#23396B]">${formatBRL(c.gasto)}</strong> (${perc.toFixed(1)}%)</span>
          <span class="${saldoCat >= 0 ? "text-[#34B442] font-semibold" : "text-rose-600 font-bold"}">
            ${saldoCat >= 0 ? `Disponível: ${formatBRL(saldoCat)}` : `Excedido: ${formatBRL(Math.abs(saldoCat))}`}
          </span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
          <div class="${corBarra} h-2 rounded-full" style="width: ${Math.min(perc, 100)}%"></div>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("resumoComparativoBox").innerHTML = `
    <div class="flex justify-between text-[#343A40]"><span>Total Mão de Obra (Classificação Planilha):</span><strong>${formatBRL(m.porTipoOficial.MO)}</strong></div>
    <div class="flex justify-between text-[#343A40]"><span>Total Material (Classificação Planilha):</span><strong>${formatBRL(m.porTipoOficial.MAT)}</strong></div>
    <div class="flex justify-between text-[#343A40]"><span>Total Equipamento (Auditado):</span><strong class="text-[#FF8C00]">${formatBRL(m.porTipoOficial.EQUIP)}</strong></div>
    <div class="flex justify-between text-[#343A40]"><span>Total Outros (Classificação Planilha):</span><strong>${formatBRL(m.porTipoOficial.OUTROS)}</strong></div>
    <div class="flex justify-between pt-2.5 border-t border-[#DEE2E6] font-display text-sm font-extrabold text-[#23396B]">
      <span>CUSTO TOTAL AUDITADO:</span><span>${formatBRL(m.custoTotal)}</span>
    </div>
  `;

  const ctx = document.getElementById("chartCategorias");
  if (ctx) {
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Material", "Mão de Obra Direta", "Equipamento", "Alimentação", "Combustível/Transp.", "Outros/Taxas"],
        datasets: [{
          data: [
            m.porSubtipoReal.MAT,
            m.porSubtipoReal.MO,
            m.porSubtipoReal.EQUIP,
            m.porSubtipoReal.ALIM,
            m.porSubtipoReal.TRANSP,
            m.porSubtipoReal.OUTROS
          ],
          backgroundColor: ["#23396B", "#4395D8", "#FF8C00", "#34B442", "#002E6E", "#A6CE38"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { family: "Plus Jakarta Sans", size: 11 } } }
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
  alert("Limites orçamentários atualizados.");
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
      <tr class="hover:bg-[#F8F9FA]">
        <td class="py-3.5 px-4 font-bold text-[#23396B]">
          ${med.titulo}
          <span class="block text-xs text-[#6C757D] font-normal">${med.observacao || ""}</span>
        </td>
        <td class="py-3.5 px-4">
          <button onclick="alternarStatusMedicao('${med.id}')" class="px-3 py-1 rounded-full text-xs font-bold ${isRec ? "bg-[#34B442]/15 text-[#34B442]" : "bg-[#FF8C00]/15 text-[#FF6B12] border border-[#FF8C00]/30"}">
            ${isRec ? "Atestada / Recebida" : "Prevista (Alterar para Atestada)"}
          </button>
        </td>
        <td class="py-3.5 px-4 text-right font-semibold text-[#23396B]">${formatBRL(bruto)}</td>
        <td class="py-3.5 px-4 text-right text-[#6C757D]">-${desc}%</td>
        <td class="py-3.5 px-4 text-right font-display font-extrabold text-[#34B442]">${formatBRL(liq)}</td>
        <td class="py-3.5 px-4 text-center no-print">
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
    observacao: "Medição registrada no sistema"
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
      <div class="p-4 rounded-2xl border border-[#DEE2E6] bg-[#F8F9FA]">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h4 class="font-display font-bold text-[#23396B] text-sm">${e.fornecedor}</h4>
            <p class="text-xs text-[#6C757D]">${e.servico || ""} ${e.observacao ? "• " + e.observacao : ""}</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-extrabold ${falta === 0 ? "bg-[#34B442]/15 text-[#34B442]" : "bg-[#FF8C00] text-white"}">
            ${falta === 0 ? "QUITADO" : `SALDO A PAGAR: ${formatBRL(falta)}`}
          </span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs mt-3 pt-2.5 border-t border-[#DEE2E6]">
          <div class="text-[#6C757D]">Contratado: <strong class="text-[#23396B]">${formatBRL(contratado)}</strong></div>
          <div class="text-[#6C757D]">Pago: <strong class="text-[#34B442]">${formatBRL(pago)}</strong></div>
          <div class="text-right text-[#6C757D]">Execução Financeira: <strong class="text-[#4395D8]">${perc.toFixed(0)}%</strong></div>
        </div>
      </div>
    `;
  }).join("");

  const divTit = document.getElementById("listaTitulares");
  const titularesEntries = Object.entries(m.porTitular).sort((a, b) => b[1] - a[1]);

  let htmlTit = titularesEntries.map(([tit, val]) => {
    const perc = m.custoTotal > 0 ? (val / m.custoTotal) * 100 : 0;
    return `
      <div class="p-4 rounded-2xl border border-[#DEE2E6] bg-[#F8F9FA] flex items-center justify-between">
        <div>
          <span class="text-xs font-extrabold px-3 py-0.5 rounded-full bg-[#23396B] text-white">${tit}</span>
          <p class="text-xs text-[#6C757D] mt-1.5">${perc.toFixed(1)}% de participação nos desembolsos</p>
        </div>
        <div class="text-right">
          <p class="font-display text-base font-extrabold text-[#23396B]">${formatBRL(val)}</p>
        </div>
      </div>
    `;
  }).join("");

  if (obra.enviosCaixa && obra.enviosCaixa.length > 0) {
    const totalEnvios = obra.enviosCaixa.reduce((a, b) => a + Number(b.valor || 0), 0);
    htmlTit += `
      <div class="p-4 rounded-2xl bg-[#23396B] text-white mt-3 text-xs space-y-1.5">
        <div class="font-bold text-[#A6CE38] uppercase tracking-wider">Controle de Adiantamentos (Caixa Obra)</div>
        <div class="flex justify-between text-white/80"><span>Total Enviado / Entradas:</span><strong class="text-white">${formatBRL(totalEnvios)}</strong></div>
        <div class="flex justify-between text-white/80"><span>Total Saídas Registradas:</span><strong class="text-white">${formatBRL(m.custoTotal)}</strong></div>
        <div class="flex justify-between pt-1.5 border-t border-white/15 font-bold text-[#FF8C00]">
          <span>Saldo de Caixa (Entradas - Saídas):</span><span>${formatBRL(totalEnvios - m.custoTotal)}</span>
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
    atualizarTudo();
  }
}

function irParaLancamento() {
  mudarAba("lancamentos");
  document.getElementById("lancDescricao").focus();
}

function toggleCamposAvancados() {
  const el = document.getElementById("camposAvancados");
  const icone = document.getElementById("iconeToggleAvancado");
  const texto = document.getElementById("textoToggleAvancado");
  if (!el) return;
  const isHidden = el.classList.contains("hidden");
  if (isHidden) {
    el.classList.remove("hidden");
    if (icone) icone.textContent = "−";
    if (texto) texto.textContent = "Ocultar detalhes adicionais";
  } else {
    el.classList.add("hidden");
    if (icone) icone.textContent = "+";
    if (texto) texto.textContent = "Mais detalhes (Titular, Meio de Pagamento, Empreita)";
  }
}

function alternarStatusObra() {
  const obra = getObraAtual();
  if (!obra) return;
  obra.status = obra.status === "Concluída" ? "Em Andamento" : "Concluída";
  salvarEstado();
  atualizarTudo();
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
        alert("Base importada com sucesso.");
      }
    } catch (err) {
      alert("Arquivo de backup inválido.");
    }
  };
  reader.readAsText(file);
}

function resetarDadosOriginais() {
  if (!confirm("Restaurar os dados originais corrigidos da planilha?")) return;
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
