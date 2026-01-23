import React, { useState, useEffect, useContext, useMemo } from 'react';
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
                let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Offering));
                data = data.filter(o => o.quantityRemaining > 0);
                setOffers(data);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchOffers();
    }, []);

    const handleReserve = async (offer: Offering) => {
        if (!currentUser) {
            showToast("يجب تسجيل الدخول للحجز", "info");
            return;
        }
        if (!confirm(`تأكيد حجز ${offer.itemName} بسعر ${offer.price} ر.ي؟`)) return;
        try {
            await addDoc(collection(db, 'reservations'), { offeringId: offer.id, customerId: currentUser.uid, providerId: offer.providerId, offeringName: offer.itemName, customerName: userProfile?.name || 'Unknown', quantity: 1, totalPrice: offer.price, status: 'pending', createdAt: Date.now() });
            await updateDoc(doc(db, 'offerings', offer.id), { quantityRemaining: increment(-1) });
            await sendNotification(offer.providerId, 'طلب جديد', `قام ${userProfile?.name} بطلب ${offer.itemName}`, 'success');
            showToast("تم الحجز بنجاح! تابع طلبك في 'حجوزاتي'", "success");
            setOffers(prev => prev.map(o => { if (o.id === offer.id) return { ...o, quantityRemaining: o.quantityRemaining - 1 }; return o; }).filter(o => o.quantityRemaining > 0));
        } catch (e) { showToast("حدث خطأ أثناء الحجز", "error"); }
    };

    if (loading) return <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;

    const displayedOffers = offers.filter(o => o.itemName.toLowerCase().includes(filter.toLowerCase()));

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen">
            <div className="bg-gradient-to-r from-primary-800 to-primary-600 rounded-2xl p-8 mb-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between animate-fade-in relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl md:text-5xl font-bold mb-4 font-sans">حجزي - Hajzi</h1>
                    <p className="text-primary-100 text-lg mb-8 max-w-xl leading-relaxed">منصتك الشاملة لحجز كل ما تحتاج. مطاعم، متاجر، خدمات، والمزيد بضغطة زر.</p>
                    <div className="bg-white/10 p-2 rounded-xl inline-flex items-center backdrop-blur-md border border-white/20 w-full max-w-md shadow-lg transition-all focus-within:bg-white/20">
                        <MagnifyingGlassIcon className="w-6 h-6 ml-3 text-primary-200" />
                        <input type="text" placeholder="ابحث عن وجبة، منتج، خدمة..." className="bg-transparent border-none text-white placeholder-primary-300 focus:ring-0 outline-none w-full font-medium" value={filter} onChange={(e) => setFilter(e.target.value)} />
                    </div>
                </div>
                <div className="text-[150px] leading-none mt-6 md:mt-0 opacity-20 md:opacity-100 absolute md:relative right-[-50px] md:right-0 rotate-12 md:rotate-0 transition-transform hover:rotate-12 duration-500 select-none">✨</div>
            </div>
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-primary-100 rounded-full text-primary-600"><CalendarDaysIcon className="w-6 h-6" /></div>
                <h2 className="text-2xl font-bold text-gray-800">أحدث العروض المتاحة</h2>
            </div>
            {displayedOffers.length === 0 ? <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200"><div className="text-6xl mb-4">🔍</div><p className="text-gray-500 text-xl font-medium">لا توجد نتائج مطابقة</p></div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {displayedOffers.map(offer => (
                        <Card key={offer.id} className="group hover:-translate-y-2 transition-all duration-300 flex flex-col h-full border-gray-100 hover:shadow-xl hover:border-primary-200">
                            <div className="h-56 overflow-hidden relative bg-gray-200">
                                <img src={offer.itemImageUrl || 'https://placehold.co/400?text=Service'} alt={offer.itemName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur text-primary-800 px-3 py-1 rounded-lg text-sm font-bold shadow-md flex items-center gap-1"><CurrencyDollarIcon className="w-4 h-4" /> {offer.price}</div>
                                {offer.quantityRemaining < 5 && (<div className="absolute bottom-3 left-3 bg-red-500/90 backdrop-blur text-white px-2 py-1 rounded-md text-xs font-bold animate-pulse shadow-sm">🔥 متبقي {offer.quantityRemaining}</div>)}
                            </div>
                            <div className="p-5 flex flex-col flex-1">
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg text-gray-900 leading-tight">{offer.itemName}</h3>
                                    </div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-4 bg-gray-50 p-2 rounded-lg"><UserIcon className="w-3 h-3" /> مقدم الخدمة: ...{offer.providerId.substring(0, 5)}</p>
                                </div>
                                <Button onClick={() => handleReserve(offer)} className="w-full mt-2 group-hover:bg-primary-700 transition-colors" disabled={offer.quantityRemaining <= 0}>{offer.quantityRemaining > 0 ? 'حجز الآن' : 'نفذت الكمية'}</Button>
                            </div>
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
    const { sendNotification } = useContext(NotificationContext);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }));
    const [dateTo, setDateTo] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }));
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});

    const fetchRes = async () => {
        if (!userProfile) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'reservations'), where('customerId', '==', userProfile.uid));
            const snap = await getDocs(q);
            setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)));
        } catch (e) { showToast("فشل تحميل حجوزاتي", 'error'); } finally { setLoading(false); }
    };

    useEffect(() => { fetchRes(); }, [userProfile]);

    const handleUpdatePaymentRef = async (id: string, providerId: string, offeringName: string) => {
        const val = paymentRefs[id];
        if (!val) return;
        try {
            await updateDoc(doc(db, 'reservations', id), { paymentReference: val });
            await sendNotification(providerId, 'تأكيد دفع جديد', `قام ${userProfile?.name} بإرسال رقم السند (${val}) لطلب ${offeringName}`, 'info');
            showToast("تم إرسال رقم السند", "success");
            fetchRes();
        } catch (e) { showToast("فشل التحديث", "error"); }
    };

    const cancelReservation = async (id: string, providerId: string, offeringName: string) => {
        if (!confirm("هل أنت متأكد من إلغاء الحجز؟")) return;
        try {
            await updateDoc(doc(db, 'reservations', id), { status: 'cancelled' });
            await sendNotification(providerId, 'إلغاء حجز', `قام العميل بإلغاء حجز ${offeringName}`, 'warning');
            showToast("تم إلغاء الحجز", "info");
            fetchRes();
        } catch (e) { showToast("فشل الإلغاء", "error"); }
    };

    const filteredReservations = useMemo(() => {
        let res = reservations;
        const fromTs = new Date(dateFrom).setHours(0, 0, 0, 0);
        const toTs = new Date(dateTo).setHours(23, 59, 59, 999);
        res = res.filter(r => r.createdAt >= fromTs && r.createdAt <= toTs);
        if (statusFilter !== 'all') res = res.filter(r => r.status === statusFilter);
        if (searchQuery) res = res.filter(r => r.offeringName.includes(searchQuery));
        return res.sort((a, b) => b.createdAt - a.createdAt);
    }, [reservations, statusFilter, searchQuery, dateFrom, dateTo]);

    if (loading) return <div className="p-6 max-w-4xl mx-auto space-y-4"><SkeletonCard /><SkeletonCard /></div>;

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><ShoppingBagIcon className="w-8 h-8 text-primary-600" /> حجوزاتي</h1>
                    <p className="text-gray-500 text-sm mt-1">تابع حالة حجوزاتك وسجل المدفوعات</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                    <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm border-none focus:ring-0 text-gray-600 font-medium outline-none" />
                    <span className="text-gray-400">-</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm border-none focus:ring-0 text-gray-600 font-medium outline-none" />
                </div>
            </div>
            <Card className="p-4 flex flex-col lg:flex-row gap-4 justify-between items-center mb-6 shadow-md">
                <div className="flex flex-1 w-full gap-4 flex-col sm:flex-row">
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                        <input type="text" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
                        {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(st => (
                            <button key={st} onClick={() => setStatusFilter(st)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${statusFilter === st ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>{st === 'all' ? 'الكل' : st}</button>
                        ))}
                    </div>
                </div>
            </Card>
            <div className="space-y-4">
                {filteredReservations.length === 0 ? <div className="text-center py-12 bg-white rounded-lg shadow-sm"><ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">لا توجد حجوزات</p></div> : filteredReservations.map(res => (
                    <Card key={res.id} className="p-6">
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-xl text-primary-800">{res.offeringName}</h3>
                                    <Badge status={res.status} />
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                                    <span>الكمية: <b className="text-gray-900">{res.quantity}</b></span>
                                    <span>الإجمالي: <b className="text-primary-700">{res.totalPrice} ر.ي</b></span>
                                    <span className="text-gray-400">{new Date(res.createdAt).toLocaleDateString('ar-SA')}</span>
                                </div>
                                {res.status === 'pending' && (
                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mt-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <BanknotesIcon className="w-5 h-5 text-orange-600" />
                                            <span className="font-bold text-sm text-orange-800">تأكيد الدفع</span>
                                        </div>
                                        {res.paymentReference ? <div className="text-sm text-green-700 font-bold flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> تم إرسال الرقم: {res.paymentReference}</div> : (
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="رقم السند / المحفظة" className="flex-1 border p-2 rounded text-sm outline-none focus:border-orange-400" value={paymentRefs[res.id] || ''} onChange={e => setPaymentRefs({ ...paymentRefs, [res.id]: e.target.value })} />
                                                <Button onClick={() => handleUpdatePaymentRef(res.id, res.providerId, res.offeringName)} className="bg-orange-500 hover:bg-orange-600 text-xs px-3">إرسال</Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col justify-center items-end border-t md:border-t-0 md:border-r md:pr-4 pt-4 md:pt-0 border-gray-100">
                                {res.status === 'pending' && <button onClick={() => cancelReservation(res.id, res.providerId, res.offeringName)} className="text-red-500 text-sm hover:underline hover:text-red-700 font-medium">إلغاء</button>}
                                {res.status === 'confirmed' && (
                                    <div className="text-center">
                                        <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold mb-1">مؤكد</div>
                                        <p className="text-xs text-gray-400">يرجى الحضور في الموعد</p>
                                    </div>
                                )}
                                {res.status === 'completed' && <div className="flex items-center gap-1 text-green-600 font-bold text-sm"><CheckBadgeIcon className="w-5 h-5" /> مكتمل</div>}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export const ProvidersList = () => {
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
            <h1 className="text-3xl font-bold mb-8 text-gray-800">مقدمو الخدمات</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.map(prov => (
                    <Card key={prov.providerId} className="p-8 flex flex-col items-center text-center hover:translate-y-[-5px] transition-transform">
                        <div className="h-24 w-24 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mb-4 text-primary-700 font-bold text-3xl shadow-inner">{prov.name[0]}</div>
                        <h3 className="font-bold text-xl text-gray-800">{prov.name}</h3>
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mt-1">{prov.category || 'عام'}</span>
                        <p className="text-gray-500 text-sm mt-3 mb-6">{prov.description}</p>
                        <Button variant="outline" className="rounded-full px-8">زيارة الملف</Button>
                    </Card>
                ))}
            </div>
        </div>
    );
};
