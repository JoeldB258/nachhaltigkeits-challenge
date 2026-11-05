"""Baut public/index.html aus der bestehenden Artifact-Fassung der Challenge.

Aufruf:  python3 tools/baue_seite.py tools/quelle-artifact.html

Die Quelle ist die Seite, wie sie als Claude-Artifact publiziert war. Das Skript
entfernt die Artifact-Hülle, stellt den Speicher auf die eigene Netlify-Funktion
(/api) um und ergänzt Foto-Upload im Register «Tag», Bildbeschreibung,
Abgleich über mehrere Geräte und den CSV-Export. Jede Ersetzung muss genau
einmal passen, sonst bricht das Skript ab.
"""
import sys, pathlib

quelle = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
ziel = pathlib.Path(__file__).resolve().parent.parent / "public" / "index.html"

# ---------------------------------------------------------------- Hülle weg
start = quelle.index("<!DOCTYPE html>")
ende = quelle.rindex("</html>", 0, quelle.rindex("</body></html>")) + len("</html>")
s = quelle[start:ende] + "\n"


def ersetze(alt, neu, n=1):
    global s
    gefunden = s.count(alt)
    if gefunden != n:
        sys.exit(f"Ersetzung passt {gefunden}x statt {n}x:\n{alt[:160]}")
    s = s.replace(alt, neu)


# ------------------------------------------------------------------- Kopf
ersetze('<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="robots" content="noindex, nofollow">\n'
        '<meta name="theme-color" content="#2A6BB4">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-title" content="ZT Challenge">\n'
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 '
        'viewBox=%220 0 32 30%22%3E%3Cpath fill=%22%2317A600%22 d=%22M16 29C6 21 0 15 0 8.5 0 3.8 3.6 0 '
        '8.2 0c3.2 0 5.9 1.9 7.8 4.6C17.9 1.9 20.6 0 23.8 0 28.4 0 32 3.8 32 8.5 32 15 26 21 16 29z%22/%3E'
        '%3C/svg%3E">')

# ------------------------------------------------------------ CSS-Zusätze
ersetze(".uploadmeldung{font-size:13px;margin:12px 0 0;min-height:18px}",
        ".uploadmeldung{font-size:13px;margin:12px 0 0;min-height:18px}\n"
        ".bildtext{display:block;width:100%;max-width:420px;margin:0 auto 14px;padding:11px 13px;"
        "border:1px solid var(--linie);border-radius:10px;font:inherit;font-size:16px;background:#fff}\n"
        ".fotoschnell{border:1px solid var(--linie);border-radius:var(--r);padding:16px 18px}\n"
        ".fotoschnell h2{font-size:17px;margin:0 0 6px}\n"
        ".fotoschnell p{font-size:13px;color:#5C5C5C;margin:0 0 12px}\n"
        ".fotoschnell .knopf{width:100%}\n"
        ".fotoschnell input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}\n"
        ".fotoschnell .uploadmeldung{margin-top:10px}\n"
        ".bildkachel .unten i{display:block;font-style:normal;margin:2px 0 1px;color:var(--schwarz)}\n"
        ".exportzeile{margin:26px 0 0;font-size:13px;color:#5C5C5C}\n"
        ".exportzeile a{color:inherit}\n"
        "figure.bildkachel{margin:0}")

# ------------------------------------------------- Foto-Kachel im Register Tag
ersetze('      <section class="bilanz">\n        <h2>Mein Stand</h2>',
        '      <section class="fotoschnell" id="fotoschnell">\n'
        '        <h2>Foto dazu?</h2>\n'
        '        <p>Gerade etwas Nachhaltiges gemacht? Knipsen und hochladen, es landet sofort im Register «Bilder».</p>\n'
        '        <button class="knopf" id="fotoTag" type="button">Foto aufnehmen oder wählen</button>\n'
        '        <input type="file" id="fotoTagFeld" accept="image/*">\n'
        '        <p class="uploadmeldung" id="fotoTagMeldung" aria-live="polite"></p>\n'
        '      </section>\n\n'
        '      <section class="bilanz">\n        <h2>Mein Stand</h2>')

