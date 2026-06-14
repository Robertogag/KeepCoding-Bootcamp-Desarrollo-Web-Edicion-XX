import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { ConfirmAction } from '../components/ConfirmAction';
import { ProductForm } from '../components/ProductForm';
import { deleteProduct, getProductById, updateProduct } from '../services/products';
import { getTags } from '../services/tags';
import { uploadImage } from '../services/uploads';
import type { Product, ProductFormValues } from '../types';

function getInitialFormValues(product: Product): ProductFormValues {
    return {
        name: product.name,
        price: String(product.price),
        tags: product.tags,
        imageFile: null,
        isOnSale: product.isOnSale,
        description: product.description,
    };
}

export function ProductPage() {
    const [product, setProduct] = useState<Product | null>(null);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingTags, setIsLoadingTags] = useState(true);
    const [tagsError, setTagsError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [notFound, setNotFound] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const { id } = useParams();
    const navigate = useNavigate();
    const numericId = Number(id);
    const hasInvalidId = Number.isNaN(numericId);

    useEffect(() => {
        if (hasInvalidId) {
            return;
        }

        const loadProduct = async () => {
            try {
                const loadedProduct = await getProductById(numericId);

                if (!loadedProduct) {
                    setNotFound(true);
                    return;
                }

                setProduct(loadedProduct);
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : 'No se pudo cargar el producto',
                );
            } finally {
                setIsLoading(false);
            }
        };

        const loadTags = async () => {
            try {
                const loadedTags = await getTags();
                setAvailableTags(loadedTags);
            } catch (error) {
                setTagsError(
                    error instanceof Error
                        ? error.message
                        : 'No se pudieron cargar los tags',
                );
            } finally {
                setIsLoadingTags(false);
            }
        };

        loadProduct();
        loadTags();
    }, [hasInvalidId, numericId]);

    const handleUpdate = async (values: ProductFormValues) => {
        if (!product) {
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            let imagePath = product.image;

            if (values.imageFile) {
                imagePath = await uploadImage(values.imageFile);
            }

            const updatedProduct = await updateProduct(product.id, {
                name: values.name.trim(),
                price: Number(values.price),
                tags: values.tags,
                image: imagePath,
                isOnSale: values.isOnSale,
                description: values.description.trim(),
            });

            setProduct(updatedProduct);
            setShowEditForm(false);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo actualizar el producto',
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!product) {
            return;
        }

        setIsDeleting(true);
        setError('');

        try {
            await deleteProduct(product.id);
            navigate('/products', { replace: true });
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo borrar el producto',
            );
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (hasInvalidId || notFound) {
        return <Navigate to="/404" replace />;
    }

    if (isLoading) {
        return (
            <section className="page">
                <div className="panel">
                    <p className="status">Cargando producto...</p>
                </div>
            </section>
        );
    }

    if (error && !product) {
        return (
            <section className="page">
                <div className="panel">
                    <p className="error">{error}</p>
                </div>
            </section>
        );
    }

    if (!product) {
        return null;
    }

    return (
        <section className="page">
            <div className="page__header">
                <h1>Detalle del producto</h1>
                <Link to="/products">Volver al listado</Link>
            </div>

            <div className="panel product-detail">
                {product.image ? (
                    <img
                        className="product-detail__image"
                        src={product.image}
                        alt={product.name}
                    />
                ) : (
                    <div className="product-detail__placeholder">Sin imagen</div>
                )}

                <div className="product-detail__info">
                    <h1>{product.name}</h1>
                    <p>
                        <strong>Precio:</strong>{' '}
                        {Number(product.price).toFixed(2)} USD
                    </p>
                    <p>
                        <strong>Tags:</strong>{' '}
                        {product.tags.length > 0
                            ? product.tags.join(', ')
                            : 'Sin tags'}
                    </p>
                    <p>
                        <strong>Oferta:</strong> {product.isOnSale ? 'Sí' : 'No'}
                    </p>
                    <p>
                        <strong>Descripción:</strong> {product.description}
                    </p>
                </div>
            </div>

            <div className="panel">
                <div className="button-row">
                    <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => {
                            setShowDeleteConfirm(false);
                            setShowEditForm((currentValue) => !currentValue);
                        }}
                        disabled={isDeleting || isSaving}
                    >
                        {showEditForm ? 'Cancelar edición' : 'Editar producto'}
                    </button>

                    <button
                        type="button"
                        className="button button--danger"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isDeleting || isSaving}
                    >
                        {isDeleting ? 'Borrando...' : 'Borrar producto'}
                    </button>
                </div>

                {showEditForm && (
                    <div className="panel">
                        <h2>Editar producto</h2>
                        {tagsError && <p className="error">{tagsError}</p>}
                        {isLoadingTags ? (
                            <p className="status">Cargando tags...</p>
                        ) : (
                            <ProductForm
                                availableTags={availableTags}
                                isSubmitting={isSaving}
                                initialValues={getInitialFormValues(product)}
                                submitLabel="Guardar cambios"
                                imageHint={
                                    product.image
                                        ? 'Deja la foto vacía para mantener la actual.'
                                        : undefined
                                }
                                onSubmit={handleUpdate}
                            />
                        )}
                    </div>
                )}

                {error && <p className="error">{error}</p>}

                {showDeleteConfirm && (
                    <ConfirmAction
                        message="¿Seguro que quieres borrar este producto?"
                        confirmLabel="Sí, borrar"
                        onConfirm={handleDelete}
                        onCancel={() => setShowDeleteConfirm(false)}
                    />
                )}
            </div>
        </section>
    );
}
