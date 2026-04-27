# FIB Akten-System V2

React + Vite + Firebase Aktenverwaltung für GitHub Pages.

## Funktionen V1

- Login / Registrierung per E-Mail und Passwort
- Rollen-Grundsystem: Administrator, Direktor, Leitung, Ermittler, Agent, Anwärter
- Fallakten, Gangakten, Ermittlungsakten
- Aktenstatus, Priorität, Sachbearbeiter, Tags
- Dokument-Uploads über Firebase Storage
- Notizen
- Termine
- Einsatztagebuch
- PDF-Export einer Akte
- Dunkles FIB-inspiriertes Dashboard

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Dann Firebase-Konfiguration in `.env` eintragen.

## Firebase aktivieren

1. Firebase-Projekt erstellen
2. Authentication > Sign-in method > E-Mail/Passwort aktivieren
3. Firestore Database erstellen
4. Storage aktivieren
5. Web-App registrieren und Config-Werte in `.env` kopieren

## GitHub Pages Deployment

Das Repo auf GitHub hochladen. Der Workflow in `.github/workflows/deploy.yml` baut automatisch und deployed auf GitHub Pages.

In GitHub:
Settings > Pages > Source: GitHub Actions

## Wichtiger Sicherheitshinweis

Die Rollen in V1 werden in Firestore vorbereitet. Für produktive Nutzung müssen die Firestore- und Storage-Rules sorgfältig gesetzt werden. Starter-Rules liegen in `firebase.rules`.


## Neu in V2 Admin

- Admin-Panel unter „Administration“
- Userliste aus Firestore
- Rollen per Dropdown ändern
- Accounts sperren/entsperren
- Gesperrte Accounts werden beim Laden automatisch ausgeloggt


## Neu in V3

- Öffentliche Registrierung entfernt
- Accounts werden im Adminbereich angelegt
- Anzeigenamen frei festlegbar, z.B. `FIB-10 | Fox`
- Eigene Rangliste in der App verwaltbar
- Eigene Rechte pro Rang per Checkbox
- Director/Direktor kann Accounts anlegen
- Administrator kann Ränge verwalten

## Wichtig zu Firebase Auth

Die App nutzt eine zweite Firebase-App-Instanz, um neue Accounts anzulegen, ohne den aktuellen Admin/Director auszuloggen.


## Neu in V4 Rechte

- App-Oberfläche prüft Rang-Rechte aus der eigenen Rangliste.
- Akten lesen, erstellen, bearbeiten, löschen, exportieren werden im UI durchgesetzt.
- Director/Direktor kann Accounts anlegen, aber keine Administratoren erstellen oder bearbeiten.
- Administrator verwaltet Rangliste und Rechte.
- Gesperrte User verlieren Zugriff auf Firestore und Storage.
- Firestore- und Storage-Regeln sind getrennt:
  - `firebase-firestore.rules`
  - `firebase-storage.rules`

Hinweis: Firebase Security Rules können dynamische Checkbox-Rechte aus `settings/ranks` nur eingeschränkt serverseitig auswerten. Darum schützt die App die frei konfigurierbaren Rechte im UI, während die Rules die sicherheitskritischen Grenzen absichern.


## Neu in V5 Eigene Fälle

- Administrator, Director/Direktor und Leitung sehen alle Akten.
- Ermittler, Agenten und Anwärter sehen nur eigene oder ihnen zugewiesene Akten.
- Eigene Akten werden über `createdBy`, `assigneeUid` oder `assignee == E-Mail` erkannt.
- Akten-Details blockieren unberechtigte Zugriffe im UI.
- Firestore-Regeln sichern Einzelzugriffe zusätzlich ab.
- Storage-Dateien sind ebenfalls an die Aktenberechtigung gekoppelt.

Hinweis: Die Listenabfrage bleibt aus Kompatibilitätsgründen breit erlaubt und wird clientseitig gefiltert. Für eine spätere High-Security-Version sollten getrennte Firestore-Queries mit `where("createdBy", "==", uid)` und `where("assigneeUid", "==", uid)` eingebaut werden.