# ---------------------------------------- Bildbeschreibung im Register Bilder
ersetze('    <button class="knopf" id="bildWaehlen" type="button">Bild hinzufügen</button>',
        '    <input class="bildtext" id="bildText" type="text" maxlength="120" '
        'placeholder="Was zeigt das Bild? (freiwillig)" aria-label="Was zeigt das Bild?">\n'
        '    <button class="knopf" id="bildWaehlen" type="button">Bild hinzufügen</button>')
ersetze('    <p class="uploadmeldung" id="uploadmeldung"></p>',
        '    <p class="uploadmeldung" id="uploadmeldung" aria-live="polite"></p>')
ersetze('Auf dem Handy öffnet sich direkt die Kamera.',
        'Auf dem Handy kannst du direkt fotografieren oder ein Bild aus der Galerie wählen.')

# ------------------------------------------------------- Export für Joel
ersetze('  <p class="rangtrenner" id="rangtrenner" hidden></p>\n</div>',
        '  <p class="rangtrenner" id="rangtrenner" hidden></p>\n'
        '  <p class="exportzeile">Für die Auswertung: <a href="/api?action=export" download>Stand als Tabelle '
        '(CSV) herunterladen</a></p>\n</div>')

# ----------------------------------------------------------- Speicher-Adresse
a = s.index("var API_URL = (function(){")
b = s.index("})();", a) + len("})();")
s = s[:a] + 'var API_URL = "/api";   /* eigene Netlify-Funktion, siehe netlify/functions/api.mjs */' + s[b:]
ersetze('  if(/^https:\\/\\/script\\.google(usercontent)?\\.com\\//.test(u)) return u;',
        '  if(u === "/api") return u;')

ersetze('    return fetch(u, {method:"GET"}).then(function(a){ return a.json(); });',
        '    return fetch(u, {method:"GET", cache:"no-store"}).then(function(a){ return a.json(); });')

# ------------------------------------------- Lokaler Speicher kennt die Zeit
ersetze('  var modus="lokal", daten={}, db=null, uid=null, kuerzel="", person="";',
        '  var modus="lokal", daten={}, db=null, uid=null, kuerzel="", person="", zeit=0;')
ersetze('daten = roh.tage || {}; kuerzel = roh.kuerzel || ""; person = roh.person || "";',
        'daten = roh.tage || {}; kuerzel = roh.kuerzel || ""; person = roh.person || ""; zeit = +roh.zeit || 0;')
ersetze('      JSON.stringify({tage:daten, kuerzel:kuerzel, person:person})); }',
        '      JSON.stringify({tage:daten, kuerzel:kuerzel, person:person, zeit:zeit})); }')

# Beim Start: eigenen Stand vom Server holen (anderes Gerät, Cache geleert)
ersetze('        if(probe && probe.ok){ modus="api"; return; }',
        '        if(probe && probe.ok){ modus="api"; await holeEigene(); return; }')

ersetze('  /* Kennung ohne Konto: die gewählte Person, sonst der eingetippte Name.',
        '  function hatEintraege(d){\n'
        '    return Object.keys(d||{}).some(function(k){ return k!=="wochen" && d[k] && Object.keys(d[k]).length; });\n'
        '  }\n'
        '  /* Holt den eigenen Stand vom Server. Übernimmt ihn, wenn er neuer ist als der\n'
        '     lokale oder wenn hier noch nichts erfasst ist. So geht nichts verloren, wenn\n'
        '     jemand am Handy und am Computer abwechselt. */\n'
        '  async function holeEigene(){\n'
        '    if(modus!=="api") return false;\n'
        '    var k = kennung(); if(!k) return false;\n'
        '    try{\n'
        '      var a = await Netz.holen("action=mein&kennung="+encodeURIComponent(k));\n'
        '      if(a && a.ok && a.daten && hatEintraege(a.daten) && (!hatEintraege(daten) || (+a.zeit||0) > zeit)){\n'
        '        daten = a.daten; zeit = +a.zeit||0; lokalSichern(); return true;\n'
        '      }\n'
        '    }catch(e){}\n'
        '    return false;\n'
        '  }\n\n'
        '  /* Kennung ohne Konto: die gewählte Person, sonst der eingetippte Name.')

ersetze('  async function sichern(){\n    lokalSichern();',
        '  async function sichern(){\n    zeit = Date.now();\n    lokalSichern();')
