/* Mehrpersonen-Test, lokal oder gegen die echte Seite.
     node test/mehrpersonen.cjs                       -> http://localhost:8888/
     node test/mehrpersonen.cjs https://<adresse>/    -> echte Seite
   Arbeitet nur mit Testnamen («Test Anna», «Test Beat», «Test Carla») und
   räumt deren Einträge und Bilder am Schluss wieder weg. Echte Einträge des
   Teams werden weder verändert noch gelöscht. */
const { chromium, devices } = require("playwright");
const B = process.argv[2] || "http://localhost:8888/";
const OUT = __dirname + "/out/";
const NAMEN = { anna: "Test Anna", beat: "Test Beat", carla: "Test Carla" };
const KENNUNG = (n) => "frei-" + n.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const fehler = [];
let ok = 0, nok = 0;
function pruefe(text, bedingung, info) {
  if (bedingung) { ok++; console.log("  OK   " + text + (info ? "  (" + info + ")" : "")); }
  else { nok++; console.log("  FEHLT " + text + (info ? "  (" + info + ")" : "")); }
}
async function api(page, q) { return (await page.request.get(B + "api?" + q)).json(); }
async function post(page, obj) {
  return (await page.request.post(B + "api", { data: JSON.stringify(obj),
    headers: { "content-type": "text/plain" } })).json();
}
async function oeffne(browser, geraet, name, label) {
  const ctx = await browser.newContext(geraet);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => fehler.push(label + ": " + e.message));
  await p.goto(B);
  await p.waitForFunction(() => document.getElementById("statusband").hidden === true, null, { timeout: 20000 });
  if (name) {
    await p.selectOption("#personWahl", "andere");
    await p.fill("#kuerzelFeld", name);
    await p.locator("#kuerzelFeld").blur();
    await p.waitForTimeout(2500);
  }
  return { ctx, p };
}
async function tag(p, nr) {
  await p.locator("#tage button").nth(nr).click();
  await p.waitForTimeout(300);
}
async function tippe(p, text) {
  await p.getByRole("button", { name: text }).first().click();
  await p.waitForTimeout(700);
  await p.evaluate(() => typeof Effekt !== "undefined" && Effekt.schliesse());
}
async function warteAufServer(p, kennung, bedingung, ms = 15000) {
  const ende = Date.now() + ms;
  let s;
  while (Date.now() < ende) {
    const a = await api(p, "action=stand");
    s = a.stand.find((x) => x.kennung === kennung);
    if (s && bedingung(s)) return s;
    await p.waitForTimeout(800);
  }
  return s;
}

