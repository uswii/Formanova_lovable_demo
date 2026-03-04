# Formanova Admin Dashboard

Internal admin panel for managing the Formanova platform — users, workflows, analytics, and tenants.

## Overview

Connects to the temporal-agentic-pipeline backend and provides a unified interface for:

- **Users** — view all users, search by email, manage credit balances
- **Workflows** — monitor pipeline executions, filter by status/tenant, inspect margins
- **Analytics** — P&L cards, daily workflow volume, top users by balance
- **Tenants** — aggregate stats per tenant (users, workflows, revenue)
- **Batch Management** — existing batch job management

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- TanStack Query
- Recharts
- React Router

## Getting Started

### Prerequisites

- Node.js 18+
- Access to the temporal-agentic-pipeline backend

### Install

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
VITE_PIPELINE_API_URL=https://formanova.ai/api
VITE_PIPELINE_API_KEY=<your_tenant_api_key>
VITE_PIPELINE_ADMIN_SECRET=<your_admin_secret>
```

### Run

```bash
npm run dev       # development at localhost:5173
npm run build     # production build
npm run preview   # preview production build locally
```

## Routes

| Route | Description |
|---|---|
| `/admin` | Batch Management |
| `/admin/users` | User list with search |
| `/admin/users/:externalId` | User detail — balance + workflow history |
| `/admin/workflows` | Workflow list with filters |
| `/admin/workflows/:workflowId` | Workflow audit — per-tool line items |
| `/admin/analytics` | P&L overview + charts |
| `/admin/tenants` | Tenant cards with aggregate stats |

All routes are protected and require authentication.

## API Client

`src/lib/pipeline-api.ts` handles all backend communication:

- **Admin endpoints** (`X-Admin-Secret`) — `/admin/users`, `/admin/tenants`, `/admin/workflows`
- **Tenant endpoints** (`X-API-Key`) — balance, top-up, audit, workflow history
