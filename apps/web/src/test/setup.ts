import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout engine. Radix primitives and the router call these
// browser APIs, so they are provided as inert stand-ins.
class ResizeObserverStub {
  observe(): void {
    // No layout in jsdom: nothing to observe.
  }
  unobserve(): void {
    // No layout in jsdom: nothing to unobserve.
  }
  disconnect(): void {
    // No layout in jsdom: nothing to disconnect.
  }
}

Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
Object.assign(window, { scrollTo: () => undefined });
Object.assign(window.HTMLElement.prototype, {
  scrollIntoView: () => undefined,
  hasPointerCapture: () => false,
});

afterEach(() => {
  cleanup();
});