## Neu in V6 Admin-Fix

- Administrator hat jetzt immer Vollrechte, auch wenn `settings/ranks` alte oder unvollständige Rechte enthält.
- Beim Öffnen des Adminbereichs repariert ein Administrator die gespeicherte Rangliste automatisch.
- Falls vorher `Administrator` ohne `manageUsers`, `createUsers` oder `manageRanks` gespeichert war, ist das damit behoben.


## V7 Großakte

Diese Version baut das Akten-System deutlich größer aus:

- neues Lagezentrum / Dashboard
- Aktennummern automatisch nach Aktenart
- Tabellenartige Aktenzentrale statt simpler Karten
- Filter nach Aktenart und Status
- Großakten mit Tabs:
  - Übersicht
  - Personen / Zielpersonen
  - Beweise
  - Dokumente
  - Notizen
  - Einsatztagebuch
  - Chronik
- Aktenzuweisung an Nutzer
- Zugriff: Führung sieht alles, normale Ränge sehen eigene/zugewiesene Akten
- umfangreicher PDF-Export
- neue Firestore- und Storage-Regeln

Einbau:
1. Dateien in GitHub ersetzen.
2. Actions grün abwarten.
3. `firebase-firestore.rules` in Firestore-Regeln veröffentlichen.
4. `firebase-storage.rules` in Storage-Regeln veröffentlichen.
5. Website mit Strg+F5 neu laden.


## V8.1 Großes Aktenfenster Fix

- Akten öffnen als großes zentriertes Fenster.
- Kein Klick-außerhalb-Schließen, damit das Modal nicht direkt wieder verschwindet.
- Rechte Seitenleiste entfernt.


## V9 Federal UI

- Oberfläche stärker an amerikanisches Federal Case Management angelehnt.
- Weniger runde Kachel-Optik, mehr Command-Center/Dossier-Stil.
- Case-Jacket-Fenster, Classification-Badges und kompaktere Tabellen.
- Dunkler Behördenlook mit Gold-/Blau-Akzenten.
- Labels teilweise in Richtung Case Management / Command Center angepasst.


## V10 Bearbeitbare Akten-Stammdaten

- Sachverhalt kann in der geöffneten Akte bearbeitet werden.
- Ermittlungsziel kann bearbeitet werden.
- Status, Priorität und Einstufung können direkt geändert werden.
- Titel, Aktenart, Ort, Abteilung und Tags können bearbeitet werden.
- Jede Änderung schreibt einen Chronik-Eintrag.


## V10.1 Edit-Fix

- Administrator hat im Case-Fenster immer Bearbeitungsrechte.
- Update-Fehler werden sichtbar in der Akte angezeigt.
- Speichern schließt den Editor nur noch, wenn Firestore das Update wirklich angenommen hat.


## V11 Realistic Federal UI

- deutlich realistischere Federal-Case-Management-Optik
- kantiger, kompakter, weniger Web-App/Kachel-Look
- Classified Case Jacket Banner
- Federal Dossier Header im Aktenfenster
- Command-Center-Stil mit Scanline/Grid-Effekt
- Tabellen und Module wie interne Behördenakten
- Labels mehr Richtung Case Records / Evidence Registry / Operations Log


## V12 Real Federal Case System

- echter Federal Case Header mit Case No, Classification, Status, Priority, Lead Agent und Supervisor
- Classification Banner: UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP SECRET
- realistischere Statuswerte: OPEN, ACTIVE, UNDER SURVEILLANCE, WARRANT ISSUED, SUSPENDED, CLOSED, ARCHIVED
- Lead Agent, Assigned Agents und Supervising Officer
- eigener Assignments-Tab
- Evidence Registry mit Evidence-ID, Typ, Quelle, Status und Chain-of-Custody
- Audit Trail wird über zentrale Audit-Einträge erweitert
- PDF-Export enthält Lead/Supervisor/Assigned Agents und Evidence IDs


