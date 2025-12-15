// A100 Server API Integration via Edge Function Proxy
const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/a100-proxy`;

export interface HealthResponse {
  status: string;
  models_loaded: boolean;
  gpu_available: boolean;
  gpu_name?: string;
  message: string;
}

export interface SegmentRequest {
  image_base64: string;
  points: number[][];
}

export interface SegmentResponse {
  mask_base64: string;
  mask_overlay_base64: string;
  processed_image_base64: string;
  original_mask_base64: string;
  scaled_points: number[][];
  session_id: string;
  image_width: number;
  image_height: number;
}

export interface RefineMaskRequest {
  original_image_base64: string;
  current_mask_base64: string;
  brush_strokes: { type: 'add' | 'remove'; points: number[][]; radius: number }[];
}

export interface RefineMaskResponse {
  mask_base64: string;
  mask_overlay_base64: string;
}

export interface GenerateRequest {
  image_base64: string;
  mask_base64: string;
  original_mask_base64?: string;
  gender: 'female' | 'male';
  use_gemini?: boolean;
  scaled_points?: number[][];
}

export interface GenerateResponse {
  result_base64: string;
  result_gemini_base64?: string;
  fidelity_viz_base64?: string;
  metrics?: {
    precision: number;
    recall: number;
    iou: number;
    growth_ratio: number;
  };
  session_id: string;
}

export interface ExampleImage {
  id: string;
  name: string;
  image_base64: string;
  thumbnail_base64?: string;
}

class A100Api {
  private proxyUrl: string;
  private _isOnline: boolean = false;
  private _lastCheck: number = 0;
  private _checkInterval: number = 30000;

  constructor(proxyUrl: string) {
    this.proxyUrl = proxyUrl;
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  private getProxyEndpoint(endpoint: string): string {
    return `${this.proxyUrl}?endpoint=${encodeURIComponent(endpoint)}`;
  }

  async checkHealth(): Promise<HealthResponse | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(this.getProxyEndpoint('/health'), {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        this._isOnline = data.status === 'online' && data.models_loaded;
        this._lastCheck = Date.now();
        return data;
      }
      this._isOnline = false;
      return null;
    } catch (error) {
      console.error('A100 health check failed:', error);
      this._isOnline = false;
      return null;
    }
  }

  async ensureOnline(): Promise<boolean> {
    if (Date.now() - this._lastCheck < this._checkInterval && this._isOnline) {
      return true;
    }
    const health = await this.checkHealth();
    return health !== null && this._isOnline;
  }

  async getExamples(): Promise<ExampleImage[]> {
    try {
      const response = await fetch(this.getProxyEndpoint('/examples'), {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return data.examples || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch examples:', error);
      return [];
    }
  }

  async segment(request: SegmentRequest): Promise<SegmentResponse | null> {
    try {
      const response = await fetch(this.getProxyEndpoint('/segment'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(request),
      });
      
      if (response.ok) {
        return await response.json();
      }
      console.error('Segment failed:', await response.text());
      return null;
    } catch (error) {
      console.error('Segment request failed:', error);
      return null;
    }
  }

  async refineMask(request: RefineMaskRequest): Promise<RefineMaskResponse | null> {
    try {
      const response = await fetch(this.getProxyEndpoint('/refine-mask'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(request),
      });
      
      if (response.ok) {
        return await response.json();
      }
      console.error('Refine mask failed:', await response.text());
      return null;
    } catch (error) {
      console.error('Refine mask request failed:', error);
      return null;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse | null> {
    try {
      const response = await fetch(this.getProxyEndpoint('/generate'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(request),
      });
      
      if (response.ok) {
        return await response.json();
      }
      console.error('Generate failed:', await response.text());
      return null;
    } catch (error) {
      console.error('Generate request failed:', error);
      return null;
    }
  }
}

export const a100Api = new A100Api(PROXY_URL);
