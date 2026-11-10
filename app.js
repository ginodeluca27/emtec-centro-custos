// ==========================================================================
// EMTEC Engenharia — Controle Financeiro e Viabilidade de Obras
// Sincronização em Nuvem (Vercel Blob), Perfis Melo/Pilar, Mobile-First
// ==========================================================================

const STORAGE_KEY = "EMTEC_SISTEMA_CUSTOS_V1";
const PIN_STORAGE_KEY = "emtec_auth_pin";
const USUARIO_STORAGE_KEY = "emtec_usuario_ativo";
const PENDENTE_STORAGE_KEY = "EMTEC_PENDENTE_V1";
const INTERVALO_SYNC_MS = 40000;

let estado = carregarEstadoLocal();
let obraAtualId = estado.obras[0]?.id || "";
let chartInstance = null;
let categoriaRapidaAtiva = "";
let isSincronizando = false;
let perfilAtivo = localStorage.getItem(USUARIO_STORAGE_KEY) || "Pilar";
let perfilSelecionadoNoModal = perfilAtivo;

// --------------------------------------------------------------------------
// 1. GESTÃO DE PERFIL (MELO / PILAR) & AUTENTICAÇÃO
// --------------------------------------------------------------------------
function carregarPerfilUsuario() {
  perfilAtivo = localStorage.getItem(USUARIO_STORAGE_KEY) || "Pilar";
  perfilSelecionadoNoModal = perfilAtivo;

  const nomePill = document.getElementById("nomeUsuarioPill");
  const avatarPill = document.getElementById("avatarUsuarioPill");

  if (nomePill) nomePill.textContent = perfilAtivo;
  if (avatarPill) {
    if (perfilAtivo === "Melo") {
      avatarPill.textContent = "M";
      avatarPill.className = "w-5 h-5 rounded-full bg-[#23396B] text-white font-extrabold text-xs flex items-center justify-center";
    } else {
      avatarPill.textContent = "P";
      avatarPill.className = "w-5 h-5 rounded-full bg-[#FF8C00] text-[#0F172A] font-extrabold text-xs flex items-center justify-center";
    }
  }
}

function abrirModalPerfil() {
  const m = document.getElementById("modalPerfilUsuario");
  if (!m) return;
  m.classList.remove("hidden");
  m.classList.add("flex");
  selecionarPerfilCard(perfilAtivo);
  const err = document.getElementById("erroPinPerfil");
  if (err) err.classList.add("hidden");
  const btnFechar = document.getElementById("btnFecharPerfil");
  if (btnFechar) btnFechar.classList.toggle("hidden", !verificarAuth());
}

function fecharModalPerfil() {
  const m = document.getElementById("modalPerfilUsuario");
  if (!m) return;
  m.classList.add("hidden");
  m.classList.remove("flex");
}

function selecionarPerfilCard(nome) {
  perfilSelecionadoNoModal = nome;
  const cardPilar = document.getElementById("cardPerfilPilar");
  const cardMelo = document.getElementById("cardPerfilMelo");

  if (nome === "Pilar") {
    if (cardPilar) {
      cardPilar.className = "p-3.5 rounded-2xl border-2 border-[#FF8C00] bg-[#FF8C00]/10 flex flex-col items-center gap-1 transition shadow-sm";
    }
    if (cardMelo) {
      cardMelo.className = "p-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#23396B] flex flex-col items-center gap-1 transition opacity-70";
    }
  } else {
    if (cardPilar) {
      cardPilar.className = "p-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#FF8C00] flex flex-col items-center gap-1 transition opacity-70";
    }
    if (cardMelo) {
      cardMelo.className = "p-3.5 rounded-2xl border-2 border-[#23396B] bg-[#23396B]/10 flex flex-col items-center gap-1 transition shadow-sm";
    }
  }
}

async function confirmarPerfilUsuario() {
  const pinInput = document.getElementById("inputPinPerfil");
  const pinVal = (pinInput?.value || "").trim();
  const erroMsg = document.getElementById("erroPinPerfil");
  const checkLembrar = document.getElementById("checkLembrarPerfil");
  const btn = document.getElementById("btnEntrarPerfil");

  const mostrarErro = (txt) => {
    if (erroMsg) {
      erroMsg.textContent = txt;
      erroMsg.classList.remove("hidden");
    }
  };

  if (!pinVal) {
    mostrarErro("Digite o PIN de acesso.");
    pinInput?.focus();
    return;
  }

  if (btn) btn.disabled = true;
  try {
    // Quem confere o PIN é o servidor (a resposta correta não existe no navegador)
    const res = await fetch("/api/sync", { headers: { "x-emtec-pin": pinVal }, cache: "no-store" });
    if (res.status === 503) {
      mostrarErro("O sistema ainda não tem PIN configurado no servidor. Avise o responsável.");
      return;
    }
    if (!res.ok) {
      mostrarErro("PIN incorreto. Tente novamente.");
      if (pinInput) pinInput.value = "";
      return;
    }
  } catch (e) {
    mostrarErro("Sem conexão para conferir o PIN. Conecte-se à internet na primeira entrada.");
    return;
  } finally {
    if (btn) btn.disabled = false;
  }

  perfilAtivo = perfilSelecionadoNoModal;
  localStorage.setItem(USUARIO_STORAGE_KEY, perfilAtivo);
  salvarPinNoAparelho(pinVal, !!(checkLembrar && checkLembrar.checked));
  if (pinInput) pinInput.value = "";
  if (erroMsg) erroMsg.classList.add("hidden");

  carregarPerfilUsuario();
  fecharModalPerfil();
  mostrarNotificacaoToast(`Conectado como ${perfilAtivo}`);
  iniciarSincronizacaoPeriodica();
  sincronizarComNuvem();
}

function salvarPinNoAparelho(pin, lembrar) {
  localStorage.removeItem(PIN_STORAGE_KEY);
  sessionStorage.removeItem(PIN_STORAGE_KEY);
  (lembrar ? localStorage : sessionStorage).setItem(PIN_STORAGE_KEY, pin);
}

function verificarAuth() {
  return !!getPinAtual();
}

function exigirLogin(mensagem) {
  const m = document.getElementById("modalPerfilUsuario");
  if (!m) return;
  abrirModalPerfil();
  const btnFechar = document.getElementById("btnFecharPerfil");
  if (btnFechar) btnFechar.classList.add("hidden");
  if (mensagem) {
    const erro = document.getElementById("erroPinPerfil");
    if (erro) {
      erro.textContent = mensagem;
      erro.classList.remove("hidden");
    }
  }
}

function autenticarPIN(e) {
  if (e) e.preventDefault();
  confirmarPerfilUsuario();
}

function logout() {
  if (confirm("Deseja alternar ou sair do perfil neste aparelho?")) {
    abrirModalPerfil();
  }
}

function sairDoAparelho() {
  if (!confirm("Sair deste aparelho? O PIN será esquecido e será pedido de novo. As despesas continuam salvas.")) return;
  localStorage.removeItem(PIN_STORAGE_KEY);
  sessionStorage.removeItem(PIN_STORAGE_KEY);
  exigirLogin();
}

// --------------------------------------------------------------------------
// 2. CARREGAMENTO, RESPONSÁVEIS FINANCEIROS E SINCRONIZAÇÃO EM NUVEM
// --------------------------------------------------------------------------
const RESPONSAVEIS_PADRAO = [
  { id: "EMTEC", nome: "EMTEC (conta da obra)", curto: "EMTEC (Obra)", tipo: "EMPRESA" },
  { id: "MELO", nome: "Melo", curto: "Melo", tipo: "RECURSO_PROPRIO" },
  { id: "PILAR", nome: "Pilar", curto: "Pilar", tipo: "RECURSO_PROPRIO" },
  { id: "ELON", nome: "Elon", curto: "Elon", tipo: "CAIXA_CAMPO" },
  { id: "IAGO", nome: "Iago", curto: "Iago", tipo: "CAIXA_CAMPO" },
  { id: "OUTRO", nome: "Outro", curto: "Outro", tipo: "OUTRO" }
];

function sanearDadosCarregados(dados) {
  if (!dados || !Array.isArray(dados.obras)) return dados;
  if (!Array.isArray(dados.responsaveis)) {
    dados.responsaveis = [];
  }
  for (const obra of dados.obras) {
    if (!obra.status) obra.status = "Em Andamento";
    for (const l of (obra.lancamentos || [])) {
      // Corrige falso positivo histórico: MISTURADOR (ferramenta EQUIP) não é MISTURA (ALIM)
      if (l.id === "pisc-94" && l.tipo === "EQUIP" && l.subtipo === "ALIM" && !l.subtipoManual) {
        l.subtipo = "EQUIP";
      }
      if (!l.reembolsoStatus) {
        l.reembolsoStatus = "NAO_REEMBOLSAVEL";
      }
    }
  }
  return dados;
}

function carregarEstadoLocal() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      if (parsed && Array.isArray(parsed.obras) && parsed.obras.length > 0) {
        return sanearDadosCarregados(parsed);
      }
    }
  } catch (e) {
    console.error("Erro ao carregar localStorage:", e);
  }
  const inicial = JSON.parse(JSON.stringify(window.INITIAL_EMTEC_DATA || { obras: [] }));
  return sanearDadosCarregados(inicial);
}

function getResponsaveis() {
  const custom = Array.isArray(estado?.responsaveis) ? estado.responsaveis : [];
  const mapa = new Map();
  RESPONSAVEIS_PADRAO.forEach(r => mapa.set(r.id, r));
  custom.forEach(r => {
    if (r && r.id && !mapa.has(r.id)) {
      mapa.set(r.id, {
        id: r.id,
        nome: r.nome || r.id,
        curto: r.curto || r.nome || r.id,
        tipo: r.tipo || "RECURSO_PROPRIO"
      });
    }
  });
  return Array.from(mapa.values());
}

function getNomeResponsavel(id) {
  if (!id) return "EMTEC (conta da obra)";
  const r = getResponsaveis().find(x => x.id === id);
  return r ? r.nome : id;
}

function getTipoResponsavel(id) {
  const r = getResponsaveis().find(x => x.id === id);
  if (r) return r.tipo;
  if (id === "EMTEC") return "EMPRESA";
  if (id === "MELO" || id === "PILAR") return "RECURSO_PROPRIO";
  if (id === "ELON" || id === "IAGO") return "CAIXA_CAMPO";
  return "OUTRO";
}

function adicionarNovoResponsavel(nomeBruto, tipoEscolhido = "RECURSO_PROPRIO") {
  const limpo = String(nomeBruto || "").trim();
  if (!limpo) return null;
  const id = limpo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (!id) return null;

  if (!Array.isArray(estado.responsaveis)) estado.responsaveis = [];
  const jaExiste = getResponsaveis().find(r => r.id === id);
  if (!jaExiste) {
    estado.responsaveis.push({
      id,
      nome: limpo,
      curto: limpo.length > 14 ? limpo.slice(0, 14) : limpo,
      tipo: tipoEscolhido
    });
    salvarEstado();
  }
  renderizarControlesResponsaveis();
  atualizarTudo();
  return id;
}

function adicionarNovoResponsavelPrompt() {
  const nome = prompt("Digite o nome do novo responsável financeiro (ex: Engenheiro Auxiliar, Mestre de Obras, Sócio):");
  if (!nome || !nome.trim()) return;
  const isCaixa = confirm(
    `Como "${nome.trim()}" atua na obra?\n\n` +
    `• Clique em OK se for Recursos Próprios (gastos sujeitos a reembolso).\n` +
    `• Clique em Cancelar se for Caixa de Campo / Equipe operacional.`
  );
  const tipo = isCaixa ? "RECURSO_PROPRIO" : "CAIXA_CAMPO";
  const novoId = adicionarNovoResponsavel(nome, tipo);
  if (novoId) {
    selecionarTitularRapido(novoId);
    const selDesk = document.getElementById("lancTitular");
    if (selDesk) {
      selDesk.value = novoId;
      aoMudarQuemPagouDesktop(novoId);
    }
    mostrarNotificacaoToast(`Responsável "${nome.trim()}" adicionado com sucesso!`);
  }
}

function renderizarControlesResponsaveis() {
  const lista = getResponsaveis();

  // 1. Grid de botões de 1 toque no Modal Rápido
  const gridRapido = document.getElementById("gridQuemPagouRapido");
  if (gridRapido) {
    gridRapido.innerHTML = lista.map(r => {
      const ativo = r.id === titularRapidoAtivo;
      const cls = ativo
        ? (r.id === "EMTEC"
            ? "py-2 px-1.5 rounded-xl text-center text-xs font-extrabold transition border-2 border-[#23396B] bg-[#23396B] text-white shadow-xs truncate"
            : "py-2 px-1.5 rounded-xl text-center text-xs font-extrabold transition border-2 border-[#FF8C00] bg-[#FF8C00] text-[#0F172A] shadow-xs truncate")
        : "py-2 px-1.5 rounded-xl text-center text-xs font-bold transition border border-[#CBD5E1] bg-white text-[#23396B] hover:border-[#4395D8] truncate";
      return `<button type="button" id="btnTitRapido_${r.id}" onclick="selecionarTitularRapido('${r.id}')" class="${cls}" title="${r.nome}">${r.curto}</button>`;
    }).join("");
  }

  // 2. Select Desktop (#lancTitular)
  const selDesk = document.getElementById("lancTitular");
  if (selDesk) {
    const valAtual = selDesk.value || "EMTEC";
    selDesk.innerHTML = lista.map(r =>
      `<option value="${r.id}" ${r.id === valAtual ? "selected" : ""}>${r.nome}</option>`
    ).join("");
  }

  // 3. Select Filtro (#filtroTitular)
  const selFiltro = document.getElementById("filtroTitular");
  if (selFiltro) {
    const valFiltro = selFiltro.value || "TODOS";
    selFiltro.innerHTML =
      `<option value="TODOS" ${valFiltro === "TODOS" ? "selected" : ""}>Quem pagou: Todos</option>` +
      `<option value="REEMBOLSO_PENDENTE" ${valFiltro === "REEMBOLSO_PENDENTE" ? "selected" : ""}>Reembolso Pendente</option>` +
      lista.map(r =>
        `<option value="${r.id}" ${r.id === valFiltro ? "selected" : ""}>${r.nome}</option>`
      ).join("");
  }
}

function getPinAtual() {
  return localStorage.getItem(PIN_STORAGE_KEY) || sessionStorage.getItem(PIN_STORAGE_KEY) || "";
}

function temPendencia() {
  return localStorage.getItem(PENDENTE_STORAGE_KEY) === "1";
}

