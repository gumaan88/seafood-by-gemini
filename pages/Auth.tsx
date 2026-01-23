import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser, auth, db, doc, setDoc, User } from '../services/firebase';
import { ToastContext } from '../contexts/AppContext';
import { Card, Button } from '../components/UI';
import { UserProfile, UserRole, ProviderProfile, ProviderCategory } from '../types';

export const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { showToast } = useContext(ToastContext);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let emailToUse = identifier;
            if (!identifier.includes('@')) {
                emailToUse = `${identifier}@seacatch.local`;
            }
            await signInWithEmailAndPassword(auth, emailToUse, password);
            showToast('تم تسجيل الدخول بنجاح', 'success');
            navigate('/');
        } catch (err: any) {
            console.error(err);
            let msg = "حدث خطأ أثناء تسجيل الدخول";
            if (err.code === 'auth/invalid-credential') msg = "البيانات غير صحيحة";
            showToast(msg, 'error');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <Card className="max-w-md w-full p-8 space-y-8 animate-slide-up border-t-4 border-t-primary-500">
                <div><h2 className="mt-2 text-center text-3xl font-extrabold text-primary-900">تسجيل الدخول</h2></div>
                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <input type="text" required className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm" placeholder="البريد الإلكتروني أو رقم الجوال" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
                        <input type="password" required className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" isLoading={loading} className="w-full py-3">دخول</Button>
                    <div className="text-sm text-center"><Link to="/register" className="font-medium text-primary-600 hover:text-primary-500 transition-colors">ليس لديك حساب؟ <span className="underline">سجل الآن</span></Link></div>
                </form>
            </Card>
        </div>
    );
};

export const Register = () => {
    const [formData, setFormData] = useState({ name: '', contact: '', password: '', role: 'customer' as UserRole, providerCode: '', category: 'مطعم' as ProviderCategory });
    const [loading, setLoading] = useState(false);
    const { showToast } = useContext(ToastContext);
    const navigate = useNavigate();
    const providerCategories: ProviderCategory[] = ['مطعم', 'مقهى', 'ملابس', 'إلكترونيات', 'خدمات', 'أخرى'];

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.role === 'provider' && formData.providerCode !== '356751') {
            showToast("رمز التحقق لمقدم الخدمة غير صحيح", 'error');
            return;
        }
        setLoading(true);
        let userToDelete: User | null = null;
        try {
            let emailToRegister = formData.contact;
            let phoneToStore = '';
            if (!formData.contact.includes('@')) {
                phoneToStore = formData.contact;
                emailToRegister = `${formData.contact}@seacatch.local`;
            }
            const userCredential = await createUserWithEmailAndPassword(auth, emailToRegister, formData.password);
            userToDelete = userCredential.user;
            const newUser: UserProfile = { uid: userCredential.user.uid, name: formData.name, email: emailToRegister, role: formData.role, phone: phoneToStore, createdAt: Date.now() };
            await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
            if (formData.role === 'provider') {
                const newProvider: ProviderProfile = { providerId: userCredential.user.uid, name: formData.name, description: `يقدم أفضل ${formData.category === 'مطعم' ? 'المأكولات' : 'الخدمات والمنتجات'}`, category: formData.category, followersCount: 0 };
                await setDoc(doc(db, 'providers', userCredential.user.uid), newProvider);
            }
            showToast('تم إنشاء الحساب بنجاح', 'success');
            navigate('/');
        } catch (err: any) {
            console.error(err);
            let msg = "فشل التسجيل";
            if (err.code === 'auth/email-already-in-use') msg = "الحساب مسجل مسبقاً";
            showToast(msg, 'error');
            if (userToDelete) try { await deleteUser(userToDelete); } catch { }
        }
        setLoading(false);
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <Card className="max-w-md w-full p-8 space-y-8 animate-slide-up border-t-4 border-t-primary-500">
                <div><h2 className="mt-2 text-center text-3xl font-extrabold text-primary-900">حساب جديد</h2></div>
                <form className="mt-8 space-y-4" onSubmit={handleRegister}>
                    <div className="space-y-3">
                        <input type="text" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" placeholder="الاسم الكامل / اسم المتجر" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                        <input type="text" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" placeholder="البريد الإلكتروني أو رقم الجوال" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} />
                        <input type="password" required className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" placeholder="كلمة المرور (6 أحرف على الأقل)" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div onClick={() => setFormData({ ...formData, role: 'customer' })} className={`cursor-pointer p-4 rounded-lg border-2 text-center transition-all ${formData.role === 'customer' ? 'border-primary-600 bg-primary-50 text-primary-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-primary-300'}`}><div>🍽️</div><div className="text-sm mt-1">عميل</div></div>
                        <div onClick={() => setFormData({ ...formData, role: 'provider' })} className={`cursor-pointer p-4 rounded-lg border-2 text-center transition-all ${formData.role === 'provider' ? 'border-primary-600 bg-primary-50 text-primary-700 font-bold' : 'border-gray-200 text-gray-500 hover:border-primary-300'}`}><div>👨‍🍳</div><div className="text-sm mt-1">مقدم خدمة</div></div>
                    </div>
                    {formData.role === 'provider' && (
                        <div className="animate-fade-in space-y-3 mt-4">
                            <div><label className="text-sm text-gray-600 block mb-1">نوع النشاط</label><select className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as ProviderCategory })}>{providerCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className="text-sm text-gray-600 block mb-1">رمز التحقق (للمتاجر فقط)</label><input type="password" required className="block w-full px-3 py-3 border border-red-200 bg-red-50 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-center tracking-widest" placeholder="أدخل الرمز السري" value={formData.providerCode} onChange={(e) => setFormData({ ...formData, providerCode: e.target.value })} /></div>
                        </div>
                    )}
                    <Button type="submit" isLoading={loading} className="w-full py-3 mt-6">تسجيل</Button>
                    <div className="text-sm text-center"><Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">لديك حساب؟ سجل دخول</Link></div>
                </form>
            </Card>
        </div>
    );
};
