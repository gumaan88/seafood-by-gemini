// Mocking Firebase SDK for environment compatibility or missing packages

// Types matches what is expected by App.tsx
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// --- Safe Storage Helper ---
// In sandboxed iframes (like AI Studio preview), accessing localStorage can throw SecurityError.
// We use this helper to fallback to memory if that happens.
const memStorage: Record<string, string> = {};

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    // Fallback to memory if localStorage is blocked
    return memStorage[key] || null;
  }
};

const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    memStorage[key] = value;
  }
};

const safeRemoveItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    delete memStorage[key];
  }
};

// Mock Database State
const getStoredDb = () => {
    const data = safeGetItem('mock_db');
    return data ? JSON.parse(data) : {};
};
const setStoredDb = (db: any) => safeSetItem('mock_db', JSON.stringify(db));

// Mock Auth State
const getStoredUser = () => {
    const u = safeGetItem('mock_user');
    return u ? JSON.parse(u) : null;
};

// --- Auth Exports ---

export const getAuth = (app?: any) => ({});

export const onAuthStateChanged = (auth: any, cb: (u: User | null) => void) => {
  const user = getStoredUser();
  // Call immediately
  setTimeout(() => cb(user), 100);
  
  // Simple event listener for storage changes
  // Wrapped in try-catch because adding listeners on window might also be restricted
  try {
      const listener = () => {
          cb(getStoredUser());
      };
      window.addEventListener('storage', listener);
      // Also listen to custom events for same-tab updates
      window.addEventListener('local-storage-update', listener);
      
      return () => {
          window.removeEventListener('storage', listener);
          window.removeEventListener('local-storage-update', listener);
      };
  } catch (e) {
      return () => {};
  }
};

const triggerUpdate = () => {
    try {
        window.dispatchEvent(new Event('local-storage-update'));
        window.dispatchEvent(new Event('storage'));
    } catch(e) { /* ignore */ }
};

export const signInWithEmailAndPassword = async (auth: any, email: string, p: string) => {
  // Simulate login
  const user: User = { uid: 'user_' + email.replace(/\W/g, ''), email, displayName: email.split('@')[0], photoURL: null };
  safeSetItem('mock_user', JSON.stringify(user));
  triggerUpdate();
  return { user };
};

export const createUserWithEmailAndPassword = async (auth: any, email: string, p: string) => {
  const user: User = { uid: 'user_' + email.replace(/\W/g, ''), email, displayName: email.split('@')[0], photoURL: null };
  safeSetItem('mock_user', JSON.stringify(user));
  triggerUpdate();
  return { user };
};

export const signOut = async (auth: any) => {
  safeRemoveItem('mock_user');
  triggerUpdate();
};

export const deleteUser = async (user: User) => {
  safeRemoveItem('mock_user');
  triggerUpdate();
};

// --- Firestore Exports ---

export const getFirestore = (app?: any) => ({});

export const doc = (db: any, col: string, id: string) => ({ path: `${col}/${id}`, id });

export const collection = (db: any, path: string) => ({ path });

export const query = (col: any, ...args: any[]) => ({ col, args });

export const where = (field: string, op: string, val: any) => ({ type: 'where', field, op, val });

export const orderBy = (field: string, dir: string) => ({ type: 'orderBy', field, dir });

export const getDoc = async (d: any) => {
  const parts = d.path.split('/');
  const col = parts[0];
  const id = parts[1];
  const db = getStoredDb();
  const data = db[col]?.[id];
  return {
    exists: () => !!data,
    data: () => data
  };
};

export const setDoc = async (d: any, data: any) => {
  const parts = d.path.split('/');
  const col = parts[0];
  const id = parts[1];
  const db = getStoredDb();
  if (!db[col]) db[col] = {};
  db[col][id] = data;
  setStoredDb(db);
};

export const addDoc = async (colRef: any, data: any) => {
  const col = colRef.path;
  const id = 'doc_' + Date.now() + Math.floor(Math.random() * 1000);
  const db = getStoredDb();
  if (!db[col]) db[col] = {};
  db[col][id] = data;
  setStoredDb(db);
  return { id };
};

export const updateDoc = async (d: any, data: any) => {
  const parts = d.path.split('/');
  const col = parts[0];
  const id = parts[1];
  const db = getStoredDb();
  if (db[col] && db[col][id]) {
    // Handle increments
    const current = db[col][id];
    const updated = { ...current };
    Object.keys(data).forEach(k => {
        if (data[k] && typeof data[k] === 'object' && data[k]._type === 'increment') {
            updated[k] = (updated[k] || 0) + data[k].n;
        } else {
            updated[k] = data[k];
        }
    });
    db[col][id] = updated;
    setStoredDb(db);
  }
};

export const increment = (n: number) => ({ _type: 'increment', n });

export const serverTimestamp = () => Date.now();

export const getDocs = async (q: any) => {
  const col = q.col?.path || q.path;
  const db = getStoredDb();
  let items = Object.entries(db[col] || {}).map(([id, data]) => ({ id, ...(data as any) }));

  if (q.args) {
    q.args.forEach((arg: any) => {
      if (arg.type === 'where') {
         items = items.filter(i => {
             if (arg.op === '==') return i[arg.field] === arg.val;
             return true;
         });
      }
      // Simple orderBy support
      if (arg.type === 'orderBy') {
          items.sort((a, b) => {
              const valA = a[arg.field];
              const valB = b[arg.field];
              if (valA < valB) return arg.dir === 'desc' ? 1 : -1;
              if (valA > valB) return arg.dir === 'desc' ? -1 : 1;
              return 0;
          });
      }
    });
  }

  return {
    size: items.length,
    docs: items.map(i => ({ id: i.id, data: () => i })),
    forEach: (cb: any) => items.forEach(i => cb({ id: i.id, data: () => i }))
  };
};

// --- Storage Exports ---

export const getStorage = (app?: any) => ({});
export const ref = (s: any, p: string) => ({ path: p });
export const uploadBytes = async (r: any, f: any) => ({});
export const getDownloadURL = async (r: any) => `https://via.placeholder.com/150?text=${encodeURIComponent(r.path)}`;

export const uploadFile = async (file: File, path: string): Promise<string> => {
  // Use a local blob URL so images actually show up in the session
  try {
    return URL.createObjectURL(file);
  } catch (e) {
    // Fallback if URL creation is blocked
    return 'https://via.placeholder.com/150?text=Uploaded';
  }
};

// --- App Exports ---

export const initializeApp = (config: any) => ({});
export const auth = {};
export const db = {};
export const storage = {};