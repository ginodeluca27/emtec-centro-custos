// Service worker: deixa o app abrir sem internet (canteiro de obra).
// Estratégia: rede primeiro, cópia guardada como reserva. /api/* nunca é guardado.
const VERSAO = "emtec-v12";
const ARQUIVOS = [
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/logo-emtec.png",
  "/favicon-emtec.png",
  "/vendor/chart.umd.js",
  "/vendor/xlsx.full.min.js"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fontes externas: navegador decide
  if (url.pathname.startsWith("/api/") || url.pathname === "/data.js") return; // dados nunca passam pelo cache

  ev.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
        }
        return resp;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/index.html")))
  );
});
