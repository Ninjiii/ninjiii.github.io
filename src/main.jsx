
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp, deleteApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
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
  ClipboardList,
  FileText,
  Fingerprint,
  FolderKanban,
  Gavel,
  LayoutDashboard,
  Lock,
  LogOut,
  Plus,
  Search,
  Shield,
  Upload,
  UserCheck,
  Users
} from "lucide-react";
import { app, auth, db, firebaseConfig, storage } from "./firebase/firebase";
import { ALL_PERMISSIONS, normalizeRankList, can } from "./lib/roles";
import { exportCasePdf } from "./lib/pdf";
import "./styles/app.css";

const CASE_TYPES = ["Fallakte", "Gangakte", "Ermittlungsakte", "Observationsakte", "Einsatzakte"];
const STATUSES = ["Offen", "In Bearbeitung", "Unter Beobachtung", "Haftbefehl beantragt", "Abgeschlossen", "Archiviert"];
const PRIORITIES = ["Niedrig", "Normal", "Hoch", "Kritisch"];
const CLASSIFICATIONS = ["Intern", "Vertraulich", "Streng vertraulich", "Nur Führungsebene"];

function caseNumber(type) {
  const prefix = {
    Fallakte: "FIB-FALL",
    Gangakte: "FIB-GANG",
    Ermittlungsakte: "FIB-INV",
    Observationsakte: "FIB-OBS",
    Einsatzakte: "FIB-OPS"
  }[type] || "FIB-AKTE";
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

function emptyCase(user) {
  return {
    title: "",
    type: "Fallakte",
    status: "Offen",
    priority: "Normal",
    classification: "Intern",
    assignee: user?.email || "",
    assigneeUid: user?.uid || "",
    location: "",
    department: "Major Crimes Division",
    description: "",
    objective: "",
    tagsInput: "",
    suspectName: "",
    suspectInfo: "",
    evidenceName: "",
    evidenceInfo: "",
    noteInput: "",
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
          suspended: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      const nextSnap = await getDoc(userRef);
      const profile = nextSnap.data();

      if (profile?.suspended === true) {
        await signOut(auth);
        setState({ user: null, profile: null, loading: false });
        return;
      }

      setState({ user, profile, loading: false });
    });
  }, []);

  return state;
}

function useRanks() {
  const [ranks, setRanks] = useState(normalizeRankList());

  useEffect(() => {
    const refDoc = doc(db, "settings", "ranks");
    return onSnapshot(refDoc, snap => {
      setRanks(snap.exists() ? normalizeRankList(snap.data().items) : normalizeRankList());
    });
  }, []);

  return ranks;
}

function canSeeAllCases(role) {
  return ["Administrator", "Director", "Direktor", "Leitung"].includes(role);
}

function isOwnOrAssignedCase(caseFile, user) {
  if (!caseFile || !user) return false;
  return caseFile.createdBy === user.uid || caseFile.assigneeUid === user.uid || caseFile.assignee === user.email;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Login fehlgeschlagen. Bitte Zugangsdaten prüfen oder Administrator kontaktieren.");
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="seal">FIB</div>
        <h1>Federal Investigation Bureau</h1>
        <p>Gesichertes Akten-, Ermittlungs- und Einsatzsystem</p>

        <form onSubmit={submit}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-Mail" type="email" required />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Passwort" type="password" required />
          {error && <div className="error">{error}</div>}
          <button>Einloggen</button>
        </form>

        <p className="login-hint">Zugänge werden ausschließlich durch berechtigte Führungskräfte erstellt.</p>
      </section>
    </main>
  );
}

