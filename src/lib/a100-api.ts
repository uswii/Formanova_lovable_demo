// A100 Server API Integration via Edge Function Proxy
// This is the standalone A100 server (api_server.py) - simple FastAPI endpoints
// NOT the DAG/Temporal workflow system

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/a100-proxy`;

export interface HealthResponse {
  status: string;
  models_loaded: boolean;
  gpu_available: boolean;
  gpu_name?: string;
  gemini_available?: boolean;
  message: string;
}

export interface SegmentRequest {
  image_base64: string;
  points: number[][];
  jewelry_type?: string;  // 'necklace' uses 2000x2667, others use 912x1168
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
  jewelry_type?: string;  // ring, bracelet, earring, necklace, watch
  skin_tone?: string;     // light, fair, medium, olive, brown, dark
  original_mask_base64?: string;
  gender?: 'female' | 'male';
  use_gemini?: boolean;
  scaled_points?: number[][];
  enable_quality_check?: boolean;
  enable_transformation?: boolean;
}

export interface GenerateResponse {
  result_base64: string;
  result_gemini_base64?: string;  // Only for necklace (has two modes)
  fidelity_viz_base64?: string;
  fidelity_viz_gemini_base64?: string;  // Only for necklace
  metrics?: {
    precision: number;
    recall: number;
    iou: number;
    dice?: number;
    growth_ratio: number;
    extra_area_fraction?: number;
  };
  metrics_gemini?: {
    precision: number;
    recall: number;
    iou: number;
    dice?: number;
    growth_ratio: number;
    extra_area_fraction?: number;
  };
  session_id: string;
  has_two_modes?: boolean;  // true for necklace, false for others
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
  private _debugMode: boolean = false;

  constructor(proxyUrl: string) {
    this.proxyUrl = proxyUrl;
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  get debugMode(): boolean {
    return this._debugMode;
  }

  set debugMode(value: boolean) {
    this._debugMode = value;
    console.log('[A100] Debug mode:', value ? 'ON' : 'OFF');
  }

  private log(...args: unknown[]) {
    if (this._debugMode) {
      console.log('[A100 DEBUG]', ...args);
    }
  }

  private getProxyEndpoint(endpoint: string): string {
    return `${this.proxyUrl}?endpoint=${encodeURIComponent(endpoint)}`;
  }

  private getAuthToken(): string | null {
    // Check for custom auth token first (FormaNova auth)
    const customToken = localStorage.getItem('formanova_auth_token');
    if (customToken) {
      return customToken;
    }
    // Fallback to Supabase anon key
    return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  }

  private getHeaders(): Record<string, string> {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  async checkHealth(): Promise<HealthResponse | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      this.log('Checking health...');
      const response = await fetch(this.getProxyEndpoint('/health'), {
        signal: controller.signal,
        headers: this.getHeaders(),
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        this._isOnline = data.status === 'online' && data.models_loaded === true;
        this._lastCheck = Date.now();
        this.log('Health check result:', data, 'isOnline:', this._isOnline);
        return data;
      }
      this.log('Health check failed - response not ok:', response.status);
      this._isOnline = false;
      return null;
    } catch (error) {
      console.error('A100 health check failed:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        this.log('Health check timed out - keeping previous state');
        return null;
      }
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
      this.log('Fetching examples...');
      const response = await fetch(this.getProxyEndpoint('/examples'), {
        headers: this.getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        this.log('Examples fetched:', data.examples?.length || 0);
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
      this.log('Segment request:', {
        jewelryType: request.jewelry_type,
        pointCount: request.points.length,
        imageLength: request.image_base64.length,
      });
      
      const response = await fetch(this.getProxyEndpoint('/segment'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.log('Segment response:', {
          sessionId: data.session_id,
          imageWidth: data.image_width,
          imageHeight: data.image_height,
          scaledPoints: data.scaled_points?.length,
        });
        return data;
      }
      const errorText = await response.text();
      console.error('Segment failed:', response.status, errorText);
      return null;
    } catch (error) {
      console.error('Segment request failed:', error);
      return null;
    }
  }

  async refineMask(request: RefineMaskRequest): Promise<RefineMaskResponse | null> {
    try {
      this.log('Refine mask request:', {
        strokeCount: request.brush_strokes.length,
        strokes: request.brush_strokes.map(s => ({ type: s.type, points: s.points.length, radius: s.radius })),
      });
      
      const response = await fetch(this.getProxyEndpoint('/refine-mask'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.log('Refine mask response: success');
        return data;
      }
      const errorText = await response.text();
      console.error('Refine mask failed:', response.status, errorText);
      return null;
    } catch (error) {
      console.error('Refine mask request failed:', error);
      return null;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse | null> {
    try {
      this.log('Generate request:', {
        jewelryType: request.jewelry_type,
        skinTone: request.skin_tone,
        gender: request.gender,
        useGemini: request.use_gemini,
        hasScaledPoints: !!request.scaled_points,
        enableQualityCheck: request.enable_quality_check,
        enableTransformation: request.enable_transformation,
      });
      
      const response = await fetch(this.getProxyEndpoint('/generate'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.log('Generate response:', {
          sessionId: data.session_id,
          hasTwoModes: data.has_two_modes,
          hasResult: !!data.result_base64,
          hasGeminiResult: !!data.result_gemini_base64,
          hasFidelityViz: !!data.fidelity_viz_base64,
          hasMetrics: !!data.metrics,
        });
        return data;
      }
      const errorText = await response.text();
      console.error('Generate failed:', response.status, errorText);
      return null;
    } catch (error) {
      console.error('Generate request failed:', error);
      return null;
    }
  }
}

export const a100Api = new A100Api(PROXY_URL);
