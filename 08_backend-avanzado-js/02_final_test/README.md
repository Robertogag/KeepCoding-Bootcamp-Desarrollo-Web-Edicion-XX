# BookShop API — Final Advanced Backend Project

<p align="center">
  <img src="https://img.shields.io/badge/Express-REST%20API-000000?logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?logo=prisma&logoColor=white" alt="Prisma">
  <img src="https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white" alt="JWT">
  <img src="https://img.shields.io/badge/Tests-14%20E2E%20passing-C21325?logo=jest&logoColor=white" alt="Jest">
  <img src="https://img.shields.io/badge/Status-Ready%20to%20Run-brightgreen" alt="Status">
</p>

---

## Context

This is the final practice project for the Advanced Backend module of the KeepCoding Web Development Bootcamp.

The project is a REST API for a second-hand book marketplace: users sign up, publish books, browse the public catalog and buy books published by other users. The platform also runs automatic email notifications to help sellers manage their listings.

The original brief is included in this folder (`Práctica Backend Avanzado – BookShop API.pdf`).

---

## Objective

Build the complete API applying the stack used during the module — Express, TypeScript, Prisma, PostgreSQL, JWT — with a hexagonal architecture (domain / infrastructure / ui) and the following behavior:

- user registration and login with JWT
- book publishing, editing and deletion (owner-only)
- public catalog with mandatory pagination and partial search by title and author
- book purchase with all its business rules
- email notification to the seller when a book is sold
- weekly scheduled task suggesting a price reduction for stale listings
- E2E tests for the required endpoints

---

## Requirements

- Node.js 18+
- npm
- PostgreSQL: Docker (recommended) **or** a native PostgreSQL 17 installation

## Getting Started

```bash
# 1. Start PostgreSQL + MailDev
docker compose up -d
#    (without Docker, on Windows with native PostgreSQL 17:)
#    .\scripts\db-start.ps1   -> dev cluster on port 5433

# 2. Environment variables
#    copy .env.example to .env (works as-is with Docker;
#    with the local cluster use the port 5433 DATABASE_URL)

# 3. Install dependencies
npm install

# 4. Generate the Prisma client and run the migrations
npx prisma migrate dev

# 5. Start the server in dev mode (live reload)
npm start
```

The server runs at `http://localhost:3000`. MailDev (with Docker) at `http://localhost:1080`.

## Available Scripts

| Command | Description |
|---|---|
| `npm start` | Starts the server with live reload |
| `npm test` | Runs the E2E test suite (requires the database up) |
| `npm run build` | Compiles TypeScript into `dist/` |
| `npm run lint` | Runs ESLint over the source code |
| `npm run prettier` | Checks formatting with Prettier |
| `npm run typecheck` | Type-checks without emitting files |

---

## Endpoints

### Authentication (JWT)

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/authentication/signup` | Public | Creates an account (`email`, `password`) |
| POST | `/authentication/signin` | Public | Returns an `accessToken` (JWT) |

Passwords must be 8-20 characters long and include lowercase, uppercase, a number and a symbol. They are always stored hashed with bcrypt.

Private endpoints require the `Authorization: Bearer <token>` header.

### Books

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/books` | Public | Catalog: only `PUBLISHED` books, paginated, searchable |
| POST | `/books` | Private | Publishes a book (`title`, `description`, `price`, `author`) |
| PUT | `/books/:id` | Private | Edits a book (owner only, editable fields only) |
| DELETE | `/books/:id` | Private | Deletes a book (owner only, published books only) |
| POST | `/books/:id/buy` | Private | Buys a published book from another user |
| GET | `/me/books` | Private | All books of the authenticated user (any status) |

### Public catalog: query parameters

| Parameter | Description |
|---|---|
| `page` | Page number (default 1) |
| `limit` | Items per page (default 10, max 100) |
| `search` | Partial, case-insensitive search by **title** or **author** |

```
GET /books?page=1&limit=10&search=rowling
```

---

## Business Rules

- User email is unique; registering an existing email returns `409`.
- Books are always created as `PUBLISHED` with `soldAt = null`, owned by the authenticated user.
- Only the owner can edit or delete a book (`403` otherwise).
- Only `title`, `description`, `price` and `author` are editable; any other property in the body returns `400`.
- Sold books cannot be deleted (`409`).
- A user cannot buy their own books (`403`).
- A sold book cannot be bought again (`409`); the sale is atomic (two simultaneous purchases cannot sell the same book twice).
- When a purchase completes, the book becomes `SOLD`, `soldAt` is set and the seller is notified by email.
- `SOLD` books never appear in the public catalog.

---

## Automatic Use Cases

### Sale notification (domain events)

`BuyBookUseCase` publishes a `book.sold` domain event on the `EventBus`. The subscriber (registered in `src/index.ts`) looks up the seller and sends the email through Nodemailer → MailDev. If the email fails, the already-completed purchase is not affected.

### Price reduction suggestion (scheduled task)

Every **Monday at 09:00** (`node-cron`, `0 9 * * 1`) the API runs `SuggestPriceReductionUseCase`: it finds `PUBLISHED` books listed for more than 7 days and emails each owner suggesting a price review to improve the chances of selling.

---

## Testing (E2E)

End-to-end tests with **Jest + Supertest** against the real API and the real database (they run serially with `--runInBand` and clean the tables before each test):

- `POST /books` — successful creation, unauthenticated user (no token and invalid token), invalid data (missing fields and negative price).
- `POST /books/:id/buy` — successful purchase, non-existent book, already sold book, buying your own book, unauthenticated.
- `GET /books` — pagination, partial search by title, partial search by author, sold books excluded.

```bash
npm test
```

---

## Postman

The `postman/` folder contains `BookShop.postman_collection.json` ready to import. Suggested flow: **Signup → Signin** (stores the `accessToken` automatically in the collection variables) → **Create book** (stores the `bookId`) → the rest of the requests. To test a purchase, register a second user and Signin with it before **Buy book** (a user cannot buy their own books).

---

## Architecture

```
src/
├── domain/                  # pure business logic (no Express, no Prisma)
│   ├── book/                # Book entity, BookSoldEvent,
│   │                        # BookRepository port and use cases
│   ├── user/                # User entity, UserRepository and
│   │                        # SecurityService ports, use cases
│   ├── errors/              # domain errors (mapped to HTTP in ui)
│   └── shared/              # Entity, DomainEvent, EventBus, EmailService...
├── infrastructure/          # output adapters
│   ├── book/ and user/      # Prisma repositories, SecurityService (bcrypt+JWT)
│   └── shared/              # NodeEventBus, NodemailerEmailService
├── ui/                      # input adapter (HTTP)
│   ├── book/ and user/      # controllers (zod validation) and routes
│   └── shared/              # authentication-middleware, error-handler
├── api.ts                   # Express app (also used by the tests)
└── index.ts                 # bootstrap: server + event subscriber + cron
```

Dependencies point inwards: use cases receive interfaces (ports) and know nothing about Express, Prisma or Nodemailer. Domain errors are translated into HTTP status codes in a single error handler (`404`, `409`, `403`, `401`, zod `400`, `500`).
