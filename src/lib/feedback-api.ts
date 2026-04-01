import { authenticatedFetch } from '@/lib/authenticated-fetch';

export type GenerationType =
  | 'photoshoot'
  | 'text_to_cad';

export type FeedbackCategory =
  | 'necklace'
  | 'ring'
  | 'bracelet'
  | 'earring'
  | 'watch'
  | 'other';

export type FeedbackRequest = {
  workflow_id: string;
  generation_type: GenerationType;
  input_image_urls: string[];
  output_image_url: string;
  complaint: string;
  category: FeedbackCategory;
};

export type FeedbackResponse = {
  success: boolean;
  feedback_id: string;
};

/**
 * POST /api/feedback — submits a generation complaint.
 *   Auth: Bearer <jwt>
 *   Body: FeedbackRequest
 *   Response 200: { "success": true, "feedback_id": "..." }
 */
export async function submitFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
  const res = await authenticatedFetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to submit feedback: ${res.status}`);
  return res.json();
}

// ─── Admin types ─────────────────────────────────────────────────────────────

export type FeedbackStatus = 'open' | 'looks_fine' | 'resolved';

export interface AdminFeedbackItem {
  id: string;
  workflow_id: string;
  user_id: string;
  user_email: string;
  username: string;
  category: string;
  generation_type: string;
  complaint: string;
  input_image_urls: string[];
  output_image_url: string;
  status: FeedbackStatus;
  admin_notes: string | null;
  contacted: boolean;
  revised_output_url: string | null;
  created_at: string;
}

export interface AdminFeedbackStats {
  total: number;
  open: number;
  looks_fine: number;
  resolved: number;
}

export interface AdminFeedbackListParams {
  status?: FeedbackStatus;
  category?: string;
  q?: string;
  from?: string;
  to?: string;
  sort_by?: 'created_at' | 'status' | 'category';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AdminFeedbackListResponse {
  items: AdminFeedbackItem[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateFeedbackPayload {
  status?: FeedbackStatus;
  admin_notes?: string;
  contacted?: boolean;
}

// ─── Admin API functions ──────────────────────────────────────────────────────

export async function listAdminFeedback(params: AdminFeedbackListParams = {}): Promise<AdminFeedbackListResponse> {
  const q = new URLSearchParams();
  if (params.status)   q.set('status',   params.status);
  if (params.category) q.set('category', params.category);
  if (params.q)        q.set('q',        params.q);
  if (params.from)     q.set('from',     params.from);
  if (params.to)       q.set('to',       params.to);
  if (params.sort_by)  q.set('sort_by',  params.sort_by);
  if (params.sort_dir) q.set('sort_dir', params.sort_dir);
  if (params.page)     q.set('page',     String(params.page));
  if (params.limit)    q.set('limit',    String(params.limit));
  const res = await authenticatedFetch(`/api/feedback?${q.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch feedback: ${res.status}`);
  return res.json();
}

export async function getAdminFeedbackStats(): Promise<AdminFeedbackStats> {
  const res = await authenticatedFetch('/api/feedback/stats');
  if (!res.ok) throw new Error(`Failed to fetch feedback stats: ${res.status}`);
  return res.json();
}

export async function updateAdminFeedback(id: string, payload: UpdateFeedbackPayload): Promise<AdminFeedbackItem> {
  const res = await authenticatedFetch(`/api/feedback/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update feedback: ${res.status}`);
  return res.json();
}

/**
 * POST /api/feedback/{id}/revised-output
 * Payload format: { base64: string, content_type: string } — confirm with backend.
 */
export async function uploadRevisedOutput(id: string, file: File): Promise<{ revised_output_url: string }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const res = await authenticatedFetch(`/api/feedback/${id}/revised-output`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, content_type: file.type }),
  });
  if (!res.ok) throw new Error(`Failed to upload revised output: ${res.status}`);
  return res.json();
}
