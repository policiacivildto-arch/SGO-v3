import React, { useState, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

// Configurações e Utilitários
import { apiClient } from './config/api';
import { PCCE_LOGO_URL } from './constants/data';


// Componentes UI e Forms
import { LoadingSpinner, Notification, Modal } from './components/ui/Shared';
import Header from './components/layout/Header';
import UpdatePhoneForm from './components/forms/UpdatePhoneForm';
import { AuthLayout } from './components/auth/AuthLayout';

// Telas de Autenticação (Certifique-se de ter criado estes arquivos em views/auth/)
import { LoginScreen } from './views/auth/LoginScreen'; 
import { SignUpScreen } from './views/auth/SignUpScreen';
import { ForgotPasswordScreen } from './views/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from './views/auth/ResetPasswordScreen';

// Dashboards Principais
import OfficerDashboard from './views/officer/OfficerDashboard';
import AdminDashboard from './views/admin/AdminDashboard';
import DashboardDepartamento from './views/departamentos/DashboardDepartamento';
import HomePage from './views/HomePage';
import OperationsDashboard from './views/operations/OperationsDashboard';

// Exemplo de CRUD Completo Django
import ExemploCicloCompleto from './examples/ExemploCicloCompleto';

// Re-export commonly-used UI/layout helpers so other modules can import from `../../App`
export { LoadingSpinner, Notification, Modal, AuthLayout, Header };
export default function App() {
    const navigate = useNavigate();
    const location = useLocation();

    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [profileModal, setProfileModal] = useState(null);
    const hasCheckedAuthRef = useRef(false);

    const resolveAuthScreen = (screen) => {
        if (screen === 'signup') {
            navigate('/signup');
            return;
        }
        if (screen === 'forgotPassword') {
            navigate('/forgot-password');
            return;
        }
        navigate('/login');
    };

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem('auth_token');

            if (!token) {
                setUser(null);
                setUserData(null);
                return;
            }

            apiClient.setToken(token);
            const response = await apiClient.getCurrentUser();
            const loadedUserData = response.user || response;

            if (loadedUserData.is_staff || loadedUserData.is_superuser) {
                loadedUserData.role = 'admin';
            } else if (response.perfil_delegacia) {
                loadedUserData.role = 'delegacia';
                loadedUserData.perfil_delegacia = response.perfil_delegacia;
                loadedUserData.departamento = response.perfil_delegacia.departamento;
                loadedUserData.departamento_id = response.perfil_delegacia.departamento_id;
                loadedUserData.delegacia = response.perfil_delegacia.delegacia;
                loadedUserData.delegacia_id = response.perfil_delegacia.delegacia_id;
            } else if (response.perfil_departamento) {
                loadedUserData.role = 'departamento';
                loadedUserData.perfil_departamento = response.perfil_departamento;
                loadedUserData.departamento = response.perfil_departamento.departamento;
                loadedUserData.departamento_id = response.perfil_departamento.departamento_id;
            } else {
                loadedUserData.role = 'officer';

                if (response.policial) {
                    Object.assign(loadedUserData, {
                        matricula: response.policial.matricula,
                        nome: response.policial.nome,
                        telefone: response.policial.telefone,
                        delegacia: response.policial.delegacia,
                        delegacia_id: response.policial.delegacia_id,
                        classe: response.policial.classe,
                        cargo: response.policial.cargo,
                        email: response.policial.email || loadedUserData.email,
                    });
                }

                try {
                    if (response.policial) {
                        setUserData(loadedUserData);
                        setUser({ email: loadedUserData.email });
                        return;
                    }

                    const policiaisResponse = await apiClient.getPoliciais({ search: loadedUserData.email || loadedUserData.username });
                    const policiais = Array.isArray(policiaisResponse)
                        ? policiaisResponse
                        : (policiaisResponse?.results || []);

                    const policial = policiais.find((item) =>
                        item?.usuario?.id === loadedUserData.id ||
                        item?.email === loadedUserData.email ||
                        item?.usuario?.username === loadedUserData.username
                    );

                    if (policial) {
                        Object.assign(loadedUserData, {
                            matricula: policial.matricula,
                            nome: policial.nome,
                            telefone: policial.telefone,
                            delegacia: policial.delegacia_nome,
                            delegacia_id: policial.delegacia,
                            classe: policial.classe,
                            cargo: policial.cargo,
                        });
                    }
                } catch (profileError) {
                    console.warn('Não foi possível carregar perfil policial completo:', profileError);
                }
            }

            setUserData(loadedUserData);
            setUser({ email: loadedUserData.email });
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            apiClient.clearAuthStorage();
            setUser(null);
            setUserData(null);
            // Redireciona para login apenas se não estiver já em rota pública
            const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
            const isPublicPath = publicPaths.some(p => window.location.pathname.startsWith(p));
            if (!isPublicPath) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hasCheckedAuthRef.current) return;
        hasCheckedAuthRef.current = true;
        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogout = async () => {
        try {
            await apiClient.logout();
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        } finally {
            setUser(null);
            setUserData(null);
            navigate('/login');
        }
    };

    const showNotification = (message, type = 'info') => setNotification({ message, type });

    const selectedSystem = location.pathname.startsWith('/operacoes')
        ? 'operacoes'
        : location.pathname.startsWith('/egide')
            ? 'egide'
            : null;

    const currentPage = location.pathname.startsWith('/egide/admin') ? 'admin' : 'dashboard';

    const setCurrentPage = (page) => {
        if (page === 'admin') {
            navigate('/egide/admin');
            return;
        }
        navigate('/egide/officer');
    };

    const handleSelectSystem = (system) => {
        if (system === 'operacoes') {
            navigate('/operacoes?view=nova-demanda');
            return;
        }
        navigate('/egide');
    };

    const handleBackToHome = () => navigate('/home');

    // Renderiza o modal de perfil (ex: trocar telefone)
    const renderProfileModal = () => {
        if (!profileModal) return null;
        
        const closeModal = () => setProfileModal(null);

        switch (profileModal) {
            case 'phone':
                return (
                    <Modal onClose={closeModal}>
                        <UpdatePhoneForm
                            currentUser={userData}
                            showNotification={showNotification}
                            onClose={closeModal}
                        />
                    </Modal>
                );
            default:
                return null;
        }
    };

    if (loading) return <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center"><img src={PCCE_LOGO_URL} alt="Brasão PCCE" className="h-24 w-auto object-contain animate-pulse" /><h1 className="text-3xl font-bold mt-4">Sistema SGO</h1><p className="text-lg text-gray-400">Carregando...</p><LoadingSpinner /></div>;

    const protectedLayout = (content) => (
        <div className="bg-gray-800 text-white min-h-screen font-sans">
            {renderProfileModal()}
            <Notification message={notification.message} type={notification.type} onDismiss={() => setNotification({ message: '', type: '' })} />

            <Header
                user={userData}
                setCurrentPage={setCurrentPage}
                currentPage={currentPage}
                onLogout={handleLogout}
                onOpenProfileModal={setProfileModal}
                selectedSystem={selectedSystem}
                onBackToHome={handleBackToHome}
            />

            <main className="p-4 md:p-8">
                {content}
            </main>
        </div>
    );

    return (
        <Routes>
            <Route
                path="/login"
                element={user ? <Navigate to="/home" replace /> : <LoginScreen showNotification={showNotification} setAuthScreen={resolveAuthScreen} onLoginSuccess={async () => {
                    await checkAuth();
                    navigate('/home');
                }} />}
            />
            <Route
                path="/signup"
                element={user ? <Navigate to="/home" replace /> : <SignUpScreen showNotification={showNotification} setAuthScreen={resolveAuthScreen} />}
            />
            <Route
                path="/forgot-password"
                element={user ? <Navigate to="/home" replace /> : <ForgotPasswordScreen showNotification={showNotification} setAuthScreen={resolveAuthScreen} />}
            />
            <Route
                path="/reset-password"
                element={user ? <Navigate to="/home" replace /> : <ResetPasswordScreen showNotification={showNotification} />}
            />

            <Route
                path="/teste-crud"
                element={user ? <ExemploCicloCompleto /> : <Navigate to="/login" replace />}
            />

            <Route
                path="/home"
                element={user ? <HomePage onSelectSystem={handleSelectSystem} /> : <Navigate to="/login" replace />}
            />

            <Route
                path="/egide"
                element={
                    !user
                        ? <Navigate to="/login" replace />
                        : userData?.role === 'admin'
                            ? <Navigate to="/egide/admin" replace />
                            : userData?.role === 'departamento' || userData?.role === 'delegacia'
                                ? protectedLayout(<DashboardDepartamento userData={userData} showNotification={showNotification} />)
                                : protectedLayout(<OfficerDashboard user={userData} showNotification={showNotification} />)
                }
            />
            <Route
                path="/egide/admin"
                element={!user ? <Navigate to="/login" replace /> : userData?.role !== 'admin' ? <Navigate to="/egide" replace /> : protectedLayout(<AdminDashboard userData={userData} showNotification={showNotification} />)}
            />
            <Route
                path="/egide/officer"
                element={!user ? <Navigate to="/login" replace /> : protectedLayout(<OfficerDashboard user={userData} showNotification={showNotification} />)}
            />

            <Route
                path="/operacoes"
                element={!user ? <Navigate to="/login" replace /> : protectedLayout(<OperationsDashboard userData={userData} showNotification={showNotification} />)}
            />

            <Route path="/" element={<Navigate to={user ? '/home' : '/login'} replace />} />
            <Route path="*" element={<Navigate to={user ? '/home' : '/login'} replace />} />
        </Routes>
    );
}

// No additional code needed at the end of the file.
// To run this React app, use the following command in your terminal:
// npm start
// or
// yarn start