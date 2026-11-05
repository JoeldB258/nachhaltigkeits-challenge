/* Test der Bildvorschau: «Meine Fotos» im Register Tag und grosse Vorschau.
   node test/vorschau.cjs [adresse]   (nur Testnamen, räumt am Schluss auf) */
const { chromium, devices } = require("playwright");
const B = process.argv[2] || "http://localhost:8888/";
const OUT = __dirname + "/out/";
let ok = 0, nok = 0; const fehler = [];
const pruefe = (t, b, i) => { b ? ok++ : nok++; console.log((b ? "  OK   " : "  FEHLT ") + t + (i !== undefined ? "  (" + i + ")" : "")); };
(async () => {
  const proxy = !/localhost|127\.0\.0\.1/.test(B) && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch(proxy ? { proxy } : {});
  const gen = await browser.newPage(); await gen.setViewportSize({ width: 1200, height: 900 });
  for (const [n, f] of [["eins", "#17A600"], ["zwei", "#006BF2"], ["drei", "#E3B000"]]) {
    await gen.setContent(`<div style="width:1200px;height:900px;background:${f};color:#fff;font:bold 150px sans-serif;padding:150px;box-sizing:border-box">Bild ${n}</div>`);
    await gen.screenshot({ path: OUT + "v-" + n + ".jpg", type: "jpeg", quality: 90 });
  }
  await gen.close();
  async function person(name, geraet) {
    const ctx = await browser.newContext({ ...geraet, acceptDownloads: true });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => fehler.push(name + ": " + e.message));
    p.on("dialog", (d) => d.accept());
    await p.goto(B);
    await p.waitForFunction(() => document.getElementById("statusband").hidden === true, null, { timeout: 20000 });
    await p.selectOption("#personWahl", "andere");
    await p.fill("#kuerzelFeld", name); await p.locator("#kuerzelFeld").blur();
    await p.waitForTimeout(1500);
    return p;
  }
  const hoch = async (p, datei) => {
    await p.evaluate(() => { document.getElementById("fotoTagMeldung").textContent = ""; });
    await p.setInputFiles("#fotoTagFeld", OUT + datei);
    await p.waitForFunction(() => /oben|danke/i.test(document.getElementById("fotoTagMeldung").textContent), null, { timeout: 30000 });
  };
  const anna = await person("Test Vorschau Anna", devices["iPhone 13"]);
  const beat = await person("Test Vorschau Beat", devices["Pixel 7"]);
  console.log("Ziel: " + B + "\n1) Meine Fotos im Register Tag");
  await hoch(anna, "v-eins.jpg"); await hoch(anna, "v-zwei.jpg"); await hoch(beat, "v-drei.jpg");
  await anna.waitForFunction(() => document.querySelectorAll("#mfReihe .mfbild img").length === 2, null, { timeout: 20000 }).catch(() => {});
  pruefe("Anna sieht ihre 2 Fotos unter dem Foto-Knopf", await anna.locator("#mfReihe .mfbild").count() === 2, await anna.textContent(".mfkopf"));
  await anna.locator("#meineFotos").scrollIntoViewIfNeeded();
  await anna.screenshot({ path: OUT + "v1-meine-fotos.png" });
  await anna.locator("#mfReihe .weg").first().click();
  await anna.waitForFunction(() => document.querySelectorAll("#mfReihe .mfbild").length === 1, null, { timeout: 15000 }).catch(() => {});
  pruefe("Löschen per × in der Vorschau: noch 1 Foto", await anna.locator("#mfReihe .mfbild").count() === 1);
  pruefe("Beat hat keine eigenen Fotos in seiner Liste von Anna", await beat.locator("#mfReihe .mfbild").count() === 1, "nur sein eigenes");

  console.log("2) Grosse Vorschau");
  await anna.click("#rBilder");
  await anna.waitForFunction(() => document.querySelectorAll("#galerie .bildkachel img").length >= 2, null, { timeout: 20000 });
  const namen = await anna.$$eval("#galerie .bildkachel figcaption b", (b) => b.map((x) => x.textContent));
  const iBeat = namen.indexOf("Test Vorschau Beat"), iAnna = namen.indexOf("Test Vorschau Anna");
  await anna.locator("#galerie .bildkachel img").nth(iBeat).click();
  await anna.waitForSelector("#leuchte:not([hidden])");
  pruefe("Vorschau öffnet sich gross", await anna.isVisible("#lImg"), await anna.textContent("#lName"));
  pruefe("Bei fremdem Bild kein Löschen-Knopf", !(await anna.isVisible("#lWeg")));
  await anna.screenshot({ path: OUT + "v2-vorschau-fremd.png" });
  // zu Annas Bild blättern
  for (let k = 0; k < namen.length && (await anna.textContent("#lName")) !== "Test Vorschau Anna"; k++) await anna.click("#lWeiter");
  pruefe("Blättern führt zu Annas Bild", (await anna.textContent("#lName")) === "Test Vorschau Anna");
  pruefe("Bei eigenem Bild Löschen-Knopf sichtbar", await anna.isVisible("#lWeg"));
  await anna.screenshot({ path: OUT + "v3-vorschau-eigen.png" });
  const [dl] = await Promise.all([anna.waitForEvent("download", { timeout: 15000 }), anna.click("#lLaden")]);
  pruefe("Einzelnes Bild herunterladen", /\.jpg$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  await anna.click("#lWeg");
  await anna.waitForTimeout(2500);
  const rest = (await (await anna.request.get(B + "api?action=bilder")).json()).bilder.filter((b) => b.name === "Test Vorschau Anna");
  pruefe("Löschen in der grossen Vorschau: Annas Fotos auf dem Server weg", rest.length === 0, rest.length + " übrig");
  pruefe("Vorschau zeigt danach anderes Bild oder ist zu",
    (await anna.isHidden("#leuchte")) || (await anna.textContent("#lName")) !== "Test Vorschau Anna");
  await anna.keyboard.press("Escape");
  pruefe("Escape schliesst die Vorschau", await anna.isHidden("#leuchte"));
  await beat.waitForTimeout(16000); // Beats Gerät aktualisiert alle 15 s
  await beat.click("#rBilder");
  const beatSieht = await beat.$$eval("#galerie .bildkachel figcaption b", (b) => b.map((x) => x.textContent));
  pruefe("Beats Gerät sieht Annas gelöschte Fotos nicht mehr", !beatSieht.includes("Test Vorschau Anna"));

  console.log("3) Aufräumen");
  const alle = (await (await beat.request.get(B + "api?action=bilder")).json()).bilder.filter((b) => b.kennung.startsWith("frei-test-vorschau"));
  for (const b of alle) await beat.request.post(B + "api", { data: JSON.stringify({ action: "bildWeg", id: b.id, kennung: b.kennung }), headers: { "content-type": "text/plain" } });
  for (const k of ["frei-test-vorschau-anna", "frei-test-vorschau-beat"])
    await beat.request.post(B + "api", { data: JSON.stringify({ action: "standWeg", kennung: k }), headers: { "content-type": "text/plain" } });
  const uebrig = (await (await beat.request.get(B + "api?action=bilder")).json()).bilder.filter((b) => b.kennung.startsWith("frei-test-vorschau"));
  pruefe("Testbilder entfernt", uebrig.length === 0);
  console.log("JS-Fehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
  console.log("ERGEBNIS: " + ok + " bestanden, " + nok + " nicht bestanden");
  await browser.close(); process.exit(nok || fehler.length ? 1 : 0);
})().catch((e) => { console.error("ABBRUCH: " + e.message); process.exit(2); });