ersetze('          tage:b2.tage, oeko:b2.total, sozial:b2.sozial, woche:b2.woche,\n'
        '          schnitt: b2.tage ? Math.round(b2.total/b2.tage*10)/10 : 0});',
        '          tage:b2.tage, oeko:b2.total, sozial:b2.sozial, woche:b2.woche,\n'
        '          schnitt: b2.tage ? Math.round(b2.total/b2.tage*10)/10 : 0,\n'
        '          daten: daten, zeit: zeit});')
ersetze('    start:start, sichern:sichern,',
        '    start:start, sichern:sichern, holeEigene:holeEigene,')

# Personenwahl: zuerst den Stand dieser Person holen, dann erst speichern,
# sonst würde ein leeres neues Gerät den Stand auf dem Server überschreiben.
ersetze('''    Speicher.person = ""; if(v!=="andere") Speicher.kuerzel = "";
  }
  Speicher.sichern(); zeigeKuerzel(); zeigGespeichert();
  if(v==="andere") feld.focus();
});''', '''    Speicher.person = ""; if(v!=="andere") Speicher.kuerzel = "";
  }
  if(v==="andere"){ feld.hidden=false; feld.value=""; feld.focus(); return; }
  zeigeKuerzel();
  Speicher.holeEigene().then(function(neu){
    if(neu){ baueTage(); baueKarten(); baueWochen(); aktualisiere(false); }
    Speicher.sichern(); zeigGespeichert();
  });
});''')

# ------------------------------------------------------------ Bilder
ersetze('''  function meldung(t, fehler){
    var el=document.getElementById("uploadmeldung");
    el.textContent=t||""; el.style.color = fehler ? "#B00000" : "#5C5C5C";
  }''', '''  function meldung(t, fehler){
    ["uploadmeldung","fotoTagMeldung"].forEach(function(id){
      var el=document.getElementById(id); if(!el) return;
      el.textContent=t||""; el.style.color = fehler ? "#B00000" : "#5C5C5C";
    });
  }''')

# Bessere Qualität für die Collage, Netlify trägt grössere Bilder
ersetze('  var GRENZE = 170000;', '  var GRENZE = 600000;')
ersetze('          var kante = 1280;', '          var kante = 1600;')
ersetze('            if(q > 0.45) return versuch(k, q-0.12);\n'
        '            if(k > 520) return versuch(Math.round(k*0.78), 0.74);',
        '            if(q > 0.5) return versuch(k, q-0.1);\n'
        '            if(k > 640) return versuch(Math.round(k*0.8), 0.8);')
ersetze('          var daten = versuch(kante, 0.80);', '          var daten = versuch(kante, 0.84);')

ersetze('''    if(Speicher.modus==="api" && !Speicher.kennung()){
      meldung("Wähle dich zuerst oben bei «Ich bin» aus, dann kannst du Bilder hochladen.", true);
      return;
    }''', '''    if(Speicher.modus==="api" && !Speicher.kennung()){
      meldung("Wähle dich zuerst oben bei «Ich bin» aus, dann kannst du Bilder hochladen.", true);
      try{ document.getElementById("personWahl").focus(); }catch(e){}
      return;
    }''')
ersetze('    var gut=0, schlecht=0;\n', '    var gut=0, schlecht=0, grund="";\n'
        '    var beschreibung = (document.getElementById("bildText")||{}).value || "";\n')
ersetze('          var a = await Netz.senden({action:"bild", kennung:Speicher.kennung(), name:wer, jpg:daten});\n'
        '          if(!a || !a.ok) throw new Error("api");',
        '          var a = await Netz.senden({action:"bild", kennung:Speicher.kennung(), name:wer, jpg:daten,\n'
        '                                     text: beschreibung.trim().slice(0,120)});\n'
        '          if(!a || !a.ok) throw new Error(a && a.fehler==="voll" ? "voll" : "api");')
ersetze('      }catch(e){ schlecht++; }\n    }\n    balken(1);',
        '      }catch(e){ schlecht++; grund = e && e.message; }\n    }\n    balken(1);')
