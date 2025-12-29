# What to Bring Back for Frontend Integration

Once your Temporal backend is built and deployed, provide me with these details so I can update the Lovable frontend to use it.

---

## Required Information

### 1. API Base URL
```
Example: https://your-temporal-api.com
or: http://your-server-ip:8080
```

### 2. Confirm These Endpoints Work

Test and confirm:
- `POST /workflow/start` - returns `{ workflowId, status }`
- `GET /workflow/{id}` - returns status with progress
- `GET /health` - returns service status

### 3. Response Format Confirmation

Confirm the exact response structure for completed workflows:

```json
{
  "status": "COMPLETED",
  "result": {
    "fluxResultBase64": "...",
    "geminiResultBase64": "...",
    "fluxMetrics": { "precision": 0.98, "recall": 0.95, "iou": 0.92, "growthRatio": 1.02 },
    "geminiMetrics": { ... },
    "fluxFidelityVizBase64": "...",
    "geminiFidelityVizBase64": "..."
  }
}
```

If your field names differ (e.g., `flux_result_base64` vs `fluxResultBase64`), let me know.

### 4. Authentication (if any)

- Does the API require any auth headers?
- API key? Bearer token?
- Or is it open/CORS-only protected?

### 5. Error Response Format

What does a failed workflow return? Example:
```json
{
  "status": "FAILED",
  "error": {
    "code": "A100_UNAVAILABLE",
    "message": "..."
  }
}
```

---

## What I'll Do With This

Once you provide the above, I will:

1. **Create a new API client** (`src/lib/temporal-api.ts`)
2. **Create a React hook** (`src/hooks/use-generation-workflow.ts`)
3. **Simplify StepRefineAndGenerate.tsx** to just:
   - Start workflow on "Generate" click
   - Poll for status
   - Display results when complete
4. **Remove** the complex orchestration logic currently in the frontend
5. **Add environment variable** `VITE_TEMPORAL_API_URL`

---

## Optional Nice-to-Haves

If you can also provide:
- **WebSocket endpoint** for real-time progress (instead of polling)
- **Workflow history endpoint** to see past generations for a session
- **Retry endpoint** to retry a failed workflow from the last successful step

---

## Quick Checklist

Before coming back to me, verify:

- [ ] Can start a workflow with base64 image + mask points
- [ ] Can poll workflow and see progress updates
- [ ] Completed workflow returns base64 result images
- [ ] Failed workflow returns meaningful error
- [ ] CORS allows requests from `*.lovableproject.com`
- [ ] Health check shows all external services connected

---

## Example Test Request

Test your API with this cURL:

```bash
# 1. Start workflow (use a small test image)
curl -X POST https://your-api.com/workflow/start \
  -H "Content-Type: application/json" \
  -d '{
    "originalImageBase64": "/9j/4AAQSkZJRg...(truncated)",
    "maskPoints": [
      {"x": 0.5, "y": 0.5, "label": 1}
    ]
  }'

# Response: {"workflowId": "abc123", "status": "RUNNING"}

# 2. Poll status
curl https://your-api.com/workflow/abc123

# Response shows progress until COMPLETED or FAILED
```

---

Once you have this working, just message me with:
1. The API URL
2. Confirmation it works
3. Any differences from the expected response format

And I'll update the frontend!
