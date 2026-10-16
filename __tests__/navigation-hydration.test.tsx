import { act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, Root } from 'react-dom/client';
import { useHydratedPathname } from '@/hooks/use-hydrated-pathname';
import { NavBar } from '@/components/ui/tubelight-navbar';

let mockPathname = '/';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
const icon = () => <svg />;
const items = [
  { name: 'Home', url: '/', icon },
  { name: 'Jobs', url: '/jobs', icon },
];
function Navigation() {
  const path = useHydratedPathname();
  return <NavBar items={items} activeTab={items.find(item => item.url === path)?.name ?? ''} />;
}

test('hydrates the navigation across a hosting rewrite and updates the active route', async () => {
  const container = document.createElement('div');
  const recover = jest.fn();
  let root: Root | undefined;
  try {
    mockPathname = '/index';
    container.innerHTML = renderToString(<Navigation />);
    expect(container.querySelector('[data-active="true"]')).toBeNull();
    document.body.append(container);
    mockPathname = '/';
    await act(async () => { root = hydrateRoot(container, <Navigation />, { onRecoverableError: recover }); });
    expect(recover).not.toHaveBeenCalled();
    expect(container.querySelector('[data-active="true"]')).toHaveAttribute('href', '/');
    mockPathname = '/jobs';
    await act(async () => { root!.render(<Navigation />); });
    expect(container.querySelector('[data-active="true"]')).toHaveAttribute('href', '/jobs');
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
});
