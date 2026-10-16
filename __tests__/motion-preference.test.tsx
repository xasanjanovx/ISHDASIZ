import { act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, Root } from 'react-dom/client';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

function Preference() {
  return <span>{usePrefersReducedMotion() ? 'static' : 'animated'}</span>;
}

test('hydrates without a mismatch on reduced-motion devices and follows preference changes', async () => {
  const original = window.matchMedia;
  let matches = true;
  const listeners = new Set<() => void>();
  window.matchMedia = jest.fn(() => ({
    get matches() { return matches; },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  })) as any;
  const container = document.createElement('div');
  const recover = jest.fn();
  let root: Root | undefined;
  try {
    container.innerHTML = renderToString(<Preference />);
    expect(container).toHaveTextContent('animated');
    document.body.append(container);
    await act(async () => { root = hydrateRoot(container, <Preference />, { onRecoverableError: recover }); });
    expect(container).toHaveTextContent('static');
    expect(recover).not.toHaveBeenCalled();
    act(() => { matches = false; listeners.forEach(listener => listener()); });
    expect(container).toHaveTextContent('animated');
    act(() => { matches = true; listeners.forEach(listener => listener()); });
    expect(container).toHaveTextContent('static');
  } finally {
    act(() => root?.unmount());
    container.remove();
    window.matchMedia = original;
  }
  expect(listeners.size).toBe(0);
});
