// Service worker: deixa o app abrir sem internet (canteiro de obra).
// Estratégia: rede primeiro, cópia guardada como reserva. /api/* nunca é guardado.
const VERSAO = "emtec-v21";
const ARQUIVOS = [
  "/",
  "/index.html",
  "/app.js?v=21",
  "/styles.css",
  "/logo-emtec.png",
  "/favicon-emtec.png",
  "/vendor/chart.umd.js",
  "/vendor/xlsx.full.min.js"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(VERSAO)
      .then(cache => cache.addAll(ARQUIVOS.map(url => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n.startsWith("emtec-v") && n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fontes externas: navegador decide
  const navegacao = req.mode === "navigate" && ["/", "/index.html"].includes(url.pathname);
  if (!navegacao && !ARQUIVOS.includes(url.pathname + url.search)) return;

  ev.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const chave = navegacao ? url.pathname : req;
    try {
      const resposta = await fetch(req, { cache: "no-store" });
      if (resposta.ok) await cache.put(chave, resposta.clone()).catch(() => {});
      return resposta;
    } catch {
      return (await cache.match(chave)) || Response.error();
    }
  })());
});
