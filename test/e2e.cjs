/* Ende-zu-Ende: zwei Personen auf zwei Geräten, Foto-Upload am Handy,
   Live-Ansicht beim anderen, Stand auf neuem Gerät wiederherstellen. */
const { chromium, devices } = require("playwright");
const B = "http://localhost:8888/";
const OUT = __dirname + "/out/";
const fehler = [];
(async () => {
  const browser = await chromium.launch();
  // Testbild erzeugen (grosses JPEG wie von einer Handykamera)
  const gen = await browser.newPage();
  await gen.setViewportSize({ width: 2000, height: 1500 });
  await gen.setContent('<div style="width:2000px;height:1500px;background:linear-gradient(45deg,#17A600,#006BF2)"><h1 style="font-size:200px;color:#fff;margin:0;padding:300px">Velo</h1></div>');
  await gen.screenshot({ path: OUT + "foto.jpg", type: "jpeg", quality: 95 });
  await gen.close();

  // --- Gerät 1: Lena am iPhone
  const handy = await browser.newContext({ ...devices["iPhone 13"] });
  const p1 = await handy.newPage();
  p1.on("pageerror", (e) => fehler.push("handy: " + e.message));
  await p1.goto(B);
  await p1.waitForFunction(() => document.getElementById("statusband").hidden === true, null, { timeout: 15000 });
  await p1.selectOption("#personWahl", "lena");
  await p1.getByRole("button", { name: /öffentlichen Verkehr/ }).first().click();
  await p1.getByRole("button", { name: /Keine Geschäftsreise/ }).first().click();
  await p1.getByRole("button", { name: /Fleischlos/ }).first().click();
  await p1.waitForTimeout(1200);
  await p1.evaluate(() => typeof Effekt !== "undefined" && Effekt.schliesse());
  await p1.screenshot({ path: OUT + "1-handy-tag.png", fullPage: false });
  // Foto direkt im Register Tag
  await p1.setInputFiles("#fotoTagFeld", OUT + "foto.jpg");
  await p1.waitForFunction(() => /oben|danke/i.test(document.getElementById("fotoTagMeldung").textContent), null, { timeout: 20000 });
  console.log("Handy Meldung:", await p1.textContent("#fotoTagMeldung"));
  await p1.locator("#fotoschnell").scrollIntoViewIfNeeded();
  await p1.screenshot({ path: OUT + "2-handy-foto.png" });

  // --- Gerät 2: Joel am Laptop
  const laptop = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const p2 = await laptop.newPage();
  p2.on("pageerror", (e) => fehler.push("laptop: " + e.message));
  await p2.goto(B);
  await p2.waitForFunction(() => document.getElementById("statusband").hidden === true, null, { timeout: 15000 });
  await p2.selectOption("#personWahl", "joel");
  await p2.getByRole("button", { name: /Zu Fuss oder mit dem Velo/ }).first().click();
  await p2.getByRole("button", { name: /Ohne eigenes Auto/ }).first().click();
  await p2.waitForTimeout(1500);
  await p2.evaluate(() => typeof Effekt !== "undefined" && Effekt.schliesse());
  await p2.click("#rTeam");
  await p2.waitForSelector("#rangliste .rang, #podestbuehne .platz", { timeout: 15000 });
  await p2.waitForTimeout(3500);
  const team = await p2.textContent("#vTeam");
  console.log("Team zeigt Lena:", /Lena Bürgi/.test(team), "Joel:", /Joel de Buren/.test(team));
  await p2.screenshot({ path: OUT + "3-laptop-team.png", fullPage: true });
  await p2.click("#rBilder");
  await p2.waitForSelector("#galerie .bildkachel img", { timeout: 15000 });
  await p2.waitForTimeout(800);
  console.log("Laptop sieht Bilder:", await p2.locator("#galerie .bildkachel").count(),
    "Löschknopf bei fremdem Bild:", await p2.locator("#galerie .weg").count());
  // Joel lädt mit Beschreibung hoch
  await p2.fill("#bildText", "Mittag im Zuger Beizli");
  await p2.setInputFiles("#bildFeld", OUT + "foto.jpg");
  await p2.waitForFunction(() => document.querySelectorAll("#galerie .bildkachel").length === 2, null, { timeout: 20000 });
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: OUT + "4-laptop-bilder.png", fullPage: true });

  // --- Live beim Handy: Bild von Joel taucht ohne Neuladen auf
  await p1.click("#rBilder");
  await p1.waitForFunction(() => document.querySelectorAll("#galerie .bildkachel img").length === 2, null, { timeout: 25000 });
  console.log("Handy sieht Joels Bild live: ja");
  await p1.screenshot({ path: OUT + "5-handy-bilder.png", fullPage: true });

  // --- Gerät 3: Lena auf neuem Gerät, Stand kommt zurück
  const neu = await browser.newContext({ ...devices["Pixel 7"] });
  const p3 = await neu.newPage();
  p3.on("pageerror", (e) => fehler.push("neu: " + e.message));
  await p3.goto(B);
  await p3.waitForFunction(() => document.getElementById("statusband").hidden === true, null, { timeout: 15000 });
  await p3.selectOption("#personWahl", "lena");
  await p3.waitForTimeout(1500);
  console.log("Neues Gerät, Lenas Punkte heute:", await p3.textContent("#zahl"));
  const api = await (await p3.request.get(B + "api?action=stand")).json();
  console.log("Server-Stand:", api.stand.map((s) => s.name + " " + s.oeko + "P/" + s.tage + "T").join(", "));

  // --- Ohne Server (Datei lokal geöffnet): kein Absturz
  const off = await browser.newContext();
  const p4 = await off.newPage();
  p4.on("pageerror", (e) => fehler.push("offline: " + e.message));
  await p4.goto("file://" + __dirname + "/../public/index.html");
  await p4.waitForTimeout(3000);
  console.log("Offline-Status:", await p4.textContent("#statustitel"));

  console.log("JS-Fehler:", fehler.length ? fehler : "keine");
  await browser.close();
})().catch((e) => { console.error("TEST FEHLGESCHLAGEN:", e.message); console.log("JS-Fehler:", fehler); process.exit(1); });
