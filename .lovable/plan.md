

# Bulk Upload UX Plan (No Draft Previews)

## Overview

Apple-caliber bulk upload workflow with visual guidance, transparent queue tracking, and polished hand-off experience. Users understand the 24-hour commitment upfront and can "set and forget" with confidence.

---

## User Flow

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    STEP 1       │───>│    STEP 2       │───>│    STEP 3       │───>│    STEP 4       │
│    Category     │    │    Upload       │    │    Review       │    │    Hand-off     │
│    Selection    │    │    + Guide      │    │    & Submit     │    │    Message      │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
       │                      │                      │                      │
       v                      v                      v                      v
  Visual cards          Billboard showing       Summary + 24hr        "Close this tab,
  with worn jewelry     OK vs NOT OK            time agreement        we'll email you"
  silhouettes           examples
```

---

## Phase 1: Category Selection

### Component: `BulkCategorySelector.tsx`

Large visual cards showing jewelry **worn on models**:
- Necklace (neck silhouette with jewelry)
- Earrings (ear silhouette with jewelry)
- Ring (hand silhouette with jewelry)
- Bracelet (wrist silhouette with jewelry)

**Key UX Elements:**
- Upload area disabled until category selected
- Each card has subtle badge: "Worn photos only"
- Progress breadcrumb: `1. Category → 2. Upload → 3. Confirm`
- Theme-aware selection state (gold accent border)

---

## Phase 2: Upload Interface with Visual Billboard

### Component: `BulkUploadZone.tsx`

**Layout:** Two-column on desktop (billboard left, upload right), stacked on mobile

#### Visual Guidance Billboard (persistent sidebar)

```text
┌────────────────────────────────┐
│   📋 UPLOAD GUIDE              │
├────────────────────────────────┤
│                                │
│   ✓ ACCEPTED                   │
│   ┌────────────────────┐       │
│   │  [Photo of model   │       │
│   │   wearing necklace]│       │
│   │                    │       │
│   │  Jewelry on person │       │
│   └────────────────────┘       │
│                                │
│   ✗ NOT ACCEPTED               │
│   ┌────────────────────┐       │
│   │  [Photo of jewelry │       │
│   │   on fabric/table] │       │
│   │                    │       │
│   │  Flatlay / Product │       │
│   └────────────────────┘       │
│                                │
│   All images must show         │
│   jewelry being worn           │
└────────────────────────────────┘
```

#### Upload Area
- Drag-and-drop zone with elegant dashed border
- Thumbnail grid as images are added
- Counter: "4 of 10 images"
- Remove button (×) on each thumbnail
- Validation: max 10 images per batch

#### Metadata Selectors
- **Skin tone:** Visual swatch circles (not text dropdown)
- **Gender:** Elegant icon-based toggle (silhouette figures)

---

## Phase 3: Review & Time Agreement

### Component: `BatchReviewConfirm.tsx`

Before submission, user must acknowledge the 24-hour timeline.

**Summary Panel:**
```text
┌────────────────────────────────────────────────────────────┐
│   YOUR BATCH SUMMARY                                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   Category: Necklaces                                      │
│   Images: 6 of 10                                          │
│   Model: Female, Medium skin tone                          │
│                                                            │
│   ┌──────────────────────────────────────────────────────┐ │
│   │  ⏱ PROCESSING TIME                                   │ │
│   │                                                      │ │
│   │  High-fidelity generation takes up to 24 hours.      │ │
│   │  We'll email you the moment your images are ready.   │ │
│   │                                                      │ │
│   │  (Most batches complete in 4-8 hours)                │ │
│   └──────────────────────────────────────────────────────┘ │
│                                                            │
│   □ I understand this will take up to 24 hours            │
│                                                            │
│   [Submit Batch]  ← disabled until checkbox checked        │
│                                                            │
│   🎁 This is your first batch - it's free!                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Phase 4: Hand-off Confirmation

### Component: `BatchSubmittedConfirmation.tsx`

After successful submission, display the "set and forget" message:

