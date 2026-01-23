import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
    auth, db, 
    onAuthStateChanged, User, signOut, 
    doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc
} from '../services/firebase';
import { UserProfile, ProviderProfile, AppNotification } from '../types';
import { ToastItem } from '../components/UI';

// --- Toast Context ---
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }
export const ToastContext = createContext<{ showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }>({ showToast: () => {} });

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
                {toasts.map(t => <ToastItem key={t.id} message={t.message} type={t.type} />)}
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
export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
      if (user) await fetchProfiles(user.uid);
      else { setUserProfile(null); setProviderProfile(null); }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => { await signOut(auth); };
  const refreshProfile = async () => { if(currentUser) await fetchProfiles(currentUser.uid); };

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
export const NotificationContext = createContext<NotificationContextType>({} as NotificationContextType);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useContext(AuthContext);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    useEffect(() => {
        if (!currentUser) { setNotifications([]); return; }
        const q = query(collection(db, 'notifications'), where('recipientId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
            setNotifications(data);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
    const markAsRead = async (id: string) => { try { await updateDoc(doc(db, 'notifications', id), { read: true }); } catch(e) {} };
    const sendNotification = async (recipientId: string, title: string, body: string, type: 'info'|'success'|'warning' = 'info') => {
        try { await addDoc(collection(db, 'notifications'), { recipientId, title, body, type, read: false, createdAt: Date.now() }); } catch(e) {}
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, sendNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};