ersetze('''    meldung(schlecht
      ? (gut+" hochgeladen, "+schlecht+" nicht. Probiere es bei den übrigen nochmals.")''',
        '''    if(gut){ var bt=document.getElementById("bildText"); if(bt) bt.value=""; }
    if(schlecht && !gut){
      meldung(grund==="bild" || grund==="lesen"
        ? "Dieses Bildformat kann der Browser nicht lesen (zum Beispiel HEIC am Computer). Bitte als JPG speichern oder direkt am Handy hochladen."
        : grund==="voll" ? "Der Bilderspeicher ist voll. Melde dich bei Joel."
        : "Das Hochladen hat nicht geklappt. Prüfe die Verbindung und versuche es nochmals.", true);
      return;
    }
    meldung(schlecht
      ? (gut+" hochgeladen, "+schlecht+" nicht. Probiere es bei den übrigen nochmals.")''')

ersetze('      if(Speicher.modus==="api"){ await Netz.senden({action:"bildWeg", id:id}); await frischBilder(); }',
        '      if(Speicher.modus==="api"){\n'
        '        var r = await Netz.senden({action:"bildWeg", id:id, kennung:Speicher.kennung()});\n'
        '        if(!r || !r.ok) throw new Error("weg");\n'
        '        await frischBilder();\n'
        '      }')
ersetze('''        return {id:w.id, uid:w.kennung, kuerzel:w.name||"ohne Namen", person:"",
                zeit:+w.zeit||0, jpg:""};''',
        '''        return {id:w.id, uid:w.kennung, kuerzel:w.name||"ohne Namen", person:"",
                zeit:+w.zeit||0, jpg:"", text:w.text||""};''')
ersetze("""        + '<figcaption class="unten"><b>'+sicher(e.kuerzel)+'</b><span>'+wann+'</span></figcaption></figure>';""",
        """        + '<figcaption class="unten"><b>'+sicher(e.kuerzel)+'</b>'
        + (e.text ? '<i>'+sicher(e.text)+'</i>' : '')
        + '<span>'+wann+'</span></figcaption></figure>';""")
# Bild nur einsetzen, wenn es wirklich ein JPEG ist; sonst Platzhalter
ersetze("""        + '<img src="'+e.jpg+'" alt="">'""",
        """        + (/^data:image\\/jpeg;base64,[A-Za-z0-9+\\/=]+$/.test(e.jpg||"")
            ? '<img src="'+e.jpg+'" alt="'+sicher(e.text||("Bild von "+e.kuerzel))+'">'
            : '<div class="platzhalter"></div>')""")

# Häufiger nachschauen, damit es sich live anfühlt
ersetze('      bildUhr = setInterval(function(){ if(!document.hidden) frischBilder(); }, 30000);',
        '      bildUhr = setInterval(function(){ if(!document.hidden) frischBilder(); }, 15000);')
ersetze('''      uhr = setInterval(function(){
        if(!document.hidden) frisch();
      }, 20000);''', '''      uhr = setInterval(function(){
        if(!document.hidden) frisch();
      }, 15000);
      document.addEventListener("visibilitychange", function(){ if(!document.hidden) frisch(); });''')

# Foto-Knopf im Register Tag verdrahten
ersetze('''    document.getElementById("collageBauen").addEventListener("click", collage);''',
        '''    var feldTag = document.getElementById("fotoTagFeld");
    document.getElementById("fotoTag").addEventListener("click", function(){ feldTag.click(); });
    feldTag.addEventListener("change", function(){
      var f = this.files; hochladen(f).then(function(){ starte(); }); this.value="";
    });
    document.getElementById("collageBauen").addEventListener("click", collage);''')
ersetze('''    document.getElementById("bildWaehlen").disabled = true;''',
        '''    document.getElementById("bildWaehlen").disabled = true;
    document.getElementById("fotoTag").disabled = true;''')
ersetze('''    document.getElementById("bildWaehlen").disabled = false;''',
        '''    document.getElementById("bildWaehlen").disabled = false;
    document.getElementById("fotoTag").disabled = false;''')

# Foto-Kachel nur zeigen, wenn der gemeinsame Speicher läuft
ersetze('''    hinweis.hidden = geteilt;
    ablage.hidden = !geteilt;''', '''    hinweis.hidden = geteilt;
    ablage.hidden = !geteilt;
    var schnell = document.getElementById("fotoschnell");
    if(schnell) schnell.hidden = !geteilt;''')

