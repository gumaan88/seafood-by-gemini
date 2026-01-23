import React, { useState, useEffect, useContext, useMemo } from 'react';
import { db, collection, query, where, getDocs, doc, addDoc, updateDoc, deleteDoc, writeBatch, uploadFile } from '../services/firebase';
import { AuthContext, NotificationContext, ToastContext } from '../contexts/AppContext';
import { Card, Button, Badge, SkeletonCard, Modal, LoadingSpinner } from '../components/UI';
import { CatalogItem, Offering, Reservation, ProviderCategory, Currency, ReservationStatus } from '../types';
import { ShoppingBagIcon, CalendarIcon, ClipboardDocumentCheckIcon, CurrencyDollarIcon, PlusIcon, PencilSquareIcon, TrashIcon, EyeIcon, EyeSlashIcon, MagnifyingGlassIcon, FolderIcon, Squares2X2Icon, TagIcon, BanknotesIcon, ListBulletIcon, ChartBarIcon, CalendarDaysIcon, BoltIcon, FireIcon, CheckCircleIcon, XCircleIcon, ClockIcon, TableCellsIcon, UserIcon, XMarkIcon, LightBulbIcon } from '@heroicons/react/24/outline';

const getSaudiDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

// --- DASHBOARD ---
export const ProviderDashboard = () => {
    const { userProfile } = useContext(AuthContext);
    const [stats, setStats] = useState({ items: 0, offers: 0, reservations: 0, revenue: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            if (!userProfile) return;
            const itemsSnap = await getDocs(query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid)));
            const offersSnap = await getDocs(query(collection(db, 'offerings'), where('providerId', '==', userProfile.uid), where('isActive', '==', true)));
            const resSnap = await getDocs(query(collection(db, 'reservations'), where('providerId', '==', userProfile.uid)));
            let rev = 0;
            resSnap.forEach(doc => { const data = doc.data() as Reservation; if (data.status === 'completed') rev += data.totalPrice; });
            setStats({ items: itemsSnap.size, offers: offersSnap.size, reservations: resSnap.size, revenue: rev });
        };
        fetchStats();
    }, [userProfile]);

    const StatCard = ({ title, value, color, icon }: any) => (
        <Card className="p-6 flex items-center justify-between border-l-4 overflow-hidden relative group hover:-translate-y-1 transition-transform" style={{ borderLeftColor: color }}>
            <div className="relative z-10"><p className="text-gray-500 text-sm font-medium mb-1">{title}</p><h3 className="text-4xl font-extrabold text-gray-800 tracking-tight">{value}</h3></div>
            <div className="p-4 rounded-xl text-white shadow-lg relative z-10" style={{ background: color }}>{icon}</div>
        </Card>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div><h1 className="text-3xl font-bold text-gray-800">لوحة التحكم</h1><p className="text-gray-500 mt-2">نظرة عامة على نشاطك اليوم</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="الأصناف / الخدمات" value={stats.items} color="#6366f1" icon={<ShoppingBagIcon className="w-6 h-6" />} />
                <StatCard title="العروض النشطة" value={stats.offers} color="#10b981" icon={<CalendarIcon className="w-6 h-6" />} />
                <StatCard title="إجمالي الحجوزات" value={stats.reservations} color="#f59e0b" icon={<ClipboardDocumentCheckIcon className="w-6 h-6" />} />
                <StatCard title="الإيرادات" value={stats.revenue.toLocaleString()} color="#8b5cf6" icon={<CurrencyDollarIcon className="w-6 h-6" />} />
            </div>
        </div>
    );
};

