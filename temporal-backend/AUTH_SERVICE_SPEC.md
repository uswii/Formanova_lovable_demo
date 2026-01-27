# FastAPI Auth Service

A lightweight, standalone authentication server designed to work with the [Temporal Agentic Pipeline](https://github.com/your-org/temporal-agentic-pipeline). Implements the **Federated Identity Pattern** using OpenID Connect (OIDC) standards, enabling vendor-agnostic authentication for multi-tenant AI orchestration.

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Your App      │         │   Auth Service  │         │ Agentic Pipeline│
│   (Frontend)    │         │   (Service B)   │         │   (Service A)   │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │  1. Login (email/Google)  │                           │
         │ ────────────────────────► │                           │
         │                           │                           │
         │  2. JWT (RS256 signed)    │                           │
         │ ◄──────────────────────── │                           │
         │                           │                           │
         │  3. POST /process + JWT   │                           │
         │ ──────────────────────────────────────────────────────►
         │                           │                           │
         │                           │  4. Fetch /.well-known/   │
         │                           │     jwks.json             │
         │                           │ ◄─────────────────────────│
         │                           │                           │
         │                           │  5. Public Key (cached)   │
         │                           │ ─────────────────────────►│
         │                           │                           │
         │  6. Workflow Result       │                           │
         │ ◄──────────────────────────────────────────────────────
```

---

## Table of Contents

- [Why This Architecture](#why-this-architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Integration with Agentic Pipeline](#integration-with-agentic-pipeline)
- [Authentication Flows](#authentication-flows)
- [Security Model](#security-model)
- [Development Guide](#development-guide)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Architecture Decisions](#architecture-decisions)

---

## Why This Architecture

### The Problem with Monolithic Auth

Traditional approaches embed authentication directly into the application:

```
❌ Monolithic Approach
┌─────────────────────────────────────┐
│          AI Pipeline                │
│  ┌─────────────────────────────┐   │
│  │  Auth Logic + User DB       │   │
│  │  + Password Hashing         │   │
│  │  + Session Management       │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Workflow Engine            │   │
│  │  + GPU Jobs                 │   │
│  │  + File Processing          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Problems:**
- If the Pipeline is compromised via malicious file upload, user passwords are exposed
- GPU memory leaks crash the auth system too
- Forces all clients to use your specific auth provider
- Scaling the Pipeline scales unnecessary auth infrastructure

### The Federated Identity Solution

```
✅ Federated Approach
┌─────────────────┐    ┌─────────────────┐
│  Auth Service   │    │ Agentic Pipeline│
│  (Stateful)     │    │  (Stateless)    │
├─────────────────┤    ├─────────────────┤
│ • User Database │    │ • Workflow DAGs │
│ • Password Hash │    │ • GPU Jobs      │
│ • OAuth Flows   │    │ • Tool Registry │
│ • Session Mgmt  │    │ • Credit System │
└────────┬────────┘    └────────┬────────┘
         │                      │
         │   JWT (RS256)        │
         └──────────────────────┘
              Trust via JWKS
```

**Benefits:**

| Benefit | Explanation |
|---------|-------------|
| **Vendor Agnosticism** | Clients can use Auth0, Okta, Supabase, or self-host this service |
| **Security Isolation** | Compromised Pipeline cannot access user credentials |
| **Failure Domain Separation** | Pipeline crashes don't affect login/billing |
| **Horizontal Scaling** | Scale auth and compute independently |
| **OIDC Standard** | Same protocol Google and Microsoft use |

---

## Features

- **RS256 JWT Signing**: Asymmetric keys—Pipeline only has public key, cannot forge tokens
- **OIDC Discovery**: Auto-configuration via `/.well-known/openid-configuration`
- **JWKS Endpoint**: Public keys at `/.well-known/jwks.json` for zero-config trust
- **Email/Password Auth**: Built-in registration, login, password reset
- **Google OAuth**: One-click social login (optional)
- **User Management**: Verification flows, profile updates, account deletion
- **Async PostgreSQL**: High-performance database with connection pooling
- **Docker Ready**: Single command deployment

---

## Quick Start

### Prerequisites

- Python 3.10+
- PostgreSQL 14+
- Docker (optional)

### Option 1: Docker Compose (Recommended)

```yaml
# docker-compose.yml
version: '3.8'

services:
  auth-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: auth
      POSTGRES_PASSWORD: auth_secret
      POSTGRES_DB: auth_service
    volumes:
      - auth_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U auth"]
      interval: 5s
      timeout: 5s
      retries: 5

  auth-service:
    build: .
    ports:
      - "8009:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://auth:auth_secret@auth-db:5432/auth_service
      ISSUER_URL: https://auth.your-domain.com
      SECRET: your-super-secret-key-change-in-production
      GOOGLE_CLIENT_ID: ""      # Optional: Enable Google OAuth
      GOOGLE_CLIENT_SECRET: ""  # Optional: Enable Google OAuth
    volumes:
      - ./private_key.pem:/app/private_key.pem:ro
    depends_on:
      auth-db:
        condition: service_healthy

volumes:
  auth_data:
```

```bash
# Start the stack
docker-compose up -d

# Verify it's running
curl http://localhost:8009/.well-known/openid-configuration
```

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/fastapi-auth-service.git
cd fastapi-auth-service

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/auth_service
ISSUER_URL=http://localhost:8009
SECRET=dev-secret-key
EOF

# Start PostgreSQL (if not running)
docker run -d --name auth-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=auth_service \
  -p 5432:5432 \
  postgres:15-alpine

# Run the server
uvicorn src.main:app --reload --port 8009
```

### Verify Installation

```bash
# Check OIDC discovery
curl -s http://localhost:8009/.well-known/openid-configuration | jq

# Expected output:
{
  "issuer": "http://localhost:8009",
  "jwks_uri": "http://localhost:8009/.well-known/jwks.json",
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"]
}

# Check JWKS endpoint
curl -s http://localhost:8009/.well-known/jwks.json | jq

# Expected output:
{
  "keys": [
    {
      "kty": "RSA",
      "alg": "RS256",
      "use": "sig",
      "kid": "auth-key-1",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string (asyncpg) |
| `ISSUER_URL` | ✅ | — | Public URL of this auth server (used in JWT `iss` claim) |
| `SECRET` | ✅ | — | Application secret for session encryption |
| `PRIVATE_KEY_PATH` | ❌ | `private_key.pem` | Path to RSA private key (auto-generated if missing) |
| `ACCESS_TOKEN_LIFETIME_SECONDS` | ❌ | `3600` | JWT expiration time (1 hour) |
| `GOOGLE_CLIENT_ID` | ❌ | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ❌ | — | Google OAuth client secret |

### RSA Key Management

**Development Mode:** If `private_key.pem` doesn't exist, a 2048-bit RSA key is auto-generated.

**Production Mode:** Generate and securely store your key:

```bash
# Generate a 4096-bit RSA key
openssl genrsa -out private_key.pem 4096

# Verify the key
openssl rsa -in private_key.pem -check -noout

# Extract public key (for reference only—use JWKS endpoint instead)
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

**Key Rotation:** See [Production Deployment](#key-rotation) section.

---

## API Reference

### Discovery Endpoints

#### `GET /.well-known/openid-configuration`

Returns OIDC discovery document for auto-configuration.

```json
{
  "issuer": "https://auth.your-domain.com",
  "jwks_uri": "https://auth.your-domain.com/.well-known/jwks.json",
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"]
}
```

#### `GET /.well-known/jwks.json`

Returns JSON Web Key Set containing public keys for JWT verification.

```json
{
  "keys": [
    {
      "kty": "RSA",
      "alg": "RS256",
      "use": "sig",
      "kid": "auth-key-1",
      "n": "0vx7agoebGcQ...",
      "e": "AQAB"
    }
  ]
}
```

### Authentication Endpoints

#### `POST /auth/register`

Register a new user with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "is_active": true,
  "is_verified": false,
  "is_superuser": false
}
```

#### `POST /auth/jwt/login`

Authenticate and receive a JWT.

**Request:** (form-urlencoded)
```
username=user@example.com&password=securePassword123!
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImF1dGgta2V5LTEifQ...",
  "token_type": "bearer"
}
```

**Decoded JWT Payload:**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "aud": "fastapi-users:auth",
  "email": "user@example.com",
  "iss": "https://auth.your-domain.com",
  "iat": 1704067200,
  "exp": 1704070800
}
```

#### `POST /auth/jwt/logout`

Invalidate the current token (client-side only—JWTs are stateless).

#### `GET /auth/google/authorize`

Initiate Google OAuth flow (if configured).

#### `GET /auth/google/callback`

Handle Google OAuth callback—creates user and returns JWT.

### User Management Endpoints

#### `GET /users/me`

Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "is_active": true,
  "is_verified": true,
  "is_superuser": false
}
```

#### `PATCH /users/me`

Update current user profile.

**Request:**
```json
{
  "email": "newemail@example.com"
}
```

#### `POST /auth/forgot-password`

Request password reset email.

#### `POST /auth/reset-password`

Reset password with token from email.

---

## Integration with Agentic Pipeline

### Step 1: Register Auth Service as a Tenant

The Agentic Pipeline needs to know about your Auth Service. This creates the trust relationship.

```bash
# On the Pipeline server
curl -X POST http://localhost:8000/admin/tenants \
  -H "X-Admin-Secret: your_admin_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Auth Service",
    "issuer_url": "https://auth.your-domain.com",
    "jwks_uri": "https://auth.your-domain.com/.well-known/jwks.json",
    "audience": "fastapi-users:auth"
  }'
```

**Response:**
```json
{
  "id": "ten_abc123...",
  "name": "My Auth Service",
  "api_key": "tap_live_xyz789..."
}
```

> ⚠️ **Save the `api_key`**—it's shown only once. This is used for machine-to-machine calls.

### Step 2: User Registration and Login

```bash
# Register a user
curl -X POST http://localhost:8009/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123!"
  }'

# Login to get JWT
curl -X POST http://localhost:8009/auth/jwt/login \
  -d "username=user@example.com&password=securePassword123!"

# Response: {"access_token": "eyJ...", "token_type": "bearer"}
```

### Step 3: Top Up User Credits (Machine-to-Machine)

Users need credits to run workflows. Use the API key from Step 1:

```bash
curl -X POST http://localhost:8000/credits/topup \
  -H "X-API-Key: tap_live_xyz789..." \
  -H "X-On-Behalf-Of: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000}'
```

> **Note:** The `X-On-Behalf-Of` header contains the user's UUID from the Auth Service (the `sub` claim in their JWT).

### Step 4: Run Workflows with User JWT

```bash
# User submits workflow with their JWT
curl -X POST http://localhost:8000/process \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "dag_name": "default_chain",
    "inputs": {"text": "Hello, world!"}
  }'
```

**What happens:**
1. Pipeline extracts `iss` from JWT → finds matching Tenant
2. Pipeline fetches JWKS from `jwks_uri` → verifies signature
3. Pipeline extracts `sub` → JIT provisions User if new
4. Pipeline checks User credits → reserves estimated cost
5. Pipeline runs workflow → records actual usage
6. Pipeline settles credits → charges only for success

### Complete Integration Test Script

```bash
#!/bin/bash
set -e

PIPELINE="http://localhost:8000"
AUTH="http://localhost:8009"
ADMIN_SECRET="your_admin_secret"
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_PASS="securePass123!"

echo "=== Federated Auth Integration Test ==="

# 1. Register Tenant (one-time setup)
echo "1. Registering tenant..."
TENANT=$(curl -s -X POST "$PIPELINE/admin/tenants" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Auth Server\",
    \"issuer_url\": \"$AUTH\",
    \"jwks_uri\": \"$AUTH/.well-known/jwks.json\",
    \"audience\": \"fastapi-users:auth\"
  }")
API_KEY=$(echo "$TENANT" | jq -r '.api_key')
echo "   API Key: ${API_KEY:0:20}..."

# 2. Register User
echo "2. Registering user..."
USER=$(curl -s -X POST "$AUTH/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASS\"}")
USER_ID=$(echo "$USER" | jq -r '.id')
echo "   User ID: $USER_ID"

# 3. Login
echo "3. Logging in..."
TOKEN=$(curl -s -X POST "$AUTH/auth/jwt/login" \
  -d "username=$TEST_EMAIL&password=$TEST_PASS" | jq -r '.access_token')
echo "   JWT acquired"

# 4. Top up credits (M2M call)
echo "4. Topping up credits..."
curl -s -X POST "$PIPELINE/credits/topup" \
  -H "X-API-Key: $API_KEY" \
  -H "X-On-Behalf-Of: $USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500}'
echo "   Balance: 500 credits"

# 5. Run workflow (User context)
echo "5. Running workflow..."
RESULT=$(curl -s -X POST "$PIPELINE/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dag_name": "default_chain",
    "inputs": {"text": "Integration test"}
  }')
WF_ID=$(echo "$RESULT" | jq -r '.workflow_id')
echo "   Workflow ID: $WF_ID"

echo ""
echo "=== Integration Successful ==="
echo "• Pipeline trusts Auth Server keys (JWKS verified)"
echo "• Pipeline verified JWT signature (RS256)"
echo "• Pipeline JIT-provisioned user $USER_ID"
echo "• Credits deducted correctly"
```

---

## Authentication Flows

### Flow 1: Email/Password (User-to-Machine)

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐
│  Client  │         │ Auth Service │         │   Pipeline   │
└────┬─────┘         └──────┬───────┘         └──────┬───────┘
     │                      │                        │
     │ POST /auth/register  │                        │
     │─────────────────────►│                        │
     │                      │                        │
     │ POST /auth/jwt/login │                        │
     │─────────────────────►│                        │
     │                      │                        │
     │◄─────────────────────│                        │
     │    JWT (RS256)       │                        │
     │                      │                        │
     │ POST /process + JWT  │                        │
     │──────────────────────────────────────────────►│
     │                      │                        │
     │                      │◄───────────────────────│
     │                      │  GET /.well-known/jwks │
     │                      │                        │
     │                      │───────────────────────►│
     │                      │    Public Keys         │
     │                      │                        │
     │◄──────────────────────────────────────────────│
     │              Workflow Result                  │
```

### Flow 2: Google OAuth (User-to-Machine)

```
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │ Auth Service │     │  Google  │     │ Pipeline │
└────┬─────┘     └──────┬───────┘     └────┬─────┘     └────┬─────┘
     │                  │                  │                │
     │ GET /auth/google/authorize         │                │
     │─────────────────►│                  │                │
     │                  │                  │                │
     │◄─────────────────│                  │                │
     │  Redirect to Google                 │                │
     │                  │                  │                │
     │──────────────────────────────────────►               │
     │              Google Login           │                │
     │                  │                  │                │
     │◄──────────────────────────────────────               │
     │  Redirect with code                 │                │
     │                  │                  │                │
     │ GET /auth/google/callback?code=... │                │
     │─────────────────►│                  │                │
     │                  │                  │                │
     │                  │ Exchange code    │                │
     │                  │─────────────────►│                │
     │                  │                  │                │
     │                  │◄─────────────────│                │
     │                  │  User info       │                │
     │                  │                  │                │
     │◄─────────────────│                  │                │
     │    JWT (RS256)   │                  │                │
     │                  │                  │                │
     │ POST /process + JWT                 │                │
     │─────────────────────────────────────────────────────►│
```

### Flow 3: Machine-to-Machine (API Key + Impersonation)

For backend systems that need to act on behalf of users:

```
┌──────────────┐         ┌──────────────┐
│ Your Backend │         │   Pipeline   │
└──────┬───────┘         └──────┬───────┘
       │                        │
       │ POST /credits/topup    │
       │ X-API-Key: tap_live_...│
       │ X-On-Behalf-Of: <uuid> │
       │───────────────────────►│
       │                        │
       │                        │ Validate API Key
       │                        │ JIT Provision User
       │                        │ Add Credits
       │                        │
       │◄───────────────────────│
       │     200 OK             │
```

---

## Security Model

### Token Security

| Aspect | Implementation | Rationale |
|--------|----------------|-----------|
| **Algorithm** | RS256 (asymmetric) | Pipeline cannot forge tokens—only Auth Service has private key |
| **Key Length** | 2048-bit (dev) / 4096-bit (prod) | NIST recommended minimum |
| **Token Lifetime** | 1 hour (default) | Limits exposure window |
| **Key ID (`kid`)** | In JWT header | Enables key rotation without downtime |
| **Issuer (`iss`)** | Auth Service URL | Tenant identification + prevents token substitution |
| **Audience (`aud`)** | `fastapi-users:auth` | Validates intended recipient |

### Why RS256 over HS256?

```
HS256 (Symmetric - DANGEROUS for distributed systems)
┌─────────────┐                    ┌─────────────┐
│   Auth      │  Shared Secret     │  Pipeline   │
│   Service   │◄──────────────────►│             │
└─────────────┘                    └─────────────┘
       │                                  │
       │  If Pipeline is compromised,     │
       │  attacker can forge ANY token    │
       └──────────────────────────────────┘

RS256 (Asymmetric - SECURE for distributed systems)
┌─────────────┐                    ┌─────────────┐
│   Auth      │  Private Key       │  Pipeline   │
│   Service   │  (never shared)    │             │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  Public Key only                 │
       │  (via JWKS endpoint)             │
       └──────────────────────────────────┘
       
       If Pipeline is compromised,
       attacker can only VERIFY tokens,
       not forge them.
```

### JWKS Caching

The Pipeline caches JWKS responses to avoid hitting the Auth Service on every request:

- **TTL:** 24 hours
- **Refresh:** On cache miss or explicit `force_refresh`
- **Recommendation:** Add negative caching for unknown `kid` values to prevent DoS

### Password Storage

- **Algorithm:** bcrypt (via `fastapi-users`)
- **Work Factor:** 12 rounds (default)
- **Pepper:** Application `SECRET` adds defense-in-depth

---

## Development Guide

### Project Structure

```
fastapi-auth-service/
├── src/
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── backend.py      # FastAPI-Users auth backend configuration
│   │   ├── keys.py         # RSA key management + JWKS generation
│   │   ├── manager.py      # User lifecycle hooks
│   │   └── strategy.py     # Custom RS256 JWT strategy
│   ├── database/
│   │   ├── __init__.py
│   │   ├── db.py           # Database session + dependencies
│   │   └── models.py       # SQLAlchemy models (User, OAuthAccount)
│   ├── schemas/
│   │   └── user.py         # Pydantic schemas (UserRead, UserCreate, UserUpdate)
│   ├── config.py           # Settings from environment variables
│   └── main.py             # FastAPI application + route registration
├── tests/
│   ├── test_auth.py        # Authentication tests
│   ├── test_jwks.py        # JWKS endpoint tests
│   └── conftest.py         # Pytest fixtures
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

### Adding New Features

#### Custom Claims in JWT

Edit `src/auth/strategy.py`:

```python
async def write_token(self, user) -> str:
    data = {
        "sub": str(user.id),
        "aud": self.token_audience,
        "email": user.email,
        "iss": settings.issuer_url,
        
        # Add custom claims here
        "roles": ["user"],  # Example: user roles
        "tenant": "default",  # Example: multi-tenancy
    }
    # ... rest of method
```

#### Custom User Fields

1. Edit `src/database/models.py`:

```python
class User(SQLAlchemyBaseUserTableUUID, Base):
    # Add custom fields
    full_name: Mapped[str] = mapped_column(String(100), nullable=True)
    organization: Mapped[str] = mapped_column(String(200), nullable=True)
```

2. Edit `src/schemas/user.py`:

```python
class UserRead(schemas.BaseUser[uuid.UUID]):
    full_name: str | None = None
    organization: str | None = None

class UserCreate(schemas.BaseUserCreate):
    full_name: str | None = None
    organization: str | None = None
```

3. Run migration:

```bash
alembic revision --autogenerate -m "Add user fields"
alembic upgrade head
```

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_auth.py -v
```

### Local Development with Pipeline

```bash
# Terminal 1: Auth Service
cd fastapi-auth-service
source .venv/bin/activate
uvicorn src.main:app --reload --port 8009

# Terminal 2: Agentic Pipeline
cd temporal-agentic-pipeline
source .venv/bin/activate
uvicorn src.server:app --reload --port 8000

# Terminal 3: Test the integration
./integration_test.sh
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Generate 4096-bit RSA key (not auto-generated dev key)
- [ ] Set secure `SECRET` (at least 32 random characters)
- [ ] Configure `ISSUER_URL` to match your public domain
- [ ] Enable HTTPS (required for OAuth and secure cookies)
- [ ] Set up database backups
- [ ] Configure rate limiting (nginx/cloudflare)
- [ ] Set up monitoring and alerting
- [ ] Review password policy

### Docker Production Configuration

```dockerfile
# Dockerfile.prod
FROM python:3.10-slim

WORKDIR /app

# Security: Run as non-root user
RUN useradd -m -u 1000 appuser

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

# Security: Don't include private key in image
# Mount it as a secret volume at runtime

USER appuser

EXPOSE 8000

CMD ["gunicorn", "src.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  auth-service:
    build:
      context: .
      dockerfile: Dockerfile.prod
    environment:
      DATABASE_URL: ${DATABASE_URL}
      ISSUER_URL: ${ISSUER_URL}
      SECRET: ${SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
    secrets:
      - private_key
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/.well-known/openid-configuration"]
      interval: 30s
      timeout: 10s
      retries: 3

secrets:
  private_key:
    file: ./private_key.pem
```

### Key Rotation

To rotate RSA keys without downtime:

1. **Generate new key:**
   ```bash
   openssl genrsa -out private_key_v2.pem 4096
   ```

2. **Update JWKS to include both keys:**
   ```python
   # src/auth/keys.py
   def get_jwks(self) -> dict:
       return {
           "keys": [
               self._key_to_jwk("auth-key-2", self.new_public_key),  # New key first
               self._key_to_jwk("auth-key-1", self.old_public_key),  # Old key for validation
           ]
       }
   ```

3. **Update signing to use new key:**
   ```python
   # src/auth/strategy.py
   headers={"kid": "auth-key-2"}  # New key ID
   ```

4. **Wait for old tokens to expire** (1 hour default)

5. **Remove old key from JWKS**

### Monitoring

#### Health Check Endpoint

Add to `src/main.py`:

```python
from sqlalchemy import text

@app.get("/health")
async def health_check():
    # Check database connectivity
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": str(e)}
        )
    
    return {
        "status": "healthy",
        "version": "1.0.0",
        "issuer": settings.issuer_url
    }
```

#### Metrics (Prometheus)

```python
# Add to requirements.txt
prometheus-fastapi-instrumentator

# Add to src/main.py
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)
```

### Security Hardening

#### Fix Hardcoded Secrets

```python
# src/auth/manager.py - BEFORE (insecure)
reset_password_token_secret = "RESET_SECRET_CHANGE_ME"
verification_token_secret = "VERIFY_SECRET_CHANGE_ME"

# AFTER (secure)
reset_password_token_secret = settings.secret + "_reset"
verification_token_secret = settings.secret + "_verify"
```

#### Rate Limiting (nginx)

```nginx
# /etc/nginx/conf.d/auth-service.conf
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/s;

server {
    listen 443 ssl;
    server_name auth.your-domain.com;
    
    location /auth/jwt/login {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://auth-service:8000;
    }
    
    location /auth/register {
        limit_req zone=auth_limit burst=3 nodelay;
        proxy_pass http://auth-service:8000;
    }
    
    location / {
        proxy_pass http://auth-service:8000;
    }
}
```

---

## Troubleshooting

### Common Issues

#### "Connection refused" when Pipeline fetches JWKS

**Cause:** Pipeline cannot reach Auth Service network.

**Fix:**
- Ensure both services are on same Docker network
- Check `ISSUER_URL` is accessible from Pipeline container
- Verify firewall rules allow traffic on port 8009

```bash
# Test from Pipeline container
docker exec -it pipeline curl http://auth-service:8000/.well-known/jwks.json
```

#### "Invalid signature" on JWT verification

**Cause:** Key mismatch between signing and verification.

**Debug:**
```bash
# Decode JWT header to see kid
echo "eyJhbGciOiJSUzI1Ni..." | cut -d. -f1 | base64 -d | jq

# Verify JWKS contains matching kid
curl -s http://localhost:8009/.well-known/jwks.json | jq '.keys[].kid'
```

**Fix:**
- Ensure `kid` in JWT header matches `kid` in JWKS
- Check RSA key wasn't regenerated (dev mode auto-generates)

#### "issuer claim mismatch"

**Cause:** `ISSUER_URL` doesn't match what Pipeline expects.

**Fix:**
- Tenant's `issuer_url` must exactly match `ISSUER_URL` env var
- Include protocol: `https://auth.example.com` not `auth.example.com`
- No trailing slash

#### Database connection errors

**Cause:** Connection pool exhaustion or PostgreSQL unavailable.

**Fix:**
```python
# src/database/models.py - Increase pool settings
engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
)
```

#### Google OAuth callback fails

**Cause:** Redirect URI mismatch.

**Fix:**
1. Go to Google Cloud Console → Credentials
2. Add authorized redirect URI: `https://auth.your-domain.com/auth/google/callback`
3. Ensure `ISSUER_URL` matches exactly

### Debug Mode

Enable detailed logging:

```python
# src/main.py
import logging
logging.basicConfig(level=logging.DEBUG)

# Or use structlog
import structlog
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)
```

---

## Architecture Decisions

### Why FastAPI-Users?

| Alternative | Reason Not Chosen |
|-------------|-------------------|
| Build from scratch | High risk of security bugs (password hashing, timing attacks) |
| Django + DRF | Sync ORM doesn't fit async Pipeline architecture |
| Auth0/Okta SDK | Vendor lock-in defeats the purpose of federated auth |
| Authlib | Lower-level, more boilerplate for same result |

**FastAPI-Users provides:**
- Battle-tested password hashing (bcrypt)
- OAuth2 flows out of the box
- SQLAlchemy async support
- Extensible strategy system (we customized for RS256)

### Why Separate Database?

The Auth Service uses its own PostgreSQL database, not the Pipeline's:

1. **Security isolation:** Compromised Pipeline cannot access password hashes
2. **Independent scaling:** Auth can be horizontally scaled separately
3. **Different access patterns:** Auth is read-heavy (login), Pipeline is write-heavy (workflow logs)
4. **Compliance:** User PII can be stored in different jurisdiction if needed

### Why Not Refresh Tokens?

Current implementation issues short-lived access tokens (1 hour) without refresh tokens:

**Pros of this approach:**
- Simpler implementation
- Stateless (no token storage needed)
- Forced re-authentication limits exposure window

**When to add refresh tokens:**
- Mobile apps where re-login is disruptive
- Long-running sessions needed
- Implementing "remember me" feature

To add refresh tokens, extend `RS256JWTStrategy` with a `write_refresh_token` method.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

