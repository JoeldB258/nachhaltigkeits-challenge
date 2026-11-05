/* Lokaler Testserver: liefert public/ aus und /api über dieselbe Logik wie auf
   Netlify, mit dem offiziellen Blobs-Emulator als Speicher.
   Start: node test/dev-server.mjs  ->  http://localhost:8888 */
import http from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { BlobsServer } from "@netlify/blobs/server";
import { getStore } from "@netlify/blobs";
import { verarbeite } from "../lib/logik.mjs";

const wurzel = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "public");
const dir = await mkdtemp(path.join(tmpdir(), "blobs-"));
const blobs = new BlobsServer({ directory: dir, token: "lokal", port: 0 });
const { port: bport } = await blobs.start();
const store = getStore({ name: "challenge", siteID: "lokal", token: "lokal",
  apiURL: `http://localhost:${bport}` });

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:8888");
  if (url.pathname === "/api") {
    let body = "";
    for await (const c of req) body += c;
    const anfrage = new Request(url, { method: req.method,
      body: req.method === "POST" ? body : undefined });
    const a = await verarbeite(anfrage, store);
    res.writeHead(a.status, Object.fromEntries(a.headers));
    res.end(Buffer.from(await a.arrayBuffer()));
    return;
  }
  const datei = path.join(wurzel, url.pathname === "/" ? "index.html" : url.pathname);
  try {
    const inhalt = await readFile(datei);
    res.writeHead(200, { "content-type": datei.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain" });
    res.end(inhalt);
  } catch { res.writeHead(404); res.end("404"); }
}).listen(8888, () => console.log("bereit auf http://localhost:8888"));
