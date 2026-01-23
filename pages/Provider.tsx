import React, { useState, useEffect, useContext, useMemo } from 'react';
import { db, collection, query, where, getDocs, doc, addDoc, updateDoc, deleteDoc, writeBatch, uploadFile, increment } from '../services/firebase';
import { AuthContext, NotificationContext, ToastContext } from '../contexts/AppContext';
import { Card, Button, Badge, SkeletonCard, Modal, LoadingSpinner } from '../components/UI';
import { CatalogItem, Offering, Reservation, ProviderCategory, Currency, ReservationStatus } from '../types';
import { 
    ShoppingBagIcon, CalendarIcon, ClipboardDocumentCheckIcon, CurrencyDollarIcon, 
    PlusIcon, PencilSquareIcon, TrashIcon, EyeIcon, EyeSlashIcon, MagnifyingGlassIcon, 
    FolderIcon, Squares2X2Icon, TagIcon, BanknotesIcon, ListBulletIcon, ChartBarIcon, 
    CalendarDaysIcon, BoltIcon, FireIcon, CheckCircleIcon, XCircleIcon, ClockIcon, 
    TableCellsIcon, UserIcon, XMarkIcon, LightBulbIcon, FunnelIcon, AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

const getSaudiDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

// --- DASHBOARD ---
export const ProviderDashboard = () => {
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
                    if (data.status === 'completed') rev += data.totalPrice;
                });
                setStats({ items: itemsSnap.size, offers: offersSnap.size, reservations: resSnap.size, revenue: rev, followers: 0 });
            } catch (e) { console.error(e); }
        };
        fetchStats();
    }, [userProfile]);

    const StatCard = ({ title, value, color, icon }: any) => (
        <Card className={`p-6 flex items-center justify-between border-l-4 overflow-hidden relative group hover:-translate-y-1 transition-transform`} style={{ borderLeftColor: color }}>
            <div className="relative z-10">
                <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-4xl font-extrabold text-gray-800 tracking-tight">{value}</h3>
            </div>
            <div className={`p-4 rounded-xl text-white shadow-lg relative z-10`} style={{ background: color }}>{icon}</div>
        </Card>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">لوحة التحكم</h1>
                <p className="text-gray-500 mt-2">نظرة عامة على نشاطك اليوم</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="الأصناف / الخدمات" value={stats.items} color="#6366f1" icon={<ShoppingBagIcon className="w-6 h-6" />} />
                <StatCard title="العروض النشطة" value={stats.offers} color="#10b981" icon={<CalendarIcon className="w-6 h-6" />} />
                <StatCard title="إجمالي الحجوزات" value={stats.reservations} color="#f59e0b" icon={<ClipboardDocumentCheckIcon className="w-6 h-6" />} />
                <StatCard title="الإيرادات" value={`${stats.revenue.toLocaleString()}`} color="#8b5cf6" icon={<CurrencyDollarIcon className="w-6 h-6" />} />
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
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [groupBy, setGroupBy] = useState<'none' | 'customer' | 'item'>('none');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fetchReservations = async () => {
        if (!userProfile) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'reservations'), where('providerId', '==', userProfile.uid));
            const snap = await getDocs(q);
            setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)));
        } catch (e) { showToast("فشل تحميل البيانات", 'error'); } finally { setLoading(false); }
    };

    useEffect(() => { fetchReservations(); }, [userProfile]);

    const filteredReservations = useMemo(() => {
        let result = reservations;
        const fromTs = new Date(dateFrom).setHours(0, 0, 0, 0);
        const toTs = new Date(dateTo).setHours(23, 59, 59, 999);
        result = result.filter(r => r.createdAt >= fromTs && r.createdAt <= toTs);
        if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r => r.customerName.toLowerCase().includes(q) || r.offeringName.toLowerCase().includes(q));
        }
        return result.sort((a, b) => b.createdAt - a.createdAt);
    }, [reservations, dateFrom, dateTo, statusFilter, searchQuery]);

    const stats = useMemo(() => {
        const total = filteredReservations.length;
        const pending = filteredReservations.filter(r => r.status === 'pending').length;
        const confirmed = filteredReservations.filter(r => r.status === 'confirmed').length;
        const revenue = filteredReservations.reduce((acc, curr) => (curr.status === 'completed' || curr.status === 'confirmed') ? acc + curr.totalPrice : acc, 0);
        const itemCounts: Record<string, number> = {};
        filteredReservations.forEach(r => { itemCounts[r.offeringName] = (itemCounts[r.offeringName] || 0) + r.quantity; });
        return { total, pending, confirmed, revenue, itemCounts };
    }, [filteredReservations]);

    const toggleSelect = (id: string) => {
        if (statusFilter === 'all') return;
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (statusFilter === 'all') return;
        if (selectedIds.size === filteredReservations.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredReservations.map(r => r.id)));
    };

    const handleBulkAction = async () => {
        if (!confirm(`هل أنت متأكد من تحديث حالة ${selectedIds.size} حجوزات؟`)) return;
        let newStatus: ReservationStatus = statusFilter === 'pending' ? 'confirmed' : statusFilter === 'confirmed' ? 'completed' : 'confirmed';
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
            const ref = doc(db, 'reservations', id);
            batch.update(ref, { status: newStatus });
            const res = reservations.find(r => r.id === id);
            if (res) sendNotification(res.customerId, 'تحديث الحجز', `تم تغيير حالة حجزك ${res.offeringName} إلى ${newStatus === 'confirmed' ? 'مؤكد' : 'مكتمل'}`);
        });
        try {
            await batch.commit();
            showToast("تم التحديث بنجاح", "success");
            setSelectedIds(new Set());
            fetchReservations();
        } catch (e) { showToast("حدث خطأ", "error"); }
    };

    const handleSingleStatus = async (id: string, status: ReservationStatus) => {
        try {
            await updateDoc(doc(db, 'reservations', id), { status });
            const res = reservations.find(r => r.id === id);
            if (res) await sendNotification(res.customerId, 'تحديث الحجز', `حالة حجز ${res.offeringName}: ${status === 'confirmed' ? 'مؤكد' : status === 'completed' ? 'مكتمل' : 'ملغي'}`, status === 'cancelled' ? 'warning' : 'success');
            showToast("تم تحديث الحالة", "success");
            fetchReservations();
        } catch (e) { showToast("خطأ", "error"); }
    };

    const groupedReservations = useMemo(() => {
        if (groupBy === 'none') return null;
        const groups: Record<string, { name: string, items: Reservation[], total: number }> = {};
        filteredReservations.forEach(r => {
            let key = groupBy === 'customer' ? r.customerId : r.offeringName;
            let name = groupBy === 'customer' ? r.customerName : r.offeringName;
            if (!groups[key]) groups[key] = { name, items: [], total: 0 };
            groups[key].items.push(r);
            if (r.status !== 'cancelled') groups[key].total += r.totalPrice;
        });
        return Object.values(groups);
    }, [filteredReservations, groupBy]);

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 min-h-screen animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><ClipboardDocumentCheckIcon className="w-8 h-8 text-primary-600" /> إدارة الحجوزات</h1>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                    <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm border-none focus:ring-0 text-gray-600 font-medium outline-none" />
                    <span className="text-gray-400">-</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm border-none focus:ring-0 text-gray-600 font-medium outline-none" />
                </div>
            </div>
            {loading ? <div className="grid gap-4"><SkeletonCard /><SkeletonCard /></div> : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-primary-500">
                            <p className="text-xs text-gray-500 font-bold mb-1">العدد</p>
                            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-yellow-500">
                            <p className="text-xs text-gray-500 font-bold mb-1">معلق</p>
                            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-green-500">
                            <p className="text-xs text-gray-500 font-bold mb-1">مؤكد</p>
                            <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border-r-4 border-purple-500">
                            <p className="text-xs text-gray-500 font-bold mb-1">الإيرادات</p>
                            <p className="text-2xl font-bold text-purple-600">{stats.revenue.toLocaleString()}</p>
                        </div>
                    </div>
                    {Object.keys(stats.itemCounts).length > 0 &&
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {Object.entries(stats.itemCounts).map(([name, count]) => (
                                <div key={name} className="flex-shrink-0 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-2 text-sm">
                                    <span className="text-gray-600 font-medium">{name}</span>
                                    <span className="bg-primary-100 text-primary-700 px-2 rounded-full font-bold text-xs">{count}</span>
                                </div>
                            ))}
                        </div>
                    }
                    <Card className="p-4 flex flex-col lg:flex-row gap-4 justify-between items-center sticky top-20 z-40 shadow-md">
                        <div className="flex flex-1 w-full gap-4 flex-col sm:flex-row">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                                <input type="text" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
                                {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(st => (
                                    <button key={st} onClick={() => { setStatusFilter(st); setSelectedIds(new Set()); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${statusFilter === st ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>{st === 'all' ? 'الكل' : st}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 border-r pr-4 border-gray-200">
                            <button onClick={() => setGroupBy('none')} className={`p-2 rounded-lg ${groupBy === 'none' ? 'bg-primary-100 text-primary-700' : 'text-gray-400'}`}><TableCellsIcon className="w-6 h-6" /></button>
                            <button onClick={() => setGroupBy('customer')} className={`p-2 rounded-lg ${groupBy === 'customer' ? 'bg-primary-100 text-primary-700' : 'text-gray-400'}`}><UserIcon className="w-6 h-6" /></button>
                            <button onClick={() => setGroupBy('item')} className={`p-2 rounded-lg ${groupBy === 'item' ? 'bg-primary-100 text-primary-700' : 'text-gray-400'}`}><TagIcon className="w-6 h-6" /></button>
                        </div>
                    </Card>
                    {selectedIds.size > 0 && statusFilter !== 'all' && (
                        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4 animate-slide-up">
                            <span className="font-bold text-sm bg-gray-700 px-2 py-0.5 rounded-md">{selectedIds.size}</span>
                            <button onClick={handleBulkAction} className="hover:text-green-400 font-bold text-sm flex items-center gap-1">تنفيذ الإجراء</button>
                            <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                    )}
                    {filteredReservations.length === 0 ?
                        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
                            <div className="text-6xl mb-4">📭</div>
                            <h3 className="text-xl font-bold text-gray-700">لا توجد حجوزات</h3>
                        </div> : (
                            <>
                                {groupBy === 'none' && (
                                    <div className="space-y-4">
                                        {statusFilter !== 'all' && <div className="flex items-center gap-2 px-2 text-sm text-gray-500 font-medium"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === filteredReservations.length && filteredReservations.length > 0} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" /><span>تحديد الكل</span></div>}
                                        {filteredReservations.map(res => (
                                            <Card key={res.id} className={`p-4 flex flex-col md:flex-row items-center gap-4 transition-all ${selectedIds.has(res.id) ? 'ring-2 ring-primary-500 bg-primary-50' : 'hover:border-primary-300'}`}>
                                                {statusFilter !== 'all' && (<input type="checkbox" checked={selectedIds.has(res.id)} onChange={() => toggleSelect(res.id)} className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />)}
                                                <div className="flex-1 w-full md:w-auto">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="font-bold text-gray-900">{res.offeringName}</h3>
                                                            <p className="text-sm text-gray-500 flex items-center gap-1"><UserIcon className="w-3 h-3" /> {res.customerName}</p>
                                                        </div>
                                                        <Badge status={res.status} />
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                                                        <span className="flex items-center gap-1"><ClockIcon className="w-4 h-4 text-gray-400" /> {new Date(res.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <span className="flex items-center gap-1 font-bold text-primary-700"><CurrencyDollarIcon className="w-4 h-4" /> {res.totalPrice} ر.ي</span>
                                                    </div>
                                                    {res.paymentReference && <div className="mt-2 bg-green-50 text-green-800 text-xs px-2 py-1 rounded inline-flex items-center gap-1"><BanknotesIcon className="w-3 h-3" /> مرجع الدفع: {res.paymentReference}</div>}
                                                </div>
                                                <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                                                    {res.status === 'pending' && (
                                                        <>
                                                            <Button variant="ghost" onClick={() => handleSingleStatus(res.id, 'confirmed')} className="text-green-600 bg-green-50 hover:bg-green-100"><CheckCircleIcon className="w-5 h-5" /></Button>
                                                            <Button variant="ghost" onClick={() => handleSingleStatus(res.id, 'cancelled')} className="text-red-600 bg-red-50 hover:bg-red-100"><XCircleIcon className="w-5 h-5" /></Button>
                                                        </>
                                                    )}
                                                    {res.status === 'confirmed' && (<Button variant="ghost" onClick={() => handleSingleStatus(res.id, 'completed')} className="text-blue-600 bg-blue-50 hover:bg-blue-100">إتمام</Button>)}
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                                {groupBy !== 'none' && groupedReservations && (
                                    <div className="space-y-6">
                                        {groupedReservations.map((group, idx) => (
                                            <div key={idx} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                                                <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">{group.name[0]}</div>
                                                        <div>
                                                            <h3 className="font-bold text-gray-800">{group.name}</h3>
                                                            <p className="text-xs text-gray-500">{group.items.length} حجوزات</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-primary-700">{group.total} ر.ي</div>
                                                    </div>
                                                </div>
                                                <div className="divide-y divide-gray-100">
                                                    {group.items.map(res => (
                                                        <div key={res.id} className="p-4 hover:bg-gray-50 flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                {statusFilter !== 'all' && (<input type="checkbox" checked={selectedIds.has(res.id)} onChange={() => toggleSelect(res.id)} className="w-4 h-4 rounded text-primary-600" />)}
                                                                <div>
                                                                    <p className="font-medium text-sm text-gray-800">{groupBy === 'item' ? res.customerName : res.offeringName} (x{res.quantity})</p>
                                                                    <p className="text-xs text-gray-500">{new Date(res.createdAt).toLocaleTimeString('ar-SA')}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Badge status={res.status} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                </>
            )}
        </div>
    );
};

// --- OFFERS ---
export const ProviderOffers = () => {
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
            const itemsSnap = await getDocs(query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid), where('isActive', '==', true)));
            setItems(itemsSnap.docs.map(d => ({id: d.id, ...d.data()} as CatalogItem)));
            
            const offersSnap = await getDocs(query(collection(db, 'offerings'), where('providerId', '==', userProfile.uid)));
            setOffers(offersSnap.docs.map(d => ({id: d.id, ...d.data()} as Offering)));
        } catch(e) { console.error(e); showToast("خطأ في تحميل البيانات", "error"); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [userProfile]);

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
        setEditingOfferId(null); setSelectedItemForOffer(null);
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
                itemId: selectedItemForOffer.id, providerId: userProfile.uid, itemName: selectedItemForOffer.name, 
                itemImageUrl: selectedItemForOffer.imageUrl, price: Number(newOfferData.price), 
                quantityTotal: Number(newOfferData.quantity), 
                quantityRemaining: editingOfferId 
                    ? Number(newOfferData.quantity) - (offers.find(o=>o.id===editingOfferId)?.quantityTotal! - offers.find(o=>o.id===editingOfferId)?.quantityRemaining!) 
                    : Number(newOfferData.quantity),
                date: newOfferData.date, isActive: true 
            };

            if (editingOfferId) {
                await updateDoc(doc(db, 'offerings', editingOfferId), payload);
                showToast("تم تحديث العرض", "success");
            } else {
                await addDoc(collection(db, 'offerings'), payload);
                showToast("تم نشر العرض بنجاح", "success");
            }
            setIsCreateModalOpen(false); loadData();
        } catch(e) { showToast("خطأ في العملية", "error"); }
    };

    const handleToggleStatus = async (offer: Offering) => {
        try {
            await updateDoc(doc(db, 'offerings', offer.id), { isActive: !offer.isActive });
            showToast(!offer.isActive ? "تم تفعيل العرض" : "تم إيقاف العرض", "info");
            loadData();
        } catch(e) { showToast("خطأ في التحديث", "error"); }
    };

    const handleDeleteOffer = async (id: string) => {
        if(!confirm("حذف العرض نهائياً؟")) return;
        try { await deleteDoc(doc(db, 'offerings', id)); setOffers(prev => prev.filter(o => o.id !== id)); showToast("تم الحذف", "success"); } catch(e) { showToast("خطأ", "error"); }
    };

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
        <div className="p-6 max-w-7xl mx-auto min-h-screen space-y-8 animate-fade-in">
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
                <div className="w-full sm:w-auto flex gap-2">
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
                            <Button onClick={openCreateModal} variant="outline">إنشاء عرض الآن</Button>
                        </div>
                    )}
                    {filteredOffers.map(offer => {
                        const sold = offer.quantityTotal - offer.quantityRemaining;
                        const percentSold = (sold / offer.quantityTotal) * 100;
                        const recommendation = getRecommendation(offer);
                        let progressColor = "bg-primary-500";
                        if (percentSold > 80) progressColor = "bg-green-500"; else if (percentSold < 20) progressColor = "bg-red-400"; else progressColor = "bg-orange-400";

                        return (
                            <div key={offer.id} className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col relative">
                                <div className="absolute top-3 left-3 z-10 flex gap-2">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md ${offer.isActive ? 'bg-white/90 text-green-700' : 'bg-red-100 text-red-700'}`}>{offer.isActive ? (offer.quantityRemaining === 0 ? 'نفذت الكمية' : 'نشط') : 'متوقف'}</span>
                                </div>
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
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                                        <button onClick={() => handleEditOffer(offer)} className="p-2 bg-white/90 rounded-full shadow-md text-gray-700 hover:text-primary-600 hover:bg-white transition-colors" title="تعديل"><PencilSquareIcon className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteOffer(offer.id)} className="p-2 bg-white/90 rounded-full shadow-md text-gray-700 hover:text-red-600 hover:bg-white transition-colors" title="حذف"><TrashIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <div className="p-5 flex-1 flex flex-col gap-4">
                                    {recommendation && (<div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 font-bold ${recommendation.color}`}><LightBulbIcon className="w-4 h-4"/> {recommendation.text}</div>)}
                                    <div>
                                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2"><span>تم بيع <span className="text-gray-900 text-sm">{sold}</span> من {offer.quantityTotal}</span><span className={`${offer.quantityRemaining < 3 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>متبقي {offer.quantityRemaining}</span></div>
                                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner"><div className={`h-full rounded-full transition-all duration-1000 ${progressColor}`} style={{ width: `${percentSold}%` }}></div></div>
                                    </div>
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
                    <div className="space-y-4">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400"/>
                            <input type="text" placeholder="ابحث عن صنف..." className="w-full pr-10 pl-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50" value={itemSearch} onChange={e => setItemSearch(e.target.value)} autoFocus />
                        </div>
                        <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                            {filteredItemsForSelection.map(item => (
                                <div key={item.id} onClick={() => { setSelectedItemForOffer(item); setNewOfferData({...newOfferData, price: item.priceDefault}); }} className="cursor-pointer border border-gray-200 rounded-xl p-3 hover:border-primary-500 hover:bg-primary-50 transition-all flex flex-col items-center text-center gap-2 group">
                                    <img src={item.imageUrl} className="w-16 h-16 rounded-lg object-cover bg-gray-200" alt="" />
                                    <div><p className="font-bold text-sm text-gray-800 line-clamp-1">{item.name}</p><p className="text-xs text-primary-600 font-medium">{item.priceDefault} ر.ي</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5 animate-slide-up">
                        <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <img src={selectedItemForOffer.imageUrl} className="w-16 h-16 rounded-lg object-cover" alt="" />
                            <div><h4 className="font-bold text-gray-800">{selectedItemForOffer.name}</h4><button onClick={() => setSelectedItemForOffer(null)} className="text-xs text-primary-600 font-medium hover:underline">تغيير الصنف</button></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">سعر العرض</label><input type="number" className="w-full px-4 py-3 border rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-primary-500 outline-none" value={newOfferData.price || ''} onChange={e => setNewOfferData({...newOfferData, price: Number(e.target.value)})} /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">الكمية الكلية</label><input type="number" className="w-full px-4 py-3 border rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-primary-500 outline-none" value={newOfferData.quantity} onChange={e => setNewOfferData({...newOfferData, quantity: Number(e.target.value)})} /></div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">تاريخ العرض / الموعد</label><input type="date" className="w-full px-4 py-3 border rounded-xl text-gray-800 focus:ring-2 focus:ring-primary-500 outline-none" value={newOfferData.date} onChange={e => setNewOfferData({...newOfferData, date: e.target.value})} /></div>
                        <Button onClick={handleSaveOffer} className="w-full py-3 text-lg shadow-lg shadow-primary-500/30">{editingOfferId ? "حفظ التعديلات" : "نشر العرض فوراً"}</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// --- CATALOG ---
// Extracted Item Card
const ItemCard = ({ item, onEdit, onToggleStatus }: { item: CatalogItem, onEdit: (i: CatalogItem) => void, onToggleStatus: (i: CatalogItem) => void }) => {
    return (
        <div className={`group relative bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-xl transition-all duration-300 ${!item.isActive ? 'opacity-75 border-gray-200 bg-gray-50' : 'border-gray-100'}`}>
            <div className="absolute inset-0 bg-gray-900/90 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white p-4 text-center backdrop-blur-sm">
                <div className="mb-4">
                    <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">الإيرادات المحققة</p>
                    <p className="text-2xl font-bold flex items-center justify-center gap-1">{item.stats?.totalRevenue?.toLocaleString() || 0} <span className="text-xs text-primary-300">{item.currency || 'YER'}</span></p>
                    <p className="text-xs text-gray-400 mt-1">{item.stats?.totalSold || 0} مبيعات</p>
                </div>
                <div className="flex gap-2 w-full px-4">
                    <button onClick={() => onEdit(item)} className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"><PencilSquareIcon className="w-4 h-4"/> تعديل</button>
                    <button onClick={() => onToggleStatus(item)} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors ${item.isActive ? 'bg-red-500/20 hover:bg-red-500/40 text-red-200' : 'bg-green-500/20 hover:bg-green-500/40 text-green-200'}`}>{item.isActive ? <><EyeSlashIcon className="w-4 h-4"/> تعطيل</> : <><EyeIcon className="w-4 h-4"/> تفعيل</>}</button>
                </div>
            </div>
            <div className="h-40 overflow-hidden bg-gray-100 relative">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                    <span className="bg-white/95 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold text-gray-600 shadow-sm">{item.category}</span>
                    {!item.isActive && <span className="bg-red-500 text-white px-2 py-1 rounded-md text-[10px] font-bold shadow-sm">معطل</span>}
                </div>
            </div>
            <div className="p-4">
                <div className="flex justify-between items-start mb-1"><h3 className="font-bold text-gray-900 line-clamp-1">{item.name}</h3></div>
                <p className="text-xs text-gray-500 line-clamp-2 min-h-[2.5em]">{item.description}</p>
                <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-primary-700 bg-primary-50 px-2 py-1 rounded text-sm">{item.priceDefault} <span className="text-[10px] font-normal">{item.currency || 'YER'}</span></span>
                    {item.stats && item.stats.totalSold > 0 && <span className="text-[10px] text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded"><ChartBarIcon className="w-3 h-3"/> {item.stats.totalSold}</span>}
                </div>
            </div>
        </div>
    );
};

export const ProviderCatalog = () => {
    const { userProfile, providerProfile, refreshProfile } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'items' | 'categories'>('items');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
    const [isGrouped, setIsGrouped] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formPrice, setFormPrice] = useState(0);
    const [formCurrency, setFormCurrency] = useState<Currency>('YER');
    const [formCategory, setFormCategory] = useState('');
    const [formImage, setFormImage] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [newCatName, setNewCatName] = useState('');

    const fetchData = async () => {
        if(!userProfile) return;
        setLoading(true);
        try {
            const itemsSnap = await getDocs(query(collection(db, 'catalogItems'), where('providerId', '==', userProfile.uid)));
            const itemsData = itemsSnap.docs.map(d => ({id: d.id, ...d.data()} as CatalogItem));
            const resSnap = await getDocs(query(collection(db, 'reservations'), where('providerId', '==', userProfile.uid), where('status', '==', 'completed')));
            const resData = resSnap.docs.map(d => d.data() as Reservation);
            itemsData.forEach(item => {
                const itemRes = resData.filter(r => r.offeringName === item.name);
                item.stats = { totalSold: itemRes.reduce((acc, curr) => acc + curr.quantity, 0), totalRevenue: itemRes.reduce((acc, curr) => acc + curr.totalPrice, 0) };
            });
            setItems(itemsData);
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [userProfile]);

    const availableCategories = useMemo(() => providerProfile?.savedCategories || ['عام'], [providerProfile]);
    const filteredItems = useMemo(() => items.filter(i => (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.category.toLowerCase().includes(searchQuery.toLowerCase())) && (activeCategoryFilter === 'all' || i.category === activeCategoryFilter)), [items, searchQuery, activeCategoryFilter]);
    const revenueByCurrency = useMemo(() => { const stats: Record<string, number> = {}; items.forEach(item => { const curr = item.currency || 'YER'; if(item.stats?.totalRevenue) stats[curr] = (stats[curr] || 0) + item.stats.totalRevenue; }); return stats; }, [items]);

    const openModal = (item?: CatalogItem) => {
        if(item) { setEditingItem(item); setFormName(item.name); setFormDesc(item.description); setFormPrice(item.priceDefault); setFormCurrency(item.currency || 'YER'); setFormCategory(item.category); } 
        else { setEditingItem(null); setFormName(''); setFormDesc(''); setFormPrice(0); setFormCurrency('YER'); setFormCategory(availableCategories[0] || ''); setFormImage(null); }
        setIsModalOpen(true);
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!userProfile) return;
        setUploading(true);
        try {
            let imageUrl = editingItem?.imageUrl || `https://placehold.co/400x400/e2e8f0/1e293b?text=${encodeURIComponent(formName)}`;
            if (formImage) imageUrl = await uploadFile(formImage, `items/${userProfile.uid}/${Date.now()}_${formImage.name}`);
            const itemData = { providerId: userProfile.uid, name: formName, description: formDesc, priceDefault: Number(formPrice), currency: formCurrency, category: formCategory, imageUrl, isActive: editingItem ? editingItem.isActive : true };
            if (editingItem) { await updateDoc(doc(db, 'catalogItems', editingItem.id), itemData); showToast("تم التحديث", "success"); } 
            else { await addDoc(collection(db, 'catalogItems'), { ...itemData, createdAt: Date.now(), isActive: true }); showToast("تم الإضافة", "success"); }
            setIsModalOpen(false); fetchData();
        } catch(e) { showToast("خطأ", "error"); }
        setUploading(false);
    };

    const toggleItemStatus = async (item: CatalogItem) => {
        const hasHistory = (item.stats?.totalSold || 0) > 0;
        if (!hasHistory) {
            if(!confirm("حذف الصنف نهائياً؟")) return;
            try { await deleteDoc(doc(db, 'catalogItems', item.id)); showToast("تم الحذف", "success"); fetchData(); } catch(e) { showToast("خطأ", "error"); }
        } else {
            if(!confirm(`هل تريد ${!item.isActive ? "تفعيل" : "تعطيل"} الصنف؟`)) return;
            await updateDoc(doc(db, 'catalogItems', item.id), { isActive: !item.isActive }); showToast("تم التحديث", "success"); fetchData();
        }
    };

    const handleAddCategory = async () => { if(!newCatName.trim() || !userProfile) return; const currentCats = providerProfile?.savedCategories || []; if(currentCats.includes(newCatName)) return; await updateDoc(doc(db, 'providers', userProfile.uid), { savedCategories: [...currentCats, newCatName] }); refreshProfile(); setNewCatName(''); };
    const handleDeleteCategory = async (cat: string) => { if(!userProfile) return; if(items.some(i => i.category === cat && i.isActive)) { showToast("مستخدم", "error"); return; } if(!confirm("حذف التصنيف؟")) return; await updateDoc(doc(db, 'providers', userProfile.uid), { savedCategories: (providerProfile?.savedCategories || []).filter(c => c !== cat) }); refreshProfile(); };

    const StatWidget = ({title, value, subtitle, icon, gradient}: any) => (
        <div className={`p-4 rounded-xl shadow-md text-white ${gradient} flex items-center justify-between`}>
            <div><p className="text-white/80 text-xs font-medium mb-1">{title}</p><div className="text-xl font-bold">{value}</div>{subtitle && <p className="text-white/60 text-xs mt-1">{subtitle}</p>}</div>
            <div className="bg-white/20 p-2 rounded-lg">{icon}</div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div><h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><ShoppingBagIcon className="w-8 h-8 text-primary-600"/> إدارة الكتالوج</h1><p className="text-gray-500 text-sm mt-1">إدارة شاملة للمنتجات والخدمات</p></div>
                <div className="flex gap-2 bg-white p-1 rounded-lg border shadow-sm">
                    <button onClick={() => setView('items')} className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 ${view === 'items' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-50'}`}><Squares2X2Icon className="w-4 h-4"/> الأصناف</button>
                    <button onClick={() => setView('categories')} className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 ${view === 'categories' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-50'}`}><FolderIcon className="w-4 h-4"/> التصنيفات</button>
                </div>
            </div>

            {!loading && view === 'items' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatWidget title="إجمالي الإيرادات" value={<div className="flex flex-col text-sm">{Object.entries(revenueByCurrency).map(([curr, val]) => <span key={curr}>{val.toLocaleString()} {curr}</span>)}</div>} subtitle="المبيعات المكتملة" icon={<BanknotesIcon className="w-6 h-6"/>} gradient="bg-gradient-to-r from-emerald-500 to-teal-600" />
                    <StatWidget title="عدد الأصناف" value={items.length} subtitle={`${items.filter(i=>!i.isActive).length} معطل`} icon={<TagIcon className="w-6 h-6"/>} gradient="bg-gradient-to-r from-blue-500 to-indigo-600" />
                    <StatWidget title="الأكثر مبيعاً" value={items.sort((a,b)=>(b.stats?.totalSold||0)-(a.stats?.totalSold||0))[0]?.name || '-'} icon={<ChartBarIcon className="w-6 h-6"/>} gradient="bg-gradient-to-r from-purple-500 to-violet-600" />
                </div>
            )}

            {view === 'items' && (
                <>
                <Card className="p-4 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:w-96"><MagnifyingGlassIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400"/><input type="text" placeholder="بحث باسم الصنف أو التصنيف..." className="w-full pr-10 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                        <div className="flex gap-2"><button onClick={() => setIsGrouped(!isGrouped)} className={`p-2 rounded-lg border flex items-center gap-2 text-sm font-bold ${isGrouped ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-gray-600'}`}><ListBulletIcon className="w-5 h-5"/> تجميع</button><Button onClick={() => openModal()}><PlusIcon className="w-5 h-5"/> إضافة صنف</Button></div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        <button onClick={() => setActiveCategoryFilter('all')} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeCategoryFilter === 'all' ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>الكل</button>
                        {availableCategories.map(cat => (<button key={cat} onClick={() => setActiveCategoryFilter(cat)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeCategoryFilter === cat ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{cat}</button>))}
                    </div>
                </Card>
                {loading ? <div className="grid grid-cols-3 gap-4"><SkeletonCard/><SkeletonCard/></div> : (
                    <div className="space-y-8">
                        {isGrouped ? availableCategories.map(cat => { const catItems = filteredItems.filter(i => i.category === cat); return catItems.length > 0 ? (<div key={cat} className="animate-fade-in"><h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2"><FolderIcon className="w-5 h-5 text-primary-500"/> {cat} <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">{catItems.length}</span></h3><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{catItems.map(item => <ItemCard key={item.id} item={item} onEdit={openModal} onToggleStatus={toggleItemStatus} />)}</div></div>) : null; }) : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">{filteredItems.map(item => <ItemCard key={item.id} item={item} onEdit={openModal} onToggleStatus={toggleItemStatus} />)}</div>}
                        {filteredItems.length === 0 && <div className="text-center py-20 text-gray-400">لا توجد نتائج</div>}
                    </div>
                )}
                </>
            )}

            {view === 'categories' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-fade-in max-w-3xl mx-auto">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><FolderIcon className="w-6 h-6 text-primary-600"/> إدارة التصنيفات</h3>
                    <div className="flex gap-2 mb-6"><input type="text" placeholder="اسم التصنيف الجديد..." className="flex-1 border p-3 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" value={newCatName} onChange={e => setNewCatName(e.target.value)} /><Button onClick={handleAddCategory}>إضافة</Button></div>
                    <div className="space-y-2">{availableCategories.map((cat, idx) => (<div key={idx} className="flex justify-between items-center p-4 hover:bg-gray-50 rounded-xl border border-gray-100 group transition-all"><div className="flex items-center gap-3"><span className="font-bold text-gray-700">{cat}</span><span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded">{items.filter(i => i.category === cat).length} صنف</span></div><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleDeleteCategory(cat)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="حذف"><TrashIcon className="w-5 h-5"/></button></div></div>))}</div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'تعديل الصنف' : 'إضافة صنف جديد'}>
                <form onSubmit={handleSaveItem} className="space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label><input type="text" required className="w-full border p-3 rounded-xl outline-none" value={formName} onChange={e => setFormName(e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">السعر</label><input type="number" required className="w-full border p-3 rounded-xl outline-none" value={formPrice || ''} onChange={e => setFormPrice(Number(e.target.value))} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">العملة</label><select className="w-full border p-3 rounded-xl outline-none bg-white" value={formCurrency} onChange={e => setFormCurrency(e.target.value as Currency)}><option value="YER">ر.ي (YER)</option><option value="SAR">ر.س (SAR)</option><option value="USD">دولار (USD)</option></select></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label><select className="w-full border p-3 rounded-xl outline-none bg-white" value={formCategory} onChange={e => setFormCategory(e.target.value)}>{availableCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label><textarea className="w-full border p-3 rounded-xl outline-none" rows={2} value={formDesc} onChange={e => setFormDesc(e.target.value)} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">الصورة</label><input type="file" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary-50 file:text-primary-700" onChange={e => setFormImage(e.target.files ? e.target.files[0] : null)} /></div>
                    <Button type="submit" isLoading={uploading} className="w-full mt-2">حفظ</Button>
                </form>
            </Modal>
        </div>
    );
};

const SparklesIcon = ({className}:{className?:string}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;
