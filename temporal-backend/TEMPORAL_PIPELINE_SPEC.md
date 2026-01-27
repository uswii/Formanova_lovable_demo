# 🌌 Temporal-Agentic Pipeline v2.5 (B2B2C Edition)

A distributed orchestration engine for complex, multi-stage AI workflows with enterprise-grade persistence, caching, **B2B2C multi-tenant billing**, and observability.

---

## 📋 Table of Contents

1. [Overview](#-overview)
2. [Architecture](#-architecture)
3. [B2B2C Multi-Tenant Model](#-b2b2c-multi-tenant-model)
4. [Authentication & Security](#-authentication--security)
5. [Database Layer](#-database-layer-the-triple-lock)
6. [Credit & Billing System](#-credit--billing-system)
7. [Quick Start](#-quick-start)
8. [API Reference](#-api-reference)
9. [DAG Management API](#-dag-management-api)
10. [DAG Features](#-dag-features)
11. [Tool Registry](#-tool-registry-toolsyaml)
12. [Developer Guide](#-developer-guide)
13. [File Structure](#-file-structure)
14. [Adding New Tools](#-adding-new-tools)
15. [Observability](#-observability)
16. [Artifact System](#-artifact-system)
17. [Error Handling & Retries](#️-error-handling--retries)
18. [Security Considerations](#-security-considerations)
19. [Known Limitations](#-known-limitations)

---

## 🎯 Overview

The Temporal-Agentic Pipeline solves five critical problems in AI workflow orchestration:

| Problem | Solution |
|---------|----------|
| **Temporal's 2MB payload limit** | Content-Addressable Storage (CAS) with Azure Blob |
| **Expensive re-computation** | Global cache (Redis + PostgreSQL) with input hashing |
| **Complex DAG logic** | YAML-defined workflows with fan-out, gating, and mapping |
| **Tool cost management** | Atomic credit holds, dual billing ledger, guaranteed settlement |
| **Multi-tenant isolation** | B2B2C architecture with JWT/API Key authentication |

### Key Features

- ✅ **Dynamic DAG Execution** - Define workflows in YAML, not code
- ✅ **Parallel Fan-Out** - Automatic parallelization when tools return lists
- ✅ **Conditional Gating** - Skip nodes based on runtime conditions
- ✅ **Input Mapping** - Bridge schema mismatches between tools
- ✅ **Global Caching** - Sub-millisecond lookups for deterministic tools
- ✅ **B2B2C Multi-Tenancy** - Tenant (Provider) + User (Consumer) isolation
- ✅ **JWT & API Key Auth** - Flexible authentication for frontends and backends
- ✅ **JIT User Provisioning** - Auto-create users on first authentication
- ✅ **RLHF-Ready** - Rating and feedback fields on every invocation
- ✅ **Atomic Credit Holds** - Race-condition-free balance reservation
- ✅ **Dual Billing Ledger** - Separate User Revenue vs Provider Cost tracking
- ✅ **Guaranteed Settlement** - Credits always released via Temporal `finally` blocks
- ✅ **Fan-Out Safety Brake** - Prevents runaway credit consumption
- ✅ **Financial Reaper** - Background cleanup for zombie workflows

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL CLIENTS                                │
│                                                                              │
│  ┌──────────────────────┐              ┌──────────────────────┐             │
│  │    FRONTEND APP      │              │   TENANT BACKEND     │             │
│  │  (User JWT Auth)     │              │  (API Key + X-On-    │             │
│  │                      │              │   Behalf-Of Header)  │             │
│  └──────────┬───────────┘              └──────────┬───────────┘             │
└─────────────┼────────────────────────────────────┼──────────────────────────┘
              │ Authorization: Bearer <JWT>        │ X-API-Key: tap_live_...
              │                                    │ X-On-Behalf-Of: user_123
              ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FASTAPI GATEWAY (server.py)                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │ Authentication  │  │ Artifact CAS     │  │ Credit Reservation          │ │
│  │ (JWT/API Key)   │→ │ (Hash → Azure)   │→ │ (Atomic Hold on USER)       │ │
│  └─────────────────┘  └──────────────────┘  └─────────────────────────────┘ │
│           │                                              │                   │
│           ▼                                              ▼                   │
│  ┌─────────────────┐                     ┌───────────────────────────────┐  │
│  │ AuthContext     │                     │ Workflow Record               │  │
│  │ • tenant_id     │                     │ • tenant_id (Provider)        │  │
│  │ • user_id       │                     │ • user_id (Payer)             │  │
│  │ • method        │                     │ • projected_cost              │  │
│  └─────────────────┘                     └───────────────────────────────┘  │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │ start_workflow()
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEMPORAL CLUSTER (State Machine)                          │
│           Handles: Retries, Timers, Event Sourcing, Queues                   │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │ poll & execute
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TEMPORAL WORKER (worker.py)                             │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │   DynamicWorkflow            │  │   Activities                         │ │
│  │   • DAG Interpreter          │  │   • http_call_tool (CPU)             │ │
│  │   • Fan-out Manager          │  │   • gpu_job_stream (GPU polling)     │ │
│  │   • Condition Evaluator      │  │   • record_usage_activity (Billing)  │ │
│  │   • Safety Brake             │  │   • settle_credits_activity (Final)  │ │
│  │   • Finally Settlement       │  │   • Global Cache Check               │ │
│  │   • tenant_id propagation    │  │   • tenant_id/user_id attribution    │ │
│  └──────────────────────────────┘  └──────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────┬───────────────────────┘
                 │                                    │
    ┌────────────▼────────────┐          ┌───────────▼───────────┐
    │   CPU MICRO-SERVICES    │          │   GPU MICRO-SERVICES  │
    │   POST /run (sync)      │          │   POST /jobs (async)  │
    └─────────────────────────┘          └───────────────────────┘
```

---

## 👥 B2B2C Multi-Tenant Model

The pipeline implements a **Business-to-Business-to-Consumer (B2B2C)** model where:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          B2B2C HIERARCHY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PLATFORM (You/Anthropic)                                            │    │
│  │  • Hosts the infrastructure                                          │    │
│  │  • Charges Tenants a fixed service fee (external/Stripe)            │    │
│  │  • Provides the workflow orchestration engine                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│              ┌───────────────┼───────────────┐                              │
│              ▼               ▼               ▼                              │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐         │
│  │    TENANT A       │ │    TENANT B       │ │    TENANT C       │         │
│  │    (Client)       │ │    (Client)       │ │    (Client)       │         │
│  │                   │ │                   │ │                   │         │
│  │ • Owns User Base  │ │ • Owns User Base  │ │ • Owns User Base  │         │
│  │ • Bears Provider  │ │ • Bears Provider  │ │ • Bears Provider  │         │
│  │   Cost (Infra)    │ │   Cost (Infra)    │ │   Cost (Infra)    │         │
│  │ • Configures OIDC │ │ • Configures OIDC │ │ • Configures OIDC │         │
│  │ • Has API Key     │ │ • Has API Key     │ │ • Has API Key     │         │
│  └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘         │
│            │                     │                     │                    │
│     ┌──────┴──────┐       ┌──────┴──────┐       ┌──────┴──────┐            │
│     ▼             ▼       ▼             ▼       ▼             ▼            │
│  ┌─────┐       ┌─────┐ ┌─────┐       ┌─────┐ ┌─────┐       ┌─────┐        │
│  │User1│       │User2│ │User3│       │User4│ │User5│       │User6│        │
│  │     │       │     │ │     │       │     │ │     │       │     │        │
│  │Wallet│      │Wallet││Wallet│      │Wallet││Wallet│      │Wallet│        │
│  │=500 │       │=1000││=200 │       │=800 ││=0   │       │=5000│         │
│  └─────┘       └─────┘ └─────┘       └─────┘ └─────┘       └─────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Entity | Role | Pays For | Example |
|--------|------|----------|---------|
| **Platform** | Infrastructure Host | Hosting, Development | Your company |
| **Tenant** | Business Client | Fixed service fee + Provider costs | "Jewelry AI Inc." |
| **User** | End Consumer | Workflow credits (deducted from wallet) | "alice@customer.com" |

### Financial Flow

```
User buys 1000 credits from Tenant (via Stripe/PayPal) → $10
                          │
                          ▼
            ┌─────────────────────────────┐
            │  Tenant calls POST /topup   │
            │  user_external_id=alice     │
            │  amount=1000                │
            └─────────────────────────────┘
                          │
                          ▼
            User.balance = 1000 credits
                          │
                          ▼
            User runs workflow (cost: 150)
                          │
                          ▼
            ┌─────────────────────────────┐
            │  Settlement:                │
            │  • User pays: 150 (Revenue) │
            │  • Provider cost: 200       │
            │  • Tenant margin: -50       │
            └─────────────────────────────┘
                          │
                          ▼
            User.balance = 850 credits
```

---

## 🔐 Authentication & Security

### Supported Auth Methods

| Method | Use Case | Headers Required | Identifies |
|--------|----------|------------------|------------|
| **JWT (Bearer)** | Frontend/Mobile apps | `Authorization: Bearer <token>` | Tenant + User |
| **API Key** | Backend-to-Backend | `X-API-Key: tap_live_...` | Tenant only |
| **API Key + Impersonation** | Backend billing User | `X-API-Key` + `X-On-Behalf-Of: user_id` | Tenant + User |

### JWT Authentication Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         JWT AUTHENTICATION FLOW                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. User logs in via Tenant's Identity Provider (Supabase/Auth0/etc)     │
│                          │                                                │
│                          ▼                                                │
│  2. IdP issues JWT with claims:                                          │
│     {                                                                     │
│       "iss": "https://tenant-xyz.supabase.co",  ◄── Tenant Binding       │
│       "sub": "user_abc123",                      ◄── User ID             │
│       "email": "alice@example.com",                                       │
│       "aud": "authenticated"                                              │
│     }                                                                     │
│                          │                                                │
│                          ▼                                                │
│  3. Frontend calls API:  Authorization: Bearer <JWT>                      │
│                          │                                                │
│                          ▼                                                │
│  4. Gateway extracts 'iss' claim                                         │
│     └── Looks up Tenant in DB by issuer_url                              │
│                          │                                                │
│                          ▼                                                │
│  5. Fetches JWKS from Tenant's configured jwks_uri                       │
│     └── Verifies signature using public key                              │
│                          │                                                │
│                          ▼                                                │
│  6. JIT Provisioning:                                                     │
│     └── If User doesn't exist → Create with balance=0                    │
│                          │                                                │
│                          ▼                                                │
│  7. Returns AuthContext(tenant_id, user_id, method="jwt")                │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### API Key Authentication Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       API KEY AUTHENTICATION FLOW                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. Tenant Backend calls API:                                             │
│     X-API-Key: tap_live_xyz123...                                        │
│     X-On-Behalf-Of: customer_bob_555  (Optional: for billing)            │
│                          │                                                │
│                          ▼                                                │
│  2. Gateway hashes key: SHA-256(key)                                     │
│     └── Looks up Tenant by api_key_hash                                  │
│                          │                                                │
│                          ▼                                                │
│  3. If X-On-Behalf-Of provided:                                          │
│     └── Lookup/Create User by external_id within Tenant                  │
│     └── Enables billing to specific user's wallet                        │
│                          │                                                │
│                          ▼                                                │
│  4. Returns AuthContext(tenant_id, user_id?, method="api_key")           │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tenant Onboarding (Admin API)

```bash
# Create a new Tenant (requires ADMIN_SECRET)
curl -X POST http://localhost:8000/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: your-super-secret-key" \
  -d '{
    "name": "Jewelry AI Inc.",
    "issuer_url": "https://jewelry-ai.supabase.co",
    "jwks_uri": "https://jewelry-ai.supabase.co/.well-known/jwks.json",
    "audience": "authenticated"
  }'
```

**Response:**
```json
{
  "tenant_id": "ten_abc123def456",
  "name": "Jewelry AI Inc.",
  "api_key": "tap_live_xYz789AbCdEf...",
  "warning": "Store this API key safely. It cannot be retrieved again."
}
```

### Security Best Practices

| Concern | Mitigation |
|---------|------------|
| Token Substitution | JWT `iss` claim must match Tenant's registered `issuer_url` |
| API Key Exposure | Keys hashed (SHA-256) in DB, prefixed for secret scanning |
| Key Rotation | Support for multiple active keys per tenant (planned) |
| User Isolation | All queries filtered by `tenant_id` AND `user_id` |
| Self-Top-Up | JWT users blocked from `/credits/topup` endpoint |
| Cross-Tenant Access | Strict tenant_id verification on all data access |

---

## 💾 Database Layer: The Triple-Lock

### Strategy

| Layer | Technology | Purpose | Latency |
|-------|------------|---------|---------|
| **Hot Cache** | Redis | Frequent lookups for deterministic tools | <1ms |
| **Cold Storage** | PostgreSQL | RLHF data, history, audit trail, billing | ~5ms |
| **Artifact Vault** | Azure Blob | Binary files (images, PDFs) | ~50ms |

### Schema (B2B2C Model)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PostgreSQL                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐                                                     │
│  │      tenants        │  ◄── B2B Layer (Clients)                           │
│  ├─────────────────────┤                                                     │
│  │ id (ten_xxx)        │                                                     │
│  │ name                │                                                     │
│  │ issuer_url (UNIQUE) │  ◄── JWT Binding                                   │
│  │ jwks_uri            │                                                     │
│  │ audience            │                                                     │
│  │ api_key_hash        │  ◄── Machine Auth                                  │
│  │ tier                │                                                     │
│  └─────────┬───────────┘                                                     │
│            │ 1:N                                                             │
│            ▼                                                                 │
│  ┌─────────────────────┐       ┌──────────────────────┐                     │
│  │       users         │       │  workflow_executions │                     │
│  ├─────────────────────┤       ├──────────────────────┤                     │
│  │ id (UUID)           │◄──────│ user_id (FK)         │  ◄── Payer          │
│  │ email               │       │ tenant_id (FK)       │  ◄── Provider       │
│  │ external_id         │       │ id (temporal_wf_id)  │                     │
│  │ tenant_id (FK)      │       │ workflow_name        │                     │
│  │ ──── WALLET ────    │       │ input_payload (JSONB)│                     │
│  │ balance (BigInt)    │       │ status               │                     │
│  │ reserved_balance    │       │ ──── FINANCIAL ────  │                     │
│  └─────────────────────┘       │ projected_cost       │                     │
│                                │ actual_cost          │  ◄── User Revenue   │
│                                │ total_provider_cost  │  ◄── Tenant Expense │
│                                │ created_at           │                     │
│                                │ finished_at          │                     │
│                                └──────────┬───────────┘                     │
│                                           │ 1:N                              │
│  ┌─────────────┐                          ▼                                  │
│  │  artifacts  │       ┌──────────────────────────────────┐                 │
│  ├─────────────┤       │       tool_invocations          │                 │
│  │ sha256 (PK) │       ├──────────────────────────────────┤                 │
│  │ uri         │       │ id                               │                 │
│  │ mime_type   │       │ tool_name                        │                 │
│  │ size_bytes  │       │ tool_version                     │                 │
│  └─────────────┘       │ input_hash (IDX)                 │                 │
│                        │ input_data (JSONB)               │                 │
│                        │ output_data (JSONB)              │                 │
│                        │ workflow_id (FK)                 │                 │
│                        │ tenant_id (FK)                   │  ◄── Attribution│
│                        │ user_id (FK)                     │  ◄── Attribution│
│                        │ ──── FINANCIAL AUDIT ────        │                 │
│                        │ cost (int)                       │                 │
│                        │ is_retry (bool)                  │                 │
│                        │ is_cached (bool)                 │                 │
│                        │ is_success (bool)                │                 │
│                        │ is_skipped (bool)                │                 │
│                        │ is_deterministic (bool)          │                 │
│                        │ ──── RLHF ────                   │                 │
│                        │ rating (int)                     │                 │
│                        │ feedback (text)                  │                 │
│                        └──────────────────────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Indices

| Index | Purpose |
|-------|---------|
| `idx_tool_cache_lookup` | Fast cache lookups (tool + version + input_hash) |
| `idx_workflow_billing` | Billing aggregation (workflow_id + is_success) |
| `idx_tenant_user_external` | JIT user lookup (tenant_id + external_id, UNIQUE) |
| `idx_tenant_workflows_latest` | Tenant dashboard (tenant_id + created_at) |
| `idx_user_workflows_latest` | User history (user_id + created_at) |
| `idx_tenant_tool_history` | Tenant analytics (tenant_id + created_at) |

---

## 💰 Credit & Billing System

The pipeline implements a **B2B2C billing model** where:

- **Users** pay credits for successful workflow executions (Revenue)
- **Tenants** bear infrastructure costs for all attempts (Expense)

### Credit Hold Mechanism

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CREDIT LIFECYCLE (B2B2C)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐  │
│  │ /process    │     │ reserve_credits  │     │ USER Balance State      │  │
│  │ /run/{dag}  │────►│ (Lock USER Row)  │────►│                         │  │
│  │ /batch      │     │                  │     │ balance: 1000           │  │
│  └─────────────┘     └──────────────────┘     │ reserved: 500 (LOCKED)  │  │
│                               │               │ available: 500          │  │
│                               │               └─────────────────────────┘  │
│                               ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    TEMPORAL WORKFLOW EXECUTION                       │   │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │   │
│  │   │  Tool A     │───►│  Tool B     │───►│  Tool C     │             │   │
│  │   │  cost: 50   │    │  cost: 100  │    │  CACHE HIT  │             │   │
│  │   │  SUCCESS    │    │  FAIL+RETRY │    │  cost: $0   │             │   │
│  │   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘             │   │
│  │          ▼                  ▼                  ▼                     │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │              record_usage() → tool_invocations              │   │   │
│  │   │  ────────────────────────────────────────────────────────   │   │   │
│  │   │  Attempt 1: Tool A ─── SUCCESS ─── actual_cost: +50        │   │   │
│  │   │                                    provider_cost: +50       │   │   │
│  │   │  Attempt 2: Tool B ─── FAIL    ─── actual_cost: +0         │   │   │
│  │   │                                    provider_cost: +100      │   │   │
│  │   │  Attempt 3: Tool B ─── SUCCESS ─── actual_cost: +100       │   │   │
│  │   │                                    provider_cost: +100      │   │   │
│  │   │  Attempt 4: Tool C ─── CACHED  ─── actual_cost: +0         │   │   │
│  │   │                                    provider_cost: +0        │   │   │
│  │   │  ────────────────────────────────────────────────────────   │   │   │
│  │   │  TOTALS: actual_cost=150 (User), provider_cost=250 (Tenant)│   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               │                                             │
│                               │ finally block (ALWAYS RUNS)                 │
│                               ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    settle_credits_activity()                          │  │
│  │   IF status == "completed":                                           │  │
│  │       user.balance = balance - actual_cost (150)                     │  │
│  │       Final: balance=850, reserved=0                                  │  │
│  │                                                                       │  │
│  │   IF status == "failed":                                              │  │
│  │       user.balance = balance - 0 (REFUND)                            │  │
│  │       Final: balance=1000, reserved=0                                 │  │
│  │                                                                       │  │
│  │   ALWAYS: reserved_balance -= projected_cost (Release Hold)          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Billing Decision Matrix

| Scenario | User Charged? | Tenant (Provider) Charged? | Why? |
|----------|---------------|----------------------------|------|
| **Success (first time)** | ✅ YES | ✅ YES | Normal billable execution |
| **Cache Hit** | ❌ NO | ❌ NO | No infrastructure touched |
| **Skipped by `when` gate** | ❌ NO | ❌ NO | Node never executed |
| **Failure / Error** | ❌ NO | ✅ YES | Infra used, but user shouldn't pay |
| **Retry that fails** | ❌ NO | ✅ YES | Each attempt costs infra |
| **Retry that succeeds** | ✅ YES | ✅ YES | First success = user pays |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Docker & Docker Compose
- Azure Storage Account

### 1. Environment Setup

```bash
# Clone and setup
git clone <repo>
cd temporal-agentic-pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configuration

Create a `.env` file:

```bash
# ─────────────────────────────────────────────
# SECURITY (REQUIRED)
# ─────────────────────────────────────────────
ADMIN_SECRET="your-super-secret-admin-key"    # For /admin endpoints

# ─────────────────────────────────────────────
# TEMPORAL CONNECTION
# ─────────────────────────────────────────────
TEMPORAL_TARGET="localhost:7233"
TEMPORAL_NAMESPACE="default"
TEMPORAL_TASK_QUEUE="agent-queue"

# ─────────────────────────────────────────────
# DATABASE (PostgreSQL + Redis)
# ─────────────────────────────────────────────
POSTGRES_URL="postgresql+asyncpg://temporal:temporal@localhost:5432/temporal"
REDIS_URL="redis://localhost:6379/0"

# ─────────────────────────────────────────────
# AZURE BLOB STORAGE (Required for Artifacts)
# ─────────────────────────────────────────────
AZURE_ACCOUNT_NAME="your_storage_account"
AZURE_ACCOUNT_KEY="your_account_key"
AZURE_CONTAINER="agentic-artifacts"

# ─────────────────────────────────────────────
# LOCAL STORAGE
# ─────────────────────────────────────────────
STORAGE_DIR="./data"
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_SECRET` | **Yes** | - | Secret for `/admin/*` endpoints |
| `TEMPORAL_TARGET` | No | `localhost:7233` | Temporal cluster address |
| `POSTGRES_URL` | No | `postgresql+asyncpg://...` | Async PostgreSQL connection |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis connection |
| `AZURE_ACCOUNT_NAME` | **Yes** | - | Azure Storage account |
| `AZURE_ACCOUNT_KEY` | **Yes** | - | Azure Storage key |

### 3. Start Infrastructure

```bash
# Terminal 1: Temporal + Postgres + Redis
docker compose up -d
```

### 4. Initialize Database

```bash
# Create tables (idempotent)
python -c "import asyncio; from src.database import init_db; asyncio.run(init_db())"

# Or reset completely
python -m tests.db_nuke
```

### 5. Create Your First Tenant

```bash
# Create a tenant (returns API key - SAVE IT!)
curl -X POST http://localhost:8000/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: your-super-secret-admin-key" \
  -d '{
    "name": "My Test Company",
    "issuer_url": "https://mycompany.supabase.co",
    "jwks_uri": "https://mycompany.supabase.co/.well-known/jwks.json"
  }'
```

### 6. Start Services

```bash
# Terminal 2: Tool Stubs (for development)
python tests/run_stubs.py

# Terminal 3: Temporal Worker
python -m src.worker

# Terminal 4: API Gateway
uvicorn src.server:app --reload --port 8000
```

### 7. Test with API Key

```bash
# Top up a user's wallet (as Tenant)
curl -X POST "http://localhost:8000/credits/topup?user_external_id=test_user&amount=1000" \
  -H "X-API-Key: tap_live_YOUR_KEY_HERE"

# Run a workflow on behalf of the user
curl -X POST http://localhost:8000/run/default_chain \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tap_live_YOUR_KEY_HERE" \
  -H "X-On-Behalf-Of: test_user" \
  -d '{"payload": {"text": "Hello World"}}'

# Check the result
curl http://localhost:8000/result/{workflow_id} \
  -H "X-API-Key: tap_live_YOUR_KEY_HERE" \
  -H "X-On-Behalf-Of: test_user"
```

### 8. Run Tests

```bash
python -m tests.test_db_and_credits      # Financial logic (B2B2C)
python -m tests.test_auth_security       # Authentication & Security
python -m tests.test_e2e_presets         # Full pipeline
python -m tests.test_advanced_scenarios  # Edge cases
```

---

## 📡 API Reference

### Authentication Headers

All endpoints require authentication. Choose one:

| Header | Value | Use Case |
|--------|-------|----------|
| `Authorization` | `Bearer <JWT>` | Frontend apps (User context) |
| `X-API-Key` | `tap_live_...` | Backend integration (Tenant context) |
| `X-On-Behalf-Of` | `external_user_id` | With API Key for User billing |

### Admin Endpoints

#### Create Tenant

```bash
curl -X POST http://localhost:8000/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: your-secret" \
  -d '{
    "name": "Acme Corp",
    "issuer_url": "https://acme.auth0.com/",
    "jwks_uri": "https://acme.auth0.com/.well-known/jwks.json",
    "audience": "https://api.acme.com"
  }'
```

**Response:**
```json
{
  "tenant_id": "ten_abc123",
  "name": "Acme Corp",
  "api_key": "tap_live_xYz789...",
  "warning": "Store this API key safely. It cannot be retrieved again."
}
```

### Credit & Financial Endpoints

#### Get User Balance

```bash
# As Tenant (can view any user in their tenant)
curl http://localhost:8000/credits/balance/{user_uuid} \
  -H "X-API-Key: tap_live_..."

# As User (can only view their own)
curl http://localhost:8000/credits/balance/{user_uuid} \
  -H "Authorization: Bearer <JWT>"
```

**Response:**
```json
{
  "internal_user_id": "44ec0e61-4957-4055-bd3d-8c3f59387703",
  "external_user_id": "customer_alice",
  "tenant_id": "ten_abc123",
  "balance": 10000,
  "reserved": 500,
  "available": 9500
}
```

#### Top Up User (Tenant Only)

```bash
curl -X POST "http://localhost:8000/credits/topup?user_external_id=alice&amount=1000" \
  -H "X-API-Key: tap_live_..."
```

**Note:** JWT users CANNOT top up themselves (returns 403).

**Response:**
```json
{
  "external_user_id": "alice",
  "new_balance": 1000,
  "status": "success",
  "tenant_id": "ten_abc123"
}
```

#### Estimate Workflow Cost

```bash
curl -X POST http://localhost:8000/credits/estimate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tap_live_..." \
  -d '{"workflow_name": "qa_with_gpu", "num_variations": 2}'
```

**Response:**
```json
{
  "workflow": "qa_with_gpu",
  "projected_max_hold": 62,
  "initial_variants": 2,
  "breakdown": [
    {"tool": "embed", "unit_cost": 1, "gpu": false},
    {"tool": "gpu-rerank", "unit_cost": 25, "gpu": true},
    {"tool": "answer", "unit_cost": 5, "gpu": false}
  ]
}
```

#### Get Workflow Financial Audit

```bash
curl http://localhost:8000/credits/audit/{workflow_id} \
  -H "X-API-Key: tap_live_..." \
  -H "X-On-Behalf-Of: alice"
```

**Response:**
```json
{
  "summary": {
    "id": "wf-abc123",
    "name": "default_chain",
    "status": "completed",
    "tenant_id": "ten_abc123",
    "user_id": "44ec0e61-...",
    "financials": {
      "credit_hold_amount": 500,
      "actual_user_billed": 150,
      "internal_provider_cost": 250,
      "profit_margin": -100
    }
  },
  "line_items": [...]
}
```

### Analytics Endpoints

#### User Usage (Tenant View)

```bash
curl http://localhost:8000/analytics/user/{external_user_id}/usage \
  -H "X-API-Key: tap_live_..."
```

**Response:**
```json
{
  "tenant_id": "ten_abc123",
  "external_user_id": "alice",
  "internal_uuid": "44ec0e61-...",
  "total_spent_credits": 5000,
  "total_workflows_run": 42
}
```

#### Tenant Financials

```bash
curl http://localhost:8000/analytics/tenant/financials \
  -H "X-API-Key: tap_live_..."
```

**Response:**
```json
{
  "tenant_id": "ten_abc123",
  "total_jobs_processed": 1234,
  "financials": {
    "gross_revenue_credits": 50000,
    "provider_infra_credits": 65000,
    "net_margin_credits": -15000,
    "margin_percentage": -30.0
  }
}
```

### Workflow Endpoints

#### Start Workflow (File Upload)

```bash
curl -X POST http://localhost:8000/process \
  -H "X-API-Key: tap_live_..." \
  -H "X-On-Behalf-Of: alice" \
  -F "file=@photo.jpg" \
  -F "workflow_name=default_chain"
```

**Response:**
```json
{
  "workflow_id": "single-abc123",
  "status_url": "/status/single-abc123",
  "result_url": "/result/single-abc123",
  "projected_cost": 645
}
```

#### Start Workflow (JSON)

```bash
curl -X POST http://localhost:8000/run/mapping_flow \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tap_live_..." \
  -H "X-On-Behalf-Of: alice" \
  -d '{"payload": {"text": "Analyze this"}}'
```

#### Check Status

```bash
curl http://localhost:8000/status/{workflow_id} \
  -H "X-API-Key: tap_live_..."
```

#### Get Result (Blocking)

```bash
curl http://localhost:8000/result/{workflow_id} \
  -H "X-API-Key: tap_live_..."
```

---

## 🛠 Developer Guide

### Project Structure

```
temporal-agentic-pipeline/
├── src/
│   ├── server.py              # FastAPI gateway + auth + credit reservation
│   ├── worker.py              # Temporal worker + activity registration
│   ├── config.py              # Environment settings (incl. ADMIN_SECRET)
│   ├── schemas.py             # Pydantic models
│   │
│   ├── auth/                  # 🆕 Authentication Module
│   │   ├── dependencies.py    # get_auth_context, JWT/API Key validation
│   │   └── jwks.py            # TenantJWKSManager (key caching)
│   │
│   ├── workflows/
│   │   └── dynamic_workflow.py   # DAG interpreter + tenant_id propagation
│   │
│   ├── activities/
│   │   ├── http_tool.py          # CPU tool + tenant_id billing
│   │   ├── gpu_launcher.py       # GPU tool + tenant_id billing
│   │   ├── artifact_utils.py     # CAS normalization
│   │   └── credits_settlement.py # record_usage + settle_credits
│   │
│   ├── database/
│   │   ├── models.py             # Tenant, User, WorkflowExecution, ToolInvocation
│   │   ├── repository.py         # reserve_credits, settle_credits, JIT user
│   │   └── session.py            # Connection pooling
│   │
│   ├── api/
│   │   ├── routes_workflow_registry.py
│   │   ├── routes_history.py
│   │   ├── routes_credits.py     # Balance, topup, audit (with auth checks)
│   │   ├── routes_admin.py       # 🆕 Tenant onboarding
│   │   └── routes_analytics.py   # 🆕 User/Tenant financials
│   │
│   └── resources/
│       ├── tools.yaml
│       └── dags.yaml
│
└── tests/
    ├── test_db_and_credits.py    # B2B2C financial logic
    ├── test_auth_security.py     # 🆕 Authentication tests
    ├── test_e2e_presets.py       # Full pipeline with auth
    └── test_advanced_scenarios.py
```

### Key Code Paths

| Feature | File | Function |
|---------|------|----------|
| JWT Authentication | `auth/dependencies.py` | `_authenticate_jwt()` |
| API Key Authentication | `auth/dependencies.py` | `_authenticate_api_key()` |
| JIT User Creation | `auth/dependencies.py` | Within auth functions |
| JWKS Caching | `auth/jwks.py` | `TenantJWKSManager` |
| Tenant Onboarding | `api/routes_admin.py` | `create_tenant()` |
| Credit reservation | `database/repository.py` | `reserve_credits()` |
| Credit settlement | `database/repository.py` | `settle_credits()` |
| Usage recording | `database/repository.py` | `record_usage()` |

### Running Tests

```bash
# 1. Reset database
python -m tests.db_nuke

# 2. Start infrastructure
docker compose up -d

# 3. Start tool stubs (Terminal 2)
python tests/run_stubs.py

# 4. Start worker (Terminal 3)
python -m src.worker

# 5. Start API (Terminal 4)
uvicorn src.server:app --reload

# 6. Run all tests (Terminal 5)
python -m tests.test_db_and_credits       # ✅ B2B2C billing
python -m tests.test_auth_security        # ✅ JWT, API Key, isolation
python -m tests.test_e2e_presets          # ✅ Full pipeline
python -m tests.test_advanced_scenarios   # ✅ CAS, refunds, gates
```

**Expected Output:**
```
🧪 Testing B2B2C Credit & Billing Logic (V2.5)...
  ✅ Seeding User with 1000 credits.
  ✅ Credit Hold on User Wallet Successful.
  ✅ User Overdraft Protection (Double-Spend) verified.
  ✅ B2B2C Dual-Ledger Billing logic verified.
  ✅ Final Settlement on User Wallet verified.

🔐 ALL SECURITY TESTS PASSED.

🏆 ALL E2E PRESETS PASSED: Finance, Logic, Stochasticity, and B2B2C Attribution.
```

---

## 🔐 Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Token Substitution** | JWT `iss` claim must match Tenant's registered `issuer_url` |
| **API Key Exposure** | Keys hashed (SHA-256), prefixed `tap_live_` for secret scanning |
| **JWKS Fetch DoS** | Key caching in Redis (24h TTL) |
| **Self-Top-Up** | JWT users blocked from `/credits/topup` (403 Forbidden) |
| **Cross-Tenant Access** | All queries filtered by `tenant_id` |
| **User Data Isolation** | JWT users can only access their own data |
| **Credit Exhaustion** | Atomic holds with `FOR UPDATE` row locking |
| **Double-Spending** | `reserved_balance` prevents concurrent overspend |
| **Zombie Credit Locks** | Reaper script + settlement `finally` block |
| **Cost Overruns** | Safety brake + `projected_multiplier` limits |
| **SQL Injection** | SQLAlchemy ORM with parameterized queries |

---

## 🚧 Known Limitations

1. **Single API Key per Tenant** - Key rotation requires manual DB update. (Planned: multiple keys)

2. **No Rate Limiting** - Consider adding Redis-based rate limiting for auth endpoints.

3. **No Negative JWKS Cache** - Invalid `kid` values trigger network calls. (Planned: negative caching)

4. **No Webhook Support** - Tenants must poll for workflow completion. (Planned: webhooks)

5. **ADMIN_SECRET is Static** - Consider migrating to proper admin authentication.

6. **Same tool cannot appear twice in a DAG** - Use tool aliases in `tools.yaml`.

7. **No Distributed Tracing** - Consider adding OpenTelemetry.

8. **Single Redis Instance** - For HA, use Redis Cluster or Sentinel.

9. **Workflow results are ephemeral** - Long-term results in PostgreSQL.

10. **Fan-out projection is worst-case** - Users may be charged less than the hold.

---

## 📝 License

MIT
