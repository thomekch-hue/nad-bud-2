import React, { useState, useEffect, useRef } from "react";
import {
  ClipboardCheck,
  BookOpen,
  Camera,
  Plus,
  Building2,
  CalendarDays,
  Circle,
  Image as ImageIcon,
  Loader2,
  Handshake,
  Wallet,
  HardHat,
  Gavel,
  Trash2,
  X,
  Users,
  Info,
  ArrowLeft,
  ArrowRight,
  Phone,
  MapPin,
  Edit as EditIcon,
  FileText,
  Printer,
  Settings as SettingsIco,
  CheckSquare,
  ShieldCheck,
  LogOut,
  UserPlus,
  FolderPlus,
  Lock,
  Unlock,
  Sun,
  FileSpreadsheet,
  CheckCircle,
  FolderOpen,
  AlertOctagon,
  Download,
  CloudSun,
  AlertCircle,
  FileUp,
  Clock,
  Menu,
} from "lucide-react";

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  getDocs,
} from "firebase/firestore";

// =====================================================================
// INICJALIZACJA FIREBASE - TUTAJ WKLEJ SWOJE KLUCZE
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBsaheHHTW18DiT9Z4fys_SNuvBqq8Tmxc",
  authDomain: "nadzor-v2.firebaseapp.com",
  projectId: "nadzor-v2",
  storageBucket: "nadzor-v2.firebasestorage.app",
  messagingSenderId: "305749068225",
  appId: "1:305749068225:web:f92a680daa8e68159ac740",
};

const appId = "nadzor_v2_baza";

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn("Brak kluczy Firebase lub błąd inicjalizacji.", error);
}

// =====================================================================
// KONFIGURACJE I FUNKCJE POMOCNICZE
// =====================================================================
const compressImage = (file, callback) => {
  try {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width,
          height = img.height;
        const MAX = 1000;
        if (width > height && width > MAX) {
          height *= MAX / width;
          width = MAX;
        } else if (height > MAX) {
          width *= MAX / height;
          height = MAX;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = () => callback(null);
      img.src = event.target.result;
    };
    reader.onerror = () => callback(null);
    reader.readAsDataURL(file);
  } catch (err) {
    callback(null);
  }
};

