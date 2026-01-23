import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { 
    auth, db, uploadFile,
    onAuthStateChanged, User, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser,
    doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, increment, serverTimestamp, orderBy,
    writeBatch, onSnapshot, deleteField, deleteDoc
} from './services/firebase';

import { UserProfile, UserRole, CatalogItem, Offering, Reservation, ProviderProfile, ReservationStatus, AppNotification, ProviderCategory, Currency } from './types';
import { 
  HomeIcon, 
  ShoppingBagIcon, 
  UserGroupIcon, 
  CalendarIcon, 
  ClipboardDocumentCheckIcon, 
  ArrowRightOnRectangleIcon,
  PlusIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  PhotoIcon,
  Bars3Icon,
  XMarkIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  ClockIcon,
  CloudArrowUpIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  Square2StackIcon,
  TableCellsIcon,
  UserIcon,
  TagIcon,
  IdentificationIcon,
  BanknotesIcon,
  BellIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  EyeSlashIcon,
  EyeIcon,
  AdjustmentsHorizontalIcon,
  FolderIcon,
  ListBulletIcon,
  Squares2X2Icon,
  SparklesIcon,
  FireIcon,
  ArchiveBoxIcon,
  BoltIcon,
  EllipsisHorizontalIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';

// --- UTILS: Timezone & Date Helpers ---
const getSaudiDate = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
};

// Mock Router
const RouterContext = createContext({ path: window.location.hash.substring(1) || '/' });

const HashRouter: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [path, setPath] = useState(window.location.hash.substring(1) || '/');
    useEffect(() => {
        const handler = () => {
            window.scrollTo(0, 0); 
            setPath(window.location.hash.substring(1) || '/');
        }
        window.addEventListener('hashchange', handler);
        return () => window.removeEventListener('hashchange', handler);
    }, []);
    return <RouterContext.Provider value={{path}}>{children}</RouterContext.Provider>;
};

const Routes: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const { path } = useContext(RouterContext);
    let found: React.ReactNode = null;
    React.Children.forEach(children, child => {
        if (found) return;
        if (React.isValidElement(child)) {
            const props = child.props as any;
            if (props.path === '*' || props.path === path) {
                found = child;
            }
        }
    });
    return <div className="animate-fade-in">{found}</div>;
};

const Route: React.FC<{path: string, element: React.ReactNode}> = ({ element }) => <>{element}</>;

const Link: React.FC<{to: string, children: React.ReactNode, className?: string}> = ({ to, children, className }) => (
    <a href={`#${to}`} className={className}>{children}</a>
);

const Navigate: React.FC<{to: string}> = ({ to }) => {
    useEffect(() => { window.location.hash = to; }, [to]);
    return null;
};

// --- Toast System ---
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

const ToastContext = createContext<{ showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }>({ showToast: () => {} });

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2">
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 animate-slide-up ${
                        t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-primary-600'
                    }`}>
                        {t.type === 'success' && <CheckCircleIcon className="w-5 h-5" />}
                        {t.type === 'error' && <XCircleIcon className="w-5 h-5" />}
                        {t.type === 'info' && <CheckCircleIcon className="w-5 h-5" />}
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

// --- Auth Context ---
interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  providerProfile: ProviderProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async (uid: string) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setUserProfile(userData);
            if (userData.role === 'provider') {
                const provDoc = await getDoc(doc(db, 'providers', uid));
                if (provDoc.exists()) setProviderProfile(provDoc.data() as ProviderProfile);
            }
        }
      } catch(e) { console.error(e); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfiles(user.uid);
      } else {
        setUserProfile(null);
        setProviderProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    window.location.hash = '/login';
  };

  const refreshProfile = async () => {
      if(currentUser) await fetchProfiles(currentUser.uid);
  }

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, providerProfile, loading, logout, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// --- Notification Context ---
interface NotificationContextType {
    notifications: AppNotification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    sendNotification: (recipientId: string, title: string, body: string, type?: 'info'|'success'|'warning') => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({} as NotificationContextType);

const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useContext(AuthContext);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    useEffect(() => {
        if (!currentUser) {
            setNotifications([]);
            return;
        }
        const q = query(
            collection(db, 'notifications'), 
            where('recipientId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
            setNotifications(data);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

    const markAsRead = async (id: string) => {
        try { await updateDoc(doc(db, 'notifications', id), { read: true }); } catch(e) {}
    };

    const sendNotification = async (recipientId: string, title: string, body: string, type: 'info'|'success'|'warning' = 'info') => {
        try {
            await addDoc(collection(db, 'notifications'), {
                recipientId, title, body, type, read: false, createdAt: Date.now()
            });
        } catch(e) {}
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, sendNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

// --- UI Components ---

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-full min-h-[50vh]">
    <div className="relative">
        <div className="w-12 h-12 rounded-full absolute border-4 border-solid border-gray-200"></div>
        <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-solid border-primary-600 border-t-transparent"></div>
    </div>
  </div>
);

const SkeletonCard = () => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
        <div className="flex gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
        </div>
        <div className="mt-4 h-8 bg-gray-200 rounded w-full"></div>
    </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost', isLoading?: boolean }> = ({ 
    children, className = '', variant = 'primary', isLoading, disabled, ...props 
}) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 select-none";
    const variants = {
        primary: "bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:shadow-none",
        secondary: "bg-teal-500 hover:bg-teal-600 text-white shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:shadow-none",
        danger: "bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:shadow-none",
        outline: "border-2 border-primary-600 text-primary-600 hover:bg-primary-50 disabled:border-gray-300 disabled:text-gray-300",
        ghost: "bg-transparent text-gray-600 hover:bg-gray-100 disabled:text-gray-300"
    };

    return (
        <button 
            className={`${baseStyle} ${variants[variant]} ${className}`} 
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
            {!isLoading && children}
        </button>
    );
};

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 ${className}`} {...props}>
        {children}
    </div>
);

