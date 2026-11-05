/* Gemeinsamer Speicher der Nachhaltigkeits-Challenge.
   Ablage in Netlify Blobs:
     stand/<kennung>     Punktestand einer Person samt Rohdaten (für andere Geräte)
     bildmeta/<id>       Wer, wann, Beschreibung
     bild/<id>           Das Bild selbst als JPEG-Daten-URL                       */

const MAX_BODY = 1_200_000;          // eine Anfrage, inklusive Bild
const MAX_BILD = 900_000;            // Daten-URL eines Bildes, rund 650 KB JPEG
const MAX_BILDER = 400;              // Notbremse für die ganze Challenge
const MAX_DATEN = 60_000;            // Rohdaten einer Person als JSON

const KENNUNG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const BILD_ID = /^[a-z0-9-]{6,60}$/;
const JPEG = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

function antwort(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
const fehler = (text, status = 400) => antwort({ ok: false, fehler: text }, status);

function text(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function zahl(v, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/* Alle Schlüssel holen und selber filtern: robust, egal wie der Speicher
   Präfixe behandelt. Bei einigen hundert Einträgen ist das vernachlässigbar. */
async function schluessel(store, prefix) {
  const { blobs } = await store.list();
  return blobs.filter((b) => b.key.startsWith(prefix));
}

async function alleUnter(store, prefix) {
  const blobs = await schluessel(store, prefix);
  const werte = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null))
  );
  return werte.filter(Boolean);
}

function zusammenfassung(s) {
  return {
    kennung: s.kennung, name: s.name, person: s.person,
    tage: s.tage, oeko: s.oeko, sozial: s.sozial, woche: s.woche, schnitt: s.schnitt,
    zeit: s.zeit,
  };
}

function csvFeld(v) {
  const s = String(v == null ? "" : v);
  // Formel-Einschleusung in Excel verhindern
  const sicher = /^[=+\-@]/.test(s) ? "'" + s : s;
  return '"' + sicher.replace(/"/g, '""') + '"';
}

export async function verarbeite(req, store) {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const aktion = url.searchParams.get("action");

    if (aktion === "stand") {
      const alle = await alleUnter(store, "stand/");
      return antwort({ ok: true, stand: alle.map(zusammenfassung) });
    }

    if (aktion === "mein") {
      const k = url.searchParams.get("kennung") || "";
      if (!KENNUNG.test(k)) return fehler("kennung");
      const s = await store.get("stand/" + k, { type: "json" });
      return antwort({ ok: true, daten: s ? s.daten || null : null, zeit: s ? s.zeit || 0 : 0 });
    }

    if (aktion === "bilder") {
      const alle = await alleUnter(store, "bildmeta/");
      alle.sort((a, b) => b.zeit - a.zeit);
      return antwort({ ok: true, bilder: alle });
    }

    if (aktion === "bild") {
      const id = url.searchParams.get("id") || "";
      if (!BILD_ID.test(id)) return fehler("id");
      const jpg = await store.get("bild/" + id, { type: "text" });
      if (!jpg) return fehler("nicht gefunden", 404);
      return new Response(JSON.stringify({ ok: true, jpg }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          // Bilder ändern sich nie, nur löschen geht
          "cache-control": "private, max-age=86400, immutable",
        },
      });
    }

    if (aktion === "export") {
      const alle = (await alleUnter(store, "stand/")).sort((a, b) => b.schnitt - a.schnitt);
      const kopf = ["Name", "Tage erfasst", "Oekologie-Punkte", "Schnitt pro Tag",
                    "Gesundheit und Miteinander", "Region und Kreislauf", "Zuletzt gespeichert"];
      const zeilen = alle.map((s) => [
        s.name, s.tage, s.oeko, String(s.schnitt).replace(".", ","), s.sozial, s.woche,
        s.zeit ? new Date(s.zeit).toLocaleString("de-CH", { timeZone: "Europe/Zurich" }) : "",
      ]);
      const csv = "﻿" + [kopf, ...zeilen].map((z) => z.map(csvFeld).join(";")).join("\r\n");
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="nachhaltigkeits-challenge.csv"',
          "cache-control": "no-store",
        },
      });
    }

    return fehler("unbekannte Aktion");
  }

  if (req.method !== "POST") return fehler("Methode", 405);

  const roh = await req.text();
  if (roh.length > MAX_BODY) return fehler("zu gross", 413);
  let e;
  try { e = JSON.parse(roh); } catch { return fehler("json"); }
  if (!e || typeof e !== "object") return fehler("json");

  if (e.action === "stand") {
    const k = String(e.kennung || "");
    if (!KENNUNG.test(k)) return fehler("kennung");
    let daten = e.daten && typeof e.daten === "object" ? e.daten : null;
    if (daten && JSON.stringify(daten).length > MAX_DATEN) daten = null;
    const s = {
      kennung: k,
      name: text(e.name, 40) || "ohne Namen",
      person: text(e.person, 24),
      tage: Math.round(zahl(e.tage, 30)),
      oeko: Math.round(zahl(e.oeko, 400)),
      sozial: Math.round(zahl(e.sozial, 100)),
      woche: Math.round(zahl(e.woche, 20)),
      schnitt: Math.round(zahl(e.schnitt, 12) * 10) / 10,
      zeit: Math.round(zahl(e.zeit, 9e15)) || Date.now(),
      daten,
    };
    await store.setJSON("stand/" + k, s);
    return antwort({ ok: true });
  }

  if (e.action === "standWeg") {
    const k = String(e.kennung || "");
    if (!KENNUNG.test(k)) return fehler("kennung");
    await store.delete("stand/" + k);
    return antwort({ ok: true });
  }

  if (e.action === "bild") {
    const k = String(e.kennung || "");
    if (!KENNUNG.test(k)) return fehler("kennung");
    const jpg = String(e.jpg || "");
    if (jpg.length > MAX_BILD || !JPEG.test(jpg)) return fehler("bild");
    const metas = await schluessel(store, "bildmeta/");
    if (metas.length >= MAX_BILDER) return fehler("voll", 507);
    const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    await store.set("bild/" + id, jpg);
    await store.setJSON("bildmeta/" + id, {
      id, kennung: k, name: text(e.name, 40) || "ohne Namen",
      text: text(e.text, 120), zeit: Date.now(),
    });
    return antwort({ ok: true, id });
  }

  if (e.action === "bildWeg") {
    const id = String(e.id || "");
    const k = String(e.kennung || "");
    if (!BILD_ID.test(id) || !KENNUNG.test(k)) return fehler("id");
    const meta = await store.get("bildmeta/" + id, { type: "json" });
    if (!meta) return antwort({ ok: true });
    if (meta.kennung !== k) return fehler("nicht dein Bild", 403);
    await store.delete("bildmeta/" + id);
    await store.delete("bild/" + id);
    return antwort({ ok: true });
  }

  return fehler("unbekannte Aktion");
}