## V13 Evidence Images

- Beweisbilder können direkt beim Evidence-Eintrag hochgeladen werden.
- Bilder werden in Firebase Storage gespeichert.
- Evidence-Einträge zeigen eine Bildvorschau in der Akte.
- Klick auf das Bild öffnet die Originaldatei.
- PDF-Export bindet Evidence-Bilder ein, soweit der Browser die Datei laden kann.


## V14 Investigation Upgrade

- Evidence Fullscreen Viewer innerhalb des Systems
- Evidence Viewer zeigt Bild, Metadaten und Chain of Custody
- neuer Investigation-Tab mit visuellem Ermittlungsfluss
- Milestones für Investigation Flow
- verknüpfte Akten / Linked Cases
- Linked Cases und Milestones im PDF-Export


## V15 Deutsch + Englisch System

- Sprachumschalter oben rechts: Deutsch / English
- Sprache wird in `localStorage` gespeichert.
- Interne Werte wie `ACTIVE`, `CONFIDENTIAL`, `CRITICAL` bleiben stabil.
- Sichtbare Werte werden über `labelValue()` übersetzt.
- Zentrale Übersetzungen liegen in `LANG` und `VALUE_LABELS` in `src/main.jsx`.
- UI-Texte für Header, Navigation, Tabs, Evidence Viewer, Admin und Case-Bereiche wurden übersetzbar gemacht.


## V16 Intelligence System

- neue zentrale Firestore Collection: `persons`
- Personen sind eigene Datensätze und können mit mehreren Akten verknüpft werden
- neuer Tab `Intelligence` innerhalb einer Akte
- neue Personen erstellen und direkt mit einer Akte verknüpfen
- bestehende Personen mit einer Akte verknüpfen
- erste Netzwerkansicht aus Case, Personen und verknüpften Akten
- Personalbereich zeigt zentrale Personendatenbank
- PDF-Export enthält Intelligence-Personen
- Firestore Rules wurden um `persons` erweitert


## V16.1 Intelligence Tab Fix

- Intelligence-Tab fest im Tab-Block eingebaut.
- Intelligence-Inhalt wird garantiert direkt vor dem Investigation-Tab gerendert.
- Fallback für `persons` eingebaut, damit die Akte nicht crasht, wenn noch keine Personen geladen sind.
- Firestore Rules prüfen weiterhin `persons`.


## V16.2 Akten-Öffnen Fix

- Fehler behoben, bei dem Akten wegen fehlender `t(...)` / `labelValue(...)` Funktionen nicht mehr geöffnet haben.
- CaseDetails hat jetzt lokale Fallback-Übersetzungen.
- `persons` wird sicher an CaseDetails übergeben.
- Intelligence-Tab bleibt enthalten.


## V17 Stable

- Stabiler `Berichte`-Tab direkt im Aktenfenster.
- Berichtseditor mit Vorlagen:
  - Ermittlungsbericht
  - Vernehmungsprotokoll
  - Einsatzbericht
  - Beweismittelbericht
- Berichte werden direkt in der jeweiligen Akte gespeichert.
- Berichte werden im PDF-Export ausgegeben.
- Diese Version basiert auf der stabilen V16.2-Basis.


## V18 Intelligence Network PRO

- neuer Tab `Netzwerk PRO`
- SVG-basiertes Beziehungsnetz mit Linien
- klickbare Knoten für Akte, Personen und verknüpfte Akten
- Beziehungstypen werden als Linien dargestellt:
  - ASSOCIATE
  - ACCOMPLICE
  - CONTACT
  - FAMILY
  - INFORMANT LINK
  - ORGANIZATION LINK
- Beziehungsformular direkt im Netzwerk-Tab
- Beziehungen werden im PDF-Export ergänzt

Hinweis: Personen müssen im Intelligence-Tab mit der Akte verknüpft sein, damit sie im Netzwerk erscheinen.
