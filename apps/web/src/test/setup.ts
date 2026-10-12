import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout engine; Radix primitives use these browser APIs.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
window.HTMLElement.prototype.scrollIntoView ??= () => undefined;
window.scrollTo = () => undefined;
window.HTMLElement.prototype.hasPointerCapture ??= () => false;

afterEach(() => {
  cleanup();
});