const Badge: React.FC<{ status: string }> = ({ status }) => {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
        completed: 'bg-green-100 text-green-700 border-green-200',
        cancelled: 'bg-red-100 text-red-700 border-red-200',
    };
    
    const labels: Record<string, string> = {
        pending: 'معلق',
        confirmed: 'مؤكد',
        completed: 'مكتمل',
        cancelled: 'ملغي',
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status] || 'bg-gray-100'}`}>
            {labels[status] || status}
        </span>
    );
};

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm" aria-hidden="true" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="relative inline-block align-bottom bg-white rounded-2xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-gray-100">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">{title}</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 focus:outline-none"><XMarkIcon className="h-6 w-6" /></button>
                        </div>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Navbar = () => { const { userProfile, logout } = useContext(AuthContext); const { notifications, unreadCount, markAsRead } = useContext(NotificationContext); const [isMenuOpen, setIsMenuOpen] = useState(false); const [isNotifOpen, setIsNotifOpen] = useState(false); const notifRef = useRef<HTMLDivElement>(null); useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false); }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []); return (<nav className="bg-gradient-to-r from-primary-900 to-primary-700 text-white shadow-lg sticky top-0 z-50 backdrop-blur-sm bg-opacity-95"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between h-16"><div className="flex items-center gap-2"><Link to="/" className="text-2xl font-bold font-sans flex items-center gap-2 hover:opacity-90 transition-opacity"><span className="text-3xl">✨</span><span>حجزي - Hajzi</span></Link></div><div className="hidden md:block"><div className="ml-10 flex items-center space-x-4 space-x-reverse">{userProfile ? (<><div className="relative" ref={notifRef}><button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 rounded-full hover:bg-white/10 relative transition-colors"><BellIcon className="w-6 h-6 text-primary-100" />{unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center border border-primary-900 animate-pulse">{unreadCount}</span>}</button>{isNotifOpen && (<div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl py-2 text-gray-800 z-50 overflow-hidden border border-gray-100 animate-slide-up"><div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="font-bold text-sm">الإشعارات</h3><span className="text-xs text-gray-500">{unreadCount} جديد</span></div><div className="max-h-80 overflow-y-auto scrollbar-thin">{notifications.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">لا توجد إشعارات حالياً</div> : notifications.map(notif => (<div key={notif.id} onClick={() => markAsRead(notif.id)} className={`px-4 py-3 border-b border-gray-50 hover:bg-primary-50 cursor-pointer transition-colors ${!notif.read ? 'bg-blue-50/50' : ''}`}><div className="flex justify-between items-start"><p className={`text-sm ${!notif.read ? 'font-bold text-primary-800' : 'text-gray-700'}`}>{notif.title}</p><span className="text-[10px] text-gray-400">{new Date(notif.createdAt).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}</span></div><p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.body}</p></div>))}</div></div>)}</div><div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/20"><UserGroupIcon className="w-5 h-5 text-primary-200" /><span className="text-sm font-medium">{userProfile.name}</span></div>{userProfile.role === 'provider' && (<><Link to="/provider/dashboard" className="nav-link">لوحة التحكم</Link><Link to="/provider/catalog" className="nav-link">الكتالوج</Link><Link to="/provider/offers" className="nav-link">العروض</Link><Link to="/provider/reservations" className="nav-link">الحجوزات</Link></>)}{userProfile.role === 'customer' && (<><Link to="/" className="nav-link">العروض اليومية</Link><Link to="/providers" className="nav-link">مقدمو الخدمة</Link><Link to="/my-reservations" className="nav-link">حجوزاتي</Link></>)}<button onClick={logout} className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full transition-colors" title="تسجيل الخروج"><ArrowRightOnRectangleIcon className="h-5 w-5" /></button></>) : (<><Link to="/login" className="nav-link">دخول</Link><Link to="/register" className="bg-white text-primary-800 hover:bg-primary-50 px-4 py-2 rounded-lg font-bold transition-all shadow-md transform hover:-translate-y-0.5">حساب جديد</Link></>)}</div></div><div className="-mr-2 flex md:hidden gap-2">{userProfile && <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 relative"><BellIcon className="h-6 w-6 text-gray-200" />{unreadCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full"></span>}</button>}<button onClick={() => setIsMenuOpen(!isMenuOpen)} className="bg-primary-800 p-2 rounded-md text-gray-200 hover:text-white focus:outline-none">{isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}</button></div></div></div>{isNotifOpen && (<div className="md:hidden bg-white text-gray-800 max-h-60 overflow-y-auto border-t border-b border-gray-200">{notifications.length === 0 && <div className="p-4 text-center text-sm text-gray-400">لا توجد إشعارات</div>}{notifications.map(n => (<div key={n.id} onClick={() => markAsRead(n.id)} className={`p-3 border-b border-gray-100 ${!n.read ? 'bg-blue-50' : ''}`}><div className="font-bold text-sm">{n.title}</div><div className="text-xs text-gray-600">{n.body}</div></div>))}</div>)}{isMenuOpen && (<div className="md:hidden bg-primary-800 border-t border-primary-700 animate-fade-in"><div className="px-4 pt-2 pb-6 space-y-2">{userProfile ? (<><div className="text-primary-200 px-3 py-3 border-b border-primary-700 mb-2">مرحباً، {userProfile.name}</div>{userProfile.role === 'provider' && (<><Link to="/provider/dashboard" className="block mobile-nav-link">لوحة التحكم</Link><Link to="/provider/catalog" className="block mobile-nav-link">الكتالوج</Link><Link to="/provider/offers" className="block mobile-nav-link">العروض</Link><Link to="/provider/reservations" className="block mobile-nav-link">الحجوزات</Link></>)}{userProfile.role === 'customer' && (<><Link to="/" className="block mobile-nav-link">العروض اليومية</Link><Link to="/providers" className="block mobile-nav-link">مقدمو الخدمة</Link><Link to="/my-reservations" className="block mobile-nav-link">حجوزاتي</Link></>)}<button onClick={logout} className="w-full text-right block bg-red-600/90 text-white px-3 py-3 rounded-md mt-4">تسجيل خروج</button></>) : (<><Link to="/login" className="block mobile-nav-link">دخول</Link><Link to="/register" className="block bg-primary-500 text-white px-3 py-3 rounded-md mt-2 font-bold">حساب جديد</Link></>)}</div></div>)}</nav>); };
const Login = () => { const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false); const { showToast } = useContext(ToastContext); const handleLogin = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); try { let emailToUse = identifier; if (!identifier.includes('@')) { emailToUse = `${identifier}@seacatch.local`; } await signInWithEmailAndPassword(auth, emailToUse, password); showToast('تم تسجيل الدخول بنجاح', 'success'); window.location.hash = '/'; } catch (err: any) { console.error(err); let msg = "حدث خطأ أثناء تسجيل الدخول"; if (err.code === 'auth/invalid-credential') msg = "البيانات غير صحيحة"; showToast(msg, 'error'); } setLoading(false); }; return (<div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50"><Card className="max-w-md w-full p-8 space-y-8 animate-slide-up border-t-4 border-t-primary-500"><div><h2 className="mt-2 text-center text-3xl font-extrabold text-primary-900">تسجيل الدخول</h2></div><form className="mt-8 space-y-6" onSubmit={handleLogin}><div className="rounded-md shadow-sm -space-y-px"><input type="text" required className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm" placeholder="البريد الإلكتروني أو رقم الجوال" value={identifier} onChange={(e) => setIdentifier(e.target.value)} /><input type="password" required className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} /></div><Button type="submit" isLoading={loading} className="w-full py-3">دخول</Button><div className="text-sm text-center"><Link to="/register" className="font-medium text-primary-600 hover:text-primary-500 transition-colors">ليس لديك حساب؟ <span className="underline">سجل الآن</span></Link></div></form></Card></div>); };
const Register = () => { const [formData, setFormData] = useState({ name: '', contact: '', password: '', role: 'customer' as UserRole, providerCode: '', category: 'مطعم' as ProviderCategory }); const [loading, setLoading] = useState(false); const { showToast } = useContext(ToastContext); const providerCategories: ProviderCategory[] = ['مطعم', 'مقهى', 'ملابس', 'إلكترونيات', 'خدمات', 'أخرى']; const handleRegister = async (e: React.FormEvent) => { e.preventDefault(); if (formData.role === 'provider' && formData.providerCode !== '356751') { showToast("رمز التحقق لمقدم الخدمة غير صحيح", 'error'); return; } setLoading(true); let userToDelete: User | null = null; try { let emailToRegister = formData.contact; let phoneToStore = ''; if (!formData.contact.includes('@')) { phoneToStore = formData.contact; emailToRegister = `${formData.contact}@seacatch.local`; } const userCredential = await createUserWithEmailAndPassword(auth, emailToRegister, formData.password); userToDelete = userCredential.user; const newUser: UserProfile = { uid: userCredential.user.uid, name: formData.name, email: emailToRegister, role: formData.role, phone: phoneToStore, createdAt: Date.now() }; await setDoc(doc(db, 'users', userCredential.user.uid), newUser); if (formData.role === 'provider') { const newProvider: ProviderProfile = { providerId: userCredential.user.uid, name: formData.name, description: `يقدم أفضل ${formData.category === 'مطعم' ? 'المأكولات' : 'الخدمات والمنتجات'}`, category: formData.category, followersCount: 0 }; await setDoc(doc(db, 'providers', userCredential.user.uid), newProvider); } showToast('تم إنشاء الحساب بنجاح', 'success'); window.location.hash = '/'; } catch (err: any) { console.error(err); let msg = "فشل التسجيل"; if (err.code === 'auth/email-already-in-use') msg = "الحساب مسجل مسبقاً"; showToast(msg, 'error'); if (userToDelete) try { await deleteUser(userToDelete); } catch {} } setLoading(false); }; return (<div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50"><Card className="max-w-md w-full p-8 space-y-8 animate-slide-up border-t-4 border-t-primary-500"><div><h2 className="mt-2 text-center text-3xl font-extrabold text-primary-900">حساب جديد</h2></div><form className="mt-8 space-y-4" onSubmit={handleRegister}><div className="space-y-3"><input type="text" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" placeholder="الاسم الكامل / اسم المتجر" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /><input type="text" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" placeholder="البريد الإلكتروني أو رقم الجوال" value={formData.contact} onChange={(e) => setFormData({...formData, contact: e.target.value})} /><input type="password" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" placeholder="كلمة المرور (6 أحرف على الأقل)" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} /></div><div className="grid grid-cols-2 gap-4 mt-4"><div onClick={() => setFormData({...formData, role: 'customer'})} className={`cursor-pointer p-4 rounded-lg border-2 text-center transition-all ${formData.role === 'customer' ? 'border-primary-600 bg-primary-50 text-primary-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-primary-300'}`}><div>🍽️</div><div className="text-sm mt-1">عميل</div></div><div onClick={() => setFormData({...formData, role: 'provider'})} className={`cursor-pointer p-4 rounded-lg border-2 text-center transition-all ${formData.role === 'provider' ? 'border-primary-600 bg-primary-50 text-primary-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-primary-300'}`}><div>👨‍🍳</div><div className="text-sm mt-1">مقدم خدمة</div></div></div>{formData.role === 'provider' && (<div className="animate-fade-in space-y-3 mt-4"><div><label className="text-sm text-gray-600 block mb-1">نوع النشاط</label><select className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value as ProviderCategory})}>{providerCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="text-sm text-gray-600 block mb-1">رمز التحقق (للمتاجر فقط)</label><input type="password" required className="block w-full px-3 py-3 border border-red-200 bg-red-50 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-center tracking-widest" placeholder="أدخل الرمز السري" value={formData.providerCode} onChange={(e) => setFormData({...formData, providerCode: e.target.value})} /></div></div>)}<Button type="submit" isLoading={loading} className="w-full py-3 mt-6">تسجيل</Button><div className="text-sm text-center"><Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">لديك حساب؟ سجل دخول</Link></div></form></Card></div>); };
const ProviderDashboard = () => { const { userProfile } = useContext(AuthContext); const [stats, setStats] = useState({ items: 0, offers: 0, reservations: 0, revenue: 0, followers: 0 }); useEffect(() => { const fetchStats = async () => { if (!userProfile) return; try { const itemsSnap = await getDocs(query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid))); const offersSnap = await getDocs(query(collection(db, 'offerings'), where('providerId', '==', userProfile.uid), where('isActive', '==', true))); const resSnap = await getDocs(query(collection(db, 'reservations'), where('providerId', '==', userProfile.uid))); let rev = 0; resSnap.forEach(doc => { const data = doc.data() as Reservation; if(data.status === 'completed') rev += data.totalPrice; }); setStats({ items: itemsSnap.size, offers: offersSnap.size, reservations: resSnap.size, revenue: rev, followers: 0 }); } catch (e) { console.error(e); } }; fetchStats(); }, [userProfile]); const StatCard = ({ title, value, color, icon }: any) => (<Card className={`p-6 flex items-center justify-between border-l-4 overflow-hidden relative group hover:-translate-y-1 transition-transform`} style={{ borderLeftColor: color }}><div className="relative z-10"><p className="text-gray-500 text-sm font-medium mb-1">{title}</p><h3 className="text-4xl font-extrabold text-gray-800 tracking-tight">{value}</h3></div><div className={`p-4 rounded-xl text-white shadow-lg relative z-10`} style={{background: color}}>{icon}</div></Card>); return (<div className="p-6 max-w-7xl mx-auto space-y-8"><div><h1 className="text-3xl font-bold text-gray-800">لوحة التحكم</h1><p className="text-gray-500 mt-2">نظرة عامة على نشاطك اليوم</p></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><StatCard title="الأصناف / الخدمات" value={stats.items} color="#6366f1" icon={<ShoppingBagIcon className="w-6 h-6"/>} /><StatCard title="العروض النشطة" value={stats.offers} color="#10b981" icon={<CalendarIcon className="w-6 h-6"/>} /><StatCard title="إجمالي الحجوزات" value={stats.reservations} color="#f59e0b" icon={<ClipboardDocumentCheckIcon className="w-6 h-6"/>} /><StatCard title="الإيرادات" value={`${stats.revenue.toLocaleString()}`} color="#8b5cf6" icon={<CurrencyDollarIcon className="w-6 h-6"/>} /></div></div>); };
const ProviderReservations = () => { const { userProfile } = useContext(AuthContext); const { showToast } = useContext(ToastContext); const { sendNotification } = useContext(NotificationContext); const [reservations, setReservations] = useState<Reservation[]>([]); const [loading, setLoading] = useState(true); const [dateFrom, setDateFrom] = useState(getSaudiDate()); const [dateTo, setDateTo] = useState(getSaudiDate()); const [statusFilter, setStatusFilter] = useState<string>('all'); const [searchQuery, setSearchQuery] = useState(''); const [groupBy, setGroupBy] = useState<'none' | 'customer' | 'item'>('none'); const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); const fetchReservations = async () => { if(!userProfile) return; setLoading(true); try { const q = query(collection(db, 'reservations'), where('providerId', '==', userProfile.uid)); const snap = await getDocs(q); setReservations(snap.docs.map(d => ({id: d.id, ...d.data()} as Reservation))); } catch(e) { showToast("فشل تحميل البيانات", 'error'); } finally { setLoading(false); } }; useEffect(() => { fetchReservations(); }, [userProfile]); const filteredReservations = useMemo(() => { let result = reservations; const fromTs = new Date(dateFrom).setHours(0,0,0,0); const toTs = new Date(dateTo).setHours(23,59,59,999); result = result.filter(r => r.createdAt >= fromTs && r.createdAt <= toTs); if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter); if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); result = result.filter(r => r.customerName.toLowerCase().includes(q) || r.offeringName.toLowerCase().includes(q)); } return result.sort((a, b) => b.createdAt - a.createdAt); }, [reservations, dateFrom, dateTo, statusFilter, searchQuery]); const stats = useMemo(() => { const total = filteredReservations.length; const pending = filteredReservations.filter(r => r.status === 'pending').length; const confirmed = filteredReservations.filter(r => r.status === 'confirmed').length; const revenue = filteredReservations.reduce((acc, curr) => (curr.status === 'completed' || curr.status === 'confirmed') ? acc + curr.totalPrice : acc, 0); const itemCounts: Record<string, number> = {}; filteredReservations.forEach(r => { itemCounts[r.offeringName] = (itemCounts[r.offeringName] || 0) + r.quantity; }); return { total, pending, confirmed, revenue, itemCounts }; }, [filteredReservations]); const toggleSelect = (id: string) => { if(statusFilter === 'all') return; const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); }; const toggleSelectAll = () => { if(statusFilter === 'all') return; if (selectedIds.size === filteredReservations.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredReservations.map(r => r.id))); }; const handleBulkAction = async () => { if(!confirm(`هل أنت متأكد من تحديث حالة ${selectedIds.size} حجوزات؟`)) return; let newStatus: ReservationStatus = statusFilter === 'pending' ? 'confirmed' : statusFilter === 'confirmed' ? 'completed' : 'confirmed'; const batch = writeBatch(db); selectedIds.forEach(id => { const ref = doc(db, 'reservations', id); batch.update(ref, { status: newStatus }); const res = reservations.find(r => r.id === id); if(res) sendNotification(res.customerId, 'تحديث الحجز', `تم تغيير حالة حجزك ${res.offeringName} إلى ${newStatus === 'confirmed' ? 'مؤكد' : 'مكتمل'}`); }); try { await batch.commit(); showToast("تم التحديث بنجاح", "success"); setSelectedIds(new Set()); fetchReservations(); } catch(e) { showToast("حدث خطأ", "error"); } }; const handleSingleStatus = async (id: string, status: ReservationStatus) => { try { await updateDoc(doc(db, 'reservations', id), { status }); const res = reservations.find(r => r.id === id); if(res) await sendNotification(res.customerId, 'تحديث الحجز', `حالة حجز ${res.offeringName}: ${status === 'confirmed' ? 'مؤكد' : status === 'completed' ? 'مكتمل' : 'ملغي'}`, status === 'cancelled' ? 'warning' : 'success'); showToast("تم تحديث الحالة", "success"); fetchReservations(); } catch(e) { showToast("خطأ", "error"); } }; const groupedReservations = useMemo(() => { if (groupBy === 'none') return null; const groups: Record<string, { name: string, items: Reservation[], total: number }> = {}; filteredReservations.forEach(r => { let key = groupBy === 'customer' ? r.customerId : r.offeringName; let name = groupBy === 'customer' ? r.customerName : r.offeringName; if (!groups[key]) groups[key] = { name, items: [], total: 0 }; groups[key].items.push(r); if (r.status !== 'cancelled') groups[key].total += r.totalPrice; }); return Object.values(groups); }, [filteredReservations, groupBy]); return (<div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 min-h-screen"><div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"><div><h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><ClipboardDocumentCheckIcon className="w-8 h-8 text-primary-600"/> إدارة الحجوزات</h1></div><div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200"><CalendarDaysIcon className="w-5 h-5 text-gray-400" /><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm border-none focus:ring-0 text-gray-600 font-medium outline-none" /><span className="text-gray-400">-</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm border-none focus:ring-0 text-gray-600 font-medium outline-none" /></div></div>{loading ? <div className="grid gap-4"><SkeletonCard /><SkeletonCard /></div> : (<><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-primary-500"><p className="text-xs text-gray-500 font-bold mb-1">العدد</p><p className="text-2xl font-bold text-gray-800">{stats.total}</p></div><div className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-yellow-500"><p className="text-xs text-gray-500 font-bold mb-1">معلق</p><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p></div><div className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-green-500"><p className="text-xs text-gray-500 font-bold mb-1">مؤكد</p><p className="text-2xl font-bold text-green-600">{stats.confirmed}</p></div><div className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-purple-500"><p className="text-xs text-gray-500 font-bold mb-1">الإيرادات</p><p className="text-2xl font-bold text-purple-600">{stats.revenue.toLocaleString()}</p></div></div>{Object.keys(stats.itemCounts).length > 0 && <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{Object.entries(stats.itemCounts).map(([name, count]) => (<div key={name} className="flex-shrink-0 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-2 text-sm"><span className="text-gray-600 font-medium">{name}</span><span className="bg-primary-100 text-primary-700 px-2 rounded-full font-bold text-xs">{count}</span></div>))}</div>}<Card className="p-4 flex flex-col lg:flex-row gap-4 justify-between items-center sticky top-20 z-40 shadow-md"><div className="flex flex-1 w-full gap-4 flex-col sm:flex-row"><div className="relative flex-1"><MagnifyingGlassIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400" /><input type="text" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div><div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">{['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(st => (<button key={st} onClick={() => { setStatusFilter(st); setSelectedIds(new Set()); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${statusFilter === st ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>{st === 'all' ? 'الكل' : st}</button>))}</div></div><div className="flex items-center gap-2 border-r pr-4 border-gray-200"><button onClick={() => setGroupBy('none')} className={`p-2 rounded-lg ${groupBy === 'none' ? 'bg-primary-100 text-primary-700' : 'text-gray-400'}`}><TableCellsIcon className="w-6 h-6" /></button><button onClick={() => setGroupBy('customer')} className={`p-2 rounded-lg ${groupBy === 'customer' ? 'bg-primary-100 text-primary-700' : 'text-gray-400'}`}><UserIcon className="w-6 h-6" /></button><button onClick={() => setGroupBy('item')} className={`p-2 rounded-lg ${groupBy === 'item' ? 'bg-primary-100 text-primary-700' : 'text-gray-400'}`}><TagIcon className="w-6 h-6" /></button></div></Card>{selectedIds.size > 0 && statusFilter !== 'all' && (<div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4 animate-slide-up"><span className="font-bold text-sm bg-gray-700 px-2 py-0.5 rounded-md">{selectedIds.size}</span><button onClick={handleBulkAction} className="hover:text-green-400 font-bold text-sm flex items-center gap-1">تنفيذ الإجراء</button><button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5"/></button></div>)}{filteredReservations.length === 0 ? <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300"><div className="text-6xl mb-4">📭</div><h3 className="text-xl font-bold text-gray-700">لا توجد حجوزات</h3></div> : (<>{groupBy === 'none' && (<div className="space-y-4">{statusFilter !== 'all' && <div className="flex items-center gap-2 px-2 text-sm text-gray-500 font-medium"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === filteredReservations.length && filteredReservations.length > 0} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" /><span>تحديد الكل</span></div>}{filteredReservations.map(res => (<Card key={res.id} className={`p-4 flex flex-col md:flex-row items-center gap-4 transition-all ${selectedIds.has(res.id) ? 'ring-2 ring-primary-500 bg-primary-50' : 'hover:border-primary-300'}`}>{statusFilter !== 'all' && (<input type="checkbox" checked={selectedIds.has(res.id)} onChange={() => toggleSelect(res.id)} className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />)}<div className="flex-1 w-full md:w-auto"><div className="flex justify-between items-start"><div><h3 className="font-bold text-gray-900">{res.offeringName}</h3><p className="text-sm text-gray-500 flex items-center gap-1"><UserIcon className="w-3 h-3"/> {res.customerName}</p></div><Badge status={res.status} /></div><div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600"><span className="flex items-center gap-1"><ClockIcon className="w-4 h-4 text-gray-400"/> {new Date(res.createdAt).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}</span><span className="flex items-center gap-1 font-bold text-primary-700"><CurrencyDollarIcon className="w-4 h-4"/> {res.totalPrice} ر.ي</span></div>{res.paymentReference && <div className="mt-2 bg-green-50 text-green-800 text-xs px-2 py-1 rounded inline-flex items-center gap-1"><BanknotesIcon className="w-3 h-3"/> مرجع الدفع: {res.paymentReference}</div>}</div><div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">{res.status === 'pending' && (<><Button variant="ghost" onClick={() => handleSingleStatus(res.id, 'confirmed')} className="text-green-600 bg-green-50 hover:bg-green-100"><CheckCircleIcon className="w-5 h-5"/></Button><Button variant="ghost" onClick={() => handleSingleStatus(res.id, 'cancelled')} className="text-red-600 bg-red-50 hover:bg-red-100"><XCircleIcon className="w-5 h-5"/></Button></>)}{res.status === 'confirmed' && (<Button variant="ghost" onClick={() => handleSingleStatus(res.id, 'completed')} className="text-blue-600 bg-blue-50 hover:bg-blue-100">إتمام</Button>)}</div></Card>))}</div>)}{groupBy !== 'none' && groupedReservations && (<div className="space-y-6">{groupedReservations.map((group, idx) => (<div key={idx} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200"><div className="bg-gray-50 p-4 border-b flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">{group.name[0]}</div><div><h3 className="font-bold text-gray-800">{group.name}</h3><p className="text-xs text-gray-500">{group.items.length} حجوزات</p></div></div><div className="text-right"><div className="text-lg font-bold text-primary-700">{group.total} ر.ي</div></div></div><div className="divide-y divide-gray-100">{group.items.map(res => (<div key={res.id} className="p-4 hover:bg-gray-50 flex justify-between items-center"><div className="flex items-center gap-3">{statusFilter !== 'all' && (<input type="checkbox" checked={selectedIds.has(res.id)} onChange={() => toggleSelect(res.id)} className="w-4 h-4 rounded text-primary-600" />)}<div><p className="font-medium text-sm text-gray-800">{groupBy === 'item' ? res.customerName : res.offeringName} (x{res.quantity})</p><p className="text-xs text-gray-500">{new Date(res.createdAt).toLocaleTimeString('ar-SA')}</p></div></div><div className="flex items-center gap-3"><Badge status={res.status} /></div></div>))}</div></div>))}</div>)}</>)}</div>); };
const MyReservations = () => { const { userProfile } = useContext(AuthContext); const { showToast } = useContext(ToastContext); const { sendNotification } = useContext(NotificationContext); const [reservations, setReservations] = useState<Reservation[]>([]); const [loading, setLoading] = useState(true); const [dateFrom, setDateFrom] = useState(getSaudiDate()); const [dateTo, setDateTo] = useState(getSaudiDate()); const [statusFilter, setStatusFilter] = useState<string>('all'); const [searchQuery, setSearchQuery] = useState(''); const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({}); const fetchRes = async () => { if (!userProfile) return; setLoading(true); try { const q = query(collection(db, 'reservations'), where('customerId', '==', userProfile.uid)); const snap = await getDocs(q); setReservations(snap.docs.map(d => ({id: d.id, ...d.data()} as Reservation))); } catch(e) { showToast("فشل تحميل حجوزاتي", 'error'); } finally { setLoading(false); } }; useEffect(() => { fetchRes(); }, [userProfile]); const handleUpdatePaymentRef = async (id: string, providerId: string, offeringName: string) => { const val = paymentRefs[id]; if(!val) return; try { await updateDoc(doc(db, 'reservations', id), { paymentReference: val }); await sendNotification(providerId, 'تأكيد دفع جديد', `قام ${userProfile?.name} بإرسال رقم السند (${val}) لطلب ${offeringName}`, 'info'); showToast("تم إرسال رقم السند", "success"); fetchRes(); } catch(e) { showToast("فشل التحديث", "error"); } }; const cancelReservation = async (id: string, providerId: string, offeringName: string) => { if(!confirm("هل أنت متأكد من إلغاء الحجز؟")) return; try { await updateDoc(doc(db, 'reservations', id), { status: 'cancelled' }); await sendNotification(providerId, 'إلغاء حجز', `قام العميل بإلغاء حجز ${offeringName}`, 'warning'); showToast("تم إلغاء الحجز", "info"); fetchRes(); } catch(e) { showToast("فشل الإلغاء", "error"); } }; const filteredReservations = useMemo(() => { let res = reservations; const fromTs = new Date(dateFrom).setHours(0,0,0,0); const toTs = new Date(dateTo).setHours(23,59,59,999); res = res.filter(r => r.createdAt >= fromTs && r.createdAt <= toTs); if(statusFilter !== 'all') res = res.filter(r => r.status === statusFilter); if(searchQuery) res = res.filter(r => r.offeringName.includes(searchQuery)); return res.sort((a,b) => b.createdAt - a.createdAt); }, [reservations, statusFilter, searchQuery, dateFrom, dateTo]); if(loading) return <div className="p-6 max-w-4xl mx-auto space-y-4"><SkeletonCard /><SkeletonCard /></div>; return (<div className="p-4 md:p-6 max-w-4xl mx-auto min-h-screen"><div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6"><div><h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><ShoppingBagIcon className="w-8 h-8 text-primary-600"/> حجوزاتي</h1><p className="text-gray-500 text-sm mt-1">تابع حالة حجوزاتك وسجل المدفوعات</p></div><div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200"><CalendarDaysIcon className="w-5 h-5 text-gray-400" /><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm border-none focus:ring-0 text-gray-600 font-medium outline-none" /><span className="text-gray-400">-</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm border-none focus:ring-0 text-gray-600 font-medium outline-none" /></div></div><Card className="p-4 flex flex-col lg:flex-row gap-4 justify-between items-center mb-6 shadow-md"><div className="flex flex-1 w-full gap-4 flex-col sm:flex-row"><div className="relative flex-1"><MagnifyingGlassIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400" /><input type="text" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div><div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">{['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(st => (<button key={st} onClick={() => setStatusFilter(st)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${statusFilter === st ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>{st === 'all' ? 'الكل' : st}</button>))}</div></div></Card><div className="space-y-4">{filteredReservations.length === 0 ? <div className="text-center py-12 bg-white rounded-lg shadow-sm"><ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">لا توجد حجوزات</p></div> : filteredReservations.map(res => (<Card key={res.id} className="p-6"><div className="flex flex-col md:flex-row justify-between gap-6"><div className="flex-1"><div className="flex items-center justify-between mb-2"><h3 className="font-bold text-xl text-primary-800">{res.offeringName}</h3><Badge status={res.status} /></div><div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3"><span>الكمية: <b className="text-gray-900">{res.quantity}</b></span><span>الإجمالي: <b className="text-primary-700">{res.totalPrice} ر.ي</b></span><span className="text-gray-400">{new Date(res.createdAt).toLocaleDateString('ar-SA')}</span></div>{res.status === 'pending' && (<div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mt-2"><div className="flex items-center gap-2 mb-2"><BanknotesIcon className="w-5 h-5 text-orange-600"/><span className="font-bold text-sm text-orange-800">تأكيد الدفع</span></div>{res.paymentReference ? <div className="text-sm text-green-700 font-bold flex items-center gap-2"><CheckCircleIcon className="w-4 h-4"/> تم إرسال الرقم: {res.paymentReference}</div> : <div className="flex gap-2"><input type="text" placeholder="رقم السند / المحفظة" className="flex-1 border p-2 rounded text-sm outline-none focus:border-orange-400" value={paymentRefs[res.id] || ''} onChange={e => setPaymentRefs({...paymentRefs, [res.id]: e.target.value})} /><Button onClick={() => handleUpdatePaymentRef(res.id, res.providerId, res.offeringName)} className="bg-orange-500 hover:bg-orange-600 text-xs px-3">إرسال</Button></div>}</div>)}</div><div className="flex flex-col justify-center items-end border-t md:border-t-0 md:border-r md:pr-4 pt-4 md:pt-0 border-gray-100">{res.status === 'pending' && <button onClick={() => cancelReservation(res.id, res.providerId, res.offeringName)} className="text-red-500 text-sm hover:underline hover:text-red-700 font-medium">إلغاء</button>}{res.status === 'confirmed' && <div className="text-center"><div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold mb-1">مؤكد</div><p className="text-xs text-gray-400">يرجى الحضور في الموعد</p></div>}{res.status === 'completed' && <div className="flex items-center gap-1 text-green-600 font-bold text-sm"><CheckBadgeIcon className="w-5 h-5"/> مكتمل</div>}</div></div></Card>))}</div></div>); };

// --- REDESIGNED PROVIDER OFFERS ---
const ProviderOffers = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    
    // State
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [offers, setOffers] = useState<Offering[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'active' | 'upcoming' | 'ended'>('active');
    
    // Edit/Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
    const [selectedItemForOffer, setSelectedItemForOffer] = useState<CatalogItem | null>(null);
    const [newOfferData, setNewOfferData] = useState({ price: 0, quantity: 10, date: getSaudiDate() });
    const [itemSearch, setItemSearch] = useState('');

    // Fetch Data
    const loadData = async () => {
        if(!userProfile) return;
        setLoading(true);
        try {
            // Load Catalog Items
            const itemsSnap = await getDocs(query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid), where('isActive', '==', true)));
            setItems(itemsSnap.docs.map(d => ({id: d.id, ...d.data()} as CatalogItem)));
            
            // Load Offers (All)
            const offersSnap = await getDocs(query(collection(db, 'offerings'), where('providerId', '==', userProfile.uid)));
            setOffers(offersSnap.docs.map(d => ({id: d.id, ...d.data()} as Offering)));
        } catch(e) { console.error(e); showToast("خطأ في تحميل البيانات", "error"); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [userProfile]);

    // Keyboard Shortcut 'N'
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                openCreateModal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Helpers
    const getRecommendation = (offer: Offering) => {
        const sold = offer.quantityTotal - offer.quantityRemaining;
        const percent = (sold / offer.quantityTotal) * 100;
        const daysDiff = (new Date(offer.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
        
        if (percent >= 80) return { text: "أداء ممتاز! ننصح بزيادة الكمية", color: "text-green-600 bg-green-50" };
        if (percent <= 20 && daysDiff < 2 && daysDiff > -1) return { text: "المبيعات منخفضة، جرب تخفيض السعر", color: "text-orange-600 bg-orange-50" };
        if (offer.quantityRemaining === 0) return { text: "نفذت الكمية، هل تود التجديد؟", color: "text-blue-600 bg-blue-50" };
        return null;
    };

    // Derived Data
    const stats = useMemo(() => {
        const totalActive = offers.filter(o => o.isActive && o.quantityRemaining > 0).length;
        const totalSold = offers.reduce((acc, o) => acc + (o.quantityTotal - o.quantityRemaining), 0);
        const totalRevenue = offers.reduce((acc, o) => acc + ((o.quantityTotal - o.quantityRemaining) * o.price), 0);
        return { totalActive, totalSold, totalRevenue };
    }, [offers]);

    const counts = useMemo(() => {
        const today = getSaudiDate();
        return {
            active: offers.filter(o => o.isActive && o.quantityRemaining > 0 && o.date <= today).length,
            upcoming: offers.filter(o => o.date > today).length,
            ended: offers.filter(o => !o.isActive || o.quantityRemaining === 0).length
        }
    }, [offers]);

    const filteredOffers = useMemo(() => {
        const today = getSaudiDate();
        return offers.filter(o => {
            if (filterStatus === 'active') return o.isActive && o.quantityRemaining > 0 && o.date <= today;
            if (filterStatus === 'upcoming') return o.date > today;
            if (filterStatus === 'ended') return !o.isActive || o.quantityRemaining === 0;
            return true;
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [offers, filterStatus]);

    const filteredItemsForSelection = useMemo(() => {
        return items.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()));
    }, [items, itemSearch]);

    // Handlers
    const openCreateModal = () => {
        setEditingOfferId(null);
        setSelectedItemForOffer(null);
        setNewOfferData({ price: 0, quantity: 10, date: getSaudiDate() });
        setIsCreateModalOpen(true);
    };

    const handleEditOffer = (offer: Offering) => {
        const linkedItem = items.find(i => i.id === offer.itemId);
        if (linkedItem) setSelectedItemForOffer(linkedItem);
        setNewOfferData({ price: offer.price, quantity: offer.quantityTotal, date: offer.date });
        setEditingOfferId(offer.id);
        setIsCreateModalOpen(true);
    };

    const handleSaveOffer = async () => {
        if(!userProfile || !selectedItemForOffer) return;
        try {
            const payload = {
                itemId: selectedItemForOffer.id, 
                providerId: userProfile.uid, 
                itemName: selectedItemForOffer.name, 
                itemImageUrl: selectedItemForOffer.imageUrl, 
                price: Number(newOfferData.price), 
                quantityTotal: Number(newOfferData.quantity), 
                quantityRemaining: editingOfferId 
                    ? Number(newOfferData.quantity) - (offers.find(o=>o.id===editingOfferId)?.quantityTotal! - offers.find(o=>o.id===editingOfferId)?.quantityRemaining!) 
                    : Number(newOfferData.quantity),
                date: newOfferData.date, 
                isActive: true 
            };

            if (editingOfferId) {
                await updateDoc(doc(db, 'offerings', editingOfferId), payload);
                showToast("تم تحديث العرض", "success");
            } else {
                await addDoc(collection(db, 'offerings'), payload);
                showToast("تم نشر العرض بنجاح", "success");
            }
            setIsCreateModalOpen(false);
            loadData();
        } catch(e) { showToast("خطأ في العملية", "error"); console.error(e); }
    };

    const handleToggleStatus = async (offer: Offering) => {
        const newStatus = !offer.isActive;
        // Optimization: Optimistic UI Update
        setOffers(prev => prev.map(o => o.id === offer.id ? {...o, isActive: newStatus} : o));
        try {
            await updateDoc(doc(db, 'offerings', offer.id), { isActive: newStatus });
            showToast(newStatus ? "تم تفعيل العرض" : "تم إيقاف العرض", "info");
        } catch(e) { 
            // Revert on error
            setOffers(prev => prev.map(o => o.id === offer.id ? {...o, isActive: !newStatus} : o));
            showToast("خطأ في التحديث", "error"); 
        }
    };

    const handleDeleteOffer = async (id: string) => {
        if(!confirm("حذف العرض نهائياً؟ لا يمكن التراجع.")) return;
        try {
            await deleteDoc(doc(db, 'offerings', id));
            setOffers(prev => prev.filter(o => o.id !== id));
            showToast("تم الحذف", "success");
        } catch(e) { showToast("خطأ", "error"); }
    };

    // Sub-components
    const StatBadge = ({label, value, icon, color, trend}: any) => (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow cursor-pointer group min-w-[160px]">
            <div>
                <p className="text-gray-500 text-xs font-bold mb-1">{label}</p>
                <h3 className="text-2xl font-extrabold text-gray-800">{value}</h3>
                {trend && <p className={`text-[10px] font-bold mt-1 ${trend.includes('+') ? 'text-green-600' : 'text-red-500'}`}>{trend}</p>}
            </div>
            <div className={`p-3 rounded-xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform`}>{icon}</div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen space-y-8">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><CalendarIcon className="w-8 h-8 text-primary-600"/> إدارة العروض والمواعيد</h1>
                    <p className="text-gray-500 mt-2">تحكم كامل في مواعيدك وعروضك المتاحة للعملاء</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    <StatBadge label="عروض نشطة" value={stats.totalActive} icon={<BoltIcon className="w-5 h-5"/>} color="bg-orange-500" trend="+ نشط حالياً" />
                    <StatBadge label="مبيعات العروض" value={stats.totalSold} icon={<FireIcon className="w-5 h-5"/>} color="bg-red-500" trend="إجمالي المباع" />
                    <StatBadge label="الإيرادات المتوقعة" value={`${stats.totalRevenue.toLocaleString()}`} icon={<BanknotesIcon className="w-5 h-5"/>} color="bg-green-600" trend="من العروض الحالية" />
                </div>
            </div>

            {/* Controls Bar */}
            <Card className="p-2 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-20 z-30 shadow-md backdrop-blur-md bg-white/90">
                <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                    {['active', 'upcoming', 'ended'].map(status => (
                        <button key={status} onClick={() => setFilterStatus(status as any)} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${filterStatus === status ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {status === 'active' ? 'نشطة' : status === 'upcoming' ? 'قادمة' : 'منتهية'}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filterStatus === status ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>
                                {counts[status as keyof typeof counts]}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="w-full sm:w-auto flex gap-2" title="اختصار: اضغط N">
                    <Button onClick={openCreateModal} className="w-full sm:w-auto shadow-lg shadow-primary-500/30 font-bold"><PlusIcon className="w-5 h-5"/> إنشاء عرض جديد</Button>
                </div>
            </Card>

            {/* Offers Grid */}
            {loading ? <div className="grid grid-cols-3 gap-4"><SkeletonCard/><SkeletonCard/><SkeletonCard/></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    {filteredOffers.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-center">
                            <div className="bg-primary-50 p-6 rounded-full mb-4"><SparklesIcon className="w-12 h-12 text-primary-400"/></div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">لا توجد عروض في هذه القائمة</h3>
                            <p className="text-gray-500 mb-6 max-w-md">ابدأ بإضافة عروض جديدة لجذب العملاء وزيادة مبيعاتك.</p>
                            <Button onClick={openCreateModal} variant="outline">إنشاء عرض الآن</Button>
                        </div>
                    )}
                    {filteredOffers.map(offer => {
                        const sold = offer.quantityTotal - offer.quantityRemaining;
                        const percentSold = (sold / offer.quantityTotal) * 100;
                        const recommendation = getRecommendation(offer);
                        
                        // Progress bar color logic
                        let progressColor = "bg-primary-500";
                        if (percentSold > 80) progressColor = "bg-green-500";
                        else if (percentSold < 20) progressColor = "bg-red-400";
                        else progressColor = "bg-orange-400";

                        return (
                            <div key={offer.id} className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col relative">
                                {/* Status Badge */}
                                <div className="absolute top-3 left-3 z-10 flex gap-2">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md ${offer.isActive ? 'bg-white/90 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {offer.isActive ? (offer.quantityRemaining === 0 ? 'نفذت الكمية' : 'نشط') : 'متوقف'}
                                    </span>
                                </div>

                                {/* Image & Header */}
                                <div className="h-48 bg-gray-100 relative overflow-hidden">
                                    <img src={offer.itemImageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={offer.itemName} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent"></div>
                                    <div className="absolute bottom-4 right-4 text-white">
                                        <h3 className="font-bold text-lg leading-tight shadow-black drop-shadow-md mb-1">{offer.itemName}</h3>
                                        <div className="flex items-center gap-3 text-xs opacity-90 font-medium">
                                            <span className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded-lg backdrop-blur-sm"><CalendarIcon className="w-3 h-3"/> {offer.date}</span>
                                            <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm text-white"><CurrencyDollarIcon className="w-3 h-3"/> {offer.price} ر.ي</span>
                                        </div>
                                    </div>
                                    {/* Action Menu (Hover) */}
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                                        <button onClick={() => handleEditOffer(offer)} className="p-2 bg-white/90 rounded-full shadow-md text-gray-700 hover:text-primary-600 hover:bg-white transition-colors" title="تعديل"><PencilSquareIcon className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteOffer(offer.id)} className="p-2 bg-white/90 rounded-full shadow-md text-gray-700 hover:text-red-600 hover:bg-white transition-colors" title="حذف"><TrashIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-5 flex-1 flex flex-col gap-4">
                                    {/* Smart Recommendation */}
                                    {recommendation && (
                                        <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 font-bold ${recommendation.color}`}>
                                            <LightBulbIcon className="w-4 h-4"/> {recommendation.text}
                                        </div>
                                    )}

                                    {/* Stats Bar */}
                                    <div>
                                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                                            <span>تم بيع <span className="text-gray-900 text-sm">{sold}</span> من {offer.quantityTotal}</span>
                                            <span className={`${offer.quantityRemaining < 3 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>متبقي {offer.quantityRemaining}</span>
                                        </div>
                                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                            <div className={`h-full rounded-full transition-all duration-1000 ${progressColor}`} style={{ width: `${percentSold}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="mt-auto pt-2">
                                        <button onClick={() => handleToggleStatus(offer)} className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border ${offer.isActive ? 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-orange-600' : 'bg-primary-600 text-white shadow-md hover:bg-primary-700 border-transparent'}`}>
                                            {offer.isActive ? <><EyeSlashIcon className="w-4 h-4"/> إيقاف مؤقت</> : <><EyeIcon className="w-4 h-4"/> تفعيل العرض</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={editingOfferId ? "تعديل العرض" : "نشر عرض جديد"}>
                {!selectedItemForOffer ? (
                    // Step 1: Select Item
                    <div className="space-y-4">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400"/>
                            <input type="text" placeholder="ابحث عن صنف..." className="w-full pr-10 pl-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50" value={itemSearch} onChange={e => setItemSearch(e.target.value)} autoFocus />
                        </div>
                        <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                            {filteredItemsForSelection.map(item => (
                                <div key={item.id} onClick={() => { setSelectedItemForOffer(item); setNewOfferData({...newOfferData, price: item.priceDefault}); }} className="cursor-pointer border border-gray-200 rounded-xl p-3 hover:border-primary-500 hover:bg-primary-50 transition-all flex flex-col items-center text-center gap-2 group">
                                    <img src={item.imageUrl} className="w-16 h-16 rounded-lg object-cover bg-gray-200" alt="" />
                                    <div>
                                        <p className="font-bold text-sm text-gray-800 line-clamp-1">{item.name}</p>
                                        <p className="text-xs text-primary-600 font-medium">{item.priceDefault} ر.ي</p>
                                    </div>
                                </div>
                            ))}
                            {filteredItemsForSelection.length === 0 && <p className="col-span-2 text-center text-gray-400 py-4">لا توجد أصناف مطابقة. أضف أصنافاً للكتالوج أولاً.</p>}
                        </div>
                    </div>
                ) : (
                    // Step 2: Configure Offer
                    <div className="space-y-5 animate-slide-up">
                        <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <img src={selectedItemForOffer.imageUrl} className="w-16 h-16 rounded-lg object-cover" alt="" />
                            <div>
                                <h4 className="font-bold text-gray-800">{selectedItemForOffer.name}</h4>
                                <button onClick={() => setSelectedItemForOffer(null)} className="text-xs text-primary-600 font-medium hover:underline">تغيير الصنف</button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">سعر العرض</label>
                                <div className="relative">
                                    <input type="number" className="w-full pl-10 pr-4 py-3 border rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-primary-500 outline-none" value={newOfferData.price || ''} onChange={e => setNewOfferData({...newOfferData, price: Number(e.target.value)})} />
                                    <div className="absolute left-3 top-3.5 text-gray-400 text-xs font-bold">ر.ي</div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">الكمية الكلية</label>
                                <input type="number" className="w-full px-4 py-3 border rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-primary-500 outline-none" value={newOfferData.quantity} onChange={e => setNewOfferData({...newOfferData, quantity: Number(e.target.value)})} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ العرض / الموعد</label>
                            <input type="date" className="w-full px-4 py-3 border rounded-xl text-gray-800 focus:ring-2 focus:ring-primary-500 outline-none" value={newOfferData.date} onChange={e => setNewOfferData({...newOfferData, date: e.target.value})} />
                        </div>

                        <Button onClick={handleSaveOffer} className="w-full py-3 text-lg shadow-lg shadow-primary-500/30">
                            {editingOfferId ? "حفظ التعديلات" : "نشر العرض فوراً"}
                        </Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// --- Missing Components ---
const CustomerHome = () => <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500"><ShoppingBagIcon className="w-16 h-16 mb-4 opacity-50"/> <h2 className="text-xl font-bold">مرحباً بك في حجزي</h2><p>استعرض العروض من القائمة</p></div>;
const ProvidersList = () => <div className="p-8"><h2 className="text-2xl font-bold mb-4">مقدمو الخدمة</h2><p className="text-gray-500">قائمة المتاجر ستظهر هنا</p></div>;

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: UserRole[] }) => {
    const { currentUser, userProfile, loading } = useContext(AuthContext);
    if (loading) return <LoadingSpinner />;
    if (!currentUser) return <Navigate to="/login" />;
    if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
        return <div className="p-8 text-center text-red-500 font-bold">عذراً، ليس لديك صلاحية الوصول لهذه الصفحة</div>;
    }
    return <>{children}</>;
};

const App = () => {
    return (
        <ToastProvider>
            <AuthProvider>
                <NotificationProvider>
                    <HashRouter>
                        <Navbar />
                        <div className="bg-gray-50 min-h-screen pb-20">
                            <Routes>
                                <Route path="/" element={<CustomerHome />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/providers" element={<ProvidersList />} />
                                
                                <Route path="/provider/dashboard" element={<ProtectedRoute allowedRoles={['provider']}><ProviderDashboard /></ProtectedRoute>} />
                                <Route path="/provider/reservations" element={<ProtectedRoute allowedRoles={['provider']}><ProviderReservations /></ProtectedRoute>} />
                                <Route path="/provider/offers" element={<ProtectedRoute allowedRoles={['provider']}><ProviderOffers /></ProtectedRoute>} />
                                <Route path="/provider/catalog" element={<ProtectedRoute allowedRoles={['provider']}><ProviderOffers /></ProtectedRoute>} />
                                
                                <Route path="/my-reservations" element={<ProtectedRoute allowedRoles={['customer']}><MyReservations /></ProtectedRoute>} />
                            </Routes>
                        </div>
                    </HashRouter>
                </NotificationProvider>
            </AuthProvider>
        </ToastProvider>
    );
};

export default App;