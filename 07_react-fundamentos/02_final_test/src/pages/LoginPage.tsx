import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { login } from '../services/auth';
import { saveToken } from '../services/auth-storage';

interface LoginPageProps {
    isAuthenticated: boolean;
    onLogin: () => void;
}

interface LoginFormValues {
    email: string;
    password: string;
    remember: boolean;
}

const initialFormValues: LoginFormValues = {
    email: '',
    password: '',
    remember: false,
};

export function LoginPage({
    isAuthenticated,
    onLogin,
}: LoginPageProps) {
    const [formValues, setFormValues] =
        useState<LoginFormValues>(initialFormValues);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    if (isAuthenticated) {
        return <Navigate to="/products" replace />;
    }

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value, checked, type } = event.target;

        setFormValues((currentValues) => ({
            ...currentValues,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const token = await login(formValues.email.trim(), formValues.password);
            saveToken(token, formValues.remember);
            onLogin();
            navigate('/products', { replace: true });
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo iniciar sesion',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="page">
            <div className="panel panel--narrow">
                <h1>Login</h1>

                <form className="form" onSubmit={handleSubmit}>
                    <label className="field">
                        <span>Email</span>
                        <input
                            type="text"
                            name="email"
                            value={formValues.email}
                            onChange={handleChange}
                            required
                        />
                    </label>

                    <label className="field">
                        <span>Contrasena</span>
                        <input
                            type="password"
                            name="password"
                            value={formValues.password}
                            onChange={handleChange}
                            required
                        />
                    </label>

                    <label className="checkbox">
                        <input
                            type="checkbox"
                            name="remember"
                            checked={formValues.remember}
                            onChange={handleChange}
                        />
                        <span>Recordar sesion</span>
                    </label>

                    {error && <p className="error">{error}</p>}

                    <button type="submit" className="button" disabled={isSubmitting}>
                        {isSubmitting ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </section>
    );
}
