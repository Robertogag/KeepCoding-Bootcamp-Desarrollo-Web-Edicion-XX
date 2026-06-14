import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { getProducts } from '../services/products';
import type { Product } from '../types';

type SaleFilter = 'all' | 'sale' | 'not-sale';

interface FiltersState {
    name: string;
    sale: SaleFilter;
}

const initialFilters: FiltersState = {
    name: '',
    sale: 'all',
};

export function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [filters, setFilters] = useState<FiltersState>(initialFilters);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadProducts = async () => {
            try {
                const loadedProducts = await getProducts();
                setProducts(loadedProducts);
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : 'No se pudieron cargar los productos',
                );
            } finally {
                setIsLoading(false);
            }
        };

        loadProducts();
    }, []);

    const handleFilterChange = (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = event.target;

        setFilters((currentFilters) => ({
            ...currentFilters,
            [name]: value,
        }));
    };

    const filteredProducts = products.filter((product) => {
        const matchesName = product.name
            .toLowerCase()
            .includes(filters.name.trim().toLowerCase());

        const matchesSale =
            filters.sale === 'all' ||
            (filters.sale === 'sale' && product.isOnSale) ||
            (filters.sale === 'not-sale' && !product.isOnSale);

        return matchesName && matchesSale;
    });

    return (
        <section className="page">
            <div className="page__header">
                <h1>Productos</h1>
                <Link className="button-link" to="/products/new">
                    Nuevo producto
                </Link>
            </div>

            <div className="panel">
                <h2>Filtros</h2>

                <div className="filters">
                    <label className="field">
                        <span>Filtrar por nombre</span>
                        <input
                            type="text"
                            name="name"
                            value={filters.name}
                            onChange={handleFilterChange}
                            placeholder="Busca por nombre"
                        />
                    </label>

                    <label className="field">
                        <span>Filtro de oferta</span>
                        <select
                            name="sale"
                            value={filters.sale}
                            onChange={handleFilterChange}
                        >
                            <option value="all">Todos</option>
                            <option value="sale">En oferta</option>
                            <option value="not-sale">No oferta</option>
                        </select>
                    </label>
                </div>
            </div>

            {isLoading && (
                <div className="panel">
                    <p className="status">Cargando productos...</p>
                </div>
            )}

            {!isLoading && error && (
                <div className="panel">
                    <p className="error">{error}</p>
                </div>
            )}

            {!isLoading && !error && products.length === 0 && (
                <div className="panel empty">
                    <p>No hay productos creados.</p>
                    <Link className="button-link" to="/products/new">
                        Crear el primer producto
                    </Link>
                </div>
            )}

            {!isLoading &&
                !error &&
                products.length > 0 &&
                filteredProducts.length === 0 && (
                    <div className="panel">
                        <p className="status">
                            No hay productos con esos filtros.
                        </p>
                    </div>
                )}

            {!isLoading && !error && filteredProducts.length > 0 && (
                <ul className="product-list">
                    {filteredProducts.map((product) => (
                        <li key={product.id} className="product-card">
                            <h2>{product.name}</h2>

                            <div className="product-card__meta">
                                <span className="badge">
                                    {Number(product.price).toFixed(2)} USD
                                </span>

                                <span
                                    className={
                                        product.isOnSale
                                            ? 'badge badge--sale'
                                            : 'badge badge--normal'
                                    }
                                >
                                    {product.isOnSale ? 'Oferta' : 'Normal'}
                                </span>
                            </div>

                            <p>
                                <strong>Tags:</strong>{' '}
                                {product.tags.length > 0
                                    ? product.tags.join(', ')
                                    : 'Sin tags'}
                            </p>

                            <div className="product-card__actions">
                                <Link to={`/products/${product.id}`}>
                                    Ver detalle
                                </Link>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
