
## What the user is saying

"Only add correct existing URLs — don't invent your own."

This means: in the sitemap.xml and llms.txt, only list URLs that actually exist in the app right now (plus the two new landing pages we are creating as part of this plan). Do NOT list URLs that don't exist yet.

## Confirmed existing URLs from codebase

**Public (no auth wall):**
- `https://formanova.ai/` — Welcome
- `https://formanova.ai/login` — Auth
- `https://formanova.ai/yourresults/:token` — omit (token-based, not crawlable)

**Auth-protected (user explicitly listed these — include in sitemap):**
- `https://formanova.ai/dashboard`
- `https://formanova.ai/studio`
- `https://formanova.ai/studio/necklace`
- `https://formanova.ai/studio/earrings`
- `https://formanova.ai/studio/rings`
- `https://formanova.ai/studio/bracelets`
- `https://formanova.ai/studio/watches`
- `https://formanova.ai/studio-cad`
- `https://formanova.ai/text-to-cad`
- `https://formanova.ai/pricing`

**New pages being created as part of this plan (valid to include):**
- `https://formanova.ai/ai-jewelry-photoshoot`
- `https://formanova.ai/ai-jewelry-cad`

**Omitted (not meaningful for crawlers):**
- `/oauth-callback` — transient auth flow
- `/payment-success`, `/success`, `/cancel` — post-payment states
- `/generations`, `/credits` — utility pages, low SEO value
- `/admin/*` — intentionally unlisted
- `/cad-to-catalog` — secondary, no SEO value right now

## The plan (what changes)

### Step 1 — `public/robots.txt` (update)
Add AI crawlers + sitemap pointer. Additive only.

### Step 2 — `public/sitemap.xml` (create)
Use ONLY the verified URL list above. No invented paths.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://formanova.ai/</loc><priority>1.0</priority></url>
  <url><loc>https://formanova.ai/login</loc><priority>0.5</priority></url>
  <url><loc>https://formanova.ai/ai-jewelry-photoshoot</loc><priority>0.9</priority></url>
  <url><loc>https://formanova.ai/ai-jewelry-cad</loc><priority>0.9</priority></url>
  <url><loc>https://formanova.ai/pricing</loc><priority>0.8</priority></url>
  <url><loc>https://formanova.ai/studio</loc><priority>0.7</priority></url>
  <url><loc>https://formanova.ai/studio/necklace</loc><priority>0.6</priority></url>
  <url><loc>https://formanova.ai/studio/earrings</loc><priority>0.6</priority></url>
  <url><loc>https://formanova.ai/studio/rings</loc><priority>0.6</priority></url>
  <url><loc>https://formanova.ai/studio/bracelets</loc><priority>0.6</priority></url>
  <url><loc>https://formanova.ai/studio/watches</loc><priority>0.6</priority></url>
  <url><loc>https://formanova.ai/studio-cad</loc><priority>0.6</priority></url>
  <url><loc>https://formanova.ai/text-to-cad</loc><priority>0.7</priority></url>
  <url><loc>https://formanova.ai/dashboard</loc><priority>0.5</priority></url>
</urlset>
```

### Step 3 — `public/llms.txt` (create)
Only references URLs from the verified list above. No invented endpoints, no free trial mention.

### Step 4 — `public/.well-known/agent.json` (create)
Agent card referencing only real product capabilities.

### Step 5 — `index.html` (update)
Add canonical, keywords meta, JSON-LD SoftwareApplication schema. Surgical — 3 new tags only.

### Step 6 — `src/pages/AIJewelryPhotoshoot.tsx` (create)
Public landing page for `/ai-jewelry-photoshoot`.

### Step 7 — `src/pages/AIJewelryCAD.tsx` (create)
Public landing page for `/ai-jewelry-cad`.

### Step 8 — `src/App.tsx` (update)
Add 2 lazy routes above the `*` catch-all. No other routes touched.

---

That's the complete, corrected plan. Only real URLs used throughout. Ready to implement all 8 steps sequentially.
