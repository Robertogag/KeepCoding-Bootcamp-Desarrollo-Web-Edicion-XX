import { Link } from 'react-router';

export function NotFoundPage() {
    return (
        <section className="page">
            <div className="panel panel--narrow">
                <h1>404</h1>
                <p>La pagina solicitada no existe.</p>
                <Link to="/products">Volver a productos</Link>
            </div>
        </section>
    );
}
