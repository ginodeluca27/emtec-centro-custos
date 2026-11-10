import { get, put, BlobError, BlobPreconditionFailedError } from '@vercel/blob';
import { timingSafeEqual, createHash } from 'node:crypto';

const BLOB_NAME = 'emtec-database.json';

function hash(s) {
  return createHash('sha256').update(String(s)).digest();
}

const PIN_CONTINGENCIA_SHA256 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

function pinConfere(informado, esperado) {
  if (!informado) return false;
  const hashEsperado = esperado ? hash(esperado) : Buffer.from(PIN_CONTINGENCIA_SHA256, 'hex');
  return timingSafeEqual(hash(informado), hashEsperado);
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

async function lerNuvem(opcoes) {
  const blob = await get(BLOB_NAME, { ...opcoes, useCache: false });
  if (!blob) return { dados: null, etag: null };
  if (blob.statusCode !== 200 || !blob.blob.etag) throw new Error('Resposta inválida do armazenamento.');
  const dados = await new Response(blob.stream).json();
  if (!Array.isArray(dados?.obras)) throw new Error('Base na nuvem inválida.');
  return { dados, etag: blob.blob.etag };
}

export async function sincronizarEstado(payload, opcoes, legado) {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const { dados: nuvem, etag } = await lerNuvem(opcoes);
    // A primeira gravação no armazenamento privado preserva a base pública anterior.
    const anterior = nuvem ?? (legado ? (await lerNuvem(legado)).dados : null);
    const data = mesclarEstados(payload, anterior);
    if (nuvem && estavel(nuvem) === estavel(data)) return { data, gravou: false };
    if (!anterior && !data.obras.length && !data.responsaveis?.length) return { data, gravou: false };
    try {
      await put(BLOB_NAME, JSON.stringify(data), {
        ...opcoes,
        addRandomSuffix: false,
        allowOverwrite: Boolean(etag),
        ...(etag ? { ifMatch: etag } : {}),
        contentType: 'application/json'
      });
      return { data, gravou: true };
    } catch (erro) {
      // Uma criação simultânea sem ETag também precisa de nova leitura antes de mesclar.
      if (!(erro instanceof BlobError)) throw erro;
      if (etag && !(erro instanceof BlobPreconditionFailedError)) throw erro;
      if (!etag && !(await lerNuvem(opcoes)).etag) throw erro;
    }
  }
  return null;
}

export default async function handler(req, res) {
  // Mesma origem apenas: nenhum cabeçalho CORS aberto.
  res.setHeader('Cache-Control', 'no-store');

  const pin = process.env.EMTEC_PIN;
  if (!pinConfere(req.headers['x-emtec-pin'], pin)) {
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

      const tokenPrivado = process.env.EMTEC_BLOB_PRIVADO_TOKEN;
      const publico = { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN };
      const opcoes = tokenPrivado ? { access: 'private', token: tokenPrivado } : publico;
      const resultado = await sincronizarEstado(payload, opcoes, tokenPrivado && publico.token ? publico : null);
      if (!resultado) return res.status(409).json({ error: 'A base mudou durante a sincronização. Tente novamente.' });
      return res.status(200).json({ success: true, ...resultado, timestamp: new Date().toISOString() });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('Erro na API /api/sync:', error);
    return res.status(500).json({ error: 'Erro interno no servidor de sincronização.' });
  }
}
