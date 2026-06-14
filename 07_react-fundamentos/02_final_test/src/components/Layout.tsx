import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { ConfirmAction } from './ConfirmAction';

interface LayoutProps {
    onLogout: () => void;
}

export function Layout({ onLogout }: LayoutProps) {
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        onLogout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="app-shell">
            <header className="app-header">
                <h1 className="app-header__title">Dashboard de productos</h1>

                <div className="app-header__right">
                    <nav className="nav">
                        <NavLink
                            to="/products"
                            className={({ isActive }) =>
                                isActive
                                    ? 'nav__link nav__link--active'
                                    : 'nav__link'
                            }
                        >
                            Productos
                        </NavLink>

                        <NavLink
                            to="/products/new"
                            className={({ isActive }) =>
                                isActive
                                    ? 'nav__link nav__link--active'
                                    : 'nav__link'
                            }
                        >
                            Nuevo producto
                        </NavLink>
                    </nav>

                    <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => setShowLogoutConfirm(true)}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </header>

            <main>
                {showLogoutConfirm && (
                    <section className="page">
                        <ConfirmAction
                            message="¿Quieres cerrar la sesión?"
                            confirmLabel="Cerrar sesión"
                            onConfirm={handleLogout}
                            onCancel={() => setShowLogoutConfirm(false)}
                        />
                    </section>
                )}

                <Outlet />
            </main>
        </div>
    );
}
