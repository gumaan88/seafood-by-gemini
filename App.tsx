import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
// Mock Router to replace missing react-router-dom
const RouterContext = createContext({ path: window.location.hash.substring(1) || '/' });

const HashRouter: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [path, setPath] = useState(window.location.hash.substring(1) || '/');
    useEffect(() => {
        const handler = () => {
            window.scrollTo(0, 0); // Reset scroll on route change
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

import { 
    auth, db, uploadFile,
    onAuthStateChanged, User, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser,
    doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, increment, serverTimestamp, orderBy 
} from './services/firebase';

import { UserProfile, UserRole, CatalogItem, Offering, Reservation, ProviderProfile, ReservationStatus } from './types';
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
  FunnelIcon
} from '@heroicons/react/24/outline';

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
                        t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-sea-600'
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
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              setUserProfile(userDoc.data() as UserProfile);
            }
        } catch (e) {
            console.error("Error fetching profile:", e);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    window.location.hash = '/login';
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// --- UI Components ---

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-full min-h-[50vh]">
    <div className="relative">
        <div className="w-12 h-12 rounded-full absolute border-4 border-solid border-gray-200"></div>
        <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-solid border-sea-600 border-t-transparent"></div>
    </div>
  </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'outline', isLoading?: boolean }> = ({ 
    children, className = '', variant = 'primary', isLoading, disabled, ...props 
}) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-2";
    const variants = {
        primary: "bg-sea-600 hover:bg-sea-700 text-white shadow-md hover:shadow-lg disabled:bg-gray-300",
        secondary: "bg-teal-500 hover:bg-teal-600 text-white shadow-md hover:shadow-lg disabled:bg-gray-300",
        danger: "bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg disabled:bg-gray-300",
        outline: "border-2 border-sea-600 text-sea-600 hover:bg-sea-50 disabled:border-gray-300 disabled:text-gray-300"
    };

    return (
        <button 
            className={`${baseStyle} ${variants[variant]} ${className}`} 
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>}
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

const Navbar = () => {
  const { userProfile, logout } = useContext(AuthContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-gradient-to-r from-sea-900 to-sea-700 text-white shadow-lg sticky top-0 z-50 backdrop-blur-sm bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-2xl font-bold font-sans flex items-center gap-2 hover:opacity-90 transition-opacity">
               <span className="text-3xl">🐟</span> 
               <span>صيد البحر</span>
            </Link>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4 space-x-reverse">
              {userProfile ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/20">
                    <UserGroupIcon className="w-5 h-5 text-sea-200" />
                    <span className="text-sm font-medium">{userProfile.name}</span>
                  </div>

                  {userProfile.role === 'provider' && (
                    <>
                      <Link to="/provider/dashboard" className="nav-link">لوحة التحكم</Link>
                      <Link to="/provider/catalog" className="nav-link">الكتالوج</Link>
                      <Link to="/provider/offers" className="nav-link">العروض</Link>
                      <Link to="/provider/reservations" className="nav-link">الحجوزات</Link>
                    </>
                  )}
                  {userProfile.role === 'customer' && (
                    <>
                      <Link to="/" className="nav-link">العروض اليومية</Link>
                      <Link to="/providers" className="nav-link">مقدمو الخدمة</Link>
                      <Link to="/my-reservations" className="nav-link">طلباتي</Link>
                    </>
                  )}
                  <button onClick={logout} className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full transition-colors" title="تسجيل الخروج">
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="nav-link">دخول</Link>
                  <Link to="/register" className="bg-white text-sea-800 hover:bg-sea-50 px-4 py-2 rounded-lg font-bold transition-all shadow-md transform hover:-translate-y-0.5">
                    حساب جديد
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="-mr-2 flex md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="bg-sea-800 p-2 rounded-md text-gray-200 hover:text-white focus:outline-none">
              {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-sea-800 border-t border-sea-700 animate-fade-in">
          <div className="px-4 pt-2 pb-6 space-y-2">
             {userProfile ? (
                <>
                  <div className="text-sea-200 px-3 py-3 border-b border-sea-700 mb-2">مرحباً، {userProfile.name}</div>
                  {userProfile.role === 'provider' && (
                    <>
                      <Link to="/provider/dashboard" className="block mobile-nav-link">لوحة التحكم</Link>
                      <Link to="/provider/catalog" className="block mobile-nav-link">الكتالوج</Link>
                      <Link to="/provider/offers" className="block mobile-nav-link">العروض</Link>
                      <Link to="/provider/reservations" className="block mobile-nav-link">الحجوزات</Link>
                    </>
                  )}
                  {userProfile.role === 'customer' && (
                    <>
                      <Link to="/" className="block mobile-nav-link">العروض اليومية</Link>
                      <Link to="/providers" className="block mobile-nav-link">مقدمو الخدمة</Link>
                      <Link to="/my-reservations" className="block mobile-nav-link">طلباتي</Link>
                    </>
                  )}
                  <button onClick={logout} className="w-full text-right block bg-red-600/90 text-white px-3 py-3 rounded-md mt-4">
                    تسجيل خروج
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="block mobile-nav-link">دخول</Link>
                  <Link to="/register" className="block bg-sea-500 text-white px-3 py-3 rounded-md mt-2 font-bold">حساب جديد</Link>
                </>
              )}
          </div>
        </div>
      )}
    </nav>
  );
};

