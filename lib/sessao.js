import { createHash, randomBytes } from 'node:crypto';
import { comandoRedis, configuracaoRedis } from './redis.js';

const COOKIE = '__Host-emtec-sessao';
const PREFIXO = 'emtec:auth:v1:';
export const chaveAuth = (tipo, id) => PREFIXO + tipo + ':' + id;
export const segredo = () => randomBytes(32).toString('base64url');
export const resumo = valor => createHash('sha256').update(valor).digest('hex');
const tokenValido = token => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
export { tokenValido };

function chaveSessao(req) {
  const cookie = (req.headers.cookie || '').split(';').map(item => item.trim())
    .find(item => item.startsWith(COOKIE + '='));
  const token = cookie?.slice(COOKIE.length + 1);
  return tokenValido(token) ? chaveAuth('sessao', resumo(token)) : null;
}

export async function lerSessao(req) {
  const chave = chaveSessao(req);
  if (!chave) return null;
  const redis = configuracaoRedis();
  if (!redis) return null;
  const sinal = AbortSignal.timeout(5000);
  const bruto = await comandoRedis(redis, ['GET', chave], sinal);
  if (!bruto) return null;
  const { perfil, versao } = JSON.parse(bruto);
  if (perfil === 'Administrador') {
    const credencial = process.env.EMTEC_ADMIN_CREDENCIAL;
    return credencial && versao === resumo(credencial) ? perfil : null;
  }
  const atual = await comandoRedis(redis, ['GET', chaveAuth('versao', perfil)], sinal);
  return versao === atual ? perfil : null;
}

export async function criarSessao(res, redis, perfil, versao, lembrar, sinal) {
  const token = segredo();
  const segundos = lembrar ? 30 * 86400 : 86400;
  await comandoRedis(redis, ['SET', chaveAuth('sessao', resumo(token)),
    JSON.stringify({ perfil, versao }), 'EX', segundos], sinal);
  const duracao = lembrar ? '; Max-Age=' + segundos : '';
  res.setHeader('Set-Cookie', COOKIE + '=' + token + '; Path=/; Secure; HttpOnly; SameSite=Strict' + duracao);
}

export async function encerrarSessao(req, res, redis, sinal) {
  const chave = chaveSessao(req);
  if (chave) await comandoRedis(redis, ['DEL', chave], sinal);
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');
}
