// ==========================================================================
// EMTEC Engenharia — Controle Financeiro e Viabilidade de Obras
// Sincronização em Nuvem (Vercel Blob), Segurança por PIN, Mobile-First & EVM
// ==========================================================================

const STORAGE_KEY = "EMTEC_SISTEMA_CUSTOS_V1";
const PIN_STORAGE_KEY = "emtec_auth_pin";
const DEFAULT_PIN = "1234";

let estado = carregarEstadoLocal();
let obraAtualId = estado.obras[0]?.id || "";
let chartInstance = null;
let categoriaRapidaAtiva = "MO";
let isSincronizando = false;

// --------------------------------------------------------------------------
// 1. SEGURANÇA E AUTENTICAÇÃO POR PIN
// --------------------------------------------------------------------------
function verificarAuth() {
  const pinSalvo = localStorage.getItem(PIN_STORAGE_KEY);
  const modal = document.getElementById("pinGateModal");
  if (!modal) return true;

  if (pinSalvo && pinSalvo === DEFAULT_PIN) {
    modal.classList.add("hidden");
    return true;
  } else {
    modal.classList.remove("hidden");
    const input = document.getElementById("inputPinAcesso");
    if (input) setTimeout(() => input.focus(), 200);
    return false;
  }
}

function autenticarPIN(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("inputPinAcesso");
  const checkLembrar = document.getElementById("checkLembrarPin");
  const erroMsg = document.getElementById("pinErroMsg");
  const pin = (input?.value || "").trim();

  if (pin === DEFAULT_PIN) {
    if (checkLembrar && checkLembrar.checked) {
      localStorage.setItem(PIN_STORAGE_KEY, pin);
    } else {
      sessionStorage.setItem(PIN_STORAGE_KEY, pin);
    }
    if (erroMsg) erroMsg.classList.add("hidden");
    document.getElementById("pinGateModal").classList.add("hidden");
    // Inicializar sincronização com a nuvem após login
    sincronizarComNuvem(true);
  } else {
    if (erroMsg) erroMsg.classList.remove("hidden");
    if (input) {
      input.value = "";
      input.focus();
    }
  }
}

function logout() {
  if (confirm("Deseja sair do sistema neste aparelho?")) {
    localStorage.removeItem(PIN_STORAGE_KEY);
    sessionStorage.removeItem(PIN_STORAGE_KEY);
    location.reload();
  }
}

// --------------------------------------------------------------------------
// 2. CARREGAMENTO E SINCRONIZAÇÃO EM NUVEM (VERCEL BLOB + LOCALSTORAGE)
// --------------------------------------------------------------------------
function carregarEstadoLocal() {
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
  return JSON.parse(JSON.stringify(window.INITIAL_EMTEC_DATA || { obras: [] }));
}

function getPinAtual() {
  return localStorage.getItem(PIN_STORAGE_KEY) || sessionStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;
}

