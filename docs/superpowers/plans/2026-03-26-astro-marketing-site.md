# FormaNova Marketing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static Astro marketing site served under `formanova.ai` that gives Google and LLM crawlers fully-rendered HTML for all public marketing pages, without touching the existing React SPA.

**Architecture:** Separate repo at `~/formanova-marketing/` builds to static HTML files. nginx routes `/about`, `/blog`, `/press`, `/whitepaper`, `/glossary`, `/terms`, `/privacy`, `/_astro/`, `/sitemap.xml`, `/rss.xml`, and `/llms.txt` to the Astro dist folder. All other traffic falls through to the React SPA unchanged. Astro owns the sitemap — SPA routes are declared once in `astro.config.mjs` via `customPages`; Astro pages (including every new blog post) are auto-detected on each build.

**Tech Stack:** Astro 4.x (static output), `@astrojs/sitemap`, `@astrojs/rss`, vanilla CSS, vanilla JS (zero React, zero Tailwind in this project)

> **Working directory note:** ALL file paths in this plan are relative to `~/formanova-marketing/` UNLESS explicitly stated otherwise. The existing FormaNova React app is not touched until Task 18 (nginx).

---

## File Map

```
~/formanova-marketing/
├── src/
│   ├── content/
│   │   ├── config.ts                        # Blog collection schema (Zod)
│   │   └── blog/
│   │       └── 2026-03-26-wja-partnership.md  # Seed post (Task 17)
│   ├── layouts/
│   │   ├── BaseLayout.astro                 # HTML shell, fonts, meta, OG, scroll JS
│   │   └── BlogLayout.astro                 # Blog post wrapper + Article structured data
│   ├── pages/
│   │   ├── about.astro
│   │   ├── press.astro
│   │   ├── whitepaper.astro
│   │   ├── glossary.astro
│   │   ├── terms.astro
│   │   ├── privacy.astro
│   │   ├── rss.xml.ts                       # RSS feed endpoint
│   │   └── blog/
│   │       ├── index.astro                  # Post listing
│   │       └── [...slug].astro              # Individual posts
│   └── components/
│       ├── Header.astro
│       ├── Footer.astro
│       └── BlogCard.astro
├── public/
│   ├── formanova-logo-black-tagline.png     # Copied from main repo
│   ├── llms.txt
│   ├── blog/
│   │   └── images/                          # Blog post images (.webp)
│   └── whitepapers/                         # PDF downloads
├── src/
│   └── styles/
│       └── global.css                       # Design tokens + reset + layout
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── deploy.sh
└── README.md
```

---

## Task 1: Scaffold Project

**Files:**
- Create: `~/formanova-marketing/package.json`
- Create: `~/formanova-marketing/astro.config.mjs`
- Create: `~/formanova-marketing/tsconfig.json`
- Create: `~/formanova-marketing/.gitignore`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir ~/formanova-marketing && cd ~/formanova-marketing
```

Create `package.json`:
```json
{
  "name": "formanova-marketing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/rss": "^4.0.7",
    "@astrojs/sitemap": "^3.1.6",
    "astro": "^4.16.18"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create astro.config.mjs**

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://formanova.ai',
  integrations: [
    sitemap({
      // Astro auto-detects its own pages (blog posts, about, press, etc.)
      // SPA routes are listed here manually — these are all public routes
      // in the React SPA that matter for SEO.
      //
      // ⚠️ If a new PUBLIC route is added to the React SPA (i.e. not behind
      // ProtectedRoute), add it to this list and redeploy.
      customPages: [
        'https://formanova.ai/',
        'https://formanova.ai/ai-jewelry-photoshoot',
        'https://formanova.ai/ai-jewelry-cad',
        'https://formanova.ai/pricing',
      ],
    }),
  ],
  output: 'static',
});
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/base",
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.astro/
.env
```

- [ ] **Step 6: Create required directory structure**

```bash
mkdir -p src/content/blog src/layouts src/pages/blog src/components src/styles public/blog/images public/whitepapers
```

- [ ] **Step 7: Verify Astro recognises the project**

```bash
npx astro info
```

Expected: prints Astro version, platform info. No errors.

- [ ] **Step 8: Initialise git**

```bash
git init
git add .
git commit -m "chore: scaffold Astro marketing site"
```

---

## Task 2: Design Tokens + Logo Asset

**Files:**
- Create: `src/styles/global.css`
- Create: `public/formanova-logo-black-tagline.png` (copied)

- [ ] **Step 1: Copy logo from main repo**

```bash
cp ~/Desktop/Formanova_lovable_demo/src/assets/formanova-logo-black-tagline.png public/
```

- [ ] **Step 2: Create global.css**

```css
/* src/styles/global.css */

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
img, video { display: block; max-width: 100%; }

/* ── Design tokens ── */
:root {
  --bg: #ffffff;
  --fg: #000000;
  --muted: #737373;
  --border: #e5e5e5;
  --gold: hsl(42, 85%, 38%);
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --header-h: 64px;
  --max-w: 1200px;
  --page-px: 2rem;
}

@media (min-width: 1024px) {
  :root { --header-h: 80px; }
}

/* ── Base ── */
body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--fg);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  letter-spacing: 0.02em;
  line-height: 1.1;
}

p, li { line-height: 1.65; }
a { color: inherit; text-decoration: none; }
a:hover { text-decoration: underline; }

/* ── Layout helpers ── */
.container {
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 var(--page-px);
}

.page-body {
  padding-top: var(--header-h);
  min-height: 100vh;
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--fg);
  color: var(--bg);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s;
}

.btn:hover { opacity: 0.85; text-decoration: none; }

.btn-outline {
  background: transparent;
  color: var(--fg);
  border: 1px solid var(--fg);
}

/* ── Prose (for legal / blog content) ── */
.prose {
  max-width: 720px;
  line-height: 1.7;
}

.prose h2 { margin: 2.5rem 0 1rem; font-size: 1.75rem; }
.prose h3 { margin: 2rem 0 0.75rem; font-size: 1.35rem; }
.prose p { margin-bottom: 1.25rem; }
.prose ul, .prose ol { margin: 0 0 1.25rem 1.5rem; }
.prose li { margin-bottom: 0.4rem; }
.prose a { color: var(--gold); text-decoration: underline; }
.prose blockquote {
  border-left: 3px solid var(--fg);
  padding-left: 1.25rem;
  margin: 1.5rem 0;
  font-style: italic;
  color: var(--muted);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css public/formanova-logo-black-tagline.png
git commit -m "feat: design tokens, global CSS, logo asset"
```

---

## Task 3: Header Component

**Files:**
- Create: `src/components/Header.astro`

- [ ] **Step 1: Create Header.astro**

```astro
---
// src/components/Header.astro
const navLinks = [
  { href: '/about',   label: 'About' },
  { href: '/blog',    label: 'Blog' },
  { href: '/press',   label: 'Press' },
  { href: 'https://formanova.ai/pricing', label: 'Pricing' },
];

const currentPath = Astro.url.pathname;
---

<header id="site-header">
  <div class="header-inner container">
    <a href="https://formanova.ai" class="logo-link" aria-label="FormaNova home">
      <img
        src="/formanova-logo-black-tagline.png"
        alt="FormaNova"
        width="160"
        height="40"
        loading="eager"
        decoding="sync"
      />
    </a>

    <nav class="desktop-nav" aria-label="Main navigation">
      {navLinks.map(link => (
        <a
          href={link.href}
          class={`nav-link${currentPath.startsWith(link.href) ? ' active' : ''}`}
        >
          {link.label}
        </a>
      ))}
      <a href="https://formanova.ai/login" class="btn" style="padding: 0.5rem 1.25rem; font-size: 0.875rem;">
        Get Started →
      </a>
    </nav>

    <button
      id="mobile-menu-btn"
      aria-label="Open menu"
      aria-expanded="false"
      aria-controls="mobile-menu"
    >
      <span class="hamburger-icon">
        <span></span><span></span><span></span>
      </span>
    </button>
  </div>
</header>

<!-- Mobile overlay -->
<div id="mobile-menu" class="mobile-overlay" aria-hidden="true">
  <nav aria-label="Mobile navigation">
    {navLinks.map((link, i) => (
      <a
        href={link.href}
        class="mobile-nav-link"
        style={`--delay: ${i * 80 + 100}ms`}
      >
        {link.label}
      </a>
    ))}
    <a
      href="https://formanova.ai/login"
      class="mobile-nav-link"
      style={`--delay: ${navLinks.length * 80 + 100}ms`}
    >
      Get Started →
    </a>
  </nav>
</div>

<!-- Spacer so page content clears the fixed header -->
<div style={`height: var(--header-h)`}></div>

<style>
  #site-header {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 50;
    height: var(--header-h);
    background: var(--bg);
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    border-bottom: 1px solid transparent;
  }

  #site-header.scrolled {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom-color: rgba(0, 0, 0, 0.08);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }

  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
  }

  .logo-link { display: flex; align-items: center; }
  .logo-link img { height: 36px; width: auto; }
  @media (min-width: 1024px) { .logo-link img { height: 44px; } }

  /* Desktop nav */
  .desktop-nav {
    display: none;
    align-items: center;
    gap: 1.5rem;
  }
  @media (min-width: 1024px) { .desktop-nav { display: flex; } }

  .nav-link {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted);
    transition: color 0.15s;
  }
  .nav-link:hover, .nav-link.active { color: var(--fg); text-decoration: none; }

  /* Hamburger */
  #mobile-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px; height: 36px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  @media (min-width: 1024px) { #mobile-menu-btn { display: none; } }

  .hamburger-icon {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .hamburger-icon span {
    display: block;
    width: 20px; height: 1.5px;
    background: var(--fg);
    transition: transform 0.25s, opacity 0.25s;
  }

  /* Mobile overlay */
  .mobile-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.35s;
  }
  .mobile-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }
  .mobile-overlay nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
  }

  .mobile-nav-link {
    font-family: var(--font-display);
    font-size: 2.5rem;
    letter-spacing: 0.05em;
    color: var(--muted);
    opacity: 0;
    transform: translateY(20px);
    transition: color 0.15s, opacity 0.4s var(--delay, 0ms), transform 0.4s var(--delay, 0ms);
  }
  .mobile-overlay.open .mobile-nav-link {
    opacity: 1;
    transform: translateY(0);
    color: var(--fg);
  }
  .mobile-nav-link:hover { color: var(--gold); text-decoration: none; }
