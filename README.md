# Nachhaltigkeits-Challenge Zug Tourismus

Interne Challenge vom 9. bis 20. November 2026. Alle Mitarbeitenden tragen täglich ein,
was sie nachhaltig gemacht haben, sehen live den Teamstand und laden Fotos hoch.
Kein Login, ein Link für alle, funktioniert auf jedem Handy und Computer.

## So ist es gebaut

| Teil | Datei | Aufgabe |
|---|---|---|
| Seite | `public/index.html` | Die ganze Challenge: Tag, Team, Bilder, Wissenswertes |
| Speicher | `netlify/functions/api.mjs` + `lib/logik.mjs` | Gemeinsamer Stand und Bilder, abgelegt in Netlify Blobs |
| Bauskript | `tools/baue_seite.py` | Erzeugt `public/index.html` aus der ursprünglichen Artifact-Fassung |
| Tests | `test/` | Lokaler Server mit Blobs-Emulator und Browser-Test |

Netlify Blobs ist in jedem Netlify-Konto enthalten, es braucht keine Datenbank und keine Schlüssel.

## Aufschalten (einmalig)

1. Diesen Ordner als Repository auf GitHub hochladen.
2. Netlify: **Add new project → Import an existing project → GitHub**, Repository wählen.
   Netlify liest die Einstellungen aus `netlify.toml`, nichts weiter eintragen. **Deploy**.
3. Unter **Project configuration → Change project name** einen sprechenden Namen setzen,
   zum Beispiel `zt-challenge`. Der Link lautet dann `https://zt-challenge.netlify.app`.

Alternative ohne GitHub: `npx netlify-cli deploy --prod` in diesem Ordner.

## Während der Challenge

* **Auswertung:** Register «Team», ganz unten «Stand als Tabelle (CSV) herunterladen».
  Direkt: `https://<adresse>/api?action=export`
* **Bild entfernen, das nicht passt:** Netlify → Projekt → **Blobs** → Store `challenge`,
  die Einträge `bild/<id>` und `bildmeta/<id>` löschen. Eigene Bilder kann jede Person selber löschen.
* **Collage für LinkedIn:** Register «Bilder» → «Collage erzeugen».

## Nach der Challenge (Datenschutz)

Die Bilder und Namen liegen bis dahin bei Netlify (Anbieter mit Sitz in den USA).
Nach dem LinkedIn-Beitrag vom 24. November: Blobs-Store `challenge` in Netlify leeren
oder das Projekt löschen. Die Seite ist für Suchmaschinen gesperrt (`noindex`, `robots.txt`),
aber wer den Link hat, sieht Rangliste und Bilder.

## Bekannte Grenzen

* Kein Login: Wer den Link hat, kann sich theoretisch als andere Person eintragen.
  Für ein internes Team mit Vertrauensbasis bewusst so gewählt.
* Bilder werden im Browser auf maximal 1600 px verkleinert (rund 300 bis 600 KB),
  höchstens 400 Bilder insgesamt.
* HEIC-Fotos vom iPhone wandelt das iPhone beim Hochladen selbst in JPG um.
  Am Computer gespeicherte HEIC-Dateien kann Chrome nicht lesen; dann gibt es einen Hinweis.

## Lokal testen

```bash
npm install
node test/dev-server.mjs        # http://localhost:8888
node test/e2e.cjs               # in zweitem Terminal
```

## Zeitraum oder Team ändern

In `tools/quelle-artifact.html` die Werte `JAHR`, `MONAT`, `VON`, `BIS` bzw. die Liste
`PERSONEN` anpassen, dann `python3 tools/baue_seite.py tools/quelle-artifact.html`.
