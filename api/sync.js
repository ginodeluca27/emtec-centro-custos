import { put, list } from '@vercel/blob';

const BLOB_NAME = 'emtec-database.json';
const VALID_PIN = process.env.EMTEC_PIN || '1234';

async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return null;
    }
  }
  // Se req.body for undefined (stream)
  try {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const raw = Buffer.concat(buffers).toString('utf-8');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-emtec-pin'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientPin = req.headers['x-emtec-pin'] || (req.query && req.query.pin);

  // Validação simples de PIN de segurança (Melo / Equipe EMTEC)
  if (clientPin && clientPin !== VALID_PIN) {
    return res.status(401).json({ error: 'PIN de acesso incorreto.' });
  }

  try {
    if (req.method === 'GET') {
      // 1. Procurar blob existente
      const { blobs } = await list({ prefix: BLOB_NAME, limit: 1 });
      const targetBlob = blobs.find((b) => b.pathname === BLOB_NAME) || blobs[0];

      if (!targetBlob) {
        return res.status(200).json({ exists: false, data: null, message: 'Banco ainda não inicializado na nuvem.' });
      }

      // Buscar conteúdo do blob
      const response = await fetch(targetBlob.url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Falha ao ler dados da nuvem: ' + response.statusText);
      }
      const data = await response.json();
      return res.status(200).json({
        exists: true,
        data,
        updatedAt: targetBlob.uploadedAt,
        url: targetBlob.url
      });
    }

    if (req.method === 'POST') {
      const payload = await parseRequestBody(req);
      if (!payload || !payload.obras) {
        return res.status(400).json({ error: 'Formato de dados inválido: esperava { obras: [...] }' });
      }

      // -----------------------------------------------------------------------
      // MERGE SEGURO: buscar estado atual da nuvem e mesclar por ID
      // Evita perda de dados em salvamentos simultâneos de dois dispositivos
      // -----------------------------------------------------------------------
      let estadoMesclado = payload;
      try {
        const { blobs } = await list({ prefix: BLOB_NAME, limit: 1 });
        const targetBlob = blobs.find((b) => b.pathname === BLOB_NAME) || blobs[0];
        if (targetBlob) {
          const resCloud = await fetch(targetBlob.url, { cache: 'no-store' });
          if (resCloud.ok) {
            const cloudData = await resCloud.json();
            if (cloudData && Array.isArray(cloudData.obras)) {
              // Para cada obra do payload, mesclar com a versão da nuvem
              const obrasCloud = cloudData.obras;
              const obrasMescladas = payload.obras.map(obraPayload => {
                const obraCloud = obrasCloud.find(o => o.id === obraPayload.id);
                if (!obraCloud) return obraPayload; // Obra nova — aceitar direto

                // -------------------------------------------------------------------
                // Função auxiliar de merge com suporte a Soft Delete e Timestamps
                // -------------------------------------------------------------------
                function mesclarColecaoPorId(itensPayload, itensCloud) {
                  const mapPayload = new Map((itensPayload || []).map(i => [i.id, i]));
                  const mapCloud = new Map((itensCloud || []).map(i => [i.id, i]));
                  const todosIds = new Set([...mapCloud.keys(), ...mapPayload.keys()]);

                  return Array.from(todosIds).map(id => {
                    const p = mapPayload.get(id);
                    const c = mapCloud.get(id);
                    if (!p) return c;
                    if (!c) return p;

                    // Compara timestamps para garantir que edições ou baixas de reembolso mais recentes vençam
                    const dataP = p.atualizadoEm ? new Date(p.atualizadoEm).getTime() : 0;
                    const dataC = c.atualizadoEm ? new Date(c.atualizadoEm).getTime() : 0;

                    if (p.deletado || c.deletado) {
                      return dataP >= dataC ? p : c;
                    }

                    return dataP >= dataC ? { ...c, ...p } : { ...p, ...c };
                  });
                }

                const lancamentosMesclados = mesclarColecaoPorId(obraPayload.lancamentos, obraCloud.lancamentos).map(l => {
                  if (l && l.id === 'pisc-94' && l.tipo === 'EQUIP' && l.subtipo === 'ALIM' && !l.subtipoManual) {
                    return { ...l, subtipo: 'EQUIP' };
                  }
                  return l;
                });
                const medicoesMescladas = mesclarColecaoPorId(obraPayload.medicoes, obraCloud.medicoes);
                const empreitasMescladas = mesclarColecaoPorId(obraPayload.empreitas, obraCloud.empreitas);

                return {
                  ...obraCloud,       // base da nuvem
                  ...obraPayload,     // campos escalares do payload têm prioridade
                  lancamentos: lancamentosMesclados,
                  medicoes: medicoesMescladas,
                  empreitas: empreitasMescladas
                };
              });

              // Preservar obras da nuvem que não estão no payload (não excluir)
              const idsPayload = new Set(payload.obras.map(o => o.id));
              const obrasApenasNaNuvem = obrasCloud.filter(o => !idsPayload.has(o.id));

              // Mesclar lista de responsáveis financeiros customizados
              const respCloud = Array.isArray(cloudData.responsaveis) ? cloudData.responsaveis : [];
              const respPayload = Array.isArray(payload.responsaveis) ? payload.responsaveis : [];
              const mapResp = new Map();
              [...respCloud, ...respPayload].forEach(r => {
                if (r && r.id) mapResp.set(r.id, r);
              });

              estadoMesclado = {
                ...cloudData,
                ...payload,
                responsaveis: Array.from(mapResp.values()),
                obras: [...obrasMescladas, ...obrasApenasNaNuvem]
              };
            }
          }
        }
      } catch (mergeErr) {
        // Se o merge falhar, usar o payload diretamente (fallback seguro)
        console.warn('Merge com nuvem falhou, usando payload direto:', mergeErr.message);
        estadoMesclado = payload;
      }

      const blob = await put(BLOB_NAME, JSON.stringify(estadoMesclado), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json'
      });

      return res.status(200).json({
        success: true,
        message: 'Dados mesclados e sincronizados com a nuvem Vercel Blob.',
        url: blob.url,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('Erro na API /api/sync:', error);
    return res.status(500).json({ error: error.message || 'Erro interno no servidor de sincronização.' });
  }
}