```text
┌────────────────────────────────────────────────────────────┐
│                                                            │
│              ✓ YOUR BATCH HAS BEEN SUBMITTED               │
│                                                            │
│   "Our masters are now meticulously rendering your         │
│    Necklace collection. Excellence takes time."            │
│                                                            │
│   ┌──────────────────────────────────────────────────────┐ │
│   │                                                      │ │
│   │   You can safely close this tab.                     │ │
│   │   We'll email you the moment your                    │ │
│   │   photoshoots are ready.                             │ │
│   │                                                      │ │
│   └──────────────────────────────────────────────────────┘ │
│                                                            │
│   Expected delivery: Within 24 hours                       │
│   (Usually faster — we'll surprise you!)                   │
│                                                            │
│   [View Batch Status]     [Start Another Batch]            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Phase 5: Batch Status Dashboard

### Page: `BatchDashboard.tsx` (Route: `/batches`)

For users who want to check progress (optional, not required):

#### Queue Position Tracker
```text
┌─────────────────────────────────────────────────────────────┐
│  QUEUE POSITION                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Position 12/45   │
│                                                             │
│  Estimated completion: ~3 hours                             │
└─────────────────────────────────────────────────────────────┘
```

#### Pipeline Stage Display (per batch)
Shows current processing stage:
1. "Queued for processing"
2. "Analyzing image geometry"
3. "Detecting jewelry boundaries"
4. "Generating model scene"
5. "Placing jewelry"
6. "Enhancing textures"
7. "Finalizing lighting"
8. "Quality verification"
9. "Complete — Download ready"

#### System Load Indicator
```text
┌───────────────────────────────┐
│  System Load: ████████░░ HIGH │
│  Current wait times may be    │
│  longer than usual            │
└───────────────────────────────┘
```

#### Batch Cards
Each batch shows:
- Category + image count
- Submission time
- Current stage
- Download button (when complete)

---

## Technical Implementation

### New Files to Create

**Frontend Components:**
```text
src/pages/BulkUploadStudio.tsx          # Main orchestrator page
src/pages/BatchDashboard.tsx            # Status tracking page

src/components/bulk/
├── BulkCategorySelector.tsx            # Visual category cards
├── BulkUploadZone.tsx                  # Upload area + billboard
├── UploadGuideBillboard.tsx            # OK/NOT OK visual guide
├── MetadataSelectors.tsx               # Skin tone + gender
├── BatchReviewConfirm.tsx              # Summary + time agreement
├── BatchSubmittedConfirmation.tsx      # Hand-off message
├── BatchStatusCard.tsx                 # Individual batch status
├── QueuePositionTracker.tsx            # Progress bar + position
└── PipelineStageIndicator.tsx          # Current processing stage
```

**Hooks:**
```text
src/hooks/use-batch-submit.ts           # Submit batch to backend
src/hooks/use-batch-status.ts           # Poll batch status
src/hooks/use-user-batches.ts           # Fetch user's batches
```

**Edge Functions:**
```text
supabase/functions/batch-submit/index.ts    # Handle submission
supabase/functions/batch-status/index.ts    # Return queue/stage info
```

**Visual Assets:**
```text
src/assets/bulk-guide/
├── acceptable-necklace-worn.png
├── acceptable-earrings-worn.png
├── not-acceptable-flatlay.png
└── not-acceptable-product-only.png
```

### Routing Updates

Add to `App.tsx`:
```typescript
<Route path="/bulk-upload" element={<BulkUploadStudio />} />
<Route path="/batches" element={<BatchDashboard />} />
<Route path="/batches/:batchId" element={<BatchDashboard />} />
```

### Edge Function: `batch-submit`

1. Validate JWT (user must be authenticated)
2. Check free batch eligibility via `has_free_batch_available()`
3. Upload each image to Azure Blob Storage
4. Create batch record in temporal-backend PostgreSQL
5. Create batch_images records with Azure URIs
6. Start Temporal `BatchProcessingWorkflow`
7. Return batch ID

### Edge Function: `batch-status`

1. Validate JWT
2. Query batch_jobs for user's batches
3. Get queue position (count of pending batches ahead)
4. Get current pipeline stage from Temporal workflow query
5. Return structured status response

### Temporal Workflow Updates

Modify `BatchProcessingWorkflow` to:
- Track and expose current pipeline stage via `@workflow.query`
- Update stage after each activity completes
- Store stage in database for persistence

---

## Theme Compatibility

All components will use existing theme system:
- `marta-button`, `marta-button-filled` for buttons
- `marta-frame` for bordered containers
- `marta-label` for small caps text
- `font-display` for headings
- CSS variables for colors
- Existing animation components (`ScrollRevealSection`, etc.)

---

## Mobile Responsiveness

- Billboard moves above upload zone on mobile
- Category cards become 2-column grid on tablet, 1-column on mobile
- Thumbnail grid adapts columns based on viewport
- Status dashboard cards stack vertically

---

## Implementation Order

1. **BulkCategorySelector** — Visual category selection
2. **UploadGuideBillboard** — OK/NOT OK visual guide
3. **BulkUploadZone** — Upload area with thumbnails
4. **MetadataSelectors** — Skin tone and gender pickers
5. **BatchReviewConfirm** — Summary and 24hr agreement
6. **BatchSubmittedConfirmation** — Hand-off message
7. **batch-submit edge function** — Backend submission
8. **BatchDashboard page** — Status tracking
9. **batch-status edge function** — Queue/stage polling
10. **Temporal workflow updates** — Stage tracking queries

