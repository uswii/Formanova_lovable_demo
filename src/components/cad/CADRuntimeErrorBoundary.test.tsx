// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import CADRuntimeErrorBoundary from './CADRuntimeErrorBoundary';

const Thrower = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('viewer crash');
  return <div>viewer ready</div>;
};

describe('CADRuntimeErrorBoundary', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders a local fallback after a CAD viewer render error', () => {
    act(() => {
      root.render(
        <CADRuntimeErrorBoundary>
          <Thrower shouldThrow />
        </CADRuntimeErrorBoundary>,
      );
    });

    expect(container.textContent).toContain('3D View Unavailable');
    expect(container.textContent).toContain('Try again');
  });

  it('resets when reset keys change', () => {
    act(() => {
      root.render(
        <CADRuntimeErrorBoundary resetKeys={['bad-model']}>
          <Thrower shouldThrow />
        </CADRuntimeErrorBoundary>,
      );
    });

    expect(container.textContent).toContain('3D View Unavailable');

    act(() => {
      root.render(
        <CADRuntimeErrorBoundary resetKeys={['next-model']}>
          <Thrower shouldThrow={false} />
        </CADRuntimeErrorBoundary>,
      );
    });

    expect(container.textContent).toContain('viewer ready');
  });
});