# --------------------------------------------- Statusband ohne Google-Einrichtung
ersetze('    Einrichtung.anbieten(true);\n    return;', '    return;')
ersetze('  Einrichtung.anbieten(gewuenscht);\n}', '}')
ersetze('''      : "Das Podest, die Teamzahlen und die Bilder siehst du so nicht. Öffne die Seite über den Link, "
        + "den Joel geteilt hat.";''', '''      : "Das Podest, die Teamzahlen und die Bilder siehst du so nicht.";''')
ersetze('''    titel.textContent = "Der gemeinsame Stand läuft.";
    text.textContent = "Alle sehen Podest, Teamzahlen und Bilder live. Hier lässt sich die Adresse "
      + "ändern und der Link für das Team holen.";''', '''    titel.textContent = "Der gemeinsame Stand läuft.";
    text.textContent = "Alle sehen Podest, Teamzahlen und Bilder live.";''')

# Bilder auch dann laden, wenn man direkt im Register Tag hochlädt
ersetze('''  Team.starte();
  Bilder.starte();
})();''', '''  Team.starte();
  Bilder.starte();
  /* Stand vom Server neu holen, wenn jemand zur Seite zurückkehrt (Handy aus der Tasche) */
  document.addEventListener("visibilitychange", function(){
    if(document.hidden || Speicher.modus!=="api") return;
    Speicher.holeEigene().then(function(neu){
      if(neu){ baueTage(); baueKarten(); baueWochen(); aktualisiere(false); }
    });
  });
})();''')


# ------------------------------------------------ Mehrere Geräte gleichzeitig
# Merkt sich, wann dieses Gerät zuletzt mit dem Server abgeglichen hat.
ersetze('  var modus="lokal", daten={}, db=null, uid=null, kuerzel="", person="", zeit=0;',
        '  var modus="lokal", daten={}, db=null, uid=null, kuerzel="", person="", zeit=0, sync=0, kette=Promise.resolve();')
ersetze('person = roh.person || ""; zeit = +roh.zeit || 0;',
        'person = roh.person || ""; zeit = +roh.zeit || 0; sync = +roh.sync || 0;')
ersetze('JSON.stringify({tage:daten, kuerzel:kuerzel, person:person, zeit:zeit})); }',
        'JSON.stringify({tage:daten, kuerzel:kuerzel, person:person, zeit:zeit, sync:sync})); }')
ersetze('        daten = a.daten; zeit = +a.zeit||0; lokalSichern(); return true;',
        '        daten = a.daten; zeit = +a.zeit||0; sync = zeit; lokalSichern(); return true;')

# Speichern nacheinander statt gleichzeitig, und vor dem Senden Tage ergänzen,
# die ein anderes Gerät derselben Person inzwischen eingetragen hat.
ersetze("""  async function sichern(){
    zeit = Date.now();
    lokalSichern();
    if(modus==="api"){
      var k = kennung();
      if(!k) return;
      var b2 = bilanz();
      try{""", """  function sichern(){
    zeit = Date.now();
    lokalSichern();
    if(modus==="api"){
      kette = kette.then(apiSichern, apiSichern);
      return kette;
    }
    return dbSichern();
  }

  async function apiSichern(){
      var k = kennung();
      if(!k) return;
      var dazu = false;
      try{
        var s = await Netz.holen("action=mein&kennung="+encodeURIComponent(k));
        if(s && s.ok && s.daten && (+s.zeit||0) > sync){
          Object.keys(s.daten).forEach(function(t){
            if(t==="wochen"){
              var w = s.daten.wochen || {};
              daten.wochen = daten.wochen || {};
              Object.keys(w).forEach(function(i){
                if(!(i in daten.wochen)){ daten.wochen[i] = w[i]; dazu = true; }
              });
            } else if(!(t in daten)){ daten[t] = s.daten[t]; dazu = true; }
          });
        }
      }catch(e){}
      if(dazu){
        lokalSichern();
        try{ baueTage(); baueKarten(); baueWochen(); aktualisiere(false); }catch(e){}
      }
      var b2 = bilanz();
      var jetzt = Date.now();
      try{""")
