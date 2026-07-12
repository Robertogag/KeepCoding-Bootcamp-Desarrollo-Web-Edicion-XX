import { PrismaClient } from '@prisma/client';

// Instancia compartida (singleton) de PrismaClient para toda la aplicación.
// Esto evita crear múltiples pools de conexión y previene
// problemas de visibilidad de datos entre conexiones.
const prisma = new PrismaClient();

export { prisma };
