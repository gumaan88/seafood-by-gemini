import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  deleteUser,
  type User 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  increment, 
  serverTimestamp,
  writeBatch,
  onSnapshot
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";

// --- إعدادات فايربيز (Firebase Configuration) ---
// تم تحديث البيانات للربط بمشروع seafood-bf083
const firebaseConfig = {
  apiKey: "AIzaSyBUnI8brep9mn6kIUUMK2vSa1V3fAyWSws",
  authDomain: "seafood-bf083.firebaseapp.com",
  projectId: "seafood-bf083",
  storageBucket: "seafood-bf083.firebasestorage.app",
  messagingSenderId: "731520797908",
  appId: "1:731520797908:web:b7a0887a7df0f045b37f41"
};

// تهيئة التطبيق (Initialize Firebase)
const app = initializeApp(firebaseConfig);

// تهيئة الخدمات (Initialize Services)
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// --- دالة مساعدة لرفع الملفات ---
export const uploadFile = async (file: File, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return url;
};

// --- تصدير الوظائف (Export Functions) ---
export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  type User,
  
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  query, 
  where, 
  orderBy, 
  getDocs, 
  increment, 
  serverTimestamp,
  writeBatch,
  onSnapshot
};