function atualizarBadgeNuvem(status, dataHora) {
  // Desktop: dois elementos separados (status + hora)
  const badgeStatus = document.getElementById("cloudBadgeStatus");
  const badgeHora = document.getElementById("cloudBadgeHora");
  // Mobile: dois sub-elementos dentro de cloudBadgeMobile
  const mobStatus = document.getElementById("cloudBadgeMobStatus");
  const mobHora = document.getElementById("cloudBadgeMobHora");

  let statusHtml = "";
  let horaHtml = "";

  if (status === "syncing") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse"></span><span class="font-bold text-[#FF8C00]">Sincronizando...</span>`;
    horaHtml = "";
  } else if (status === "success") {
    const hora = dataHora
      ? new Date(dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    statusHtml = `<span class="w-2 h-2 rounded-full bg-[#16A34A]"></span><span class="font-bold text-[#16A34A]">Conectado</span>`;
    horaHtml = `Última sincronização: ${hora}`;
  } else if (status === "offline") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="font-bold text-rose-600">Sem conexão — Salvo localmente</span>`;
    horaHtml = "";
  }

  if (badgeStatus) badgeStatus.innerHTML = statusHtml;
  if (badgeHora) {
    if (horaHtml) {
      badgeHora.textContent = horaHtml;
      badgeHora.classList.remove("hidden");
    } else {
      badgeHora.classList.add("hidden");
    }
  }
  if (mobStatus) mobStatus.innerHTML = statusHtml;
  if (mobHora) {
    if (horaHtml) {
      mobHora.textContent = horaHtml;
      mobHora.classList.remove("hidden");
    } else {
      mobHora.classList.add("hidden");
    }
  }
}

async function sincronizarComNuvem(forcarDownload = false) {
  if (isSincronizando) return;
  isSincronizando = true;
  atualizarBadgeNuvem("syncing");

  const pin = getPinAtual();

  try {
    if (forcarDownload) {
      const res = await fetch("/api/sync", {
        headers: { "x-emtec-pin": pin },
        cache: "no-store"
      });

      if (res.ok) {
        const json = await res.json();
        if (json.exists && json.data && Array.isArray(json.data.obras) && json.data.obras.length > 0) {
          estado = json.data;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
          if (!estado.obras.some(o => o.id === obraAtualId)) {
            obraAtualId = estado.obras[0]?.id || "";
          }
          renderizarSeletorObras();
          atualizarTudo();
          atualizarBadgeNuvem("success", json.updatedAt);
          isSincronizando = false;
          return;
        } else if (!json.exists) {
          // Primeira execução: nuvem vazia, inicializar enviando o estado local
          await enviarParaNuvem(pin);
          isSincronizando = false;
          return;
        }
      }
    }

    await enviarParaNuvem(pin);
  } catch (err) {
    console.warn("Nuvem Vercel Blob offline ou indisponível:", err);
    atualizarBadgeNuvem("offline");
  } finally {
    isSincronizando = false;
  }
}

async function enviarParaNuvem(pin) {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-emtec-pin": pin
      },
      body: JSON.stringify(estado)
    });

    if (res.ok) {
      const json = await res.json();
      atualizarBadgeNuvem("success", json.timestamp);
    } else {
      atualizarBadgeNuvem("offline");
    }
  } catch (e) {
    atualizarBadgeNuvem("offline");
  }
}

function salvarEstado() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  // Disparar sincronização assíncrona automática em segundo plano
  sincronizarComNuvem(false);
}

// --------------------------------------------------------------------------
// 3. ENGENHARIA FINANCEIRA DE CUSTOS (EVM / EAC / VIABILIDADE PROJETADA)
// --------------------------------------------------------------------------
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
  if (!obra) return {};
  const saidas = (obra.lancamentos || []).filter(l => l.movimento !== "ENTRADA_CAIXA");
  const entradasCaixa = (obra.lancamentos || []).filter(l => l.movimento === "ENTRADA_CAIXA");

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

  // 1. Saldo de Caixa Atual (Hoje): Receita Líquida Recebida - Custos Realizados
  const saldoAtual = medLiquidaRecebida - custoTotal;

  // 2. Compromissos Pendentes (Empreitas Contratadas em Aberto)
  let saldoEmpreitasPendente = 0;
  for (const emp of (obra.empreitas || [])) {
    const falta = Math.max(0, Number(emp.valorContratado || 0) - Number(emp.valorPago || 0));
    saldoEmpreitasPendente += falta;
  }

  // 3. Custos Restantes Estimados para Concluir a Obra (ETC)
  // Custo orçado restante para materiais e suprimentos além do que já foi contratado
  const tetoRestante = Math.max(0, tetoTotal - custoTotal);
  const custoRestanteEstimado = Math.max(0, tetoRestante - saldoEmpreitasPendente);

  // 4. Custo Total Projetado Final na Conclusão (EAC - Estimate at Completion)
  const isEmAndamento = obra.status !== "Concluída";
  const custoTotalProjetado = isEmAndamento
    ? custoTotal + saldoEmpreitasPendente + custoRestanteEstimado
    : custoTotal;

  // 5. Receita Total Contratada
  const receitaContratoTotal = medLiquidaTotalContrato > 0 ? medLiquidaTotalContrato : medLiquidaRecebida;

  // 6. Resultado Final Projetado
  const saldoProjetadoFinal = receitaContratoTotal - custoTotalProjetado;
  const margemProjetadaFinalPerc = receitaContratoTotal > 0
    ? (saldoProjetadoFinal / receitaContratoTotal) * 100
    : 0;

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
    saldoEmpreitasPendente,
    custoRestanteEstimado,
    custoTotalProjetado,
    receitaContratoTotal,
    saldoProjetadoFinal,
    margemProjetadaFinalPerc
  };
}

// --------------------------------------------------------------------------
// 4. ATUALIZAÇÃO GERAL DA INTERFACE (DESKTOP E MOBILE)
// --------------------------------------------------------------------------
function atualizarTudo() {
  const obra = getObraAtual();
  if (!obra) return;
  const m = calcularMetricasObra(obra);

  const isEmAndamento = obra.status !== "Concluída";

  // Identificação e Header
  const elObraTitulo = document.getElementById("obraTitulo");
  if (elObraTitulo) elObraTitulo.textContent = obra.nome;

  const elObraClienteTag = document.getElementById("obraClienteTag");
  if (elObraClienteTag) elObraClienteTag.textContent = `${obra.cliente || "CONTRATO"} • INÍCIO ${formatDataBR(obra.dataInicio)}`;

  // Mobile Hero Card
  const mobObraNome = document.getElementById("mobObraNome");
  if (mobObraNome) mobObraNome.textContent = obra.nome;

  const mobSaldoAtual = document.getElementById("mobSaldoAtual");
  if (mobSaldoAtual) {
    mobSaldoAtual.textContent = formatBRL(m.saldoAtual);
    mobSaldoAtual.className = m.saldoAtual >= 0
      ? "font-display text-2xl sm:text-3xl font-extrabold text-[#16A34A] tracking-tight"
      : "font-display text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight";
  }

  const mobCustoReal = document.getElementById("mobCustoReal");
  if (mobCustoReal) mobCustoReal.textContent = formatBRL(m.custoTotal);

  const mobReceitaLiq = document.getElementById("mobReceitaLiq");
  if (mobReceitaLiq) mobReceitaLiq.textContent = formatBRL(m.medLiquidaRecebida);

  const mobMargemProj = document.getElementById("mobMargemProj");
  if (mobMargemProj) {
    if (isEmAndamento) {
      mobMargemProj.textContent = `${m.margemProjetadaFinalPerc >= 0 ? "+" : ""}${m.margemProjetadaFinalPerc.toFixed(1)}% (${formatBRL(m.saldoProjetadoFinal)} previsto)`;
      mobMargemProj.className = m.saldoProjetadoFinal >= 0 ? "font-bold text-[#16A34A]" : "font-bold text-rose-600";
    } else {
      const margemFinal = m.receitaContratoTotal > 0 ? (m.saldoAtual / m.receitaContratoTotal) * 100 : 0;
      mobMargemProj.textContent = `${margemFinal.toFixed(1)}% realizada (Concluída)`;
      mobMargemProj.className = m.saldoAtual >= 0 ? "font-bold text-[#16A34A]" : "font-bold text-rose-600";
    }
  }

  // KPIs Desktop
  const kpiMedLiq = document.getElementById("kpiMedicaoLiquida");
  if (kpiMedLiq) kpiMedLiq.textContent = formatBRL(m.medLiquidaRecebida);

  const kpiMedSub = document.getElementById("kpiMedicaoSub");
  if (kpiMedSub) {
    kpiMedSub.textContent = m.medLiquidaTotalContrato > m.medLiquidaRecebida
      ? `Bruto: ${formatBRL(m.medBrutaRecebida)} | Contrato Líq: ${formatBRL(m.medLiquidaTotalContrato)}`
      : `Faturamento Bruto Atestado: ${formatBRL(m.medBrutaRecebida)}`;
  }

  const kpiCustoTotal = document.getElementById("kpiCustoTotal");
  if (kpiCustoTotal) kpiCustoTotal.textContent = formatBRL(m.custoTotal);

  const kpiQtdLanc = document.getElementById("kpiQtdLancamentos");
  if (kpiQtdLanc) kpiQtdLanc.textContent = `${m.qtdSaidas} registros`;

  const kpiCustoSub = document.getElementById("kpiCustoSub");
  if (kpiCustoSub) kpiCustoSub.textContent = `MAT: ${formatBRL(m.porTipoOficial.MAT)} | MO: ${formatBRL(m.porTipoOficial.MO)}`;

  // Card Saldo e Viabilidade
  const badgeViab = document.getElementById("viabilidadeBadge");
  const cardSaldoBox = document.getElementById("cardSaldoBox");
  const cardSaldoLabel = document.getElementById("cardSaldoLabel");
  const kpiSaldoFinal = document.getElementById("kpiSaldoFinal");
  const kpiMargemPerc = document.getElementById("kpiMargemPerc");
  const kpiSaldoSub = document.getElementById("kpiSaldoSub");

  if (kpiSaldoFinal) kpiSaldoFinal.textContent = formatBRL(m.saldoAtual);

  if (isEmAndamento) {
    if (cardSaldoLabel) cardSaldoLabel.textContent = "Resultado Líquido da Obra";
    if (kpiMargemPerc) {
      kpiMargemPerc.textContent = `${m.margemProjetadaFinalPerc >= 0 ? "+" : ""}${m.margemProjetadaFinalPerc.toFixed(1)}% projetada`;
    }
    if (kpiSaldoSub) {
      kpiSaldoSub.textContent = `Receita Líquida Recebida − Custos Realizados da Obra | Empreitas pendentes: ${formatBRL(m.saldoEmpreitasPendente)} | EAC: ${formatBRL(m.custoTotalProjetado)}`;
    }

    if (m.saldoProjetadoFinal < 0) {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] cursor-pointer shadow-sm";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-600"></span> Em Andamento • Risco de Prejuízo (${formatBRL(Math.abs(m.saldoProjetadoFinal))})`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-rose-500/20 border border-rose-400/50 backdrop-blur-xs";
    } else if (m.saldoAtual < 0) {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] cursor-pointer shadow-sm";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#FF8C00]"></span> Em Andamento • Caixa Descoberto Momentâneo`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-[#FF8C00]/20 border border-[#FF8C00]/50 backdrop-blur-xs";
    } else {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC] cursor-pointer shadow-sm";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#16A34A]"></span> Em Andamento • Obra Saudável (+${m.margemProjetadaFinalPerc.toFixed(0)}% proj.)`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs";
    }
  } else {
    if (cardSaldoLabel) cardSaldoLabel.textContent = "Resultado Líquido Final";
    const margemRealizada = m.receitaContratoTotal > 0 ? (m.saldoAtual / m.receitaContratoTotal) * 100 : 0;
    if (kpiMargemPerc) kpiMargemPerc.textContent = `${margemRealizada.toFixed(1)}% final`;
    if (kpiSaldoSub) kpiSaldoSub.textContent = `Obra Concluída: Faturamento Líquido menos Custo Total Desembolsado.`;

    if (m.saldoAtual >= 0) {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC] cursor-pointer shadow-sm";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#16A34A]"></span> Obra Concluída • Lucro Realizado`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs";
    } else {
      badgeViab.className = "inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] cursor-pointer shadow-sm";
      badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-600"></span> Obra Concluída • Prejuízo Realizado`;
      cardSaldoBox.className = "rounded-2xl p-4 bg-rose-500/20 border border-rose-400/50 backdrop-blur-xs";
    }
  }

  // Teto Orçamentário
  const percTeto = m.tetoTotal > 0 ? (m.custoTotal / m.tetoTotal) * 100 : 0;
  const kpiTetoValor = document.getElementById("kpiTetoValor");
  if (kpiTetoValor) kpiTetoValor.textContent = formatBRL(m.tetoTotal);

  const badgeTeto = document.getElementById("kpiTetoPercBadge");
  const barTeto = document.getElementById("kpiTetoBar");
  if (badgeTeto) badgeTeto.textContent = `${percTeto.toFixed(1)}% utilizado`;
  if (barTeto) {
    barTeto.style.width = `${Math.min(percTeto, 100)}%`;
    if (percTeto < 80) {
      barTeto.className = "bg-[#16A34A] h-1.5 rounded-full transition-all duration-300";
    } else if (percTeto <= 100) {
      barTeto.className = "bg-[#FF8C00] h-1.5 rounded-full transition-all duration-300";
    } else {
      barTeto.className = "bg-rose-500 h-1.5 rounded-full transition-all duration-300";
    }
  }

  const restanteTeto = m.tetoTotal - m.custoTotal;
  const kpiTetoSub = document.getElementById("kpiTetoSub");
  if (kpiTetoSub) {
    kpiTetoSub.textContent = restanteTeto >= 0
      ? `Saldo disponível no teto: ${formatBRL(restanteTeto)}`
      : `Excedente sobre o limite: ${formatBRL(Math.abs(restanteTeto))}`;
  }

  // Banner Auditoria Forense
  const bannerAud = document.getElementById("alertaAuditoriaBanner");
  if (bannerAud) {
    if (obra.id === "obra-piscina") {
      bannerAud.classList.remove("hidden");
      document.getElementById("alertaAuditoriaTitulo").textContent = "Conferência Reforma Piscina:";
      document.getElementById("alertaAuditoriaTexto").textContent =
        "Os 5 lançamentos de Equipamento (R$ 1.123,00) ignorados na fórmula do Excel original foram somados. Custo real: R$ 68.704,19 | Saldo líquido: R$ 20.835,81.";
    } else if (obra.id === "obra-caixa-forro") {
      bannerAud.classList.remove("hidden");
      document.getElementById("alertaAuditoriaTitulo").textContent = "Conferência Aba IAGO (Caixa Obra):";
      document.getElementById("alertaAuditoriaTexto").textContent =
        "O resumo da planilha original apontou para a coluna C (Entradas) totalizando R$ 790,00, omitindo as saídas reais da coluna D que somam R$ 3.270,26.";
    } else {
      bannerAud.classList.add("hidden");
    }
  }

  // Preencher Select de Empreitas
  const selEmp = document.getElementById("lancEmpreitaId");
  const selEmpRapido = document.getElementById("lancRapidoEmpreitaId");
  const optEmpreitas = `<option value="">Não vinculado a contrato de empreita</option>` +
    (obra.empreitas || []).map(e => {
      const falta = Math.max(0, Number(e.valorContratado) - Number(e.valorPago));
      return `<option value="${e.id}">${e.fornecedor} (Saldo a pagar: ${formatBRL(falta)})</option>`;
    }).join("");

  if (selEmp) selEmp.innerHTML = optEmpreitas;
  if (selEmpRapido) selEmpRapido.innerHTML = optEmpreitas;

  renderizarMiniCards(m);
  renderizarTabelaLancamentos();
  renderizarAbaResumo(obra, m);
  renderizarAbaMedicoes(obra, m);
  renderizarAbaEmpreitasETitulares(obra, m);
}

