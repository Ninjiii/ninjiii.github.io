# FIB Akten-System V1

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
