# Wallashop - Backend Avanzado

API REST básica para gestión de productos, construida con Express, TypeScript y Prisma sobre PostgreSQL.

## Requisitos

- Docker y Docker Compose
- Node.js 18+
- npm

## Setup inicial

```bash
# 1. Levantar la base de datos PostgreSQL
docker compose up -d

# 2. Instalar dependencias
npm install

# 3. Generar el cliente de Prisma y ejecutar la migración inicial
npx prisma migrate dev --name init

# 4. Arrancar el servidor en modo desarrollo (con live reload)
npm start
```

El servidor estará disponible en `http://localhost:3000`.

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm start` | Arranca el servidor con live reload |
| `npm run build` | Compila TypeScript a JavaScript en `dist/` |
| `npm run lint` | Ejecuta ESLint sobre el código fuente |
| `npm run prettier` | Verifica el formato con Prettier |
| `npm run typecheck` | Valida tipos con TypeScript sin generar archivos |

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/products` | Lista todos los productos |
| GET | `/products/:id` | Obtiene un producto por ID |
| POST | `/products` | Crea un nuevo producto |
| PUT | `/products/:id` | Actualiza un producto existente |
| DELETE | `/products/:id` | Elimina un producto |

### Ejemplo de creación de producto (POST /products)

```json
{
  "name": "Producto de ejemplo",
  "description": "Descripción del producto",
  "price": 29.99
}
```

## Postman

En la carpeta `postman/` encontrarás la colección `Wallashop.postman_collection.json` lista para importar.