function renderizarMiniCards(m) {
  const container = document.getElementById("miniCardsCategorias");
  if (!container) return;

  const cards = [
    { label: "Material (MAT)", val: m.porTipoOficial.MAT, sub: "Insumos e materiais", dot: "bg-[#23396B]" },
    { label: "Mão de Obra (MO)", val: m.porTipoOficial.MO, sub: `Direta: ${formatBRL(m.porSubtipoReal.MO)}`, dot: "bg-[#4395D8]" },
    { label: "Equipamento (EQUIP)", val: m.porTipoOficial.EQUIP, sub: "Locação e ferramentas", dot: "bg-[#FF8C00]" },
    { label: "Outros (Oficial)", val: m.porTipoOficial.OUTROS, sub: "Taxas, ART e comissões", dot: "bg-[#6C757D]" },
    { label: "Alimentação", val: m.porSubtipoReal.ALIM, sub: "Refeições de equipe", dot: "bg-[#16A34A]" },
    { label: "Combustível / Transp.", val: m.porSubtipoReal.TRANSP, sub: "Abastecimento e deslocamento", dot: "bg-[#002E6E]" }
  ];

  container.innerHTML = cards.map(c => `
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

// --------------------------------------------------------------------------
// 5. TABELA DE LANÇAMENTOS E FILTROS (Cards Mobile / Tabela Desktop)
// --------------------------------------------------------------------------
function renderizarTabelaLancamentos() {
  const obra = getObraAtual();
  const busca = (document.getElementById("filtroBusca")?.value || "").toLowerCase().trim();
  const cat = document.getElementById("filtroCategoria")?.value || "TODOS";
  const tit = document.getElementById("filtroTitular")?.value || "TODOS";
  const mes = document.getElementById("filtroMes")?.value || "TODOS";

  let filtrados = (obra.lancamentos || []).filter(item => {
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

  // Ordem decrescente por data (mais recente no topo)
  filtrados.sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const totalFiltrado = filtrados
    .filter(i => i.movimento !== "ENTRADA_CAIXA")
    .reduce((acc, i) => acc + Number(i.valor || 0), 0);

  const elTotalFiltrado = document.getElementById("totalFiltradoValor");
  if (elTotalFiltrado) elTotalFiltrado.textContent = formatBRL(totalFiltrado);

  const tbody = document.getElementById("tbodyLancamentos");
  if (!tbody) return;

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-sm text-[#6C757D]">
          Nenhuma despesa encontrada para os filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    // ---- Renderização em CARDS para mobile ----
    // O tbody fica dentro de uma tabela — usamos um truque: colspan + div
    tbody.innerHTML = `<tr><td colspan="5" class="p-0 border-0">
      <div class="space-y-3 py-2">
        ${filtrados.map(item => {
          const isEntrada = item.movimento === "ENTRADA_CAIXA";
          const sub = item.subtipo || detectarSubtipo(item.descricao, item.tipo);

          let tagBg = "bg-[#23396B]/10 text-[#23396B]";
          if (item.tipo === "MO") tagBg = "bg-[#4395D8]/15 text-[#23396B]";
          if (item.tipo === "MAT") tagBg = "bg-[#23396B]/15 text-[#23396B]";
          if (item.tipo === "EQUIP") tagBg = "bg-[#FF8C00]/20 text-[#0F172A] font-bold";
          if (sub === "ALIM") tagBg = "bg-[#16A34A]/15 text-[#16A34A]";
          if (sub === "TRANSP") tagBg = "bg-[#002E6E]/15 text-[#002E6E]";
          if (isEntrada) tagBg = "bg-[#16A34A]/20 text-[#14532D] font-bold";

          const labelTipo = isEntrada ? "ENTRADA" : `${item.tipo}${sub !== item.tipo ? ` (${sub})` : ""}`;

          return `
            <div class="bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3 shadow-sm">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${tagBg} inline-block mb-1">${labelTipo}</span>
                  <div class="font-bold text-sm text-[#23396B] leading-snug">${item.descricao}</div>
                  <div class="text-[11px] text-[#6C757D] mt-0.5">${formatDataBR(item.data)} · ${item.pagamento || "PIX"} · ${item.titular || "EMTEC"}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="font-display text-lg font-extrabold ${isEntrada ? "text-[#16A34A]" : "text-[#23396B]"}">${isEntrada ? "+" : ""}${formatBRL(item.valor)}</div>
                  <div class="flex gap-2 mt-1 justify-end">
                    <button onclick="editarLancamento('${item.id}')" class="text-[11px] font-semibold text-[#4395D8]">Editar</button>
                    <button onclick="excluirLancamento('${item.id}')" class="text-[11px] font-semibold text-rose-600">Excluir</button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </td></tr>`;
    return;
  }

  // ---- Renderização em TABELA para desktop ----
  tbody.innerHTML = filtrados.map(item => {
    const isEntrada = item.movimento === "ENTRADA_CAIXA";
    const sub = item.subtipo || detectarSubtipo(item.descricao, item.tipo);

    let tagCor = "bg-[#23396B]/10 text-[#23396B]";
    if (item.tipo === "MO") tagCor = "bg-[#4395D8]/15 text-[#23396B]";
    if (item.tipo === "MAT") tagCor = "bg-[#23396B]/15 text-[#23396B]";
    if (item.tipo === "EQUIP") tagCor = "bg-[#FF8C00]/20 text-[#0F172A] font-bold";
    if (sub === "ALIM") tagCor = "bg-[#16A34A]/15 text-[#16A34A]";
    if (sub === "TRANSP") tagCor = "bg-[#002E6E]/15 text-[#002E6E]";

    return `
      <tr class="hover:bg-[#F8F9FA] transition border-b border-[#DEE2E6]">
        <td class="py-3 px-3 text-xs font-semibold text-[#6C757D] whitespace-nowrap">${formatDataBR(item.data)}</td>
        <td class="py-3 px-3">
          <div class="font-bold text-xs sm:text-sm text-[#23396B]">${item.descricao}</div>
          <div class="text-[11px] text-[#6C757D] flex items-center gap-2 mt-0.5">
            <span>${item.pagamento || "PIX"}</span>
            <span>•</span>
            <span class="font-semibold text-[#23396B]">${item.titular || "EMTEC"}</span>
            ${item.empreitaId ? `<span class="text-[#FF8C00] font-bold">• Empreita</span>` : ""}
          </div>
        </td>
        <td class="py-3 px-3 whitespace-nowrap">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${tagCor}">
            ${item.tipo} ${sub !== item.tipo ? `(${sub})` : ""}
          </span>
        </td>
        <td class="py-3 px-3 text-right font-display text-xs sm:text-sm font-extrabold ${isEntrada ? "text-[#16A34A]" : "text-[#23396B]"} whitespace-nowrap">
          ${isEntrada ? "+" : ""}${formatBRL(item.valor)}
        </td>
        <td class="py-3 px-3 text-center no-print whitespace-nowrap">
          <button onclick="editarLancamento('${item.id}')" class="text-xs font-semibold text-[#4395D8] hover:text-[#23396B] mr-2">Editar</button>
          <button onclick="excluirLancamento('${item.id}')" class="text-xs font-semibold text-rose-600 hover:text-rose-800">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");
}

// --------------------------------------------------------------------------
// 6. LANÇAMENTO RÁPIDO DE 5 SEGUNDOS (MOBILE BOTTOM SHEET & DESKTOP)
// --------------------------------------------------------------------------
function abrirModalLancamentoRapido() {
  const modal = document.getElementById("modalLancamentoRapido");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const hoje = new Date().toISOString().split("T")[0];
  const inputData = document.getElementById("lancRapidoData");
  if (inputData && !inputData.value) inputData.value = hoje;

  selecionarCategoriaRapida("MO");

  const inputValor = document.getElementById("lancRapidoValor");
  if (inputValor) {
    setTimeout(() => inputValor.focus(), 150);
  }
}

function fecharModalLancamentoRapido() {
  const modal = document.getElementById("modalLancamentoRapido");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function selecionarCategoriaRapida(tipo) {
  categoriaRapidaAtiva = tipo;
  ["MO", "MAT", "EQUIP", "OUTROS"].forEach(cat => {
    const btn = document.getElementById(`btnCatRapida_${cat}`);
    if (!btn) return;
    if (cat === tipo) {
      btn.className = "py-2.5 px-3 rounded-2xl text-xs font-extrabold uppercase transition border-2 border-[#23396B] bg-[#23396B] text-white shadow-sm flex items-center justify-center gap-1.5";
    } else {
      btn.className = "py-2.5 px-3 rounded-2xl text-xs font-bold uppercase transition border border-[#CBD5E1] bg-white text-[#23396B] hover:border-[#4395D8] flex items-center justify-center gap-1.5";
    }
  });
}

function toggleOpcoesAvancadasRapidas() {
  const el = document.getElementById("opcoesAvancadasRapidas");
  const icon = document.getElementById("iconeOpcoesAvancadasRapidas");
  if (!el) return;
  if (el.classList.contains("hidden")) {
    el.classList.remove("hidden");
    if (icon) icon.textContent = "−";
  } else {
    el.classList.add("hidden");
    if (icon) icon.textContent = "+";
  }
}

function salvarLancamentoRapido(e) {
  if (e) e.preventDefault();
  const obra = getObraAtual();
  if (!obra) return;

  const valorInput = document.getElementById("lancRapidoValor");
  const descInput = document.getElementById("lancRapidoDescricao");
  const dataInput = document.getElementById("lancRapidoData");
  const titSelect = document.getElementById("lancRapidoTitular");
  const pagSelect = document.getElementById("lancRapidoPagamento");
  const empSelect = document.getElementById("lancRapidoEmpreitaId");

  const valor = parseFloat(valorInput?.value || 0);
  const descricao = (descInput?.value || "").trim();
  const data = dataInput?.value || new Date().toISOString().split("T")[0];
  const titular = titSelect?.value || "EMTEC";
  const pagamento = pagSelect?.value || "PIX";
  const empreitaId = empSelect?.value || "";

  if (isNaN(valor) || valor <= 0) {
    alert("Por favor, digite um valor válido maior que zero.");
    valorInput?.focus();
    return;
  }

  if (!descricao) {
    alert("Por favor, informe a descrição da despesa (ex: Almoço equipe, Cimento, etc.).");
    descInput?.focus();
    return;
  }

  const subtipo = detectarSubtipo(descricao, categoriaRapidaAtiva);

  const novo = {
    id: "lanc-" + Date.now(),
    descricao,
    tipo: categoriaRapidaAtiva,
    subtipo,
    valor,
    data,
    dataOriginal: data,
    pagamento,
    titular,
    movimento: "SAIDA",
    empreitaId: empreitaId || undefined
  };

  if (!obra.lancamentos) obra.lancamentos = [];
  obra.lancamentos.unshift(novo);

  // Se vinculado a empreita, abater automaticamente no valor pago
  if (empreitaId && obra.empreitas) {
    const emp = obra.empreitas.find(e => e.id === empreitaId);
    if (emp) {
      emp.valorPago = Number(emp.valorPago || 0) + valor;
    }
  }

  salvarEstado();
  atualizarTudo();
  fecharModalLancamentoRapido();

  // Limpar formulário rápido
  if (valorInput) valorInput.value = "";
  if (descInput) descInput.value = "";

  // Feedback tátil e sonoro sutil
  if (navigator.vibrate) navigator.vibrate(40);
  mostrarNotificacaoToast(`Despesa de ${formatBRL(valor)} registrada e sincronizada!`);
}

function mostrarNotificacaoToast(msg) {
  const toast = document.getElementById("toastFeedback");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  toast.classList.add("flex");
  setTimeout(() => {
    toast.classList.add("hidden");
    toast.classList.remove("flex");
  }, 3000);
}

// --------------------------------------------------------------------------
// 7. FORMULÁRIO DE LANÇAMENTO COMPLETO (DESKTOP)
// --------------------------------------------------------------------------
function salvarLancamentoDesktop(e) {
  if (e) e.preventDefault();
  const obra = getObraAtual();
  if (!obra) return;

  const idEdicao = document.getElementById("lancIdEdicao")?.value;
  const desc = document.getElementById("lancDescricao")?.value.trim();
  const valor = parseFloat(document.getElementById("lancValor")?.value || 0);
  const data = document.getElementById("lancData")?.value || new Date().toISOString().split("T")[0];
  const tipoEscolhido = document.getElementById("lancTipo")?.value || "MO";
  const titular = document.getElementById("lancTitular")?.value || "EMTEC";
  const pagamento = document.getElementById("lancPagamento")?.value || "PIX";
  const empreitaId = document.getElementById("lancEmpreitaId")?.value || "";

  if (isNaN(valor) || valor <= 0) {
    alert("Informe um valor válido.");
    return;
  }

  const isEntrada = tipoEscolhido === "ENTRADA_CAIXA";
  const tipoOficial = isEntrada ? "MAT" : normalizarTipoOficial(tipoEscolhido);
  const subtipo = detectarSubtipo(desc, tipoEscolhido);

  if (idEdicao) {
    const idx = obra.lancamentos.findIndex(l => l.id === idEdicao);
    if (idx !== -1) {
      obra.lancamentos[idx] = {
        ...obra.lancamentos[idx],
        descricao: desc,
        tipo: tipoOficial,
        subtipo,
        valor,
        data,
        pagamento,
        titular,
        movimento: isEntrada ? "ENTRADA_CAIXA" : "SAIDA",
        empreitaId: empreitaId || undefined
      };
    }
  } else {
    const novo = {
      id: "lanc-" + Date.now(),
      descricao: desc,
      tipo: tipoOficial,
      subtipo,
      valor,
      data,
      dataOriginal: data,
      pagamento,
      titular,
      movimento: isEntrada ? "ENTRADA_CAIXA" : "SAIDA",
      empreitaId: empreitaId || undefined
    };

    if (!obra.lancamentos) obra.lancamentos = [];
    obra.lancamentos.unshift(novo);

    if (empreitaId && obra.empreitas) {
      const emp = obra.empreitas.find(e => e.id === empreitaId);
      if (emp) {
        emp.valorPago = Number(emp.valorPago || 0) + valor;
      }
    }
  }

  salvarEstado();
  limparFormLancamento();
  atualizarTudo();
  mostrarNotificacaoToast(`Despesa salva com sucesso.`);
}

function editarLancamento(id) {
  const obra = getObraAtual();
  const item = (obra.lancamentos || []).find(l => l.id === id);
  if (!item) return;

  mudarAba("lancamentos");
  document.getElementById("lancIdEdicao").value = item.id;
  document.getElementById("lancDescricao").value = item.descricao;
  document.getElementById("lancValor").value = item.valor;
  document.getElementById("lancData").value = item.data;
  document.getElementById("lancTipo").value = item.movimento === "ENTRADA_CAIXA" ? "ENTRADA_CAIXA" : item.tipo;
  document.getElementById("lancTitular").value = item.titular || "EMTEC";
  document.getElementById("lancPagamento").value = item.pagamento || "PIX";
  document.getElementById("lancEmpreitaId").value = item.empreitaId || "";

  document.getElementById("formLancTitulo").textContent = "Editar Despesa";
  document.getElementById("btnCancelarEdicao").classList.remove("hidden");
  document.getElementById("camposAvancados").classList.remove("hidden");
  document.getElementById("lancDescricao").focus();
}

function cancelarEdicao() {
  limparFormLancamento();
}

function limparFormLancamento() {
  const form = document.getElementById("formLancamento");
  if (form) form.reset();
  const idEd = document.getElementById("lancIdEdicao");
  if (idEd) idEd.value = "";
  const tit = document.getElementById("formLancTitulo");
  if (tit) tit.textContent = "Registrar Nova Despesa";
  const btnCanc = document.getElementById("btnCancelarEdicao");
  if (btnCanc) btnCanc.classList.add("hidden");
  const hoje = new Date().toISOString().split("T")[0];
  const d = document.getElementById("lancData");
  if (d) d.value = hoje;
}

function excluirLancamento(id) {
  if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
  const obra = getObraAtual();
  obra.lancamentos = (obra.lancamentos || []).filter(l => l.id !== id);
  salvarEstado();
  atualizarTudo();
  mostrarNotificacaoToast("Lançamento excluído.");
}

// --------------------------------------------------------------------------
// 8. MEDIÇÕES E CONTRATOS (Cards Mobile / Tabela Desktop)
// --------------------------------------------------------------------------
function renderizarAbaMedicoes(obra, m) {
  const tbody = document.getElementById("tbodyMedicoes");
  if (!tbody) return;
  const lista = obra.medicoes || [];
  const isMobile = window.innerWidth < 768;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-sm text-[#6C757D]">Nenhuma medição cadastrada.</td></tr>`;
    return;
  }

  if (isMobile) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-0 border-0">
      <div class="space-y-3 py-2">
        ${lista.map(med => {
          const bruto = Number(med.valorBruto || 0);
          const desc = Number(med.descontoNotaPerc ?? 7.5);
          const liq = med.valorLiquido ? Number(med.valorLiquido) : bruto * (1 - desc / 100);
          const isRec = med.status === "Recebida";
          return `
            <div class="bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3 shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <div class="font-bold text-sm text-[#23396B]">${med.titulo}</div>
                <button onclick="alternarStatusMedicao('${med.id}')"
                  class="px-3 py-1 rounded-full text-[11px] font-bold ${isRec ? "bg-[#DCFCE7] text-[#14532D]" : "bg-[#FEF3C7] text-[#92400E]"}">
                  ${isRec ? "Recebida" : "Prevista"}
                </button>
              </div>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span class="text-[#6C757D] block">Bruto</span>
                  <span class="font-bold text-[#23396B]">${formatBRL(bruto)}</span>
                </div>
                <div>
                  <span class="text-[#6C757D] block">Desconto NF</span>
                  <span class="font-semibold text-[#64748B]">-${desc}%</span>
                </div>
                <div>
                  <span class="text-[#6C757D] block">Líquido</span>
                  <span class="font-display font-extrabold text-[#16A34A]">${formatBRL(liq)}</span>
                </div>
              </div>
              ${med.observacao ? `<div class="text-[11px] text-[#6C757D]">${med.observacao}</div>` : ""}
              <div class="text-right">
                <button onclick="excluirMedicao('${med.id}')" class="text-[11px] text-rose-600 font-semibold">Excluir</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </td></tr>`;
    return;
  }

  // Desktop — tabela padrão
  tbody.innerHTML = lista.map(med => {
    const bruto = Number(med.valorBruto || 0);
    const desc = Number(med.descontoNotaPerc ?? 7.5);
    const liq = med.valorLiquido ? Number(med.valorLiquido) : bruto * (1 - desc / 100);
    const isRec = med.status === "Recebida";

    return `
      <tr class="hover:bg-[#F8F9FA] border-b border-[#DEE2E6]">
        <td class="py-3.5 px-4 font-bold text-[#23396B]">
          ${med.titulo}
          <span class="block text-xs text-[#6C757D] font-normal">${med.observacao || ""}</span>
        </td>
        <td class="py-3.5 px-4">
          <button onclick="alternarStatusMedicao('${med.id}')" class="px-3 py-1 rounded-full text-xs font-bold ${isRec ? "bg-[#16A34A]/15 text-[#16A34A]" : "bg-[#FF8C00]/20 text-[#0F172A] border border-[#FF8C00]/40"}">
            ${isRec ? "Atestada / Recebida" : "Prevista (Mudar p/ Recebida)"}
          </button>
        </td>
        <td class="py-3.5 px-4 text-right font-semibold text-[#23396B]">${formatBRL(bruto)}</td>
        <td class="py-3.5 px-4 text-right text-[#6C757D]">-${desc}%</td>
        <td class="py-3.5 px-4 text-right font-display font-extrabold text-[#16A34A]">${formatBRL(liq)}</td>
        <td class="py-3.5 px-4 text-center no-print">
          <button onclick="excluirMedicao('${med.id}')" class="text-xs text-rose-600 font-semibold hover:underline">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");
}

function salvarMedicao(e) {
  if (e) e.preventDefault();
  const obra = getObraAtual();
  const titulo = document.getElementById("medTitulo")?.value.trim();
  const valorBruto = parseFloat(document.getElementById("medValorBruto")?.value || 0);
  const descontoNotaPerc = parseFloat(document.getElementById("medDescPerc")?.value || 7.5);
  const status = document.getElementById("medStatus")?.value || "Recebida";
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
  mostrarNotificacaoToast("Medição cadastrada com sucesso.");
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

// --------------------------------------------------------------------------
// 9. RESUMO, ORÇAMENTO E GRÁFICOS
// --------------------------------------------------------------------------
function renderizarAbaResumo(obra, m) {
  const container = document.getElementById("orcamentoComparativoLista");
  if (!container) return;

  const categorias = [
    { key: "MAT", nome: "Material", gasto: m.porTipoOficial.MAT },
    { key: "MO", nome: "Mão de Obra Geral", gasto: m.porTipoOficial.MO },
    { key: "EQUIP", nome: "Equipamentos & Ferramentas", gasto: m.porTipoOficial.EQUIP },
    { key: "ALIM", nome: "Alimentação de Equipe", gasto: m.porSubtipoReal.ALIM },
    { key: "TRANSP", nome: "Combustível & Transporte", gasto: m.porSubtipoReal.TRANSP },
    { key: "OUTROS", nome: "Outros & Taxas", gasto: m.porTipoOficial.OUTROS }
  ];

  const orc = obra.orcamentoPrevisto || {};

  container.innerHTML = categorias.map(c => {
    const teto = Number(orc[c.key] || 0);
    const perc = teto > 0 ? (c.gasto / teto) * 100 : 0;
    const saldoCat = teto - c.gasto;

    let corBarra = "bg-[#16A34A]";
    if (perc > 80 && perc <= 100) corBarra = "bg-[#FF8C00]";
    if (perc > 100) corBarra = "bg-rose-500";

    return `
      <div class="p-3.5 rounded-2xl bg-[#F8F9FA] border border-[#DEE2E6]">
        <div class="flex items-center justify-between">
          <span class="text-xs sm:text-sm font-bold text-[#23396B]">${c.nome}</span>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold uppercase text-[#6C757D]">Teto R$:</span>
            <input type="number" step="100" data-orc-key="${c.key}" value="${teto}"
              class="w-28 rounded-xl border border-[#CBD5E1] px-2.5 py-1 text-xs font-bold text-right bg-white text-[#23396B]" />
          </div>
        </div>
        <div class="flex items-center justify-between text-xs mt-2">
          <span class="text-[#6C757D]">Realizado: <strong class="text-[#23396B]">${formatBRL(c.gasto)}</strong> (${perc.toFixed(1)}%)</span>
          <span class="${saldoCat >= 0 ? "text-[#16A34A] font-semibold" : "text-rose-600 font-bold"}">
            ${saldoCat >= 0 ? `Disponível: ${formatBRL(saldoCat)}` : `Excedido: ${formatBRL(Math.abs(saldoCat))}`}
          </span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
          <div class="${corBarra} h-2 rounded-full" style="width: ${Math.min(perc, 100)}%"></div>
        </div>
      </div>
    `;
  }).join("");

  const resumoComp = document.getElementById("resumoComparativoBox");
  if (resumoComp) {
    resumoComp.innerHTML = `
      <div class="flex justify-between text-[#343A40]"><span>Total Mão de Obra (Classificação Planilha):</span><strong>${formatBRL(m.porTipoOficial.MO)}</strong></div>
      <div class="flex justify-between text-[#343A40]"><span>Total Material (Classificação Planilha):</span><strong>${formatBRL(m.porTipoOficial.MAT)}</strong></div>
      <div class="flex justify-between text-[#343A40]"><span>Total Equipamento (Auditado):</span><strong class="text-[#FF8C00] font-bold">${formatBRL(m.porTipoOficial.EQUIP)}</strong></div>
      <div class="flex justify-between text-[#343A40]"><span>Total Outros (Classificação Planilha):</span><strong>${formatBRL(m.porTipoOficial.OUTROS)}</strong></div>
      <div class="flex justify-between pt-2.5 border-t border-[#DEE2E6] font-display text-sm font-extrabold text-[#23396B]">
        <span>CUSTO TOTAL AUDITADO:</span><span>${formatBRL(m.custoTotal)}</span>
      </div>
    `;
  }

  const ctx = document.getElementById("chartCategorias");
  if (ctx && typeof Chart !== "undefined") {
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
          backgroundColor: ["#23396B", "#4395D8", "#FF8C00", "#16A34A", "#002E6E", "#64748B"],
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
  mostrarNotificacaoToast("Limites orçamentários atualizados.");
}

// --------------------------------------------------------------------------
// 10. EMPREITAS E TITULARES
// --------------------------------------------------------------------------
function renderizarAbaEmpreitasETitulares(obra, m) {
  const listaEmp = document.getElementById("listaEmpreitas");
  if (listaEmp) {
    const emps = obra.empreitas || [];
    if (emps.length === 0) {
      listaEmp.innerHTML = `<p class="text-xs text-[#6C757D]">Nenhum contrato de empreiteiro cadastrado.</p>`;
    } else {
      listaEmp.innerHTML = emps.map(e => {
        const contratado = Number(e.valorContratado || 0);
        const pago = Number(e.valorPago || 0);
        const falta = Math.max(0, contratado - pago);
        const perc = contratado > 0 ? (pago / contratado) * 100 : 0;

        return `
          <div class="p-4 rounded-2xl bg-[#F8F9FA] border border-[#DEE2E6] space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-display font-bold text-sm text-[#23396B]">${e.fornecedor}</h4>
                <p class="text-xs text-[#6C757D]">${e.servico || ""}</p>
              </div>
              <button onclick="excluirEmpreita('${e.id}')" class="text-xs text-rose-600 hover:underline">Excluir</button>
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs pt-1">
              <div><span class="text-[#6C757D] block">Contratado</span><strong class="text-[#23396B]">${formatBRL(contratado)}</strong></div>
              <div><span class="text-[#6C757D] block">Pago</span><strong class="text-[#16A34A]">${formatBRL(pago)}</strong></div>
              <div><span class="text-[#6C757D] block">Saldo a Pagar</span><strong class="${falta > 0 ? "text-[#FF8C00]" : "text-[#16A34A]"} font-bold">${formatBRL(falta)}</strong></div>
            </div>
            <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div class="bg-[#23396B] h-2 rounded-full" style="width: ${Math.min(perc, 100)}%"></div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  const listaTit = document.getElementById("listaTitulares");
  if (listaTit) {
    const tits = Object.entries(m.porTitular || {});
    if (tits.length === 0) {
      listaTit.innerHTML = `<p class="text-xs text-[#6C757D]">Nenhum desembolso registrado.</p>`;
    } else {
      listaTit.innerHTML = tits.map(([titular, val]) => {
        const perc = m.custoTotal > 0 ? (val / m.custoTotal) * 100 : 0;
        return `
          <div class="p-3.5 rounded-2xl bg-[#F8F9FA] border border-[#DEE2E6] flex items-center justify-between">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-[#23396B]">${titular}</span>
              <span class="block text-[11px] text-[#6C757D]">${perc.toFixed(1)}% do custo total da obra</span>
            </div>
            <div class="font-display font-extrabold text-sm sm:text-base text-[#23396B]">${formatBRL(val)}</div>
          </div>
        `;
      }).join("");
    }
  }
}

function salvarEmpreita(e) {
  if (e) e.preventDefault();
  const obra = getObraAtual();
  const fornecedor = document.getElementById("empFornecedor")?.value.trim();
  const servico = document.getElementById("empServico")?.value.trim();
  const valorContratado = parseFloat(document.getElementById("empContratado")?.value || 0);
  const valorPago = parseFloat(document.getElementById("empPago")?.value || 0);

  if (!obra.empreitas) obra.empreitas = [];
  obra.empreitas.push({
    id: "emp-" + Date.now(),
    fornecedor,
    servico,
    valorContratado,
    valorPago,
    observacao: "Contrato registrado no sistema"
  });

  document.getElementById("empFornecedor").value = "";
  document.getElementById("empServico").value = "";
  document.getElementById("empContratado").value = "";
  document.getElementById("empPago").value = "";

  salvarEstado();
  atualizarTudo();
  mostrarNotificacaoToast("Empreiteiro cadastrado.");
}

function excluirEmpreita(id) {
  if (!confirm("Excluir este contrato de empreita?")) return;
  const obra = getObraAtual();
  obra.empreitas = (obra.empreitas || []).filter(e => e.id !== id);
  salvarEstado();
  atualizarTudo();
}

// --------------------------------------------------------------------------
// 11. GESTÃO DE OBRAS E NAVEGAÇÃO
// --------------------------------------------------------------------------
function renderizarSeletorObras() {
  const sel = document.getElementById("obraSelect");
  if (!sel) return;
  sel.innerHTML = estado.obras.map(o =>
    `<option value="${o.id}" ${o.id === obraAtualId ? "selected" : ""}>${o.nome}</option>`
  ).join("");
}

function trocarObra(id) {
  obraAtualId = id;
  limparFormLancamento();
  atualizarTudo();
}

function alternarStatusObra() {
  const obra = getObraAtual();
  if (!obra) return;
  obra.status = obra.status === "Concluída" ? "Em Andamento" : "Concluída";
  salvarEstado();
  atualizarTudo();
  mostrarNotificacaoToast(`Status alterado para: ${obra.status}`);
}

function mudarAba(abaId) {
  // Abas disponíveis
  const abas = ["resumo", "lancamentos", "medicoes", "empreitas", "auditoria"];

  const modoRelatorios = abaId === "relatorios_menu";
  if (modoRelatorios) {
    abaId = "resumo";
  }
  document.body.classList.toggle("mob-rel", modoRelatorios);

  abas.forEach(id => {
    const sec = document.getElementById(`aba-${id}`);
    const btn = document.getElementById(`tabBtn_${id}`);
    if (sec) {
      if (id === abaId) {
        sec.classList.remove("hidden");
      } else {
        sec.classList.add("hidden");
      }
    }
    if (btn) {
      if (id === abaId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    }
  });

  // Atualizar Bottom Nav no celular
  const navMobResumo = document.getElementById("navMobResumo");
  const navMobLanc = document.getElementById("navMobLanc");
  const navMobMed = document.getElementById("navMobMed");
  const navMobRel = document.getElementById("navMobRel");

  if (navMobResumo) navMobResumo.className = (abaId === "resumo" && !modoRelatorios) ? "flex flex-col items-center gap-1 text-[#FF8C00] font-bold" : "flex flex-col items-center gap-1 text-white/70";
  if (navMobLanc) navMobLanc.className = abaId === "lancamentos" ? "flex flex-col items-center gap-1 text-[#FF8C00] font-bold" : "flex flex-col items-center gap-1 text-white/70";
  if (navMobMed) navMobMed.className = abaId === "medicoes" ? "flex flex-col items-center gap-1 text-[#FF8C00] font-bold" : "flex flex-col items-center gap-1 text-white/70";
  if (navMobRel) navMobRel.className = (modoRelatorios || abaId === "empreitas" || abaId === "auditoria") ? "flex flex-col items-center gap-1 text-[#FF8C00] font-bold" : "flex flex-col items-center gap-1 text-white/70";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function irParaLancamento() {
  // No mobile, abre direto o modal rápido de 5 segundos
  if (window.innerWidth < 768) {
    abrirModalLancamentoRapido();
  } else {
    mudarAba("lancamentos");
    document.getElementById("lancDescricao")?.focus();
  }
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

// Modais de Obra e Nuvem
function abrirModalNovaObra() {
  const m = document.getElementById("modalNovaObra");
  if (m) {
    m.classList.remove("hidden");
    m.classList.add("flex");
  }
}

function fecharModalNovaObra() {
  const m = document.getElementById("modalNovaObra");
  if (m) {
    m.classList.add("hidden");
    m.classList.remove("flex");
  }
}

function criarNovaObra(e) {
  if (e) e.preventDefault();
  const nome = document.getElementById("novaObraNome")?.value.trim();
  const cliente = document.getElementById("novaObraCliente")?.value.trim() || "Contrato";
  const aliquotaImposto = parseFloat(document.getElementById("novaObraImposto")?.value || 7.5);
  const valorContrato = parseFloat(document.getElementById("novaObraValorContrato")?.value || 0);
  const tetoCusto = parseFloat(document.getElementById("novaObraTetoCusto")?.value || 0);

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
  mostrarNotificacaoToast(`Nova obra "${nome}" cadastrada.`);
}

function abrirModalNuvem() {
  const m = document.getElementById("modalNuvem");
  if (m) {
    m.classList.remove("hidden");
    m.classList.add("flex");
  }
}

function fecharModalNuvem() {
  const m = document.getElementById("modalNuvem");
  if (m) {
    m.classList.add("hidden");
    m.classList.remove("flex");
  }
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
        mostrarNotificacaoToast("Base importada e sincronizada com a nuvem!");
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
  mostrarNotificacaoToast("Dados restaurados.");
}

function exportarExcelObra() {
  const obra = getObraAtual();
  const m = calcularMetricasObra(obra);

  const rowsLanc = (obra.lancamentos || []).map(l => ({
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
    { "INDICADOR": "SALDO DE CAIXA ATUAL (HOJE)", "VALOR": m.saldoAtual },
    { "INDICADOR": "Saldo Devedor Empreitas", "VALOR": m.saldoEmpreitasPendente },
    { "INDICADOR": "Custo Final Projetado (EAC)", "VALOR": m.custoTotalProjetado },
    { "INDICADOR": "RESULTADO FINAL PROJETADO", "VALOR": m.saldoProjetadoFinal }
  ];

  if (typeof XLSX !== "undefined") {
    const wb = XLSX.utils.book_new();
    const wsLanc = XLSX.utils.json_to_sheet(rowsLanc);
    const wsRes = XLSX.utils.json_to_sheet(rowsResumo);
    XLSX.utils.book_append_sheet(wb, wsLanc, "Lançamentos Auditados");
    XLSX.utils.book_append_sheet(wb, wsRes, "Resumo & Viabilidade");
    XLSX.writeFile(wb, `Centro_Custo_${obra.nome.replace(/\s+/g, "_")}_Corrigido.xlsx`);
  } else {
    alert("Biblioteca Excel não disponível no momento.");
  }
}

// --------------------------------------------------------------------------
// 12. INICIALIZAÇÃO DA APLICAÇÃO
// --------------------------------------------------------------------------
function inicializarApp() {
  const hoje = new Date().toISOString().split("T")[0];
  const inputData = document.getElementById("lancData");
  if (inputData) inputData.value = hoje;

  renderizarSeletorObras();
  atualizarTudo();

  // Re-renderizar listas (cards/tabela) ao girar ou redimensionar a tela
  let ultimoMobile = window.innerWidth < 768;
  window.addEventListener("resize", () => {
    const agoraMobile = window.innerWidth < 768;
    if (agoraMobile !== ultimoMobile) {
      ultimoMobile = agoraMobile;
      atualizarTudo();
    }
  });

  // PIN desativado nesta versão — sincronizar direto com a nuvem
  sincronizarComNuvem(true);

  // Escutar eventos de reconexão de internet
  window.addEventListener("online", () => {
    sincronizarComNuvem(false);
  });
}

window.addEventListener("DOMContentLoaded", inicializarApp);