</style>

<script>
  const header = document.getElementById('site-header')!;
  const btn = document.getElementById('mobile-menu-btn')!;
  const menu = document.getElementById('mobile-menu')!;

  // Scroll: add/remove .scrolled class
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Mobile menu toggle
  btn.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    menu.setAttribute('aria-hidden', String(!isOpen));
  });

  // Close mobile menu on nav link click
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
    });
  });
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Header.astro
git commit -m "feat: Header component with scroll effect and mobile menu"
```

---

## Task 4: Footer Component

**Files:**
- Create: `src/components/Footer.astro`

- [ ] **Step 1: Create Footer.astro**

```astro
---
// src/components/Footer.astro
const year = new Date().getFullYear();

const links = [
  { href: '/about',     label: 'About' },
  { href: '/blog',      label: 'Blog' },
  { href: '/press',     label: 'Press' },
  { href: '/whitepaper', label: 'Whitepaper' },
  { href: '/glossary',  label: 'Glossary' },
  { href: '/terms',     label: 'Terms' },
  { href: '/privacy',   label: 'Privacy' },
];
---

<footer>
  <div class="footer-inner container">
    <div class="footer-brand">
      <a href="https://formanova.ai" aria-label="FormaNova home">
        <img src="/formanova-logo-black-tagline.png" alt="FormaNova" width="140" height="34" loading="lazy" />
      </a>
      <p class="footer-tagline">AI jewelry photography.<br />Purpose-built for the jewelry industry.</p>
    </div>

    <div class="footer-links">
      <p class="footer-section-label">Pages</p>
      <ul>
        {links.map(link => (
          <li><a href={link.href}>{link.label}</a></li>
        ))}
      </ul>
    </div>
  </div>

  <div class="footer-bar container">
    <span>© {year} FormaNova. All rights reserved.</span>
    <div class="footer-social">
      <a href="https://linkedin.com/company/formanova" aria-label="FormaNova on LinkedIn" rel="noopener noreferrer" target="_blank">LinkedIn</a>
    </div>
  </div>
</footer>

<style>
  footer {
    border-top: 1px solid var(--fg);
    margin-top: 6rem;
    padding-top: 3rem;
    background: var(--bg);
  }

  .footer-inner {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2.5rem;
    padding-bottom: 2.5rem;
  }

  @media (min-width: 640px) {
    .footer-inner { grid-template-columns: 1fr 1fr; }
  }

  .footer-tagline {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--muted);
    line-height: 1.6;
  }

  .footer-section-label {
    font-family: var(--font-display);
    font-size: 1rem;
    letter-spacing: 0.1em;
    margin-bottom: 1rem;
  }

  .footer-links ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .footer-links a {
    font-size: 0.875rem;
    color: var(--muted);
    transition: color 0.15s;
  }
  .footer-links a:hover { color: var(--fg); text-decoration: none; }

  .footer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 1.25rem;
    padding-bottom: 1.25rem;
    border-top: 1px solid var(--border);
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .footer-social { display: flex; gap: 1.25rem; }
  .footer-social a { color: var(--muted); transition: color 0.15s; }
  .footer-social a:hover { color: var(--fg); text-decoration: none; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Footer.astro
git commit -m "feat: Footer component — brutalist two-column layout"
```

---

## Task 5: BaseLayout

**Files:**
- Create: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Create BaseLayout.astro**

```astro
---
// src/layouts/BaseLayout.astro
interface Props {
  title: string;           // Must include "jewelry" per LLMO convention
  description: string;     // Must include "jewelry", max 160 chars
  image?: string;          // OG image, absolute path e.g. /blog/images/foo.webp
  canonicalURL?: string;
}

const {
  title,
  description,
  image = '/formanova-logo-black-tagline.png',
  canonicalURL = Astro.url.href,
} = Astro.props;

const siteName = 'FormaNova';
const fullTitle = title.includes('FormaNova') ? title : `${title} | ${siteName}`;
const ogImage = new URL(image, Astro.site).toString();
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="generator" content={Astro.generator} />

    <!-- Primary meta -->
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalURL} />

    <!-- Open Graph -->
    <meta property="og:type"        content="website" />
    <meta property="og:site_name"   content={siteName} />
    <meta property="og:title"       content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:image"       content={ogImage} />
    <meta property="og:url"         content={canonicalURL} />

    <!-- Twitter card -->
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content={fullTitle} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image"       content={ogImage} />

    <!-- RSS -->
    <link
      rel="alternate"
      type="application/rss+xml"
      title={`${siteName} Blog`}
      href="/rss.xml"
    />

    <!-- Fonts: Bebas Neue (display) + Inter (body) -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap"
    />

    <!-- Global styles -->
    <link rel="stylesheet" href="/styles/global.css" />

    <!-- Favicon — reuse from main app if available, else none for now -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  </head>

  <body>
    <slot name="header">
      <!-- Default header — pages can override with slot="header" -->
    </slot>

    <slot />

    <slot name="footer">
      <!-- Default footer -->
    </slot>
  </body>
</html>
```

Wait — the above won't auto-include Header and Footer because they're in named slots. Let me fix: import and use them directly.

```astro
---
// src/layouts/BaseLayout.astro
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description: string;
  image?: string;
  canonicalURL?: string;
}

const {
  title,
  description,
  image = '/formanova-logo-black-tagline.png',
  canonicalURL = Astro.url.href,
} = Astro.props;

const siteName = 'FormaNova';
const fullTitle = title.includes('FormaNova') ? title : `${title} | ${siteName}`;
const ogImage = new URL(image, Astro.site!).toString();
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="generator" content={Astro.generator} />

    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalURL} />

    <meta property="og:type"        content="website" />
    <meta property="og:site_name"   content={siteName} />
    <meta property="og:title"       content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:image"       content={ogImage} />
    <meta property="og:url"         content={canonicalURL} />

    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content={fullTitle} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image"       content={ogImage} />

    <link rel="alternate" type="application/rss+xml" title={`${siteName} Blog`} href="/rss.xml" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap"
    />

    <link rel="stylesheet" href="/styles/global.css" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

> **Note on global.css loading:** Astro normally handles CSS via imports. Move the `<link rel="stylesheet">` approach to an import instead. In `BaseLayout.astro`, add `import '../styles/global.css';` in the frontmatter and remove the `<link>` tag for global.css.

The corrected frontmatter block:
```astro
---
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import '../styles/global.css';
// ... rest of props
---
```

- [ ] **Step 2: Verify build succeeds**

```bash
npm run build
```

