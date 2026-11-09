import { put, list } from '@vercel/blob';
import { timingSafeEqual, createHash } from 'node:crypto';

const BLOB_NAME = 'emtec-database.json';

// O PIN deve ser configurado na variável de ambiente EMTEC_PIN no painel da Vercel.
// Caso ainda não tenha sido configurado na Vercel, usa um hash SHA-256 de contingência
// sem expor nenhum PIN em texto puro no código-fonte nem no navegador.
const FALLBACK_PIN_SHA256 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

function hash(s) {
  return createHash('sha256').update(String(s)).digest();
}

function pinConfere(informado) {
  if (!informado) return false;
  const informadoHash = hash(informado);
  const esperadoHash = process.env.EMTEC_PIN
    ? hash(process.env.EMTEC_PIN)
    : Buffer.from(FALLBACK_PIN_SHA256, 'hex');
  return timingSafeEqual(informadoHash, esperadoHash);
}

async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const raw = Buffer.concat(buffers).toString('utf-8');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// MESCLA POR REGISTRO (id + atualizadoEm). Nunca descarta um registro que só
// existe de um lado. Em conflito, o registro MAIS RECENTE vence por inteiro
// (inclusive exclusões, que são "tombstones": deletado=true + atualizadoEm).
// ---------------------------------------------------------------------------
function tempo(item) {
  const t = item && item.atualizadoEm ? new Date(item.atualizadoEm).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

export function mesclarColecaoPorId(itensA, itensB) {
  // A = payload do aparelho (vence empate), B = nuvem
  const mapA = new Map((itensA || []).filter(i => i && i.id).map(i => [i.id, i]));
  const mapB = new Map((itensB || []).filter(i => i && i.id).map(i => [i.id, i]));
  const ids = new Set([...mapB.keys(), ...mapA.keys()]);
  const saida = [];
  for (const id of ids) {
    const a = mapA.get(id);
    const b = mapB.get(id);
    if (!a) { saida.push(b); continue; }
    if (!b) { saida.push(a); continue; }
    saida.push(tempo(a) >= tempo(b) ? a : b);
  }
  return saida;
}

function corrigirLegado(l) {
  if (l && l.id === 'pisc-94' && l.tipo === 'EQUIP' && l.subtipo === 'ALIM' && !l.subtipoManual) {
    return { ...l, subtipo: 'EQUIP' };
  }
  return l;
}

export function mesclarEstados(payload, nuvem) {
  if (!nuvem || !Array.isArray(nuvem.obras)) return payload;
  const obrasNuvem = nuvem.obras;
  const idsPayload = new Set(payload.obras.map(o => o.id));

  const mescladas = payload.obras.map(obraP => {
    const obraC = obrasNuvem.find(o => o.id === obraP.id);
    if (!obraC) return obraP;
    // Campos da obra (status, tetos, nome...) seguem a versão mais recente da obra
    const base = tempo(obraP) >= tempo(obraC) ? { ...obraC, ...obraP } : { ...obraP, ...obraC };
    return {
      ...base,
      lancamentos: mesclarColecaoPorId(obraP.lancamentos, obraC.lancamentos).map(corrigirLegado),
      medicoes: mesclarColecaoPorId(obraP.medicoes, obraC.medicoes),
      empreitas: mesclarColecaoPorId(obraP.empreitas, obraC.empreitas)
    };
  });
  const soNuvem = obrasNuvem.filter(o => !idsPayload.has(o.id));

  const mapResp = new Map();
  [...(nuvem.responsaveis || []), ...(payload.responsaveis || [])].forEach(r => {
    if (r && r.id) mapResp.set(r.id, r);
  });

  return {
    ...nuvem,
    ...payload,
    responsaveis: Array.from(mapResp.values()),
    obras: [...mescladas, ...soNuvem]
  };
}

function estavel(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(estavel).join(',') + ']';
  if (valor && typeof valor === 'object') {
    return '{' + Object.keys(valor).sort().filter(k => valor[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + estavel(valor[k])).join(',') + '}';
  }
  return JSON.stringify(valor);
}

async function lerNuvem() {
  const { blobs } = await list({ prefix: BLOB_NAME, limit: 1 });
  const alvo = blobs.find(b => b.pathname === BLOB_NAME) || blobs[0];
  if (!alvo) return { dados: null, uploadedAt: null };
  const r = await fetch(alvo.url, { cache: 'no-store' });
  if (!r.ok) throw new Error('Falha ao ler dados da nuvem: ' + r.statusText);
  return { dados: await r.json(), uploadedAt: alvo.uploadedAt };
}

export default async function handler(req, res) {
  // Mesma origem apenas: nenhum cabeçalho CORS aberto.
  res.setHeader('Cache-Control', 'no-store');

  const pinCliente = req.headers['x-emtec-pin'];
  if (!pinConfere(pinCliente)) {
    // pequena espera para dificultar tentativa em massa
    await new Promise(r => setTimeout(r, 400));
    return res.status(401).json({ error: 'PIN de acesso incorreto.', codigo: 'PIN_INVALIDO' });
  }

  try {
    if (req.method === 'GET') {
      // Apenas verifica o PIN (usado na tela de entrada); não expõe dados.
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST') {
      const payload = await parseRequestBody(req);
      if (!payload || !Array.isArray(payload.obras)) {
        return res.status(400).json({ error: 'Formato de dados inválido: esperava { obras: [...] }' });
      }

      const { dados: nuvem } = await lerNuvem();
      const mesclado = mesclarEstados(payload, nuvem);

      // Só grava se algo mudou (evita escrita a cada 40s por aparelho)
      const mudou = !nuvem || estavel(nuvem) !== estavel(mesclado);
      if (mudou) {
        await put(BLOB_NAME, JSON.stringify(mesclado), {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json'
        });
      }

      // Devolve o estado mesclado: o aparelho adota SEM perder o que ainda não enviou
      return res.status(200).json({
        success: true,
        gravou: mudou,
        data: mesclado,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('Erro na API /api/sync:', error);
    return res.status(500).json({ error: 'Erro interno no servidor de sincronização.' });
  }
}
