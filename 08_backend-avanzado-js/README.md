# Advanced Backend with Node.js

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-Typed%20Backend-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?logo=prisma&logoColor=white" alt="Prisma">
  <img src="https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white" alt="JWT">
  <img src="https://img.shields.io/badge/Testing-E2E%20with%20Jest-C21325?logo=jest&logoColor=white" alt="Jest">
  <img src="https://img.shields.io/badge/Status-Completed-brightgreen" alt="Status">
</p>

---

## Module Overview

This module focused on building production-style REST APIs with Node.js, Express and TypeScript.

The work moved from a basic CRUD seed towards a complete API with layered architecture, authentication, real business rules, background processes and end-to-end testing against a real database.

---

## Main Topics Covered

- REST API design with Express and TypeScript
- Hexagonal architecture: domain / infrastructure / ui
- Use cases, repositories and dependency inversion (ports and adapters)
- PostgreSQL with Prisma ORM and migrations
- JWT authentication and route protection middleware
- Input validation with zod
- Domain errors mapped to HTTP status codes
- Domain events and email notifications (Nodemailer + MailDev)
- Scheduled background tasks with node-cron
- End-to-end testing with Jest and Supertest

---

## What Was Practiced

- keeping business rules inside domain use cases, isolated from Express and Prisma
- writing repositories as interfaces (ports) implemented with Prisma (adapters)
- protecting private endpoints with an authentication middleware
- translating domain errors into HTTP responses in a single error handler
- pagination and partial search on public endpoints
- notifying users by email through domain events
- running a weekly scheduled task with a real use case behind it
- E2E tests that hit the real API and verify the database state

---

## Module Goal

Apply the full backend stack of the module to build a complete second-hand book marketplace API (BookShop), with every business rule enforced in the domain layer and verified end-to-end.

---

## Repository Structure

| Folder | Description |
|--------|-------------|
| `01_backend-avanzado-course/` | Official module material and seed project used during the course |
| `02_final_test/` | Final practice: BookShop API with documentation, tests and runnable source code |

---

## Final Practice

The final practice is documented in:

- [`02_final_test/README.md`](02_final_test/README.md)

That folder contains the complete API, the original practice brief (PDF), a Postman collection and instructions to run and test everything.