// --- Auth Pages ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useContext(ToastContext);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('تم تسجيل الدخول بنجاح', 'success');
      window.location.hash = '/';
    } catch (err: any) {
      console.error(err);
      let msg = "حدث خطأ أثناء تسجيل الدخول";
      if (err.code === 'auth/invalid-credential') msg = "البيانات غير صحيحة";
      showToast(msg, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-sea-50">
      <Card className="max-w-md w-full p-8 space-y-8 animate-slide-up border-t-4 border-t-sea-500">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-sea-900">تسجيل الدخول</h2>
          <p className="mt-2 text-center text-sm text-gray-600">أهلاً بك مجدداً في صيد البحر</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <input type="email" required className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-sea-500 focus:border-sea-500 focus:z-10 sm:text-sm" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" required className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-sea-500 focus:border-sea-500 focus:z-10 sm:text-sm" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" isLoading={loading} className="w-full py-3">دخول</Button>
          <div className="text-sm text-center">
            <Link to="/register" className="font-medium text-sea-600 hover:text-sea-500 transition-colors">
              ليس لديك حساب؟ <span className="underline">سجل الآن</span>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', role: 'customer' as UserRole });
  const [loading, setLoading] = useState(false);
  const { showToast } = useContext(ToastContext);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let userToDelete: User | null = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      userToDelete = userCredential.user;

      const newUser: UserProfile = {
        uid: userCredential.user.uid,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        phone: formData.phone,
        createdAt: Date.now(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);

      if (formData.role === 'provider') {
        const newProvider: ProviderProfile = {
            providerId: userCredential.user.uid,
            name: formData.name,
            description: "طباخ ماهر يقدم أشهى المأكولات البحرية",
            followersCount: 0
        }
        await setDoc(doc(db, 'providers', userCredential.user.uid), newProvider);
      }
      
      showToast('تم إنشاء الحساب بنجاح', 'success');
      window.location.hash = '/';

    } catch (err: any) {
      console.error(err);
      let msg = "فشل التسجيل";
      if (err.code === 'auth/email-already-in-use') msg = "البريد الإلكتروني مستخدم مسبقاً";
      showToast(msg, 'error');
      if (userToDelete) try { await deleteUser(userToDelete); } catch {}
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-sea-50">
      <Card className="max-w-md w-full p-8 space-y-8 animate-slide-up border-t-4 border-t-sea-500">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-sea-900">حساب جديد</h2>
        </div>
        <form className="mt-8 space-y-4" onSubmit={handleRegister}>
          <div className="space-y-3">
            <input type="text" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sea-500 focus:outline-none" placeholder="الاسم الكامل" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            <input type="email" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sea-500 focus:outline-none" placeholder="البريد الإلكتروني" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            <input type="password" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sea-500 focus:outline-none" placeholder="كلمة المرور (6 أحرف على الأقل)" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
            <input type="tel" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sea-500 focus:outline-none" placeholder="رقم الهاتف" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div 
                onClick={() => setFormData({...formData, role: 'customer'})}
                className={`cursor-pointer p-4 rounded-lg border-2 text-center transition-all ${formData.role === 'customer' ? 'border-sea-600 bg-sea-50 text-sea-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-sea-300'}`}
            >
                <div>🍽️</div>
                <div className="text-sm mt-1">عميل</div>
            </div>
            <div 
                onClick={() => setFormData({...formData, role: 'provider'})}
                className={`cursor-pointer p-4 rounded-lg border-2 text-center transition-all ${formData.role === 'provider' ? 'border-sea-600 bg-sea-50 text-sea-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-sea-300'}`}
            >
                <div>👨‍🍳</div>
                <div className="text-sm mt-1">مقدم خدمة</div>
            </div>
          </div>

          <Button type="submit" isLoading={loading} className="w-full py-3 mt-6">تسجيل</Button>
          <div className="text-sm text-center">
            <Link to="/login" className="font-medium text-sea-600 hover:text-sea-500">
              لديك حساب؟ سجل دخول
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};

// --- Provider Logic & UI ---

const ProviderDashboard = () => {
  const { userProfile } = useContext(AuthContext);
  const [stats, setStats] = useState({ items: 0, offers: 0, reservations: 0, revenue: 0, followers: 0 });

  useEffect(() => {
    const fetchStats = async () => {
        if (!userProfile) return;
        try {
            const itemsSnap = await getDocs(query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid)));
            const offersSnap = await getDocs(query(collection(db, 'offerings'), where('providerId', '==', userProfile.uid), where('isActive', '==', true)));
            const resSnap = await getDocs(query(collection(db, 'reservations'), where('providerId', '==', userProfile.uid)));
            
            let rev = 0;
            resSnap.forEach(doc => {
                const data = doc.data() as Reservation;
                if(data.status === 'completed') rev += data.totalPrice;
            });

            const providerDoc = await getDoc(doc(db, 'providers', userProfile.uid));
            const followers = providerDoc.exists() ? (providerDoc.data() as ProviderProfile).followersCount : 0;

            setStats({ items: itemsSnap.size, offers: offersSnap.size, reservations: resSnap.size, revenue: rev, followers });
        } catch (e) {
            console.error(e);
        }
    };
    fetchStats();
  }, [userProfile]);

  const StatCard = ({ title, value, color, icon }: any) => (
      <Card className="p-6 flex items-center justify-between border-l-4" style={{ borderLeftColor: color }}>
        <div>
            <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
        </div>
        <div className="p-3 rounded-full bg-gray-50 text-gray-600">{icon}</div>
      </Card>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">لوحة التحكم</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="الأصناف" value={stats.items} color="#3b82f6" icon={<ShoppingBagIcon className="w-6 h-6"/>} />
        <StatCard title="العروض النشطة" value={stats.offers} color="#10b981" icon={<CalendarIcon className="w-6 h-6"/>} />
        <StatCard title="الطلبات" value={stats.reservations} color="#f59e0b" icon={<ClipboardDocumentCheckIcon className="w-6 h-6"/>} />
        <StatCard title="الإيرادات" value={`${stats.revenue.toLocaleString()} ر.س`} color="#8b5cf6" icon={<CurrencyDollarIcon className="w-6 h-6"/>} />
      </div>
    </div>
  );
};

