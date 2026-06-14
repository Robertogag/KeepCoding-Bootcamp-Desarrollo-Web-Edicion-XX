import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { ProductFormValues } from '../types';

interface ProductFormProps {
    availableTags: string[];
    isSubmitting: boolean;
    initialValues?: ProductFormValues;
    submitLabel?: string;
    imageHint?: string;
    onSubmit: (values: ProductFormValues) => Promise<void>;
}

const initialFormValues: ProductFormValues = {
    name: '',
    price: '',
    tags: [],
    imageFile: null,
    isOnSale: false,
    description: '',
};

export function ProductForm({
    availableTags,
    isSubmitting,
    initialValues,
    submitLabel = 'Crear producto',
    imageHint,
    onSubmit,
}: ProductFormProps) {
    const [formValues, setFormValues] =
        useState<ProductFormValues>(initialValues ?? initialFormValues);

    const isFormValid =
        formValues.name.trim() !== '' &&
        formValues.description.trim() !== '' &&
        formValues.tags.length > 0 &&
        formValues.price.trim() !== '' &&
        !Number.isNaN(Number(formValues.price)) &&
        Number(formValues.price) >= 0;

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value, checked, type } = event.target;

        setFormValues((currentValues) => ({
            ...currentValues,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleDescriptionChange = (
        event: ChangeEvent<HTMLTextAreaElement>,
    ) => {
        const { value } = event.target;

        setFormValues((currentValues) => ({
            ...currentValues,
            description: value,
        }));
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;

        setFormValues((currentValues) => ({
            ...currentValues,
            imageFile: file,
        }));
    };

    const handleTagChange = (tag: string) => {
        setFormValues((currentValues) => {
            const tagIsSelected = currentValues.tags.includes(tag);

            return {
                ...currentValues,
                tags: tagIsSelected
                    ? currentValues.tags.filter(
                          (selectedTag) => selectedTag !== tag,
                      )
                    : [...currentValues.tags, tag],
            };
        });
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!isFormValid || availableTags.length === 0) {
            return;
        }

        await onSubmit(formValues);
    };

    return (
        <form className="form" onSubmit={handleSubmit}>
            <p className="hint">Los campos con * son obligatorios. La foto es opcional.</p>

            <label className="field">
                <span className="field__label">
                    Nombre <span className="required-mark">*</span>
                </span>
                <input
                    type="text"
                    name="name"
                    value={formValues.name}
                    onChange={handleInputChange}
                    required
                />
            </label>

            <label className="field">
                <span className="field__label">
                    Precio <span className="required-mark">*</span>
                </span>
                <input
                    type="number"
                    name="price"
                    min="0"
                    step="0.01"
                    value={formValues.price}
                    onChange={handleInputChange}
                    required
                />
            </label>

            <div className="field">
                <span className="field__label">
                    Tags <span className="required-mark">*</span>
                </span>

                {availableTags.length === 0 ? (
                    <p className="hint">No hay tags disponibles en el backend.</p>
                ) : (
                    <div className="checkbox-group">
                        {availableTags.map((tag) => (
                            <label key={tag} className="checkbox">
                                <input
                                    type="checkbox"
                                    checked={formValues.tags.includes(tag)}
                                    onChange={() => handleTagChange(tag)}
                                />
                                <span>{tag}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <label className="checkbox">
                <input
                    type="checkbox"
                    name="isOnSale"
                    checked={formValues.isOnSale}
                    onChange={handleInputChange}
                />
                <span>Es oferta</span>
            </label>

            <label className="field">
                <span className="field__label">
                    Descripcion <span className="required-mark">*</span>
                </span>
                <textarea
                    name="description"
                    value={formValues.description}
                    onChange={handleDescriptionChange}
                    required
                />
            </label>

            <label className="field">
                <span className="field__label">Foto</span>
                <input type="file" accept="image/*" onChange={handleFileChange} />
                {imageHint && <p className="hint">{imageHint}</p>}
            </label>

            <button
                type="submit"
                className="button"
                disabled={!isFormValid || isSubmitting || availableTags.length === 0}
            >
                {isSubmitting ? 'Guardando...' : submitLabel}
            </button>
        </form>
    );
}