(async () => {
  /* In abgeschotteten Umgebungen (z.B. Cloud-Session mit Proxy) den Proxy
     nutzen, aber nur für die echte Seite, nicht für localhost. */
  const proxy = !/localhost|127\.0\.0\.1/.test(B) && process.env.HTTPS_PROXY
    ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch(proxy ? { proxy } : {});
  const gen = await browser.newPage();
  await gen.setViewportSize({ width: 1600, height: 1200 });
  await gen.setContent('<div style="width:1600px;height:1200px;background:linear-gradient(45deg,#17A600,#006BF2);color:#fff;font:bold 160px sans-serif;padding:200px;box-sizing:border-box">Testbild</div>');
  await gen.screenshot({ path: OUT + "testbild.jpg", type: "jpeg", quality: 92 });
  await gen.close();
  console.log("Ziel: " + B);

  // Vorher: echte Einträge merken, damit wir prüfen können, dass sie unberührt bleiben
  const probe = await browser.newPage();
  const vorher = (await api(probe, "action=stand")).stand.filter((s) => !s.kennung.startsWith("frei-test-"));
  const bilderVorher = (await api(probe, "action=bilder")).bilder.filter((b) => !b.kennung.startsWith("frei-test-"));

  console.log("\n1) Drei Personen auf drei Geräten tragen ein");
  const anna = await oeffne(browser, devices["iPhone 13"], NAMEN.anna, "Anna iPhone");
  await tag(anna.p, 0); await tippe(anna.p, /öffentlichen Verkehr/); await tippe(anna.p, /Keine Geschäftsreise/); await tippe(anna.p, /Fleischlos/);
  const beat = await oeffne(browser, devices["Pixel 7"], NAMEN.beat, "Beat Android");
  await tag(beat.p, 0); await tippe(beat.p, /Zu Fuss oder mit dem Velo/); await tippe(beat.p, /Ohne eigenes Auto/);
  await tag(beat.p, 1); await tippe(beat.p, /Allein mit dem Auto/); await tippe(beat.p, /Keine Geschäftsreise/);
  const carla = await oeffne(browser, { viewport: { width: 1400, height: 900 } }, NAMEN.carla, "Carla Laptop");
  await tag(carla.p, 0); await tippe(carla.p, /Im Homeoffice/); await tippe(carla.p, /Keine Geschäftsreise/);

  const sA = await warteAufServer(anna.p, KENNUNG(NAMEN.anna), (s) => s.oeko === 9);
  pruefe("Anna auf dem Server gespeichert: 9 Punkte, 1 Tag", sA && sA.oeko === 9 && sA.tage === 1, sA && sA.oeko + "P/" + sA.tage + "T");
  const sB = await warteAufServer(beat.p, KENNUNG(NAMEN.beat), (s) => s.tage === 2);
  pruefe("Beat gespeichert: 9 Punkte an 2 Tagen, Schnitt 4,5", sB && sB.oeko === 9 && sB.tage === 2 && sB.schnitt === 4.5, sB && sB.oeko + "P/" + sB.tage + "T/" + sB.schnitt);
  const sC = await warteAufServer(carla.p, KENNUNG(NAMEN.carla), (s) => s.oeko === 4);
  pruefe("Carla gespeichert: 4 Punkte", sC && sC.oeko === 4, sC && sC.oeko + "P");

  console.log("\n2) Live-Ansicht Team");
  await carla.p.click("#rTeam");
  await carla.p.waitForFunction((n) => n.every((x) => document.getElementById("vTeam").textContent.includes(x)),
    [NAMEN.anna, NAMEN.beat], { timeout: 25000 }).catch(() => {});
  const teamText = await carla.p.textContent("#vTeam");
  pruefe("Carla sieht Anna und Beat im Team ohne Neuladen", teamText.includes(NAMEN.anna) && teamText.includes(NAMEN.beat));
  pruefe("Echte Einträge bleiben im Team sichtbar", vorher.filter((s) => s.tage > 0).every((s) => teamText.includes(s.name)),
    vorher.filter((s) => s.tage > 0).map((s) => s.name).join(", ") || "keine");
  await carla.p.screenshot({ path: OUT + "live-team.png", fullPage: true });

  console.log("\n3) Fotos von verschiedenen Handys");
  await anna.p.click("#rTag");
  await anna.p.setInputFiles("#fotoTagFeld", OUT + "testbild.jpg");
  await anna.p.waitForFunction(() => /oben|danke/i.test(document.getElementById("fotoTagMeldung").textContent), null, { timeout: 30000 }).catch(() => {});
  pruefe("Anna lädt am iPhone im Register Tag hoch", /oben|danke/i.test(await anna.p.textContent("#fotoTagMeldung")), await anna.p.textContent("#fotoTagMeldung"));
  await beat.p.click("#rBilder");
  await beat.p.fill("#bildText", "Testbild mit Beschreibung");
  await beat.p.setInputFiles("#bildFeld", OUT + "testbild.jpg");
  await beat.p.waitForFunction(() => /oben|danke/i.test(document.getElementById("uploadmeldung").textContent), null, { timeout: 30000 }).catch(() => {});
  pruefe("Beat lädt am Android mit Beschreibung hoch", /oben|danke/i.test(await beat.p.textContent("#uploadmeldung")));
  await carla.p.click("#rBilder");
  await carla.p.waitForFunction((n) => {
    const t = document.getElementById("galerie").textContent;
    return n.every((x) => t.includes(x)) && document.querySelectorAll("#galerie img").length >= 2;
  }, [NAMEN.anna, NAMEN.beat], { timeout: 30000 }).catch(() => {});
  const gal = await carla.p.textContent("#galerie");
  pruefe("Carla sieht beide Fotos live", gal.includes(NAMEN.anna) && gal.includes(NAMEN.beat));
  pruefe("Beschreibung wird angezeigt", gal.includes("Testbild mit Beschreibung"));
  const knoepfe = await carla.p.locator("#galerie .weg").count();
  pruefe("Carla kann fremde Bilder nicht löschen (kein Knopf)", knoepfe === 0, knoepfe + " Knöpfe");
  const annaBild = (await api(carla.p, "action=bilder")).bilder.find((b) => b.kennung === KENNUNG(NAMEN.anna));
  const versuch = await post(carla.p, { action: "bildWeg", id: annaBild.id, kennung: KENNUNG(NAMEN.carla) });
  pruefe("Server verweigert Löschen fremder Bilder", versuch.ok === false, versuch.fehler);
  await carla.p.screenshot({ path: OUT + "live-bilder.png", fullPage: true });

  console.log("\n4) Gleiche Person auf zwei Geräten gleichzeitig");
  const anna2 = await oeffne(browser, { viewport: { width: 1280, height: 860 } }, NAMEN.anna, "Anna Laptop");
  await tag(anna2.p, 0);
  pruefe("Annas Laptop übernimmt den Stand vom iPhone", (await anna2.p.textContent("#zahl")).trim() === "9", "Tag 1: " + (await anna2.p.textContent("#zahl")).trim());
  await tag(anna2.p, 1); await tippe(anna2.p, /Zu Fuss oder mit dem Velo/); await tippe(anna2.p, /Keine Geschäftsreise/);
  await warteAufServer(anna2.p, KENNUNG(NAMEN.anna), (s) => s.tage === 2);
  // iPhone war die ganze Zeit offen und hat nichts neu geladen
  await anna.p.click("#rTag");
  await tag(anna.p, 2); await tippe(anna.p, /öffentlichen Verkehr/); await tippe(anna.p, /Ohne eigenes Auto/);
  const sA3 = await warteAufServer(anna.p, KENNUNG(NAMEN.anna), (s) => s.tage === 3);
  pruefe("Kein Tag geht verloren: 3 Tage, 9+7+6 = 22 Punkte", sA3 && sA3.tage === 3 && sA3.oeko === 22, sA3 && sA3.oeko + "P/" + sA3.tage + "T");

  console.log("\n5) Neu laden und neues Gerät");
  await anna.p.reload();
  await anna.p.waitForFunction(() => document.getElementById("statusband").hidden === true, null, { timeout: 20000 });
  await anna.p.waitForTimeout(1500);
  pruefe("Nach Neuladen am iPhone: 3 Tage", (await anna.p.textContent("#bTage")).trim() === "3", (await anna.p.textContent("#bTage")).trim());
  const annaNeu = await oeffne(browser, devices["Galaxy S9+"] || devices["Pixel 5"], NAMEN.anna, "Anna neues Handy");
  pruefe("Neues Handy, nur Name eingetippt: 3 Tage, 22 Punkte",
    (await annaNeu.p.textContent("#bTage")).trim() === "3" && (await annaNeu.p.textContent("#bTotal")).trim() === "22",
    (await annaNeu.p.textContent("#bTage")).trim() + " Tage, " + (await annaNeu.p.textContent("#bTotal")).trim() + " P");
  const sA4 = (await api(annaNeu.p, "action=stand")).stand.find((s) => s.kennung === KENNUNG(NAMEN.anna));
  pruefe("Neues Gerät hat den Stand nicht überschrieben", sA4 && sA4.oeko === 22, sA4 && sA4.oeko + "P");
  await carla.p.reload();
  await carla.p.waitForFunction(() => document.getElementById("statusband").hidden === true, null, { timeout: 20000 });
  await carla.p.click("#rBilder");
  await carla.p.waitForFunction(() => document.querySelectorAll("#galerie img").length >= 2, null, { timeout: 30000 }).catch(() => {});
  pruefe("Fotos sind nach Neuladen noch da", (await carla.p.locator("#galerie img").count()) >= 2);

  console.log("\n6) Auswertung");
  const csv = await (await carla.p.request.get(B + "api?action=export")).text();
  pruefe("CSV-Export enthält alle Testpersonen", Object.values(NAMEN).every((n) => csv.includes(n)));
  const [dl] = await Promise.all([carla.p.waitForEvent("download", { timeout: 60000 }), carla.p.click("#zipLaden")]);
  await dl.saveAs(OUT + "bilder.zip");
  const { execSync } = require("child_process");
  let zipOk = false, inhalt = "";
  try {
    execSync("unzip -tq " + OUT + "bilder.zip");
    inhalt = execSync("unzip -Z1 " + OUT + "bilder.zip").toString().trim().split("\n");
    zipOk = true;
  } catch (e) { inhalt = [e.message]; }
  const jpgs = zipOk ? inhalt.filter((n) => n.endsWith(".jpg")) : [];
  const alleBilder = (await api(carla.p, "action=bilder")).bilder.length;
  pruefe("ZIP ist gültig und enthält alle Bilder plus Liste", zipOk && jpgs.length === alleBilder && inhalt.includes("bilder-liste.csv"),
    jpgs.length + " von " + alleBilder + ": " + jpgs.slice(0, 2).join(", "));
  const echt = zipOk && execSync("cd " + OUT + " && rm -rf zipcheck && mkdir zipcheck && cd zipcheck && unzip -q ../bilder.zip && file " + jpgs[0]).toString();
  pruefe("Bilder im ZIP sind echte JPEGs", /JPEG image/.test(echt || ""), (echt || "").split(":").pop().trim().slice(0, 40));

  console.log("\n7) Aufräumen");
  for (const n of Object.values(NAMEN)) {
    const k = KENNUNG(n);
    const bilder = (await api(carla.p, "action=bilder")).bilder.filter((b) => b.kennung === k);
    for (const b of bilder) await post(carla.p, { action: "bildWeg", id: b.id, kennung: k });
    await post(carla.p, { action: "standWeg", kennung: k });
  }
  const nachher = (await api(carla.p, "action=stand")).stand;
  const bilderNachher = (await api(carla.p, "action=bilder")).bilder;
  pruefe("Testdaten entfernt", !nachher.some((s) => s.kennung.startsWith("frei-test-")) && !bilderNachher.some((b) => b.kennung.startsWith("frei-test-")));
  pruefe("Echte Einträge unverändert", vorher.every((v) => nachher.some((s) => s.kennung === v.kennung && s.oeko === v.oeko && s.tage === v.tage)),
    vorher.map((s) => s.name + " " + s.oeko + "P").join(", ") || "keine");
  pruefe("Echte Bilder unverändert", bilderVorher.every((v) => bilderNachher.some((b) => b.id === v.id)), bilderVorher.length + " Bilder");

  console.log("\nJS-Fehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
  console.log("ERGEBNIS: " + ok + " bestanden, " + nok + " nicht bestanden");
  await browser.close();
  process.exit(nok || fehler.length ? 1 : 0);
})().catch((e) => { console.error("ABBRUCH: " + e.message); console.log("JS-Fehler:", fehler); process.exit(2); });
