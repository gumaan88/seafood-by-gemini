import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom'; // Using react-router-dom standard link
import { AuthContext, NotificationContext } from '../contexts/AppContext';
import { BellIcon, UserGroupIcon, ArrowRightOnRectangleIcon, XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';

const Navbar = () => {
    const { userProfile, logout } = useContext(AuthContext);
    const { notifications, unreadCount, markAsRead } = useContext(NotificationContext);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login'; // Force reload/redirect
    };

    return (
        <nav className="bg-gradient-to-r from-primary-900 to-primary-700 text-white shadow-lg sticky top-0 z-50 backdrop-blur-sm bg-opacity-95">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-2">
                        <Link to="/" className="text-2xl font-bold font-sans flex items-center gap-2 hover:opacity-90 transition-opacity">
                            <span className="text-3xl">✨</span><span>حجزي - Hajzi</span>
                        </Link>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-center space-x-4 space-x-reverse">
                            {userProfile ? (
                                <>
                                    <div className="relative" ref={notifRef}>
                                        <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 rounded-full hover:bg-white/10 relative transition-colors">
                                            <BellIcon className="w-6 h-6 text-primary-100" />
                                            {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center border border-primary-900 animate-pulse">{unreadCount}</span>}
                                        </button>
                                        {isNotifOpen && (
                                            <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl py-2 text-gray-800 z-50 overflow-hidden border border-gray-100 animate-slide-up">
                                                <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                                    <h3 className="font-bold text-sm">الإشعارات</h3>
                                                    <span className="text-xs text-gray-500">{unreadCount} جديد</span>
                                                </div>
                                                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                                                    {notifications.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">لا توجد إشعارات حالياً</div> : notifications.map(notif => (
                                                        <div key={notif.id} onClick={() => markAsRead(notif.id)} className={`px-4 py-3 border-b border-gray-50 hover:bg-primary-50 cursor-pointer transition-colors ${!notif.read ? 'bg-blue-50/50' : ''}`}>
                                                            <div className="flex justify-between items-start">
                                                                <p className={`text-sm ${!notif.read ? 'font-bold text-primary-800' : 'text-gray-700'}`}>{notif.title}</p>
                                                                <span className="text-[10px] text-gray-400">{new Date(notif.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.body}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/20">
                                        <UserGroupIcon className="w-5 h-5 text-primary-200" />
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
                                            <Link to="/my-reservations" className="nav-link">حجوزاتي</Link>
                                        </>
                                    )}
                                    <button onClick={handleLogout} className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full transition-colors" title="تسجيل الخروج">
                                        <ArrowRightOnRectangleIcon className="h-5 w-5" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" className="nav-link">دخول</Link>
                                    <Link to="/register" className="bg-white text-primary-800 hover:bg-primary-50 px-4 py-2 rounded-lg font-bold transition-all shadow-md transform hover:-translate-y-0.5">حساب جديد</Link>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="-mr-2 flex md:hidden gap-2">
                        {userProfile && <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 relative"><BellIcon className="h-6 w-6 text-gray-200" />{unreadCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full"></span>}</button>}
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="bg-primary-800 p-2 rounded-md text-gray-200 hover:text-white focus:outline-none">
                            {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>
            {isNotifOpen && (
                <div className="md:hidden bg-white text-gray-800 max-h-60 overflow-y-auto border-t border-b border-gray-200">
                    {notifications.length === 0 && <div className="p-4 text-center text-sm text-gray-400">لا توجد إشعارات</div>}
                    {notifications.map(n => (
                        <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-3 border-b border-gray-100 ${!n.read ? 'bg-blue-50' : ''}`}>
                            <div className="font-bold text-sm">{n.title}</div>
                            <div className="text-xs text-gray-600">{n.body}</div>
                        </div>
                    ))}
                </div>
            )}
            {isMenuOpen && (
                <div className="md:hidden bg-primary-800 border-t border-primary-700 animate-fade-in">
                    <div className="px-4 pt-2 pb-6 space-y-2">
                        {userProfile ? (
                            <>
                                <div className="text-primary-200 px-3 py-3 border-b border-primary-700 mb-2">مرحباً، {userProfile.name}</div>
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
                                        <Link to="/my-reservations" className="block mobile-nav-link">حجوزاتي</Link>
                                    </>
                                )}
                                <button onClick={handleLogout} className="w-full text-right block bg-red-600/90 text-white px-3 py-3 rounded-md mt-4">تسجيل خروج</button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="block mobile-nav-link">دخول</Link>
                                <Link to="/register" className="block bg-primary-500 text-white px-3 py-3 rounded-md mt-2 font-bold">حساب جديد</Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};
export default Navbar;
