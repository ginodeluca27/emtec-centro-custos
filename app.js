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
  return { obras: [], responsaveis: [] };
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
      `<option value="TODOS" ${valFiltro === "TODOS" ? "selected" : ""}>Todos Pagadores</option>` +
      `<option value="REEMBOLSO_PENDENTE" ${valFiltro === "REEMBOLSO_PENDENTE" ? "selected" : ""}>Reembolso Pendente</option>` +
      lista.map(r =>
        `<option value="${r.id}" ${valFiltro === r.id ? "selected" : ""}>${r.nome}</option>`
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
  let mobStatusHtml = "";
  let mobHoraHtml = "";

  if (status === "syncing") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse"></span><span class="font-bold text-[#FF8C00]">Enviando...</span>`;
    mobStatusHtml = statusHtml;
    horaHtml = "";
    mobHoraHtml = "";
  } else if (status === "success") {
    const hora = dataHora
      ? new Date(dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    statusHtml = `<span class="w-2 h-2 rounded-full bg-[#16A34A]"></span><span class="font-bold text-[#16A34A]">Tudo salvo na nuvem</span>`;
    mobStatusHtml = `<span class="w-2 h-2 rounded-full bg-[#16A34A]"></span><span class="font-bold text-[#16A34A]">Salvo na nuvem</span>`;
    horaHtml = `Última sincronização: ${hora}`;
    mobHoraHtml = `Sinc.: ${hora}`;
  } else if (status === "pending") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse"></span><span class="font-bold text-[#B45309]">Sem sinal: salvo no aparelho</span>`;
    mobStatusHtml = `<span class="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse"></span><span class="font-bold text-[#B45309]">Salvo no aparelho</span>`;
    horaHtml = "Será enviado sozinho quando a internet voltar";
    mobHoraHtml = "Aguardando sinal";
  } else if (status === "server") {
    statusHtml = '<span class="w-2 h-2 rounded-full bg-[#FF8C00]"></span><span class="font-bold text-[#B45309]">Falha na sincronização</span>';
    mobStatusHtml = statusHtml;
    horaHtml = temPendencia() ? "Alterações salvas no aparelho. O app vai tentar novamente." : "O app vai tentar sincronizar novamente.";
    mobHoraHtml = temPendencia() ? "Salvo no aparelho" : "Tentaremos novamente";
  } else if (status === "auth") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="font-bold text-rose-600">PIN inválido</span>`;
    mobStatusHtml = statusHtml;
    horaHtml = "Entre novamente para sincronizar";
    mobHoraHtml = "Toque para entrar";
  } else if (status === "offline") {
    statusHtml = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="font-bold text-rose-600">Sem conexão com a nuvem</span>`;
    mobStatusHtml = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="font-bold text-rose-600">Sem sinal</span>`;
    horaHtml = temPendencia() ? "Alterações guardadas no aparelho, aguardando envio" : "";
    mobHoraHtml = temPendencia() ? "Salvo no celular" : "";
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
  if (mobStatus) mobStatus.innerHTML = mobStatusHtml;
  if (mobHora) {
    if (mobHoraHtml) {
      mobHora.textContent = mobHoraHtml;
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
      atualizarBadgeNuvem("server");
      return;
    }

    const json = await res.json();
    if (json && json.data && Array.isArray(json.data.obras) && json.data.obras.length > 0) {
      if (versaoEnviada === versaoLocal) {
        // Nada mudou durante o envio: adotar o resultado mesclado (já contém tudo que era local)
        const primeiraCarga = !getObraAtual();
        estado = sanearDadosCarregados(json.data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
        localStorage.removeItem(PENDENTE_STORAGE_KEY);
        if (!estado.obras.some(o => o.id === obraAtualId)) {
          obraAtualId = estado.obras[0]?.id || "";
        }
        renderizarSeletorObras();
        atualizarTudo();
        if (primeiraCarga && innerWidth < 768 && document.body.dataset.aba === "geral") mudarAba("resumo");
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

function novoId(prefixo) {
  const id = globalThis.crypto?.randomUUID?.() || Date.now() + "-" + Math.random().toString(36).slice(2);
  return prefixo + "-" + id;
}

function dataLocalHoje() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return [hoje.getFullYear(), mes, dia].join("-");
}

async function pedirDataPagamento(titulo) {
  const modal = document.getElementById("dialogDataPagamento");
  const campo = document.getElementById("dataPagamento");
  if (modal.open) return "";
  document.getElementById("tituloDataPagamento").textContent = titulo;
  campo.value = dataLocalHoje();
  campo.max = campo.value;
  modal.returnValue = "";
  return new Promise(resolve => {
    modal.addEventListener("close", () => resolve(modal.returnValue === "salvar" ? campo.value : ""), { once: true });
    modal.showModal();
  });
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
  if (tipoEscolhido === "ADM") return "ADM";
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
  if (REGEX_ALIMENTACAO.test(d) && !d.includes("MISTURADOR")) return "ALIM";
  if (REGEX_TRANSPORTE.test(d)) return "OUTROS";
  if (/\b(DIARIA|DIARIAS|DIARISTA|PEDREIRO|SERVENTE|AJUDANTE|EMPREITA|FOLHA|MAO DE OBRA|ELETRICISTA|ENCANADOR|PINTOR|DEMOLICAO|SALARIO|ADIANTAMENTO)\b/.test(d)) return "MO";
  if (/\b(LOCACAO|ALUGUEL|ANDAIME|CONTEINER|BETONEIRA|MARTELETE|MISTURADOR|REFLETOR)\b/.test(d)) return "EQUIP";
  if (/\b(ART|TAXA|TAXAS|IMPOSTO|COMISSAO|CARTORIO|ALVARA)\b/.test(d)) return "OUTROS";
  if (/\b(CIMENTO|AREIA|BRITA|TIJOLO|BLOCO|CERAMICA|ARGAMASSA|REJUNTE|TINTA|PREGO|TUBO|TUBULACAO|CABO|FIO|MATERIAL|MATERIAIS|PEDRA|TELHA|MADEIRA|FERRO|PARAFUSO|DISCO|AC3|FERRAMENTA|FERRAMENTAS)\b/.test(d)) return "MAT";
  return "";
}
function normalizarTipoOficial(tipoEscolhido) {
  if (tipoEscolhido === "ALIM") return "MO";
  if (tipoEscolhido === "TRANSP") return "OUTROS";
  return tipoEscolhido;
}

function avaliarSituacaoFinanceira(obra, m) {
  const isConcluida = obra.status === "Concluída";
  if (isConcluida) {
    if (m.saldoAtual >= 0) {
      return {
        codigo: "CONCLUIDA_LUCRO",
        rotulo: `Concluída com Resultado Positivo (${m.margemRealizadaPerc >= 0 ? "+" : ""}${m.margemRealizadaPerc.toFixed(1)}%)`,
        rotuloCurto: `Concluída (${m.margemRealizadaPerc >= 0 ? "+" : ""}${m.margemRealizadaPerc.toFixed(1)}%)`,
        corBadgeDesktop: "bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]",
        corDot: "bg-[#16A34A]",
        corCardDesktop: "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs"
      };
    }
    return {
      codigo: "CONCLUIDA_PREJUIZO",
      rotulo: `Concluída no Vermelho (${formatBRL(m.saldoAtual)})`,
      rotuloCurto: "Concluída no Vermelho",
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
      rotuloCurto: "Sem Receita Contratada",
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#FF8C00]/20 border border-[#FF8C00]/50 backdrop-blur-xs"
    };
  }

  if (!(m.tetoTotal > 0)) {
    return {
      codigo: "SEM_TETO",
      rotulo: "Atenção • Defina o Teto de Custos",
      rotuloCurto: "Defina o Teto",
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#FF8C00]/20 border border-[#FF8C00]/50 backdrop-blur-xs"
    };
  }

  if (m.saldoProjetadoFinal < 0) {
    return {
      codigo: "RISCO_PREJUIZO",
      rotulo: `Risco de Prejuízo (${formatBRL(m.saldoProjetadoFinal)} no cenário)`,
      rotuloCurto: "Risco de Prejuízo",
      corBadgeDesktop: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
      corDot: "bg-rose-600",
      corCardDesktop: "rounded-2xl p-4 bg-rose-500/20 border border-rose-400/50 backdrop-blur-xs"
    };
  }

  if (m.saldoAtual < 0) {
    return {
      codigo: "RESULTADO_ACUMULADO_NEGATIVO",
      rotulo: "Desembolso Maior que Recebido",
      rotuloCurto: "Gasto > Recebido",
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#FF8C00]/20 border border-[#FF8C00]/50 backdrop-blur-xs"
    };
  }

  if (m.tetoTotal > 0 && m.custoTotalProjetado > m.tetoTotal) {
    return {
      codigo: "VIAVEL_ACIMA_TETO",
      rotulo: `Viável • Acima do Teto (+${m.margemProjetadaFinalPerc.toFixed(1)}% no custo projetado)`,
      rotuloCurto: "Viável • Acima do Teto",
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs"
    };
  }

  if (m.margemProjetadaFinalPerc < 10) {
    return {
      codigo: "MARGEM_APERTADA",
      rotulo: `Margem Apertada (+${m.margemProjetadaFinalPerc.toFixed(1)}% se gastar o teto)`,
      rotuloCurto: "Margem Apertada",
      corBadgeDesktop: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
      corDot: "bg-[#FF8C00]",
      corCardDesktop: "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs"
    };
  }

  return {
    codigo: "OBRA_SAUDAVEL",
    rotulo: `Obra Saudável (+${m.margemProjetadaFinalPerc.toFixed(1)}% se gastar o teto)`,
    rotuloCurto: "Obra Saudável",
    corBadgeDesktop: "bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]",
    corDot: "bg-[#16A34A]",
    corCardDesktop: "rounded-2xl p-4 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs"
  };
}

function arredondarMoeda(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

const GRUPOS_CUSTO = [
  { codigo: "MAT", nome: "Material e insumos", peso: 50 },
  { codigo: "MO", nome: "Mão de obra", peso: 38 },
  { codigo: "EQUIP", nome: "Equipamentos", peso: 5 },
  { codigo: "OUTROS", nome: "Outros e taxas", peso: 7 },
  { codigo: "ADM", nome: "Administração", peso: 0 }
];
const LIMIAR_ALERTA_CUSTO = 70;

function distribuirOrcamento(total, anterior = {}) {
  const grupos = GRUPOS_CUSTO.map(({ codigo, peso }) => [codigo, anterior[codigo] ?? peso]);
  const soma = grupos.reduce((acumulado, [, peso]) => acumulado + peso, 0);
  const centavos = Math.round(total * 100);
  let pesoAcumulado = 0;
  let valorAcumulado = 0;
  return Object.fromEntries(grupos.map(([codigo, peso]) => {
    pesoAcumulado += peso;
    const parcelaAcumulada = Math.round(centavos * pesoAcumulado / soma);
    const valor = (parcelaAcumulada - valorAcumulado) / 100;
    valorAcumulado = parcelaAcumulada;
    return [codigo, valor];
  }));
}

function calcularMetricasObra(obra) {
  if (!obra) return {};
  const saidas = (obra.lancamentos || []).filter(l => !l.deletado && l.movimento !== "ENTRADA_CAIXA");
  const entradasCaixa = (obra.lancamentos || []).filter(l => !l.deletado && l.movimento === "ENTRADA_CAIXA");

  const porTipoOficial = { MAT: 0, MO: 0, EQUIP: 0, OUTROS: 0, ADM: 0 };
  const porSubtipoReal = { MAT: 0, MO: 0, EQUIP: 0, ALIM: 0, TRANSP: 0, OUTROS: 0, ADM: 0 };
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

  let somaMedicoesBruta = 0;
  let somaMedicoesLiquida = 0;
  let medBrutaRecebida = 0;
  let medLiquidaRecebida = 0;
  let medBrutaFaturadaPendente = 0;
  let medLiquidaFaturadaPendente = 0;

  // Filtra medições ativas (e ignora medições fictícias de contrato inicial criadas por versões antigas quando já há contrato definido)
  const medicoesAtivas = (obra.medicoes || []).filter(m => {
    if (!m || m.deletado) return false;
    if (Number(obra.valorContratoBruto || 0) > 0 && String(m.id || "").startsWith("med-init-") && m.observacao === "Medição inicial cadastrada na abertura da obra") {
      return false;
    }
    return true;
  });

  for (const m of medicoesAtivas) {
    const bruto = Number(m.valorBruto || 0);
    const desc = Number(m.descontoNotaPerc ?? obra.aliquotaImposto ?? 7.5);
    const liq = m.valorLiquido ? Number(m.valorLiquido) : arredondarMoeda(bruto * (1 - desc / 100));
    somaMedicoesBruta = arredondarMoeda(somaMedicoesBruta + bruto);
    somaMedicoesLiquida = arredondarMoeda(somaMedicoesLiquida + liq);
    if (m.status === "Recebida") {
      medBrutaRecebida = arredondarMoeda(medBrutaRecebida + bruto);
      medLiquidaRecebida = arredondarMoeda(medLiquidaRecebida + liq);
    } else {
      medBrutaFaturadaPendente = arredondarMoeda(medBrutaFaturadaPendente + bruto);
      medLiquidaFaturadaPendente = arredondarMoeda(medLiquidaFaturadaPendente + liq);
    }
  }

  // Separação estrita entre Valor do Contrato e Medições Cadastradas:
  // Se obra.valorContratoBruto foi informado (ex.: R$ 100.000), lançar uma medição de R$ 30.000 NÃO soma R$ 130.000!
  const contratoInformadoBruto = Number(obra.valorContratoBruto || 0);
  const aliquotaPadrao = Number(obra.aliquotaImposto ?? 7.5);
  let medBrutaTotalContrato = 0;
  let medLiquidaTotalContrato = 0;

  if (contratoInformadoBruto > 0) {
    medBrutaTotalContrato = arredondarMoeda(Math.max(contratoInformadoBruto, somaMedicoesBruta));
    if (somaMedicoesBruta >= contratoInformadoBruto) {
      medLiquidaTotalContrato = somaMedicoesLiquida;
    } else {
      const saldoContratoNaoMedidoBruto = arredondarMoeda(contratoInformadoBruto - somaMedicoesBruta);
      const saldoContratoNaoMedidoLiq = arredondarMoeda(saldoContratoNaoMedidoBruto * (1 - aliquotaPadrao / 100));
      medLiquidaTotalContrato = arredondarMoeda(somaMedicoesLiquida + saldoContratoNaoMedidoLiq);
    }
  } else {
    medBrutaTotalContrato = somaMedicoesBruta;
    medLiquidaTotalContrato = somaMedicoesLiquida;
  }

  const medLiquidaAReceber = arredondarMoeda(Math.max(0, medLiquidaTotalContrato - medLiquidaRecebida));
  const medBrutaAReceber = arredondarMoeda(Math.max(0, medBrutaTotalContrato - medBrutaRecebida));

  const orc = obra.orcamentoPrevisto || {};
  const orcamentoPrevisto = {
    MAT: Number(orc.MAT || 0),
    MO: Number(orc.MO || 0) + Number(orc.ALIM || 0),
    EQUIP: Number(orc.EQUIP || 0),
    OUTROS: Number(orc.OUTROS || 0) + Number(orc.TRANSP || 0),
    ADM: Number(orc.ADM || 0)
  };
  const tetoTotal = arredondarMoeda(Object.values(orcamentoPrevisto).reduce((a, b) => a + Number(b || 0), 0));
  const percOrcamentoConsumido = tetoTotal > 0 ? (custoTotal / tetoTotal) * 100 : 0;

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

  // 6. Lucro se gastar todo o orçamento / Resultado Final Estimado
  const lucroNoTetoPuro = arredondarMoeda(receitaContratoTotal - tetoTotal);
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
    somaMedicoesBruta,
    somaMedicoesLiquida,
    medBrutaFaturadaPendente,
    medLiquidaFaturadaPendente,
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
    orcamentoPrevisto,
    percOrcamentoConsumido,
    alertaCusto: percOrcamentoConsumido >= LIMIAR_ALERTA_CUSTO,
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
    lucroNoTetoPuro,
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
  renderizarRelatoriosGerenciais();
  const obra = getObraAtual();
  document.getElementById("alertaCustoObra").hidden = true;
  if (!obra) return;
  renderizarControlesResponsaveis();
  const m = calcularMetricasObra(obra);
  const alerta = document.getElementById("alertaCustoObra");
  alerta.hidden = !m.alertaCusto;
  alerta.textContent = `Atenção • ${m.percOrcamentoConsumido.toFixed(1).replace(".", ",")}% do custo estimado consumido • ${formatBRL(m.custoTotal)} de ${formatBRL(m.tetoTotal)}`;

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
      ? "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#14532D]"
      : (statusOp === "Pausada"
          ? "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
          : "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/15 text-white border border-white/25");
  }

  // Selo de Situação Financeira (Informativo, separado do status operacional)
  const badgeViab = document.getElementById("viabilidadeBadge");
  if (badgeViab) {
    badgeViab.className = `inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full border shadow-sm select-none whitespace-nowrap ${sit.corBadgeDesktop}`;
    badgeViab.title = sit.rotulo;
    badgeViab.innerHTML = `<span class="w-2 h-2 rounded-full shrink-0 ${sit.corDot}"></span> ${sit.rotuloCurto || sit.rotulo}`;
  }

  const mobBadgeViab = document.getElementById("mobViabilidadeBadge");
  if (mobBadgeViab) {
    mobBadgeViab.className = `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold border select-none whitespace-nowrap ${sit.corBadgeDesktop}`;
    mobBadgeViab.innerHTML = `<span class="w-1.5 h-1.5 rounded-full shrink-0 ${sit.corDot}"></span> ${sit.rotuloCurto || sit.rotulo}`;
  }

  // Mobile Hero Card
  const mobObraNome = document.getElementById("mobObraNome");
  if (mobObraNome) mobObraNome.textContent = obra.nome;

  const mobCardSaldoBox = document.getElementById("mobCardSaldoBox");
  if (mobCardSaldoBox) {
    mobCardSaldoBox.className = m.saldoAtual >= 0
      ? "relative z-10 rounded-2xl p-3.5 bg-[#16A34A]/20 border border-[#16A34A]/60 backdrop-blur-xs"
      : "relative z-10 rounded-2xl p-3.5 bg-rose-500/20 border border-rose-400/60 backdrop-blur-xs";
  }

  const mobSaldoLabel = document.getElementById("mobSaldoLabel");
  if (mobSaldoLabel) {
    mobSaldoLabel.textContent = isEmAndamento ? "Resultado Acumulado" : "Resultado Final";
    mobSaldoLabel.className = m.saldoAtual >= 0
      ? "text-xs font-extrabold uppercase tracking-wider text-[#86EFAC] whitespace-nowrap"
      : "text-xs font-extrabold uppercase tracking-wider text-rose-200 whitespace-nowrap";
  }

  const mobMargemRealizadaBadge = document.getElementById("mobMargemRealizadaBadge");
  if (mobMargemRealizadaBadge) {
    if (m.medLiquidaRecebida > 0) {
      mobMargemRealizadaBadge.textContent = `${m.margemRealizadaPerc >= 0 ? "+" : ""}${m.margemRealizadaPerc.toFixed(1)}% realizada`;
      mobMargemRealizadaBadge.className = m.saldoAtual >= 0
        ? "text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D] whitespace-nowrap shrink-0"
        : "text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B] whitespace-nowrap shrink-0";
    } else {
      mobMargemRealizadaBadge.textContent = "Sem medição";
      mobMargemRealizadaBadge.className = "text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/15 text-white/90 whitespace-nowrap shrink-0";
    }
  }

  const mobSaldoAtual = document.getElementById("mobSaldoAtual");
  if (mobSaldoAtual) {
    mobSaldoAtual.textContent = formatBRL(m.saldoAtual);
    mobSaldoAtual.className = m.saldoAtual >= 0
      ? "font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1"
      : "font-display text-2xl sm:text-3xl font-extrabold text-rose-200 tracking-tight mt-1";
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

  const mobLucroPrevistoLabel = document.getElementById("mobLucroPrevistoLabel");
  if (mobLucroPrevistoLabel) {
    mobLucroPrevistoLabel.textContent = m.excessoTetoProjetado > 0
      ? "Resultado Estimado (Acima do Teto):"
      : "Lucro se gastar todo o orçamento:";
  }

  const mobCriterioLucroSub = document.getElementById("mobCriterioLucroSub");
  if (mobCriterioLucroSub) {
    mobCriterioLucroSub.textContent = m.excessoTetoProjetado > 0
      ? `Se gastasse apenas o teto (${formatBRL(m.tetoTotal)}), o lucro seria ${formatBRL(m.lucroNoTetoPuro)}.`
      : `Calculado sobre o teto planejado de ${formatBRL(m.tetoTotal)}.`;
  }

  const mobLucroPrevistoValor = document.getElementById("mobLucroPrevistoValor");
  if (mobLucroPrevistoValor) {
    mobLucroPrevistoValor.textContent = formatBRL(m.saldoProjetadoFinal);
    mobLucroPrevistoValor.className = m.saldoProjetadoFinal >= 0
      ? "font-display text-base font-extrabold text-[#16A34A] shrink-0 whitespace-nowrap"
      : "font-display text-base font-extrabold text-rose-600 shrink-0 whitespace-nowrap";
  }

  const mobMargemProj = document.getElementById("mobMargemProj");
  if (mobMargemProj) {
    if (isEmAndamento) {
      const notaTeto = m.excessoTetoProjetado > 0 ? ` • Acima do teto em ${formatBRL(m.excessoTetoProjetado)}` : " se gastar o teto";
      mobMargemProj.textContent = `${m.margemProjetadaFinalPerc >= 0 ? "+" : ""}${m.margemProjetadaFinalPerc.toFixed(1)}% de margem estimada${notaTeto}`;
      mobMargemProj.className = m.saldoProjetadoFinal >= 0 ? "font-bold text-[#16A34A] leading-snug" : "font-bold text-rose-600 leading-snug";
    } else {
      mobMargemProj.textContent = `${m.margemRealizadaPerc >= 0 ? "+" : ""}${m.margemRealizadaPerc.toFixed(1)}% de margem final realizada`;
      mobMargemProj.className = m.saldoAtual >= 0 ? "font-bold text-[#16A34A] leading-snug" : "font-bold text-rose-600 leading-snug";
    }
  }

  // KPIs Desktop (4 Cartões Executivos Claros e Diferenciados)
  const kpiDescNotaTag = document.getElementById("kpiDescNotaTag");
  if (kpiDescNotaTag) kpiDescNotaTag.textContent = `-${obra.aliquotaImposto ?? 7.5}% NF`;

  const medDescPercInput = document.getElementById("medDescPerc");
  if (medDescPercInput && document.activeElement !== medDescPercInput) {
    medDescPercInput.value = String(obra.aliquotaImposto ?? 7.5);
  }

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
  if (kpiQtdLanc) kpiQtdLanc.textContent = `${m.qtdSaidas} lanç.`;

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

  if (cardSaldoBox) cardSaldoBox.className = `${sit.corCardDesktop} overflow-hidden flex flex-col justify-between`;
  if (cardSaldoLabel) {
    cardSaldoLabel.textContent = isEmAndamento ? "Resultado Acumulado" : "Resultado Final";
    cardSaldoLabel.className = m.saldoAtual >= 0
      ? "text-xs font-bold uppercase tracking-wider text-[#86EFAC] leading-tight"
      : "text-xs font-bold uppercase tracking-wider text-rose-200 leading-tight";
  }
  if (kpiSaldoFinal) kpiSaldoFinal.textContent = formatBRL(m.saldoAtual);

  if (kpiMargemPerc) {
    if (m.medLiquidaRecebida > 0) {
      kpiMargemPerc.textContent = `${m.margemRealizadaPerc >= 0 ? "+" : ""}${m.margemRealizadaPerc.toFixed(1)}%`;
    } else {
      kpiMargemPerc.textContent = "0%";
    }
    kpiMargemPerc.className = m.saldoAtual >= 0
      ? "text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D] whitespace-nowrap shrink-0"
      : "text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B] whitespace-nowrap shrink-0";
  }
  if (kpiSaldoSub) {
    kpiSaldoSub.textContent = `Recebido (${formatBRL(m.medLiquidaRecebida)}) − Despesas pagas (${formatBRL(m.custoTotal)})`;
    kpiSaldoSub.className = m.saldoAtual >= 0
      ? "text-xs text-emerald-100/90 mt-1.5 leading-snug"
      : "text-xs text-rose-100/90 mt-1.5 leading-snug";
  }

  // KPI 4: Lucro se gastar todo o orçamento / Resultado Final Estimado
  const kpiTetoLabel = document.getElementById("kpiTetoLabel");
  if (kpiTetoLabel) {
    kpiTetoLabel.textContent = m.excessoTetoProjetado > 0
      ? "Resultado Estimado (Acima do Teto)"
      : "Lucro se gastar todo o orçamento";
  }

  const kpiTetoValor = document.getElementById("kpiTetoValor");
  if (kpiTetoValor) kpiTetoValor.textContent = formatBRL(m.saldoProjetadoFinal);

  const badgeTeto = document.getElementById("kpiTetoPercBadge");
  if (badgeTeto) {
    badgeTeto.textContent = `${m.margemProjetadaFinalPerc >= 0 ? "+" : ""}${m.margemProjetadaFinalPerc.toFixed(1)}%`;
    badgeTeto.className = m.saldoProjetadoFinal >= 0
      ? "text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D] whitespace-nowrap shrink-0"
      : "text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 whitespace-nowrap shrink-0";
  }

  const kpiTetoSub = document.getElementById("kpiTetoSub");
  if (kpiTetoSub) {
    if (!(m.tetoTotal > 0)) {
      kpiTetoSub.textContent = "Defina o teto de custos para calcular o lucro";
    } else if (m.excessoTetoProjetado > 0) {
      kpiTetoSub.textContent = `Custo c/ pendências: ${formatBRL(m.custoTotalProjetado)} (+${formatBRL(m.excessoTetoProjetado)} acima do teto de ${formatBRL(m.tetoTotal)})`;
    } else {
      kpiTetoSub.textContent = `Cenário gastando todo o teto de ${formatBRL(m.tetoTotal)}`;
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
  gerarRelatorioImpressaoA4(obra, m);
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
    },
    {
      label: "Administração (ADM)",
      val: m.porTipoOficial.ADM,
      sub: "Despesas administrativas",
      dot: "bg-[#23396B]"
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
        <span class="w-1.5 h-1.5 rounded-full bg-[#B45309]"></span>Reembolso Pendente
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
        ✓ Reembolsado${compacto ? "" : dt}
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

async function marcarReembolsoLancamento(id, novoStatus) {
  const obra = getObraAtual();
  if (!obra) return;
  const anterior = (obra.lancamentos || []).find(l => l.id === id && !l.deletado);
  if (!anterior || anterior.movimento === "ENTRADA_CAIXA") return;
  const data = novoStatus === "REEMBOLSADO" ? await pedirDataPagamento("Data do reembolso") : "";
  if (novoStatus === "REEMBOLSADO" && !data) return;
  const item = estado.obras.find(o => o.id === obra.id)?.lancamentos?.find(l => l.id === id && !l.deletado);
  if (!item || item.reembolsoStatus !== anterior.reembolsoStatus) return;

  item.reembolsoStatus = novoStatus;
  if (novoStatus === "REEMBOLSADO") {
    item.reembolsadoEm = data;
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

async function quitarReembolsosTitular(titularId) {
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
  const data = await pedirDataPagamento(`Quitar ${pendentes.length} reembolso(s) de ${nome} • ${formatBRL(soma)}`);
  if (!data) return;
  const ids = new Set(pendentes.map(item => item.id));
  const atuais = estado.obras.find(o => o.id === obra.id)?.lancamentos || [];
  const agora = new Date().toISOString();
  atuais.filter(item => ids.has(item.id) && !item.deletado && item.reembolsoStatus === "PENDENTE").forEach(item => {
    item.reembolsoStatus = "REEMBOLSADO";
    item.reembolsadoEm = data;
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
    sel.value = filtroValor === "REEMBOLSO_PENDENTE" ? "TODOS" : filtroValor;
    filtrarStatusReembolso(filtroValor === "REEMBOLSO_PENDENTE" ? "PENDENTE" : "");
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
const PAGINA_LANCAMENTOS_MOBILE = 20;
let limiteLancamentosMobile = PAGINA_LANCAMENTOS_MOBILE;
let filtrosLancamentosAnteriores = "";
let filtroStatusReembolso = "";

function filtrarStatusReembolso(status) {
  const responsavel = document.getElementById("filtroTitular");
  if (responsavel.value === "REEMBOLSO_PENDENTE") responsavel.value = "TODOS";
  filtroStatusReembolso = status;
  document.querySelectorAll("[data-filtro-reembolso]").forEach(botao => {
    botao.setAttribute("aria-pressed", String(botao.dataset.filtroReembolso === status));
  });
  renderizarTabelaLancamentos();
}

function mostrarMaisLancamentos() {
  limiteLancamentosMobile += PAGINA_LANCAMENTOS_MOBILE;
  renderizarTabelaLancamentos();
}

function renderizarTabelaLancamentos() {
  const obra = getObraAtual();
  if (!obra) return;
  const busca = (document.getElementById("filtroBusca")?.value || "").toLowerCase().trim();
  const cat = document.getElementById("filtroCategoria")?.value || "TODOS";
  const tit = document.getElementById("filtroTitular")?.value || "TODOS";

  const filtros = JSON.stringify([obra.id, busca, cat, tit, filtroStatusReembolso]);
  if (filtros !== filtrosLancamentosAnteriores) limiteLancamentosMobile = PAGINA_LANCAMENTOS_MOBILE;
  filtrosLancamentosAnteriores = filtros;
  const filtrados = (obra.lancamentos || []).filter(item => {
    if (item.deletado) return false;
    if (filtroStatusReembolso && (item.movimento === "ENTRADA_CAIXA" || item.reembolsoStatus !== filtroStatusReembolso)) return false;
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

  document.getElementById("maisLancamentosMobile").classList.toggle("hidden", filtrados.length <= limiteLancamentosMobile);

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
    containerMob.innerHTML = filtrados.slice(0, limiteLancamentosMobile).map(item => {
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
  if (sub === "ADM") return "Administração (ADM)";
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
  document.getElementById("obraLancRapido").textContent = getObraAtual()?.nome || "";
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

  const hoje = dataLocalHoje();
  const inputData = document.getElementById("lancRapidoData");
  if (inputData) inputData.value = hoje;

  const selSub = document.getElementById("lancRapidoSubtipo");
  if (selSub) selSub.value = "AUTO";

  const selMov = document.getElementById("lancRapidoMovimento");
  if (selMov) selMov.value = "SAIDA";

  // Seleciona EMTEC por padrão em 1 toque (sem reembolso)
  selecionarTitularRapido("EMTEC", false);
  selecionarStatusReembolsoRapido("NAO_REEMBOLSAVEL");

  // Categoria é sugerida pela descrição (ou escolhida em 1 toque); começa sem escolha
  categoriaRapidaAtiva = "";
  categoriaRapidaManual = false;
  ["MO", "MAT", "EQUIP", "OUTROS", "ADM", "ALIM"].forEach(cat => {
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

  document.getElementById("obraLancRapido").textContent = getObraAtual()?.nome || "";
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
  if (item.reembolsoStatus === "REEMBOLSADO") {
    document.getElementById("lancRapidoDataReembolso").value = item.reembolsadoEm || "";
    document.getElementById("lancRapidoDataReembolso").required = Boolean(item.reembolsadoEm);
  }

  const selPag = document.getElementById("lancRapidoPagamento");
  if (selPag) selPag.value = item.pagamento || "PIX";

  const selEmp = document.getElementById("lancRapidoEmpreitaId");
  if (selEmp) selEmp.value = item.empreitaId || "";

  const selMov = document.getElementById("lancRapidoMovimento");
  if (selMov) selMov.value = item.movimento === "ENTRADA_CAIXA" ? "ENTRADA_CAIXA" : "SAIDA";

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

  const boxReemb = document.getElementById("boxReembolsoRapido");
  if (boxReemb) {
    if (titularRapidoAtivo === "EMTEC") {
      boxReemb.classList.add("hidden");
    } else {
      boxReemb.classList.remove("hidden");
    }
  }

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
  configurarDataReembolso("lancRapidoDataReembolso", status);

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
  ["MO", "MAT", "EQUIP", "OUTROS", "ADM", "ALIM"].forEach(cat => {
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

function ajustarValorPagoEmpreita(obra, empreitaId, deltaValor) {
  if (!obra || !empreitaId || !Array.isArray(obra.empreitas)) return;
  const emp = obra.empreitas.find(e => e.id === empreitaId && !e.deletado);
  if (!emp) return;
  const atual = Number(emp.valorPago || 0);
  emp.valorPago = arredondarMoeda(Math.max(0, atual + Number(deltaValor || 0)));
  tocar(emp);
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
  const movSelect = document.getElementById("lancRapidoMovimento");

  const rawVal = String(valorInput?.value || "").replace(",", ".");
  const valor = parseFloat(rawVal);
  const descricao = (descInput?.value || "").trim();
  const data = dataInput?.value || dataLocalHoje();
  const titular = (titSelect?.value || titularRapidoAtivo || "EMTEC").toUpperCase();
  const movimento = movSelect?.value === "ENTRADA_CAIXA" ? "ENTRADA_CAIXA" : "SAIDA";
  const isEntrada = movimento === "ENTRADA_CAIXA";
  const reembolsoStatus = isEntrada ? "NAO_REEMBOLSAVEL" : (reembSelect?.value || statusReembolsoRapidoAtivo || "NAO_REEMBOLSAVEL");
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

  const subtipo = isEntrada ? "ENTRADA_CAIXA" : detectarSubtipo(descricao, categoriaRapidaAtiva, subtipoManual);
  const dataReembolso = document.getElementById("lancRapidoDataReembolso").value;

  if (idEdicao) {
    const idx = obra.lancamentos.findIndex(l => l.id === idEdicao);
    if (idx !== -1) {
      const anterior = obra.lancamentos[idx];
      if (!anterior.deletado && anterior.empreitaId && anterior.movimento !== "ENTRADA_CAIXA") {
        ajustarValorPagoEmpreita(obra, anterior.empreitaId, -Number(anterior.valor || 0));
      }
      if (empreitaId && !isEntrada) {
        ajustarValorPagoEmpreita(obra, empreitaId, valor);
      }
      obra.lancamentos[idx] = {
        ...anterior,
        descricao,
        tipo: normalizarTipoOficial(categoriaRapidaAtiva),
        subtipo,
        subtipoManual: (!isEntrada && subtipoManual !== "AUTO") ? subtipoManual : undefined,
        valor,
        data,
        pagamento,
        titular,
        reembolsoStatus,
        reembolsadoEm: reembolsoStatus === "REEMBOLSADO" ? dataReembolso || undefined : undefined,
        movimento,
        empreitaId: empreitaId || undefined,
        atualizadoEm: new Date().toISOString()
      };
    }
    mostrarNotificacaoToast(`Despesa atualizada com sucesso!`);
  } else {
    const novo = {
      id: novoId("lanc"),
      descricao,
      tipo: normalizarTipoOficial(categoriaRapidaAtiva),
      subtipo,
      subtipoManual: (!isEntrada && subtipoManual !== "AUTO") ? subtipoManual : undefined,
      valor,
      data,
      dataOriginal: data,
      pagamento,
      titular,
      reembolsoStatus,
      reembolsadoEm: reembolsoStatus === "REEMBOLSADO" ? dataReembolso || undefined : undefined,
      movimento,
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
function configurarDataReembolso(id, status, valor) {
  const campo = document.getElementById(id);
  const pago = status === "REEMBOLSADO";
  campo.closest("div").classList.toggle("hidden", !pago);
  campo.required = pago;
  campo.max = dataLocalHoje();
  campo.value = pago ? (valor ?? campo.value) || campo.max : "";
}

function atualizarDataReembolsoDesktop() {
  configurarDataReembolso("lancDataReembolso", document.getElementById("lancReembolsoStatus").value);
}

function aoMudarQuemPagouDesktop() {
  const tit = document.getElementById("lancTitular")?.value || "EMTEC";
  const selReemb = document.getElementById("lancReembolsoStatus");
  if (!selReemb) return;
  if (getTipoResponsavel(tit) === "RECURSO_PROPRIO") {
    selReemb.value = "PENDENTE";
  } else {
    selReemb.value = "NAO_REEMBOLSAVEL";
  }
  atualizarDataReembolsoDesktop();
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
  const data = document.getElementById("lancData")?.value || dataLocalHoje();
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
  const dataReembolso = document.getElementById("lancDataReembolso").value;
  const reembFinal = isEntrada ? "NAO_REEMBOLSAVEL" : reembolsoStatus;

  if (idEdicao) {
    const idx = obra.lancamentos.findIndex(l => l.id === idEdicao);
    if (idx !== -1) {
      const anterior = obra.lancamentos[idx];
      if (!anterior.deletado && anterior.empreitaId && anterior.movimento !== "ENTRADA_CAIXA") {
        ajustarValorPagoEmpreita(obra, anterior.empreitaId, -Number(anterior.valor || 0));
      }
      if (empreitaId) {
        ajustarValorPagoEmpreita(obra, empreitaId, valor);
      }
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
        reembolsadoEm: reembFinal === "REEMBOLSADO" ? dataReembolso || undefined : undefined,
        movimento: isEntrada ? "ENTRADA_CAIXA" : "SAIDA",
        empreitaId: empreitaId || undefined,
        atualizadoEm: new Date().toISOString()
      };
    }
  } else {
    const novo = {
      id: novoId("lanc"),
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
      reembolsadoEm: reembFinal === "REEMBOLSADO" ? dataReembolso || undefined : undefined,
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
  const hoje = dataLocalHoje();
  const d = document.getElementById("lancData");
  if (d) d.value = hoje;
  const selTit = document.getElementById("lancTitular");
  if (selTit) selTit.value = "EMTEC";
  const selReemb = document.getElementById("lancReembolsoStatus");
  if (selReemb) selReemb.value = "NAO_REEMBOLSAVEL";
  atualizarDataReembolsoDesktop();
  const selSub = document.getElementById("lancSubtipoManual");
  if (selSub) selSub.value = "AUTO";
  atualizarPreviewSubtipoDesktop();
}

function excluirLancamento(id) {
  if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
  const obra = getObraAtual();
  const item = (obra.lancamentos || []).find(l => l.id === id);
  if (item) {
    if (!item.deletado && item.empreitaId && item.movimento !== "ENTRADA_CAIXA") {
      ajustarValorPagoEmpreita(obra, item.empreitaId, -Number(item.valor || 0));
    }
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
  const elContratoBruto = document.getElementById("medCardContratoBruto");
  const elContratoLiq = document.getElementById("medCardContratoLiq");
  const elRecLiq = document.getElementById("medCardRecebidoLiq");
  const elARecLiq = document.getElementById("medCardAReceberLiq");
  if (m) {
    if (elContratoBruto) elContratoBruto.textContent = formatBRL(m.medBrutaTotalContrato);
    if (elContratoLiq) elContratoLiq.textContent = formatBRL(m.medLiquidaTotalContrato);
    if (elRecLiq) elRecLiq.textContent = formatBRL(m.medLiquidaRecebida);
    if (elARecLiq) elARecLiq.textContent = formatBRL(m.medLiquidaAReceber);
  }

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

          <p class="text-xs text-[#64748B]">Medição: ${formatDataBR(med.data)} • Recebimento: ${formatDataBR(med.recebidoEm)}</p>
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
          ${med.titulo}<div class="text-xs text-[#64748B]">Medição: ${formatDataBR(med.data)} • Recebimento: ${formatDataBR(med.recebidoEm)}</div>
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
  const dataMedicao = document.getElementById("medData").value;
  const dataRecebimento = document.getElementById("medDataRecebimento").value;
  if (!dataMedicao || (status === "Recebida" && (!dataRecebimento || dataRecebimento > dataLocalHoje()))) return;
  const valorLiquido = Math.round(valorBruto * (1 - descontoNotaPerc / 100) * 100) / 100;

  if (!obra.medicoes) obra.medicoes = [];
  obra.medicoes.push({
    id: novoId("med"),
    titulo,
    data: dataMedicao,
    recebidoEm: status === "Recebida" ? dataRecebimento : undefined,
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

function atualizarDataRecebimento() {
  const recebido = document.getElementById("medStatus").value === "Recebida";
  const campo = document.getElementById("medDataRecebimento");
  campo.closest("div").classList.toggle("hidden", !recebido);
  campo.required = recebido;
}

function toggleFormNovaMedicao() {
  const container = document.getElementById("containerFormMedicao");
  const btnTxt = document.getElementById("btnToggleMedicaoTexto");
  if (!container) return;
  const isHidden = container.classList.contains("hidden");
  if (isHidden) {
    document.getElementById("medData").value = dataLocalHoje();
    const recebidoEm = document.getElementById("medDataRecebimento");
    recebidoEm.value = dataLocalHoje();
    recebidoEm.max = recebidoEm.value;
    atualizarDataRecebimento();
    container.classList.remove("hidden");
    if (btnTxt) btnTxt.textContent = "✕ Fechar";
    document.getElementById("medTitulo")?.focus();
  } else {
    container.classList.add("hidden");
    if (btnTxt) btnTxt.textContent = "+ Nova Medição";
  }
}

async function alternarStatusMedicao(id) {
  const obra = getObraAtual();
  const anterior = obra?.medicoes?.find(m => m.id === id && !m.deletado);
  if (!anterior) return;
  const receber = anterior.status !== "Recebida";
  const data = receber ? await pedirDataPagamento("Data do recebimento") : "";
  if (receber && !data) return;
  const med = estado.obras.find(o => o.id === obra.id)?.medicoes?.find(m => m.id === id && !m.deletado);
  if (!med || med.status !== anterior.status) return;
  med.status = receber ? "Recebida" : "Pendente";
  med.recebidoEm = data || undefined;
  tocar(med);
  salvarEstado();
  atualizarTudo();
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

function editarValorContratoPrompt() {
  abrirModalEditarObra();
}

// --------------------------------------------------------------------------
// 9. RESUMO, ORÇAMENTO E GRÁFICOS
// --------------------------------------------------------------------------
function renderizarAbaResumo(obra, m) {
  const container = document.getElementById("orcamentoComparativoLista");
  if (!container) return;

  const categorias = GRUPOS_CUSTO.map(({ codigo, nome }) => ({
    key: codigo,
    nome,
    gasto: m.porTipoOficial[codigo],
    teto: m.orcamentoPrevisto[codigo],
    nota: codigo === "MO" ? "Inclui o orçamento legado de alimentação" :
      codigo === "OUTROS" ? "Inclui o orçamento legado de transporte" : ""
  }));

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
            <input type="number" step="0.01" min="0" data-orc-key="${c.key}" value="${teto}"
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
      <div class="flex justify-between text-[#343A40]"><span>Total Outros:</span><strong>${formatBRL(m.porTipoOficial.OUTROS)}</strong></div>
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
        labels: ["Material", "Mão de Obra Direta", "Equipamento", "Alimentação", "Combustível/Transp.", "Outros/Taxas", "Administração"],
        datasets: [{
          data: [
            m.porSubtipoReal.MAT,
            m.porSubtipoReal.MO,
            m.porSubtipoReal.EQUIP,
            m.porSubtipoReal.ALIM,
            m.porSubtipoReal.TRANSP,
            m.porSubtipoReal.OUTROS,
            m.porSubtipoReal.ADM
          ],
          backgroundColor: ["#23396B", "#4395D8", "#FF8C00", "#16A34A", "#002E6E", "#64748B", "#7C3AED"],
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
    id: novoId("emp"),
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
  sel.innerHTML = (options || '<option value="">Selecione uma obra</option>') + `<option value="__NOVA_OBRA__">+ Cadastrar Nova Obra...</option>`;
}

function trocarObra(id) {
  if (id === "__NOVA_OBRA__") {
    const sel = document.getElementById("obraSelect");
    if (sel) sel.value = obraAtualId;
    abrirModalNovaObra();
    return;
  }
  if (!estado.obras.some(obra => obra.id === id)) return;
  obraAtualId = id;
  renderizarSeletorObras();
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
  const abas = ["resumo", "lancamentos", "medicoes", "empreitas", "auditoria", "mais", "geral", "reembolsos"];

  if (abaId === "relatorios_menu") {
    abaId = "mais";
  }

  document.body.dataset.aba = abaId;
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
  if (navMobMais) navMobMais.className = (abaId === "mais" || abaId === "empreitas" || abaId === "auditoria" || abaId === "geral" || abaId === "reembolsos") ? "flex flex-col items-center gap-1 text-[#FF8C00] font-bold" : "flex flex-col items-center gap-1 text-white/70 hover:text-white";

  renderizarRelatoriosGerenciais();
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
  const idEdicao = document.getElementById("novaObraIdEdicao");
  const nome = document.getElementById("novaObraNome");
  const cliente = document.getElementById("novaObraCliente");
  const imp = document.getElementById("novaObraImposto");
  const valContrato = document.getElementById("novaObraValorContrato");
  const teto = document.getElementById("novaObraTetoCusto");
  const eyebrow = document.getElementById("modalObraEyebrow");
  const titulo = document.getElementById("modalObraTitulo");
  const btnSalvar = document.getElementById("btnSalvarModalObra");

  if (idEdicao) idEdicao.value = "";
  if (nome) nome.value = "";
  if (cliente) cliente.value = "";
  if (imp) imp.value = "7.5";
  if (valContrato) valContrato.value = "";
  if (teto) teto.value = "";
  if (eyebrow) eyebrow.textContent = "CENTRO DE CUSTO";
  if (titulo) titulo.textContent = "Cadastrar Nova Obra";
  if (btnSalvar) btnSalvar.textContent = "Criar Centro de Custo";

  const m = document.getElementById("modalNovaObra");
  if (m) {
    m.classList.remove("hidden");
    m.classList.add("flex");
  }
}

function abrirModalEditarObra() {
  const obra = getObraAtual();
  if (!obra) return;
  const met = calcularMetricasObra(obra);

  const idEdicao = document.getElementById("novaObraIdEdicao");
  const nome = document.getElementById("novaObraNome");
  const cliente = document.getElementById("novaObraCliente");
  const imp = document.getElementById("novaObraImposto");
  const valContrato = document.getElementById("novaObraValorContrato");
  const teto = document.getElementById("novaObraTetoCusto");
  const eyebrow = document.getElementById("modalObraEyebrow");
  const titulo = document.getElementById("modalObraTitulo");
  const btnSalvar = document.getElementById("btnSalvarModalObra");

  const contratoBruto = Number(obra.valorContratoBruto || 0) > 0
    ? Number(obra.valorContratoBruto)
    : Number(met.medBrutaTotal || 0);

  if (idEdicao) idEdicao.value = obra.id;
  if (nome) nome.value = obra.nome || "";
  if (cliente) cliente.value = obra.cliente || "";
  if (imp) imp.value = String(obra.aliquotaImposto ?? 7.5);
  if (valContrato) valContrato.value = contratoBruto > 0 ? String(contratoBruto) : "";
  if (teto) teto.value = met.tetoTotal > 0 ? String(met.tetoTotal) : "";
  if (eyebrow) eyebrow.textContent = "CONFIGURAÇÃO DA OBRA";
  if (titulo) titulo.textContent = "Editar Dados da Obra";
  if (btnSalvar) btnSalvar.textContent = "Salvar Alterações";

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
  const idEdicao = document.getElementById("novaObraIdEdicao")?.value?.trim() || "";
  const nome = document.getElementById("novaObraNome")?.value.trim();
  const cliente = document.getElementById("novaObraCliente")?.value.trim() || "Contrato";
  const impRaw = parseFloat(document.getElementById("novaObraImposto")?.value);
  const aliquotaImposto = !isNaN(impRaw) && impRaw >= 0 && impRaw < 100 ? impRaw : 7.5;
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

  // Modo Edição de Obra Existente
  if (idEdicao) {
    const obra = estado.obras.find(o => o.id === idEdicao) || getObraAtual();
    if (obra) {
      const aliquotaAntiga = Number(obra.aliquotaImposto ?? 7.5);
      const metAntiga = calcularMetricasObra(obra);
      const tetoAntigo = Number(metAntiga.tetoTotal || 0);

      obra.nome = nome;
      obra.cliente = cliente;
      obra.aliquotaImposto = aliquotaImposto;
      obra.valorContratoBruto = valorContrato > 0 ? arredondarMoeda(valorContrato) : 0;

      // Se a alíquota de NF mudou, atualiza as medições que usavam a alíquota padrão anterior
      if (Math.abs(aliquotaAntiga - aliquotaImposto) > 0.001 && Array.isArray(obra.medicoes)) {
        obra.medicoes.forEach(med => {
          if (med.deletado) return;
          const descMed = Number(med.descontoNotaPerc ?? aliquotaAntiga);
          if (Math.abs(descMed - aliquotaAntiga) < 0.01) {
            med.descontoNotaPerc = aliquotaImposto;
            med.valorLiquido = arredondarMoeda(Number(med.valorBruto || 0) * (1 - aliquotaImposto / 100));
            tocar(med);
          }
        });
      }

      if (Math.abs(tetoCusto - tetoAntigo) >= 0.005) {
        obra.orcamentoPrevisto = distribuirOrcamento(tetoCusto, tetoAntigo > 0 ? metAntiga.orcamentoPrevisto : undefined);
      }

      tocar(obra);
      salvarEstado();
      renderizarSeletorObras();
      fecharModalNovaObra();
      atualizarTudo();
      mostrarNotificacaoToast(`Dados da obra "${nome}" atualizados.`);
      return;
    }
  }

  const nova = {
    id: novoId("obra"),
    atualizadoEm: new Date().toISOString(),
    nome,
    cliente,
    status: "Em Andamento",
    dataInicio: dataLocalHoje(),
    aliquotaImposto,
    valorContratoBruto: valorContrato > 0 ? arredondarMoeda(valorContrato) : 0,
    orcamentoPrevisto: distribuirOrcamento(tetoCusto),
    medicoes: [],
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
  mudarAba("resumo");
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
  a.download = `backup-custos-emtec-${dataLocalHoje()}.json`;
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


function escaparCelula(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function linhasGeralObras() {
  const linhas = estado.obras.map(obra => {
    const m = calcularMetricasObra(obra);
    const contratado = Number(obra.valorContratoBruto || 0);
    const liquidoContratado = arredondarMoeda(contratado * (1 - Number(obra.aliquotaImposto ?? 7.5) / 100));
    return {
      "Obra": obra.nome,
      "Situação": obra.status || "Em Andamento",
      "Contrato bruto (R$)": contratado,
      "Contrato líquido (R$)": liquidoContratado,
      "Estimado (R$)": m.tetoTotal,
      "Gasto (R$)": m.custoTotal,
      "Consumo (%)": m.tetoTotal > 0 ? Number(m.percOrcamentoConsumido.toFixed(2)) : null,
      "Recebido (R$)": m.medLiquidaRecebida,
      "A reembolsar (R$)": m.totalReembolsosPendentes,
      "Alerta": m.alertaCusto ? (m.percOrcamentoConsumido > 100 ? "Acima do estimado" : "A partir de 70%") : "—"
    };
  });
  if (!linhas.length) return linhas;

  const total = { "Obra": "Total", "Situação": linhas.length + " obra(s)" };
  Object.keys(linhas[0]).filter(chave => chave.endsWith("(R$)")).forEach(chave => {
    total[chave] = arredondarMoeda(linhas.reduce((soma, linha) => soma + linha[chave], 0));
  });
  total["Consumo (%)"] = total["Estimado (R$)"] > 0
    ? Number((100 * total["Gasto (R$)"] / total["Estimado (R$)"]).toFixed(2)) : null;
  total["Alerta"] = linhas.filter(linha => linha.Alerta !== "—").length + " obra(s) em alerta";
  return [...linhas, total];
}

function linhasRelatorioReembolsos() {
  const obraId = document.getElementById("relReembObra").value;
  const pessoa = document.getElementById("relReembPessoa").value;
  const status = document.getElementById("relReembStatus").value;
  const inicio = document.getElementById("relReembInicio").value;
  const fim = document.getElementById("relReembFim").value;

  return estado.obras
    .filter(obra => !obraId || obra.id === obraId)
    .flatMap(obra => (obra.lancamentos || []).filter(item => {
      if (item.deletado || item.movimento === "ENTRADA_CAIXA") return false;
      if (!["PENDENTE", "REEMBOLSADO"].includes(item.reembolsoStatus)) return false;
      if (status && item.reembolsoStatus !== status) return false;
      if (pessoa && (item.titular || "EMTEC").toUpperCase() !== pessoa) return false;
      const data = item.reembolsoStatus === "REEMBOLSADO" ? item.reembolsadoEm : item.data;
      return (!inicio || (data && data >= inicio)) && (!fim || (data && data <= fim));
    }).map(item => ({
      "Obra": obra.nome,
      "Responsável": getNomeResponsavel(item.titular),
      "Descrição": item.descricao,
      "Data da despesa": item.data || "",
      "Data da baixa": item.reembolsadoEm || "",
      "Situação": item.reembolsoStatus === "REEMBOLSADO" ? "Pago" : "Pendente",
      "Valor (R$)": Number(item.valor || 0)
    })))
    .sort((a, b) => (b["Data da baixa"] || b["Data da despesa"]).localeCompare(a["Data da baixa"] || a["Data da despesa"]));
}

function tabelaGerencial(linhas, consolidado = false, linksObras = false) {
  if (!linhas.length) return '<p class="text-sm py-4">Nenhum registro encontrado.</p>';
  const colunas = Object.keys(linhas[0]);
  const titulo = colunas.map(coluna => '<th scope="col">' + escaparCelula(coluna) + '</th>').join("");
  const dados = linhas.map((linha, i) => {
    const celulas = colunas.map(coluna => {
      let valor = linha[coluna];
      if (coluna.endsWith("(R$)")) valor = formatBRL(valor);
      if (coluna === "Consumo (%)") valor = valor === null ? "—" : valor.toLocaleString("pt-BR") + "%";
      if (coluna.startsWith("Data ")) valor = formatDataBR(valor);
      const obra = linksObras && coluna === "Obra" ? estado.obras[i] : null;
      const conteudo = obra
        ? '<button type="button" data-abrir-obra="' + escaparCelula(obra.id) + '" class="link-obra">' + escaparCelula(valor) + '</button>'
        : escaparCelula(valor);
      return '<td data-coluna="' + escaparCelula(coluna) + '">' + conteudo + '</td>';
    }).join("");
    return '<tr' + (consolidado && i === linhas.length - 1 ? ' class="linha-total"' : '') + '>' + celulas + '</tr>';
  }).join("");
  return '<table class="tabela-gerencial"><thead><tr>' + titulo + '</tr></thead><tbody>' + dados + '</tbody></table>';
}

function resumoRelatorioReembolsos(linhas) {
  const soma = status => formatBRL(linhas.reduce((total, linha) => total + (linha.Situação === status ? linha["Valor (R$)"] : 0), 0));
  return "Pendentes: " + soma("Pendente") + " • Pagos: " + soma("Pago") + " • " + linhas.length + " registro(s)";
}

function renderizarRelatoriosGerenciais() {
  const aba = document.body.dataset.aba;
  if (aba === "geral") {
    document.getElementById("tabelaGeralObras").innerHTML = tabelaGerencial(linhasGeralObras(), true, true);
    return;
  }
  if (aba !== "reembolsos") return;
  const filtros = [
    ["relReembObra", "Todas as obras", estado.obras.map(obra => [obra.id, obra.nome])],
    ["relReembPessoa", "Todos os responsáveis", getResponsaveis().map(pessoa => [pessoa.id, pessoa.nome])]
  ];
  filtros.forEach(([id, rotulo, opcoes]) => {
    const campo = document.getElementById(id);
    const anterior = campo.value;
    campo.replaceChildren(new Option(rotulo, ""), ...opcoes.map(([valor, nome]) => new Option(nome, valor)));
    if (opcoes.some(([valor]) => valor === anterior)) campo.value = anterior;
  });
  atualizarRelatorioReembolsos();
}

function atualizarRelatorioReembolsos() {
  const linhas = linhasRelatorioReembolsos();
  document.getElementById("tabelaRelReembolsos").innerHTML = tabelaGerencial(linhas);
  document.getElementById("totaisRelReembolsos").textContent = resumoRelatorioReembolsos(linhas);
}

function baixarRelatorioGerencial(tipo, imprimir = false) {
  const geral = tipo === "geral";
  const titulo = geral ? "Geral de Obras" : "Relatório de Reembolsos";
  const linhas = geral ? linhasGeralObras() : linhasRelatorioReembolsos();
  const aba = geral ? "Geral de Obras" : "Reembolsos";
  if (imprimir) {
    const container = document.getElementById("relatorioImpressaoA4");
    const resumo = geral ? "" : "<p>" + escaparCelula(resumoRelatorioReembolsos(linhas)) + "</p>";
    container.innerHTML = '<h1 class="font-display font-bold text-lg">' + titulo + '</h1><p>Emitido em ' +
      formatDataBR(dataLocalHoje()) + '</p>' + resumo + tabelaGerencial(linhas, geral);
    window.print();
    return;
  }
  if (typeof XLSX === "undefined") return mostrarNotificacaoToast("Exportação Excel indisponível.");
  if (!linhas.length) return mostrarNotificacaoToast("Nenhum registro para exportar.");
  const livro = XLSX.utils.book_new();
  const planilha = XLSX.utils.json_to_sheet(linhas);
  planilha["!cols"] = Object.keys(linhas[0]).map(coluna => ({ wch: Math.max(16, coluna.length + 3, ["Obra", "Descrição"].includes(coluna) ? 38 : 0) }));
  XLSX.utils.book_append_sheet(livro, planilha, aba);
  XLSX.writeFile(livro, "EMTEC_" + tipo + "_" + dataLocalHoje() + ".xlsx");
}

function gerarRelatorioImpressaoA4(obraParam, mParam) {
  const container = document.getElementById("relatorioImpressaoA4");
  if (!container) return;
  const obra = obraParam || getObraAtual();
  if (!obra) return;
  const m = mParam || calcularMetricasObra(obra);
  const sit = m.situacao || avaliarSituacaoFinanceira(obra, m);
  const dataEmissao = formatDataBR(dataLocalHoje());
  const horaEmissao = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const categorias = GRUPOS_CUSTO.map(({ codigo, nome }) => ({
    codigo, nome, teto: m.orcamentoPrevisto[codigo], real: m.porTipoOficial[codigo]
  }));

  const rowsCatHtml = categorias.map(c => {
    const saldo = c.teto - c.real;
    const perc = c.teto > 0 ? ((c.real / c.teto) * 100).toFixed(1) + "%" : "Sem teto";
    return `
      <tr>
        <td style="padding:6px 8px;border:1px solid #CBD5E1;font-weight:700;color:#1E293B;">${c.codigo} — ${c.nome}</td>
        <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">${formatBRL(c.teto)}</td>
        <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">${formatBRL(c.real)}</td>
        <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;color:${saldo < 0 ? "#B91C1C" : "#15803D"};font-weight:700;">${formatBRL(saldo)}</td>
        <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">${perc}</td>
      </tr>
    `;
  }).join("");

  const medicoesAtivas = (obra.medicoes || []).filter(med => !med.deletado);
  const rowsMedHtml = medicoesAtivas.length === 0
    ? `<tr><td colspan="5" style="padding:8px;border:1px solid #CBD5E1;text-align:center;color:#64748B;">Nenhuma medição registrada até o momento.</td></tr>`
    : medicoesAtivas.map(med => {
        const bruto = Number(med.valorBruto || 0);
        const desc = Number(med.descontoNotaPerc ?? 7.5);
        const liq = med.valorLiquido ? Number(med.valorLiquido) : arredondarMoeda(bruto * (1 - desc / 100));
        return `
          <tr>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;font-weight:600;">${med.titulo}</td>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:center;">${formatDataBR(med.data)}${med.recebidoEm ? "<br>Recebido em " + formatDataBR(med.recebidoEm) : ""}</td>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:center;font-weight:700;color:${med.status === "Recebida" ? "#15803D" : "#B45309"};">${med.status === "Recebida" ? "Recebida" : "Pendente"}</td>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">${formatBRL(bruto)} (-${desc}%)</td>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">${formatBRL(liq)}</td>
          </tr>
        `;
      }).join("");

  const empreitasAtivas = (obra.empreitas || []).filter(e => !e.deletado);
  const rowsEmpHtml = empreitasAtivas.length === 0
    ? `<tr><td colspan="5" style="padding:8px;border:1px solid #CBD5E1;text-align:center;color:#64748B;">Nenhum contrato de empreiteiro cadastrado.</td></tr>`
    : empreitasAtivas.map(e => {
        const contratado = Number(e.valorContratado || 0);
        const pago = Number(e.valorPago || 0);
        const falta = Math.max(0, contratado - pago);
        return `
          <tr>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;font-weight:700;">${e.fornecedor}</td>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;">${e.servico || "-"}</td>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">${formatBRL(contratado)}</td>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;color:#15803D;font-weight:600;">${formatBRL(pago)}</td>
            <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;color:${falta > 0 ? "#B45309" : "#15803D"};font-weight:700;">${formatBRL(falta)}</td>
          </tr>
        `;
      }).join("");

  const reembEntries = Object.entries(m.reembolsosPorTitular || {});
  const rowsReembHtml = reembEntries.length === 0
    ? `<tr><td colspan="5" style="padding:8px;border:1px solid #CBD5E1;text-align:center;color:#64748B;">Nenhuma despesa registrada.</td></tr>`
    : reembEntries.map(([id, st]) => `
        <tr>
          <td style="padding:6px 8px;border:1px solid #CBD5E1;font-weight:700;">${getNomeResponsavel(id)}</td>
          <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:center;">${st.qtdTotal}</td>
          <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;font-weight:600;">${formatBRL(st.pagoTotal)}</td>
          <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;color:#15803D;">${formatBRL(st.reembolsado)}</td>
          <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;font-weight:700;color:${st.pendente > 0 ? "#B91C1C" : "#475569"};">${formatBRL(st.pendente)}</td>
        </tr>
      `).join("");

  const lancAtivos = (obra.lancamentos || [])
    .filter(l => !l.deletado)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const rowsLancHtml = lancAtivos.length === 0
    ? `<tr><td colspan="6" style="padding:8px;border:1px solid #CBD5E1;text-align:center;color:#64748B;">Nenhuma despesa lançada nesta obra.</td></tr>`
    : lancAtivos.map(l => {
        const reembTxt = l.reembolsoStatus === "PENDENTE"
          ? "Reemb. Pendente"
          : l.reembolsoStatus === "REEMBOLSADO"
            ? "Reembolsado" + (l.reembolsadoEm ? " em " + formatDataBR(l.reembolsadoEm) : "")
            : "Empresa / Direto";
        return `
          <tr>
            <td style="padding:5px 7px;border:1px solid #CBD5E1;white-space:nowrap;">${formatDataBR(l.data)}</td>
            <td style="padding:5px 7px;border:1px solid #CBD5E1;font-weight:600;">${l.descricao}</td>
            <td style="padding:5px 7px;border:1px solid #CBD5E1;">${l.movimento === "ENTRADA_CAIXA" ? "Adiant. Caixa" : `${l.tipo} (${l.subtipo || l.tipo})`}</td>
            <td style="padding:5px 7px;border:1px solid #CBD5E1;">${getNomeResponsavel(l.titular)}</td>
            <td style="padding:5px 7px;border:1px solid #CBD5E1;color:${l.reembolsoStatus === "PENDENTE" ? "#B91C1C" : "#475569"};">${reembTxt}</td>
            <td style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;font-weight:700;">${formatBRL(l.valor)}</td>
          </tr>
        `;
      }).join("");

  const rotuloResultadoFinal = m.excessoTetoProjetado > 0
    ? "RESULTADO FINAL ESTIMADO (ACIMA DO TETO)"
    : "LUCRO SE GASTAR TODO O ORÇAMENTO";

  container.innerHTML = `
    <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0F172A;font-size:11px;line-height:1.4;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #23396B;padding-bottom:10px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="/logo-emtec.png" alt="EMTEC Obras" style="height:38px;width:auto;object-fit:contain;" />
          <div>
            <div style="font-size:16px;font-weight:800;color:#23396B;letter-spacing:-0.02em;">RELATÓRIO EXECUTIVO DE CUSTOS E VIABILIDADE</div>
            <div style="font-size:11px;color:#475569;font-weight:600;">Obra: <strong>${obra.nome}</strong> | Cliente: <strong>${obra.cliente || "Contrato"}</strong> | Status: <strong>${obra.status || "Em Andamento"}</strong></div>
          </div>
        </div>
        <div style="text-align:right;font-size:10px;color:#475569;">
          <div><strong>Emissão:</strong> ${dataEmissao} às ${horaEmissao}</div>
          <div><strong>Diagnóstico:</strong> ${sit.rotulo}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
        <div style="border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;background:#F8FAFC;">
          <div style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;">1. Contrato Líquido (Após NF)</div>
          <div style="font-size:15px;font-weight:800;color:#23396B;margin-top:2px;">${formatBRL(m.medLiquidaTotal)}</div>
          <div style="font-size:9.5px;color:#64748B;">Bruto: ${formatBRL(m.medBrutaTotal)} | Recebido: <strong>${formatBRL(m.medLiquidaRecebida)}</strong></div>
        </div>
        <div style="border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;background:#F8FAFC;">
          <div style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;">2. Despesas Realizadas</div>
          <div style="font-size:15px;font-weight:800;color:#0F172A;margin-top:2px;">${formatBRL(m.custoTotal)}</div>
          <div style="font-size:9.5px;color:#64748B;">Teto: ${formatBRL(m.tetoTotal)} (${m.percOrcamentoConsumido.toFixed(1)}% usado)</div>
        </div>
        <div style="border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;background:#F8FAFC;">
          <div style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;">3. Resultado Acumulado Hoje</div>
          <div style="font-size:15px;font-weight:800;color:${m.saldoAtual >= 0 ? "#15803D" : "#B91C1C"};margin-top:2px;">${formatBRL(m.saldoAtual)}</div>
          <div style="font-size:9.5px;color:#64748B;">Recebido (${formatBRL(m.medLiquidaRecebida)}) − Gasto (${formatBRL(m.custoTotal)})</div>
        </div>
        <div style="border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;background:#F8FAFC;">
          <div style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;">4. ${rotuloResultadoFinal}</div>
          <div style="font-size:15px;font-weight:800;color:${m.saldoProjetadoFinal >= 0 ? "#23396B" : "#B91C1C"};margin-top:2px;">${formatBRL(m.saldoProjetadoFinal)}</div>
          <div style="font-size:9.5px;color:#64748B;">Margem Final: ${m.margemProjetadaFinalPerc.toFixed(1)}% | Custo Proj.: ${formatBRL(m.custoTotalProjetado)}</div>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:800;color:#23396B;text-transform:uppercase;margin-bottom:5px;">A. Orçamento Planejado (Teto) vs. Realizado por Categoria</div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
          <thead>
            <tr style="background:#EFF6FF;color:#1E3A8A;">
              <th style="padding:6px 8px;border:1px solid #CBD5E1;text-align:left;">Categoria Oficial</th>
              <th style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">Teto Planejado</th>
              <th style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">Realizado</th>
              <th style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">Saldo do Teto</th>
              <th style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">% Consumido</th>
            </tr>
          </thead>
          <tbody>
            ${rowsCatHtml}
            <tr style="background:#F1F5F9;font-weight:800;">
              <td style="padding:6px 8px;border:1px solid #CBD5E1;">TOTAL CONSOLIDADO DA OBRA</td>
              <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">${formatBRL(m.tetoTotal)}</td>
              <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">${formatBRL(m.custoTotal)}</td>
              <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;color:${m.tetoTotal - m.custoTotal < 0 ? "#B91C1C" : "#15803D"};">${formatBRL(m.tetoTotal - m.custoTotal)}</td>
              <td style="padding:6px 8px;border:1px solid #CBD5E1;text-align:right;">${m.percOrcamentoConsumido.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:9.5px;color:#475569;margin-top:4px;">
          <strong>Detalhamento Analítico (Incluso nas categorias acima):</strong> Alimentação (ALIM): <strong>${formatBRL(m.porSubtipoReal.ALIM)}</strong> | Combustível e Transporte (TRANSP): <strong>${formatBRL(m.porSubtipoReal.TRANSP)}</strong>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <div>
          <div style="font-size:11px;font-weight:800;color:#23396B;text-transform:uppercase;margin-bottom:5px;">B. Medições e Recebimentos do Cliente</div>
          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <thead>
              <tr style="background:#EFF6FF;color:#1E3A8A;">
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:left;">Parcela / Medição</th>
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:center;">Data</th>
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:center;">Status</th>
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;">Bruto (NF)</th>
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;">Líquido</th>
              </tr>
            </thead>
            <tbody>${rowsMedHtml}</tbody>
          </table>
        </div>
        <div>
          <div style="font-size:11px;font-weight:800;color:#23396B;text-transform:uppercase;margin-bottom:5px;">C. Prestação de Contas e Reembolsos</div>
          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <thead>
              <tr style="background:#EFF6FF;color:#1E3A8A;">
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:left;">Quem Pagou</th>
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:center;">Qtd</th>
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;">Total Pago</th>
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;">Reembolsado</th>
                <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;">A Reembolsar</th>
              </tr>
            </thead>
            <tbody>${rowsReembHtml}</tbody>
          </table>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:800;color:#23396B;text-transform:uppercase;margin-bottom:5px;">D. Contratos com Empreiteiros e Saldos a Pagar</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;">
          <thead>
            <tr style="background:#EFF6FF;color:#1E3A8A;">
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:left;">Empreiteiro / Fornecedor</th>
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:left;">Serviço Contratado</th>
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;">Valor Contratado</th>
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;">Total Já Pago</th>
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;">Saldo Pendente</th>
            </tr>
          </thead>
          <tbody>${rowsEmpHtml}</tbody>
        </table>
      </div>

      <div>
        <div style="font-size:11px;font-weight:800;color:#23396B;text-transform:uppercase;margin-bottom:5px;">E. Extrato Analítico de Despesas da Obra (${lancAtivos.length} lançamentos)</div>
        <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
          <thead>
            <tr style="background:#EFF6FF;color:#1E3A8A;">
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:left;">Data</th>
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:left;">Descrição da Despesa</th>
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:left;">Categoria</th>
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:left;">Quem Pagou</th>
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:left;">Situação Reembolso</th>
              <th style="padding:5px 7px;border:1px solid #CBD5E1;text-align:right;">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>${rowsLancHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

function imprimirRelatorioExecutivo() {
  const obra = getObraAtual();
  if (!obra) return;
  const m = calcularMetricasObra(obra);
  gerarRelatorioImpressaoA4(obra, m);
  window.print();
}

function exportarExcelObra() {
  const obra = getObraAtual();
  if (!obra) return;
  const m = calcularMetricasObra(obra);
  const sit = m.situacao || avaliarSituacaoFinanceira(obra, m);

  const rotuloResultadoFinal = m.excessoTetoProjetado > 0
    ? "Resultado Final Estimado (Acima do Teto) (R$)"
    : "Lucro se gastar todo o orçamento (Receita líquida - Teto) (R$)";

  const rowsResumo = [
    { "INDICADOR DA OBRA": "Nome da Obra", "VALOR / INFORMAÇÃO": obra.nome },
    { "INDICADOR DA OBRA": "Cliente / Contrato", "VALOR / INFORMAÇÃO": obra.cliente || "Contrato" },
    { "INDICADOR DA OBRA": "Status Operacional", "VALOR / INFORMAÇÃO": obra.status || "Em Andamento" },
    { "INDICADOR DA OBRA": "Situação Financeira", "VALOR / INFORMAÇÃO": sit.rotulo },
    { "INDICADOR DA OBRA": "Data de Emissão do Relatório", "VALOR / INFORMAÇÃO": formatDataBR(dataLocalHoje()) },
    { "INDICADOR DA OBRA": "--- RECEITAS E MEDIÇÕES ---", "VALOR / INFORMAÇÃO": "" },
    { "INDICADOR DA OBRA": "Valor Bruto Total do Contrato (R$)", "VALOR / INFORMAÇÃO": m.medBrutaTotal },
    { "INDICADOR DA OBRA": "Receita Líquida do Contrato após NF (R$)", "VALOR / INFORMAÇÃO": m.medLiquidaTotal },
    { "INDICADOR DA OBRA": "Total de Medições Lançadas (Bruto) (R$)", "VALOR / INFORMAÇÃO": m.somaMedicoesBruta },
    { "INDICADOR DA OBRA": "Valor Efetivamente Recebido na Conta (Líquido) (R$)", "VALOR / INFORMAÇÃO": m.medLiquidaRecebida },
    { "INDICADOR DA OBRA": "Medições Pendentes Faturadas (Líquido) (R$)", "VALOR / INFORMAÇÃO": m.medLiquidaPendente },
    { "INDICADOR DA OBRA": "Saldo Total a Receber do Contrato (Líquido) (R$)", "VALOR / INFORMAÇÃO": m.medLiquidaAReceber },
    { "INDICADOR DA OBRA": "--- DESPESAS REALIZADAS POR CATEGORIA ---", "VALOR / INFORMAÇÃO": "" },
    { "INDICADOR DA OBRA": "Material (MAT) (R$)", "VALOR / INFORMAÇÃO": m.porTipoOficial.MAT },
    { "INDICADOR DA OBRA": "Mão de Obra Geral (MO) (R$)", "VALOR / INFORMAÇÃO": m.porTipoOficial.MO },
    { "INDICADOR DA OBRA": "Equipamentos (EQUIP) (R$)", "VALOR / INFORMAÇÃO": m.porTipoOficial.EQUIP },
    { "INDICADOR DA OBRA": "Outros e Taxas (OUTROS) (R$)", "VALOR / INFORMAÇÃO": m.porTipoOficial.OUTROS },
    { "INDICADOR DA OBRA": "Administração (ADM) (R$)", "VALOR / INFORMAÇÃO": m.porTipoOficial.ADM },
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
    { "INDICADOR DA OBRA": "Lucro no Cenário do Teto (Receita Líquida - Teto) (R$)", "VALOR / INFORMAÇÃO": m.lucroNoTetoPuro },
    { "INDICADOR DA OBRA": rotuloResultadoFinal, "VALOR / INFORMAÇÃO": m.saldoProjetadoFinal },
    { "INDICADOR DA OBRA": "Margem Final Estimada (%)", "VALOR / INFORMAÇÃO": Number(m.margemProjetadaPerc.toFixed(2)) }
  ];

  const rowsOrcadoVsRealizado = GRUPOS_CUSTO.map(({ codigo, nome }) => {
    const teto = m.orcamentoPrevisto[codigo];
    const realizado = m.porTipoOficial[codigo];
    return {
      "CATEGORIA": nome,
      "TETO PLANEJADO (R$)": teto,
      "REALIZADO (R$)": realizado,
      "SALDO DO TETO (R$)": arredondarMoeda(teto - realizado),
      "% CONSUMIDO": teto > 0 ? Number((realizado / teto * 100).toFixed(2)) : 0
    };
  });
  rowsOrcadoVsRealizado.push({
    "CATEGORIA": "TOTAL CONSOLIDADO",
    "TETO PLANEJADO (R$)": m.tetoTotal,
    "REALIZADO (R$)": m.custoTotal,
    "SALDO DO TETO (R$)": arredondarMoeda(m.tetoTotal - m.custoTotal),
    "% CONSUMIDO": Number(m.percOrcamentoConsumido.toFixed(2))
  });

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

  rowsLanc.push({
    "DATA": "TOTAL",
    "DESCRIÇÃO": `Total de Despesas Realizadas (${rowsLanc.length} lançamentos)`,
    "CATEGORIA": "",
    "SUBCATEGORIA": "",
    "VALOR (R$)": m.custoTotal,
    "QUEM PAGOU": "",
    "STATUS REEMBOLSO": "",
    "MEIO DE PAGAMENTO": ""
  });

  const rowsMedicoes = (obra.medicoes || [])
    .filter(med => !med.deletado)
    .map(med => {
      const bruto = Number(med.valorBruto || 0);
      const desc = Number(med.descontoNotaPerc ?? 7.5);
      const liq = med.valorLiquido ? Number(med.valorLiquido) : Math.round(bruto * (1 - desc / 100) * 100) / 100;
      return {
        "PARCELA / MEDIÇÃO": med.titulo,
        "DATA DA MEDIÇÃO": formatDataBR(med.data),
        "DATA DO RECEBIMENTO": med.recebidoEm ? formatDataBR(med.recebidoEm) : "",
        "STATUS": med.status === "Recebida" ? "Recebida na Conta" : "A Receber (Pendente)",
        "VALOR BRUTO (R$)": bruto,
        "IMPOSTO NF (%)": desc,
        "VALOR LÍQUIDO (R$)": liq,
        "OBSERVAÇÃO": med.observacao || ""
      };
    });

  rowsMedicoes.push({
    "PARCELA / MEDIÇÃO": "TOTAL MEDIÇÕES CADASTRADAS",
    "DATA DA MEDIÇÃO": "",
    "DATA DO RECEBIMENTO": "",
    "STATUS": `Contrato Bruto: ${formatBRL(m.medBrutaTotal)}`,
    "VALOR BRUTO (R$)": m.somaMedicoesBruta,
    "IMPOSTO NF (%)": "",
    "VALOR LÍQUIDO (R$)": m.somaMedicoesLiquida,
    "OBSERVAÇÃO": `Recebido Líquido: ${formatBRL(m.medLiquidaRecebida)} | Falta Receber do Contrato: ${formatBRL(m.medLiquidaAReceber)}`
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
    wsRes["!cols"] = [{ wch: 56 }, { wch: 28 }];

    const wsOrc = XLSX.utils.json_to_sheet(rowsOrcadoVsRealizado);
    wsOrc["!cols"] = [{ wch: 34 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];

    const wsLanc = XLSX.utils.json_to_sheet(rowsLanc);
    wsLanc["!cols"] = [{ wch: 12 }, { wch: 38 }, { wch: 16 }, { wch: 16 }, { wch: 15 }, { wch: 24 }, { wch: 24 }, { wch: 18 }];

    const wsMed = XLSX.utils.json_to_sheet(rowsMedicoes);
    wsMed["!cols"] = [{ wch: 32 }, { wch: 18 }, { wch: 23 }, { wch: 24 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 44 }];

    const wsEmp = XLSX.utils.json_to_sheet(rowsEmpreitasEReemb);
    wsEmp["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 28 }, { wch: 32 }, { wch: 24 }, { wch: 22 }];

    XLSX.utils.book_append_sheet(wb, wsRes, "Resumo da Obra");
    XLSX.utils.book_append_sheet(wb, wsOrc, "Orcado vs Realizado");
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
  const hoje = dataLocalHoje();
  const inputData = document.getElementById("lancData");
  if (inputData) inputData.value = hoje;

  carregarPerfilUsuario();
  renderizarSeletorObras();
  atualizarTudo();

  if (innerWidth >= 768 || !getObraAtual()) mudarAba("geral");
  document.getElementById("tabelaGeralObras").addEventListener("click", evento => {
    const botao = evento.target.closest("[data-abrir-obra]");
    if (!botao) return;
    trocarObra(botao.dataset.abrirObra);
    mudarAba("resumo");
  });
  const header = document.querySelector(".ed-header");
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--altura-cabecalho", header.offsetHeight + "px");
  }).observe(header);

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
    navigator.serviceWorker.register("/sw.js").then(reg => { if (reg && reg.update) reg.update(); }).catch(() => {});
  }
}

window.addEventListener("DOMContentLoaded", inicializarApp);