function Sidebar({ profile, active, setActive }) {
  const nav = [
    ["dashboard", "Lagezentrum", LayoutDashboard],
    ["akten", "Aktenzentrale", FolderKanban],
    ["termine", "Termine", CalendarDays],
    ["dokumente", "Dokumente", FileText],
    ["personal", "Personal", Users],
    ["admin", "Administration", Shield]
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="badge">FIB</div>
        <div>
          <strong>Federal Bureau</strong>
          <span>{profile?.displayName || profile?.email}</span>
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

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="stat-card">
      <Icon size={22} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function DashboardHome({ cases }) {
  const active = cases.filter(c => !["Abgeschlossen", "Archiviert"].includes(c.status));
  const critical = cases.filter(c => c.priority === "Kritisch");
  const surveillance = cases.filter(c => c.status === "Unter Beobachtung");

  return (
    <section className="home-grid">
      <div className="hero-panel">
        <span className="eyebrow">Lagezentrum</span>
        <h2>Operative Übersicht</h2>
        <p>Live-Ansicht über aktive Akten, kritische Ermittlungen, Observationslagen und letzte Einträge.</p>
        <div className="hero-metrics">
          <StatCard label="Aktive Akten" value={active.length} icon={FolderKanban} />
          <StatCard label="Kritisch" value={critical.length} icon={Lock} />
          <StatCard label="Observation" value={surveillance.length} icon={Fingerprint} />
        </div>
      </div>

      <div className="panel-list">
        <h3>Priorisierte Akten</h3>
        {critical.slice(0, 6).map(c => (
          <article key={c.id} className="compact-case">
            <b>{c.caseNo || "Ohne Aktennummer"}</b>
            <span>{c.title}</span>
            <small>{c.assignee || "Nicht zugewiesen"}</small>
          </article>
        ))}
        {!critical.length && <p className="muted">Keine kritischen Akten.</p>}
      </div>
    </section>
  );
}

function CaseForm({ user, users, onCreate }) {
  const [form, setForm] = useState(emptyCase(user));

  function set(key, value) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function selectAssignee(uid) {
    const selected = users.find(u => u.uid === uid);
    setForm(current => ({
      ...current,
      assigneeUid: uid,
      assignee: selected?.email || current.assignee
    }));
  }

  async function submit(e) {
    e.preventDefault();

    const payload = {
      caseNo: caseNumber(form.type),
      title: form.title,
      type: form.type,
      status: form.status,
      priority: form.priority,
      classification: form.classification,
      assignee: form.assignee,
      assigneeUid: form.assigneeUid,
      location: form.location,
      department: form.department,
      description: form.description,
      objective: form.objective,
      tags: form.tagsInput.split(",").map(t => t.trim()).filter(Boolean),
      suspects: form.suspectName ? [{ name: form.suspectName, info: form.suspectInfo, status: "Relevant" }] : [],
      evidence: form.evidenceName ? [{ name: form.evidenceName, info: form.evidenceInfo, type: "Beweisstück", addedAt: new Date().toISOString() }] : [],
      notes: form.noteInput ? [{ text: form.noteInput, date: new Date().toLocaleString("de-DE"), by: user.email }] : [],
      appointments: form.appointmentTitle ? [{ title: form.appointmentTitle, date: form.appointmentDate }] : [],
      logbook: form.logbookInput ? [{ text: form.logbookInput, date: new Date().toLocaleString("de-DE"), by: user.email }] : [],
      activity: [{ text: "Akte erstellt", date: new Date().toLocaleString("de-DE"), by: user.email }],
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
    <form className="case-form expanded" onSubmit={submit}>
      <div>
        <span className="eyebrow">Neue Großakte</span>
        <h2>Akte erfassen</h2>
      </div>

      <div className="grid-3">
        <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Aktenname / Operation" required />
        <select value={form.type} onChange={e => set("type", e.target.value)}>{CASE_TYPES.map(x => <option key={x}>{x}</option>)}</select>
        <select value={form.classification} onChange={e => set("classification", e.target.value)}>{CLASSIFICATIONS.map(x => <option key={x}>{x}</option>)}</select>
        <select value={form.status} onChange={e => set("status", e.target.value)}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select>
        <select value={form.priority} onChange={e => set("priority", e.target.value)}>{PRIORITIES.map(x => <option key={x}>{x}</option>)}</select>
        <select value={form.assigneeUid} onChange={e => selectAssignee(e.target.value)}>
          <option value={user.uid}>Mir selbst zuweisen</option>
          {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email} — {u.role}</option>)}
        </select>
        <input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Ort / Einsatzgebiet" />
        <input value={form.department} onChange={e => set("department", e.target.value)} placeholder="Abteilung" />
        <input value={form.tagsInput} onChange={e => set("tagsInput", e.target.value)} placeholder="Tags, kommasepariert" />
      </div>

      <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Sachverhalt / Hintergrund" />
      <textarea value={form.objective} onChange={e => set("objective", e.target.value)} placeholder="Ermittlungsziel / Maßnahmenziel" />

      <div className="grid-2">
        <div className="mini-section">
          <h3>Erste Person / Zielperson</h3>
          <input value={form.suspectName} onChange={e => set("suspectName", e.target.value)} placeholder="Name / Alias" />
          <textarea value={form.suspectInfo} onChange={e => set("suspectInfo", e.target.value)} placeholder="Beschreibung, Rolle, Hinweise" />
        </div>
        <div className="mini-section">
          <h3>Erstes Beweisstück</h3>
          <input value={form.evidenceName} onChange={e => set("evidenceName", e.target.value)} placeholder="Beweisstück / Dokument" />
          <textarea value={form.evidenceInfo} onChange={e => set("evidenceInfo", e.target.value)} placeholder="Beschreibung / Fundort / Relevanz" />
        </div>
      </div>

      <div className="grid-2">
        <textarea value={form.noteInput} onChange={e => set("noteInput", e.target.value)} placeholder="Erste Notiz" />
        <textarea value={form.logbookInput} onChange={e => set("logbookInput", e.target.value)} placeholder="Einsatztagebuch-Eintrag" />
      </div>

      <div className="grid-2">
        <input value={form.appointmentTitle} onChange={e => set("appointmentTitle", e.target.value)} placeholder="Termin / Maßnahme" />
        <input value={form.appointmentDate} onChange={e => set("appointmentDate", e.target.value)} type="datetime-local" />
      </div>

      <button><Plus size={18} /> Großakte speichern</button>
    </form>
  );
}

function ModuleList({ title, items, empty, render }) {
  return (
    <section className="module-card">
      <h3>{title}</h3>
      <div className="module-list">
        {items?.length ? items.map(render) : <p className="muted">{empty}</p>}
      </div>
    </section>
  );
}

function CaseDetails({ selected, profile, ranks, users, onClose }) {
  const [tab, setTab] = useState("overview");
  const [note, setNote] = useState("");
  const [log, setLog] = useState("");
  const [person, setPerson] = useState({ name: "", info: "" });
  const [evidence, setEvidence] = useState({ name: "", info: "" });
  const [appointment, setAppointment] = useState({ title: "", date: "" });
  const [uploading, setUploading] = useState(false);

  if (!selected) return null;

  const currentUser = auth.currentUser;
  const mayEdit = can(profile.role, "edit", ranks) && (canSeeAllCases(profile.role) || isOwnOrAssignedCase(selected, currentUser));
  const mayExport = can(profile.role, "export", ranks);
  const mayDelete = can(profile.role, "delete", ranks);
  const mayAssign = ["Administrator", "Director", "Direktor", "Leitung"].includes(profile.role);

  async function patchCase(data, activityText) {
    await updateDoc(doc(db, "cases", selected.id), {
      ...data,
      activity: [
        ...(selected.activity || []),
        { text: activityText, date: new Date().toLocaleString("de-DE"), by: currentUser.email }
      ],
      updatedAt: serverTimestamp()
    });
  }

  async function addNote() {
    if (!mayEdit || !note.trim()) return;
    await patchCase({ notes: [...(selected.notes || []), { text: note, date: new Date().toLocaleString("de-DE"), by: currentUser.email }] }, "Notiz hinzugefügt");
    setNote("");
  }

  async function addLog() {
    if (!mayEdit || !log.trim()) return;
    await patchCase({ logbook: [...(selected.logbook || []), { text: log, date: new Date().toLocaleString("de-DE"), by: currentUser.email }] }, "ETB-Eintrag hinzugefügt");
    setLog("");
  }

  async function addPerson() {
    if (!mayEdit || !person.name.trim()) return;
    await patchCase({ suspects: [...(selected.suspects || []), { ...person, status: "Relevant" }] }, `Person hinzugefügt: ${person.name}`);
    setPerson({ name: "", info: "" });
  }

  async function addEvidence() {
    if (!mayEdit || !evidence.name.trim()) return;
    await patchCase({ evidence: [...(selected.evidence || []), { ...evidence, type: "Beweisstück", addedAt: new Date().toISOString() }] }, `Beweis hinzugefügt: ${evidence.name}`);
    setEvidence({ name: "", info: "" });
  }

  async function addAppointment() {
    if (!mayEdit || !appointment.title.trim()) return;
    await patchCase({ appointments: [...(selected.appointments || []), appointment] }, `Termin angelegt: ${appointment.title}`);
    setAppointment({ title: "", date: "" });
  }

  async function assignTo(uid) {
    if (!mayAssign) return;
    const target = users.find(u => u.uid === uid);
    await patchCase({ assigneeUid: uid, assignee: target?.email || "" }, `Akte zugewiesen an ${target?.displayName || target?.email || uid}`);
  }

  async function uploadFile(file) {
    if (!mayEdit || !file) return;
    setUploading(true);
    const path = `case-files/${selected.id}/${Date.now()}-${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    await patchCase({
      documents: [...(selected.documents || []), { name: file.name, url, path, uploadedAt: new Date().toISOString() }]
    }, `Dokument hochgeladen: ${file.name}`);
    setUploading(false);
  }

  async function removeCase() {
    if (!mayDelete) return;
    if (!confirm("Akte wirklich löschen?")) return;
    await deleteDoc(doc(db, "cases", selected.id));
    onClose();
  }

  const tabs = [
    ["overview", "Übersicht"],
    ["persons", "Personen"],
    ["evidence", "Beweise"],
    ["documents", "Dokumente"],
    ["notes", "Notizen"],
    ["logbook", "ETB"],
    ["timeline", "Chronik"]
  ];

  return (
    <section className="details wide-details">
      <header>
        <div>
          <span className="eyebrow">{selected.caseNo || selected.type}</span>
          <h2>{selected.title}</h2>
          <div className="meta">
            <span>{selected.type}</span>
            <span>{selected.status}</span>
            <span>{selected.priority}</span>
            <span>{selected.classification}</span>
          </div>
        </div>
        <button className="ghost" onClick={onClose}>Schließen</button>
      </header>

      <div className="case-toolbar">
        {mayExport && <button onClick={() => exportCasePdf(selected)}>PDF Export</button>}
        {mayDelete && <button className="danger" onClick={removeCase}>Löschen</button>}
        {mayAssign && (
          <select value={selected.assigneeUid || ""} onChange={e => assignTo(e.target.value)}>
            <option value="">Zuweisen...</option>
            {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email} — {u.role}</option>)}
          </select>
        )}
      </div>

      <nav className="tabs">
        {tabs.map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      {tab === "overview" && (
        <div className="detail-grid">
          <section className="module-card span-2">
            <h3>Sachverhalt</h3>
            <p>{selected.description || "Keine Beschreibung."}</p>
            <h3>Ermittlungsziel</h3>
            <p>{selected.objective || "Kein Ermittlungsziel hinterlegt."}</p>
          </section>
          <section className="module-card">
            <h3>Verantwortung</h3>
            <p><b>Bearbeiter:</b><br />{selected.assignee || "Nicht zugewiesen"}</p>
            <p><b>Ort:</b><br />{selected.location || "-"}</p>
            <p><b>Abteilung:</b><br />{selected.department || "-"}</p>
          </section>
        </div>
      )}

      {tab === "persons" && (
        <div className="detail-grid">
          <ModuleList title="Beteiligte / Zielpersonen" items={selected.suspects || []} empty="Keine Personen hinterlegt." render={(p, i) => (
            <article key={i} className="record-card"><b>{p.name}</b><span>{p.status}</span><p>{p.info}</p></article>
          )} />
          {mayEdit && <section className="module-card">
            <h3>Person hinzufügen</h3>
            <input value={person.name} onChange={e => setPerson({ ...person, name: e.target.value })} placeholder="Name / Alias" />
            <textarea value={person.info} onChange={e => setPerson({ ...person, info: e.target.value })} placeholder="Rolle, Hinweise, Beschreibung" />
            <button onClick={addPerson}>Person speichern</button>
          </section>}
        </div>
      )}

      {tab === "evidence" && (
        <div className="detail-grid">
          <ModuleList title="Beweise" items={selected.evidence || []} empty="Keine Beweise hinterlegt." render={(ev, i) => (
            <article key={i} className="record-card"><b>{ev.name}</b><span>{ev.type}</span><p>{ev.info}</p></article>
          )} />
          {mayEdit && <section className="module-card">
            <h3>Beweis hinzufügen</h3>
            <input value={evidence.name} onChange={e => setEvidence({ ...evidence, name: e.target.value })} placeholder="Beweisstück" />
            <textarea value={evidence.info} onChange={e => setEvidence({ ...evidence, info: e.target.value })} placeholder="Beschreibung / Fundort / Relevanz" />
            <button onClick={addEvidence}>Beweis speichern</button>
          </section>}
        </div>
      )}

      {tab === "documents" && (
        <ModuleList title="Dokumente" items={selected.documents || []} empty="Keine Dokumente hochgeladen." render={(d, i) => (
          <a key={i} href={d.url} target="_blank" className="doc-link">{d.name}</a>
        )} />
      )}

      {tab === "documents" && mayEdit && (
        <label className="upload">
          <Upload size={18} /> {uploading ? "Upload läuft..." : "Dokument hochladen"}
          <input type="file" hidden onChange={e => uploadFile(e.target.files[0])} />
        </label>
      )}

      {tab === "notes" && (
        <div className="detail-grid">
          <ModuleList title="Notizen" items={selected.notes || []} empty="Keine Notizen." render={(n, i) => (
            <article key={i} className="record-card"><b>{n.date}</b><span>{n.by}</span><p>{n.text}</p></article>
          )} />
          {mayEdit && <section className="module-card">
            <h3>Notiz hinzufügen</h3>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Neue Notiz" />
            <button onClick={addNote}>Notiz speichern</button>
          </section>}
        </div>
      )}

      {tab === "logbook" && (
        <div className="detail-grid">
          <ModuleList title="Einsatztagebuch" items={selected.logbook || []} empty="Keine ETB-Einträge." render={(l, i) => (
            <article key={i} className="record-card"><b>{l.date}</b><span>{l.by}</span><p>{l.text}</p></article>
          )} />
          {mayEdit && <section className="module-card">
            <h3>ETB Eintrag</h3>
            <textarea value={log} onChange={e => setLog(e.target.value)} placeholder="Einsatzverlauf / Maßnahme" />
            <button onClick={addLog}>Eintrag speichern</button>
          </section>}
          {mayEdit && <section className="module-card">
            <h3>Termin / Maßnahme</h3>
            <input value={appointment.title} onChange={e => setAppointment({ ...appointment, title: e.target.value })} placeholder="Termin" />
            <input value={appointment.date} onChange={e => setAppointment({ ...appointment, date: e.target.value })} type="datetime-local" />
            <button onClick={addAppointment}>Termin speichern</button>
          </section>}
        </div>
      )}

      {tab === "timeline" && (
        <ModuleList title="Chronik" items={selected.activity || []} empty="Keine Aktivität." render={(a, i) => (
          <article key={i} className="timeline-item"><b>{a.date}</b><span>{a.by}</span><p>{a.text}</p></article>
        )} />
      )}
    </section>
  );
}

function AdminPanel({ currentUser, profile, ranks }) {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("");
  const [newUser, setNewUser] = useState({ email: "", password: "", displayName: "", role: ranks[0]?.name || "Anwärter" });
  const [rankName, setRankName] = useState("");
  const [rankPermissions, setRankPermissions] = useState(["read"]);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  async function updateRole(userId, role) {
    if (role === "Administrator" && profile.role !== "Administrator") {
      setStatus("Nur Administratoren können Administratoren vergeben.");
      return;
    }
    await updateDoc(doc(db, "users", userId), { role, suspended: false, updatedAt: serverTimestamp() });
    setStatus("Rolle aktualisiert.");
  }

  async function updateDisplayName(userId, displayName) {
    await updateDoc(doc(db, "users", userId), { displayName, suspended: false, updatedAt: serverTimestamp() });
    setStatus("Name aktualisiert.");
  }

  async function toggleSuspended(user) {
    if (user.uid === currentUser.uid) {
      setStatus("Du kannst deinen eigenen Account nicht sperren.");
      return;
    }
    await updateDoc(doc(db, "users", user.id), { suspended: !user.suspended, updatedAt: serverTimestamp() });
    setStatus(user.suspended ? "Account entsperrt." : "Account gesperrt.");
  }

  async function createManagedAccount(event) {
    event.preventDefault();
    if (!can(profile.role, "createUsers", ranks)) {
      setStatus("Keine Berechtigung.");
      return;
    }
    if (newUser.role === "Administrator" && profile.role !== "Administrator") {
      setStatus("Nur Administratoren können Administrator-Accounts erstellen.");
      return;
    }

    const secondaryApp = initializeApp(firebaseConfig, `account-create-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        email: newUser.email,
        displayName: newUser.displayName || newUser.email.split("@")[0],
        role: newUser.role,
        suspended: false,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      setNewUser({ email: "", password: "", displayName: "", role: ranks[0]?.name || "Anwärter" });
      setStatus("Account erstellt.");
    } catch (error) {
      await deleteApp(secondaryApp);
      setStatus(`Fehler: ${error.message}`);
    }
  }

  async function saveRanks(nextRanks) {
    await setDoc(doc(db, "settings", "ranks"), {
      items: normalizeRankList(nextRanks),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    });
  }

  async function addRank(event) {
    event.preventDefault();
    const clean = rankName.trim();
    if (!clean) return;
    await saveRanks([...ranks, { name: clean, permissions: rankPermissions }]);
    setRankName("");
    setStatus("Rang erstellt.");
  }

  async function updateRankPermissions(rankName, permission, checked) {
    const next = ranks.map(rank => {
      if (rank.name !== rankName) return rank;
      const permissions = checked
        ? Array.from(new Set([...(rank.permissions || []), permission]))
        : (rank.permissions || []).filter(item => item !== permission);
      return { ...rank, permissions: permissions.length ? permissions : ["read"] };
    });
    await saveRanks(next);
  }

  async function deleteRank(rankName) {
    if (rankName === "Administrator") return;
    await saveRanks(ranks.filter(rank => rank.name !== rankName));
  }

  const mayManageUsers = can(profile.role, "manageUsers", ranks);
  const mayCreateUsers = can(profile.role, "createUsers", ranks);
  const mayManageRanks = can(profile.role, "manageRanks", ranks);

  return (
    <section className="admin-panel">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Administration</span>
          <h2>Personal, Zugänge & Ränge</h2>
          <p>Zugänge, Anzeigenamen, Sperren und Rechteverwaltung.</p>
        </div>
        <div className="admin-count">{users.length} Nutzer</div>
      </div>

      {status && <div className="notice">{status}</div>}

      {mayCreateUsers && (
        <form className="admin-create" onSubmit={createManagedAccount}>
          <h3>Account anlegen</h3>
          <div className="grid-2">
            <input value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="Login E-Mail" type="email" required />
            <input value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Startpasswort" type="password" minLength={6} required />
            <input value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} placeholder="z.B. FIB-10 | Fox" required />
            <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
              {ranks.filter(r => profile.role === "Administrator" || r.name !== "Administrator").map(r => <option key={r.name}>{r.name}</option>)}
            </select>
          </div>
          <button>Account erstellen</button>
        </form>
      )}

      {mayManageUsers && (
        <div className="admin-table">
          <div className="admin-row admin-row-head admin-row-wide">
            <span>Nutzer</span><span>Name</span><span>Rang</span><span>Status</span><span>Aktion</span>
          </div>
          {users.map(user => (
            <div className="admin-row admin-row-wide" key={user.id}>
              <div><strong>{user.displayName || "Unbekannt"}</strong><small>{user.email}</small></div>
              <input defaultValue={user.displayName || ""} onBlur={e => updateDisplayName(user.id, e.target.value)} />
              <select value={user.role || "Anwärter"} onChange={e => updateRole(user.id, e.target.value)} disabled={user.uid === currentUser.uid}>
                {ranks.filter(r => profile.role === "Administrator" || r.name !== "Administrator").map(r => <option key={r.name}>{r.name}</option>)}
              </select>
              <span className={user.suspended ? "status-bad" : "status-good"}>{user.suspended ? "Gesperrt" : "Aktiv"}</span>
              <button className={user.suspended ? "ghost" : "danger"} onClick={() => toggleSuspended(user)} disabled={user.uid === currentUser.uid}>
                {user.suspended ? "Entsperren" : "Sperren"}
              </button>
            </div>
          ))}
        </div>
      )}

      {mayManageRanks && (
        <div className="rank-manager">
          <h3>Rangliste & Rechte</h3>
          <form className="rank-create" onSubmit={addRank}>
            <input value={rankName} onChange={e => setRankName(e.target.value)} placeholder="Neuer Rang" />
            <button>Rang hinzufügen</button>
          </form>

          <div className="rank-list">
            {ranks.map(rank => (
              <article key={rank.name} className="rank-card">
                <header>
                  <strong>{rank.name}</strong>
                  {rank.name !== "Administrator" && <button className="ghost" onClick={() => deleteRank(rank.name)}>Löschen</button>}
                </header>
                <div className="permission-grid">
                  {ALL_PERMISSIONS.map(permission => (
                    <label key={permission.id}>
                      <input type="checkbox" checked={(rank.permissions || []).includes(permission.id)} disabled={rank.name === "Administrator"} onChange={e => updateRankPermissions(rank.name, permission.id, e.target.checked)} />
                      {permission.label}
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Dashboard({ user, profile }) {
  const ranks = useRanks();
  const [active, setActive] = useState("dashboard");
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Alle");
  const [statusFilter, setStatusFilter] = useState("Alle");
  const [showForm, setShowForm] = useState(false);

  const mayReadCases = can(profile.role, "read", ranks);
  const mayCreateCases = can(profile.role, "create", ranks);
  const mayViewAllCases = canSeeAllCases(profile.role);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCases(mayViewAllCases ? loaded : loaded.filter(caseFile => isOwnOrAssignedCase(caseFile, user)));
    });
  }, [mayViewAllCases, user]);

  const selected = cases.find(c => c.id === selectedId);

  const filtered = useMemo(() => {
    return cases.filter(c => {
      const text = `${c.caseNo} ${c.title} ${c.type} ${c.status} ${c.priority} ${c.assignee} ${c.location} ${(c.tags || []).join(" ")}`.toLowerCase();
      return text.includes(search.toLowerCase())
        && (typeFilter === "Alle" || c.type === typeFilter)
        && (statusFilter === "Alle" || c.status === statusFilter);
    });
  }, [cases, search, typeFilter, statusFilter]);

  const stats = {
    total: cases.length,
    active: cases.filter(c => !["Abgeschlossen", "Archiviert"].includes(c.status)).length,
    critical: cases.filter(c => c.priority === "Kritisch").length,
    confidential: cases.filter(c => ["Streng vertraulich", "Nur Führungsebene"].includes(c.classification)).length
  };

  return (
    <div className="app-shell">
      <Sidebar profile={profile} active={active} setActive={setActive} />
      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Sicherheitsstufe: {profile.role}</span>
            <h1>{active === "dashboard" ? "Lagezentrum" : active === "akten" ? "Aktenzentrale" : active}</h1>
          </div>
          <div className="user-pill">{profile.displayName || user.email}</div>
        </header>

        {active === "dashboard" && <DashboardHome cases={cases} />}

        {active === "akten" && mayReadCases && (
          <>
            <section className="stats">
              <StatCard label="Gesamtakten" value={stats.total} icon={Archive} />
              <StatCard label="Aktiv" value={stats.active} icon={ClipboardList} />
              <StatCard label="Kritisch" value={stats.critical} icon={Gavel} />
              <StatCard label="Geheim" value={stats.confidential} icon={Lock} />
            </section>

            <section className="toolbar stacked">
              <div className="search"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Aktennummer, Titel, Ort, Bearbeiter, Tags..." /></div>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option>Alle</option>{CASE_TYPES.map(x => <option key={x}>{x}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option>Alle</option>{STATUSES.map(x => <option key={x}>{x}</option>)}
              </select>
              <div className="access-chip">{mayViewAllCases ? "Vollzugriff" : "Eigene / zugewiesene Akten"}</div>
              {mayCreateCases && <button onClick={() => setShowForm(!showForm)}><Plus size={18} /> Neue Großakte</button>}
            </section>

            {showForm && <CaseForm user={user} users={users} onCreate={() => setShowForm(false)} />}

            <section className="case-table">
              <div className="case-table-head">
                <span>Akte</span><span>Typ</span><span>Status</span><span>Priorität</span><span>Bearbeiter</span>
              </div>
              {filtered.map(c => (
                <article key={c.id} className="case-row" onClick={() => setSelectedId(c.id)}>
                  <div>
                    <b>{c.caseNo || "Ohne Aktennummer"}</b>
                    <strong>{c.title}</strong>
                    <small>{c.location || "Kein Ort"} · {(c.tags || []).join(", ")}</small>
                  </div>
                  <span>{c.type}</span>
                  <span className="pill">{c.status}</span>
                  <span className={`pill priority-${c.priority?.toLowerCase()}`}>{c.priority}</span>
                  <span>{c.assignee || "Nicht zugewiesen"}</span>
                </article>
              ))}
            </section>
          </>
        )}

        {active === "akten" && !mayReadCases && (
          <section className="placeholder"><h2>Kein Aktenzugriff</h2><p>Dein Rang hat keine Leserechte.</p></section>
        )}

        {active === "admin" && <AdminPanel currentUser={user} profile={profile} ranks={ranks} />}

        {!["dashboard", "akten", "admin"].includes(active) && (
          <section className="placeholder">
            <h2>{active}</h2>
            <p>Dieser Bereich ist als eigenes Großmodul vorbereitet und kann im nächsten Schritt ausgebaut werden.</p>
          </section>
        )}
      </main>

      {selected && (
        <div className="case-modal-backdrop">
          <div className="case-modal-window">
            <CaseDetails selected={selected} profile={profile} ranks={ranks} users={users} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}
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
