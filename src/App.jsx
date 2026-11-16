import React, { useState, useEffect, useRef } from "react";
import {
  Menu, X, Building2, CalendarDays, BookOpen, Users, 
  CheckSquare, FileText, Wallet, ImageIcon, ShieldCheck, 
  Plus, Search, LogOut, Edit as EditIcon, Trash2, 
  MapPin, Phone, AlertTriangle, AlertCircle, CheckCircle2,
  Clock, ArrowRight, Download, Printer, Handshake, Paperclip, Wrench
} from "lucide-react";

import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signInWithCustomToken
} from "firebase/auth";
import {
  getFirestore, collection, doc, setDoc, onSnapshot, 
  addDoc, deleteDoc, updateDoc, getDocs
} from "firebase/firestore";

// =====================================================================
// KONFIGURACJA FIREBASE
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBD4OTs8oIApUkk8bUh6iIiOO_x4zQkVGo",
  authDomain: "nadzorbudowlany-2cc37.firebaseapp.com",
  projectId: "nadzorbudowlany-2cc37",
  storageBucket: "nadzorbudowlany-2cc37.firebasestorage.app",
  messagingSenderId: "775098190513",
  appId: "1:775098190513:web:886a7b1cbf0e9526af3090",
};

const appId = "erp_budowa_v2";

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn("Błąd inicjalizacji Firebase.", error);
}

