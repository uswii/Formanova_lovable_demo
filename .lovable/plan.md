# Bulk Upload Feature - Implementation Status

## ✅ Completed

### Frontend Components (`src/components/bulk/`)
- `BulkCategorySelector.tsx` - Visual category cards with worn-only badges
- `UploadGuideBillboard.tsx` - OK/NOT OK visual guide sidebar
- `BulkUploadZone.tsx` - Drag-drop upload with thumbnail grid (max 10)
- `MetadataSelectors.tsx` - Skin tone swatches + gender toggle
- `BatchReviewConfirm.tsx` - Summary + 24hr consent checkbox
- `BatchSubmittedConfirmation.tsx` - Hand-off success message
- `index.ts` - Barrel exports

### Pages
- `BulkUploadStudio.tsx` - Multi-step wizard (Category → Upload → Review → Confirmation)
- `PhotographyStudioCategories.tsx` - Old category-based flow (preserved for switching back)

### Routing
- `/studio` → BulkUploadStudio (bulk upload flow)
- `/studio/:type` → JewelryStudio (single image flow, unchanged)

## 🔄 Switching Back to Old Flow

To restore the category-based flow:
1. In `App.tsx`, uncomment the import for `PhotographyStudioCategories`
2. Change the `/studio` route to use `PhotographyStudioCategories` instead of `BulkUploadStudio`

## ⏳ TODO (Backend Integration)

### Edge Functions
- `supabase/functions/batch-submit/index.ts` - Handle submission to Temporal
- `supabase/functions/batch-status/index.ts` - Return queue/stage info

### Hooks
- `use-batch-submit.ts` - Submit batch to backend
- `use-batch-status.ts` - Poll batch status

### Pages
- `BatchDashboard.tsx` - Status tracking page at `/batches`

### Temporal Workflow Updates
- Add pipeline stage tracking via `@workflow.query`
- Expose current processing stage for frontend polling