ersetze("""          daten: daten, zeit: zeit});
        if(typeof Team!=="undefined" && Team.frisch) Team.frisch();
      }catch(e){}
      return;
    }
    if(modus!=="db" || !uid) return;""", """          daten: daten, zeit: jetzt});
        sync = jetzt; lokalSichern();
        if(typeof Team!=="undefined" && Team.frisch) Team.frisch();
      }catch(e){}
  }

  async function dbSichern(){
    if(modus!=="db" || !uid) return;""")

# Freier Name («Andere Person»): zuerst den Stand dieses Namens holen
ersetze("""  tippUhr = setTimeout(function(){
    Speicher.person = ""; Speicher.kuerzel = v;
    Speicher.sichern();""", """  tippUhr = setTimeout(function(){
    Speicher.person = ""; Speicher.kuerzel = v;
    Speicher.holeEigene().then(function(neu){
      if(neu){ baueTage(); baueKarten(); baueWochen(); aktualisiere(false); }
      Speicher.sichern();
    });""")
ersetze("""  Speicher.person = ""; Speicher.kuerzel = v;
  Speicher.sichern(); zeigeKuerzel();
});""", """  if(Speicher.kuerzel === v && !Speicher.person) { zeigeKuerzel(); return; }
  Speicher.person = ""; Speicher.kuerzel = v;
  Speicher.holeEigene().then(function(neu){
    if(neu){ baueTage(); baueKarten(); baueWochen(); aktualisiere(false); }
    Speicher.sichern(); zeigeKuerzel();
  });
});""")


# ------------------------------------------------ Alle Bilder als ZIP
ersetze('  <div class="galerie" id="galerie"></div>',
        '  <div class="galerie" id="galerie"></div>\n'
        '  <div class="zipzeile" id="zipZeile" hidden>\n'
        '    <button class="knopf zweit" id="zipLaden" type="button">Alle Bilder herunterladen (ZIP)</button>\n'
        '    <p class="uploadmeldung" id="zipStand" aria-live="polite"></p>\n'
        '  </div>')
ersetze('.exportzeile a{color:inherit}', '.exportzeile a{color:inherit}\n.zipzeile{margin:22px 0 0}')
ersetze('      galerie.innerHTML=""; box.hidden=true;',
        '      galerie.innerHTML=""; box.hidden=true; document.getElementById("zipZeile").hidden=true;')
ersetze('    leer.hidden=true; box.hidden=false;',
        '    leer.hidden=true; box.hidden=false; document.getElementById("zipZeile").hidden=false;')

ersetze("""    document.getElementById("collageBauen").addEventListener("click", collage);""",
        """    document.getElementById("zipLaden").addEventListener("click", alleAlsZip);
    document.getElementById("collageBauen").addEventListener("click", collage);""")

