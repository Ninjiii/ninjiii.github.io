import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  Archive,
  CalendarDays,
  FileText,
  FolderKanban,
  LogOut,
  Plus,
  Search,
  Shield,
  Upload,
  Users
} from "lucide-react";
import { auth, db, storage } from "./firebase/firebase";
import { ROLES, can } from "./lib/roles";
import { exportCasePdf } from "./lib/pdf";
import "./styles/app.css";

const CASE_TYPES = ["Fallakte", "Gangakte", "Ermittlungsakte"];
const STATUSES = ["Offen", "In Bearbeitung", "Unter Beobachtung", "Abgeschlossen", "Archiviert"];
const PRIORITIES = ["Niedrig", "Normal", "Hoch", "Kritisch"];

function emptyCase(user) {
  return {
    title: "",
    type: "Fallakte",
    status: "Offen",
    priority: "Normal",
    assignee: user?.email || "",
    description: "",
    tagsInput: "",
    notesInput: "",
    appointmentTitle: "",
    appointmentDate: "",
    logbookInput: ""
  };
}

function useAuthProfile() {
  const [state, setState] = useState({ user: null, profile: null, loading: true });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.email?.split("@")[0],
          role: "Anwärter",
          createdAt: serverTimestamp()
        });
      }

      const nextSnap = await getDoc(userRef);
      setState({ user, profile: nextSnap.data(), loading: false });
    });
  }, []);

  return state;
}

function LoginScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="seal">FIB</div>
        <h1>Federal Investigation Bureau</h1>
        <p>Gesichertes Akten- und Einsatzsystem</p>

        <form onSubmit={submit}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-Mail" type="email" required />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Passwort" type="password" required />
          {error && <div className="error">{error}</div>}
          <button>{mode === "login" ? "Einloggen" : "Account erstellen"}</button>
        </form>

        <button className="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Neuen Zugang erstellen" : "Zurück zum Login"}
        </button>
      </section>
    </main>
  );
}