const ProviderReservations = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReservations = async () => {
        if(!userProfile) return;
        try {
            const q = query(collection(db, 'reservations'), where('providerId', '==', userProfile.uid), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setReservations(snap.docs.map(d => ({id: d.id, ...d.data()} as Reservation)));
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReservations(); }, [userProfile]);

    const updateStatus = async (id: string, status: ReservationStatus) => {
        try {
            await updateDoc(doc(db, 'reservations', id), { status });
            showToast(`تم تحديث الحالة إلى: ${status === 'confirmed' ? 'مؤكد' : status === 'completed' ? 'مكتمل' : 'ملغي'}`, 'success');
            fetchReservations();
        } catch (e) {
            showToast("حدث خطأ أثناء التحديث", 'error');
        }
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">إدارة الحجوزات</h1>
            
            {reservations.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                    <ClipboardDocumentCheckIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">لا توجد حجوزات حتى الآن</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {reservations.map(res => (
                        <Card key={res.id} className="p-6 flex flex-col md:flex-row justify-between gap-6 hover:border-sea-200">
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between md:justify-start gap-4">
                                    <h3 className="text-xl font-bold text-gray-900">{res.offeringName}</h3>
                                    <Badge status={res.status} />
                                </div>
                                <div className="text-gray-600 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <UserGroupIcon className="w-4 h-4" /> العميل: <span className="font-semibold">{res.customerName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ShoppingBagIcon className="w-4 h-4" /> الكمية: {res.quantity} | الإجمالي: <span className="text-sea-700 font-bold">{res.totalPrice} ر.س</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <ClockIcon className="w-4 h-4" /> {new Date(res.createdAt).toLocaleDateString('ar-SA')} {new Date(res.createdAt).toLocaleTimeString('ar-SA')}
                                    </div>
                                </div>
                                
                                {res.paymentProofUrl && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between max-w-sm">
                                        <span className="text-sm text-gray-600 flex items-center gap-2"><CheckCircleIcon className="w-5 h-5 text-green-500"/> تم رفع إيصال الدفع</span>
                                        <a href={res.paymentProofUrl} target="_blank" rel="noreferrer" className="text-sea-600 text-sm font-bold hover:underline">عرض الصورة</a>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col justify-center gap-3 md:w-48 border-t md:border-t-0 md:border-r border-gray-100 pt-4 md:pt-0 md:pr-4">
                                {res.status === 'pending' && (
                                    <>
                                        <Button onClick={() => updateStatus(res.id, 'confirmed')} variant="secondary" className="w-full">تأكيد الطلب</Button>
                                        <Button onClick={() => updateStatus(res.id, 'cancelled')} variant="danger" className="w-full">رفض/إلغاء</Button>
                                    </>
                                )}
                                {res.status === 'confirmed' && (
                                    <Button onClick={() => updateStatus(res.id, 'completed')} className="w-full bg-green-600 hover:bg-green-700">إتمام الطلب</Button>
                                )}
                                {res.status === 'completed' && (
                                    <div className="text-center text-green-600 font-bold flex items-center justify-center gap-1">
                                        <CheckCircleIcon className="w-6 h-6" /> مكتمل
                                    </div>
                                )}
                                {res.status === 'cancelled' && (
                                    <div className="text-center text-gray-400 font-medium">ملغي</div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// ... (Use similar improvements for Catalog and Offers - omitted for brevity but following same UI pattern) ...
// Instead of omitting, I will include optimized versions of ProviderCatalog and ProviderOffers

const ProviderCatalog = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [newItem, setNewItem] = useState({ name: '', description: '', price: 0, category: 'سمك' });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const fetchItems = async () => {
        if(!userProfile) return;
        const q = query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid));
        const snapshot = await getDocs(q);
        setItems(snapshot.docs.map(d => ({id: d.id, ...d.data()} as CatalogItem)));
    };

    useEffect(() => { fetchItems(); }, [userProfile]);

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);
        try {
            let imageUrl = `https://placehold.co/400x400/e2e8f0/1e293b?text=${encodeURIComponent(newItem.name)}`;
            if (imageFile && userProfile) {
                imageUrl = await uploadFile(imageFile, `items/${userProfile.uid}/${Date.now()}_${imageFile.name}`);
            }

            if(userProfile) {
                await addDoc(collection(db, 'catalogItems'), {
                    providerId: userProfile.uid,
                    name: newItem.name,
                    description: newItem.description,
                    priceDefault: Number(newItem.price),
                    category: newItem.category,
                    imageUrl,
                    isActive: true
                });
            }
            showToast("تم إضافة الصنف بنجاح", "success");
            setNewItem({ name: '', description: '', price: 0, category: 'سمك' });
            setImageFile(null);
            fetchItems();
        } catch (error) {
            showToast("حدث خطأ أثناء الإضافة", "error");
        }
        setUploading(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
             <h1 className="text-3xl font-bold mb-8 text-gray-800">الكتالوج</h1>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form */}
                <Card className="p-6 h-fit lg:col-span-1">
                    <h3 className="font-bold text-xl mb-4 text-sea-800 flex items-center gap-2">
                        <PlusIcon className="w-6 h-6"/> إضافة صنف جديد
                    </h3>
                    <form onSubmit={handleAddItem} className="space-y-4">
                        <input type="text" placeholder="اسم الوجبة / الصنف" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-sea-500 outline-none" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                        <div className="grid grid-cols-2 gap-2">
                            <input type="number" placeholder="السعر" required className="w-full border p-3 rounded-lg outline-none" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} />
                            <select className="w-full border p-3 rounded-lg outline-none bg-white" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                                <option value="سمك">سمك</option>
                                <option value="جمبري">جمبري</option>
                                <option value="سلطعون">سلطعون</option>
                                <option value="آخر">آخر</option>
                            </select>
                        </div>
                        <textarea placeholder="وصف المكونات والطعم..." className="w-full border p-3 rounded-lg outline-none" rows={3} value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})}></textarea>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">صورة الصنف</label>
                            <input type="file" accept="image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sea-50 file:text-sea-700 hover:file:bg-sea-100" onChange={e => setImageFile(e.target.files ? e.target.files[0] : null)} />
                        </div>
                        <Button type="submit" isLoading={uploading} className="w-full">حفظ في الكتالوج</Button>
                    </form>
                </Card>

                {/* List */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {items.filter(i => i.isActive).map(item => (
                        <Card key={item.id} className="group relative">
                            <div className="h-48 overflow-hidden bg-gray-100">
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-sm font-bold text-sea-800 shadow-sm">
                                    {item.priceDefault} ر.س
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-lg text-gray-800">{item.name}</h3>
                                <p className="text-gray-500 text-sm mt-1 line-clamp-2">{item.description}</p>
                                <div className="mt-3 flex justify-between items-center">
                                    <span className="bg-sea-50 text-sea-700 text-xs px-2 py-1 rounded-full">{item.category}</span>
                                    <button 
                                        onClick={async () => {
                                            if(confirm('حذف الصنف؟')) {
                                                await updateDoc(doc(db, 'catalogItems', item.id), { isActive: false });
                                                fetchItems();
                                            }
                                        }} 
                                        className="text-red-400 hover:text-red-600 p-1"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
             </div>
        </div>
    );
};

const ProviderOffers = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [offers, setOffers] = useState<Offering[]>([]);
    const [selectedItem, setSelectedItem] = useState('');
    const [offerData, setOfferData] = useState({ price: 0, quantity: 10, date: new Date().toISOString().split('T')[0] });

    useEffect(() => {
        if(!userProfile) return;
        const load = async () => {
            const itemsSnap = await getDocs(query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid), where('isActive', '==', true)));
            setItems(itemsSnap.docs.map(d => ({id: d.id, ...d.data()} as CatalogItem)));
            
            const offersSnap = await getDocs(query(collection(db, 'offerings'), where('providerId', '==', userProfile.uid)));
            setOffers(offersSnap.docs.map(d => ({id: d.id, ...d.data()} as Offering)));
        };
        load();
    }, [userProfile]);

    const handleCreateOffer = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!userProfile || !selectedItem) return;
        const item = items.find(i => i.id === selectedItem);
        if(!item) return;

        try {
            await addDoc(collection(db, 'offerings'), {
                itemId: item.id,
                providerId: userProfile.uid,
                itemName: item.name,
                itemImageUrl: item.imageUrl,
                price: Number(offerData.price),
                quantityTotal: Number(offerData.quantity),
                quantityRemaining: Number(offerData.quantity),
                date: offerData.date,
                isActive: true
            });
            showToast("تم نشر العرض بنجاح", "success");
            // Refresh logic omitted for brevity, simpler to just append or re-fetch
            const offersSnap = await getDocs(query(collection(db, 'offerings'), where('providerId', '==', userProfile.uid)));
            setOffers(offersSnap.docs.map(d => ({id: d.id, ...d.data()} as Offering)));
        } catch(e) {
            showToast("خطأ في النشر", "error");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">نشر العروض اليومية</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="p-6 h-fit lg:col-span-1 border-t-4 border-t-green-500">
                     <h3 className="font-bold text-xl mb-4 text-green-700 flex items-center gap-2">
                        <CalendarIcon className="w-6 h-6"/> عرض جديد
                    </h3>
                    <form onSubmit={handleCreateOffer} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">اختر الوجبة من الكتالوج</label>
                            <select className="w-full border p-3 rounded-lg outline-none bg-white" required value={selectedItem} onChange={e => {
                                setSelectedItem(e.target.value);
                                const i = items.find(x => x.id === e.target.value);
                                if(i) setOfferData({...offerData, price: i.priceDefault});
                            }}>
                                <option value="">-- اختر --</option>
                                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">سعر العرض</label>
                                <input type="number" required className="w-full border p-3 rounded-lg outline-none" value={offerData.price || ''} onChange={e => setOfferData({...offerData, price: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية</label>
                                <input type="number" required className="w-full border p-3 rounded-lg outline-none" value={offerData.quantity} onChange={e => setOfferData({...offerData, quantity: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ العرض</label>
                            <input type="date" required className="w-full border p-3 rounded-lg outline-none" value={offerData.date} onChange={e => setOfferData({...offerData, date: e.target.value})} />
                        </div>
                        <Button type="submit" variant="secondary" className="w-full bg-green-600 hover:bg-green-700">نشر الآن</Button>
                    </form>
                </Card>

                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-bold text-gray-600">سجل العروض</h3>
                    {offers.map(offer => (
                        <div key={offer.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center transition-transform hover:translate-x-1">
                            <div className="flex items-center gap-4">
                                 <img src={offer.itemImageUrl} className="w-16 h-16 rounded-lg object-cover shadow-sm" alt="" />
                                 <div>
                                    <div className="font-bold text-gray-800">{offer.itemName}</div>
                                    <div className="text-sm text-gray-500 flex items-center gap-2">
                                        <CalendarIcon className="w-4 h-4"/> {offer.date}
                                        <span className="bg-gray-100 px-2 rounded-full text-xs">المتبقي: {offer.quantityRemaining}</span>
                                    </div>
                                 </div>
                            </div>
                            <div className="text-xl font-bold text-sea-700">{offer.price} <span className="text-sm font-normal">ر.س</span></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Customer Logic & UI ---

const CustomerHome = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [offers, setOffers] = useState<Offering[]>([]);
    const [selectedOffer, setSelectedOffer] = useState<Offering | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [booking, setBooking] = useState(false);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'all' | 'following'>('all');

    const fetchOffers = async () => {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        let q = query(collection(db, 'offerings'), where('date', '==', today), where('isActive', '==', true));
        
        try {
            if (viewMode === 'following' && userProfile) {
                const followsSnap = await getDocs(query(collection(db, 'follows'), where('customerId', '==', userProfile.uid)));
                const followedProviderIds = followsSnap.docs.map(d => d.data().providerId);
                
                if (followedProviderIds.length > 0) {
                     const allSnap = await getDocs(q);
                     const allOffers = allSnap.docs.map(d => ({id: d.id, ...d.data()} as Offering));
                     setOffers(allOffers.filter(o => followedProviderIds.includes(o.providerId)));
                } else {
                    setOffers([]);
                }
            } else {
                const snapshot = await getDocs(q);
                setOffers(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Offering)));
            }
        } catch(e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => { fetchOffers(); }, [viewMode, userProfile]);

    const handleBook = async () => {
        if (!selectedOffer || !userProfile) return;
        setBooking(true);
        try {
            await addDoc(collection(db, 'reservations'), {
                offeringId: selectedOffer.id,
                customerId: userProfile.uid,
                customerName: userProfile.name,
                providerId: selectedOffer.providerId,
                offeringName: selectedOffer.itemName,
                quantity: quantity,
                totalPrice: quantity * selectedOffer.price,
                status: 'pending',
                createdAt: Date.now()
            });

            await updateDoc(doc(db, 'offerings', selectedOffer.id), {
                quantityRemaining: increment(-quantity)
            });

            showToast("تم إرسال الطلب! تابع حالة الطلب من صفحة طلباتي", "success");
            setSelectedOffer(null);
            setQuantity(1);
            fetchOffers();
        } catch (e) {
            showToast("فشل الحجز، حاول مرة أخرى", "error");
        }
        setBooking(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-sea-900">عروض الصيد اليوم 🎣</h1>
                    <p className="text-gray-500 mt-1">اغتنم الفرصة واحجز أشهى المأكولات البحرية الطازجة</p>
                </div>
                {userProfile && (
                     <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-200">
                        <button onClick={() => setViewMode('all')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${viewMode === 'all' ? 'bg-sea-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>الكل</button>
                        <button onClick={() => setViewMode('following')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${viewMode === 'following' ? 'bg-sea-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>المتابعون</button>
                    </div>
                )}
            </div>

            {loading ? <LoadingSpinner /> : offers.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
                    <div className="text-6xl mb-4">🤷‍♂️</div>
                    <h3 className="text-xl font-bold text-gray-700">لا توجد عروض حالياً</h3>
                    <p className="text-gray-500">عد لاحقاً أو جرب تغيير الفلتر</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {offers.map(offer => {
                        const isMyOffer = userProfile?.uid === offer.providerId;
                        const soldOut = offer.quantityRemaining === 0;

                        return (
                        <Card key={offer.id} className="group flex flex-col h-full border-t-4 border-t-sea-400">
                            <div className="h-56 overflow-hidden relative">
                                <img src={offer.itemImageUrl} alt={offer.itemName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                <div className="absolute top-0 right-0 bg-sea-600 text-white px-3 py-1 rounded-bl-lg font-bold shadow">
                                    {offer.price} ر.س
                                </div>
                                {soldOut && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm">نفذت الكمية</div>}
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-bold text-xl text-gray-800 mb-1">{offer.itemName}</h3>
                                <div className="text-sm text-gray-500 mb-4 flex justify-between">
                                    <span>المتبقي: {offer.quantityRemaining} وجبة</span>
                                </div>
                                
                                <div className="mt-auto pt-4 border-t border-gray-100">
                                    {isMyOffer ? (
                                        <div className="w-full py-2 text-center text-sm font-bold text-sea-600 bg-sea-50 rounded-lg border border-sea-100">
                                            🌟 هذا العرض خاص بك
                                        </div>
                                    ) : (
                                        <Button 
                                            onClick={() => setSelectedOffer(offer)}
                                            disabled={soldOut || !userProfile}
                                            className="w-full shadow-sea-200"
                                        >
                                            {soldOut ? 'نفذت الكمية' : userProfile ? 'حجز الآن' : 'سجل للحجز'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )})}
                </div>
            )}

            {/* Modal */}
            {selectedOffer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">تأكيد الحجز</h2>
                            <button onClick={() => setSelectedOffer(null)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6"/></button>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-6 bg-sea-50 p-3 rounded-xl">
                            <img src={selectedOffer.itemImageUrl} className="w-16 h-16 rounded-lg object-cover" alt="" />
                            <div>
                                <h3 className="font-bold text-sm">{selectedOffer.itemName}</h3>
                                <div className="text-sea-700 font-bold">{selectedOffer.price} ر.س / وجبة</div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">عدد الوجبات</label>
                            <div className="flex items-center gap-3">
                                <button className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-100" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                                <span className="text-xl font-bold w-8 text-center">{quantity}</span>
                                <button className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-100" onClick={() => setQuantity(Math.min(selectedOffer.quantityRemaining, quantity + 1))}>+</button>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-6 text-lg font-bold border-t pt-4">
                            <span>الإجمالي</span>
                            <span className="text-sea-700">{quantity * selectedOffer.price} ر.س</span>
                        </div>

                        <Button onClick={handleBook} isLoading={booking} className="w-full py-3 text-lg">
                            تأكيد الطلب
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const MyReservations = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const fetchRes = async () => {
        if (!userProfile) return;
        try {
            const q = query(collection(db, 'reservations'), where('customerId', '==', userProfile.uid), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setReservations(snap.docs.map(d => ({id: d.id, ...d.data()} as Reservation)));
        } catch(e) { console.error(e); }
    };

    useEffect(() => { fetchRes(); }, [userProfile]);

    const handleUploadPayment = async (file: File, resId: string) => {
        setUploadingId(resId);
        try {
            const url = await uploadFile(file, `payments/${userProfile?.uid}/${resId}`);
            await updateDoc(doc(db, 'reservations', resId), { paymentProofUrl: url });
            showToast("تم رفع السند بنجاح! بانتظار تأكيد الطاهي", "success");
            fetchRes();
        } catch (e) {
            showToast("فشل الرفع", "error");
        }
        setUploadingId(null);
    };

    const cancelReservation = async (id: string) => {
        if(!confirm("هل أنت متأكد من إلغاء الطلب؟")) return;
        try {
            await updateDoc(doc(db, 'reservations', id), { status: 'cancelled' });
            showToast("تم إلغاء الطلب", "info");
            fetchRes();
        } catch(e) { showToast("فشل الإلغاء", "error"); }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">طلباتي</h1>
            <div className="space-y-4">
                {reservations.map(res => (
                    <Card key={res.id} className="p-6">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-bold text-xl">{res.offeringName}</h3>
                                    <Badge status={res.status} />
                                </div>
                                <p className="text-gray-500 text-sm mb-1">الكمية: <span className="font-bold text-gray-800">{res.quantity}</span> | الإجمالي: <span className="font-bold text-sea-700">{res.totalPrice} ر.س</span></p>
                                <p className="text-xs text-gray-400">{new Date(res.createdAt).toLocaleDateString('ar-SA')} {new Date(res.createdAt).toLocaleTimeString('ar-SA')}</p>
                            </div>
                            
                            {res.status === 'pending' && (
                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 md:w-1/2">
                                    {!res.paymentProofUrl ? (
                                        <>
                                            <p className="text-sm font-bold text-yellow-800 mb-2">⚠ يرجى تحويل المبلغ وإرفاق الإيصال لتأكيد الحجز</p>
                                            <div className="flex gap-2">
                                                <label className={`flex-1 cursor-pointer bg-white border border-yellow-300 rounded px-3 py-2 text-center text-sm font-bold text-yellow-700 hover:bg-yellow-100 transition-colors ${uploadingId === res.id ? 'opacity-50' : ''}`}>
                                                    {uploadingId === res.id ? 'جاري الرفع...' : '📤 رفع الإيصال'}
                                                    <input type="file" className="hidden" accept="image/*" disabled={!!uploadingId} onChange={(e) => e.target.files && handleUploadPayment(e.target.files[0], res.id)} />
                                                </label>
                                                <button onClick={() => cancelReservation(res.id)} className="text-red-500 text-sm hover:underline px-2">إلغاء الطلب</button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center text-center">
                                            <CheckCircleIcon className="w-8 h-8 text-green-500 mb-1"/>
                                            <p className="text-sm text-green-700 font-bold">تم إرسال الإيصال</p>
                                            <p className="text-xs text-gray-500">بانتظار موافقة الطاهي</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const ProvidersList = () => {
    const { userProfile } = useContext(AuthContext);
    const [providers, setProviders] = useState<ProviderProfile[]>([]);
    
    useEffect(() => {
        const load = async () => {
            const snap = await getDocs(collection(db, 'providers'));
            setProviders(snap.docs.map(d => d.data() as ProviderProfile));
        };
        load();
    }, []);

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">أشهر الطهاة</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.map(prov => (
                    <Card key={prov.providerId} className="p-8 flex flex-col items-center text-center hover:translate-y-[-5px] transition-transform">
                         <div className="h-24 w-24 bg-gradient-to-br from-sea-100 to-sea-200 rounded-full flex items-center justify-center mb-4 text-sea-700 font-bold text-3xl shadow-inner">
                            {prov.name[0]}
                         </div>
                         <h3 className="font-bold text-xl text-gray-800">{prov.name}</h3>
                         <p className="text-gray-500 text-sm mt-2 mb-6">{prov.description}</p>
                         <Button variant="outline" className="rounded-full px-8">زيارة الملف</Button>
                    </Card>
                ))}
            </div>
        </div>
    );
};

// --- App Root ---

const ProtectedRoute = ({ children, allowedRoles }: { children?: React.ReactNode, allowedRoles?: UserRole[] }) => {
    const { currentUser, userProfile, loading } = useContext(AuthContext);
    
    if (loading) return <LoadingSpinner />;
    if (!currentUser) return <Navigate to="/login" />;
    
    if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
        return <Navigate to="/" />;
    }

    return <>{children}</>;
};

const AppContent = () => {
    return (
        <div className="flex flex-col min-h-screen">
            <Navbar />
            <div className="flex-grow pt-4">
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    
                    <Route path="/" element={<CustomerHome />} />
                    <Route path="/providers" element={<ProvidersList />} />
                    <Route path="/my-reservations" element={<ProtectedRoute allowedRoles={['customer']}><MyReservations /></ProtectedRoute>} />

                    <Route path="/provider/dashboard" element={<ProtectedRoute allowedRoles={['provider']}><ProviderDashboard /></ProtectedRoute>} />
                    <Route path="/provider/catalog" element={<ProtectedRoute allowedRoles={['provider']}><ProviderCatalog /></ProtectedRoute>} />
                    <Route path="/provider/offers" element={<ProtectedRoute allowedRoles={['provider']}><ProviderOffers /></ProtectedRoute>} />
                    <Route path="/provider/reservations" element={<ProtectedRoute allowedRoles={['provider']}><ProviderReservations /></ProtectedRoute>} />

                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </div>
            <footer className="bg-sea-900 text-sea-100 text-center py-6 mt-12">
                <p className="font-medium opacity-80">&copy; {new Date().getFullYear()} صيد البحر SeaCatch</p>
            </footer>
        </div>
    );
};

const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
            <AppContent />
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;