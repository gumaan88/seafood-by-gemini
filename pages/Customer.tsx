import React, { useState, useEffect, useContext } from 'react';
import { db, collection, query, where, getDocs, doc, addDoc, updateDoc, increment } from '../services/firebase';
import { AuthContext, NotificationContext, ToastContext } from '../contexts/AppContext';
import { Card, Button, Badge, SkeletonCard } from '../components/UI';
import { Offering, Reservation, ProviderProfile } from '../types';
import { MagnifyingGlassIcon, CalendarDaysIcon, CurrencyDollarIcon, UserIcon, ShoppingBagIcon, BanknotesIcon, CheckBadgeIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export const CustomerHome = () => {
    const { userProfile, currentUser } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const { sendNotification } = useContext(NotificationContext);
    const [offers, setOffers] = useState<Offering[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const fetchOffers = async () => {
            try {
                const q = query(collection(db, 'offerings'), where('isActive', '==', true));
                const snap = await getDocs(q);
                setOffers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Offering)).filter(o => o.quantityRemaining > 0));
            } catch { } finally { setLoading(false); }
        };
        fetchOffers();
    }, []);

    const handleReserve = async (offer: Offering) => {
        if (!currentUser) { showToast("يجب تسجيل الدخول للحجز", "info"); return; }
        if (!confirm(`تأكيد حجز ${offer.itemName}؟`)) return;
        try {
            await addDoc(collection(db, 'reservations'), { offeringId: offer.id, customerId: currentUser.uid, providerId: offer.providerId, offeringName: offer.itemName, customerName: userProfile?.name || 'Unknown', quantity: 1, totalPrice: offer.price, status: 'pending', createdAt: Date.now() });
            await updateDoc(doc(db, 'offerings', offer.id), { quantityRemaining: increment(-1) });
            await sendNotification(offer.providerId, 'طلب جديد', `طلب ${userProfile?.name}: ${offer.itemName}`, 'success');
            showToast("تم الحجز بنجاح!", "success");
            setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, quantityRemaining: o.quantityRemaining - 1 } : o).filter(o => o.quantityRemaining > 0));
        } catch { showToast("خطأ", "error"); }
    };

    if (loading) return <div className="p-6 grid gap-4 md:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
    const displayed = offers.filter(o => o.itemName.toLowerCase().includes(filter.toLowerCase()));

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen">
            <div className="bg-gradient-to-r from-primary-800 to-primary-600 rounded-2xl p-8 mb-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between relative overflow-hidden">
                <div className="relative z-10"><h1 className="text-3xl md:text-5xl font-bold mb-4">حجزي - Hajzi</h1><p className="text-primary-100 text-lg mb-8 max-w-xl">منصتك الشاملة لحجز كل ما تحتاج.</p><div className="bg-white/10 p-2 rounded-xl inline-flex items-center w-full max-w-md"><MagnifyingGlassIcon className="w-6 h-6 ml-3 text-primary-200"/><input type="text" placeholder="ابحث..." className="bg-transparent border-none text-white placeholder-primary-300 focus:ring-0 outline-none w-full" value={filter} onChange={e => setFilter(e.target.value)} /></div></div>
                <div className="text-[150px] leading-none opacity-20 absolute right-0">✨</div>
            </div>
            {displayed.length === 0 ? <p className="text-center text-gray-500 py-10">لا توجد عروض</p> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {displayed.map(offer => (
                        <Card key={offer.id} className="group hover:-translate-y-2 transition-all duration-300 flex flex-col h-full hover:shadow-xl">
                            <div className="h-56 overflow-hidden relative bg-gray-200"><img src={offer.itemImageUrl || 'https://placehold.co/400'} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /><div className="absolute top-3 right-3 bg-white/95 px-3 py-1 rounded-lg text-sm font-bold shadow-md">{offer.price} ر.ي</div></div>
                            <div className="p-5 flex flex-col flex-1"><h3 className="font-bold text-lg mb-2">{offer.itemName}</h3><Button onClick={() => handleReserve(offer)} className="mt-auto w-full">حجز</Button></div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export const MyReservations = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!userProfile) return;
            const snap = await getDocs(query(collection(db, 'reservations'), where('customerId', '==', userProfile.uid)));
            setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)).sort((a,b) => b.createdAt - a.createdAt));
            setLoading(false);
        };
        load();
    }, [userProfile]);

    if (loading) return <div className="p-6"><SkeletonCard /></div>;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-4">
            <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingBagIcon className="w-6 h-6"/> حجوزاتي</h1>
            {reservations.length === 0 ? <p className="text-center text-gray-500">لا توجد حجوزات</p> : reservations.map(res => (
                <Card key={res.id} className="p-6 flex justify-between items-center">
                    <div><h3 className="font-bold text-lg">{res.offeringName}</h3><p className="text-sm text-gray-500">{new Date(res.createdAt).toLocaleDateString()}</p></div>
                    <div className="text-left"><Badge status={res.status} /><p className="font-bold mt-1">{res.totalPrice} ر.ي</p></div>
                </Card>
            ))}
        </div>
    );
};

export const ProvidersList = () => {
    const [providers, setProviders] = useState<ProviderProfile[]>([]);
    useEffect(() => { getDocs(collection(db, 'providers')).then(s => setProviders(s.docs.map(d => d.data() as ProviderProfile))); }, []);
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">مقدمو الخدمات</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{providers.map(p => (<Card key={p.providerId} className="p-8 text-center hover:-translate-y-1 transition-transform"><div className="h-24 w-24 bg-primary-100 rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-primary-700 mb-4">{p.name[0]}</div><h3 className="font-bold text-xl">{p.name}</h3><span className="bg-gray-100 text-xs px-2 py-1 rounded">{p.category}</span></Card>))}</div>
        </div>
    );
};
