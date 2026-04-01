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
