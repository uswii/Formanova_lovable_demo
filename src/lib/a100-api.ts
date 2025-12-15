// A100 Server API Integration via Edge Function Proxy
const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/a100-proxy`;

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  gpu_available: boolean;
}

export interface SegmentRequest {
  image: string; // base64
  points: { x: number; y: number }[];
  gender: 'female' | 'male';
}

export interface SegmentResponse {
  mask_overlay: string; // base64
  mask_binary: string; // base64
  session_id: string;
}

export interface RefineMaskRequest {
  session_id: string;
  mask: string; // base64
  strokes: { x: number; y: number; mode: 'add' | 'remove' }[];
}

export interface RefineMaskResponse {
  mask_overlay: string;
  mask_binary: string;
}

export interface GenerateRequest {
  session_id: string;
  original_image: string;
  mask: string;
  gender: 'female' | 'male';
}

export interface GenerateResponse {
  flux_result: string;
  gemini_result: string;
  fidelity_viz: string;
  metrics: {
    precision: number;
    recall: number;
    iou: number;
    growth_ratio: number;
  };
  status: 'good' | 'bad';
}

export interface ExampleImage {
  filename: string;
  url: string;
  label: string;
}

class A100Api {
  private proxyUrl: string;
  private _isOnline: boolean = false;
  private _lastCheck: number = 0;
  private _checkInterval: number = 30000; // 30 seconds

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
        this._isOnline = data.status === 'ok' && data.model_loaded;
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
        return await response.json();
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
