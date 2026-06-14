import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ProductForm } from '../components/ProductForm';
import { createProduct } from '../services/products';
import { getTags } from '../services/tags';
import { uploadImage } from '../services/uploads';
import type { ProductFormValues } from '../types';

export function NewProductPage() {
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [isLoadingTags, setIsLoadingTags] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const loadTags = async () => {
            try {
                const tags = await getTags();
                setAvailableTags(tags);
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : 'No se pudieron cargar los tags',
                );
            } finally {
                setIsLoadingTags(false);
            }
        };

        loadTags();
    }, []);

    const handleSubmit = async (values: ProductFormValues) => {
        setIsSubmitting(true);
        setError('');

        try {
            let imagePath: string | undefined;

            if (values.imageFile) {
                imagePath = await uploadImage(values.imageFile);
            }

            const newProduct = await createProduct({
                name: values.name.trim(),
                price: Number(values.price),
                tags: values.tags,
                image: imagePath,
                isOnSale: values.isOnSale,
                description: values.description.trim(),
            });

            navigate(`/products/${newProduct.id}`, { replace: true });
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo crear el producto',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="page">
            <div className="page__header">
                <h1>Nuevo producto</h1>
            </div>

            <div className="panel">
                {isLoadingTags ? (
                    <p className="status">Cargando tags...</p>
                ) : (
                    <ProductForm
                        availableTags={availableTags}
                        isSubmitting={isSubmitting}
                        onSubmit={handleSubmit}
                    />
                )}

                {error && <p className="error">{error}</p>}
            </div>
        </section>
    );
}
