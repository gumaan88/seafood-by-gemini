import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, NotificationProvider, ToastProvider, AuthContext } from './contexts/AppContext';
import Navbar from './components/Navbar';
import { LoadingSpinner } from './components/UI';
import { UserRole } from './types';

// Lazy Load Pages for Performance
const Login = React.lazy(() => import('./pages/Auth').then(module => ({ default: module.Login })));
const Register = React.lazy(() => import('./pages/Auth').then(module => ({ default: module.Register })));
const CustomerHome = React.lazy(() => import('./pages/Customer').then(module => ({ default: module.CustomerHome })));
const MyReservations = React.lazy(() => import('./pages/Customer').then(module => ({ default: module.MyReservations })));
const ProvidersList = React.lazy(() => import('./pages/Customer').then(module => ({ default: module.ProvidersList })));
const ProviderDashboard = React.lazy(() => import('./pages/Provider').then(module => ({ default: module.ProviderDashboard })));
const ProviderCatalog = React.lazy(() => import('./pages/Provider').then(module => ({ default: module.ProviderCatalog })));
const ProviderOffers = React.lazy(() => import('./pages/Provider').then(module => ({ default: module.ProviderOffers })));
const ProviderReservations = React.lazy(() => import('./pages/Provider').then(module => ({ default: module.ProviderReservations })));

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: UserRole[] }) => {
    const { currentUser, userProfile, loading } = React.useContext(AuthContext);
    if (loading) return <LoadingSpinner />;
    if (!currentUser) return <Navigate to="/login" />;
    if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) return <Navigate to="/" />;
    return <>{children}</>;
};

const AppContent = () => {
    return (
        <div className="flex flex-col min-h-screen font-sans bg-gray-50">
            <Navbar />
            <div className="flex-grow pt-4">
                <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<CustomerHome />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/providers" element={<ProvidersList />} />
                        
                        {/* Customer Protected */}
                        <Route path="/my-reservations" element={<ProtectedRoute allowedRoles={['customer']}><MyReservations /></ProtectedRoute>} />
                        
                        {/* Provider Protected */}
                        <Route path="/provider/dashboard" element={<ProtectedRoute allowedRoles={['provider']}><ProviderDashboard /></ProtectedRoute>} />
                        <Route path="/provider/catalog" element={<ProtectedRoute allowedRoles={['provider']}><ProviderCatalog /></ProtectedRoute>} />
                        <Route path="/provider/offers" element={<ProtectedRoute allowedRoles={['provider']}><ProviderOffers /></ProtectedRoute>} />
                        <Route path="/provider/reservations" element={<ProtectedRoute allowedRoles={['provider']}><ProviderReservations /></ProtectedRoute>} />
                        
                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Suspense>
            </div>
            <footer className="bg-primary-900 text-primary-100 text-center py-6 mt-12">
                <p className="font-medium opacity-80">&copy; {new Date().getFullYear()} حجزي - Hajzi</p>
            </footer>
        </div>
    );
};

const App = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastProvider>
            <HashRouter>
                <AppContent />
            </HashRouter>
        </ToastProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
