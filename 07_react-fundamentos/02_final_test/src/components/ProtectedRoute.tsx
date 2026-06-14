import { Navigate, Outlet } from 'react-router';

interface ProtectedRouteProps {
    isAuthenticated: boolean;
}

export function ProtectedRoute({
    isAuthenticated,
}: ProtectedRouteProps) {
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