// --- RESERVATIONS ---
export const ProviderReservations = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const { sendNotification } = useContext(NotificationContext);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(getSaudiDate());
    const [dateTo, setDateTo] = useState(getSaudiDate());
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fetchReservations = async () => {
        if (!userProfile) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'reservations'), where('providerId', '==', userProfile.uid));
            const snap = await getDocs(q);
            setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)));
        } catch { showToast("فشل تحميل البيانات", 'error'); } finally { setLoading(false); }
    };

    useEffect(() => { fetchReservations(); }, [userProfile]);

    const filteredReservations = useMemo(() => {
        const fromTs = new Date(dateFrom).setHours(0, 0, 0, 0);
        const toTs = new Date(dateTo).setHours(23, 59, 59, 999);
        let res = reservations.filter(r => r.createdAt >= fromTs && r.createdAt <= toTs);
        if (statusFilter !== 'all') res = res.filter(r => r.status === statusFilter);
        if (searchQuery) res = res.filter(r => r.customerName.includes(searchQuery) || r.offeringName.includes(searchQuery));
        return res.sort((a, b) => b.createdAt - a.createdAt);
    }, [reservations, dateFrom, dateTo, statusFilter, searchQuery]);

    const handleSingleStatus = async (id: string, status: ReservationStatus) => {
        try {
            await updateDoc(doc(db, 'reservations', id), { status });
            const res = reservations.find(r => r.id === id);
            if(res) await sendNotification(res.customerId, 'تحديث الحجز', `حالة حجز ${res.offeringName}: ${status}`, 'success');
            showToast("تم تحديث الحالة", "success");
            fetchReservations();
        } catch { showToast("خطأ", "error"); }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold flex items-center gap-2"><ClipboardDocumentCheckIcon className="w-8 h-8 text-primary-600"/> إدارة الحجوزات</h1>
             {/* Simple Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
               <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border p-2 rounded" />
               <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border p-2 rounded" />
               <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border p-2 rounded">
                  <option value="all">الكل</option><option value="pending">معلق</option><option value="confirmed">مؤكد</option><option value="completed">مكتمل</option>
               </select>
            </div>
            
            {loading ? <SkeletonCard /> : filteredReservations.map(res => (
                <Card key={res.id} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                   <div>
                       <h3 className="font-bold">{res.offeringName}</h3>
                       <p className="text-sm text-gray-500">العميل: {res.customerName} | الكمية: {res.quantity} | {res.totalPrice} ر.ي</p>
                       <div className="mt-1"><Badge status={res.status} /> {res.paymentReference && <span className="text-xs text-green-600 font-bold ml-2">سند: {res.paymentReference}</span>}</div>
                   </div>
                   <div className="flex gap-2">
                       {res.status === 'pending' && <><Button variant="ghost" onClick={() => handleSingleStatus(res.id, 'confirmed')} className="text-green-600"><CheckCircleIcon className="w-5 h-5"/></Button><Button variant="ghost" onClick={() => handleSingleStatus(res.id, 'cancelled')} className="text-red-600"><XCircleIcon className="w-5 h-5"/></Button></>}
                       {res.status === 'confirmed' && <Button variant="ghost" onClick={() => handleSingleStatus(res.id, 'completed')} className="text-blue-600">إتمام</Button>}
                   </div>
                </Card>
            ))}
            {filteredReservations.length === 0 && <p className="text-center text-gray-500">لا توجد حجوزات</p>}
        </div>
    );
};

// --- OFFERS ---
export const ProviderOffers = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [offers, setOffers] = useState<Offering[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
    const [newOfferData, setNewOfferData] = useState({ price: 0, quantity: 10, date: getSaudiDate() });

    const loadData = async () => {
        if (!userProfile) return;
        setLoading(true);
        try {
            const itemsSnap = await getDocs(query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid), where('isActive', '==', true)));
            setItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)));
            const offersSnap = await getDocs(query(collection(db, 'offerings'), where('providerId', '==', userProfile.uid)));
            setOffers(offersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Offering)));
        } catch { showToast("خطأ تحميل", "error"); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [userProfile]);

    const handleSaveOffer = async () => {
        if (!userProfile || !selectedItem) return;
        try {
            const payload = {
                itemId: selectedItem.id, providerId: userProfile.uid, itemName: selectedItem.name, itemImageUrl: selectedItem.imageUrl,
                price: Number(newOfferData.price), quantityTotal: Number(newOfferData.quantity), quantityRemaining: Number(newOfferData.quantity),
                date: newOfferData.date, isActive: true
            };
            await addDoc(collection(db, 'offerings'), payload);
            showToast("تم النشر", "success"); setIsCreateModalOpen(false); loadData();
        } catch { showToast("خطأ", "error"); }
    };

    const handleToggleStatus = async (offer: Offering) => {
        try { await updateDoc(doc(db, 'offerings', offer.id), { isActive: !offer.isActive }); loadData(); } catch { }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center"><h1 className="text-3xl font-bold flex items-center gap-2"><CalendarIcon className="w-8 h-8 text-primary-600"/> العروض</h1><Button onClick={() => setIsCreateModalOpen(true)}><PlusIcon className="w-5 h-5"/> عرض جديد</Button></div>
            {loading ? <div className="grid grid-cols-3 gap-4"><SkeletonCard/><SkeletonCard/></div> : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {offers.map(offer => (
                        <div key={offer.id} className="bg-white rounded-xl border shadow-sm p-4 relative overflow-hidden group">
                            <div className="absolute top-2 left-2"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${offer.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{offer.isActive ? 'نشط' : 'متوقف'}</span></div>
                            <img src={offer.itemImageUrl} className="w-full h-40 object-cover rounded-lg mb-3" />
                            <h3 className="font-bold">{offer.itemName}</h3>
                            <div className="flex justify-between text-sm text-gray-600 mt-2"><span>{offer.price} ر.ي</span><span>متبقي: {offer.quantityRemaining}/{offer.quantityTotal}</span></div>
                            <div className="mt-2 text-xs text-gray-400 flex items-center gap-1"><CalendarDaysIcon className="w-4 h-4"/> {offer.date}</div>
                            <button onClick={() => handleToggleStatus(offer)} className="w-full mt-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold">{offer.isActive ? 'إيقاف' : 'تفعيل'}</button>
                        </div>
                    ))}
                </div>
            )}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="إضافة عرض">
                {!selectedItem ? (
                    <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                        {items.map(item => (<div key={item.id} onClick={() => { setSelectedItem(item); setNewOfferData({ ...newOfferData, price: item.priceDefault }); }} className="border p-2 rounded cursor-pointer hover:bg-gray-50 text-center"><img src={item.imageUrl} className="w-12 h-12 mx-auto rounded bg-gray-200" /><p className="text-xs font-bold mt-1">{item.name}</p></div>))}
                        {items.length === 0 && <p className="col-span-2 text-center text-gray-400">لا توجد أصناف في الكتالوج</p>}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded"><img src={selectedItem.imageUrl} className="w-10 h-10 rounded" /><span className="font-bold">{selectedItem.name}</span><button onClick={() => setSelectedItem(null)} className="mr-auto text-xs text-red-500">تغيير</button></div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs">السعر</label><input type="number" className="w-full border p-2 rounded" value={newOfferData.price} onChange={e => setNewOfferData({ ...newOfferData, price: Number(e.target.value) })} /></div>
                            <div><label className="text-xs">الكمية</label><input type="number" className="w-full border p-2 rounded" value={newOfferData.quantity} onChange={e => setNewOfferData({ ...newOfferData, quantity: Number(e.target.value) })} /></div>
                        </div>
                        <div><label className="text-xs">التاريخ</label><input type="date" className="w-full border p-2 rounded" value={newOfferData.date} onChange={e => setNewOfferData({ ...newOfferData, date: e.target.value })} /></div>
                        <Button onClick={handleSaveOffer} className="w-full">نشر</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// --- CATALOG ---
export const ProviderCatalog = () => {
    const { userProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ name: '', desc: '', price: 0, cat: 'عام' as string, image: null as File | null });

    const loadItems = async () => {
        if (!userProfile) return;
        setLoading(true);
        const snap = await getDocs(query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid)));
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)));
        setLoading(false);
    };

    useEffect(() => { loadItems(); }, [userProfile]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;
        try {
            let imageUrl = `https://placehold.co/400x400/e2e8f0/1e293b?text=${encodeURIComponent(formData.name)}`;
            if (formData.image) imageUrl = await uploadFile(formData.image, `items/${userProfile.uid}/${Date.now()}_${formData.image.name}`);
            await addDoc(collection(db, 'catalogItems'), { providerId: userProfile.uid, name: formData.name, description: formData.desc, priceDefault: Number(formData.price), category: formData.cat, imageUrl, currency: 'YER', isActive: true, createdAt: Date.now() });
            showToast("تمت الإضافة", "success"); setIsModalOpen(false); loadItems();
        } catch { showToast("خطأ", "error"); }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center"><h1 className="text-3xl font-bold flex items-center gap-2"><ShoppingBagIcon className="w-8 h-8 text-primary-600"/> الكتالوج</h1><Button onClick={() => setIsModalOpen(true)}><PlusIcon className="w-5 h-5"/> صنف جديد</Button></div>
            {loading ? <div className="grid grid-cols-3 gap-4"><SkeletonCard/><SkeletonCard/></div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {items.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden group">
                            <div className="h-40 relative"><img src={item.imageUrl} className="w-full h-full object-cover" /><div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-bold">{item.category}</div></div>
                            <div className="p-4">
                                <h3 className="font-bold line-clamp-1">{item.name}</h3>
                                <p className="text-xs text-gray-500 line-clamp-2 mt-1">{item.description}</p>
                                <div className="mt-3 font-bold text-primary-700">{item.priceDefault} YER</div>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && <p className="col-span-full text-center text-gray-400 py-10">لا توجد أصناف</p>}
                </div>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="صنف جديد">
                <form onSubmit={handleSave} className="space-y-3">
                    <input type="text" placeholder="الاسم" required className="w-full border p-2 rounded" onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    <input type="number" placeholder="السعر" required className="w-full border p-2 rounded" onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
                    <textarea placeholder="الوصف" className="w-full border p-2 rounded" onChange={e => setFormData({ ...formData, desc: e.target.value })} />
                    <input type="file" onChange={e => setFormData({ ...formData, image: e.target.files ? e.target.files[0] : null })} className="w-full text-sm" />
                    <Button type="submit" className="w-full">حفظ</Button>
                </form>
            </Modal>
        </div>
    );
};
