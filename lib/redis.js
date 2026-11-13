export function configuracaoRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url && !token) return null;
  if (!url || !token) throw new Error('Configuração do Redis incompleta.');
  return { url, token };
}

export async function comandoRedis({ url, token }, comando, signal) {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando),
    cache: 'no-store',
    signal
  });
  if (!resposta.ok) throw new Error('Falha no Redis: HTTP ' + resposta.status);
  const json = await resposta.json();
  if (json.error || !Object.hasOwn(json, 'result')) throw new Error('O Redis rejeitou a operação.');
  return json.result;
}
