import { describe, it, expect } from 'vitest';
import { inferSourceType } from './generation-history-api';

describe('inferSourceType', () => {
  it('identifies product_shot workflows', () => {
    expect(inferSourceType('product_shot_workflow')).toBe('product_shot');
    expect(inferSourceType('product-shot-v2')).toBe('product_shot');
    expect(inferSourceType('PRODUCT_SHOT')).toBe('product_shot');
  });

  it('identifies cad_text workflows', () => {
    expect(inferSourceType('ring_full_pipeline')).toBe('cad_text');
    expect(inferSourceType('ring_generate')).toBe('cad_text');
    expect(inferSourceType('text_to_cad')).toBe('cad_text');
    expect(inferSourceType('text-to-cad')).toBe('cad_text');
    expect(inferSourceType('ring-generate')).toBe('cad_text');
    expect(inferSourceType('ring_pipeline_v2')).toBe('cad_text');
    expect(inferSourceType('ring_generate_v3')).toBe('cad_text');
  });

  it('identifies cad_render workflows', () => {
    expect(inferSourceType('cad_render')).toBe('cad_render');
    expect(inferSourceType('render_workflow')).toBe('cad_render');
  });

  it('identifies photo workflows', () => {
    expect(inferSourceType('photo_workflow')).toBe('photo');
    expect(inferSourceType('masking_pipeline')).toBe('photo');
    expect(inferSourceType('flux_gen')).toBe('photo');
    expect(inferSourceType('jewelry_photoshoot')).toBe('photo');
    expect(inferSourceType('necklace_shoot')).toBe('photo');
    expect(inferSourceType('earring_workflow')).toBe('photo');
    expect(inferSourceType('bracelet_gen')).toBe('photo');
    expect(inferSourceType('watch_shoot')).toBe('photo');
    expect(inferSourceType('agentic_pipeline')).toBe('photo');
  });

  it('product_shot takes priority over photo keywords', () => {
    // A workflow named product_shot should never fall through to photo
    expect(inferSourceType('product_shot_jewelry')).toBe('product_shot');
  });

  it('cad_text takes priority over cad_render for ring pipelines', () => {
    // ring_full_pipeline contains neither 'cad' nor 'render', so it should still be cad_text
    expect(inferSourceType('ring_full_pipeline')).toBe('cad_text');
  });

  it('returns unknown for unrecognised names', () => {
    expect(inferSourceType('')).toBe('unknown');
    expect(inferSourceType('my_custom_workflow')).toBe('unknown');
    expect(inferSourceType('test')).toBe('unknown');
  });
});
