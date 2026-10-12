# IMAC Nepal Internal Operations System

## Project Overview
The IMAC Nepal Internal Operations System is an on-premises operations platform designed to manage organizational workflows, user administration, HR profiles, work logging, and audit tracking for IMAC Nepal. The system prioritizes security, strictly defined roles, complete audit logging, and data privacy without external vendor dependencies.

## Tech Stack
- **Monorepo Architecture**: npm workspaces (`apps/*`, `packages/*`)
- **Backend API**: Node.js, Express, TypeScript (NodeNext / ES2022)
- **Database & ORM**: PostgreSQL, Prisma ORM
- **Authentication & Security**: Argon2id password hashing, database-backed PostgreSQL sessions, Double Submit CSRF protection (`csrf-csrf`), HTTP-only secure cookies, Helmet security headers, rate limiting
- **Shared Code**: `@imac/shared` (Zod validation schemas, TypeScript domain models, permission types)
- **Logging**: Pino structured logging with `pino-pretty` development transport
- **Testing**: Vitest, Supertest
- **Production & Deployment**: Docker, Docker Compose, Caddy reverse proxy with automatic local HTTPS certificates

---

## Local Dev Setup

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- PostgreSQL >= 16 (or running locally via Docker)

### 1. Clone & Navigate
```bash
git clone <repository-url>
cd IMAC-SYSTEM
```

### 2. Environment Configuration
Copy `.env.example` to `.env` in the root workspace and in `apps/api`:
```bash
cp .env.example apps/api/.env
```
Ensure you update the security and admin credentials:
- `SESSION_SECRET`: Generate a 64-character hex secret (`openssl rand -hex 32`).
- `DATABASE_URL`: Connection string pointing to your PostgreSQL instance.
- `ADMIN1_PASSWORD` / `ADMIN2_PASSWORD`: Set strong temporary bootstrap credentials.

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup & Migrations
Generate Prisma client, run migrations, and execute the seed script:
```bash
npm run db:migrate
npm run db:seed
```

### 5. Running the Application
To run the backend API service (along with frontend when configured):
```bash
npm run dev
```
Or to run the API workspace alone:
```bash
npm run dev --workspace=apps/api
```

---

## Production Deploy (Docker Compose)

The production stack orchestrates PostgreSQL, the backend API container, and a Caddy reverse proxy with automated HTTPS.

1. Navigate to the deployment folder:
   ```bash
   cd deploy
   ```
2. Create and configure production environment variables:
   ```bash
   cp .env.production.example .env
   ```
   Set strong passwords for `POSTGRES_PASSWORD`, `SESSION_SECRET`, and initial admin passwords.

3. Build and launch containers:
   ```bash
   docker compose up -d --build
   ```

4. Verify service health and container status:
   ```bash
   docker compose ps
   docker compose logs -f app
   ```

5. Nightly Backups:
   Schedule `deploy/backup.sh` via a cron job on the host machine to back up database dumps and uploads to `/backups`.

---

## Testing

Run unit and integration test suites:
```bash
# Run all workspace tests
npm run test

# Run API tests with Vitest
npm run test --workspace=apps/api

# Run test coverage
npm run test:coverage --workspace=apps/api
```
