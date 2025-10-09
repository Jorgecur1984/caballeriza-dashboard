// server.js
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== BASIC AUTH (protege todo excepto /health y /api/escritoir/*) ===== */
function basicAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="Kiosco Caballeriza"');
    return res.status(401).send("Autenticación requerida");
  }
  const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
  if (user === process.env.BASIC_USER && pass === process.env.BASIC_PASS) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Kiosco Caballeriza"');
  return res.status(401).send("No autorizado");
}

// Rutas PÚBLICAS primero (no protegidas)
app.head('/health', (_req, res) => res.sendStatus(200));
app.get('/health',  (_req, res) => res.sendStatus(200));

// Proxy público hacia Escritoir (tu front lo consume sin prompt del navegador)
app.get('/api/escritoir/dashboard', async (req, res) => {
  try {
    const apiUrl = process.env.ESCRITOIR_API_URL;
    const auth   = process.env.ESCRITOIR_AUTH; // "Token ..." o "Bearer ..."
    if (!apiUrl || !auth) {
      return res.status(500).json({ error: 'Falta ESCRITOIR_API_URL o ESCRITOIR_AUTH en variables de entorno' });
    }

    const url = new URL(apiUrl);
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null) url.searchParams.set(k, v);
    }

    const upstream = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': auth, 'Accept': 'application/json' }
    });

    const ct = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();
    res.status(upstream.status).type(ct).send(body);
  } catch (err) {
    console.error('Error en proxy /api/escritoir/dashboard:', err);
    res.status(502).json({ error: 'Falla consultando la API de Escritoir' });
  }
});

/* A partir de aquí, TODO requiere auth */
app.use(basicAuth);

// Estáticos protegidos (tu index.html y assets están en /public)
app.use(express.static(path.join(__dirname, 'public')));

// (Opcional) si usas SPA, servir index.html en otras rutas protegidas:
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Importante: 0.0.0.0 para Render/containers
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});