// =====================================================================
// STRUKTURA MODUŁÓW (MENU)
// =====================================================================
const MODULES = [
  { id: "ofertowanie", label: "Ofertowanie", icon: Handshake, desc: "Wyceny, zapytania ofertowe" },
  { id: "planowanie", label: "Planowanie", icon: Building2, desc: "Metryczka, mapy, założenia" },
  { id: "dokumentacja", label: "Dokumentacja", icon: BookOpen, desc: "Dziennik, umowy, usterki" },
  { id: "pracownicy", label: "Personel", icon: Users, desc: "Lista kontaktów, czas pracy" },
  { id: "zadania", label: "Zadania (Harmonogram)", icon: CheckSquare, desc: "Odprawy, kalendarz, priorytety" },
  { id: "raportowanie", label: "Raportowanie", icon: FileText, desc: "Generowanie PDF, podsumowania" },
  { id: "rozliczanie", label: "Rozliczenia", icon: Wallet, desc: "Koszty, prośby o akceptację" },
  { id: "zdjecia", label: "Galeria", icon: ImageIcon, desc: "Baza zdjęć, eksport do raportów" },
  { id: "admin", label: "Panel Administratora", icon: ShieldCheck, desc: "Zarządzanie globalne, uprawnienia", adminOnly: true },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ role: "wykonawca", displayName: "", approved: false, permissions: {} });
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Stany logowania
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Stany nawigacji
  const [activeModule, setActiveModule] = useState("planowanie");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Dane globalne
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [usersList, setUsersList] = useState([]);
  
  // Dane projektowe
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [financialRequests, setFinancialRequests] = useState([]); // Nowość: Prośby o akceptację kosztów
  const [costs, setCosts] = useState([]);

  // Inicjalizacja autoryzacji
  useEffect(() => {
    if (!auth) { setIsAuthLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, "artifacts", appId, "users", currentUser.uid);
        onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            const isAdmin = currentUser.email.toLowerCase() === "thomekch@gmail.com";
            const initialData = {
              email: currentUser.email,
              role: isAdmin ? "administrator" : "wykonawca",
              approved: isAdmin,
              displayName: "",
              permissions: isAdmin ? MODULES.reduce((acc, m) => ({ ...acc, [m.id]: true }), {}) : { zadania: true, zdjecia: true }
            };
            setDoc(userDocRef, initialData);
            setUserData(initialData);
          }
        });
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Pobieranie danych
  useEffect(() => {
    if (!user || !db) return;
    const baseRef = (col) => collection(db, "artifacts", appId, col);

    const unsubProjects = onSnapshot(baseRef("projects"), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(data);
      if (data.length > 0 && !activeProjectId) setActiveProjectId(data[0].id);
    });

    const unsubTasks = onSnapshot(baseRef("tasks"), (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubLogs = onSnapshot(baseRef("logs"), (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRequests = onSnapshot(baseRef("financial_requests"), (s) => setFinancialRequests(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCosts = onSnapshot(baseRef("costs"), (s) => setCosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, "artifacts", appId, "users"), (s) => setUsersList(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubProjects(); unsubTasks(); unsubLogs(); unsubRequests(); unsubCosts(); unsubUsers(); };
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    try { await signInWithEmailAndPassword(auth, authEmail, authPassword); }
    catch (err) { setAuthError("Błąd logowania: " + err.message); }
  };

  const genericAdd = async (col, data) => {
    if (!activeProjectId) return;
    await addDoc(collection(db, "artifacts", appId, col), { projectId: activeProjectId, timestamp: Date.now(), author: user.email, ...data });
  };
  const genericUpdate = async (col, id, data) => await updateDoc(doc(db, "artifacts", appId, col, id), data);
  const genericDel = async (col, id) => await deleteDoc(doc(db, "artifacts", appId, col, id));

  const isAdministrator = userData.role === "administrator";
  const activeProject = projects.find(p => p.id === activeProjectId) || {};

  // --- EKRAN LOGOWANIA ---
  if (isAuthLoading) return <div className="flex h-screen items-center justify-center bg-slate-900"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>;
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 font-sans p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <div className="text-center mb-6">
            <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <h1 className="text-2xl font-black text-slate-800">ERP Budowa</h1>
            <p className="text-xs text-slate-500">Zarządzanie Inwestycjami</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="E-mail" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full border p-3 rounded-xl text-sm bg-slate-50" />
            <input type="password" placeholder="Hasło" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full border p-3 rounded-xl text-sm bg-slate-50" />
            {authError && <p className="text-xs text-red-500 font-bold">{authError}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold p-3 rounded-xl shadow-md hover:bg-blue-700">Zaloguj się</button>
          </form>
        </div>
      </div>
    );
  }

  // --- KOMPONENTY MODUŁÓW ---

  // MODUŁ 5: ZADANIA (Z PEŁNĄ EDYCJĄ I PRIORYTETAMI)
  const TasksModule = () => {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [assignee, setAssignee] = useState("");
    const [priority, setPriority] = useState("Normalny");
    
    // Edycja
    const [editingTask, setEditingTask] = useState(null);

    const projTasks = tasks.filter(t => t.projectId === activeProjectId).sort((a,b) => new Date(a.date) - new Date(b.date));

    const getPriorityColor = (pri) => {
      switch(pri) {
        case "Krytyczny": return "bg-red-100 text-red-700 border-red-300";
        case "Pilny": return "bg-amber-100 text-amber-700 border-amber-300";
        case "Niski": return "bg-slate-100 text-slate-600 border-slate-300";
        default: return "bg-blue-50 text-blue-700 border-blue-200";
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600" /> Utwórz nowe zadanie / polecenie
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <input type="text" placeholder="Tytuł zadania..." value={title} onChange={e => setTitle(e.target.value)} className="border rounded-xl p-2.5 text-sm bg-slate-50" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded-xl p-2.5 text-sm bg-slate-50" />
            <select value={assignee} onChange={e => setAssignee(e.target.value)} className="border rounded-xl p-2.5 text-sm bg-slate-50">
              <option value="">Przypisz do...</option>
              {usersList.map(u => <option key={u.id} value={u.email}>{u.displayName || u.email}</option>)}
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="border rounded-xl p-2.5 text-sm font-bold bg-slate-50">
              <option value="Niski">Priorytet: Niski</option>
              <option value="Normalny">Priorytet: Normalny</option>
              <option value="Pilny">Priorytet: Pilny</option>
              <option value="Krytyczny">Priorytet: KRYTYCZNY</option>
            </select>
          </div>
          <button 
            onClick={() => {
              if(!title || !date) return;
              genericAdd("tasks", { title, date, assignee, priority, status: "Oczekuje" });
              setTitle(""); setDate(""); setAssignee(""); setPriority("Normalny");
            }}
            className="w-full lg:w-auto bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm"
          >
            Dodaj do harmonogramu
          </button>
        </div>

        <div className="space-y-3">
          {projTasks.map(t => {
            const isEditing = editingTask?.id === t.id;
            return (
              <div key={t.id} className={`bg-white rounded-2xl shadow-sm border p-4 flex flex-col md:flex-row gap-4 justify-between border-l-4 ${t.status === 'Zakończone' ? 'border-l-emerald-500 opacity-70' : 'border-l-slate-800'}`}>
                {isEditing ? (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                    <input type="text" value={editingTask.title} onChange={e=>setEditingTask({...editingTask, title: e.target.value})} className="border p-2 rounded-lg text-sm col-span-2" />
                    <input type="date" value={editingTask.date} onChange={e=>setEditingTask({...editingTask, date: e.target.value})} className="border p-2 rounded-lg text-sm" />
                    <select value={editingTask.status} onChange={e=>setEditingTask({...editingTask, status: e.target.value})} className="border p-2 rounded-lg text-sm font-bold">
                      <option value="Oczekuje">Oczekuje</option>
                      <option value="W trakcie">W trakcie</option>
                      <option value="Opóźnione">Opóźnione</option>
                      <option value="Zakończone">Zakończone</option>
                    </select>
                    <select value={editingTask.priority} onChange={e=>setEditingTask({...editingTask, priority: e.target.value})} className="border p-2 rounded-lg text-sm font-bold">
                      <option value="Niski">Niski</option>
                      <option value="Normalny">Normalny</option>
                      <option value="Pilny">Pilny</option>
                      <option value="Krytyczny">Krytyczny</option>
                    </select>
                    <div className="col-span-full flex gap-2 mt-2">
                      <button onClick={() => { genericUpdate("tasks", t.id, editingTask); setEditingTask(null); }} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold">Zapisz</button>
                      <button onClick={() => setEditingTask(null)} className="bg-slate-200 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold">Anuluj</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityColor(t.priority)} uppercase`}>{t.priority}</span>
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{t.date}</span>
                      </div>
                      <h4 className="font-bold text-slate-900">{t.title}</h4>
                      {t.assignee && <p className="text-xs text-slate-500 mt-1">Wykonawca: <span className="font-bold text-slate-700">{t.assignee}</span></p>}
                    </div>
                    <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-3 border-t md:border-t-0 pt-3 md:pt-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${t.status === 'Zakończone' ? 'bg-emerald-100 text-emerald-800' : t.status === 'Opóźnione' ? 'bg-red-100 text-red-700' : t.status === 'W trakcie' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                        {t.status}
                      </span>
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditingTask(t)} className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 rounded-lg transition"><EditIcon className="w-4 h-4"/></button>
                        <button onClick={() => genericDel("tasks", t.id)} className="p-2 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-lg transition"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // MODUŁ 7: ROZLICZANIA (Z PROŚBAMI O AKCEPTACJĘ OD PODWYKONAWCÓW)
  const FinancialsModule = () => {
    const [reqTitle, setReqTitle] = useState("");
    const [reqAmount, setReqAmount] = useState("");
    const projRequests = financialRequests.filter(r => r.projectId === activeProjectId);

    return (
      <div className="space-y-6">
        {/* Panel dla podwykonawcy - Zgłoszenie */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-amber-500">
          <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Handshake className="w-5 h-5 text-amber-500" /> Zgłoś etap robót do akceptacji inwestorskiej
          </h3>
          <p className="text-xs text-slate-500 mb-4">Wyślij prośbę do kierownika/inwestora o akceptację kosztów za wykonany zakres.</p>
          <div className="flex flex-col md:flex-row gap-3">
            <input type="text" placeholder="Za co? (np. Stan zero - robocizna)" value={reqTitle} onChange={e=>setReqTitle(e.target.value)} className="flex-1 border rounded-xl p-2.5 text-sm bg-slate-50" />
            <input type="number" placeholder="Kwota netto PLN" value={reqAmount} onChange={e=>setReqAmount(e.target.value)} className="w-full md:w-48 border rounded-xl p-2.5 text-sm bg-slate-50" />
            <button 
              onClick={() => {
                if(!reqTitle || !reqAmount) return;
                genericAdd("financial_requests", { title: reqTitle, amount: parseFloat(reqAmount), status: "Oczekuje" });
                setReqTitle(""); setReqAmount("");
              }}
              className="bg-amber-500 text-slate-900 font-bold px-6 py-2.5 rounded-xl text-sm"
            >
              Wyślij do akceptacji
            </button>
          </div>
        </div>

        {/* Lista próśb i decyzje administracyjne */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase text-slate-500 ml-1">Rejestr wniosków finansowych</h3>
          {projRequests.map(req => (
            <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h4 className="font-bold text-slate-900">{req.title}</h4>
                <p className="text-xs text-slate-500 mt-1">Zgłaszający: {req.author} | Data: {new Date(req.timestamp).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-black text-slate-800">{req.amount.toLocaleString()} PLN</span>
                
                {req.status === "Oczekuje" && isAdministrator ? (
                  <div className="flex gap-2">
                    <button onClick={() => genericUpdate("financial_requests", req.id, { status: "Zatwierdzone" })} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition">Akceptuj</button>
                    <button onClick={() => genericUpdate("financial_requests", req.id, { status: "Częściowo" })} className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold transition">Akc. Częściowo</button>
                    <button onClick={() => genericUpdate("financial_requests", req.id, { status: "Odrzucone" })} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition">Odrzuć</button>
                  </div>
                ) : (
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${req.status === 'Zatwierdzone' ? 'bg-emerald-100 text-emerald-700' : req.status === 'Odrzucone' ? 'bg-red-100 text-red-700' : req.status === 'Częściowo' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {req.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // SZKIELET POZOSTAŁYCH MODUŁÓW (Jako Placeholdery UI)
  const PlaceholderModule = ({ title, description, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center h-96 bg-white rounded-3xl border border-dashed border-slate-300 text-center p-8">
      <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl mb-4"><Icon className="w-10 h-10" /></div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Moduł: {title}</h2>
      <p className="text-slate-500 max-w-md">{description}</p>
      <span className="mt-6 bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase">Szkielet przygotowany do integracji bazy danych</span>
    </div>
  );

  const renderActiveModule = () => {
    switch(activeModule) {
      case "zadania": return <TasksModule />;
      case "rozliczanie": return <FinancialsModule />;
      case "planowanie": 
        return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-black text-slate-900 mb-2">{activeProject.name || "Brak wybranej budowy"}</h2>
            <p className="text-slate-600 mb-4">Tutaj znajduje się metryczka budowy, mapa, pinezka, opis zamierzenia inwestycyjnego. W pełni edytowalne z poziomu panelu administracyjnego.</p>
            <div className="bg-slate-100 h-64 rounded-xl flex items-center justify-center text-slate-400 font-bold uppercase border border-slate-200">Miejsce na iframe Google Maps</div>
          </div>
        );
      case "ofertowanie": return <PlaceholderModule title="Ofertowanie i Kosztorysy" description="Tu znajdzie się kreator zapytań ofertowych do podwykonawców (RFQ), porównywarka ofert oraz przygotowanie wyceny dla inwestora." icon={Handshake} />;
      case "dokumentacja": return <PlaceholderModule title="Dokumentacja Budowy" description="Rozszerzony Dziennik Budowy, wgrane pliki PDF (Projekty), umowy z Inwestorem oraz zgłoszenia usterek." icon={BookOpen} />;
      case "pracownicy": return <PlaceholderModule title="Baza Personelu i Podwykonawców" description="Zarządzanie listą kontaktów (Inwestor, Inspektor, Firmy) oraz elektroniczna ewidencja czasu pracy dla robotników." icon={Users} />;
      case "raportowanie": return <PlaceholderModule title="Kreator Raportów (PDF)" description="Generowanie oficjalnych raportów miesięcznych/kwartalnych z możliwością wyboru sekcji (zdjęcia, koszty, usterki) do wydruku w A4." icon={FileText} />;
      case "zdjecia": return <PlaceholderModule title="Galeria Dokumentacji" description="Globalna galeria zdjęć z placu budowy. Wybieranie zdjęć (checkboxy) do eksportu do Raportu." icon={ImageIcon} />;
      case "admin": return <PlaceholderModule title="Globalny Panel Administratora" description="Zarządzanie modułami dla użytkowników. Przypisywanie uprawnień, przegląd wszystkich budów naraz." icon={ShieldCheck} />;
      default: return null;
    }
  };


  // =====================================================================
  // GŁÓWNY LAYOUT (SIDEBAR + CONTENT)
  // =====================================================================
  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* SIDEBAR (Desktop) / DRAWER (Mobile) */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex-shrink-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg"><Building2 className="w-6 h-6" /></div>
            <div>
              <h1 className="text-white font-black tracking-tight leading-tight">ERP BUDOWA</h1>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">System Zarządzania</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 bg-slate-800 rounded text-white"><X className="w-5 h-5"/></button>
        </div>

        {/* Selektor Projektu */}
        <div className="p-4 border-b border-slate-800">
          <label className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 block">Aktywna Inwestycja:</label>
          <select 
            value={activeProjectId || ""} 
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="w-full bg-slate-800 border-none text-white text-sm font-bold rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
          {MODULES.map(mod => {
            if (mod.adminOnly && !isAdministrator) return null;
            // Tutaj normalnie sprawdzalibyśmy uprawnienia per moduł z userData.permissions
            const isActive = activeModule === mod.id;
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => { setActiveModule(mod.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition text-left group ${isActive ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
                <div>
                  <div className="text-sm font-bold">{mod.label}</div>
                  <div className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>{mod.desc}</div>
                </div>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 uppercase">
              {userData.displayName ? userData.displayName[0] : user.email[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{userData.displayName || user.email}</div>
              <div className="text-[10px] text-amber-400 uppercase font-black truncate">{userData.role}</div>
            </div>
            <button onClick={() => auth.signOut()} className="text-slate-400 hover:text-red-400 p-1" title="Wyloguj"><LogOut className="w-4 h-4"/></button>
          </div>
        </div>
      </aside>

      {/* OVERLAY DLA MOBILE */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden backdrop-blur-sm animate-in fade-in" />}

      {/* GŁÓWNA TREŚĆ MODUŁÓW */}
      <main className="flex-1 flex flex-col h-screen min-w-0 bg-slate-100">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black text-slate-800 tracking-tight hidden sm:block">
              {MODULES.find(m => m.id === activeModule)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition shadow-sm hidden sm:block">
              + Szybka Akcja
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {renderActiveModule()}
          </div>
        </div>
      </main>
      
    </div>
  );
}