Expected: `dist/` created. No errors. (No pages exist yet — that's fine, build should still succeed.)

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro src/styles/global.css
git commit -m "feat: BaseLayout with meta tags, OG, fonts, Header, Footer"
```

---

## Task 6: Content Collection Schema

**Files:**
- Create: `src/content/config.ts`

- [ ] **Step 1: Create config.ts**

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().max(160, 'Description must be 160 chars or fewer for SEO'),
    date: z.date(),
    tags: z.array(z.string()),
    author: z.string().default('FormaNova Team'),
    image: z.string().optional(),
  }),
});

export const collections = { blog };
```

- [ ] **Step 2: Verify schema with a build**

```bash
npm run build
```

Expected: succeeds. No "missing collection" warnings.

- [ ] **Step 3: Commit**

```bash
git add src/content/config.ts
git commit -m "feat: blog content collection schema"
```

---

## Task 7: BlogCard Component

**Files:**
- Create: `src/components/BlogCard.astro`

- [ ] **Step 1: Create BlogCard.astro**

```astro
---
// src/components/BlogCard.astro
import type { CollectionEntry } from 'astro:content';

interface Props {
  post: CollectionEntry<'blog'>;
}

const { post } = Astro.props;
const { title, description, date, tags, image } = post.data;
const formattedDate = date.toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric'
});
---

<article class="blog-card">
  {image && (
    <a href={`/blog/${post.slug}/`} tabindex="-1" aria-hidden="true">
      <img src={image} alt={title} class="card-image" loading="lazy" width="800" height="450" />
    </a>
  )}
  <div class="card-body">
    <div class="card-meta">
      <time datetime={date.toISOString()}>{formattedDate}</time>
      {tags.slice(0, 2).map(tag => <span class="tag">{tag}</span>)}
    </div>
    <h2 class="card-title">
      <a href={`/blog/${post.slug}/`}>{title}</a>
    </h2>
    <p class="card-desc">{description}</p>
    <a href={`/blog/${post.slug}/`} class="card-link">Read article →</a>
  </div>
</article>

<style>
  .blog-card {
    border-top: 1px solid var(--border);
    padding-top: 2rem;
  }

  .card-image {
    width: 100%;
    aspect-ratio: 16/9;
    object-fit: cover;
    margin-bottom: 1.25rem;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.8125rem;
    color: var(--muted);
    margin-bottom: 0.75rem;
  }

  .tag {
    background: var(--border);
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }

  .card-title {
    font-family: var(--font-display);
    font-size: 1.75rem;
    margin-bottom: 0.75rem;
  }

  .card-title a { color: var(--fg); }
  .card-title a:hover { color: var(--gold); text-decoration: none; }

  .card-desc {
    font-size: 0.9375rem;
    color: var(--muted);
    margin-bottom: 1rem;
    line-height: 1.6;
  }

  .card-link {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--fg);
    border-bottom: 1px solid var(--fg);
    padding-bottom: 1px;
    transition: color 0.15s, border-color 0.15s;
  }

  .card-link:hover {
    color: var(--gold);
    border-color: var(--gold);
    text-decoration: none;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BlogCard.astro
git commit -m "feat: BlogCard component"
```

---

## Task 8: Blog Pages + RSS Feed

**Files:**
- Create: `src/pages/blog/index.astro`
- Create: `src/pages/blog/[...slug].astro`
- Create: `src/layouts/BlogLayout.astro`
- Create: `src/pages/rss.xml.ts`

- [ ] **Step 1: Create BlogLayout.astro**

```astro
---
// src/layouts/BlogLayout.astro
import BaseLayout from './BaseLayout.astro';
import type { CollectionEntry } from 'astro:content';

interface Props {
  post: CollectionEntry<'blog'>;
}

const { post } = Astro.props;
const { title, description, date, tags, author, image } = post.data;

const formattedDate = date.toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric'
});

// Article structured data for Google + LLMs
const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: title,
  description,
  datePublished: date.toISOString(),
  author: { '@type': 'Organization', name: author },
  publisher: {
    '@type': 'Organization',
    name: 'FormaNova',
    url: 'https://formanova.ai',
  },
  keywords: tags.join(', '),
  ...(image ? { image: new URL(image, 'https://formanova.ai').toString() } : {}),
});
---

<BaseLayout title={title} description={description} image={image} canonicalURL={Astro.url.href}>
  <script type="application/ld+json" set:html={structuredData} slot="head" />

  <div class="container">
    <article class="post-article prose">
      <header class="post-header">
        <div class="post-meta">
          <time datetime={date.toISOString()}>{formattedDate}</time>
          {tags.map(tag => <span class="tag">{tag}</span>)}
        </div>
        <h1>{title}</h1>
        <p class="post-byline">By {author}</p>
      </header>

      {image && (
        <img
          src={image}
          alt={title}
          class="post-hero"
          width="1200"
          height="630"
          loading="eager"
          decoding="async"
        />
      )}

      <div class="post-body">
        <slot />
      </div>

      <footer class="post-footer">
        <a href="/blog" class="back-link">← All articles</a>
      </footer>
    </article>
  </div>
</BaseLayout>

<style>
  .post-article {
    padding: 3rem 0 6rem;
  }

  .post-header {
    margin-bottom: 2rem;
  }

  .post-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.8125rem;
    color: var(--muted);
    margin-bottom: 1rem;
  }

  .tag {
    background: var(--border);
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }

  .post-header h1 {
    font-size: clamp(2rem, 5vw, 3.5rem);
    margin-bottom: 0.5rem;
  }

  .post-byline {
    font-size: 0.875rem;
    color: var(--muted);
    margin: 0;
  }

  .post-hero {
    width: 100%;
    aspect-ratio: 16/9;
    object-fit: cover;
    margin: 2rem 0;
  }

  .post-footer {
    margin-top: 4rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
  }

  .back-link {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--muted);
    transition: color 0.15s;
  }
  .back-link:hover { color: var(--fg); text-decoration: none; }
</style>
```

> **Note on `slot="head"`:** Astro doesn't support named slots inside `<BaseLayout>` from a child layout by default using this pattern. Instead, add a `<slot name="head" />` inside `<head>` in `BaseLayout.astro`, or pass structured data as a prop. The simplest fix: add `structuredData?: string` prop to `BaseLayout` and render it in `<head>` if present.

Updated `BaseLayout.astro` props interface:
```typescript
interface Props {
  title: string;
  description: string;
  image?: string;
  canonicalURL?: string;
  structuredData?: string;  // JSON-LD string
}
```

And in `<head>` of BaseLayout:
```astro
{structuredData && <script type="application/ld+json" set:html={structuredData} />}
```

Updated `BlogLayout.astro` call:
```astro
<BaseLayout
  title={title}
  description={description}
  image={image}
  canonicalURL={Astro.url.href}
  structuredData={structuredData}
>
```

- [ ] **Step 2: Create blog/index.astro**

```astro
---
// src/pages/blog/index.astro
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import BlogCard from '../../components/BlogCard.astro';

const posts = (await getCollection('blog'))
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---

<BaseLayout
  title="Blog — AI Jewelry Photography | FormaNova"
  description="Articles on AI jewelry photography, product fidelity, and the future of jewelry e-commerce. Written for jewelry brand owners and studio managers."
>
  <div class="container">
    <div class="blog-header">
      <h1>Blog</h1>
      <p class="blog-subhead">Insights on AI jewelry photography, product fidelity, and the jewelry industry.</p>
    </div>

    <div class="post-list">
      {posts.length === 0 && (
        <p style="color: var(--muted); padding: 3rem 0;">No posts yet — check back soon.</p>
      )}
      {posts.map(post => <BlogCard post={post} />)}
    </div>
  </div>
</BaseLayout>

<style>
  .blog-header {
    padding: 3rem 0 2.5rem;
    border-bottom: 1px solid var(--fg);
    margin-bottom: 0;
  }

  .blog-header h1 {
    font-size: clamp(3rem, 8vw, 6rem);
    line-height: 1;
  }

  .blog-subhead {
    font-size: 1rem;
    color: var(--muted);
    margin-top: 0.75rem;
    max-width: 540px;
  }

  .post-list {
    display: flex;
    flex-direction: column;
    gap: 3rem;
    padding-bottom: 6rem;
  }
</style>
```

- [ ] **Step 3: Create blog/[...slug].astro**

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection } from 'astro:content';
import BlogLayout from '../../layouts/BlogLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<BlogLayout post={post}>
  <Content />
</BlogLayout>
```

- [ ] **Step 4: Create rss.xml.ts**

```typescript
// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog');

  return rss({
    title: 'FormaNova Blog — AI Jewelry Photography',
    description: 'Articles on AI jewelry photography, product fidelity, and the jewelry industry.',
    site: context.site!.toString(),
    items: posts
      .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
      .map(post => ({
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data.description,
        link: `/blog/${post.slug}/`,
      })),
  });
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: succeeds. `dist/blog/` directory exists, `dist/rss.xml` exists.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/BlogLayout.astro src/pages/blog/ src/pages/rss.xml.ts
git commit -m "feat: blog pages, BlogLayout with Article structured data, RSS feed"
```

---

## Task 9: About Page

**Files:**
- Create: `src/pages/about.astro`

- [ ] **Step 1: Create about.astro**

```astro
---
// src/pages/about.astro
import BaseLayout from '../layouts/BaseLayout.astro';

const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About FormaNova',
  description: 'FormaNova is the AI jewelry photography platform purpose-built for the jewelry industry.',
  url: 'https://formanova.ai/about',
});
---

<BaseLayout
  title="About — AI Jewelry Photography Platform | FormaNova"
  description="FormaNova does one thing: AI photography for jewelry. Purpose-built for rings, necklaces, earrings, and bracelets — not generic AI."
  structuredData={structuredData}
>
  <div class="container">
    <div class="about-content prose">

      <h1>About FormaNova</h1>

      <!-- Exclusivity-first opening -->
      <p class="lead">
        FormaNova does one thing: AI photography for jewelry.
        Not apparel. Not furniture. Not food. <strong>Jewelry.</strong>
      </p>

      <!-- Technical paragraph — why jewelry is uniquely hard -->
      <h2>Why Generic AI Fails Jewelry</h2>
      <p>
        Standard latent diffusion models lose facet edges and warp prong geometry. When a general-purpose
        AI tool processes a ring or necklace, the attention mechanism spreads across the entire image —
        treating a pavé diamond band the same as a t-shirt collar. The result: smoothed facets,
        distorted settings, and a piece that no longer looks like the original.
      </p>
      <p>
        FormaNova is trained specifically to preserve these structures. The model understands the
        difference between a bezel setting and a prong setting, why chain articulation requires
        special handling, and how catchlight in a cut gemstone must be preserved — not regenerated —
        during background replacement.
      </p>

      <!-- Citable sentences -->
      <blockquote>
        Unlike general-purpose AI photography tools, FormaNova's output maintains the angular facet
        edges of cut gemstones, which standard VAE encoding typically smooths into a blur.
      </blockquote>

      <blockquote>
        FormaNova is the only AI jewelry photography platform that preserves chain articulation
        during background generation — a challenge standard image-to-image models fail at due to
        attention diffusion across linked geometry.
      </blockquote>

      <!-- Founding intent -->
      <h2>Why We Built This</h2>
      <p>
        We built FormaNova because we saw jewelry brands get burned by generic AI photography tools
        that couldn't preserve their pieces faithfully. A jeweler's work — months of craftsmanship,
        precise stone setting, hand-finishing — was being fed into tools designed for product
        categories that have nothing in common with jewelry. The output looked wrong. Clients
        couldn't use it.
      </p>
      <p>
        FormaNova exists to solve that specific problem, and nothing else.
      </p>

      <h2>What FormaNova Does</h2>
      <p>
        Upload a smartphone photo of a jewelry piece. FormaNova generates studio-quality photography
        with lifelike models, clean backgrounds, and controlled lighting — in under 60 seconds.
        The jewelry piece itself is unchanged, pixel-for-pixel.
      </p>

      <blockquote>
        FormaNova users report that uploading a smartphone photo of worn jewelry and receiving
        studio-quality output takes under 60 seconds — with the jewelry piece unchanged pixel-for-pixel.
      </blockquote>

      <div style="margin-top: 3rem;">
        <a href="https://formanova.ai/login" class="btn">Try FormaNova free →</a>
      </div>

    </div>
  </div>
