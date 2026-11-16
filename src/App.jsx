import React, { useState, useEffect } from "react";
import {
  Menu, X, Building2, CalendarDays, BookOpen, Users, 
  CheckSquare, FileText, Wallet, ImageIcon, ShieldCheck, 
  Plus, Search, LogOut, Edit3, Trash2, 
  MapPin, Phone, AlertTriangle, Check, CheckCircle2,
  Clock, ArrowRight, Download, Printer, Handshake, ChevronDown
} from "lucide-react";

import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signInWithCustomToken
} from "firebase/auth";
import {
  getFirestore, collection, doc, setDoc, onSnapshot, 
  addDoc, deleteDoc, updateDoc
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

const appId = "erp_budowa_v3_modern";

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn("Błąd inicjalizacji Firebase.", error);
}

// =====================================================================
// STRUKTURA MODUŁÓW
// =====================================================================
const MODULES = [
  { id: "ofertowanie", label: "Ofertowanie", icon: Handshake, desc: "Wyceny, zapytania ofertowe", color: "from-purple-500 to-indigo-500", bg: "bg-purple-50 text-purple-600" },
  { id: "planowanie", label: "Planowanie", icon: Building2, desc: "Metryczka, mapy, założenia", color: "from-blue-500 to-cyan-500", bg: "bg-blue-50 text-blue-600" },
  { id: "dokumentacja", label: "Dokumentacja", icon: BookOpen, desc: "Dziennik, umowy, usterki", color: "from-emerald-500 to-teal-500", bg: "bg-emerald-50 text-emerald-600" },
  { id: "pracownicy", label: "Personel", icon: Users, desc: "Lista kontaktów, czas pracy", color: "from-orange-500 to-amber-500", bg: "bg-orange-50 text-orange-600" },
  { id: "zadania", label: "Zadania (Plan)", icon: CheckSquare, desc: "Odprawy, kalendarz, priorytety", color: "from-rose-500 to-pink-500", bg: "bg-rose-50 text-rose-600" },
  { id: "raportowanie", label: "Raportowanie", icon: FileText, desc: "Generowanie PDF, podsumowania", color: "from-slate-600 to-slate-800", bg: "bg-slate-100 text-slate-700" },
  { id: "rozliczanie", label: "Rozliczenia", icon: Wallet, desc: "Koszty, prośby o akceptację", color: "from-green-500 to-emerald-600", bg: "bg-green-50 text-green-600" },
  { id: "zdjecia", label: "Galeria", icon: ImageIcon, desc: "Baza zdjęć, eksport do raportów", color: "from-sky-500 to-blue-500", bg: "bg-sky-50 text-sky-600" },
  { id: "admin", label: "Administracja", icon: ShieldCheck, desc: "Zarządzanie uprawnieniami", color: "from-red-500 to-rose-600", bg: "bg-red-50 text-red-600", adminOnly: true },
];

// --- NOWOCZESNY KOMPONENT CUSTOM SELECT ---
// Usuwa wygląd "Win95" ze standardowych list rozwijanych
const ModernSelect = ({ value, onChange, options, placeholder, className = "" }) => (
  <div className={`relative ${className}`}>
    <select 
      value={value} 
      onChange={onChange}
      className="w-full appearance-none bg-slate-50/50 border border-slate-200 text-slate-700 font-medium text-sm rounded-2xl px-4 py-3.5 pr-10 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
  </div>
);

