import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { HeroSection } from "@/components/home/hero-section";
const mockPush = jest.fn();
const mockReducedMotion = jest.fn(() => false);
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ lang: "ru" }),
}));
jest.mock("framer-motion", () => ({
  useReducedMotion: () => mockReducedMotion(),
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
  expect(within(strip).getAllByRole("link")).toHaveLength(8);
  expect(within(strip).getByRole("link", { name: /Telegram-канале — @ishdasiz/ })).toHaveAttribute("href", "https://t.me/ishdasiz");
  expect(within(strip).getByRole("link", { name: "Находите вакансии рядом на карте" })).toHaveAttribute("href", "/map");
  expect(within(strip).getByRole("link", { name: "Ищите по профессии и региону" })).toHaveAttribute("href", "/jobs");
  expect(strip.querySelectorAll('a[tabindex="-1"]')).toHaveLength(8);
  const groups = strip.querySelectorAll('.poster-ticker-group');
  expect(groups[0].textContent).toBe(groups[1].textContent);
  expect(groups[1]).toHaveAttribute('aria-hidden', 'true');
  expect(groups[1]).not.toHaveAttribute('inert');
});
it("pauses the ticker independently without stopping the profession carousel", () => {
  jest.useFakeTimers();
  try {
    render(<HeroSection />);
    const strip = screen.getByRole('region', { name: 'О сайте и Telegram-канале' });
    fireEvent.click(screen.getByRole('button', { name: 'Приостановить бегущую строку' }));
    expect(strip).toHaveAttribute('data-paused', 'true');
    act(() => jest.advanceTimersByTime(7000));
    expect(screen.getByRole('button', { name: 'Строитель', exact: true })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить бегущую строку' }));
    expect(strip).toHaveAttribute('data-paused', 'false');
  } finally { jest.useRealTimers(); }
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
      stats={{ totalJobs: 24666, totalResumes: null, totalEmployers: 24 }}
    />,
  );
  expect(screen.getByText("24 666")).toBeInTheDocument();
  expect(screen.queryByText("24")).not.toBeInTheDocument();
  expect(screen.queryByText("Работодатели")).not.toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
});

it("preserves a manually selected profession without automatic navigation", () => {
  jest.useFakeTimers();
  try {
    render(<HeroSection />);
    fireEvent.click(screen.getByRole("button", { name: "Врач", exact: true }));
    act(() => jest.advanceTimersByTime(14000));
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
    expect(
      screen.getByRole("link", { name: action, exact: true }),
    ).toHaveAttribute("href", `/jobs?category=${category}&region=22`);
  },
);
it("automatically cycles through all five professions and can pause", () => {
  jest.useFakeTimers();
  try {
    render(<HeroSection />);
    for (const name of [
      "Строитель",
      "Врач",
      "Программист",
      "Повар",
      "Учитель",
    ]) {
      act(() => jest.advanceTimersByTime(7000));
      expect(screen.getByRole("button", { name, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Приостановить смену профессий" }),
    );
    act(() => jest.advanceTimersByTime(7000));
    expect(
      screen.getByRole("button", { name: "Учитель", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      screen.getByRole("button", { name: "Включить смену профессий" }),
    );
    act(() => jest.advanceTimersByTime(7000));
    expect(
      screen.getByRole("button", { name: "Строитель", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  } finally {
    jest.useRealTimers();
  }
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
it("respects reduced motion while keeping manual profession selection available", () => {
  mockReducedMotion.mockReturnValue(true);
  render(<HeroSection />);
  expect(
    screen.getByRole("button", { name: "Включить смену профессий" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Программист", exact: true }),
  );
  expect(
    screen.getByRole("button", { name: "Программист", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