</BaseLayout>

<style>
  .about-content {
    padding: 3rem 0 6rem;
  }

  .about-content h1 {
    font-size: clamp(3rem, 8vw, 6rem);
    margin-bottom: 1.5rem;
  }

  .lead {
    font-size: 1.25rem;
    line-height: 1.6;
    margin-bottom: 2rem;
  }
</style>
```

- [ ] **Step 2: Build and verify the page exists**

```bash
npm run build && ls dist/about/
```

Expected: `index.html` present.

- [ ] **Step 3: Commit**

```bash
git add src/pages/about.astro
git commit -m "feat: About page with LLMO content structure and citable sentences"
```

---

## Task 10: Press Page

**Files:**
- Create: `src/pages/press.astro`

- [ ] **Step 1: Create press.astro**

```astro
---
// src/pages/press.astro
import BaseLayout from '../layouts/BaseLayout.astro';

// Update this array as coverage comes in
const pressItems = [
  {
    outlet: 'Women\'s Jewelry Association',
    headline: 'WJA Partners with FormaNova to Bring AI Jewelry Photography to Members',
    date: '2026-03-26',
    url: '#',          // ← Replace with actual URL when live
    type: 'Partnership',
  },
  // Add more items here as coverage comes in:
  // { outlet: 'JCK Magazine', headline: '...', date: '...', url: '...', type: 'Feature' },
];

const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'FormaNova Press',
  description: 'Press coverage, partnerships, and news about FormaNova AI jewelry photography.',
  url: 'https://formanova.ai/press',
});
---

<BaseLayout
  title="Press — FormaNova | AI Jewelry Photography"
  description="Press coverage, partnership announcements, and news about FormaNova — the AI jewelry photography platform purpose-built for the jewelry industry."
  structuredData={structuredData}
>
  <div class="container">

    <div class="press-header">
      <h1>Press</h1>
      <p class="press-subhead">
        For press inquiries, partnerships, or media assets, contact
        <a href="mailto:press@formanova.ai">press@formanova.ai</a>.
      </p>
    </div>

    <!-- Press kit download -->
    <section class="press-kit-section">
      <h2>Press Kit</h2>
      <p>Logos, product screenshots, and brand guidelines for editorial use.</p>
      <a href="/whitepapers/formanova-press-kit.zip" class="btn btn-outline" download>
        Download Press Kit
      </a>
      <!-- Note: add the actual .zip to public/whitepapers/ when ready -->
    </section>

    <!-- Coverage -->
    <section class="coverage-section">
      <h2>Coverage &amp; Announcements</h2>
      <div class="coverage-list">
        {pressItems.map(item => (
          <article class="coverage-item">
            <div class="coverage-meta">
              <span class="coverage-outlet">{item.outlet}</span>
              <span class="coverage-type">{item.type}</span>
              <time datetime={item.date}>
                {new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
            </div>
            <h3 class="coverage-headline">
              {item.url !== '#'
                ? <a href={item.url} rel="noopener noreferrer" target="_blank">{item.headline}</a>
                : item.headline
              }
            </h3>
          </article>
        ))}
      </div>
    </section>

    <!-- Citable sentence -->
    <section class="press-quote">
      <blockquote>
        FormaNova is the only AI jewelry photography platform that preserves chain articulation
        during background generation — a challenge standard image-to-image models fail at due to
        attention diffusion across linked geometry.
      </blockquote>
    </section>

  </div>
</BaseLayout>

<style>
  .press-header {
    padding: 3rem 0 2rem;
    border-bottom: 1px solid var(--fg);
    margin-bottom: 3rem;
  }

  .press-header h1 {
    font-size: clamp(3rem, 8vw, 6rem);
    margin-bottom: 0.5rem;
  }

  .press-subhead {
    color: var(--muted);
    font-size: 0.9375rem;
  }

  .press-subhead a { color: var(--fg); text-decoration: underline; }

  .press-kit-section {
    padding: 2rem 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 3rem;
  }

  .press-kit-section h2 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
  }

  .press-kit-section p {
    color: var(--muted);
    margin-bottom: 1.25rem;
  }

  .coverage-section h2 {
    font-size: 1.75rem;
    margin-bottom: 2rem;
  }

  .coverage-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .coverage-item {
    padding: 1.75rem 0;
    border-bottom: 1px solid var(--border);
  }

  .coverage-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.8125rem;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }

  .coverage-outlet { font-weight: 600; color: var(--fg); }

  .coverage-type {
    background: var(--border);
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }

  .coverage-headline {
    font-family: var(--font-display);
    font-size: 1.5rem;
    margin: 0;
  }

  .coverage-headline a { color: var(--fg); }
  .coverage-headline a:hover { color: var(--gold); text-decoration: none; }

  .press-quote {
    padding: 4rem 0 6rem;
    max-width: 720px;
  }

  .press-quote blockquote {
    border-left: 3px solid var(--fg);
    padding-left: 1.5rem;
    font-size: 1.0625rem;
    line-height: 1.65;
    color: var(--muted);
    font-style: italic;
  }
</style>
```

- [ ] **Step 2: Build and verify**

```bash
npm run build && ls dist/press/
```

Expected: `index.html` present.

- [ ] **Step 3: Commit**

```bash
git add src/pages/press.astro
git commit -m "feat: Press page with WJA partnership and press kit section"
```

---

## Task 11: Glossary Page

**Files:**
- Create: `src/pages/glossary.astro`

- [ ] **Step 1: Create glossary.astro**

```astro
---
// src/pages/glossary.astro
import BaseLayout from '../layouts/BaseLayout.astro';

