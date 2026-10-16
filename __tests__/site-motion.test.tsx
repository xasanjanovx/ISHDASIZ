import { act, render } from '@testing-library/react';
import { SiteMotion } from '@/components/layout/site-motion';

let intersects: IntersectionObserverCallback;
let mutation: MutationCallback;
let onPreferenceChange: () => void;
const observe = jest.fn(), disconnect = jest.fn(), unobserve = jest.fn(), mutationDisconnect = jest.fn();
const cancel = jest.fn();
const animate = jest.fn(() => ({ cancel }));
const preference = { matches: false, addEventListener: jest.fn((_, cb) => { onPreferenceChange = cb; }), removeEventListener: jest.fn() };
const original = { matchMedia: window.matchMedia, IntersectionObserver: window.IntersectionObserver, MutationObserver: window.MutationObserver, animate: HTMLElement.prototype.animate };
beforeEach(() => {
  jest.clearAllMocks(); preference.matches = false;
  window.matchMedia = jest.fn(() => preference) as any;
  window.IntersectionObserver = jest.fn(callback => { intersects = callback; return { observe, disconnect, unobserve }; }) as any;
  window.MutationObserver = jest.fn(callback => { mutation = callback; return { observe: jest.fn(), disconnect: mutationDisconnect }; }) as any;
  HTMLElement.prototype.animate = animate as any;
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: 100 } as DOMRect);
});
afterEach(() => {
  jest.restoreAllMocks();
  window.matchMedia = original.matchMedia;
  window.IntersectionObserver = original.IntersectionObserver;
  window.MutationObserver = original.MutationObserver;
  HTMLElement.prototype.animate = original.animate;
});
const enter = (target: Element) => act(() => intersects([{ target, isIntersecting: true }] as any, {} as any));
function mount() { return render(<><SiteMotion /><main><a href="/jobs/a" className="catalog-job-card">Вакансия</a></main></>); }
test('animates entering cards once while preserving their visible fallback and cancels on teardown', () => {
  const view = mount();
  const card = document.querySelector('.catalog-job-card')!;
  expect(observe).toHaveBeenCalledWith(card);
  expect(card).not.toHaveAttribute('style');
  enter(card);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(unobserve).toHaveBeenCalledWith(card);
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(mutationDisconnect).toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledTimes(1);
});
test('observes asynchronously loaded cards and avoids animating a focused link', () => {
  const view = mount();
  const card = document.querySelector('.catalog-job-card')! as HTMLElement;
  card.focus(); enter(card);
  expect(animate).not.toHaveBeenCalled();
  const extra = document.createElement('a'); extra.className = 'catalog-resume-card';
  document.querySelector('main')!.append(extra);
  act(() => mutation([], {} as any));
  expect(observe).toHaveBeenCalledWith(extra);
  expect(observe.mock.calls.filter(([item]) => item === card)).toHaveLength(1);
  view.unmount();
});
test('honors reduced motion on load and when changed while browsing', () => {
  preference.matches = true;
  const view = mount();
  expect(window.IntersectionObserver).not.toHaveBeenCalled();
  preference.matches = false; act(() => onPreferenceChange());
  enter(document.querySelector('.catalog-job-card')!);
  expect(animate).toHaveBeenCalledTimes(1);
  preference.matches = true; act(() => onPreferenceChange());
  expect(cancel).toHaveBeenCalledTimes(1);
  view.unmount();
});

test('observes a main element streamed after the layout has hydrated', () => {
  const view = render(<SiteMotion />);
  const main = document.createElement('main');
  main.innerHTML = '<div class="poster-search-card">Поиск</div>';
  document.body.append(main);
  try {
    act(() => mutation([], {} as any));
    const card = main.firstElementChild!;
    expect(observe).toHaveBeenCalledWith(card);
    enter(card);
    expect(animate).toHaveBeenCalledTimes(1);
  } finally { main.remove(); view.unmount(); }
});
