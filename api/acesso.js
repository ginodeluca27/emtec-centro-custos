import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { parseRequestBody } from './sync.js';
import { comandoRedis, configuracaoRedis } from '../lib/redis.js';
import { chaveAuth, criarSessao, encerrarSessao, lerSessao, resumo, segredo, tokenValido } from '../lib/sessao.js';

const derivar = promisify(scrypt);
const perfis = ['Melo', 'Pilar'];
const diasConvite = 7;
const registrarSenha = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  redis.call('SET', KEYS[2], ARGV[2])
  redis.call('SET', KEYS[3], ARGV[3])
  redis.call('DEL', KEYS[1])
  return 1
`;
const limitarTentativas = `
  local n = redis.call('INCR', KEYS[1])
  if n == 1 then redis.call('EXPIRE', KEYS[1], 900) end
  return n
`;

async function hashSenha(senha, salt) {
  return derivar(senha, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
}

async function confereSenha(senha, registro) {
  if (!registro) return false;
  const hash = await hashSenha(senha, registro.salt);
  return timingSafeEqual(hash, Buffer.from(registro.hash, 'hex'));
}

export default async function acesso(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const erro = (status, mensagem) => res.status(status).json({ error: mensagem });
  if (req.method !== 'POST') return erro(405, 'Método não permitido.');
  if (req.headers['sec-fetch-site'] === 'cross-site' || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    return erro(403, 'Abra o sistema para continuar.');
  }
  try {
    const redis = configuracaoRedis();
    if (!redis) return erro(503, 'Acesso por senha indisponível no momento.');
    const sinal = AbortSignal.timeout(8000);
    const comando = (...args) => comandoRedis(redis, args, sinal);
    const { acao, perfil, senha, token, lembrar } = await parseRequestBody(req) || {};

    if (acao === 'sair') {
      await encerrarSessao(req, res, redis, sinal);
      return res.status(200).json({ ok: true });
    }

    if (acao === 'convidar') {
      if (await lerSessao(req) !== 'Administrador') return erro(403, 'Entre como administrador.');
      if (!perfis.includes(perfil)) return erro(400, 'Selecione o perfil do convite.');
      const convite = segredo();
      await comando('SET', chaveAuth('convite', perfil), resumo(convite), 'EX', diasConvite * 86400);
      return res.status(200).json({ convite });
    }

    if (acao === 'cadastrar') {
      if (!perfis.includes(perfil) || !tokenValido(token)) return erro(400, 'Convite inválido.');
      if (typeof senha !== 'string' || Array.from(senha).length < 8 || senha.length > 128) {
        return erro(400, 'Escolha uma senha de 8 a 128 caracteres.');
      }
      const chave = chaveAuth('convite', perfil);
      const digest = resumo(token);
      if (await comando('GET', chave) !== digest) return erro(410, 'Convite vencido ou já usado. Peça um novo.');
      const salt = randomBytes(16).toString('hex');
      const versao = segredo();
      const registro = { salt, hash: (await hashSenha(senha, salt)).toString('hex'), versao };
      const gravou = await comando('EVAL', registrarSenha, 3, chave, chaveAuth('usuario', perfil),
        chaveAuth('versao', perfil), digest, JSON.stringify(registro), versao);
      if (gravou !== 1) return erro(410, 'Convite vencido ou já usado. Peça um novo.');
      return res.status(200).json({ perfil });
    }

    if (acao === 'entrar') {
      if (!perfis.includes(perfil) && perfil !== 'Administrador') return erro(400, 'Selecione o seu perfil.');
      if (typeof senha !== 'string' || !senha.length || senha.length > 128) return erro(401, 'Senha incorreta.');
      const ip = req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'local';
      const contador = chaveAuth('tentativas', resumo(String(ip) + ':' + perfil));
      if (await comando('EVAL', limitarTentativas, 1, contador) > 8) {
        return erro(429, 'Muitas tentativas. Aguarde 15 minutos para tentar de novo.');
      }
      const bruto = perfil === 'Administrador'
        ? process.env.EMTEC_ADMIN_CREDENCIAL
        : await comando('GET', chaveAuth('usuario', perfil));
      const registro = bruto ? JSON.parse(bruto) : null;
      if (!await confereSenha(senha, registro)) return erro(401, 'Senha incorreta.');
      await comando('DEL', contador);
      const versao = perfil === 'Administrador' ? resumo(bruto) : registro.versao;
      await criarSessao(res, redis, perfil, versao, lembrar === true, sinal);
      return res.status(200).json({ perfil });
    }

    return erro(400, 'Ação inválida.');
  } catch (error) {
    console.error('Falha no serviço de acesso:', error.name);
    return erro(503, 'Não foi possível acessar agora. Tente novamente.');
  }
}