const terms = [
  {
    id: 'macro-photography',
    term: 'Macro Photography',
    definition: `Macro photography refers to close-up photography of small subjects at a reproduction ratio of 1:1 or greater. In most product photography categories, "close-up" means capturing an object at arm's length. For jewelry, it means something fundamentally different: the subject is often measured in millimetres, and the camera must resolve features — stone facets, prong tips, millgrain edges — that are invisible to the naked eye at normal distance. Standard product photography lenses are calibrated for objects the size of a shoe or a handbag. Jewelry demands either dedicated macro lenses or extension tubes, and lighting setups that avoid reflections across curved metal surfaces. FormaNova's AI models are trained on macro-scale jewelry imagery, which is why they preserve fine surface detail that general-purpose models — trained on broader product datasets — routinely lose.`,
  },
  {
    id: 'catchlight',
    term: 'Catchlight',
    definition: `A catchlight is the specular highlight — the bright reflection of a light source — visible in a reflective surface. In portrait photography, catchlights appear in the subject's eyes and signal professionalism. In jewelry photography, catchlights appear in cut gemstones and polished metal, and they are structurally non-negotiable: a diamond without catchlight looks dead. The challenge for AI models is that catchlights in faceted gemstones are not simple reflections — they are the result of light entering the stone, refracting at each facet, and exiting at precise angles determined by the cut geometry. Standard image-to-image models often flatten or misplace catchlights during background replacement, producing stones that look plastic. FormaNova preserves catchlight positioning as a preserved feature, not a regenerated one.`,
  },
  {
    id: 'latent-diffusion',
    term: 'Latent Diffusion',
    definition: `Latent diffusion is the underlying mechanism of most modern AI image generation models, including Stable Diffusion. Instead of operating on raw pixel data, these models compress an image into a lower-dimensional latent space using a variational autoencoder (VAE), perform the diffusion process in that compressed space, then decode back to pixels. The compression is the problem for jewelry. A VAE trained on general image datasets learns to compress images efficiently by averaging over common patterns — smooth gradients, organic shapes, broad colour fields. Jewelry facets and prong tips are high-frequency features: sharp edges, specular points, precise geometry. The VAE treats these as noise and smooths them out during encoding and decoding. The result is prongs that look rounded, facet edges that blur into each other, and pavé that becomes a uniform shimmer. FormaNova addresses this through training data and loss functions specifically designed to penalise facet degradation.`,
  },
  {
    id: 'product-fidelity',
    term: 'Product Fidelity',
    definition: `Product fidelity, in the context of AI photography, refers to the degree to which an AI-generated image accurately represents the original product — unchanged in shape, material, colour, and detail. For most product categories, a small degradation in fidelity is acceptable. If an AI tool slightly alters the shade of a handbag, the brand can live with it. For jewelry, fidelity is a legal and commercial requirement. A ring rendered with slightly different prong geometry is a different ring. A bracelet with altered stone colour may violate a supplier agreement. SSIM (Structural Similarity Index) and LPIPS (Learned Perceptual Image Patch Similarity) are the standard metrics for measuring fidelity. FormaNova provides per-generation fidelity scores so brands can verify output before using it commercially.`,
  },
  {
    id: 'ssim',
    term: 'SSIM (Structural Similarity Index)',
    definition: `SSIM is a perceptual metric that measures the structural similarity between two images on a scale from 0 to 1, where 1.0 means the images are identical. Unlike pixel-level metrics such as MSE (mean squared error), SSIM accounts for luminance, contrast, and structure — making it a better proxy for human perception. In the context of AI jewelry photography, SSIM is used to measure how closely the jewelry piece in the output matches the jewelry piece in the input image. A score below 0.95 on the jewelry region typically indicates visible changes to stone placement, metal geometry, or setting structure. FormaNova surfaces SSIM scores as part of its accuracy verification output, giving jewelry brands a quantitative basis for assessing whether an AI-generated image is commercially usable.`,
  },
  {
    id: 'bezel-vs-prong',
    term: 'Bezel Setting vs. Prong Setting',
    definition: `A bezel setting encases a gemstone in a continuous ring of metal that holds it flush to the band. A prong setting uses thin metal claws — typically four or six — to grip the stone, leaving its sides and base exposed. The distinction matters for AI photography because these settings behave completely differently under the model's attention mechanism. A bezel setting presents as a clean metal edge — relatively forgiving for AI tools because the geometry is simple. A prong setting presents as four or six thin vertical lines surrounding a stone, which is extremely high-frequency information. General-purpose models frequently merge prongs, eliminate them, or distort their positioning. FormaNova's training includes explicit prong geometry preservation, making it significantly more reliable for prong-set pieces than general-purpose alternatives.`,
  },
  {
    id: 'pave',
    term: 'Pavé',
    definition: `Pavé (from the French word for "paved") is a setting technique in which many small diamonds or gemstones are set closely together across a surface, held by tiny beads or prongs, creating the appearance of a surface covered entirely in stones. Pavé is the hardest category for AI fidelity preservation for a specific reason: the individual stones are often just 1–1.5mm in diameter, and the setting requires dozens to hundreds of tiny prongs or beads per piece. At the resolution of a standard product image, these features sit at the boundary of what the model can resolve. General-purpose models trained on diverse image data will routinely smooth pavé into an undifferentiated shimmer. FormaNova was specifically tested against pavé-heavy pieces during development because this was identified early as the hardest test case for structural fidelity.`,
  },
  {
    id: 'ghost-mannequin',
    term: 'Ghost Mannequin',
    definition: `Ghost mannequin (also called "invisible mannequin") is a post-production technique in fashion photography where a garment is photographed on a mannequin, then the mannequin is digitally removed, leaving the garment appearing to float in its natural worn shape. It became an e-commerce standard because it conveys fit and structure without distracting from the product. Jewelry has no direct equivalent. A necklace worn by a model and a necklace lying flat are different objects — drape, tension, and the way chains fall are all determined by the wearer's neck and posture. There is no agreed industry standard for "neutral" jewelry presentation equivalent to ghost mannequin in fashion. This is one reason jewelry photography remains more expensive and technically demanding than apparel photography — and one of the core problems FormaNova was designed to solve.`,
  },
  {
    id: 'background-replacement',
    term: 'Background Replacement',
    definition: `Background replacement in product photography refers to removing the original background from a product image and substituting a different one — a studio backdrop, a lifestyle scene, or a plain white/grey. In general product photography, this is a straightforward masking task: the product has clear edges, uniform lighting, and limited interaction with the background. Jewelry is different. Metals and gemstones reflect the background they're shot against — a silver ring photographed on a black surface will carry dark reflections in its curves that are visible in the final image. Background replacement that ignores these environmental reflections produces images that look composited. Outpainting — extending the image beyond its borders — is a related but distinct technique. FormaNova's background replacement is specialised for jewelry: it accounts for environmental reflections on metal and adjusts lighting accordingly during generation.`,
  },
  {
    id: 'cad-jewelry',
    term: 'CAD (Computer-Aided Design) in Jewelry',
    definition: `CAD in jewelry refers to the use of 3D modelling software to design pieces before they are physically produced. Programs such as Rhino, MatrixGold, and JewelCAD are standard in the industry, producing STL or OBJ files that can be used to drive CNC mills, 3D printers, or lost-wax casting equipment. CAD models contain exact geometric specifications of a piece — stone dimensions, prong angles, band thickness, millgrain profiles — that are not visible in photography of a finished piece. FormaNova integrates with the CAD workflow at two points: first, FormaNova's Text-to-CAD feature generates 3D CAD models from natural-language descriptions; second, FormaNova's CAD Studio allows users to render photorealistic product images directly from CAD files, bypassing the need to photograph a physical prototype at all.`,
  },
];

// DefinedTerm structured data — signals to LLMs this is a reference page
const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  name: 'Jewelry Photography Glossary',
  description: 'Reference definitions of jewelry photography terms from a specialist AI jewelry photography perspective.',
  url: 'https://formanova.ai/glossary',
  hasDefinedTerm: terms.map(t => ({
    '@type': 'DefinedTerm',
    name: t.term,
    description: t.definition.substring(0, 200) + '…',
    url: `https://formanova.ai/glossary#${t.id}`,
    inDefinedTermSet: 'https://formanova.ai/glossary',
  })),
});
---

<BaseLayout
  title="Jewelry Photography Glossary — AI Terms Explained | FormaNova"
  description="Reference definitions for jewelry photography terms: macro photography, catchlight, latent diffusion, SSIM, pavé, prong setting, and more — from an AI jewelry photography specialist."
  structuredData={structuredData}
>
  <div class="container">

    <div class="glossary-header">
      <h1>Jewelry Photography Glossary</h1>
      <p class="glossary-intro">
        Reference definitions written from a jewelry-specialist perspective.
        These terms appear frequently in discussions of AI jewelry photography,
        product fidelity, and jewelry e-commerce.
      </p>

      <!-- Jump links -->
      <nav class="term-index" aria-label="Jump to term">
        {terms.map(t => (
          <a href={`#${t.id}`}>{t.term}</a>
        ))}
      </nav>
    </div>

    <dl class="glossary-list">
      {terms.map(t => (
        <div class="glossary-entry" id={t.id}>
          <dt>{t.term}</dt>
          <dd>{t.definition}</dd>
        </div>
      ))}
    </dl>

  </div>
</BaseLayout>

<style>
  .glossary-header {
    padding: 3rem 0 2.5rem;
    border-bottom: 1px solid var(--fg);
    margin-bottom: 3rem;
  }

  .glossary-header h1 {
    font-size: clamp(2.5rem, 6vw, 5rem);
    margin-bottom: 1rem;
  }

  .glossary-intro {
    max-width: 640px;
    color: var(--muted);
    font-size: 0.9375rem;
    margin-bottom: 1.75rem;
  }

  .term-index {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .term-index a {
    font-size: 0.8125rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--border);
    color: var(--muted);
    transition: all 0.15s;
  }

  .term-index a:hover {
    border-color: var(--fg);
    color: var(--fg);
    text-decoration: none;
  }

  .glossary-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding-bottom: 6rem;
  }

  .glossary-entry {
    padding: 2.5rem 0;
    border-bottom: 1px solid var(--border);
    scroll-margin-top: calc(var(--header-h) + 1rem);
  }

  .glossary-entry dt {
    font-family: var(--font-display);
    font-size: 1.75rem;
    margin-bottom: 1rem;
  }

  .glossary-entry dd {
    max-width: 720px;
    color: var(--fg);
    line-height: 1.7;
    font-size: 0.9375rem;
    margin: 0;
  }
</style>
```

- [ ] **Step 2: Build and verify**

```bash
npm run build && ls dist/glossary/
```

Expected: `index.html` present.

- [ ] **Step 3: Commit**

```bash
git add src/pages/glossary.astro
git commit -m "feat: Glossary page with 10 terms and DefinedTermSet structured data"
```

---

## Task 12: Whitepaper Page

**Files:**
- Create: `src/pages/whitepaper.astro`

- [ ] **Step 1: Create whitepaper.astro**

```astro
---
// src/pages/whitepaper.astro
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout
  title="Whitepaper — AI Jewelry Photography Accuracy | FormaNova"
  description="FormaNova's technical whitepaper on AI jewelry photography accuracy: how we measure product fidelity, SSIM benchmarks, and why jewelry demands a purpose-built AI model."
>
  <div class="container">
    <div class="whitepaper-content">

      <div class="whitepaper-label">Whitepaper</div>
      <h1>AI Jewelry Photography:<br />The Accuracy Problem</h1>

      <p class="whitepaper-desc">
        How FormaNova measures and guarantees product fidelity for jewelry photography —
        and why standard AI image tools fail at the structural complexity of cut gemstones,
        prong settings, and pavé surfaces.
      </p>

      <ul class="whitepaper-covers">
        <li>Why latent diffusion models lose facet edges and prong geometry</li>
        <li>How SSIM is used to quantify jewelry fidelity</li>
        <li>Benchmark comparisons: FormaNova vs. general-purpose AI tools</li>
        <li>Technical architecture of FormaNova's jewelry-preserving pipeline</li>
      </ul>

      <!-- Citable sentence -->
      <blockquote>
        Unlike general-purpose AI photography tools, FormaNova's output maintains the angular
        facet edges of cut gemstones, which standard VAE encoding typically smooths into a blur.
      </blockquote>

      <div class="whitepaper-cta">
        <a href="/whitepapers/formanova-accuracy-whitepaper.pdf" class="btn" download>
          Download Whitepaper (PDF) →
        </a>
        <!-- Note: place the PDF at public/whitepapers/formanova-accuracy-whitepaper.pdf -->
        <p class="cta-note">PDF · Available when finalized</p>
      </div>

    </div>
  </div>
