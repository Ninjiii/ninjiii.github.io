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
