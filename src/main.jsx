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
  FileText,
  FolderKanban,
  LogOut,
  Plus,
  Search,
  Shield,
  Upload,
  Users
} from "lucide-react";
import { app, auth, db, firebaseConfig, storage } from "./firebase/firebase";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, normalizeRankList, can } from "./lib/roles";
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
    assigneeUid: user?.uid || "",
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
      const profile = nextSnap.data();

      if (profile?.suspended) {
        await signOut(auth);
        setState({ user: null, profile: null, loading: false });
        return;
      }

      setState({ user, profile, loading: false });
    });
  }, []);

  return state;
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
    } catch (err) {
      setError("Login fehlgeschlagen. Bitte Zugangsdaten prüfen oder Administrator kontaktieren.");
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
          <button>Einloggen</button>
        </form>

        <p className="login-hint">Zugänge werden ausschließlich durch berechtigte Führungskräfte erstellt.</p>
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
      assigneeUid: form.assignee === user.email ? user.uid : form.assigneeUid,
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

function CaseDetails({ selected, profile, ranks, onClose }) {
  const [note, setNote] = useState("");
  const [log, setLog] = useState("");
  const [appointmentTitle, setAppointmentTitle] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [uploading, setUploading] = useState(false);

  if (!selected) return null;

  const mayEdit = can(profile.role, "edit", ranks);
  const mayExport = can(profile.role, "export", ranks);
  const mayDelete = can(profile.role, "delete", ranks);
  const mayAccessCase = canSeeAllCases(profile.role) || isOwnOrAssignedCase(selected, auth.currentUser);

  if (!mayAccessCase) {
    return (
      <section className="details">
        <header>
          <div>
            <span className="eyebrow">Zugriff verweigert</span>
            <h2>Akte gesperrt</h2>
          </div>
          <button className="ghost" onClick={onClose}>Schließen</button>
        </header>
        <p>Dein Rang darf nur eigene oder zugewiesene Akten öffnen.</p>
      </section>
    );
  }

  async function addNote() {
    if (!mayEdit) return;
    if (!note.trim()) return;
    await updateDoc(doc(db, "cases", selected.id), {
      notes: [...(selected.notes || []), { text: note, date: new Date().toLocaleString("de-DE") }],
      updatedAt: serverTimestamp()
    });
    setNote("");
  }

  async function addLog() {
    if (!mayEdit) return;
    if (!log.trim()) return;
    await updateDoc(doc(db, "cases", selected.id), {
      logbook: [...(selected.logbook || []), { text: log, date: new Date().toLocaleString("de-DE") }],
      updatedAt: serverTimestamp()
    });
    setLog("");
  }

  async function addAppointment() {
    if (!mayEdit) return;
    if (!appointmentTitle.trim()) return;
    await updateDoc(doc(db, "cases", selected.id), {
      appointments: [...(selected.appointments || []), { title: appointmentTitle, date: appointmentDate }],
      updatedAt: serverTimestamp()
    });
    setAppointmentTitle("");
    setAppointmentDate("");
  }

  async function uploadFile(file) {
    if (!mayEdit) return;
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
    if (!mayDelete) return;
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
        {mayExport && <button onClick={() => exportCasePdf(selected)}>PDF herunterladen</button>}
        {mayDelete && <button className="danger" onClick={removeCase}>Löschen</button>}
      </div>

      <div className="panel">
        <h3>Dokumente</h3>
        {mayEdit && (
          <label className="upload">
            <Upload size={18} /> {uploading ? "Upload läuft..." : "Dokument hochladen"}
            <input type="file" hidden onChange={e => uploadFile(e.target.files[0])} />
          </label>
        )}
        {(selected.documents || []).map((d, i) => <a key={i} href={d.url} target="_blank">{d.name}</a>)}
      </div>

      <div className="panel">
        <h3>Notizen</h3>
        {(selected.notes || []).map((n, i) => <p key={i}><b>{n.date}</b><br />{n.text}</p>)}
        {mayEdit && (
          <>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Neue Notiz" />
            <button onClick={addNote}>Notiz hinzufügen</button>
          </>
        )}
      </div>

      <div className="panel">
        <h3>Termine</h3>
        {(selected.appointments || []).map((a, i) => <p key={i}><b>{a.date}</b><br />{a.title}</p>)}
        {mayEdit && (
          <>
            <div className="grid-2">
              <input value={appointmentTitle} onChange={e => setAppointmentTitle(e.target.value)} placeholder="Termin" />
              <input value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} type="datetime-local" />
            </div>
            <button onClick={addAppointment}>Termin speichern</button>
          </>
        )}
      </div>

      <div className="panel">
        <h3>Einsatztagebuch</h3>
        {(selected.logbook || []).map((l, i) => <p key={i}><b>{l.date}</b><br />{l.text}</p>)}
        {mayEdit && (
          <>
            <textarea value={log} onChange={e => setLog(e.target.value)} placeholder="Neuer ETB-Eintrag" />
            <button onClick={addLog}>Eintrag speichern</button>
          </>
        )}
      </div>
    </section>
  );
}