const readDocumentBase64 = (file, callback) => {
  if (file.size > 800000) {
    alert("Ten plik jest za duży. Wgraj plik poniżej 800KB.");
    callback(null);
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => callback(event.target.result);
  reader.readAsDataURL(file);
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
    amount || 0
  );
const formatDateStr = (d) => d.toISOString().split("T")[0];

// =====================================================================
// GŁÓWNA APLIKACJA
// =====================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({
    role: "wykonawca",
    displayName: "",
    assignedProjects: [],
    permissions: {},
    editPermissions: {},
    approved: false,
  });

  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Stany autoryzacji (Email + Hasło)
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Stany Główne
  const [currentScreen, setCurrentScreen] = useState("home");
  const [activeTab, setActiveTab] = useState("info");
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Dane z Firebase
  const [logs, setLogs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [issues, setIssues] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Stany formularzy
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm, setProjectForm] = useState({
    name: "",
    investor: "",
    location: "",
    mapUrl: "",
    phone: "",
    description: "",
  });
  const [issueForm, setIssueForm] = useState({
    title: "",
    description: "",
    assignee: "",
    photo: null,
  });
  const issuePhotoRef = useRef(null);
  const [docForm, setDocForm] = useState({ name: "" });
  const docInputRef = useRef(null);

  const [editingIssueId, setEditingIssueId] = useState(null);
  const [editIssueStatus, setEditIssueStatus] = useState("");

  // =====================================================================
  // EFEKTY POBIERANIA DANYCH I AUTORYZACJA
  // =====================================================================
  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }

    const initAuth = async () => {
      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (err) {
          console.log(err);
        }
      }
      setIsAuthLoading(false);
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        const userDocRef = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "users_roles",
          currentUser.uid
        );
        const userSnap = await getDoc(userDocRef);
        const isAdminEmail =
          currentUser.email.toLowerCase() === "thomekch@gmail.com";

        const FULL_PERMS = {
          info: true,
          dziennik: true,
          dokumenty: true,
          usterki: true,
          zdjecia: true,
        };

        if (userSnap.exists()) {
          const data = userSnap.data();
          if (isAdminEmail) {
            await setDoc(
              userDocRef,
              {
                role: "administrator",
                permissions: FULL_PERMS,
                editPermissions: FULL_PERMS,
                approved: true,
              },
              { merge: true }
            );
          }
          setUserData({
            role: isAdminEmail ? "administrator" : data.role,
            displayName: data.displayName || "",
            permissions: isAdminEmail ? FULL_PERMS : data.permissions || {},
            editPermissions: isAdminEmail
              ? FULL_PERMS
              : data.editPermissions || {},
            assignedProjects: data.assignedProjects || [],
            approved: isAdminEmail ? true : data.approved ?? false,
          });
        } else {
          const defaultData = {
            email: currentUser.email,
            displayName: "",
            role: isAdminEmail ? "administrator" : "wykonawca",
            permissions: isAdminEmail ? FULL_PERMS : FULL_PERMS,
            editPermissions: isAdminEmail ? FULL_PERMS : FULL_PERMS,
            assignedProjects: [],
            approved: isAdminEmail,
          };
          await setDoc(userDocRef, defaultData);
          setUserData(defaultData);
        }
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const baseRef = (col) =>
      collection(db, "artifacts", appId, "public", "data", col);

    const unsubProjects = onSnapshot(baseRef("ins_projects"), (s) =>
      setProjects(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.createdAt - a.createdAt)
      )
    );
    const unsubLogs = onSnapshot(baseRef("ins_logs"), (s) =>
      setLogs(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.timestamp - a.timestamp)
      )
    );
    const unsubPhotos = onSnapshot(baseRef("ins_photos"), (s) =>
      setPhotos(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.timestamp - a.timestamp)
      )
    );
    const unsubIssues = onSnapshot(baseRef("ins_issues"), (s) =>
      setIssues(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.timestamp - a.timestamp)
      )
    );
    const unsubDocuments = onSnapshot(baseRef("ins_documents"), (s) =>
      setDocuments(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.timestamp - a.timestamp)
      )
    );
    const unsubUsers = onSnapshot(baseRef("users_roles"), (s) =>
      setUsersList(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubProjects();
      unsubLogs();
      unsubPhotos();
      unsubIssues();
      unsubDocuments();
      unsubUsers();
    };
  }, [user]);

  // =====================================================================
  // AKCJE AUTORYZACYJNE (E-mail i Hasło)
  // =====================================================================
  const handleLoginRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err) {
      setAuthError(
        isRegistering
          ? "Błąd rejestracji. Hasło musi mieć min. 6 znaków."
          : "Błąd logowania. Nieprawidłowy email lub hasło."
      );
    }
  };

  const genericAdd = async (col, data, cb) => {
    if (!user || !activeProjectId) return;
    try {
      await addDoc(collection(db, "artifacts", appId, "public", "data", col), {
        projectId: activeProjectId,
        timestamp: Date.now(),
        ...data,
      });
      if (cb) cb();
    } catch (e) {
      console.error(e);
    }
  };
  const genericDel = async (col, id) => {
    try {
      await deleteDoc(doc(db, "artifacts", appId, "public", "data", col, id));
    } catch (e) {
      console.error(e);
    }
  };
  const genericUpdate = async (col, id, data) => {
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", col, id),
        data
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveProject = async () => {
    if (!projectForm.name.trim() || !user) return;
    try {
      if (editingProject) {
        await updateDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "ins_projects",
            editingProject
          ),
          {
            name: projectForm.name,
            investor: projectForm.investor,
            location: projectForm.location,
            phone: projectForm.phone,
            mapUrl: projectForm.mapUrl,
          }
        );
      } else {
        await addDoc(
          collection(db, "artifacts", appId, "public", "data", "ins_projects"),
          {
            name: projectForm.name,
            investor: projectForm.investor,
            location: projectForm.location,
            phone: projectForm.phone,
            mapUrl: projectForm.mapUrl,
            createdAt: Date.now(),
          }
        );
      }
      setIsProjectModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // =====================================================================
  // RENDEROWANIE: LOGOWANIE
  // =====================================================================
  if (isAuthLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 font-sans text-slate-800">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 transform rotate-3">
              <HardHat className="w-10 h-10 text-blue-600 transform -rotate-3" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              System Nadzoru
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Dostęp dla pracowników i klientów
            </p>
          </div>

          <form onSubmit={handleLoginRegister} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Adres E-mail
              </label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl p-3 text-sm focus:border-blue-500 focus:bg-white transition-all outline-none"
                placeholder="jan.kowalski@budowa.pl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Hasło
              </label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl p-3 text-sm focus:border-blue-500 focus:bg-white transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
            {authError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-sm font-bold shadow-[0_4px_14px_0_rgb(37,99,235,0.39)] transition-transform active:scale-[0.98]"
            >
              {isRegistering ? "Zarejestruj się" : "Zaloguj się"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold transition"
            >
              {isRegistering
                ? "Masz już konto? Zaloguj się"
                : "Nie masz konta? Zarejestruj się"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // WERYFIKACJA KONTA PRZEZ ADMINA
  if (!userData.approved && userData.role !== "administrator") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 p-4 font-sans text-center">
        <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Konto oczekuje na weryfikację
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            Zarejestrowałeś się poprawnie! Administrator musi teraz aktywować
            Twoje konto i przydzielić Cię do budowy.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="w-full bg-slate-100 text-slate-800 py-3 rounded-xl font-bold hover:bg-slate-200"
          >
            Wyloguj i wróć
          </button>
        </div>
      </div>
    );
  }

  const isAdministrator = userData.role === "administrator";
  const availableProjects = isAdministrator
    ? projects
    : projects.filter((p) => userData.assignedProjects.includes(p.id));
  const activeProjectData =
    projects.find((p) => p.id === activeProjectId) || {};

  const canViewTab = (tab) => isAdministrator || !!userData.permissions[tab];
  const canEditTab = (tab) =>
    isAdministrator || !!userData.editPermissions[tab];

  // =====================================================================
  // STRUKTURA MENU
  // =====================================================================
  const MODULES = [
    { id: "info", icon: Info, label: "Informacje" },
    { id: "dziennik", icon: BookOpen, label: "Dziennik prac" },
    { id: "usterki", icon: AlertOctagon, label: "Usterki i Wady" },
    { id: "dokumenty", icon: FolderOpen, label: "Baza Dokumentów" },
    { id: "zdjecia", icon: ImageIcon, label: "Galeria Zdjęć" },
  ];

  const renderSidebar = () => (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen hidden md:flex flex-col fixed left-0 top-0 shadow-xl z-30">
      <div className="p-6 bg-slate-950 flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg">
          <HardHat className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-white font-black text-lg tracking-tight leading-none">
            Nadzór V2
          </h1>
          <p className="text-[10px] text-blue-400 uppercase font-bold mt-1 tracking-widest">
            {userData.role}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <button
          onClick={() => {
            setCurrentScreen("home");
            setActiveProjectId(null);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            currentScreen === "home"
              ? "bg-blue-600 text-white shadow-lg"
              : "hover:bg-slate-800 hover:text-white"
          }`}
        >
          <Building2 className="w-5 h-5" /> Moje Budowy
        </button>

        {currentScreen === "project" && (
          <div className="pt-4 mt-4 border-t border-slate-800">
            <div className="px-4 mb-2 text-[10px] uppercase font-black text-slate-500 tracking-wider">
              Aktywny projekt
            </div>
            <div className="px-4 text-sm font-bold text-white mb-4 line-clamp-2 leading-tight">
              {activeProjectData.name}
            </div>
            {MODULES.map((m) => {
              if (!canViewTab(m.id)) return null;
              const IconComp = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveTab(m.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === m.id
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <IconComp
                    className={`w-4 h-4 ${
                      activeTab === m.id ? "text-blue-500" : ""
                    }`}
                  />{" "}
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-950">
        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-500 hover:text-white text-slate-400 py-2.5 rounded-xl text-xs font-bold transition-colors"
        >
          <LogOut className="w-4 h-4" /> Wyloguj
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {renderSidebar()}

      {/* GŁÓWNA ZAWARTOŚĆ */}
      <div className="flex-1 flex flex-col md:ml-64 overflow-hidden relative">
        <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg z-20">
          <div className="flex items-center gap-3">
            <HardHat className="w-7 h-7 text-blue-500" />
            <div>
              <h1 className="text-sm font-black leading-none">
                {currentScreen === "home"
                  ? "Nadzór V2"
                  : activeProjectData.name}
              </h1>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 bg-slate-800 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-[68px] left-0 w-full bg-slate-900 shadow-2xl z-30 animate-in slide-in-from-top-2 pb-4 border-b border-slate-800">
            <button
              onClick={() => {
                setCurrentScreen("home");
                setActiveProjectId(null);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-bold border-b border-slate-800 ${
                currentScreen === "home" ? "text-blue-400" : "text-slate-300"
              }`}
            >
              <Building2 className="w-5 h-5" /> Moje Budowy
            </button>
            {currentScreen === "project" &&
              MODULES.map((m) => {
                if (!canViewTab(m.id)) return null;
                const IconComp = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setActiveTab(m.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-6 py-3.5 text-sm font-medium border-b border-slate-800/50 ${
                      activeTab === m.id
                        ? "text-blue-400 bg-slate-800/30"
                        : "text-slate-400"
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                    {m.label}
                  </button>
                );
              })}
            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center gap-3 px-6 py-4 text-sm font-bold text-red-400 mt-2"
            >
              <LogOut className="w-5 h-5" /> Wyloguj się
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          <div className="max-w-5xl mx-auto w-full pb-20 md:pb-8">
            {currentScreen === "home" && (
              <div className="space-y-8 animate-in fade-in">
                {isAdministrator && (
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-8">
                    <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-red-500" />{" "}
                      Zgłoszone Usterki (Wszystkie budowy)
                    </h2>
                    <div className="space-y-3">
                      {issues.filter(
                        (i) =>
                          i.status !== "Naprawiona" &&
                          i.status !== "Zaakceptowana"
                      ).length === 0 ? (
                        <p className="text-xs text-slate-400">
                          Wszystko naprawione!
                        </p>
                      ) : (
                        issues
                          .filter(
                            (i) =>
                              i.status !== "Naprawiona" &&
                              i.status !== "Zaakceptowana"
                          )
                          .map((iss) => (
                            <div
                              key={iss.id}
                              onClick={() => {
                                setActiveProjectId(iss.projectId);
                                setCurrentScreen("project");
                                setActiveTab("usterki");
                              }}
                              className="bg-white p-3 rounded-xl border shadow-sm cursor-pointer hover:border-red-300"
                            >
                              <p className="text-[10px] text-red-500 font-bold uppercase mb-1">
                                {
                                  projects.find((p) => p.id === iss.projectId)
                                    ?.name
                                }
                              </p>
                              <p className="text-sm font-semibold">
                                {iss.title}
                              </p>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-blue-600" /> Twoje
                    Inwestycje
                  </h2>
                  {isAdministrator && (
                    <button
                      onClick={() => {
                        setProjectForm({
                          name: "",
                          investor: "",
                          location: "",
                          mapUrl: "",
                          phone: "",
                          description: "",
                        });
                        setIsProjectModalOpen(true);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-[0_4px_14px_0_rgb(37,99,235,0.39)] flex items-center justify-center gap-2 font-bold transition mb-6"
                    >
                      <Plus className="w-5 h-5" /> Utwórz nową budowę
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {availableProjects.length === 0 && (
                      <p className="text-slate-400">Brak przypisanych budów.</p>
                    )}
                    {availableProjects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setActiveProjectId(p.id);
                          setCurrentScreen("project");
                          setActiveTab("info");
                        }}
                        className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-blue-200 transition-all relative"
                      >
                        <h3 className="font-black text-xl text-slate-800 mb-2 pr-10">
                          {p.name}
                        </h3>
                        {p.location && (
                          <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-slate-400" />{" "}
                            {p.location}
                          </div>
                        )}
                        {isAdministrator && (
                          <div className="absolute top-4 right-4 flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProject(p.id);
                                setProjectForm({
                                  name: p.name,
                                  investor: p.investor || "",
                                  location: p.location || "",
                                  mapUrl: p.mapUrl || "",
                                  phone: p.phone || "",
                                  description: p.description || "",
                                });
                                setIsProjectModalOpen(true);
                              }}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-lg"
                            >
                              <EditIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {isAdministrator && (
                  <div className="mt-12 pt-8 border-t border-slate-200">
                    <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                      <ShieldCheck className="w-6 h-6 text-blue-600" />{" "}
                      Użytkownicy
                    </h2>
                    <div className="space-y-4">
                      {usersList.map((u) => (
                        <div
                          key={u.id}
                          className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-start md:items-center"
                        >
                          <div className="flex-1">
                            <p className="font-bold text-slate-800">
                              {u.displayName || "Brak Imienia"}{" "}
                              <span className="text-xs text-slate-500 ml-2">
                                {u.email}
                              </span>
                            </p>
                            <div className="flex gap-2 mt-2">
                              <select
                                value={u.role}
                                onChange={(e) =>
                                  updateDoc(
                                    doc(
                                      db,
                                      "artifacts",
                                      appId,
                                      "public",
                                      "data",
                                      "users_roles",
                                      u.id
                                    ),
                                    { role: e.target.value }
                                  )
                                }
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none"
                              >
                                <option value="administrator">
                                  Administrator
                                </option>
                                <option value="kierownik budowy">
                                  Kierownik
                                </option>
                                <option value="inwestor">Inwestor</option>
                                <option value="wykonawca">Wykonawca</option>
                              </select>
                              <button
                                onClick={() =>
                                  updateDoc(
                                    doc(
                                      db,
                                      "artifacts",
                                      appId,
                                      "public",
                                      "data",
                                      "users_roles",
                                      u.id
                                    ),
                                    { approved: !u.approved }
                                  )
                                }
                                className={`text-xs px-3 py-1 rounded-lg font-bold ${
                                  u.approved
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {u.approved ? "Aktywny" : "Zablokowany"}
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap items-center">
                            {projects.map((proj) => {
                              const isAssigned = (
                                u.assignedProjects || []
                              ).includes(proj.id);
                              return (
                                <button
                                  key={proj.id}
                                  onClick={() => {
                                    let updated = isAssigned
                                      ? (u.assignedProjects || []).filter(
                                          (id) => id !== proj.id
                                        )
                                      : [
                                          ...(u.assignedProjects || []),
                                          proj.id,
                                        ];
                                    updateDoc(
                                      doc(
                                        db,
                                        "artifacts",
                                        appId,
                                        "public",
                                        "data",
                                        "users_roles",
                                        u.id
                                      ),
                                      { assignedProjects: updated }
                                    );
                                  }}
                                  className={`text-[10px] px-2 py-1.5 rounded-lg border font-bold ${
                                    isAssigned
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-50 text-slate-500 border-slate-200"
                                  }`}
                                >
                                  {proj.name}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => genericDel("users_roles", u.id)}
                              className="bg-red-50 text-red-500 p-2 rounded-lg ml-2 hover:bg-red-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentScreen === "project" && (
              <>
                {/* INFO */}
                {activeTab === "info" && (
                  <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center relative overflow-hidden">
                      <Building2 className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                      <h2 className="text-3xl font-black text-slate-800 mb-2">
                        {activeProjectData?.name}
                      </h2>
                      <p className="text-sm text-slate-500 max-w-lg mx-auto">
                        {activeProjectData?.description ||
                          "Brak opisu inwestycji."}
                      </p>
                    </div>
                    {activeProjectData.mapUrl && (
                      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-2 overflow-hidden h-[400px]">
                        <iframe
                          title="Mapa Google"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(
                            activeProjectData.mapUrl
                          )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                          className="w-full h-full rounded-2xl border-0"
                          loading="lazy"
                        ></iframe>
                      </div>
                    )}
                  </div>
                )}

                {/* DZIENNIK */}
                {activeTab === "dziennik" && (
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center">
                    <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">
                      Tutaj lądują notatki z budowy
                    </p>
                  </div>
                )}

                {/* DOKUMENTY */}
                {activeTab === "dokumenty" && (
                  <div className="space-y-6 animate-in fade-in">
                    {canEditTab("dokumenty") && (
                      <div className="bg-white rounded-3xl shadow-sm border p-6">
                        <div className="flex flex-col md:flex-row gap-3">
                          <input
                            type="text"
                            placeholder="Nazwa pliku"
                            value={docForm.name}
                            onChange={(e) =>
                              setDocForm({ ...docForm, name: e.target.value })
                            }
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none"
                          />
                          <input
                            type="file"
                            ref={docInputRef}
                            className="hidden"
                            accept=".pdf,image/*"
                            onChange={(e) => {
                              if (e.target.files[0])
                                readDocumentBase64(e.target.files[0], (b64) => {
                                  if (b64)
                                    genericAdd(
                                      "ins_documents",
                                      {
                                        name: docForm.name,
                                        fileBase64: b64,
                                        dateStr: formatDateStr(new Date()),
                                      },
                                      () => setDocForm({ name: "" })
                                    );
                                });
                            }}
                          />
                          <button
                            onClick={() => docInputRef.current?.click()}
                            disabled={!docForm.name.trim()}
                            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                          >
                            <FileUp className="w-4 h-4" /> Wgraj
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {documents
                        .filter((d) => d.projectId === activeProjectId)
                        .map((d) => (
                          <div
                            key={d.id}
                            className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-slate-800 text-sm truncate">
                                {d.name}
                              </h4>
                              <div className="flex gap-2 mt-3">
                                <a
                                  href={d.fileBase64}
                                  download={d.name}
                                  className="flex-1 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition text-xs font-bold py-2 rounded-xl flex justify-center items-center gap-1"
                                >
                                  <Download className="w-3 h-3" /> Pobierz
                                </a>
                                {canEditTab("dokumenty") && (
                                  <button
                                    onClick={() =>
                                      genericDel("ins_documents", d.id)
                                    }
                                    className="bg-red-50 hover:bg-red-100 text-red-500 transition p-2 rounded-xl"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* USTERKI */}
                {activeTab === "usterki" && (
                  <div className="space-y-6 animate-in fade-in">
                    {canEditTab("usterki") && (
                      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                          <AlertOctagon className="w-5 h-5 text-red-500" />{" "}
                          Zgłoś nową usterkę
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <input
                            type="text"
                            placeholder="Tytuł usterki"
                            value={issueForm.title}
                            onChange={(e) =>
                              setIssueForm({
                                ...issueForm,
                                title: e.target.value,
                              })
                            }
                            className="bg-slate-50 border border-slate-200 outline-none focus:border-red-500 rounded-xl p-3 text-sm"
                          />
                          <select
                            value={issueForm.assignee}
                            onChange={(e) =>
                              setIssueForm({
                                ...issueForm,
                                assignee: e.target.value,
                              })
                            }
                            className="bg-slate-50 border border-slate-200 outline-none rounded-xl p-3 text-sm"
                          >
                            <option value="">Przypisz (opcjonalnie)</option>
                            {usersList.map((u) => (
                              <option key={u.id} value={u.email}>
                                {u.displayName || u.email}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-4">
                          <input
                            type="file"
                            ref={issuePhotoRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files[0])
                                compressImage(e.target.files[0], (b64) =>
                                  setIssueForm({ ...issueForm, photo: b64 })
                                );
                            }}
                          />
                          <button
                            onClick={() => issuePhotoRef.current?.click()}
                            className="bg-slate-100 hover:bg-slate-200 transition px-5 py-2.5 rounded-xl text-sm font-bold flex gap-2 items-center"
                          >
                            <Camera className="w-4 h-4" /> Zdjęcie
                          </button>
                          <button
                            onClick={() => {
                              genericAdd(
                                "ins_issues",
                                {
                                  ...issueForm,
                                  status: "Zgłoszona",
                                  dateString: formatDateStr(new Date()),
                                  photoBase64: issueForm.photo,
                                },
                                () =>
                                  setIssueForm({
                                    title: "",
                                    description: "",
                                    assignee: "",
                                    photo: null,
                                  })
                              );
                            }}
                            disabled={!issueForm.title.trim()}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 transition text-white px-8 py-2.5 rounded-xl text-sm font-bold"
                          >
                            Zgłoś usterkę
                          </button>
                        </div>
                        {issueForm.photo && (
                          <img
                            src={issueForm.photo}
                            className="h-24 mt-4 rounded-xl border object-cover"
                            alt="Podgląd"
                          />
                        )}
                      </div>
                    )}
                    <div className="space-y-4">
                      {issues
                        .filter((i) => i.projectId === activeProjectId)
                        .map((iss) => {
                          const isEditing = editingIssueId === iss.id;
                          return (
                            <div
                              key={iss.id}
                              className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 flex flex-col md:flex-row gap-5 relative overflow-hidden"
                            >
                              <div
                                className={`absolute left-0 top-0 bottom-0 w-2 ${
                                  iss.status === "Zaakceptowana"
                                    ? "bg-emerald-500"
                                    : iss.status === "Naprawiona"
                                    ? "bg-blue-500"
                                    : iss.status === "W trakcie"
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                              ></div>
                              {iss.photoBase64 && (
                                <img
                                  src={iss.photoBase64}
                                  className="w-full md:w-32 h-32 object-cover rounded-2xl border shrink-0"
                                  alt="Wada"
                                />
                              )}
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-bold text-slate-800">
                                    {iss.title}
                                  </h4>
                                  <span
                                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${
                                      iss.status === "Zaakceptowana"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : iss.status === "Naprawiona"
                                        ? "bg-blue-100 text-blue-700"
                                        : iss.status === "W trakcie"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {iss.status}
                                  </span>
                                </div>
                                {isEditing ? (
                                  <div className="flex gap-2 mt-3 p-3 bg-slate-50 rounded-xl border">
                                    <select
                                      value={editIssueStatus}
                                      onChange={(e) =>
                                        setEditIssueStatus(e.target.value)
                                      }
                                      className="border rounded-lg p-2 text-xs font-bold outline-none"
                                    >
                                      <option value="Zgłoszona">
                                        Zgłoszona
                                      </option>
                                      <option value="W trakcie">
                                        W trakcie
                                      </option>
                                      <option value="Naprawiona">
                                        Naprawiona
                                      </option>
                                    </select>
                                    <button
                                      onClick={() => {
                                        genericUpdate("ins_issues", iss.id, {
                                          status: editIssueStatus,
                                        });
                                        setEditingIssueId(null);
                                      }}
                                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold"
                                    >
                                      Zapisz
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 mt-4">
                                    <button
                                      onClick={() => {
                                        setEditingIssueId(iss.id);
                                        setEditIssueStatus(iss.status);
                                      }}
                                      className="bg-slate-100 hover:bg-slate-200 transition px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                                    >
                                      <EditIcon className="w-3 h-3" /> Zmień
                                      status
                                    </button>
                                    {isAdministrator && (
                                      <button
                                        onClick={() =>
                                          genericDel("ins_issues", iss.id)
                                        }
                                        className="bg-red-50 hover:bg-red-100 transition text-red-500 p-1.5 rounded-lg ml-auto"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* MODAL EDYCJI PROJEKTU */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-black text-xl text-slate-800">
                {editingProject ? "Edytuj Budowę" : "Nowa Budowa"}
              </h2>
              <button
                onClick={() => setIsProjectModalOpen(false)}
                className="w-8 h-8 bg-white border border-slate-200 hover:bg-slate-100 transition rounded-full flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <input
                type="text"
                placeholder="Nazwa"
                value={projectForm.name}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, name: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 outline-none focus:border-blue-500 rounded-xl p-3 text-sm"
              />
              <input
                type="text"
                placeholder="Lokalizacja"
                value={projectForm.location}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, location: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 outline-none focus:border-blue-500 rounded-xl p-3 text-sm"
              />
              <input
                type="url"
                placeholder="Link do Mapy"
                value={projectForm.mapUrl}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, mapUrl: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 outline-none focus:border-blue-500 rounded-xl p-3 text-sm"
              />
            </div>
            <div className="p-6 border-t border-slate-100 bg-white">
              <button
                onClick={handleSaveProject}
                disabled={!projectForm.name.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 text-white py-3.5 rounded-xl font-bold"
              >
                Zapisz Projekt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
