import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { NewProductPage } from './pages/NewProductPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProductPage } from './pages/ProductPage';
import { ProductsPage } from './pages/ProductsPage';
import { clearToken, hasToken } from './services/auth-storage';

export function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(hasToken());

    const handleLogin = () => {
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        clearToken();
        setIsAuthenticated(false);
    };

    return (
        <Routes>
            <Route
                path="/login"
                element={
                    <LoginPage
                        isAuthenticated={isAuthenticated}
                        onLogin={handleLogin}
                    />
                }
            />

            <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
                <Route element={<Layout onLogout={handleLogout} />}>
                    <Route
                        path="/"
                        element={<Navigate to="/products" replace />}
                    />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/products/new" element={<NewProductPage />} />
                    <Route path="/products/:id" element={<ProductPage />} />
                    <Route path="/404" element={<NotFoundPage />} />
                </Route>
            </Route>

            <Route
                path="*"
                element={<NotFoundPage />}
            />
        </Routes>
    );
}