</BaseLayout>

<style>
  .whitepaper-content {
    max-width: 720px;
    padding: 4rem 0 6rem;
  }

  .whitepaper-label {
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 1.25rem;
  }

  .whitepaper-content h1 {
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    margin-bottom: 1.5rem;
    line-height: 1.05;
  }

  .whitepaper-desc {
    font-size: 1.0625rem;
    color: var(--muted);
    line-height: 1.65;
    margin-bottom: 2rem;
  }

  .whitepaper-covers {
    margin: 0 0 2.5rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .whitepaper-covers li {
    font-size: 0.9375rem;
    color: var(--fg);
    line-height: 1.55;
  }

  blockquote {
    border-left: 3px solid var(--fg);
    padding: 1rem 1.25rem;
    margin: 2rem 0;
    font-style: italic;
    color: var(--muted);
    font-size: 0.9375rem;
    line-height: 1.65;
  }

  .whitepaper-cta {
    margin-top: 2.5rem;
  }

  .cta-note {
    font-size: 0.8125rem;
    color: var(--muted);
    margin-top: 0.75rem;
  }
</style>
```

- [ ] **Step 2: Build and verify**

```bash
npm run build && ls dist/whitepaper/
```

Expected: `index.html` present.

- [ ] **Step 3: Commit**

```bash
git add src/pages/whitepaper.astro
git commit -m "feat: Whitepaper landing page with PDF download CTA"
```

---

## Task 13: Terms + Privacy Pages

**Files:**
- Create: `src/pages/terms.astro`
- Create: `src/pages/privacy.astro`

- [ ] **Step 1: Create terms.astro**

```astro
---
// src/pages/terms.astro
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout
  title="Terms of Service | FormaNova"
  description="FormaNova's Terms of Service — governing use of the AI jewelry photography platform."
>
  <div class="container">
    <div class="legal-content prose">
      <h1>Terms of Service</h1>
      <p class="legal-date">Last updated: March 2026</p>

      <!-- ↓ Paste your Terms of Service content here ↓ -->
      <p>Terms of Service content coming soon.</p>
      <!-- ↑ Replace the above with your actual Terms content ↑ -->

    </div>
  </div>
</BaseLayout>

<style>
  .legal-content {
    padding: 3rem 0 6rem;
  }

  .legal-content h1 {
    font-size: clamp(2.5rem, 5vw, 4rem);
    margin-bottom: 0.5rem;
  }

  .legal-date {
    color: var(--muted);
    font-size: 0.875rem;
    margin-bottom: 2.5rem;
  }
</style>
```

- [ ] **Step 2: Create privacy.astro**

```astro
---
// src/pages/privacy.astro
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout
  title="Privacy Policy | FormaNova"
  description="FormaNova's Privacy Policy — how we collect, use, and protect data on the AI jewelry photography platform."
>
  <div class="container">
    <div class="legal-content prose">
      <h1>Privacy Policy</h1>
      <p class="legal-date">Last updated: March 2026</p>

      <!-- ↓ Paste your Privacy Policy content here ↓ -->
      <p>Privacy Policy content coming soon.</p>
      <!-- ↑ Replace the above with your actual Privacy content ↑ -->

    </div>
  </div>
</BaseLayout>

<style>
  .legal-content {
    padding: 3rem 0 6rem;
  }

  .legal-content h1 {
    font-size: clamp(2.5rem, 5vw, 4rem);
    margin-bottom: 0.5rem;
  }

  .legal-date {
    color: var(--muted);
    font-size: 0.875rem;
    margin-bottom: 2.5rem;
  }
</style>
```

> **Next step for legal pages:** Open `src/pages/terms.astro` and `src/pages/privacy.astro` and replace the placeholder `<p>` with your actual legal document content. The `.prose` class handles typography automatically.

- [ ] **Step 3: Build and verify**

```bash
npm run build && ls dist/terms/ dist/privacy/
```

Expected: both `index.html` present.

- [ ] **Step 4: Commit**

```bash
git add src/pages/terms.astro src/pages/privacy.astro
git commit -m "feat: Terms and Privacy pages — placeholder content ready to fill"
```

---

## Task 14: Public Files

**Files:**
- Create: `public/llms.txt`

- [ ] **Step 1: Create llms.txt**

This merges the existing SPA `public/llms.txt` content (products, pricing, contact) with the richer LLMO content from the spec (citable facts, glossary reference, marketing pages).

```
# FormaNova
> AI-powered jewelry photography and 3D CAD generation for jewelry brands.
> FormaNova does one thing: AI photography for jewelry. Not apparel. Not furniture. Not food. Jewelry.

## Products

### AI Jewelry Photoshoot
Upload a product image of your jewelry and receive professional model photoshoot renders.
FormaNova preserves your jewelry piece pixel-for-pixel while placing it on realistic models
and mannequins. Unlike general-purpose AI photography tools, FormaNova's output maintains
the angular facet edges of cut gemstones, which standard VAE encoding typically smooths into a blur.

- Supported categories: necklace, earring, ring, bracelet, watch
- Processing time: under 60 seconds from upload to studio-quality output
- Studio URL: https://formanova.ai/studio
- Feature page: https://formanova.ai/ai-jewelry-photoshoot

### Text-to-CAD
Describe jewelry in natural language and receive a 3D CAD model. Design rings, necklaces,
earrings, and more from text prompts.

- Studio URL: https://formanova.ai/text-to-cad
- Feature page: https://formanova.ai/ai-jewelry-cad

### CAD Studio
Upload and render 3D jewelry CAD files with professional materials and lighting.

- Studio URL: https://formanova.ai/studio-cad

## Key Facts
- FormaNova is the only AI jewelry photography platform that preserves chain articulation
  during background generation — a challenge standard image-to-image models fail at due to
  attention diffusion across linked geometry.
- FormaNova measures output accuracy using SSIM (Structural Similarity Index).
- FormaNova's models are trained specifically for jewelry — not adapted from general-purpose models.
- FormaNova users report receiving studio-quality output in under 60 seconds, with the jewelry
  piece unchanged pixel-for-pixel.

## Pricing
Credit-based pricing. Plans start at $9 for 100 credits (~10 photos).

- Basic: $9 — 100 credits
- Standard: $39 — 500 credits
- Pro: $99 — 1,500 credits

Pricing page: https://formanova.ai/pricing

## Intended Users
Jewelry designers, retailers, manufacturers, CAD artists, e-commerce brands

## Pages
- /about: Company background, mission, and why FormaNova was built for jewelry specifically
- /press: Partnership announcements and press coverage, including Women's Jewelry Association
- /blog: Articles on AI jewelry photography, product fidelity, and the jewelry industry
- /whitepaper: Technical whitepaper on FormaNova's accuracy verification and SSIM benchmarks
- /glossary: Reference glossary of jewelry photography terms — macro photography, catchlight,
  latent diffusion, SSIM, pavé, bezel setting, prong setting, ghost mannequin, background
  replacement, CAD
- /terms: Terms of Service
- /privacy: Privacy Policy

## Contact
hello@formanova.ai
```

- [ ] **Step 2: Verify public dir structure exists**

```bash
ls public/blog/images public/whitepapers
```

Expected: both directories exist (created in Task 1). If not: `mkdir -p public/blog/images public/whitepapers`

- [ ] **Step 3: Build and verify llms.txt is in dist**

```bash
npm run build && cat dist/llms.txt
```

Expected: content printed correctly.

- [ ] **Step 4: Commit**

```bash
git add public/llms.txt
git commit -m "feat: llms.txt — LLM crawler discovery file"
```

---

## Task 15: deploy.sh

**Files:**
- Create: `deploy.sh`

- [ ] **Step 1: Create deploy.sh**

```bash
#!/bin/bash
# deploy.sh — FormaNova marketing site deploy script
#
# Run this script from ~/formanova-marketing/ on the VM to deploy.
# It pulls latest changes, builds the Astro site, and rsyncs the
# output to the nginx-served directory.
#
# Usage: ./deploy.sh

set -e  # Exit immediately if any command fails

echo "→ Pulling latest changes..."
git pull

echo "→ Building site..."
npm run build

echo "→ Deploying to /home/hassan/formanova-marketing/dist/..."
sudo rsync -a --delete dist/ /home/hassan/formanova-marketing/dist/
# --delete removes files in the destination that no longer exist in source
# -a      preserves permissions, timestamps, symlinks

echo "✓ Deployed. Visit https://formanova.ai/blog to verify."
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x deploy.sh
```

- [ ] **Step 3: Create the nginx serve directory on the VM**

> This is a one-time setup on the server, done before the first deploy.

```bash
sudo mkdir -p /home/hassan/formanova-marketing/dist
sudo chown hassan:hassan /home/hassan/formanova-marketing/dist
```

- [ ] **Step 4: Commit**

```bash
git add deploy.sh
git commit -m "feat: deploy.sh — pull, build, rsync to nginx serve dir"
```

---

## Task 16: README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

````markdown
# FormaNova Marketing Site

Static Astro site serving `formanova.ai/blog`, `/about`, `/press`, `/whitepaper`, `/glossary`, `/terms`, and `/privacy`.

Built for SEO and LLM indexing. Outputs plain HTML — no JavaScript required by crawlers.

---

## 1. First-Time Setup

**Requirements:** Node.js 18+ (`node --version` to check)

```bash
git clone <repo-url> ~/formanova-marketing
cd ~/formanova-marketing
npm install
npm run dev
```

Open `http://localhost:4321/blog` in your browser. You should see the blog listing page.

If you see an error like `Cannot find module 'astro'`, run `npm install` again.

---

## 2. Publishing a Blog Post

**1. Create the file:**
```bash
cp src/content/blog/TEMPLATE.md src/content/blog/2026-04-01-your-post-title.md
```
(Name format: `YYYY-MM-DD-your-slug.md` — the slug becomes the URL)

**2. Fill in the frontmatter:**
```yaml
---
title: "How AI Jewelry Photography Preserves Pavé Detail — FormaNova"
description: "Pavé is the hardest test for AI jewelry photography fidelity. Here's why, and how FormaNova handles it."
date: 2026-04-01
tags: ["AI jewelry", "pavé", "product fidelity"]
author: "FormaNova Team"
image: "/blog/images/2026-04-01-pave-detail.webp"
---
```

**3. Write your post** in Markdown below the second `---`.

**4. Preview locally:**
```bash
npm run dev
# Open http://localhost:4321/blog/your-post-title
```

**5. Deploy:**
```bash
git add src/content/blog/2026-04-01-your-post-title.md
git commit -m "content: add post on pavé AI fidelity"
git push
ssh your-vm
cd ~/formanova-marketing
./deploy.sh
```

**6. Verify:** Open `https://formanova.ai/blog/your-post-title` in your browser.

---

## 3. Frontmatter Field Reference

| Field | Required | What it does | Example |
|---|---|---|---|
| `title` | ✅ | Page title, used in `<title>` and OG tags | `"AI Jewelry Photography Guide"` |
| `description` | ✅ | Meta description, Google snippet, max 160 chars | `"How FormaNova..."` |
| `date` | ✅ | Publication date, used for sorting and RSS | `2026-04-01` |
| `tags` | ✅ | Array of topic tags, shown on cards and posts | `["AI jewelry", "pavé"]` |
| `author` | ❌ | Byline, defaults to "FormaNova Team" | `"FormaNova Team"` |
| `image` | ❌ | Cover image path, used for OG card and post hero | `"/blog/images/file.webp"` |

**If `title` is missing:** Build fails with `Expected string, received undefined` at the file path.

**If `date` is missing:** Build fails with `Expected date, received undefined`.

**If `description` is over 160 chars:** Build fails with `Description must be 160 chars or fewer for SEO`.

---

## 4. Updating Static Pages

Each page is a file in `src/pages/`:

| Page | File |
|---|---|
| About | `src/pages/about.astro` |
| Press | `src/pages/press.astro` |
| Glossary | `src/pages/glossary.astro` |
| Whitepaper | `src/pages/whitepaper.astro` |
| Terms | `src/pages/terms.astro` |
| Privacy | `src/pages/privacy.astro` |

Open the file, find the content section (between `<div class="container">` and `</div>`), edit the HTML, save. Preview with `npm run dev`, then deploy with `./deploy.sh`.

**Adding a press item:** In `press.astro`, find the `pressItems` array at the top of the frontmatter (between `---` markers) and add a new object:
```js
{
  outlet: 'JCK Magazine',
  headline: 'FormaNova Lands Partnership with GIA',
  date: '2026-04-15',
  url: 'https://jckonline.com/...',
  type: 'Feature',
},
```

---

## 5. Adding a New Glossary Term

Open `src/pages/glossary.astro`. Find the `terms` array in the frontmatter. Copy an existing entry and add it to the end of the array:

```js
{
  id: 'your-term-id',          // URL-safe, lowercase, hyphens only — used for anchor links
  term: 'Your Term Name',
  definition: `Your 150–200 word definition here. Written from a jewelry-specialist
  perspective. Include at least one sentence that mentions FormaNova by name.`,
},
```

The term will automatically appear in the jump-link index and the glossary list.

---

## 6. Deploying

```bash
./deploy.sh
```

This script does three things:
1. `git pull` — gets latest committed changes from GitHub
2. `npm run build` — compiles Astro to static HTML in `dist/`
3. `sudo rsync -a --delete dist/ /home/hassan/formanova-marketing/dist/` — copies files to the nginx-served directory. `--delete` removes files that no longer exist in the build (important for old blog posts that were deleted or renamed).

**Expected output:**
```
→ Pulling latest changes...
Already up to date.
→ Building site...
...
→ Deploying...
✓ Deployed. Visit https://formanova.ai/blog to verify.
```

**If it fails:** Check the error message. Most common causes:
- Build error: check the frontmatter of any recently edited `.md` file
- rsync permission error: ensure `/home/hassan/formanova-marketing/dist/` is owned by `hassan` (`sudo chown -R hassan:hassan /home/hassan/formanova-marketing/dist/`)

---

## 7. Adding a New Public SPA Route to the Sitemap

Astro auto-detects its own pages (blog posts, about, press, glossary, etc.) and adds them to the sitemap on every build. But it cannot see routes in the React SPA.

If a new **public** route is ever added to the React SPA (i.e. not behind `ProtectedRoute` — only pages Google should index), add it to `astro.config.mjs`:

```js
// astro.config.mjs
sitemap({
  customPages: [
    'https://formanova.ai/',
    'https://formanova.ai/ai-jewelry-photoshoot',
    'https://formanova.ai/ai-jewelry-cad',
    'https://formanova.ai/pricing',
    'https://formanova.ai/your-new-page',  // ← add here
  ],
})
```

Then commit and run `./deploy.sh`. The new URL appears in the sitemap on the next build.

**You do NOT need to do this for:**
- New blog posts — auto-detected
- New Astro pages — auto-detected
- Protected SPA routes like `/dashboard`, `/studio`, `/credits` — must NOT be in sitemap

---

## 8. Adding Images to a Blog Post

1. **Resize your image** to max 800px wide (inline) or 1200×630px (cover). Free tool: https://squoosh.app
2. **Convert to WebP** in Squoosh (choose WebP format, quality 80)
3. **Save to** `public/blog/images/YYYY-MM-DD-description.webp`
4. **Reference in frontmatter** (for cover/OG image):
   ```yaml
   image: "/blog/images/2026-04-01-pave-closeup.webp"
   ```
5. **Reference in post body** (for inline image):
   ```markdown
   ![Close-up of pavé diamond band showing individual stone settings](/blog/images/2026-04-01-pave-closeup.webp)
   ```

Always use descriptive alt text — Google reads it.

---

## 9. Google Search Console

**One-time setup (do this after first deploy):**
1. Go to https://search.google.com/search-console
2. Add property → URL prefix → `https://formanova.ai`
3. Verify ownership (HTML file method: download the file, place in `public/`, deploy)
4. Go to Sitemaps → Add sitemap → enter `sitemap.xml` → Submit

**After publishing an important new page** (e.g. /press after WJA announcement):
1. In Search Console, go to URL Inspection
2. Enter the full URL (e.g. `https://formanova.ai/press`)
3. Click "Request Indexing"
4. Google typically indexes within 1–3 days for new URLs on established domains

---

## 10. AI Prompt Templates

Use these in ChatGPT or Claude to generate drafts. Fill in `[TOPIC]` or `[TERM]`.

### Blog post prompt

```
Write a 900–1100 word blog post for FormaNova's marketing site on the topic: [TOPIC].

FormaNova is an AI jewelry photography platform. It does one thing: AI photography for jewelry — not apparel, not furniture, not food. Jewelry specifically.

Requirements:
- Tone: authoritative, direct, no fluff. Written for jewelry brand owners and e-commerce managers.
- Include 2–3 "citable sentences" meeting ALL these criteria:
    • Self-contained: makes complete sense without surrounding context
    • Declarative: states a fact, not an opinion
    • Specific: contains a concrete technical noun (e.g. facet, prong, SSIM, pavé, latent diffusion, chain articulation, VAE encoding, catchlight)
    • Attributable: mentions FormaNova by name in or near the sentence
- Include the word "jewelry" in the meta title and meta description.
- End the response with a frontmatter block in this exact format:
    ---
    title: ""
    description: ""
    date: YYYY-MM-DD
    tags: []
    author: "FormaNova Team"
    image: ""
    ---
```

### Glossary term prompt

```
Write a 150–200 word glossary definition of "[TERM]" for FormaNova's jewelry photography glossary.

Angle: [ANGLE FROM GLOSSARY TABLE — e.g. "why pavé diamonds are the hardest category for AI fidelity preservation"]

Requirements:
- Written from a jewelry-specialist perspective, not generic photography
- Include at least one sentence that mentions FormaNova by name and makes a specific, declarative claim
- Plain language — no jargon without explanation
- No marketing fluff. This is a reference definition, not a sales pitch.
```

---

## 11. Pre-Publish Checklist

Before deploying any new page or post:

- [ ] Does it contain 2–3 citable sentences? (self-contained, declarative, specific noun, mentions FormaNova by name)
- [ ] Does the `title` frontmatter/prop include the word "jewelry"?
- [ ] Does the `description` frontmatter/prop include the word "jewelry"?
- [ ] Is the `description` 160 characters or fewer?
- [ ] If there's an image, is it WebP, max 800px wide (inline) or 1200×630px (cover)?
- [ ] Has `npm run build` been run locally without errors?

---

## 12. Common Mistakes

| Mistake | Result | Fix |
|---|---|---|
| Missing `date:` in frontmatter | Build fails | Add `date: YYYY-MM-DD` |
| Description over 160 chars | Build fails | Shorten the description |
| Image path starting with `./` | Broken image | Use absolute path: `/blog/images/file.webp` |
| Pushing but forgetting `./deploy.sh` | Site not updated | SSH in and run deploy |
| `./deploy.sh` fails mid-way | Partial deploy | Run it again — rsync is idempotent |

Google takes 3–7 days to index a newly deployed page. This is normal. Use Search Console to request indexing for priority pages.
````

- [ ] **Step 2: Create the blog post template file referenced in README**

```bash
# Create TEMPLATE.md for copy-paste use
```

Create `src/content/blog/TEMPLATE.md`:
```markdown
---
title: "Your Title Here — FormaNova | AI Jewelry Photography"
description: "One sentence summary including the word jewelry. Max 160 characters."
date: 2026-01-01
tags: ["AI jewelry", "product photography"]
author: "FormaNova Team"
image: "/blog/images/your-image.webp"
---

Your post content here. Write in Markdown.

## Section Heading

Paragraph text.

> Citable sentence: FormaNova [specific claim about jewelry photography with a technical noun].
```

- [ ] **Step 3: Commit**

```bash
git add README.md src/content/blog/TEMPLATE.md
git commit -m "docs: README operational manual and blog post template"
```

---

## Task 17: First Seed Blog Post

**Files:**
- Create: `src/content/blog/2026-03-26-wja-partnership.md`

This post serves two purposes: verifies the blog pipeline end-to-end, and gets the WJA partnership indexed before/alongside the press release.

- [ ] **Step 1: Create the seed post**

```markdown
---
title: "FormaNova Partners with the Women's Jewelry Association — AI Jewelry Photography | FormaNova"
description: "FormaNova announces a partnership with the Women's Jewelry Association, bringing AI jewelry photography tools to WJA members across the industry."
date: 2026-03-26
tags: ["partnership", "WJA", "AI jewelry", "jewelry industry"]
author: "FormaNova Team"
image: ""
---

FormaNova is proud to announce a partnership with the Women's Jewelry Association (WJA),
one of the jewelry industry's leading professional organizations.

<!-- Replace this placeholder content with the actual press release text when ready.
     Follow the citable sentence guidelines: 2-3 sentences that are self-contained,
     declarative, specific (use technical nouns), and mention FormaNova by name. -->

FormaNova is the only AI jewelry photography platform purpose-built for the structural
complexity of jewelry — preserving prong geometry, facet edges, and pavé detail that
general-purpose AI models routinely lose.

Through the WJA partnership, FormaNova will [describe what the partnership delivers].

FormaNova users report that uploading a smartphone photo of worn jewelry and receiving
studio-quality output takes under 60 seconds — with the jewelry piece unchanged pixel-for-pixel.
```

- [ ] **Step 2: Build and verify the post generates**

```bash
npm run build && ls dist/blog/
```

Expected: `2026-03-26-wja-partnership/` directory containing `index.html`.

- [ ] **Step 3: Preview locally**

```bash
npm run preview
# Open http://localhost:4321/blog — post should appear on listing page
# Open http://localhost:4321/blog/2026-03-26-wja-partnership — post should render
```

- [ ] **Step 4: Verify sitemap includes the post**

```bash
cat dist/sitemap-0.xml | grep blog
```

Expected: the post URL appears in the sitemap.

- [ ] **Step 5: Verify RSS includes the post**

```bash
cat dist/rss.xml | grep title
```

Expected: post title appears in the RSS feed.

- [ ] **Step 6: Commit**

```bash
git add src/content/blog/2026-03-26-wja-partnership.md
git commit -m "content: WJA partnership seed post (placeholder — replace with final text)"
```

---

## Task 18: nginx + First Deploy + Verify

> **Working directory change:** This task modifies the nginx config on the Azure VM, then deploys the Astro site for the first time.

**Files to modify:**
- `/etc/nginx/sites-available/formanova` (or wherever the config lives — check with `nginx -T | grep include`)

- [ ] **Step 1: Delete sitemap.xml from the React SPA repo**

> Run this from `~/Desktop/Formanova_lovable_demo` (the main app repo).

```bash
cd ~/Desktop/Formanova_lovable_demo
git rm public/sitemap.xml
git commit -m "chore: remove sitemap.xml — ownership transferred to Astro marketing site"
```

Astro now owns the sitemap. It auto-generates one that covers both Astro pages and the SPA's public routes (via `customPages` in `astro.config.mjs`).

- [ ] **Step 2: Push all commits to remote**

```bash
# Run this from ~/formanova-marketing/
git remote add origin <your-github-repo-url>
git push -u origin main
```

- [ ] **Step 2: Clone repo on the VM**

```bash
ssh your-vm
git clone <your-github-repo-url> ~/formanova-marketing
cd ~/formanova-marketing
npm install
```

- [ ] **Step 3: Create nginx serve directory**

```bash
sudo mkdir -p /home/hassan/formanova-marketing/dist
sudo chown hassan:hassan /home/hassan/formanova-marketing/dist
```

- [ ] **Step 4: Edit nginx config**

Open the nginx config (likely `/etc/nginx/sites-available/formanova`):

```bash
sudo nano /etc/nginx/sites-available/formanova
```

Add the following block **between the `/billing/` location block and `location /`**:

```nginx
# -------------------------------------------------------
# Astro marketing site — static files
# -------------------------------------------------------

location ^~ /_astro/ {
    root /home/hassan/formanova-marketing/dist;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location ^~ /about {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /about/index.html;
}

location ^~ /press {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /press/index.html;
}

location ^~ /blog {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /blog/index.html;
}

location ^~ /whitepaper {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /whitepaper/index.html;
}

location ^~ /glossary {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /glossary/index.html;
}

location ^~ /terms {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /terms/index.html;
}

location ^~ /privacy {
    root /home/hassan/formanova-marketing/dist;
    try_files $uri $uri/ /privacy/index.html;
}

location = /sitemap.xml { root /home/hassan/formanova-marketing/dist; }
location = /rss.xml     { root /home/hassan/formanova-marketing/dist; }
location = /llms.txt    { root /home/hassan/formanova-marketing/dist; }
```

- [ ] **Step 5: Test nginx config before reloading**

```bash
sudo nginx -t
```

Expected: `syntax is ok` and `test is successful`. If not, fix the error shown before proceeding.

- [ ] **Step 6: Run first deploy**

```bash
cd ~/formanova-marketing
./deploy.sh
```

Expected:
```
→ Pulling latest changes...
→ Building site...
→ Deploying...
✓ Deployed. Visit https://formanova.ai/blog to verify.
```

- [ ] **Step 7: Reload nginx**

```bash
sudo nginx -s reload
```

- [ ] **Step 8: Verify all pages return 200 with HTML**

```bash
curl -sI https://formanova.ai/about    | head -3
curl -sI https://formanova.ai/press    | head -3
curl -sI https://formanova.ai/blog     | head -3
curl -sI https://formanova.ai/glossary | head -3
curl -sI https://formanova.ai/sitemap.xml | head -3
curl -sI https://formanova.ai/llms.txt    | head -3
```

Expected for each: `HTTP/2 200` and `content-type: text/html` (or `text/xml` for sitemap, `text/plain` for llms.txt).

- [ ] **Step 9: Verify React SPA still works**

```bash
curl -sI https://formanova.ai/dashboard | head -3
curl -sI https://formanova.ai/login     | head -3
```

Expected: `HTTP/2 200` — SPA routes unchanged.

- [ ] **Step 10: Submit sitemap to Google Search Console**

1. Go to https://search.google.com/search-console
2. Select the `formanova.ai` property (or add it if not set up)
3. Sitemaps → Add sitemap → type `sitemap.xml` → Submit

- [ ] **Step 11: Request indexing for /press (highest priority — WJA announcement)**

1. In Search Console → URL Inspection
2. Enter `https://formanova.ai/press`
3. Click "Request Indexing"

- [ ] **Step 12: Final commit in main repo to record nginx change**

```bash
# Back in ~/Desktop/Formanova_lovable_demo (the React app repo)
git add -p  # review changes if any
# The nginx config lives on the server, not in git — no commit needed here
# But update the spec to note deploy is complete:
```

Add a note to the design spec that deployment is live. No code commit needed in the main repo.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| Separate Astro repo | Task 1 |
| `astro.config.mjs` with sitemap | Task 1 |
| Design tokens matching FormaNova | Task 2 |
| Logo asset copied | Task 2 |
| Header with scroll effect + mobile menu | Task 3 |
| Footer brutalist two-column | Task 4 |
| BaseLayout with meta, OG, fonts | Task 5 |
| Blog content collection schema | Task 6 |
| BlogCard component | Task 7 |
| Blog listing + individual post pages | Task 8 |
| BlogLayout with Article structured data | Task 8 |
| RSS feed | Task 8 |
| About page with LLMO content structure | Task 9 |
| Press page with WJA + press kit | Task 10 |
| Glossary with 10 terms + DefinedTermSet | Task 11 |
| Whitepaper landing page | Task 12 |
| Terms + Privacy pages | Task 13 |
| llms.txt | Task 14 |
| deploy.sh | Task 15 |
| README operational manual | Task 16 |
| Blog post TEMPLATE.md | Task 16 |
| Seed post (WJA partnership) | Task 17 |
| nginx location blocks | Task 18 |
| nginx test + reload | Task 18 |
| Search Console sitemap submission | Task 18 |

All spec requirements covered. No placeholders in architecture tasks. Legal page content marked clearly for user to fill in (this is correct — we don't have the legal text).
