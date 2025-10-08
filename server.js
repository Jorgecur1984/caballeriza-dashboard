// server.js
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Node >=18 ya trae fetch global.
// Si usas Node <18, instala node-fetch e impórtalo.

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sirve archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Healthcheck para Render y el Worker de Cloudflare
app.head('/health', (_req, res) => res.sendStatus(200));
app.get('/health',  (_req, res) => res.sendStatus(200));

// Proxy simple hacia Escritoir
app.get('/api/escritoir/dashboard', async (req, res) => {
  try {
    const apiUrl = process.env.ESCRITOIR_API_URL;
    const auth   = process.env.ESCRITOIR_AUTH; // debe incluir "Token ..." o "Bearer ..."
    if (!apiUrl || !auth) {
      return res.status(500).json({ error: 'Falta ESCRITOIR_API_URL o ESCRITOIR_AUTH en variables de entorno' });
    }

    // Construye URL y pasa query params
    const url = new URL(apiUrl);
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null) url.searchParams.set(k, v);
    }

    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Accept': 'application/json'
      }
    });

    // Reenvía el status y el cuerpo tal cual
    const ct = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();
    res.status(upstream.status).type(ct).send(body);

  } catch (err) {
    console.error('Error en proxy /api/escritoir/dashboard:', err);
    res.status(502).json({ error: 'Falla consultando la API de Escritoir' });
  }
});

// Importante: 0.0.0.0 para Render/containers
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