function Sidebar({ profile, active, setActive }) {
  const nav = [
    ["akten", "Akten", FolderKanban],
    ["termine", "Termine", CalendarDays],
    ["dokumente", "Dokumente", FileText],
    ["personal", "Ränge", Users],
    ["admin", "Administration", Shield]
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="badge">FIB</div>
        <div>
          <strong>Akten-System</strong>
          <span>{profile?.role}</span>
        </div>
      </div>

      <nav>
        {nav.map(([id, label, Icon]) => (
          <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>

      <button className="logout" onClick={() => signOut(auth)}>
        <LogOut size={18} /> Abmelden
      </button>
    </aside>
  );
}

function CaseForm({ user, onCreate }) {
  const [form, setForm] = useState(emptyCase(user));

  function set(key, value) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    const payload = {
      title: form.title,
      type: form.type,
      status: form.status,
      priority: form.priority,
      assignee: form.assignee,
      description: form.description,
      tags: form.tagsInput.split(",").map(t => t.trim()).filter(Boolean),
      notes: form.notesInput ? [{ text: form.notesInput, date: new Date().toISOString() }] : [],
      appointments: form.appointmentTitle ? [{ title: form.appointmentTitle, date: form.appointmentDate }] : [],
      logbook: form.logbookInput ? [{ text: form.logbookInput, date: new Date().toLocaleString("de-DE") }] : [],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      documents: []
    };

    await addDoc(collection(db, "cases"), payload);
    setForm(emptyCase(user));
    onCreate?.();
  }

  return (
    <form className="case-form" onSubmit={submit}>
      <h2>Neue Akte erstellen</h2>
      <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Aktenname / Titel" required />
      <div className="grid-2">
        <select value={form.type} onChange={e => set("type", e.target.value)}>{CASE_TYPES.map(x => <option key={x}>{x}</option>)}</select>
        <select value={form.status} onChange={e => set("status", e.target.value)}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select>
        <select value={form.priority} onChange={e => set("priority", e.target.value)}>{PRIORITIES.map(x => <option key={x}>{x}</option>)}</select>
        <input value={form.assignee} onChange={e => set("assignee", e.target.value)} placeholder="Sachbearbeiter" />
      </div>
      <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Beschreibung / Sachverhalt" />
      <input value={form.tagsInput} onChange={e => set("tagsInput", e.target.value)} placeholder="Tags, kommasepariert" />
      <textarea value={form.notesInput} onChange={e => set("notesInput", e.target.value)} placeholder="Erste Notiz" />
      <div className="grid-2">
        <input value={form.appointmentTitle} onChange={e => set("appointmentTitle", e.target.value)} placeholder="Termin-Titel" />
        <input value={form.appointmentDate} onChange={e => set("appointmentDate", e.target.value)} type="datetime-local" />
      </div>
      <textarea value={form.logbookInput} onChange={e => set("logbookInput", e.target.value)} placeholder="Einsatztagebuch-Eintrag" />
      <button><Plus size={18} /> Akte speichern</button>
    </form>
  );
}

function CaseDetails({ selected, profile, onClose }) {
  const [note, setNote] = useState("");
  const [log, setLog] = useState("");
  const [appointmentTitle, setAppointmentTitle] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [uploading, setUploading] = useState(false);

  if (!selected) return null;

  async function addNote() {
    if (!note.trim()) return;
    await updateDoc(doc(db, "cases", selected.id), {
      notes: [...(selected.notes || []), { text: note, date: new Date().toLocaleString("de-DE") }],
      updatedAt: serverTimestamp()
    });
    setNote("");
  }

  async function addLog() {
    if (!log.trim()) return;
    await updateDoc(doc(db, "cases", selected.id), {
      logbook: [...(selected.logbook || []), { text: log, date: new Date().toLocaleString("de-DE") }],
      updatedAt: serverTimestamp()
    });
    setLog("");
  }

  async function addAppointment() {
    if (!appointmentTitle.trim()) return;
    await updateDoc(doc(db, "cases", selected.id), {
      appointments: [...(selected.appointments || []), { title: appointmentTitle, date: appointmentDate }],
      updatedAt: serverTimestamp()
    });
    setAppointmentTitle("");
    setAppointmentDate("");
  }

  async function uploadFile(file) {
    if (!file) return;
    setUploading(true);
    const path = `case-files/${selected.id}/${Date.now()}-${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    await updateDoc(doc(db, "cases", selected.id), {
      documents: [...(selected.documents || []), { name: file.name, url, path, uploadedAt: new Date().toISOString() }],
      updatedAt: serverTimestamp()
    });
    setUploading(false);
  }

  async function removeCase() {
    if (!confirm("Akte wirklich löschen?")) return;
    await deleteDoc(doc(db, "cases", selected.id));
    onClose();
  }

  return (
    <section className="details">
      <header>
        <div>
          <span className="eyebrow">{selected.type}</span>
          <h2>{selected.title}</h2>
        </div>
        <button className="ghost" onClick={onClose}>Schließen</button>
      </header>

      <div className="meta">
        <span>{selected.status}</span>
        <span>{selected.priority}</span>
        <span>{selected.assignee}</span>
      </div>

      <p>{selected.description}</p>

      <div className="actions">
        {can(profile.role, "export") && <button onClick={() => exportCasePdf(selected)}>PDF herunterladen</button>}
        {can(profile.role, "delete") && <button className="danger" onClick={removeCase}>Löschen</button>}
      </div>

      <div className="panel">
        <h3>Dokumente</h3>
        <label className="upload">
          <Upload size={18} /> {uploading ? "Upload läuft..." : "Dokument hochladen"}
          <input type="file" hidden onChange={e => uploadFile(e.target.files[0])} />
        </label>
        {(selected.documents || []).map((d, i) => <a key={i} href={d.url} target="_blank">{d.name}</a>)}
      </div>

      <div className="panel">
        <h3>Notizen</h3>
        {(selected.notes || []).map((n, i) => <p key={i}><b>{n.date}</b><br />{n.text}</p>)}
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Neue Notiz" />
        <button onClick={addNote}>Notiz hinzufügen</button>
      </div>

      <div className="panel">
        <h3>Termine</h3>
        {(selected.appointments || []).map((a, i) => <p key={i}><b>{a.date}</b><br />{a.title}</p>)}
        <div className="grid-2">
          <input value={appointmentTitle} onChange={e => setAppointmentTitle(e.target.value)} placeholder="Termin" />
          <input value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} type="datetime-local" />
        </div>
        <button onClick={addAppointment}>Termin speichern</button>
      </div>

      <div className="panel">
        <h3>Einsatztagebuch</h3>
        {(selected.logbook || []).map((l, i) => <p key={i}><b>{l.date}</b><br />{l.text}</p>)}
        <textarea value={log} onChange={e => setLog(e.target.value)} placeholder="Neuer ETB-Eintrag" />
        <button onClick={addLog}>Eintrag speichern</button>
      </div>
    </section>
  );
}

function Dashboard({ user, profile }) {
  const [active, setActive] = useState("akten");
  const [cases, setCases] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setCases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const selected = cases.find(c => c.id === selectedId);
  const filtered = useMemo(() => {
    return cases.filter(c => {
      const text = `${c.title} ${c.type} ${c.status} ${c.priority} ${c.assignee} ${(c.tags || []).join(" ")}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [cases, search]);

  const stats = {
    total: cases.length,
    open: cases.filter(c => c.status !== "Abgeschlossen" && c.status !== "Archiviert").length,
    critical: cases.filter(c => c.priority === "Kritisch").length
  };

  return (
    <div className="app-shell">
      <Sidebar profile={profile} active={active} setActive={setActive} />
      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Sicherheitsstufe: {profile.role}</span>
            <h1>{active === "akten" ? "Aktenzentrale" : active}</h1>
          </div>
          <div className="user-pill">{user.email}</div>
        </header>

        {active === "akten" && (
          <>
            <section className="stats">
              <div><strong>{stats.total}</strong><span>Gesamtakten</span></div>
              <div><strong>{stats.open}</strong><span>Aktiv</span></div>
              <div><strong>{stats.critical}</strong><span>Kritisch</span></div>
            </section>

            <section className="toolbar">
              <div className="search"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Akten durchsuchen..." /></div>
              {can(profile.role, "create") && <button onClick={() => setShowForm(!showForm)}><Plus size={18} /> Neue Akte</button>}
            </section>

            {showForm && <CaseForm user={user} onCreate={() => setShowForm(false)} />}

            <section className="case-grid">
              {filtered.map(c => (
                <article key={c.id} className="case-card" onClick={() => setSelectedId(c.id)}>
                  <div className="case-icon"><Archive size={22} /></div>
                  <span>{c.type}</span>
                  <h3>{c.title}</h3>
                  <p>{c.description || "Keine Beschreibung"}</p>
                  <div className="tags">
                    <b>{c.status}</b>
                    <b>{c.priority}</b>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}

        {active !== "akten" && (
          <section className="placeholder">
            <h2>{active}</h2>
            <p>Dieser Bereich ist vorbereitet. Die Daten sind bereits in den Aktenmodulen enthalten und können als eigene Ansicht ausgebaut werden.</p>
          </section>
        )}
      </main>

      <CaseDetails selected={selected} profile={profile} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function App() {
  const { user, profile, loading } = useAuthProfile();

  if (loading) return <main className="loading">FIB-System wird geladen...</main>;
  if (!user) return <LoginScreen />;
  return <Dashboard user={user} profile={profile} />;
}

createRoot(document.getElementById("root")).render(<App />);