function useRanks() {
  const [ranks, setRanks] = useState(normalizeRankList());

  useEffect(() => {
    const refDoc = doc(db, "settings", "ranks");
    return onSnapshot(refDoc, snap => {
      if (snap.exists()) {
        setRanks(normalizeRankList(snap.data().items));
      } else {
        setRanks(normalizeRankList());
      }
    });
  }, []);

  return ranks;
}

function canSeeAllCases(role) {
  return ["Administrator", "Director", "Direktor", "Leitung"].includes(role);
}

function isOwnOrAssignedCase(caseFile, user) {
  if (!caseFile || !user) return false;
  return caseFile.createdBy === user.uid
    || caseFile.assigneeUid === user.uid
    || caseFile.assignee === user.email;
}

function AdminPanel({ currentUser, profile, ranks }) {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("");
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    displayName: "",
    role: ranks[0]?.name || "Anwärter"
  });
  const [rankName, setRankName] = useState("");
  const [rankPermissions, setRankPermissions] = useState(["read"]);

  useEffect(() => {
    if (!can(profile.role, "manageUsers", ranks) && !can(profile.role, "createUsers", ranks)) return;
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [profile.role, ranks]);

  useEffect(() => {
    if (!ranks.find(rank => rank.name === newUser.role)) {
      setNewUser(current => ({ ...current, role: ranks[0]?.name || "Anwärter" }));
    }
  }, [ranks, newUser.role]);

  async function updateRole(userId, role) {
    setStatus("");
    if (role === "Administrator" && profile.role !== "Administrator") {
      setStatus("Nur Administratoren können den Administrator-Rang vergeben.");
      return;
    }
    try {
      await updateDoc(doc(db, "users", userId), {
        role,
        updatedAt: serverTimestamp()
      });
      setStatus("Rolle wurde aktualisiert.");
    } catch (error) {
      setStatus(`Fehler: ${error.message}`);
    }
  }

  async function updateDisplayName(userId, displayName) {
    setStatus("");
    try {
      await updateDoc(doc(db, "users", userId), {
        displayName,
        updatedAt: serverTimestamp()
      });
      setStatus("Name wurde aktualisiert.");
    } catch (error) {
      setStatus(`Fehler: ${error.message}`);
    }
  }

  async function toggleSuspended(user) {
    if (user.uid === currentUser.uid) {
      setStatus("Du kannst deinen eigenen Account nicht sperren.");
      return;
    }

    setStatus("");
    try {
      await updateDoc(doc(db, "users", user.id), {
        suspended: !user.suspended,
        updatedAt: serverTimestamp()
      });
      setStatus(user.suspended ? "Account wurde entsperrt." : "Account wurde gesperrt.");
    } catch (error) {
      setStatus(`Fehler: ${error.message}`);
    }
  }

  async function createManagedAccount(event) {
    event.preventDefault();

    if (!can(profile.role, "createUsers", ranks)) {
      setStatus("Du hast keine Berechtigung, Accounts anzulegen.");
      return;
    }

    if (newUser.role === "Administrator" && profile.role !== "Administrator") {
      setStatus("Nur Administratoren können Administrator-Accounts erstellen.");
      return;
    }

    setStatus("");

    const secondaryApp = initializeApp(firebaseConfig, `account-create-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newUser.email,
        newUser.password
      );

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

      setNewUser({
        email: "",
        password: "",
        displayName: "",
        role: ranks[0]?.name || "Anwärter"
      });
      setStatus("Account wurde erstellt.");
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

    if (!can(profile.role, "manageRanks", ranks)) {
      setStatus("Du hast keine Berechtigung, Ränge zu verwalten.");
      return;
    }

    const cleanName = rankName.trim();
    if (!cleanName) return;

    if (ranks.some(rank => rank.name.toLowerCase() === cleanName.toLowerCase())) {
      setStatus("Diesen Rang gibt es bereits.");
      return;
    }

    await saveRanks([...ranks, { name: cleanName, permissions: rankPermissions }]);
    setRankName("");
    setRankPermissions(["read"]);
    setStatus("Rang wurde erstellt.");
  }

  async function updateRankPermissions(rankName, permission, checked) {
    const nextRanks = ranks.map(rank => {
      if (rank.name !== rankName) return rank;
      const permissions = checked
        ? Array.from(new Set([...(rank.permissions || []), permission]))
        : (rank.permissions || []).filter(item => item !== permission);

      return { ...rank, permissions: permissions.length ? permissions : ["read"] };
    });

    await saveRanks(nextRanks);
    setStatus("Rangrechte wurden aktualisiert.");
  }

  async function deleteRank(rankName) {
    if (["Administrator"].includes(rankName)) {
      setStatus("Der Administrator-Rang kann nicht gelöscht werden.");
      return;
    }

    if (users.some(user => user.role === rankName)) {
      setStatus("Dieser Rang ist noch Benutzern zugewiesen und kann nicht gelöscht werden.");
      return;
    }

    await saveRanks(ranks.filter(rank => rank.name !== rankName));
    setStatus("Rang wurde gelöscht.");
  }

  const mayManageUsers = can(profile.role, "manageUsers", ranks);
  const mayCreateUsers = can(profile.role, "createUsers", ranks);
  const mayManageRanks = can(profile.role, "manageRanks", ranks);

  if (!mayManageUsers && !mayCreateUsers && !mayManageRanks) {
    return (
      <section className="placeholder">
        <h2>Administration</h2>
        <p>Du hast keine Berechtigung für diesen Bereich.</p>
      </section>
    );
  }

  return (
    <section className="admin-panel">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Administrator-Konsole</span>
          <h2>Benutzer, Logins & Ränge</h2>
          <p>Lege Accounts, Anzeigenamen und eigene Ranglisten fest.</p>
        </div>
        <div className="admin-count">{users.length} Nutzer</div>
      </div>

      {status && <div className="notice">{status}</div>}

      {mayCreateUsers && (
        <form className="admin-create" onSubmit={createManagedAccount}>
          <h3>Account anlegen</h3>
          <div className="grid-2">
            <input
              value={newUser.email}
              onChange={e => setNewUser(current => ({ ...current, email: e.target.value }))}
              placeholder="Login E-Mail"
              type="email"
              required
            />
            <input
              value={newUser.password}
              onChange={e => setNewUser(current => ({ ...current, password: e.target.value }))}
              placeholder="Startpasswort"
              type="password"
              minLength={6}
              required
            />
            <input
              value={newUser.displayName}
              onChange={e => setNewUser(current => ({ ...current, displayName: e.target.value }))}
              placeholder="Anzeigename, z.B. FIB-10 | Fox"
              required
            />
            <select
              value={newUser.role}
              onChange={e => setNewUser(current => ({ ...current, role: e.target.value }))}
            >
              {ranks
                .filter(rank => profile.role === "Administrator" || rank.name !== "Administrator")
                .map(rank => <option key={rank.name}>{rank.name}</option>)}
            </select>
          </div>
          <button>Account erstellen</button>
        </form>
      )}

      {mayManageUsers && (
        <div className="admin-table">
          <div className="admin-row admin-row-head">
            <span>Nutzer</span>
            <span>Name</span>
            <span>Rang</span>
            <span>Status</span>
            <span>Aktion</span>
          </div>

          {users.map(user => (
            <div className="admin-row admin-row-wide" key={user.id}>
              <div>
                <strong>{user.displayName || "Unbekannt"}</strong>
                <small>{user.email}</small>
              </div>

              <input
                defaultValue={user.displayName || ""}
                placeholder="z.B. FIB-10 | Fox"
                onBlur={e => updateDisplayName(user.id, e.target.value)}
              />

              <select
                value={user.role || "Anwärter"}
                onChange={e => updateRole(user.id, e.target.value)}
                disabled={user.uid === currentUser.uid}
              >
                {ranks
                  .filter(rank => profile.role === "Administrator" || rank.name !== "Administrator")
                  .map(rank => <option key={rank.name}>{rank.name}</option>)}
              </select>

              <span className={user.suspended ? "status-bad" : "status-good"}>
                {user.suspended ? "Gesperrt" : "Aktiv"}
              </span>

              <button
                className={user.suspended ? "ghost" : "danger"}
                onClick={() => toggleSuspended(user)}
                disabled={user.uid === currentUser.uid}
              >
                {user.suspended ? "Entsperren" : "Sperren"}
              </button>
            </div>
          ))}
        </div>
      )}

      {mayManageRanks && (
        <div className="rank-manager">
          <h3>Eigene Rangliste</h3>
          <form className="rank-create" onSubmit={addRank}>
            <input
              value={rankName}
              onChange={e => setRankName(e.target.value)}
              placeholder="Neuer Rang, z.B. Deputy Director"
            />
            <button>Rang hinzufügen</button>
          </form>

          <div className="rank-list">
            {ranks.map(rank => (
              <article key={rank.name} className="rank-card">
                <header>
                  <strong>{rank.name}</strong>
                  {rank.name !== "Administrator" && (
                    <button className="ghost" onClick={() => deleteRank(rank.name)}>Löschen</button>
                  )}
                </header>

                <div className="permission-grid">
                  {ALL_PERMISSIONS.map(permission => (
                    <label key={permission.id}>
                      <input
                        type="checkbox"
                        checked={(rank.permissions || []).includes(permission.id)}
                        disabled={rank.name === "Administrator"}
                        onChange={e => updateRankPermissions(rank.name, permission.id, e.target.checked)}
                      />
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
  const mayReadCases = can(profile.role, "read", ranks);
  const mayCreateCases = can(profile.role, "create", ranks);
  const mayViewAllCases = canSeeAllCases(profile.role);
  const [active, setActive] = useState("akten");
  const [cases, setCases] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      const loadedCases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCases(
        mayViewAllCases
          ? loadedCases
          : loadedCases.filter(caseFile => isOwnOrAssignedCase(caseFile, user))
      );
    });
  }, [mayViewAllCases, user]);

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

        {active === "akten" && mayReadCases && (
          <>
            <section className="stats">
              <div><strong>{stats.total}</strong><span>Gesamtakten</span></div>
              <div><strong>{stats.open}</strong><span>Aktiv</span></div>
              <div><strong>{stats.critical}</strong><span>Kritisch</span></div>
            </section>

            <section className="toolbar">
              <div className="search"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Akten durchsuchen..." /></div>
              <div className="access-chip">{mayViewAllCases ? "Vollzugriff" : "Eigene / zugewiesene Akten"}</div>
              {mayCreateCases && <button onClick={() => setShowForm(!showForm)}><Plus size={18} /> Neue Akte</button>}
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

        {active === "akten" && !mayReadCases && (
          <section className="placeholder">
            <h2>Kein Aktenzugriff</h2>
            <p>Dein Rang hat aktuell keine Leserechte für Akten.</p>
          </section>
        )}

        {active === "admin" && <AdminPanel currentUser={user} profile={profile} ranks={ranks} />}

        {active !== "akten" && active !== "admin" && (
          <section className="placeholder">
            <h2>{active}</h2>
            <p>Dieser Bereich ist vorbereitet. Die Daten sind bereits in den Aktenmodulen enthalten und können als eigene Ansicht ausgebaut werden.</p>
          </section>
        )}
      </main>

      <CaseDetails selected={selected} profile={profile} ranks={ranks} onClose={() => setSelectedId(null)} />
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