// --- NOWOCZESNY KOMPONENT CHECKBOX ---
const ModernCheckbox = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer group">
    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 ${checked ? 'bg-blue-600 shadow-md shadow-blue-500/30 border-none' : 'bg-slate-100 border border-slate-300 group-hover:border-blue-400'}`}>
      <Check className={`w-3.5 h-3.5 text-white transition-transform duration-300 ${checked ? 'scale-100' : 'scale-0'}`} strokeWidth={3} />
    </div>
    {label && <span className={`text-sm font-medium transition-colors ${checked ? 'text-slate-400 line-through' : 'text-slate-700 group-hover:text-slate-900'}`}>{label}</span>}
  </label>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ role: "wykonawca", displayName: "", approved: false, permissions: {} });
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeModule, setActiveModule] = useState("planowanie");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [tasks, setTasks] = useState([]);

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

  useEffect(() => {
    if (!user || !db) return;
    const baseRef = (col) => collection(db, "artifacts", appId, col);

    const unsubProjects = onSnapshot(baseRef("projects"), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(data);
      if (data.length > 0 && !activeProjectId) setActiveProjectId(data[0].id);
    });

    const unsubTasks = onSnapshot(baseRef("tasks"), (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, "artifacts", appId, "users"), (s) => setUsersList(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubProjects(); unsubTasks(); unsubUsers(); };
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
  if (isAuthLoading) return <div className="flex h-screen items-center justify-center bg-[#0B1121]"><div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>;
  
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B1121] font-sans p-4 relative overflow-hidden">
        {/* Dekoracyjne tła - Nowoczesny sznyt */}
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[2rem] shadow-2xl w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">ERP Budowa</h1>
            <p className="text-sm text-slate-400 mt-1">Nowoczesne Zarządzanie Inwestycjami</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Adres E-mail" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 p-4 rounded-2xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all" />
            <input type="password" placeholder="Hasło" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 p-4 rounded-2xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all" />
            {authError && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-xl font-medium">{authError}</p>}
            <button type="submit" className="w-full bg-white text-slate-900 font-black tracking-wide p-4 rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95 transition-all">
              Rozpocznij Pracę
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- MODUŁ 5: ZADANIA (ZMODERNIZOWANY UI) ---
  const TasksModule = () => {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [assignee, setAssignee] = useState("");
    const [priority, setPriority] = useState("Normalny");
    const [editingTask, setEditingTask] = useState(null);

    const projTasks = tasks.filter(t => t.projectId === activeProjectId).sort((a,b) => new Date(a.date) - new Date(b.date));

    const getPriorityBadge = (pri) => {
      switch(pri) {
        case "Krytyczny": return "bg-red-50 text-red-600 border-red-200";
        case "Pilny": return "bg-amber-50 text-amber-600 border-amber-200";
        case "Niski": return "bg-slate-50 text-slate-500 border-slate-200";
        default: return "bg-blue-50 text-blue-600 border-blue-200";
      }
    };

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Karta dodawania zadania - Neumorphism / Glassmorphism */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center border border-blue-100">
              <CheckSquare className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg tracking-tight">Nowe zadanie do wykonania</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <input type="text" placeholder="Treść polecenia..." value={title} onChange={e => setTitle(e.target.value)} className="col-span-1 md:col-span-2 lg:col-span-1 bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-50/50 border border-slate-200 rounded-2xl p-3.5 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-600" />
            
            <ModernSelect 
              value={assignee} 
              onChange={e => setAssignee(e.target.value)} 
              placeholder="Wybierz wykonawcę"
              options={usersList.map(u => ({ value: u.email, label: u.displayName || u.email }))} 
            />
            
            <ModernSelect 
              value={priority} 
              onChange={e => setPriority(e.target.value)} 
              options={[
                {value: "Niski", label: "Priorytet: Niski"},
                {value: "Normalny", label: "Priorytet: Normalny"},
                {value: "Pilny", label: "Priorytet: Pilny"},
                {value: "Krytyczny", label: "Priorytet: KRYTYCZNY"}
              ]} 
            />
          </div>
          <button 
            onClick={() => {
              if(!title || !date) return;
              genericAdd("tasks", { title, date, assignee, priority, status: "Oczekuje" });
              setTitle(""); setDate(""); setAssignee(""); setPriority("Normalny");
            }}
            className="w-full lg:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-slate-900/20 transition-all active:scale-95"
          >
            Zapisz w harmonogramie
          </button>
        </div>

        {/* Lista Zadań - Nowoczesne Karty */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projTasks.map(t => {
            const isEditing = editingTask?.id === t.id;
            const isDone = t.status === 'Zakończone';

            return (
              <div key={t.id} className={`bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-5 transition-all duration-300 ${isDone ? 'opacity-60 grayscale-[30%]' : 'hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]'}`}>
                {isEditing ? (
                  <div className="space-y-4">
                    <input type="text" value={editingTask.title} onChange={e=>setEditingTask({...editingTask, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500" />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="date" value={editingTask.date} onChange={e=>setEditingTask({...editingTask, date: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none" />
                      <ModernSelect 
                        value={editingTask.status} 
                        onChange={e=>setEditingTask({...editingTask, status: e.target.value})} 
                        options={[ {value: "Oczekuje", label:"Oczekuje"}, {value: "W trakcie", label:"W trakcie"}, {value: "Opóźnione", label:"Opóźnione"}, {value: "Zakończone", label:"Zakończone"} ]}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => { genericUpdate("tasks", t.id, editingTask); setEditingTask(null); }} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20">Zapisz</button>
                      <button onClick={() => setEditingTask(null)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl text-sm font-bold">Anuluj</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-4">
                      <ModernCheckbox 
                        checked={isDone} 
                        onChange={() => genericUpdate("tasks", t.id, { status: isDone ? "Oczekuje" : "Zakończone" })} 
                      />
                      <div className="flex gap-1">
                        <button onClick={() => setEditingTask(t)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit3 className="w-3.5 h-3.5"/></button>
                        <button onClick={() => genericDel("tasks", t.id)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </div>
                    
                    <h4 className={`font-bold text-lg mb-2 leading-tight ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</h4>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider ${getPriorityBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                        <CalendarDays className="w-3.5 h-3.5 opacity-70" /> {t.date}
                      </span>
                      {t.assignee && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 ml-auto">
                          <div className="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center text-[8px] font-black">{t.assignee[0].toUpperCase()}</div>
                          {t.assignee.split('@')[0]}
                        </span>
                      )}
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

  const renderActiveModule = () => {
    switch(activeModule) {
      case "zadania": return <TasksModule />;
      case "planowanie": 
        return (
          <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center flex flex-col items-center justify-center h-[60vh]">
             <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-6">
                <Building2 className="w-10 h-10" />
             </div>
             <h2 className="text-3xl font-black text-slate-800 tracking-tight">{activeProject.name || "Brak budowy"}</h2>
             <p className="text-slate-500 mt-2 max-w-md">Miejsce na metryczkę i zaawansowaną mapę geodezyjną w zmodernizowanym interfejsie.</p>
          </div>
        );
      default: 
        return (
          <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center flex flex-col items-center justify-center h-[60vh]">
             <h2 className="text-xl font-bold text-slate-800">Moduł w budowie</h2>
             <p className="text-slate-500 mt-2">Szkielet dla modułu: {activeModule}</p>
          </div>
        );
    }
  };

  // =====================================================================
  // GŁÓWNY LAYOUT (GŁĘBOKI SIDEBAR + ZAOKRĄGLONY CONTENT)
  // =====================================================================
  return (
    <div className="flex h-screen bg-[#0B1121] font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* SIDEBAR - Ciemny, elegancki motyw */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[280px] flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:flex-shrink-0 ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <div className="p-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20"><Building2 className="w-5 h-5" /></div>
            <div>
              <h1 className="text-white font-black tracking-tight text-lg">ERP BUDOWA</h1>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block -mt-0.5">Workspace</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        <div className="px-6 pb-6">
          <ModernSelect 
            value={activeProjectId || ""} 
            onChange={(e) => setActiveProjectId(e.target.value)}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            className="!bg-white/5 !border-white/10 !text-white"
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 scrollbar-hide pb-6">
          {MODULES.map(mod => {
            if (mod.adminOnly && !isAdministrator) return null;
            const isActive = activeModule === mod.id;
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => { setActiveModule(mod.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 text-left group relative overflow-hidden ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                {isActive && <div className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full top-1/2 -translate-y-1/2"></div>}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isActive ? mod.bg : 'bg-transparent group-hover:bg-white/10'}`}>
                  <Icon className={`w-4 h-4 ${isActive ? '' : 'opacity-70 group-hover:opacity-100'}`} />
                </div>
                <div>
                  <div className="text-sm font-bold tracking-wide">{mod.label}</div>
                </div>
              </button>
            )
          })}
        </nav>

        <div className="p-4">
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-white shadow-inner">
              {userData.displayName ? userData.displayName[0] : user.email[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{userData.displayName || user.email}</div>
              <div className="text-[10px] text-blue-400 uppercase font-black tracking-wider truncate mt-0.5">{userData.role}</div>
            </div>
            <button onClick={() => auth.signOut()} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors" title="Wyloguj"><LogOut className="w-4 h-4"/></button>
          </div>
        </div>
      </aside>

      {/* OVERLAY DLA MOBILE */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-[#0B1121]/80 z-30 lg:hidden backdrop-blur-sm animate-in fade-in" />}

      {/* GŁÓWNA TREŚĆ MODUŁÓW (Wewnętrzny kontener jak w macOS/iPadOS) */}
      <main className="flex-1 flex flex-col h-screen min-w-0 bg-slate-50 lg:rounded-l-[2.5rem] lg:m-2 lg:ml-0 overflow-hidden shadow-2xl relative">
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight hidden sm:flex items-center gap-2">
              {MODULES.find(m => m.id === activeModule)?.label}
            </h2>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-5xl mx-auto">
            {renderActiveModule()}
          </div>
        </div>
      </main>
      
    </div>
  );
}