function atualizarBadgeNuvem(status, dataHora) {
  const badgeStatus = document.getElementById("cloudBadgeStatus");
  const badgeHora = document.getElementById("cloudBadgeHora");
  const mobStatus = document.getElementById("cloudBadgeMobStatus");
  const mobHora = document.getElementById("cloudBadgeMobHora");

  let statusHtml = "";
  let horaHtml = "";

  if (status === "syncing") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse"></span><span class="font-bold text-[#FF8C00]">Enviando...</span>`;
    horaHtml = "";
  } else if (status === "success") {
    const hora = dataHora
      ? new Date(dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    statusHtml = `<span class="w-2 h-2 rounded-full bg-[#16A34A]"></span><span class="font-bold text-[#16A34A]">Tudo salvo na nuvem</span>`;
    horaHtml = `Última sincronização: ${hora}`;
  } else if (status === "pending") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse"></span><span class="font-bold text-[#B45309]">Sem sinal: salvo no aparelho</span>`;
    horaHtml = "Será enviado sozinho quando a internet voltar";
  } else if (status === "auth") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="font-bold text-rose-600">PIN inválido</span>`;
    horaHtml = "Entre novamente para sincronizar";
  } else if (status === "offline") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="font-bold text-rose-600">Sem conexão com a nuvem</span>`;
    horaHtml = temPendencia() ? "Alterações guardadas no aparelho, aguardando envio" : "";
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

// --------------------------------------------------------------------------
// SINCRONIZAÇÃO SEGURA
// - Todo salvamento marca "pendência" no aparelho.
// - Nunca se baixa a nuvem por cima dos dados locais: o aparelho ENVIA o que tem
//   e o servidor devolve tudo MESCLADO por registro (id + atualizadoEm).
// - O que foi lançado sem sinal continua guardado e é enviado quando voltar.
// --------------------------------------------------------------------------
let versaoLocal = 0;
let novaSincronizacaoSolicitada = false;
let intervaloSyncAtivo = null;

async function sincronizarComNuvem() {
  if (!verificarAuth()) return;
  if (isSincronizando) {
    novaSincronizacaoSolicitada = true;
    return;
  }
  isSincronizando = true;
  novaSincronizacaoSolicitada = false;
  atualizarBadgeNuvem("syncing");

  const versaoEnviada = versaoLocal;
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-emtec-pin": getPinAtual() },
      body: JSON.stringify(estado),
      cache: "no-store"
    });

    if (res.status === 401) {
      atualizarBadgeNuvem("auth");
      exigirLogin("PIN não confere mais. Digite o PIN novamente.");
      return;
    }
    if (!res.ok) {
      atualizarBadgeNuvem(temPendencia() ? "pending" : "offline");
      return;
    }

    const json = await res.json();
    if (json && json.data && Array.isArray(json.data.obras) && json.data.obras.length > 0) {
      if (versaoEnviada === versaoLocal) {
        // Nada mudou durante o envio: adotar o resultado mesclado (já contém tudo que era local)
        estado = sanearDadosCarregados(json.data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
        localStorage.removeItem(PENDENTE_STORAGE_KEY);
        if (!estado.obras.some(o => o.id === obraAtualId)) {
          obraAtualId = estado.obras[0]?.id || "";
        }
        renderizarSeletorObras();
        atualizarTudo();
      } else {
        // O usuário lançou algo enquanto enviava: não sobrescrever; enviar de novo
        novaSincronizacaoSolicitada = true;
      }
    }
    atualizarBadgeNuvem(temPendencia() || novaSincronizacaoSolicitada ? "syncing" : "success", json.timestamp);
  } catch (err) {
    console.warn("Sincronização falhou (dados seguem salvos no aparelho):", err);
    atualizarBadgeNuvem(temPendencia() ? "pending" : "offline");
  } finally {
    isSincronizando = false;
    if (novaSincronizacaoSolicitada && navigator.onLine !== false) {
      novaSincronizacaoSolicitada = false;
      setTimeout(sincronizarComNuvem, 300);
    }
  }
}

function iniciarSincronizacaoPeriodica() {
  if (intervaloSyncAtivo) return;
  intervaloSyncAtivo = setInterval(sincronizarComNuvem, INTERVALO_SYNC_MS);
}

function salvarEstado() {
  versaoLocal++;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  localStorage.setItem(PENDENTE_STORAGE_KEY, "1");
  if (navigator.onLine === false) {
    atualizarBadgeNuvem("pending");
    return;
  }
  sincronizarComNuvem();
}

// Marca um registro como alterado agora (base da mescla por registro)
function tocar(registro) {
  if (registro) registro.atualizadoEm = new Date().toISOString();
  return registro;
}

// --------------------------------------------------------------------------
// 3. ENGENHARIA FINANCEIRA DE CUSTOS (RESULTADO ACUMULADO & VIABILIDADE)
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

