import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { HeroSection } from "@/components/home/hero-section";
import { HeroTelegramLink } from "@/components/home/hero-telegram-link";
const mockPush = jest.fn();
const mockReducedMotion = jest.fn(() => false);
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ lang: "ru" }),
}));
jest.mock("@/hooks/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: () => mockReducedMotion(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockReducedMotion.mockReturnValue(false);
});
it("the benefits strip explains the site and links to the channel without duplicate keyboard stops", () => {
  render(<HeroSection />);
  const strip = screen.getByRole("region", {
    name: "О сайте и Telegram-канале",
  });
  expect(within(strip).getAllByRole("link")).toHaveLength(7);
  expect(within(strip).getByRole("link", { name: /Telegram-канал/ })).toHaveAttribute("href", "https://t.me/ishdasiz");
  expect(within(strip).getByRole("link", { name: "Работа на карте" })).toHaveAttribute("href", "/map");
  expect(within(strip).getByRole("link", { name: "Поиск по профессии" })).toHaveAttribute("href", "/jobs");
  strip.querySelectorAll('.poster-ticker-group[aria-hidden="true"] a').forEach(link => expect(link).toHaveAttribute('tabindex', '-1'));
  const groups = strip.querySelectorAll('.poster-ticker-group');
  expect(groups[0].textContent).toBe(groups[1].textContent);
  expect(groups[1]).toHaveAttribute('aria-hidden', 'true');
  expect(groups[1]).not.toHaveAttribute('inert');
  expect(strip.textContent).not.toMatch(/ISHDASIZ|ishdasiz/);
});
it("has no animation stop buttons", () => {
  const view = render(<HeroSection />);
  expect(view.container.querySelector('.poster-pause,.poster-ticker-pause')).toBeNull();
});
it("searches the whole country by default without inventing a region", () => {
  render(<HeroSection />);
  fireEvent.click(screen.getByRole("button", { name: "Найти работу" }));
  expect(mockPush).toHaveBeenCalledWith("/jobs");
});
it("keeps the database region ID and safely encodes the search", () => {
  render(
    <HeroSection
      regions={[{ id: 22, name_uz: "Toshkent", name_ru: "Ташкент" }]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Профессия или компания"), {
    target: { value: "  Бухгалтер & кассир  " },
  });
  fireEvent.change(screen.getByLabelText("Регион"), {
    target: { value: "22" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Найти работу" }));
  const url = new URL(mockPush.mock.calls[0][0], "https://example.com");
  expect(url.searchParams.get("q")).toBe("Бухгалтер & кассир");
  expect(url.searchParams.get("region")).toBe("22");
});
it("uses supplied counts and omits employer promotion", () => {
  render(
    <HeroSection
      stats={{ totalJobs: 24666, totalUsers: null, archivedJobs: 100, totalEmployers: 24 }}
    />,
  );
  expect(screen.queryByText("24 666")).not.toBeInTheDocument();
  expect(screen.getByText("24 766")).toBeInTheDocument();
  expect(screen.queryByText("24")).not.toBeInTheDocument();
  expect(screen.queryByText("Работодатели")).not.toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
});
it("shows only the combined total without current/archive breakdown and counts registered users", () => {
  const view = render(<HeroSection stats={{ totalJobs: 111, archivedJobs: 222, totalUsers: 614 }} />);
  expect(view.container.querySelector('.poster-job-count')).toHaveTextContent('333');
  expect(view.container.querySelector('.poster-job-breakdown')).not.toBeInTheDocument();
  expect(screen.queryByText(/актуальных|в архиве/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '333 вакансий за всё время' })).toHaveAttribute('href', '/jobs');
  const stats = screen.getByLabelText('Вакансии и пользователи');
  expect(stats).toHaveTextContent('ПОЛЬЗОВАТЕЛИ1 228');
  expect(stats).toContainElement(screen.getByRole('link', { name: '333 вакансий за всё время' }));
  expect(view.container.querySelector('.poster-search-card')).toContainElement(stats);
  expect(screen.queryByText(/резюме людей/)).not.toBeInTheDocument();
});
it("does not pretend a partial count is the combined total", () => {
  const view = render(<HeroSection stats={{ totalJobs: 111, archivedJobs: null, totalUsers: 614 }} />);
  expect(view.container.querySelector('.poster-job-count strong')).toHaveTextContent('—');
  expect(view.container.querySelector('.poster-job-breakdown')).not.toBeInTheDocument();
});

it("opens the selected profession without navigating and restarts the cycle timer", () => {
  jest.useFakeTimers();
  try {
    render(<HeroSection />);
    fireEvent.click(screen.getByRole("button", { name: "Врач", exact: true }));
    expect(document.querySelector('.poster-word')).toHaveTextContent('Врач');
    expect(document.querySelector('.poster-profession-tag')).not.toBeInTheDocument();
    act(() => jest.advanceTimersByTime(6000));
    expect(
      screen.getByRole("button", { name: "Врач", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Вакансии в медицине" }),
    ).toHaveAttribute(
      "href",
      "/jobs?category=a0000005-0005-4000-8000-000000000005",
    );
  } finally {
    jest.useRealTimers();
  }
});
it.each([
  ["Учитель", "Вакансии в образовании", "a0000004-0004-4000-8000-000000000004"],
  [
    "Строитель",
    "Вакансии в строительстве",
    "a0000007-0007-4000-8000-000000000007",
  ],
  ["Врач", "Вакансии в медицине", "a0000005-0005-4000-8000-000000000005"],
  ["Программист", "Вакансии в IT", "a0000001-0001-4000-8000-000000000001"],
])(
  "%s links to its real catalog category with the selected region",
  (profession, action, category) => {
    render(
      <HeroSection
        regions={[{ id: 22, name_uz: "Toshkent", name_ru: "Ташкент" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Регион"), {
      target: { value: "22" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: profession, exact: true }),
    );
    expect(document.querySelector('.poster-word')).toHaveTextContent(profession);
    expect(
      screen.getByRole("link", { name: action, exact: true }),
    ).toHaveAttribute("href", `/jobs?category=${category}&region=22`);
  },
);
it("automatically cycles through all eight professions", () => {
  jest.useFakeTimers();
  try {
    render(<HeroSection />);
    for (const name of ["Строитель", "Врач", "Программист", "Повар", "Швея", "Водитель", "Продавец", "Учитель"]) {
      act(() => jest.advanceTimersByTime(7000));
      expect(screen.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
    }
  } finally { jest.useRealTimers(); }
});
it("the chef search keeps its keyword and the selected region", () => {
  render(
    <HeroSection
      regions={[{ id: 22, name_uz: "Toshkent", name_ru: "Ташкент" }]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Регион"), {
    target: { value: "22" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Повар", exact: true }));
  expect(screen.getByRole("link", { name: "Вакансии повара" })).toHaveAttribute(
    "href",
    "/jobs?category=a0000003-0003-4000-8000-000000000003&q=oshpaz&region=22",
  );
});
it("respects reduced motion and allows manual profession selection", () => {
  jest.useFakeTimers();
  try {
    mockReducedMotion.mockReturnValue(true);
    const view = render(<HeroSection />);
    expect(view.container.querySelector('.poster-hero')).toHaveAttribute('data-playing', 'false');
    expect(view.container.querySelector('.poster-ticker')).toHaveAttribute('data-paused', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Водитель', exact: true }));
    act(() => jest.advanceTimersByTime(14000));
    expect(screen.getByRole('button', { name: 'Водитель', exact: true })).toHaveAttribute('aria-pressed', 'true');
  } finally { jest.useRealTimers(); }
});
it.each([['Швея', 'Вакансии швеи', 'tikuvchi'], ['Водитель', 'Вакансии водителя', 'haydovchi'], ['Продавец', 'Вакансии продавца', 'sotuvchi']])('%s links to real jobs by keyword', (name, action, query) => {
  render(<HeroSection />);
  fireEvent.click(screen.getByRole('button', { name, exact: true }));
  expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', `/jobs?q=${query}`);
});

it('provides bot, channel and the supplied support link in one Telegram panel', () => {
  render(<HeroSection />);
  const panel = screen.getByRole('region', { name: 'ISHDASIZ в Telegram' });
  const links = within(panel).getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    'https://t.me/ishdasizbot', 'https://t.me/ishdasiz', 'https://t.me/ishdasiz_admin',
  ]);
  for (const link of links) {
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  expect(panel).toHaveTextContent('В Telegram найти работу проще');
});
it('connects the animation to the focused destination and lets the hub cycle all three links', () => {
  render(<HeroSection />);
  const panel = screen.getByRole('region', { name: 'ISHDASIZ в Telegram' });
  const support = within(panel).getByRole('link', { name: /Поддержка/ });
  fireEvent.focus(support);
  expect(panel).toHaveAttribute('data-active', 'support');
  const hub = within(panel).getByRole('button', { name: 'Переключить Telegram-ссылку' });
  for (const id of ['bot', 'channel', 'support']) {
    fireEvent.click(hub);
    expect(panel).toHaveAttribute('data-active', id);
  }
  expect(mockPush).not.toHaveBeenCalled();
});
it.each([false, true])('Telegram auto selection respects visibility and reduced motion (%s)', (reduced) => {
  jest.useFakeTimers();
  const originalObserver = window.IntersectionObserver;
  let notify: IntersectionObserverCallback;
  window.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
    notify = callback;
    return { observe: jest.fn(), disconnect: jest.fn() };
  }) as unknown as typeof IntersectionObserver;
  try {
    mockReducedMotion.mockReturnValue(reduced);
    render(<HeroTelegramLink />);
    const panel = screen.getByRole('region', { name: 'ISHDASIZ в Telegram' });
    const visibility = (isIntersecting: boolean) => act(() => notify([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
    visibility(true);
    act(() => jest.advanceTimersByTime(4800));
    expect(panel).toHaveAttribute('data-active', reduced ? 'bot' : 'channel');
    visibility(false);
    act(() => jest.advanceTimersByTime(9600));
    expect(panel).toHaveAttribute('data-active', reduced ? 'bot' : 'channel');
    expect(panel).toHaveAttribute('data-running', 'false');
  } finally {
    window.IntersectionObserver = originalObserver;
    jest.useRealTimers();
  }
});
