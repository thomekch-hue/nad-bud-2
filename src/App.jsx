import React, { useState, useEffect } from "react";
import { 
  Building2, Handshake, BookOpen, Users, CheckSquare, 
  FileText, Wallet, ImageIcon, ShieldCheck, LogOut, Menu, X, Loader2 
} from "lucide-react";

// --- IMPORTY FIREBASE ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- KONFIGURACJA FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBD4OTs8oIApUkk8bUh6iIiOO_x4zQkVGo",
  authDomain: "nadzorbudowlany-2cc37.firebaseapp.com",
  projectId: "nadzorbudowlany-2cc37",
  storageBucket: "nadzorbudowlany-2cc37.firebasestorage.app",
  messagingSenderId: "775098190513",
  appId: "1:775098190513:web:886a7b1cbf0e9526af3090",
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn("Błąd inicjalizacji Firebase.", error);
}

const MODULES = [
  { id: "ofertowanie", label: "Ofertowanie", icon: Handshake, desc: "Wyceny, zapytania" },
  { id: "planowanie", label: "Planowanie", icon: Building2, desc: "Metryczka, mapy" },
  { id: "dokumentacja", label: "Dokumentacja", icon: BookOpen, desc: "Dziennik, usterki" },
  { id: "pracownicy", label: "Personel", icon: Users, desc: "Kontakty, czas pracy" },
  { id: "zadania", label: "Zadania (Plan)", icon: CheckSquare, desc: "Odprawy, kalendarz" },
  { id: "raportowanie", label: "Raportowanie", icon: FileText, desc: "Generowanie PDF" },
  { id: "rozliczanie", label: "Rozliczenia", icon: Wallet, desc: "Koszty, akceptacje" },
  { id: "zdjecia", label: "Galeria", icon: ImageIcon, desc: "Baza zdjęć budowy" },
  { id: "admin", label: "Administracja", icon: ShieldCheck, desc: "Zarządzanie systemem" },
];

export default function App() {
  // Stany logowania i użytkownika
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Stany interfejsu
  const [activeModule, setActiveModule] = useState("planowanie");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Nasłuchiwanie stanu logowania (czy ktoś jest zalogowany)
  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Funkcja logowania
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
    } catch (err) {
      setAuthError("Nieprawidłowy e-mail lub hasło.");
    }
  };

  // Funkcja wylogowania
  const handleLogout = () => {
    signOut(auth);
  };

  // Ekran ładowania (Sprawdzanie sesji)
  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B1121]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  // EKRAN LOGOWANIA (jeśli użytkownik nie jest zalogowany)
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B1121] p-4 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[2rem] shadow-2xl w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">ERP Budowa</h1>
            <p className="text-sm text-slate-400 mt-1">Zarządzanie Inwestycjami</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" 
              placeholder="Adres E-mail" 
              value={authEmail} 
              onChange={e => setAuthEmail(e.target.value)} 
              className="w-full bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 p-4 rounded-2xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all" 
              required
            />
            <input 
              type="password" 
              placeholder="Hasło" 
              value={authPassword} 
              onChange={e => setAuthPassword(e.target.value)} 
              className="w-full bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 p-4 rounded-2xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all" 
              required
            />
            {authError && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-xl font-medium text-center">
                {authError}
              </p>
            )}
            <button 
              type="submit" 
              className="w-full bg-white text-slate-900 font-black tracking-wide p-4 rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
            >
              Zaloguj się
            </button>
          </form>
        </div>
      </div>
    );
  }

  // GŁÓWNY LAYOUT (jeśli użytkownik jest zalogowany)
  return (
    <div className="flex h-screen bg-[#0B1121] font-sans overflow-hidden">
      {/* Panel Boczny (Sidebar) */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[280px] flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:flex-shrink-0 ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <div className="p-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20"><Building2 className="w-5 h-5" /></div>
            <div>
              <h1 className="text-white font-black tracking-tight text-lg">ERP BUDOWA</h1>
              <span className="text-[10px] uppercase font-bold text-slate-400">Workspace</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 mt-4 scrollbar-hide">
          {MODULES.map(mod => {
            const isActive = activeModule === mod.id;
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => { setActiveModule(mod.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 text-left group relative ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                {isActive && <div className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full top-1/2 -translate-y-1/2"></div>}
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'opacity-70 group-hover:opacity-100'}`} />
                <div>
                  <div className="text-sm font-bold tracking-wide">{mod.label}</div>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Profil zalogowanego użytkownika */}
        <div className="p-4">
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-white shadow-inner uppercase">
              {user.email[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{user.email}</div>
              <div className="text-[10px] text-blue-400 uppercase font-black tracking-wider truncate mt-0.5">Zalogowany</div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors" title="Wyloguj">
              <LogOut className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </aside>

      {/* Tło dla urządzeń mobilnych przy otwartym menu */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-[#0B1121]/80 z-30 lg:hidden backdrop-blur-sm animate-in fade-in" />}

      {/* Obszar Roboczy (Main Content) */}
      <main className="flex-1 flex flex-col h-screen min-w-0 bg-slate-50 lg:rounded-l-[2.5rem] lg:m-2 lg:ml-0 overflow-hidden shadow-2xl relative">
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              {MODULES.find(m => m.id === activeModule)?.label}
            </h2>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center flex flex-col items-center justify-center h-[60vh]">
             <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-6">
               {React.createElement(MODULES.find(m => m.id === activeModule)?.icon || Building2, { className: "w-10 h-10" })}
             </div>
             <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
               Moduł: {MODULES.find(m => m.id === activeModule)?.label}
             </h2>
             <p className="text-slate-500 max-w-md">Baza danych Firebase podpięta pomyślnie. Czekamy na kod tego modułu.</p>
          </div>
        </div>
      </main>
      
    </div>
  );
}