ersetze("""  function verdrahte(){""", r"""  /* ---- Alle Bilder als ZIP. Ohne Komprimierung (JPEG ist schon komprimiert),
     darum reicht ein kleiner eigener ZIP-Schreiber, keine fremde Bibliothek. */
  var CRC = (function(){ var t=[], c; for(var n=0;n<256;n++){ c=n;
    for(var k=0;k<8;k++) c = (c&1) ? (0xEDB88320^(c>>>1)) : (c>>>1); t[n]=c>>>0; } return t; })();
  function crc32(u){ var c=0xFFFFFFFF; for(var i=0;i<u.length;i++) c = CRC[(c^u[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
  function dosZeit(d){
    return { zeit: (d.getHours()<<11)|(d.getMinutes()<<5)|(Math.floor(d.getSeconds()/2)),
             datum: ((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate() };
  }
  function zipBauen(dateien){
    var teile=[], zentral=[], offset=0, enc=new TextEncoder();
    dateien.forEach(function(f){
      var name=enc.encode(f.name), crc=crc32(f.daten), n=f.daten.length, dz=dosZeit(f.wann||new Date());
      var h=new DataView(new ArrayBuffer(30));
      h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(6,0x0800,true);
      h.setUint16(8,0,true); h.setUint16(10,dz.zeit,true); h.setUint16(12,dz.datum,true);
      h.setUint32(14,crc,true); h.setUint32(18,n,true); h.setUint32(22,n,true);
      h.setUint16(26,name.length,true); h.setUint16(28,0,true);
      teile.push(h.buffer, name, f.daten);
      var z=new DataView(new ArrayBuffer(46));
      z.setUint32(0,0x02014b50,true); z.setUint16(4,20,true); z.setUint16(6,20,true);
      z.setUint16(8,0x0800,true); z.setUint16(10,0,true); z.setUint16(12,dz.zeit,true); z.setUint16(14,dz.datum,true);
      z.setUint32(16,crc,true); z.setUint32(20,n,true); z.setUint32(24,n,true);
      z.setUint16(28,name.length,true); z.setUint32(42,offset,true);
      zentral.push(z.buffer, name);
      offset += 30 + name.length + n;
    });
    var groesse = zentral.reduce(function(s,x){ return s + x.byteLength; }, 0);
    var e=new DataView(new ArrayBuffer(22));
    e.setUint32(0,0x06054b50,true); e.setUint16(8,dateien.length,true); e.setUint16(10,dateien.length,true);
    e.setUint32(12,groesse,true); e.setUint32(16,offset,true);
    return new Blob(teile.concat(zentral,[e.buffer]), {type:"application/zip"});
  }
  function bytesAus(dataUrl){
    var b = atob(dataUrl.split(",")[1]||""), u = new Uint8Array(b.length);
    for(var i=0;i<b.length;i++) u[i]=b.charCodeAt(i);
    return u;
  }
  var zipLaeuft = false;
  async function alleAlsZip(){
    if(zipLaeuft || !eintraege.length) return;
    zipLaeuft = true;
    var knopf = document.getElementById("zipLaden"), stand = document.getElementById("zipStand");
    knopf.disabled = true; stand.style.color = "#5C5C5C";
    try{
      var liste = eintraege.slice();
      for(var i=0;i<liste.length;i++){
        if(liste[i].jpg) continue;
        stand.textContent = "Bild "+(i+1)+" von "+liste.length+" wird geladen.";
        if(Speicher.modus==="api"){
          var a = await Netz.holen("action=bild&id="+encodeURIComponent(liste[i].id));
          if(a && a.jpg) liste[i].jpg = a.jpg;
        }
      }
      stand.textContent = "ZIP wird gebaut.";
      var z2 = function(n){ return String(n).padStart(2,"0"); };
      var dateien = [], zeilen = [["Nr","Datei","Name","Datum","Beschreibung"]];
      liste.slice().sort(function(a,b){ return a.zeit-b.zeit; }).forEach(function(e, i){
        if(!/^data:image\/jpeg;base64,/.test(e.jpg||"")) return;
        var d = new Date(e.zeit);
        var datei = z2(i+1) + "_" + d.getFullYear()+"-"+z2(d.getMonth()+1)+"-"+z2(d.getDate())
          + "_" + z2(d.getHours())+z2(d.getMinutes()) + "_" + (slug(e.kuerzel)||"bild") + ".jpg";
        dateien.push({name: datei, daten: bytesAus(e.jpg), wann: d});
        zeilen.push([i+1, datei, e.kuerzel, d.toLocaleString("de-CH"), e.text||""]);
      });
      var csv = "﻿" + zeilen.map(function(z){
        return z.map(function(f){ var t=String(f==null?"":f); if(/^[=+\-@]/.test(t)) t="'"+t;
          return '"'+t.replace(/"/g,'""')+'"'; }).join(";");
      }).join("\r\n");
      dateien.push({name: "bilder-liste.csv", daten: new TextEncoder().encode(csv), wann: new Date()});
      var blob = zipBauen(dateien);
      var url = URL.createObjectURL(blob), a2 = document.createElement("a");
      a2.href = url; a2.download = "nachhaltigkeits-challenge-bilder.zip";
      document.body.appendChild(a2); a2.click(); a2.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
      stand.textContent = (dateien.length-1) + " Bilder heruntergeladen ("
        + (blob.size/1048576).toFixed(1).replace(".",",") + " MB).";
    }catch(err){
      stand.style.color = "#B00000";
      stand.textContent = "Das Herunterladen hat nicht geklappt. Bitte nochmals versuchen.";
    }
    knopf.disabled = false; zipLaeuft = false;
  }

  function verdrahte(){""")

ziel.write_text(s, encoding="utf-8")
print("geschrieben:", ziel, len(s), "Zeichen")
