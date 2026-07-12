# Problemas Detectados en la Suite de Tests

## Causa Raíz 1 — Violación de clave foránea en test de borrado de producto

**Archivo:** `src/__tests__/test-utils/create-product.ts`

El helper `createProduct()` genera un `userId` aleatorio (`Math.floor(Math.random() * 100) + 1`) que no corresponde a ningún usuario real en la base de datos. Como la tabla `Product` tiene una restricción de clave foránea (`Product_userId_fkey`) que referencia a `User(id)`, la inserción falla con `PrismaClientKnownRequestError`.

**Solución:** Crear un usuario real en la base de datos antes de crear el producto y usar su `id` como `userId`.

---

## Causa Raíz 2 — Falta de autenticación en el test de borrado

**Archivo:** `src/__tests__/delete-product.test.ts`

Los tests de `DELETE /products/:id` no envían un token JWT en el encabezado `Authorization`. La ruta está protegida por `authenticationMiddleware`, que devuelve 401 antes de que el controlador pueda ejecutarse. El segundo test espera recibir 500 (el error genérico del controlador) pero obtiene 401 porque el middleware lo bloquea primero.

**Solución:** Crear un usuario, iniciar sesión para obtener un token y enviarlo en todas las peticiones DELETE.

---

## Causa Raíz 3 — Múltiples instancias de PrismaClient

**Archivos:**
- `src/infrastructure/user/repositories/PrismaUserRepository.ts`
- `src/infrastructure/product/repositories/PrismaProductRepository.ts`
- `src/__tests__/test-utils/prisma-client.ts`

Cada repositorio crea una instancia nueva de `PrismaClient` en su constructor. Además, los test-utils y los controladores también crean sus propias instancias. Esto provoca que haya múltiples pools de conexión a la base de datos, lo que puede ocasionar problemas de visibilidad de datos entre conexiones y condiciones de carrera en los tests.

**Solución:** Crear un único `PrismaClient` compartido (singleton) en `src/infrastructure/prisma-client.ts` y reutilizarlo en todos los repositorios.

---

## Causa Raíz 4 — El helper `createUser` no verifica la respuesta HTTP

**Archivo:** `src/__tests__/test-utils/create-user.ts`

La función `createUser()` ejecuta la petición HTTP para registrar un usuario, pero no comprueba si la respuesta fue exitosa (status 201). Si el registro falla silenciosamente (por ejemplo, por un error de base de datos), el siguiente paso `signinUser()` intentará autenticar a un usuario que no existe, devolviendo un token `undefined`. Esto provoca que las peticiones autenticadas posteriores reciban un 401 porque envían `Bearer undefined`.

**Solución:** Verificar el código de estado de la respuesta en `createUser()` y lanzar un error si el registro no fue exitoso.