function semAcento(txt) {
  return String(txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

const REGEX_ALIMENTACAO = /\b(ALMOC|JANTA|REFEI|LANCHE|MARMITA|QUENTINHA|VALE ALIMENTA)|\b(CAFE|PAO|PAES|GELO|MISTURA|AGUA MINERAL)\b/;
const REGEX_TRANSPORTE = /\b(GASOLINA|COMBUSTIVEL|ABASTEC|PASSAGE|FRETE|DIESEL|ETANOL|PEDAGIO|ESTACIONAMENTO|OLEO (DA )?MOTO)|\bUBER\b/;
function detectarSubtipo(desc, tipoEscolhido, subtipoManual = "AUTO") {
  if (tipoEscolhido === "ENTRADA_CAIXA") return "CAIXA";
  if (subtipoManual && subtipoManual !== "AUTO") return subtipoManual;
  if (tipoEscolhido === "ALIM" || tipoEscolhido === "TRANSP") return tipoEscolhido;

  const d = semAcento(desc);
  // "MISTURADOR" (equipamento) não é "MISTURA" (alimentação). Palavras inteiras evitam
  // falsos positivos como ANGELO (GELO) ou CAPAO (PAO).
  if (REGEX_ALIMENTACAO.test(d) && !d.includes("MISTURADOR")) return "ALIM";
  if (REGEX_TRANSPORTE.test(d)) return "TRANSP";
  return tipoEscolhido || "OUTROS";
}

// Sugere a categoria pelo que foi digitado (a pessoa só confirma ou troca)
function sugerirCategoriaPorDescricao(desc) {
  const d = semAcento(desc);
  if (d.trim().length < 3) return "";
  if (REGEX_ALIMENTACAO.test(d) && !d.includes("MISTURADOR")) return "OUTROS";
  if (REGEX_TRANSPORTE.test(d)) return "OUTROS";
  if (/\b(DIARIA|DIARIAS|DIARISTA|PEDREIRO|SERVENTE|AJUDANTE|EMPREITA|FOLHA|MAO DE OBRA|ELETRICISTA|ENCANADOR|PINTOR|DEMOLICAO|SALARIO|ADIANTAMENTO)\b/.test(d)) return "MO";
  if (/\b(LOCACAO|ALUGUEL|ANDAIME|CONTEINER|BETONEIRA|MARTELETE|MISTURADOR|REFLETOR)\b/.test(d)) return "EQUIP";
  if (/\b(ART|TAXA|TAXAS|IMPOSTO|COMISSAO|CARTORIO|ALVARA)\b/.test(d)) return "OUTROS";
  if (/\b(CIMENTO|AREIA|BRITA|TIJOLO|BLOCO|CERAMICA|ARGAMASSA|REJUNTE|TINTA|PREGO|TUBO|TUBULACAO|CABO|FIO|MATERIAL|MATERIAIS|PEDRA|TELHA|MADEIRA|FERRO|PARAFUSO|DISCO|AC3|FERRAMENTA|FERRAMENTAS)\b/.test(d)) return "MAT";
  return "";
}
function normalizarTipoOficial(tipoEscolhido) {
  if (tipoEscolhido === "ALIM" || tipoEscolhido === "TRANSP") return "OUTROS";
  return tipoEscolhido;
}

function avaliarSituacaoFinanceira(obra, m) {
  const isConcluida = obra.status === "Concluída";
  if (isConcluida) {
    if (m.saldoAtual >= 0) {
      return {
        codigo: "CONCLUIDA_LUCRO",
        rotulo: `Concluída com Resultado Positivo (${m.margemRealizadaPerc >= 0 ? "+" : ""}${m.margemRealizadaPerc.toFixed(1)}%)`,
        corBadgeDesktop: "bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]",
        corDot: "bg-[#16A34A]",
        corCardDesktop: "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs"
      };
    }
    return {
      codigo: "CONCLUIDA_PREJUIZO",
      rotulo: `Concluída no Vermelho (${formatBRL(m.saldoAtual)})`,
      corBadgeDesktop: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
      corDot: "bg-rose-600",
      corCardDesktop: "rounded-2xl p-4 bg-rose-500/20 border border-rose-400/50 backdrop-blur-xs"
    };
  }

  // Obra em andamento ou pausada: avaliação multicritério rigorosa
  if (m.receitaContratoTotal <= 0 && m.custoTotal > 0) {
    return {
      codigo: "SEM_RECEITA_CADASTRADA",
      rotulo: "Atenção • Sem Receita Contratada",
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#FF8C00]/20 border border-[#FF8C00]/50 backdrop-blur-xs"
    };
  }

  if (!(m.tetoTotal > 0)) {
    return {
      codigo: "SEM_TETO",
      rotulo: "Atenção • Defina o Teto de Custos",
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#FF8C00]/20 border border-[#FF8C00]/50 backdrop-blur-xs"
    };
  }

  if (m.saldoProjetadoFinal < 0) {
    return {
      codigo: "RISCO_PREJUIZO",
      rotulo: `Risco de Prejuízo (${formatBRL(m.saldoProjetadoFinal)} no cenário)`,
      corBadgeDesktop: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
      corDot: "bg-rose-600",
      corCardDesktop: "rounded-2xl p-4 bg-rose-500/20 border border-rose-400/50 backdrop-blur-xs"
    };
  }

  if (m.saldoAtual < 0) {
    return {
      codigo: "RESULTADO_ACUMULADO_NEGATIVO",
      rotulo: "Desembolso Maior que Recebido",
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#FF8C00]/20 border border-[#FF8C00]/50 backdrop-blur-xs"
    };
  }

  if (m.tetoTotal > 0 && m.custoTotalProjetado > m.tetoTotal) {
    return {
      codigo: "VIAVEL_ACIMA_TETO",
      rotulo: `Viável • Acima do Teto (+${m.margemProjetadaFinalPerc.toFixed(1)}% no custo projetado)`,
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs"
    };
  }

  if (m.margemProjetadaFinalPerc < 10) {
    return {
      codigo: "MARGEM_APERTADA",
      rotulo: `Margem Apertada (+${m.margemProjetadaFinalPerc.toFixed(1)}% se gastar o teto)`,
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs"
    };
  }

  return {
    codigo: "OBRA_SAUDAVEL",
    rotulo: `Obra Saudável (+${m.margemProjetadaFinalPerc.toFixed(1)}% se gastar o teto)`,
    corBadgeDesktop: "bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]",
    corDot: "bg-[#16A34A]",
    corCardDesktop: "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs"
  };
}

function arredondarMoeda(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function calcularMetricasObra(obra) {
  if (!obra) return {};
  const saidas = (obra.lancamentos || []).filter(l => !l.deletado && l.movimento !== "ENTRADA_CAIXA");
  const entradasCaixa = (obra.lancamentos || []).filter(l => !l.deletado && l.movimento === "ENTRADA_CAIXA");

  const porTipoOficial = { MAT: 0, MO: 0, EQUIP: 0, OUTROS: 0 };
  const porSubtipoReal = { MAT: 0, MO: 0, EQUIP: 0, ALIM: 0, TRANSP: 0, OUTROS: 0 };
  const porTitular = {};
  const reembolsosPorTitular = {};

  let custoTotal = 0;
  let reembolsosPendentesTotal = 0;
  let reembolsosQuitadosTotal = 0;

  for (const item of saidas) {
    const v = Number(item.valor || 0);
    custoTotal = arredondarMoeda(custoTotal + v);
    const tOf = porTipoOficial[item.tipo] !== undefined ? item.tipo : "OUTROS";
    porTipoOficial[tOf] = arredondarMoeda(porTipoOficial[tOf] + v);

    const sub = item.subtipo || detectarSubtipo(item.descricao, item.tipo, item.subtipoManual);
    if (porSubtipoReal[sub] !== undefined) {
      porSubtipoReal[sub] = arredondarMoeda(porSubtipoReal[sub] + v);
    } else {
      porSubtipoReal.OUTROS = arredondarMoeda(porSubtipoReal.OUTROS + v);
    }

    const tit = item.titular || "EMTEC";
    porTitular[tit] = arredondarMoeda((porTitular[tit] || 0) + v);

    if (!reembolsosPorTitular[tit]) {
      reembolsosPorTitular[tit] = {
        totalPago: 0,
        pagoTotal: 0,
        pendente: 0,
        reembolsado: 0,
        naoReembolsavel: 0,
        qtdTotal: 0,
        qtdPendente: 0,
        qtdReembolsado: 0
      };
    }
    reembolsosPorTitular[tit].totalPago = arredondarMoeda(reembolsosPorTitular[tit].totalPago + v);
    reembolsosPorTitular[tit].pagoTotal = reembolsosPorTitular[tit].totalPago;
    reembolsosPorTitular[tit].qtdTotal += 1;

    const rStatus = item.reembolsoStatus || "NAO_REEMBOLSAVEL";
    if (rStatus === "PENDENTE") {
      reembolsosPendentesTotal = arredondarMoeda(reembolsosPendentesTotal + v);
      reembolsosPorTitular[tit].pendente = arredondarMoeda(reembolsosPorTitular[tit].pendente + v);
      reembolsosPorTitular[tit].qtdPendente += 1;
    } else if (rStatus === "REEMBOLSADO") {
      reembolsosQuitadosTotal = arredondarMoeda(reembolsosQuitadosTotal + v);
      reembolsosPorTitular[tit].reembolsado = arredondarMoeda(reembolsosPorTitular[tit].reembolsado + v);
      reembolsosPorTitular[tit].qtdReembolsado += 1;
    } else {
      reembolsosPorTitular[tit].naoReembolsavel = arredondarMoeda(reembolsosPorTitular[tit].naoReembolsavel + v);
    }
  }

  const totalEntradasCaixa = arredondarMoeda(entradasCaixa.reduce((acc, i) => acc + Number(i.valor || 0), 0));
  const entradasCaixaPorTitular = {};
  for (const ec of entradasCaixa) {
    const tit = ec.titular || "IAGO";
    entradasCaixaPorTitular[tit] = arredondarMoeda((entradasCaixaPorTitular[tit] || 0) + Number(ec.valor || 0));
  }

  let medBrutaTotalContrato = 0;
  let medBrutaRecebida = 0;
  let medLiquidaRecebida = 0;
  let medLiquidaTotalContrato = 0;

  for (const m of (obra.medicoes || []).filter(m => !m.deletado)) {
    const bruto = Number(m.valorBruto || 0);
    const desc = Number(m.descontoNotaPerc ?? obra.aliquotaImposto ?? 7.5);
    const liq = m.valorLiquido ? Number(m.valorLiquido) : arredondarMoeda(bruto * (1 - desc / 100));
    medBrutaTotalContrato = arredondarMoeda(medBrutaTotalContrato + bruto);
    medLiquidaTotalContrato = arredondarMoeda(medLiquidaTotalContrato + liq);
    if (m.status === "Recebida") {
      medBrutaRecebida = arredondarMoeda(medBrutaRecebida + bruto);
      medLiquidaRecebida = arredondarMoeda(medLiquidaRecebida + liq);
    }
  }

  const medLiquidaAReceber = arredondarMoeda(Math.max(0, medLiquidaTotalContrato - medLiquidaRecebida));
  const medBrutaAReceber = arredondarMoeda(Math.max(0, medBrutaTotalContrato - medBrutaRecebida));

  const orc = obra.orcamentoPrevisto || {};
  const tetoTotal = arredondarMoeda(Object.values(orc).reduce((a, b) => a + Number(b || 0), 0));

  // 1. Resultado Acumulado (Realizado até hoje): Receita Líquida Recebida - Despesas Realizadas
  const saldoAtual = arredondarMoeda(medLiquidaRecebida - custoTotal);
  const margemRealizadaPerc = medLiquidaRecebida > 0
    ? (saldoAtual / medLiquidaRecebida) * 100
    : 0;

  // 2. Compromissos Pendentes com Empreiteiros (Contratos em Aberto)
  let saldoEmpreitasPendente = 0;
  let totalEmpreitasContratado = 0;
  let totalEmpreitasPago = 0;
  for (const emp of (obra.empreitas || []).filter(e => !e.deletado)) {
    const contr = Number(emp.valorContratado || 0);
    const pg = Number(emp.valorPago || 0);
    totalEmpreitasContratado = arredondarMoeda(totalEmpreitasContratado + contr);
    totalEmpreitasPago = arredondarMoeda(totalEmpreitasPago + pg);
    saldoEmpreitasPendente = arredondarMoeda(saldoEmpreitasPendente + Math.max(0, contr - pg));
  }

  // Total de pagamentos pendentes de desembolso (Empreitas a pagar + Reembolsos pendentes a devolver)
  const pagamentosPendentesTotal = arredondarMoeda(saldoEmpreitasPendente + reembolsosPendentesTotal);

  // 3. Custos Restantes Estimados para Concluir a Obra (ETC)
  const tetoRestante = arredondarMoeda(Math.max(0, tetoTotal - custoTotal));
  const custoRestanteEstimado = arredondarMoeda(Math.max(0, tetoRestante - saldoEmpreitasPendente));

  // 4. Custo Total Projetado Final na Conclusão (EAC)
  const isEmAndamento = obra.status !== "Concluída";
  const custoTotalProjetado = isEmAndamento
    ? arredondarMoeda(custoTotal + saldoEmpreitasPendente + custoRestanteEstimado)
    : custoTotal;

  const excessoTetoProjetado = tetoTotal > 0 ? arredondarMoeda(Math.max(0, custoTotalProjetado - tetoTotal)) : 0;

  // 5. Receita Total Contratada Líquida
  const receitaContratoTotal = medLiquidaTotalContrato > 0 ? medLiquidaTotalContrato : medLiquidaRecebida;
  const receitaContratoBruta = medBrutaTotalContrato > 0 ? medBrutaTotalContrato : medBrutaRecebida;

  // 6. Lucro se gastar todo o orçamento (cenário de teto, NÃO é previsão de ritmo de gastos)
  const saldoProjetadoFinal = arredondarMoeda(receitaContratoTotal - custoTotalProjetado);
  const margemProjetadaFinalPerc = receitaContratoTotal > 0
    ? (saldoProjetadoFinal / receitaContratoTotal) * 100
    : 0;

  const metricas = {
    qtdSaidas: saidas.length,
    custoTotal,
    porTipoOficial,
    porSubtipoReal,
    porTitular,
    reembolsosPorTitular,
    reembolsosPendentesTotal,
    totalReembolsosPendentes: reembolsosPendentesTotal,
    reembolsosQuitadosTotal,
    totalReembolsado: reembolsosQuitadosTotal,
    totalEntradasCaixa,
    entradasCaixa: totalEntradasCaixa,
    entradasCaixaPorTitular,
    medBrutaTotalContrato,
    medBrutaTotal: medBrutaTotalContrato,
    medBrutaRecebida,
    medBrutaAReceber,
    medLiquidaRecebida,
    medLiquidaTotalContrato,
    medLiquidaTotal: medLiquidaTotalContrato,
    medLiquidaAReceber,
    medLiquidaPendente: medLiquidaAReceber,
    tetoTotal,
    saldoAtual,
    margemRealizadaPerc,
    margemAtualPerc: margemRealizadaPerc,
    totalEmpreitasContratado,
    totalEmpreitasPago,
    saldoEmpreitasPendente,
    pagamentosPendentesTotal,
    custoRestanteEstimado,
    custoTotalProjetado,
    excessoTetoProjetado,
    receitaContratoTotal,
    receitaContratoBruta,
    saldoProjetadoFinal,
    margemProjetadaFinalPerc,
    margemProjetadaPerc: margemProjetadaFinalPerc
  };

  metricas.situacaoFinanceira = avaliarSituacaoFinanceira(obra, metricas);
  metricas.situacao = metricas.situacaoFinanceira;
  return metricas;
}

// --------------------------------------------------------------------------
// 4. ATUALIZAÇÃO GERAL DA INTERFACE (DESKTOP E MOBILE)
// --------------------------------------------------------------------------
function atualizarTudo() {
  const obra = getObraAtual();
  if (!obra) return;
  renderizarControlesResponsaveis();
  const m = calcularMetricasObra(obra);

  const statusOp = obra.status || "Em Andamento";
  const isEmAndamento = statusOp !== "Concluída";
  const sit = m.situacaoFinanceira;

  // Identificação e Header Desktop
  const elObraTitulo = document.getElementById("obraTitulo");
  if (elObraTitulo) elObraTitulo.textContent = obra.nome;

  const elObraClienteTag = document.getElementById("obraClienteTag");
  if (elObraClienteTag) elObraClienteTag.textContent = `${obra.cliente || "CONTRATO"} • INÍCIO ${formatDataBR(obra.dataInicio)}`;

  // Sincronizar seletores de Status Operacional (Desktop e Mobile)
  const selStatusDesk = document.getElementById("selectStatusObraDesktop");
  if (selStatusDesk) selStatusDesk.value = statusOp;
  const selStatusMob = document.getElementById("selectStatusObraMobile");
  if (selStatusMob) selStatusMob.value = statusOp;

  const mobStatusBadge = document.getElementById("mobStatusOperacionalBadge");
  if (mobStatusBadge) {
    mobStatusBadge.textContent = statusOp;
    mobStatusBadge.className = statusOp === "Concluída"
      ? "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#23396B] text-white"
      : (statusOp === "Pausada"
          ? "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
          : "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-[#23396B] border border-slate-300");
  }

  // Selo de Situação Financeira (Informativo, separado do status operacional)
  const badgeViab = document.getElementById("viabilidadeBadge");
  if (badgeViab) {
    badgeViab.className = `inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full border shadow-sm select-none ${sit.corBadgeDesktop}`;
    badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full ${sit.corDot}"></span> ${sit.rotulo}`;
  }

  const mobBadgeViab = document.getElementById("mobViabilidadeBadge");
  if (mobBadgeViab) {
    mobBadgeViab.className = `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold border select-none ${sit.corBadgeDesktop}`;
    mobBadgeViab.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${sit.corDot}"></span> ${sit.rotulo}`;
  }

  // Mobile Hero Card
  const mobObraNome = document.getElementById("mobObraNome");
  if (mobObraNome) mobObraNome.textContent = obra.nome;

  const mobSaldoLabel = document.getElementById("mobSaldoLabel");
  if (mobSaldoLabel) mobSaldoLabel.textContent = isEmAndamento ? "Resultado Acumulado" : "Resultado Acumulado Final";

  const mobMargemRealizadaBadge = document.getElementById("mobMargemRealizadaBadge");
  if (mobMargemRealizadaBadge) {
    if (m.medLiquidaRecebida > 0) {
      mobMargemRealizadaBadge.textContent = `${m.margemRealizadaPerc >= 0 ? "+" : ""}${m.margemRealizadaPerc.toFixed(1)}% margem realizada`;
      mobMargemRealizadaBadge.className = m.saldoAtual >= 0
        ? "text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D]"
        : "text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B]";
    } else {
      mobMargemRealizadaBadge.textContent = "Sem medição recebida";
      mobMargemRealizadaBadge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#64748B]";
    }
  }

  const mobSaldoAtual = document.getElementById("mobSaldoAtual");
  if (mobSaldoAtual) {
    mobSaldoAtual.textContent = formatBRL(m.saldoAtual);
    mobSaldoAtual.className = m.saldoAtual >= 0
      ? "font-display text-2xl sm:text-3xl font-extrabold text-[#16A34A] tracking-tight mt-0.5"
      : "font-display text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight mt-0.5";
  }

  const mobReceitaContratada = document.getElementById("mobReceitaContratada");
  if (mobReceitaContratada) mobReceitaContratada.textContent = formatBRL(m.receitaContratoTotal);

  const mobContratoBrutoSub = document.getElementById("mobContratoBrutoSub");
  if (mobContratoBrutoSub) mobContratoBrutoSub.textContent = `Bruto: ${formatBRL(m.receitaContratoBruta)}`;

  const mobReceitaLiq = document.getElementById("mobReceitaLiq");
  if (mobReceitaLiq) mobReceitaLiq.textContent = formatBRL(m.medLiquidaRecebida);

  const mobAReceberSub = document.getElementById("mobAReceberSub");
  if (mobAReceberSub) {
    mobAReceberSub.textContent = m.medLiquidaAReceber > 0
      ? `A receber: ${formatBRL(m.medLiquidaAReceber)}`
      : "100% recebido em conta";
  }

  const mobCustoReal = document.getElementById("mobCustoReal");
  if (mobCustoReal) mobCustoReal.textContent = formatBRL(m.custoTotal);

  const mobTetoSub = document.getElementById("mobTetoSub");
  if (mobTetoSub) {
    mobTetoSub.textContent = m.tetoTotal > 0
      ? `Teto: ${formatBRL(m.tetoTotal)}`
      : `${m.qtdSaidas} despesas pagas`;
  }

  const mobPagamentosPendentes = document.getElementById("mobPagamentosPendentes");
  if (mobPagamentosPendentes) {
    mobPagamentosPendentes.textContent = formatBRL(m.pagamentosPendentesTotal);
    mobPagamentosPendentes.className = m.pagamentosPendentesTotal > 0
      ? "font-display text-sm font-extrabold text-[#FF8C00] block mt-0.5"
      : "font-display text-sm font-extrabold text-[#16A34A] block mt-0.5";
  }

  const mobPendenciasSub = document.getElementById("mobPendenciasSub");
  if (mobPendenciasSub) {
    mobPendenciasSub.textContent = `Emp: ${formatBRL(m.saldoEmpreitasPendente)} | Reemb: ${formatBRL(m.reembolsosPendentesTotal)}`;
  }

  const mobLucroPrevistoValor = document.getElementById("mobLucroPrevistoValor");
  if (mobLucroPrevistoValor) {
    mobLucroPrevistoValor.textContent = formatBRL(m.saldoProjetadoFinal);
    mobLucroPrevistoValor.className = m.saldoProjetadoFinal >= 0
      ? "font-display text-sm font-extrabold text-[#16A34A]"
      : "font-display text-sm font-extrabold text-rose-600";
  }

  const mobMargemProj = document.getElementById("mobMargemProj");
  if (mobMargemProj) {
    if (isEmAndamento) {
      const notaTeto = m.excessoTetoProjetado > 0 ? ` • Acima do teto em ${formatBRL(m.excessoTetoProjetado)}` : "";
      mobMargemProj.textContent = `${m.margemProjetadaFinalPerc >= 0 ? "+" : ""}${m.margemProjetadaFinalPerc.toFixed(1)}% se gastar o teto${notaTeto}`;
      mobMargemProj.className = m.saldoProjetadoFinal >= 0 ? "font-bold text-[#16A34A]" : "font-bold text-rose-600";
    } else {
      mobMargemProj.textContent = `${m.margemRealizadaPerc >= 0 ? "+" : ""}${m.margemRealizadaPerc.toFixed(1)}% final realizada`;
      mobMargemProj.className = m.saldoAtual >= 0 ? "font-bold text-[#16A34A]" : "font-bold text-rose-600";
    }
  }

  // KPIs Desktop (4 Cartões Executivos Claros e Diferenciados)
  const kpiDescNotaTag = document.getElementById("kpiDescNotaTag");
  if (kpiDescNotaTag) kpiDescNotaTag.textContent = `-${obra.aliquotaImposto ?? 7.5}% NF`;

  const kpiMedLiq = document.getElementById("kpiMedicaoLiquida");
  if (kpiMedLiq) kpiMedLiq.textContent = formatBRL(m.medLiquidaRecebida);

  const kpiMedSub = document.getElementById("kpiMedicaoSub");
  if (kpiMedSub) {
    kpiMedSub.textContent = m.medLiquidaAReceber > 0
      ? `Contratado Líq.: ${formatBRL(m.receitaContratoTotal)} • A receber: ${formatBRL(m.medLiquidaAReceber)}`
      : `Contratado Líq.: ${formatBRL(m.receitaContratoTotal)} (Bruto: ${formatBRL(m.receitaContratoBruta)})`;
  }

  const kpiCustoTotal = document.getElementById("kpiCustoTotal");
  if (kpiCustoTotal) kpiCustoTotal.textContent = formatBRL(m.custoTotal);

  const kpiQtdLanc = document.getElementById("kpiQtdLancamentos");
  if (kpiQtdLanc) kpiQtdLanc.textContent = `${m.qtdSaidas} despesas`;

  const kpiCustoSub = document.getElementById("kpiCustoSub");
  if (kpiCustoSub) {
    kpiCustoSub.textContent = `Pendentes: ${formatBRL(m.pagamentosPendentesTotal)} (Emp: ${formatBRL(m.saldoEmpreitasPendente)} | Reemb: ${formatBRL(m.reembolsosPendentesTotal)})`;
  }

  // KPI 3: Resultado Acumulado (Margem Realizada — corrigido para não misturar com margem projetada!)
  const cardSaldoBox = document.getElementById("cardSaldoBox");
  const cardSaldoLabel = document.getElementById("cardSaldoLabel");
  const kpiSaldoFinal = document.getElementById("kpiSaldoFinal");
  const kpiMargemPerc = document.getElementById("kpiMargemPerc");
  const kpiSaldoSub = document.getElementById("kpiSaldoSub");

  if (cardSaldoBox) cardSaldoBox.className = sit.corCardDesktop;
  if (cardSaldoLabel) cardSaldoLabel.textContent = isEmAndamento ? "Resultado Acumulado" : "Resultado Acumulado Final";
  if (kpiSaldoFinal) kpiSaldoFinal.textContent = formatBRL(m.saldoAtual);

  if (kpiMargemPerc) {
    if (m.medLiquidaRecebida > 0) {
      kpiMargemPerc.textContent = `${m.margemRealizadaPerc >= 0 ? "+" : ""}${m.margemRealizadaPerc.toFixed(1)}% realizada`;
    } else {
      kpiMargemPerc.textContent = "Sem receita recebida";
    }
  }
  if (kpiSaldoSub) {
    kpiSaldoSub.textContent = `Recebido (${formatBRL(m.medLiquidaRecebida)}) − Despesas pagas (${formatBRL(m.custoTotal)})`;
  }

  // KPI 4: Lucro Previsto Final (Margem Projetada)
  const kpiTetoValor = document.getElementById("kpiTetoValor");
  if (kpiTetoValor) kpiTetoValor.textContent = formatBRL(m.saldoProjetadoFinal);

  const badgeTeto = document.getElementById("kpiTetoPercBadge");
  if (badgeTeto) {
    badgeTeto.textContent = `${m.margemProjetadaFinalPerc >= 0 ? "+" : ""}${m.margemProjetadaFinalPerc.toFixed(1)}% no teto`;
    badgeTeto.className = m.saldoProjetadoFinal >= 0
      ? "text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D]"
      : "text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300";
  }

  const kpiTetoSub = document.getElementById("kpiTetoSub");
  if (kpiTetoSub) {
    if (!(m.tetoTotal > 0)) {
      kpiTetoSub.textContent = "Defina o teto de custos para calcular o lucro";
    } else if (m.excessoTetoProjetado > 0) {
      kpiTetoSub.textContent = `Custo proj.: ${formatBRL(m.custoTotalProjetado)} (Acima do teto de ${formatBRL(m.tetoTotal)})`;
    } else {
      kpiTetoSub.textContent = `Custo proj.: ${formatBRL(m.custoTotalProjetado)} | Teto: ${formatBRL(m.tetoTotal)}`;
    }
  }

  // Preencher Select de Empreitas
  const selEmp = document.getElementById("lancEmpreitaId");
  const selEmpRapido = document.getElementById("lancRapidoEmpreitaId");
  const optEmpreitas = `<option value="">Não vinculado a contrato com empreiteiro</option>` +
    (obra.empreitas || []).filter(e => !e.deletado).map(e => {
      const falta = Math.max(0, Number(e.valorContratado) - Number(e.valorPago));
      return `<option value="${e.id}">${e.fornecedor} (Saldo a pagar: ${formatBRL(falta)})</option>`;
    }).join("");

  if (selEmp) selEmp.innerHTML = optEmpreitas;
  if (selEmpRapido) selEmpRapido.innerHTML = optEmpreitas;

  renderizarMiniCards(m);
  renderizarUltimasDespesasHome(obra);
  renderizarReembolsosHome(obra, m);
  renderizarTabelaLancamentos();
  renderizarAbaResumo(obra, m);
  renderizarAbaMedicoes(obra, m);
  renderizarAbaEmpreitasETitulares(obra, m);
}

function renderizarMiniCards(m) {
  const container = document.getElementById("miniCardsCategorias");
  if (!container) return;

  const cards = [
    {
      label: "Material (MAT)",
      val: m.porTipoOficial.MAT,
      sub: "Insumos e materiais",
      dot: "bg-[#23396B]"
    },
    {
      label: "Mão de Obra (MO)",
      val: m.porTipoOficial.MO,
      sub: `Direta: ${formatBRL(m.porSubtipoReal.MO)} | Alim: ${formatBRL(m.porSubtipoReal.ALIM)}`,
      dot: "bg-[#4395D8]"
    },
    {
      label: "Equipamento (EQUIP)",
      val: m.porTipoOficial.EQUIP,
      sub: "Locação e ferramentas",
      dot: "bg-[#FF8C00]"
    },
    {
      label: "Outros (Oficial)",
      val: m.porTipoOficial.OUTROS,
      sub: `Taxas/ART | Comb: ${formatBRL(m.porSubtipoReal.TRANSP)}`,
      dot: "bg-[#6C757D]"
    }
  ];

  container.innerHTML = cards.map(c => `
    <div class="ed-card p-4 hover:border-[#4395D8] transition">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full ${c.dot}"></span>
        <span class="text-xs font-bold uppercase tracking-wider text-[#6C757D]">${c.label}</span>
      </div>
      <div class="font-display text-base sm:text-lg font-extrabold text-[#23396B] mt-1.5">${formatBRL(c.val)}</div>
      <div class="text-xs text-[#6C757D] mt-0.5 truncate" title="${c.sub}">${c.sub}</div>
    </div>
  `).join("");
}

function formatarBadgeReembolso(item, compacto = false) {
  if (item.movimento === "ENTRADA_CAIXA") {
    return `<span class="px-1.5 py-0.5 rounded text-xs font-bold bg-[#16A34A]/15 text-[#14532D]">Adiantamento Caixa</span>`;
  }
  const status = item.reembolsoStatus || "NAO_REEMBOLSAVEL";
  if (status === "PENDENTE") {
    return `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold bg-[#FEF3C7] text-[#B45309] border border-amber-300">
        ⏳ Reembolso Pendente
      </span>
      <button onclick="marcarReembolsoLancamento('${item.id}', 'REEMBOLSADO')"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold bg-[#16A34A] text-white hover:bg-[#15803D] transition shadow-2xs"
        title="Registrar que a empresa já reembolsou este gasto (não duplica a despesa)">
        ✓ Dar baixa
      </button>
    `;
  }
  if (status === "REEMBOLSADO") {
    const dt = item.reembolsadoEm ? ` (${formatDataBR(item.reembolsadoEm)})` : "";
    return `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#14532D] border border-emerald-200">
        ✅ Reembolsado${compacto ? "" : dt}
      </span>
      ${compacto ? "" : `
        <button onclick="marcarReembolsoLancamento('${item.id}', 'PENDENTE')"
          class="text-xs font-semibold text-[#64748B] hover:text-[#23396B] underline">
          Desfazer baixa
        </button>
      `}
    `;
  }
  const tipoResp = getTipoResponsavel(item.titular);
  if (!compacto && tipoResp === "RECURSO_PROPRIO") {
    return `
      <button onclick="marcarReembolsoLancamento('${item.id}', 'PENDENTE')"
        class="text-xs font-semibold text-[#B45309] hover:underline"
        title="Marcar esta despesa como pendente de reembolso">
        + Pedir reembolso
      </button>
    `;
  }
  return "";
}

function marcarReembolsoLancamento(id, novoStatus) {
  const obra = getObraAtual();
  if (!obra) return;
  const item = (obra.lancamentos || []).find(l => l.id === id);
  if (!item) return;

  item.reembolsoStatus = novoStatus;
  if (novoStatus === "REEMBOLSADO") {
    item.reembolsadoEm = new Date().toISOString().split("T")[0];
  } else {
    delete item.reembolsadoEm;
  }
  item.atualizadoEm = new Date().toISOString();

  salvarEstado();
  atualizarTudo();

  if (novoStatus === "REEMBOLSADO") {
    mostrarNotificacaoToast(`Reembolso baixado! (${formatBRL(item.valor)} — ${getNomeResponsavel(item.titular)})`);
  } else if (novoStatus === "PENDENTE") {
    mostrarNotificacaoToast(`Marcado como reembolso pendente (${formatBRL(item.valor)}).`);
  } else {
    mostrarNotificacaoToast(`Status de reembolso atualizado.`);
  }
}

function quitarReembolsosTitular(titularId) {
  const obra = getObraAtual();
  if (!obra) return;
  const pendentes = (obra.lancamentos || []).filter(
    l => !l.deletado && l.movimento !== "ENTRADA_CAIXA" && (l.titular || "EMTEC").toUpperCase() === titularId.toUpperCase() && l.reembolsoStatus === "PENDENTE"
  );
  if (pendentes.length === 0) {
    mostrarNotificacaoToast("Não há reembolsos pendentes para este responsável.");
    return;
  }
  const soma = pendentes.reduce((acc, i) => acc + Number(i.valor || 0), 0);
  const nome = getNomeResponsavel(titularId);
  if (!confirm(`Confirmar baixa de ${pendentes.length} reembolso(s) pendente(s) de ${nome} no valor total de ${formatBRL(soma)}?\n\nIsso marca os gastos como "Já Reembolsados" sem duplicar nenhuma despesa na obra.`)) {
    return;
  }
  const hoje = new Date().toISOString().split("T")[0];
  const agora = new Date().toISOString();
  pendentes.forEach(item => {
    item.reembolsoStatus = "REEMBOLSADO";
    item.reembolsadoEm = hoje;
    item.atualizadoEm = agora;
  });
  salvarEstado();
  atualizarTudo();
  mostrarNotificacaoToast(`Reembolsos de ${nome} (${formatBRL(soma)}) marcados como pagos!`);
}

function filtrarPorResponsavel(filtroValor) {
  mudarAba("lancamentos");
  const sel = document.getElementById("filtroTitular");
  if (sel) {
    sel.value = filtroValor;
    renderizarTabelaLancamentos();
  }
}

function renderizarUltimasDespesasHome(obra) {
  const container = document.getElementById("listaUltimasDespesasHome");
  if (!container) return;

  const lancs = (obra.lancamentos || [])
    .filter(l => !l.deletado && l.movimento !== "ENTRADA_CAIXA")
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
    .slice(0, 6);

  if (lancs.length === 0) {
    container.innerHTML = `
      <div class="py-8 text-center text-xs text-[#64748B] bg-slate-50 rounded-2xl border border-slate-100">
        Nenhuma despesa registrada ainda nesta obra.
      </div>
    `;
    return;
  }

  container.innerHTML = lancs.map(item => {
    const sub = item.subtipo || detectarSubtipo(item.descricao, item.tipo, item.subtipoManual);
    let tagBg = "bg-[#23396B]/10 text-[#23396B]";
    if (item.tipo === "MO") tagBg = "bg-[#4395D8]/15 text-[#23396B]";
    if (item.tipo === "MAT") tagBg = "bg-[#23396B]/15 text-[#23396B]";
    if (item.tipo === "EQUIP") tagBg = "bg-[#FF8C00]/20 text-[#0F172A] font-bold";
    if (sub === "ALIM") tagBg = "bg-[#16A34A]/15 text-[#16A34A]";
    if (sub === "TRANSP") tagBg = "bg-[#002E6E]/15 text-[#002E6E]";

    const nomePagador = getNomeResponsavel(item.titular);
    const badgeReemb = formatarBadgeReembolso(item, true);

    return `
      <div class="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#4395D8] transition shadow-xs space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 flex-wrap min-w-0">
            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${tagBg}">${item.tipo}${sub !== item.tipo ? ` • ${sub}` : ""}</span>
            <span class="text-xs text-[#64748B] font-semibold">${formatDataBR(item.data)}</span>
            <span class="text-xs font-bold text-[#23396B]">• Pago por: ${nomePagador}</span>
          </div>
          <span class="font-display text-base font-extrabold text-[#23396B] shrink-0">${formatBRL(item.valor)}</span>
        </div>

        <div class="font-bold text-xs sm:text-sm text-[#0F172A] leading-snug break-words">
          ${item.descricao}
        </div>

        <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 flex-wrap">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${badgeReemb}
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <button onclick="abrirEdicaoRapida('${item.id}')" class="text-xs font-bold text-[#4395D8] px-2 py-0.5 rounded-lg hover:bg-blue-50 transition">Editar</button>
            <button onclick="excluirLancamento('${item.id}')" class="text-xs font-semibold text-rose-600 px-2 py-0.5 rounded-lg hover:bg-rose-50 transition">Excluir</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderizarReembolsosHome(obra, m) {
  const container = document.getElementById("listaReembolsosHome");
  if (!container) return;

  const stats = m.reembolsosPorTitular || {};
  const mPilar = stats.PILAR || { pagoTotal: 0, pendente: 0, reembolsado: 0, qtdPendente: 0, qtdTotal: 0 };
  const mMelo = stats.MELO || { pagoTotal: 0, pendente: 0, reembolsado: 0, qtdPendente: 0, qtdTotal: 0 };
  const mEmtec = stats.EMTEC || { pagoTotal: 0 };

  const gastosCampo = (obra.lancamentos || [])
    .filter(l => !l.deletado && l.movimento !== "ENTRADA_CAIXA" && (l.titular === "ELON" || l.titular === "IAGO"))
    .reduce((acc, l) => acc + Number(l.valor || 0), 0);

  container.innerHTML = `
    <!-- 1. Recursos Próprios: Pilar -->
    <div class="p-3.5 rounded-2xl bg-white border ${mPilar.pendente > 0 ? "border-[#FF8C00] bg-[#FF8C00]/5" : "border-slate-200"} space-y-2 transition">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-full bg-[#FF8C00] text-[#0F172A] font-extrabold text-xs flex items-center justify-center shrink-0">P</span>
          <div>
            <span class="font-display font-extrabold text-xs sm:text-sm text-[#23396B]">Pilar (Recursos Próprios)</span>
            <span class="text-xs text-[#64748B] block">Total pago na obra: <strong>${formatBRL(mPilar.pagoTotal)}</strong> (${mPilar.qtdTotal} lanç.)</span>
          </div>
        </div>
        <div class="text-right">
          <div class="font-display text-base font-extrabold ${mPilar.pendente > 0 ? "text-[#B45309]" : "text-[#16A34A]"}">${formatBRL(mPilar.pendente)}</div>
          <span class="text-xs font-bold ${mPilar.pendente > 0 ? "text-[#B45309]" : "text-[#16A34A]"}">
            ${mPilar.pendente > 0 ? `${mPilar.qtdPendente} reembolso(s) pendente(s)` : "Sem reembolso pendente"}
          </span>
        </div>
      </div>
      <div class="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/70 flex-wrap gap-2">
        <span class="text-[#64748B]">Já reembolsado: <strong class="text-[#16A34A]">${formatBRL(mPilar.reembolsado)}</strong></span>
        <div class="flex items-center gap-2">
          <button onclick="filtrarPorResponsavel('PILAR')" class="text-xs font-bold text-[#4395D8] hover:underline">Ver gastos</button>
          ${mPilar.pendente > 0 ? `
            <button onclick="quitarReembolsosTitular('PILAR')" class="px-2.5 py-1 rounded-lg bg-[#16A34A] text-white text-xs font-extrabold hover:bg-[#15803D] transition">
              ✓ Dar baixa (${formatBRL(mPilar.pendente)})
            </button>
          ` : ""}
        </div>
      </div>
    </div>

    <!-- 2. Recursos Próprios: Melo -->
    <div class="p-3.5 rounded-2xl bg-white border ${mMelo.pendente > 0 ? "border-[#FF8C00] bg-[#FF8C00]/5" : "border-slate-200"} space-y-2 transition">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-full bg-[#23396B] text-white font-extrabold text-xs flex items-center justify-center shrink-0">M</span>
          <div>
            <span class="font-display font-extrabold text-xs sm:text-sm text-[#23396B]">Melo (Recursos Próprios)</span>
            <span class="text-xs text-[#64748B] block">Total pago na obra: <strong>${formatBRL(mMelo.pagoTotal)}</strong> (${mMelo.qtdTotal} lanç.)</span>
          </div>
        </div>
        <div class="text-right">
          <div class="font-display text-base font-extrabold ${mMelo.pendente > 0 ? "text-[#B45309]" : "text-[#16A34A]"}">${formatBRL(mMelo.pendente)}</div>
          <span class="text-xs font-bold ${mMelo.pendente > 0 ? "text-[#B45309]" : "text-[#16A34A]"}">
            ${mMelo.pendente > 0 ? `${mMelo.qtdPendente} reembolso(s) pendente(s)` : "Sem reembolso pendente"}
          </span>
        </div>
      </div>
      <div class="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/70 flex-wrap gap-2">
        <span class="text-[#64748B]">Já reembolsado: <strong class="text-[#16A34A]">${formatBRL(mMelo.reembolsado)}</strong></span>
        <div class="flex items-center gap-2">
          <button onclick="filtrarPorResponsavel('MELO')" class="text-xs font-bold text-[#4395D8] hover:underline">Ver gastos</button>
          ${mMelo.pendente > 0 ? `
            <button onclick="quitarReembolsosTitular('MELO')" class="px-2.5 py-1 rounded-lg bg-[#16A34A] text-white text-xs font-extrabold hover:bg-[#15803D] transition">
              ✓ Dar baixa (${formatBRL(mMelo.pendente)})
            </button>
          ` : ""}
        </div>
      </div>
    </div>

    <!-- 3. Conta da Empresa vs Caixa de Campo -->
    <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-bold text-[#23396B]">EMTEC (Conta da Obra):</span>
        <strong class="font-display text-sm text-[#23396B]">${formatBRL(mEmtec.pagoTotal)}</strong>
      </div>
      <div class="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
        <div>
          <span class="font-bold text-[#0F172A] block">Caixa de Campo (Elon / Iago):</span>
          <span class="text-xs text-[#64748B]">Adiantado ao campo: ${formatBRL(m.entradasCaixa)}</span>
        </div>
        <div class="text-right">
          <strong class="font-display text-sm text-[#0F172A] block">${formatBRL(gastosCampo)}</strong>
          <span class="text-xs text-[#64748B]">Comprovado em despesas</span>
        </div>
      </div>
    </div>
  `;
}

// --------------------------------------------------------------------------
// 5. TABELA DE LANÇAMENTOS E FILTROS (Cards Mobile / Tabela Desktop)
// --------------------------------------------------------------------------
function renderizarTabelaLancamentos() {
  const obra = getObraAtual();
  const busca = (document.getElementById("filtroBusca")?.value || "").toLowerCase().trim();
  const cat = document.getElementById("filtroCategoria")?.value || "TODOS";
  const tit = document.getElementById("filtroTitular")?.value || "TODOS";

  let filtrados = (obra.lancamentos || []).filter(item => {
    if (item.deletado) return false;
    if (busca) {
      const descMatch = (item.descricao || "").toLowerCase().includes(busca);
      const pagMatch = (item.pagamento || "").toLowerCase().includes(busca);
      const titMatch = getNomeResponsavel(item.titular).toLowerCase().includes(busca) || (item.titular || "").toLowerCase().includes(busca);
      if (!descMatch && !pagMatch && !titMatch) return false;
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
    if (tit !== "TODOS") {
      if (tit === "REEMBOLSO_PENDENTE") {
        if (item.reembolsoStatus !== "PENDENTE") return false;
      } else if ((item.titular || "EMTEC").toUpperCase() !== tit.toUpperCase()) {
        return false;
      }
    }
    return true;
  });

  // Ordem decrescente por data (mais recente no topo)
  filtrados.sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const totalFiltrado = filtrados
    .filter(i => i.movimento !== "ENTRADA_CAIXA")
    .reduce((acc, i) => acc + Number(i.valor || 0), 0);

  const elTotalFiltrado = document.getElementById("totalFiltradoValor");
  if (elTotalFiltrado) elTotalFiltrado.textContent = formatBRL(totalFiltrado);

  const containerMob = document.getElementById("cardsLancamentosMobile");
  const tbody = document.getElementById("tbodyLancamentos");

  if (filtrados.length === 0) {
    const emptyHtml = `
      <div class="py-8 text-center text-xs text-[#64748B] bg-slate-50 rounded-2xl border border-slate-100">
        Nenhuma despesa encontrada para os filtros selecionados.
      </div>
    `;
    if (containerMob) containerMob.innerHTML = emptyHtml;
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-[#64748B]">${emptyHtml}</td></tr>`;
    return;
  }

  // 1. Renderização Exclusiva para Mobile (Cards Nativos com Zero Overflow)
  if (containerMob) {
    containerMob.innerHTML = filtrados.map(item => {
      const isEntrada = item.movimento === "ENTRADA_CAIXA";
      const sub = item.subtipo || detectarSubtipo(item.descricao, item.tipo, item.subtipoManual);

      let tagBg = "bg-[#23396B]/10 text-[#23396B]";
      if (item.tipo === "MO") tagBg = "bg-[#4395D8]/15 text-[#23396B]";
      if (item.tipo === "MAT") tagBg = "bg-[#23396B]/15 text-[#23396B]";
      if (item.tipo === "EQUIP") tagBg = "bg-[#FF8C00]/20 text-[#0F172A] font-bold";
      if (sub === "ALIM") tagBg = "bg-[#16A34A]/15 text-[#16A34A]";
      if (sub === "TRANSP") tagBg = "bg-[#002E6E]/15 text-[#002E6E]";
      if (isEntrada) tagBg = "bg-[#16A34A]/20 text-[#14532D] font-bold";

      const labelTipo = isEntrada ? "ADIANTAMENTO DE CAIXA" : `${item.tipo}${sub !== item.tipo ? ` (${sub})` : ""}`;
      const nomePagador = getNomeResponsavel(item.titular);
      const badgeReemb = formatarBadgeReembolso(item, false);

      return `
        <div class="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-2.5">
          <!-- Linha 1: Categoria na Esquerda | VALOR COMPLETO em Destaque na Direita -->
          <div class="flex items-center justify-between gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold ${tagBg} uppercase tracking-wide shrink-0">
              ${labelTipo}
            </span>
            <span class="font-display text-base sm:text-lg font-extrabold ${isEntrada ? "text-[#16A34A]" : "text-[#23396B]"} tracking-tight shrink-0">
              ${isEntrada ? "+" : ""}${formatBRL(item.valor)}
            </span>
          </div>

          <!-- Linha 2: Descrição com 100% de Largura (Nunca Trunca) -->
          <div class="font-bold text-sm text-[#0F172A] leading-snug break-words">
            ${item.descricao}
          </div>

          <!-- Linha 3: Metadados (Data, Pagamento, Quem Pagou) -->
          <div class="flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
            <span>${formatDataBR(item.data)}</span>
            <span>•</span>
            <span>${item.pagamento || "PIX"}</span>
            <span>•</span>
            <span class="font-bold text-[#23396B]">Quem pagou: ${nomePagador}</span>
            ${item.empreitaId ? `<span class="text-[#FF8C00] font-bold">• Empreita</span>` : ""}
          </div>

          <!-- Linha 4: Controle de Reembolso + Botões de Ação Touch -->
          <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
            <div class="flex items-center gap-1.5 flex-wrap">
              ${badgeReemb}
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <button onclick="editarLancamento('${item.id}')"
                class="inline-flex items-center gap-1 text-xs font-bold text-[#4395D8] px-3 py-1.5 rounded-xl bg-blue-50 active:bg-blue-100 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                <span>Editar</span>
              </button>
              <button onclick="excluirLancamento('${item.id}')"
                class="inline-flex items-center gap-1 text-xs font-bold text-rose-600 px-3 py-1.5 rounded-xl bg-rose-50 active:bg-rose-100 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // ---- Renderização em TABELA para desktop ----
  tbody.innerHTML = filtrados.map(item => {
    const isEntrada = item.movimento === "ENTRADA_CAIXA";
    const sub = item.subtipo || detectarSubtipo(item.descricao, item.tipo, item.subtipoManual);

    let tagCor = "bg-[#23396B]/10 text-[#23396B]";
    if (item.tipo === "MO") tagCor = "bg-[#4395D8]/15 text-[#23396B]";
    if (item.tipo === "MAT") tagCor = "bg-[#23396B]/15 text-[#23396B]";
    if (item.tipo === "EQUIP") tagCor = "bg-[#FF8C00]/20 text-[#0F172A] font-bold";
    if (sub === "ALIM") tagCor = "bg-[#16A34A]/15 text-[#16A34A]";
    if (sub === "TRANSP") tagCor = "bg-[#002E6E]/15 text-[#002E6E]";

    const nomePagador = getNomeResponsavel(item.titular);
    const badgeReemb = formatarBadgeReembolso(item, false);

    return `
      <tr class="hover:bg-[#F8F9FA] transition border-b border-[#DEE2E6]">
        <td class="py-3 px-3 text-xs font-semibold text-[#6C757D] whitespace-nowrap">${formatDataBR(item.data)}</td>
        <td class="py-3 px-3">
          <div class="font-bold text-xs sm:text-sm text-[#23396B]">${item.descricao}</div>
          <div class="text-xs text-[#6C757D] flex flex-wrap items-center gap-2 mt-1">
            <span>${item.pagamento || "PIX"}</span>
            <span>•</span>
            <span class="font-bold text-[#23396B]">Quem pagou: ${nomePagador}</span>
            ${item.empreitaId ? `<span class="text-[#FF8C00] font-bold">• Empreita</span>` : ""}
            ${badgeReemb}
          </div>
        </td>
        <td class="py-3 px-3 whitespace-nowrap">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${tagCor}">
            ${isEntrada ? "ADIANTAMENTO" : `${item.tipo} ${sub !== item.tipo ? `(${sub})` : ""}`}
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
// 6. LANÇAMENTO RÁPIDO E DETECTOR DE DUPLICIDADES
// --------------------------------------------------------------------------
function aplicarSugestaoRapida(descricao, tipo, subtipo) {
  const descInput = document.getElementById("lancRapidoDescricao");
  if (descInput) descInput.value = descricao;

  selecionarCategoriaRapida(tipo);
  const selSub = document.getElementById("lancRapidoSubtipo");
  if (selSub) selSub.value = "AUTO";
  atualizarPreviewSubtipoRapido();
  checarDuplicidadeAoDigitar();

  const valInput = document.getElementById("lancRapidoValor");
  if (valInput) valInput.focus();
}

function checarDuplicidadeAoDigitar() {
  sugerirCategoriaRapida();
  atualizarPreviewSubtipoRapido();

  const aviso = document.getElementById("avisoDuplicidadeRapido");
  const texto = document.getElementById("textoDuplicidadeRapido");
  if (!aviso || !texto) return;

  const idEdicao = document.getElementById("lancRapidoIdEdicao")?.value;
  const rawVal = String(document.getElementById("lancRapidoValor")?.value || "").replace(",", ".");
  const valor = parseFloat(rawVal);
  const desc = (document.getElementById("lancRapidoDescricao")?.value || "").toLowerCase().trim();

  if (isNaN(valor) || valor <= 0) {
    aviso.classList.add("hidden");
    return;
  }

  const obra = getObraAtual();
  const match = (obra.lancamentos || []).find(l => {
    if (l.deletado || l.movimento === "ENTRADA_CAIXA") return false;
    if (idEdicao && l.id === idEdicao) return false;

    const mesmoValor = Math.abs(Number(l.valor) - valor) < 0.01;
    const descSimilar = desc.length >= 4 && (l.descricao || "").toLowerCase().includes(desc);

    return mesmoValor || (descSimilar && Math.abs(Number(l.valor) - valor) < 5.00);
  });

  if (match) {
    texto.textContent = `Já existe despesa de ${formatBRL(match.valor)} ("${match.descricao}") em ${formatDataBR(match.data)} paga por ${getNomeResponsavel(match.titular)}. Verifique se não é repetição.`;
    aviso.classList.remove("hidden");
  } else {
    aviso.classList.add("hidden");
  }
}

function obterRotuloSubtipo(sub) {
  if (sub === "ALIM") return "Alimentação de Equipe (ALIM)";
  if (sub === "TRANSP") return "Combustível / Transporte (TRANSP)";
  if (sub === "MAT") return "Material (MAT)";
  if (sub === "MO") return "Mão de Obra Direta (MO)";
  if (sub === "EQUIP") return "Equipamento (EQUIP)";
  if (sub === "OUTROS") return "Outros / Taxas (OUTROS)";
  return sub || "Padrão";
}

function atualizarPreviewSubtipoRapido() {
  const hint = document.getElementById("badgeSubtipoDetectadoRapido");
  if (!hint) return;
  const desc = document.getElementById("lancRapidoDescricao")?.value || "";
  const subManual = document.getElementById("lancRapidoSubtipo")?.value || "AUTO";
  const tipo = categoriaRapidaAtiva || "OUTROS";
  const detectado = detectarSubtipo(desc, tipo, subManual);

  if (subManual && subManual !== "AUTO") {
    hint.textContent = `Subcategoria manual: ${obterRotuloSubtipo(detectado)}`;
    hint.className = "text-xs font-bold text-[#FF8C00]";
  } else if (detectado === "ALIM" || detectado === "TRANSP") {
    hint.textContent = `Auto: ${obterRotuloSubtipo(detectado)}`;
    hint.className = "text-xs font-bold text-[#16A34A]";
  } else if (categoriaRapidaAtiva) {
    hint.textContent = `Subcategoria: ${obterRotuloSubtipo(detectado)}`;
    hint.className = "text-xs font-semibold text-[#4395D8]";
  } else {
    hint.textContent = "Classificação automática";
    hint.className = "text-xs font-bold text-[#4395D8]";
  }
}

function abrirModalLancamentoRapido() {
  const modal = document.getElementById("modalLancamentoRapido");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  // Reset do modo edição para novo lançamento
  const idEd = document.getElementById("lancRapidoIdEdicao");
  if (idEd) idEd.value = "";

  const titModal = document.getElementById("modalLancRapidoTitulo");
  if (titModal) titModal.textContent = "Registrar Despesa";

  const btnTexto = document.getElementById("btnSalvarLancRapidoTexto");
  if (btnTexto) btnTexto.textContent = "Salvar Despesa Agora";

  const aviso = document.getElementById("avisoDuplicidadeRapido");
  if (aviso) aviso.classList.add("hidden");

  const hoje = new Date().toISOString().split("T")[0];
  const inputData = document.getElementById("lancRapidoData");
  if (inputData) inputData.value = hoje;

  const selSub = document.getElementById("lancRapidoSubtipo");
  if (selSub) selSub.value = "AUTO";

  // Seleciona EMTEC por padrão em 1 toque (sem reembolso)
  selecionarTitularRapido("EMTEC", false);
  selecionarStatusReembolsoRapido("NAO_REEMBOLSAVEL");

  // Categoria é sugerida pela descrição (ou escolhida em 1 toque); começa sem escolha
  categoriaRapidaAtiva = "";
  categoriaRapidaManual = false;
  ["MO", "MAT", "EQUIP", "OUTROS"].forEach(cat => {
    const btn = document.getElementById(`btnCatRapida_${cat}`);
    if (btn) btn.className = "py-2 px-1 rounded-xl text-center text-xs font-bold uppercase transition border border-[#CBD5E1] bg-white text-[#23396B] hover:border-[#4395D8]";
  });
  const avisoCat = document.getElementById("avisoCategoriaObrigatoria");
  if (avisoCat) avisoCat.classList.add("hidden");

  // Recolhe as opções opcionais (Subcategoria manual, Data, Empreiteiro)
  const opcoesAv = document.getElementById("opcoesAvancadasRapidas");
  const iconeAv = document.getElementById("iconeOpcoesAvancadasRapidas");
  if (opcoesAv) opcoesAv.classList.add("hidden");
  if (iconeAv) iconeAv.textContent = "+";

  const inputValor = document.getElementById("lancRapidoValor");
  if (inputValor) {
    inputValor.value = "";
    setTimeout(() => inputValor.focus(), 150);
  }
  const inputDesc = document.getElementById("lancRapidoDescricao");
  if (inputDesc) inputDesc.value = "";
  atualizarPreviewSubtipoRapido();
}

function abrirEdicaoRapida(id) {
  const obra = getObraAtual();
  const item = (obra.lancamentos || []).find(l => l.id === id);
  if (!item) return;

  const modal = document.getElementById("modalLancamentoRapido");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const titModal = document.getElementById("modalLancRapidoTitulo");
  if (titModal) titModal.textContent = "Editar Despesa";

  const btnTexto = document.getElementById("btnSalvarLancRapidoTexto");
  if (btnTexto) btnTexto.textContent = "Salvar Alterações";

  const idEd = document.getElementById("lancRapidoIdEdicao");
  if (idEd) idEd.value = item.id;

  const inputValor = document.getElementById("lancRapidoValor");
  if (inputValor) inputValor.value = item.valor;

  const inputDesc = document.getElementById("lancRapidoDescricao");
  if (inputDesc) inputDesc.value = item.descricao;

  const inputData = document.getElementById("lancRapidoData");
  if (inputData) inputData.value = item.data;

  // Preserva quem pagou e status de reembolso reais do lançamento
  selecionarTitularRapido(item.titular || "EMTEC", true);
  selecionarStatusReembolsoRapido(item.reembolsoStatus || "NAO_REEMBOLSAVEL");

  const selPag = document.getElementById("lancRapidoPagamento");
  if (selPag) selPag.value = item.pagamento || "PIX";

  const selEmp = document.getElementById("lancRapidoEmpreitaId");
  if (selEmp) selEmp.value = item.empreitaId || "";

  const selSub = document.getElementById("lancRapidoSubtipo");
  if (selSub) {
    if (item.subtipoManual && item.subtipoManual !== "AUTO") {
      selSub.value = item.subtipoManual;
    } else {
      const autoSub = detectarSubtipo(item.descricao, item.tipo, "AUTO");
      selSub.value = (item.subtipo && item.subtipo !== autoSub) ? item.subtipo : "AUTO";
    }
  }

  selecionarCategoriaRapida(item.tipo);
  atualizarPreviewSubtipoRapido();

  const aviso = document.getElementById("avisoDuplicidadeRapido");
  if (aviso) aviso.classList.add("hidden");

  if (inputValor) setTimeout(() => inputValor.focus(), 150);
}

function fecharModalLancamentoRapido() {
  const modal = document.getElementById("modalLancamentoRapido");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

let titularRapidoAtivo = "EMTEC";
let statusReembolsoRapidoAtivo = "NAO_REEMBOLSAVEL";

function selecionarTitularRapido(titular, preservarReembolso = false) {
  if (!titular) titular = "EMTEC";
  titularRapidoAtivo = titular.toUpperCase();
  const inputTit = document.getElementById("lancRapidoTitular");
  if (inputTit) inputTit.value = titularRapidoAtivo;

  const todosResp = getResponsaveis();
  todosResp.forEach(r => {
    const btn = document.getElementById(`btnTitRapido_${r.id}`);
    if (!btn) return;
    if (r.id === titularRapidoAtivo) {
      if (r.id === "EMTEC") {
        btn.className = "py-2 px-1.5 rounded-xl text-center text-xs font-extrabold transition border-2 border-[#23396B] bg-[#23396B] text-white shadow-xs truncate";
      } else {
        btn.className = "py-2 px-1.5 rounded-xl text-center text-xs font-extrabold transition border-2 border-[#FF8C00] bg-[#FF8C00] text-[#0F172A] shadow-xs truncate";
      }
    } else {
      btn.className = "py-2 px-1.5 rounded-xl text-center text-xs font-bold transition border border-[#CBD5E1] bg-white text-[#23396B] hover:border-[#4395D8] truncate";
    }
  });

  if (!preservarReembolso) {
    const tipoResp = getTipoResponsavel(titularRapidoAtivo);
    if (tipoResp === "RECURSO_PROPRIO") {
      selecionarStatusReembolsoRapido("PENDENTE");
    } else {
      selecionarStatusReembolsoRapido("NAO_REEMBOLSAVEL");
    }
  }
}

function selecionarStatusReembolsoRapido(status) {
  if (!status) status = "NAO_REEMBOLSAVEL";
  statusReembolsoRapidoAtivo = status;
  const inputReemb = document.getElementById("lancRapidoReembolsoStatus");
  if (inputReemb) inputReemb.value = status;

  const opcoes = [
    { id: "NAO_REEMBOLSAVEL", activeCls: "py-1.5 px-1.5 rounded-xl text-xs font-extrabold border-2 border-[#23396B] bg-[#23396B] text-white transition" },
    { id: "PENDENTE", activeCls: "py-1.5 px-1.5 rounded-xl text-xs font-extrabold border-2 border-[#FF8C00] bg-[#FF8C00] text-[#0F172A] transition" },
    { id: "REEMBOLSADO", activeCls: "py-1.5 px-1.5 rounded-xl text-xs font-extrabold border-2 border-[#16A34A] bg-[#16A34A] text-white transition" }
  ];

  opcoes.forEach(op => {
    const btn = document.getElementById(`btnReembRapido_${op.id}`);
    if (!btn) return;
    if (op.id === status) {
      btn.className = op.activeCls;
    } else {
      btn.className = "py-1.5 px-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-[#64748B] transition";
    }
  });
}

let categoriaRapidaManual = false;

function sugerirCategoriaRapida() {
  if (categoriaRapidaManual) return;
  const desc = document.getElementById("lancRapidoDescricao")?.value || "";
  const sug = sugerirCategoriaPorDescricao(desc);
  if (sug && sug !== categoriaRapidaAtiva) selecionarCategoriaRapida(sug, false);
}

function selecionarCategoriaRapida(tipo, manual = true) {
  categoriaRapidaAtiva = tipo;
  if (manual) categoriaRapidaManual = true;
  ["MO", "MAT", "EQUIP", "OUTROS"].forEach(cat => {
    const btn = document.getElementById(`btnCatRapida_${cat}`);
    if (!btn) return;
    if (cat === tipo) {
      btn.className = "py-2 px-1 rounded-xl text-center text-xs font-extrabold uppercase transition border-2 border-[#23396B] bg-[#23396B] text-white shadow-xs";
    } else {
      btn.className = "py-2 px-1 rounded-xl text-center text-xs font-bold uppercase transition border border-[#CBD5E1] bg-white text-[#23396B] hover:border-[#4395D8]";
    }
  });
  const avisoCat = document.getElementById("avisoCategoriaObrigatoria");
  if (avisoCat) avisoCat.classList.add("hidden");
  atualizarPreviewSubtipoRapido();
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

  const idEdicao = document.getElementById("lancRapidoIdEdicao")?.value;
  const valorInput = document.getElementById("lancRapidoValor");
  const descInput = document.getElementById("lancRapidoDescricao");
  const dataInput = document.getElementById("lancRapidoData");
  const titSelect = document.getElementById("lancRapidoTitular");
  const reembSelect = document.getElementById("lancRapidoReembolsoStatus");
  const subManualSelect = document.getElementById("lancRapidoSubtipo");
  const pagSelect = document.getElementById("lancRapidoPagamento");
  const empSelect = document.getElementById("lancRapidoEmpreitaId");

  const rawVal = String(valorInput?.value || "").replace(",", ".");
  const valor = parseFloat(rawVal);
  const descricao = (descInput?.value || "").trim();
  const data = dataInput?.value || new Date().toISOString().split("T")[0];
  const titular = (titSelect?.value || titularRapidoAtivo || "EMTEC").toUpperCase();
  const reembolsoStatus = reembSelect?.value || statusReembolsoRapidoAtivo || "NAO_REEMBOLSAVEL";
  const subtipoManual = subManualSelect?.value || "AUTO";
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

  if (!categoriaRapidaAtiva) {
    const avisoCat = document.getElementById("avisoCategoriaObrigatoria");
    if (avisoCat) avisoCat.classList.remove("hidden");
    alert("Por favor, selecione uma categoria para a despesa (Mão de Obra, Material, Equipamento ou Outros).");
    return;
  }

  const subtipo = detectarSubtipo(descricao, categoriaRapidaAtiva, subtipoManual);
  const hoje = new Date().toISOString().split("T")[0];

  if (idEdicao) {
    const idx = obra.lancamentos.findIndex(l => l.id === idEdicao);
    if (idx !== -1) {
      const anterior = obra.lancamentos[idx];
      obra.lancamentos[idx] = {
        ...anterior,
        descricao,
        tipo: categoriaRapidaAtiva,
        subtipo,
        subtipoManual: subtipoManual !== "AUTO" ? subtipoManual : undefined,
        valor,
        data,
        pagamento,
        titular,
        reembolsoStatus,
        reembolsadoEm: reembolsoStatus === "REEMBOLSADO" ? (anterior.reembolsadoEm || hoje) : undefined,
        empreitaId: empreitaId || undefined,
        atualizadoEm: new Date().toISOString()
      };
    }
    mostrarNotificacaoToast(`Despesa atualizada com sucesso!`);
  } else {
    const novo = {
      id: "lanc-" + Date.now(),
      descricao,
      tipo: categoriaRapidaAtiva,
      subtipo,
      subtipoManual: subtipoManual !== "AUTO" ? subtipoManual : undefined,
      valor,
      data,
      dataOriginal: data,
      pagamento,
      titular,
      reembolsoStatus,
      reembolsadoEm: reembolsoStatus === "REEMBOLSADO" ? hoje : undefined,
      movimento: "SAIDA",
      empreitaId: empreitaId || undefined,
      atualizadoEm: new Date().toISOString()
    };

    if (!obra.lancamentos) obra.lancamentos = [];
    obra.lancamentos.unshift(novo);

    if (empreitaId && obra.empreitas) {
      const emp = obra.empreitas.find(e => e.id === empreitaId);
      if (emp) {
        emp.valorPago = Number(emp.valorPago || 0) + valor;
        tocar(emp);
      }
    }
    mostrarNotificacaoToast(`Despesa de ${formatBRL(valor)} salva (${getNomeResponsavel(titular)})!`);
  }

  salvarEstado();
  atualizarTudo();
  fecharModalLancamentoRapido();

  if (valorInput) valorInput.value = "";
  if (descInput) descInput.value = "";
  const idEdFinal = document.getElementById("lancRapidoIdEdicao");
  if (idEdFinal) idEdFinal.value = "";

  if (navigator.vibrate) navigator.vibrate(40);
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
function aoMudarQuemPagouDesktop() {
  const tit = document.getElementById("lancTitular")?.value || "EMTEC";
  const selReemb = document.getElementById("lancReembolsoStatus");
  if (!selReemb) return;
  if (getTipoResponsavel(tit) === "RECURSO_PROPRIO") {
    selReemb.value = "PENDENTE";
  } else {
    selReemb.value = "NAO_REEMBOLSAVEL";
  }
}

function atualizarPreviewSubtipoDesktop() {
  const hint = document.getElementById("hintSubtipoDesktop");
  if (!hint) return;
  const desc = document.getElementById("lancDescricao")?.value || "";
  const tipo = document.getElementById("lancTipo")?.value || "MO";
  const subManual = document.getElementById("lancSubtipoManual")?.value || "AUTO";

  if (tipo === "ENTRADA_CAIXA") {
    hint.textContent = "Adiantamento operacional de caixa (não soma como custo até ser gasto).";
    return;
  }

  const detectado = detectarSubtipo(desc, tipo, subManual);
  if (subManual && subManual !== "AUTO") {
    hint.textContent = `Subcategoria manual: ${obterRotuloSubtipo(detectado)}`;
    hint.className = "mt-1 text-xs font-bold text-[#FF8C00]";
  } else if (detectado === "ALIM" || detectado === "TRANSP") {
    hint.textContent = `Detectado automaticamente: ${obterRotuloSubtipo(detectado)}`;
    hint.className = "mt-1 text-xs font-bold text-[#16A34A]";
  } else {
    hint.textContent = `Subcategoria analítica: ${obterRotuloSubtipo(detectado)}`;
    hint.className = "mt-1 text-xs font-semibold text-[#4395D8]";
  }
}

function salvarLancamentoDesktop(e) {
  if (e) e.preventDefault();
  const obra = getObraAtual();
  if (!obra) return;

  const idEdicao = document.getElementById("lancIdEdicao")?.value;
  const desc = document.getElementById("lancDescricao")?.value.trim();
  const valor = parseFloat(document.getElementById("lancValor")?.value || 0);
  const data = document.getElementById("lancData")?.value || new Date().toISOString().split("T")[0];
  const tipoEscolhido = document.getElementById("lancTipo")?.value || "MO";
  const subtipoManual = document.getElementById("lancSubtipoManual")?.value || "AUTO";
  const titular = (document.getElementById("lancTitular")?.value || "EMTEC").toUpperCase();
  const reembolsoStatus = document.getElementById("lancReembolsoStatus")?.value || "NAO_REEMBOLSAVEL";
  const pagamento = document.getElementById("lancPagamento")?.value || "PIX";
  const empreitaId = document.getElementById("lancEmpreitaId")?.value || "";

  if (isNaN(valor) || valor <= 0) {
    alert("Informe um valor válido.");
    return;
  }

  const isEntrada = tipoEscolhido === "ENTRADA_CAIXA";
  const tipoOficial = isEntrada ? "MAT" : normalizarTipoOficial(tipoEscolhido);
  const subtipo = detectarSubtipo(desc, tipoEscolhido, subtipoManual);
  const hoje = new Date().toISOString().split("T")[0];
  const reembFinal = isEntrada ? "NAO_REEMBOLSAVEL" : reembolsoStatus;

  if (idEdicao) {
    const idx = obra.lancamentos.findIndex(l => l.id === idEdicao);
    if (idx !== -1) {
      const anterior = obra.lancamentos[idx];
      obra.lancamentos[idx] = {
        ...anterior,
        descricao: desc,
        tipo: tipoOficial,
        subtipo,
        subtipoManual: subtipoManual !== "AUTO" ? subtipoManual : undefined,
        valor,
        data,
        pagamento,
        titular,
        reembolsoStatus: reembFinal,
        reembolsadoEm: reembFinal === "REEMBOLSADO" ? (anterior.reembolsadoEm || hoje) : undefined,
        movimento: isEntrada ? "ENTRADA_CAIXA" : "SAIDA",
        empreitaId: empreitaId || undefined,
        atualizadoEm: new Date().toISOString()
      };
    }
  } else {
    const novo = {
      id: "lanc-" + Date.now(),
      descricao: desc,
      tipo: tipoOficial,
      subtipo,
      subtipoManual: subtipoManual !== "AUTO" ? subtipoManual : undefined,
      valor,
      data,
      dataOriginal: data,
      pagamento,
      titular,
      reembolsoStatus: reembFinal,
      reembolsadoEm: reembFinal === "REEMBOLSADO" ? hoje : undefined,
      movimento: isEntrada ? "ENTRADA_CAIXA" : "SAIDA",
      empreitaId: empreitaId || undefined,
      atualizadoEm: new Date().toISOString()
    };

    if (!obra.lancamentos) obra.lancamentos = [];
    obra.lancamentos.unshift(novo);

    if (empreitaId && obra.empreitas) {
      const emp = obra.empreitas.find(e => e.id === empreitaId);
      if (emp) {
        emp.valorPago = Number(emp.valorPago || 0) + valor;
        tocar(emp);
      }
    }
  }

  salvarEstado();
  limparFormLancamento();
  atualizarTudo();
  mostrarNotificacaoToast(`Despesa salva com sucesso.`);
}

function editarLancamento(id) {
  abrirEdicaoRapida(id);
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
  const selTit = document.getElementById("lancTitular");
  if (selTit) selTit.value = "EMTEC";
  const selReemb = document.getElementById("lancReembolsoStatus");
  if (selReemb) selReemb.value = "NAO_REEMBOLSAVEL";
  const selSub = document.getElementById("lancSubtipoManual");
  if (selSub) selSub.value = "AUTO";
  atualizarPreviewSubtipoDesktop();
}

function excluirLancamento(id) {
  if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
  const obra = getObraAtual();
  const item = (obra.lancamentos || []).find(l => l.id === id);
  if (item) {
    item.deletado = true;
    item.atualizadoEm = new Date().toISOString();
  }
  salvarEstado();
  atualizarTudo();
  mostrarNotificacaoToast("Lançamento excluído.");
}

// --------------------------------------------------------------------------
// 8. MEDIÇÕES E CONTRATOS (Cards Mobile / Tabela Desktop)
// --------------------------------------------------------------------------
function renderizarAbaMedicoes(obra, m) {
  const containerMob = document.getElementById("cardsMedicoesMobile");
  const tbody = document.getElementById("tbodyMedicoes");
  const lista = (obra.medicoes || []).filter(med => !med.deletado);

  if (lista.length === 0) {
    const emptyHtml = `<div class="py-6 text-center text-sm text-[#6C757D]">Nenhuma medição cadastrada.</div>`;
    if (containerMob) containerMob.innerHTML = emptyHtml;
    if (tbody) tbody.innerHTML = `<tr><td colspan="6">${emptyHtml}</td></tr>`;
    return;
  }

  // 1. Renderização Mobile (Cards)
  if (containerMob) {
    containerMob.innerHTML = lista.map(med => {
      const bruto = Number(med.valorBruto || 0);
      const desc = Number(med.descontoNotaPerc ?? 7.5);
      const liq = med.valorLiquido ? Number(med.valorLiquido) : bruto * (1 - desc / 100);
      const isRec = med.status === "Recebida";
      return `
        <div class="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-sm text-[#23396B] leading-snug">${med.titulo}</span>
            <button onclick="alternarStatusMedicao('${med.id}')"
              class="px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${isRec ? "bg-[#DCFCE7] text-[#14532D]" : "bg-[#FEF3C7] text-[#92400E] border border-amber-300"}">
              ${isRec ? "Recebida na Conta" : "A Receber (Prevista)"}
            </button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
            <div>
              <span class="text-[#64748B] block text-xs font-bold uppercase">Bruto Faturado</span>
              <span class="font-bold text-[#23396B]">${formatBRL(bruto)}</span>
            </div>
            <div>
              <span class="text-[#64748B] block text-xs font-bold uppercase">Retenção NF</span>
              <span class="font-semibold text-[#64748B]">-${desc}%</span>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <span class="text-xs font-bold uppercase block ${isRec ? "text-[#16A34A]" : "text-amber-700"}">
                ${isRec ? "Líquido Recebido" : "Líquido a Receber"}
              </span>
              <span class="font-display text-base font-extrabold ${isRec ? "text-[#16A34A]" : "text-amber-600"}">${formatBRL(liq)}</span>
            </div>
          </div>

          ${med.observacao ? `<div class="text-xs text-[#64748B] italic">${med.observacao}</div>` : ""}

          <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <button onclick="alternarStatusMedicao('${med.id}')" class="text-xs font-bold text-[#4395D8] px-2.5 py-1 rounded-xl bg-blue-50 active:bg-blue-100 transition">
              ${isRec ? "Marcar como pendente" : "Marcar como recebida"}
            </button>
            <button onclick="excluirMedicao('${med.id}')" class="text-xs font-bold text-rose-600 px-2.5 py-1 rounded-xl bg-rose-50 active:bg-rose-100 transition">Excluir</button>
          </div>
        </div>
      `;
    }).join("");
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
  const status = document.getElementById("medStatus")?.value || "Pendente";
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
    observacao: "Medição registrada no sistema",
    atualizadoEm: new Date().toISOString()
  });

  document.getElementById("medTitulo").value = "";
  document.getElementById("medValorBruto").value = "";
  const containerForm = document.getElementById("containerFormMedicao");
  const btnTxt = document.getElementById("btnToggleMedicaoTexto");
  if (containerForm) {
    containerForm.classList.add("hidden");
    if (btnTxt) btnTxt.textContent = "+ Nova Medição";
  }
  salvarEstado();
  atualizarTudo();
  mostrarNotificacaoToast("Medição cadastrada com sucesso.");
}

function toggleFormNovaMedicao() {
  const container = document.getElementById("containerFormMedicao");
  const btnTxt = document.getElementById("btnToggleMedicaoTexto");
  if (!container) return;
  const isHidden = container.classList.contains("hidden");
  if (isHidden) {
    container.classList.remove("hidden");
    if (btnTxt) btnTxt.textContent = "✕ Fechar";
    document.getElementById("medTitulo")?.focus();
  } else {
    container.classList.add("hidden");
    if (btnTxt) btnTxt.textContent = "+ Nova Medição";
  }
}

function alternarStatusMedicao(id) {
  const obra = getObraAtual();
  const med = (obra.medicoes || []).find(m => m.id === id);
  if (med) {
    med.status = med.status === "Recebida" ? "Pendente" : "Recebida";
    med.atualizadoEm = new Date().toISOString();
    salvarEstado();
    atualizarTudo();
  }
}

function excluirMedicao(id) {
  if (!confirm("Excluir esta medição?")) return;
  const obra = getObraAtual();
  const med = (obra.medicoes || []).find(m => m.id === id);
  if (med) {
    med.deletado = true;
    med.atualizadoEm = new Date().toISOString();
  }
  salvarEstado();
  atualizarTudo();
}

// --------------------------------------------------------------------------
// 9. RESUMO, ORÇAMENTO E GRÁFICOS
// --------------------------------------------------------------------------
function renderizarAbaResumo(obra, m) {
  const container = document.getElementById("orcamentoComparativoLista");
  if (!container) return;

  const orc = obra.orcamentoPrevisto || {};
  // Se houver tetos antigos com ALIM/TRANSP separados, consolida nos pilares oficiais sem sobreposição
  const tetoMO = Number(orc.MO || 0) + Number(orc.ALIM || 0);
  const tetoMAT = Number(orc.MAT || 0);
  const tetoEQUIP = Number(orc.EQUIP || 0);
  const tetoOUTROS = Number(orc.OUTROS || 0) + Number(orc.TRANSP || 0);

  const categorias = [
    {
      key: "MAT",
      nome: "Material (MAT)",
      gasto: m.porTipoOficial.MAT,
      teto: tetoMAT,
      nota: "Insumos e materiais de construção"
    },
    {
      key: "MO",
      nome: "Mão de Obra Geral (MO)",
      gasto: m.porTipoOficial.MO,
      teto: tetoMO,
      nota: `Inclui R$ ${Number(m.porSubtipoReal.ALIM || 0).toLocaleString("pt-BR", {minimumFractionDigits: 2})} em refeições de equipe`
    },
    {
      key: "EQUIP",
      nome: "Equipamento (EQUIP)",
      gasto: m.porTipoOficial.EQUIP,
      teto: tetoEQUIP,
      nota: "Locação de ferramentas, caçambas e andaimes"
    },
    {
      key: "OUTROS",
      nome: "Outros & Taxas (OUTROS)",
      gasto: m.porTipoOficial.OUTROS,
      teto: tetoOUTROS,
      nota: `Taxas, ART e R$ ${Number(m.porSubtipoReal.TRANSP || 0).toLocaleString("pt-BR", {minimumFractionDigits: 2})} em combustível/transporte`
    }
  ];

  container.innerHTML = categorias.map(c => {
    const teto = c.teto;
    const perc = teto > 0 ? (c.gasto / teto) * 100 : 0;
    const saldoCat = teto - c.gasto;

    let corBarra = "bg-[#16A34A]";
    if (perc > 80 && perc <= 100) corBarra = "bg-[#FF8C00]";
    if (perc > 100) corBarra = "bg-rose-500";

    return `
      <div class="p-3.5 rounded-2xl bg-[#F8F9FA] border border-[#DEE2E6]">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-xs sm:text-sm font-bold text-[#23396B]">${c.nome}</span>
            <span class="block text-xs text-[#64748B]">${c.nota}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase text-[#6C757D]">Teto R$:</span>
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
  const novos = {};
  document.querySelectorAll("[data-orc-key]").forEach(inp => {
    const k = inp.getAttribute("data-orc-key");
    novos[k] = Math.max(0, parseFloat(inp.value || 0) || 0);
  });
  const totalTetos = Object.values(novos).reduce((a, b) => a + b, 0);
  if (totalTetos <= 0) {
    alert("Informe o limite de gasto (teto) de pelo menos uma categoria. Sem ele o sistema não consegue calcular o lucro se gastar todo o orçamento.");
    return;
  }
  delete obra.orcamentoPrevisto.ALIM;
  delete obra.orcamentoPrevisto.TRANSP;
  Object.assign(obra.orcamentoPrevisto, novos);
  tocar(obra);
  salvarEstado();
  atualizarTudo();
  mostrarNotificacaoToast("Limites orçamentários atualizados.");
}

// --------------------------------------------------------------------------
// 10. EMPREITAS E RESPONSÁVEIS FINANCEIROS (REEMBOLSOS / CAIXA DE CAMPO)
// --------------------------------------------------------------------------
function renderizarAbaEmpreitasETitulares(obra, m) {
  const listaEmp = document.getElementById("listaEmpreitas");
  if (listaEmp) {
    const emps = (obra.empreitas || []).filter(e => !e.deletado);
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
              <button onclick="excluirEmpreita('${e.id}')" class="text-xs font-bold text-rose-600 px-2.5 py-1 rounded-lg bg-rose-50 active:bg-rose-100 transition">Excluir</button>
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
    const stats = m.reembolsosPorTitular || {};
    const todosResp = getResponsaveis();
    const chavesExtras = Object.keys(stats).filter(k => !todosResp.some(r => r.id === k));
    const listaCompleta = [
      ...todosResp,
      ...chavesExtras.map(k => ({ id: k, nome: k, tipo: "OUTRO" }))
    ];

    const cardsHtml = listaCompleta
      .map(r => {
        const st = stats[r.id] || { pagoTotal: 0, pendente: 0, reembolsado: 0, naoReembolsavel: 0, qtdPendente: 0, qtdTotal: 0 };
        const isCampo = r.tipo === "CAIXA_CAMPO";
        const isProprio = r.tipo === "RECURSO_PROPRIO";
        const isEmpresa = r.tipo === "EMPRESA";
        if (st.pagoTotal === 0 && !["EMTEC", "MELO", "PILAR", "ELON", "IAGO"].includes(r.id)) return "";

        const perc = m.custoTotal > 0 ? (st.pagoTotal / m.custoTotal) * 100 : 0;
        let subtituloTipo = "Outros Responsáveis";
        if (isEmpresa) subtituloTipo = "Conta da Empresa • Sem reembolso";
        if (isProprio) subtituloTipo = "Recursos Próprios • Reembolsável";
        if (isCampo) subtituloTipo = "Caixa de Campo • Equipe Operacional";

        return `
          <div class="p-4 rounded-2xl bg-[#F8F9FA] border ${st.pendente > 0 ? "border-[#FF8C00] bg-[#FF8C00]/5" : "border-[#DEE2E6]"} space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <div>
                <span class="text-xs sm:text-sm font-extrabold text-[#23396B] block">${r.nome}</span>
                <span class="text-xs text-[#64748B]">${subtituloTipo} • ${st.qtdTotal} despesa(s) (${perc.toFixed(1)}% da obra)</span>
              </div>
              <div class="text-right">
                <div class="font-display font-extrabold text-sm sm:text-base text-[#23396B]">${formatBRL(st.pagoTotal)}</div>
                <span class="text-xs text-[#6C757D]">Total pago na obra</span>
              </div>
            </div>

            ${(isProprio || st.pendente > 0 || st.reembolsado > 0) ? `
              <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                <div>
                  <span class="text-[#64748B] block">A Reembolsar</span>
                  <strong class="${st.pendente > 0 ? "text-[#B45309] font-extrabold" : "text-[#16A34A]"}">${formatBRL(st.pendente)}</strong>
                </div>
                <div>
                  <span class="text-[#64748B] block">Já Reembolsado</span>
                  <strong class="text-[#16A34A]">${formatBRL(st.reembolsado)}</strong>
                </div>
                <div>
                  <span class="text-[#64748B] block">Sem Reembolso</span>
                  <strong class="text-[#23396B]">${formatBRL(st.naoReembolsavel)}</strong>
                </div>
              </div>
            ` : ""}

            <div class="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-xs flex-wrap gap-2">
              <button onclick="filtrarPorResponsavel('${r.id}')" class="font-bold text-[#4395D8] hover:underline">
                Filtrar despesas de ${r.nome} →
              </button>
              ${st.pendente > 0 ? `
                <button onclick="quitarReembolsosTitular('${r.id}')"
                  class="px-3 py-1 rounded-xl bg-[#16A34A] text-white font-extrabold hover:bg-[#15803D] transition shadow-2xs">
                  ✓ Dar baixa em ${st.qtdPendente} reembolso(s) (${formatBRL(st.pendente)})
                </button>
              ` : ""}
            </div>
          </div>
        `;
      })
      .filter(Boolean)
      .join("");

    const resumoCaixaCampo = `
      <div class="p-4 rounded-2xl bg-[#23396B]/5 border border-[#23396B]/20 space-y-1.5 text-xs">
        <div class="font-display font-extrabold text-xs sm:text-sm text-[#23396B]">Resumo do Caixa de Campo (Adiantamentos vs. Gastos)</div>
        <div class="flex justify-between"><span>Total Adiantado ao Campo (Entradas de Caixa):</span><strong>${formatBRL(m.entradasCaixa)}</strong></div>
        <div class="flex justify-between"><span>Total de Reembolsos Pendentes na Obra:</span><strong class="${m.totalReembolsosPendentes > 0 ? "text-[#B45309]" : "text-[#16A34A]"}">${formatBRL(m.totalReembolsosPendentes)}</strong></div>
        <div class="flex justify-between"><span>Total já Reembolsado na Obra:</span><strong class="text-[#16A34A]">${formatBRL(m.totalReembolsado)}</strong></div>
      </div>
    `;

    listaTit.innerHTML = resumoCaixaCampo + cardsHtml;
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
    observacao: "Contrato registrado no sistema",
    atualizadoEm: new Date().toISOString()
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
  const emp = (obra.empreitas || []).find(e => e.id === id);
  if (emp) {
    emp.deletado = true;
    emp.atualizadoEm = new Date().toISOString();
  }
  salvarEstado();
  atualizarTudo();
}

// --------------------------------------------------------------------------
// 11. GESTÃO DE OBRAS, STATUS OPERACIONAL E NAVEGAÇÃO
// --------------------------------------------------------------------------
function renderizarSeletorObras() {
  const sel = document.getElementById("obraSelect");
  if (!sel) return;
  const options = estado.obras.map(o =>
    `<option value="${o.id}" ${o.id === obraAtualId ? "selected" : ""}>${o.nome}</option>`
  ).join("");
  sel.innerHTML = options + `<option value="__NOVA_OBRA__">+ Cadastrar Nova Obra...</option>`;
}

function trocarObra(id) {
  if (id === "__NOVA_OBRA__") {
    const sel = document.getElementById("obraSelect");
    if (sel) sel.value = obraAtualId;
    abrirModalNovaObra();
    return;
  }
  obraAtualId = id;
  limparFormLancamento();
  atualizarTudo();
}

function alterarStatusOperacionalObra(novoStatus) {
  const obra = getObraAtual();
  if (!obra || !novoStatus) return;
  const statusAnterior = obra.status || "Em Andamento";
  if (novoStatus === statusAnterior) return;

  if (!confirm(`Deseja alterar o status operacional da obra "${obra.nome}" de "${statusAnterior}" para "${novoStatus}"?`)) {
    const selDesk = document.getElementById("selectStatusObraDesktop");
    if (selDesk) selDesk.value = statusAnterior;
    const selMob = document.getElementById("selectStatusObraMobile");
    if (selMob) selMob.value = statusAnterior;
    return;
  }

  obra.status = novoStatus;
  obra.atualizadoEm = new Date().toISOString();
  salvarEstado();
  atualizarTudo();
  mostrarNotificacaoToast(`Status operacional da obra alterado para: ${obra.status}`);
}

function alternarStatusObra() {
  const obra = getObraAtual();
  if (!obra) return;
  const proximo = obra.status === "Concluída" ? "Em Andamento" : "Concluída";
  alterarStatusOperacionalObra(proximo);
}

function mudarAba(abaId) {
  // Abas disponíveis
  const abas = ["resumo", "lancamentos", "medicoes", "empreitas", "auditoria", "mais"];

  if (abaId === "relatorios_menu") {
    abaId = "mais";
  }

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

  // Atualizar Bottom Nav no celular (5 ações objetivas)
  const navMobResumo = document.getElementById("navMobResumo");
  const navMobLanc = document.getElementById("navMobLanc");
  const navMobMed = document.getElementById("navMobMed");
  const navMobMais = document.getElementById("navMobMais");

  if (navMobResumo) navMobResumo.className = abaId === "resumo" ? "flex flex-col items-center gap-1 text-[#FF8C00] font-bold" : "flex flex-col items-center gap-1 text-white/70 hover:text-white";
  if (navMobLanc) navMobLanc.className = abaId === "lancamentos" ? "flex flex-col items-center gap-1 text-[#FF8C00] font-bold" : "flex flex-col items-center gap-1 text-white/70 hover:text-white";
  if (navMobMed) navMobMed.className = abaId === "medicoes" ? "flex flex-col items-center gap-1 text-[#FF8C00] font-bold" : "flex flex-col items-center gap-1 text-white/70 hover:text-white";
  if (navMobMais) navMobMais.className = (abaId === "mais" || abaId === "empreitas" || abaId === "auditoria") ? "flex flex-col items-center gap-1 text-[#FF8C00] font-bold" : "flex flex-col items-center gap-1 text-white/70 hover:text-white";

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
    if (texto) texto.textContent = "Ocultar detalhes opcionais";
  } else {
    el.classList.add("hidden");
    if (icone) icone.textContent = "+";
    if (texto) texto.textContent = "Opções avançadas (Data, Pagamento, Empreiteiro)";
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

  if (!nome) {
    alert("Informe o nome da obra.");
    return;
  }
  if (!(tetoCusto > 0)) {
    alert("Informe o teto de custo da obra (quanto você pretende gastar no máximo). Ele é obrigatório para o cálculo de lucro.");
    document.getElementById("novaObraTetoCusto")?.focus();
    return;
  }

  const nova = {
    id: "obra-" + Date.now(),
    atualizadoEm: new Date().toISOString(),
    nome,
    cliente,
    status: "Em Andamento",
    dataInicio: new Date().toISOString().split("T")[0],
    aliquotaImposto,
    orcamentoPrevisto: {
      MAT: Math.round(tetoCusto * 0.50),
      MO: Math.round(tetoCusto * 0.38),
      EQUIP: Math.round(tetoCusto * 0.05),
      OUTROS: Math.round(tetoCusto * 0.07)
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
        if (!confirm("Importar este backup? Nada será apagado: os dados do backup são mesclados com os que já estão na nuvem (vale o registro mais recente).")) return;
        estado = sanearDadosCarregados(parsed);
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

function exportarExcelObra() {
  const obra = getObraAtual();
  if (!obra) return;
  const m = calcularMetricasObra(obra);
  const sit = m.situacao || avaliarSituacaoFinanceira(obra, m);

  const rowsResumo = [
    { "INDICADOR DA OBRA": "Nome da Obra", "VALOR / INFORMAÇÃO": obra.nome },
    { "INDICADOR DA OBRA": "Cliente / Contrato", "VALOR / INFORMAÇÃO": obra.cliente || "Contrato" },
    { "INDICADOR DA OBRA": "Status Operacional", "VALOR / INFORMAÇÃO": obra.status || "Em Andamento" },
    { "INDICADOR DA OBRA": "Situação Financeira", "VALOR / INFORMAÇÃO": sit.rotulo },
    { "INDICADOR DA OBRA": "Data de Emissão do Relatório", "VALOR / INFORMAÇÃO": formatDataBR(new Date().toISOString().split("T")[0]) },
    { "INDICADOR DA OBRA": "--- RECEITAS E MEDIÇÕES ---", "VALOR / INFORMAÇÃO": "" },
    { "INDICADOR DA OBRA": "Receita Bruta Contratada (R$)", "VALOR / INFORMAÇÃO": m.medBrutaTotal },
    { "INDICADOR DA OBRA": "Receita Líquida Contratada após NF (R$)", "VALOR / INFORMAÇÃO": m.medLiquidaTotal },
    { "INDICADOR DA OBRA": "Valor Efetivamente Recebido (R$)", "VALOR / INFORMAÇÃO": m.medLiquidaRecebida },
    { "INDICADOR DA OBRA": "Saldo a Receber de Clientes (R$)", "VALOR / INFORMAÇÃO": m.medLiquidaPendente },
    { "INDICADOR DA OBRA": "--- DESPESAS REALIZADAS POR CATEGORIA ---", "VALOR / INFORMAÇÃO": "" },
    { "INDICADOR DA OBRA": "Material (MAT) (R$)", "VALOR / INFORMAÇÃO": m.porTipoOficial.MAT },
    { "INDICADOR DA OBRA": "Mão de Obra Geral (MO) (R$)", "VALOR / INFORMAÇÃO": m.porTipoOficial.MO },
    { "INDICADOR DA OBRA": "Equipamentos (EQUIP) (R$)", "VALOR / INFORMAÇÃO": m.porTipoOficial.EQUIP },
    { "INDICADOR DA OBRA": "Outros e Taxas (OUTROS) (R$)", "VALOR / INFORMAÇÃO": m.porTipoOficial.OUTROS },
    { "INDICADOR DA OBRA": "Detalhamento Analítico: Alimentação (ALIM) (R$)", "VALOR / INFORMAÇÃO": m.porSubtipoReal.ALIM },
    { "INDICADOR DA OBRA": "Detalhamento Analítico: Combustível / Transporte (TRANSP) (R$)", "VALOR / INFORMAÇÃO": m.porSubtipoReal.TRANSP },
    { "INDICADOR DA OBRA": "TOTAL DE DESPESAS REALIZADAS (R$)", "VALOR / INFORMAÇÃO": m.custoTotal },
    { "INDICADOR DA OBRA": "--- RESULTADO, PENDÊNCIAS E VIABILIDADE ---", "VALOR / INFORMAÇÃO": "" },
    { "INDICADOR DA OBRA": "Resultado Acumulado (Recebido - Despesas Pagas) (R$)", "VALOR / INFORMAÇÃO": m.saldoAtual },
    { "INDICADOR DA OBRA": "Margem Realizada (%)", "VALOR / INFORMAÇÃO": Number(m.margemAtualPerc.toFixed(2)) },
    { "INDICADOR DA OBRA": "Empreiteiros Pendentes a Pagar (R$)", "VALOR / INFORMAÇÃO": m.saldoEmpreitasPendente },
    { "INDICADOR DA OBRA": "Reembolsos Pendentes a Pagar (R$)", "VALOR / INFORMAÇÃO": m.totalReembolsosPendentes },
    { "INDICADOR DA OBRA": "Custo Final Projetado da Obra (R$)", "VALOR / INFORMAÇÃO": m.custoTotalProjetado },
    { "INDICADOR DA OBRA": "Limite Orçamentário Planejado (Teto) (R$)", "VALOR / INFORMAÇÃO": m.tetoTotal },
    { "INDICADOR DA OBRA": "Lucro se gastar todo o orçamento (Receita líquida - Teto) (R$)", "VALOR / INFORMAÇÃO": m.saldoProjetadoFinal },
    { "INDICADOR DA OBRA": "Margem se gastar todo o orçamento (%)", "VALOR / INFORMAÇÃO": Number(m.margemProjetadaPerc.toFixed(2)) }
  ];

  const rowsLanc = (obra.lancamentos || [])
    .filter(l => !l.deletado)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
    .map(l => {
      const statusReemb = l.reembolsoStatus === "PENDENTE"
        ? "Reembolso Pendente"
        : l.reembolsoStatus === "REEMBOLSADO"
          ? `Reembolsado${l.reembolsadoEm ? ` (${formatDataBR(l.reembolsadoEm)})` : ""}`
          : "Sem Reembolso";
      return {
        "DATA": formatDataBR(l.data),
        "DESCRIÇÃO": l.descricao,
        "CATEGORIA": l.movimento === "ENTRADA_CAIXA" ? "ADIANTAMENTO DE CAIXA" : l.tipo,
        "SUBCATEGORIA": l.movimento === "ENTRADA_CAIXA" ? "ENTRADA_CAIXA" : (l.subtipo || l.tipo),
        "VALOR (R$)": Number(l.valor || 0),
        "QUEM PAGOU": getNomeResponsavel(l.titular),
        "STATUS REEMBOLSO": statusReemb,
        "MEIO DE PAGAMENTO": l.pagamento || "PIX"
      };
    });

  const rowsMedicoes = (obra.medicoes || [])
    .filter(med => !med.deletado)
    .map(med => {
      const bruto = Number(med.valorBruto || 0);
      const desc = Number(med.descontoNotaPerc ?? 7.5);
      const liq = med.valorLiquido ? Number(med.valorLiquido) : Math.round(bruto * (1 - desc / 100) * 100) / 100;
      return {
        "PARCELA / MEDIÇÃO": med.titulo,
        "DATA": formatDataBR(med.data),
        "STATUS": med.status === "Recebida" ? "Recebida na Conta" : "A Receber (Pendente)",
        "VALOR BRUTO (R$)": bruto,
        "IMPOSTO NF (%)": desc,
        "VALOR LÍQUIDO (R$)": liq,
        "OBSERVAÇÃO": med.observacao || ""
      };
    });

  const rowsEmpreitasEReemb = [];
  (obra.empreitas || []).filter(e => !e.deletado).forEach(e => {
    const contratado = Number(e.valorContratado || 0);
    const pago = Number(e.valorPago || 0);
    rowsEmpreitasEReemb.push({
      "TIPO": "Empreiteiro Contratado",
      "NOME / FORNECEDOR": e.fornecedor,
      "SERVIÇO / DETALHE": e.servico || "",
      "TOTAL CONTRATADO / PAGO NA OBRA (R$)": contratado,
      "JÁ PAGO / REEMBOLSADO (R$)": pago,
      "PENDENTE A PAGAR (R$)": Math.max(0, contratado - pago)
    });
  });

  Object.entries(m.reembolsosPorTitular || {}).forEach(([id, st]) => {
    rowsEmpreitasEReemb.push({
      "TIPO": "Responsável Financeiro",
      "NOME / FORNECEDOR": getNomeResponsavel(id),
      "SERVIÇO / DETALHE": `${st.qtdTotal} lançamento(s) na obra`,
      "TOTAL CONTRATADO / PAGO NA OBRA (R$)": st.pagoTotal,
      "JÁ PAGO / REEMBOLSADO (R$)": st.reembolsado,
      "PENDENTE A PAGAR (R$)": st.pendente
    });
  });

  if (typeof XLSX !== "undefined") {
    const wb = XLSX.utils.book_new();

    const wsRes = XLSX.utils.json_to_sheet(rowsResumo);
    wsRes["!cols"] = [{ wch: 52 }, { wch: 28 }];

    const wsLanc = XLSX.utils.json_to_sheet(rowsLanc);
    wsLanc["!cols"] = [{ wch: 12 }, { wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 15 }, { wch: 24 }, { wch: 24 }, { wch: 18 }];

    const wsMed = XLSX.utils.json_to_sheet(rowsMedicoes);
    wsMed["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 30 }];

    const wsEmp = XLSX.utils.json_to_sheet(rowsEmpreitasEReemb);
    wsEmp["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 28 }, { wch: 32 }, { wch: 24 }, { wch: 22 }];

    XLSX.utils.book_append_sheet(wb, wsRes, "Resumo da Obra");
    XLSX.utils.book_append_sheet(wb, wsLanc, "Despesas da Obra");
    XLSX.utils.book_append_sheet(wb, wsMed, "Recebimentos do Cliente");
    XLSX.utils.book_append_sheet(wb, wsEmp, "Empreiteiros e Reembolsos");

    const nomeArquivo = `Relatorio_EMTEC_${obra.nome.replace(/[^a-zA-Z0-9_-]+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
    mostrarNotificacaoToast("Planilha Excel gerada com sucesso!");
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

  carregarPerfilUsuario();
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

  // Sem PIN válido neste aparelho: pede entrada antes de qualquer sincronização
  if (!verificarAuth()) {
    exigirLogin();
  } else {
    if (temPendencia()) atualizarBadgeNuvem("pending");
    sincronizarComNuvem();
    iniciarSincronizacaoPeriodica();
  }

  // Sincronizar ao voltar para o app (ex: reabrir no celular)
  window.addEventListener("focus", () => sincronizarComNuvem());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sincronizarComNuvem();
  });

  // Quando a internet volta, enviar o que ficou guardado no aparelho
  window.addEventListener("online", () => sincronizarComNuvem());
  window.addEventListener("offline", () => {
    if (temPendencia()) atualizarBadgeNuvem("pending");
  });

  // Aviso se tentar fechar com alterações ainda não enviadas
  window.addEventListener("beforeunload", (ev) => {
    if (temPendencia() && navigator.onLine === false) {
      ev.preventDefault();
      ev.returnValue = "";
    }
  });

  // Uso sem internet: guarda a página e os scripts no aparelho
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

window.addEventListener("DOMContentLoaded", inicializarApp);
