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

      // Salvar ou sobrescrever no Vercel Blob
      const blob = await put(BLOB_NAME, JSON.stringify(payload), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json'
      });

      return res.status(200).json({
        success: true,
        message: 'Dados sincronizados com a nuvem Vercel Blob com sucesso.',
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
