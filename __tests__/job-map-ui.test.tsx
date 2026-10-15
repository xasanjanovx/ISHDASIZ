import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MapPage from "@/app/map/page";
import { jobMapQuery, JOB_MAP_FIELDS } from "@/lib/job-map-query";
const mockRead = jest.fn();
const mockRange = jest.fn();
jest.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ lang: "ru", t: { map: { title: "Карта вакансий" } } }),
}));
jest.mock("@/components/map/job-map", () => ({
  JobMap: ({ jobs }: any) => (
    <div aria-label="Точки карты">
      {jobs.map((job: any) => (
        <span key={job.id}>{job.title_ru}</span>
      ))}
    </div>
  ),
}));
jest.mock("@/components/jobs/job-card", () => ({ JobCard: () => null }));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const query: any = {
        select: () => query,
        eq: () => query,
        gte: () => query,
        lte: () => query,
        order: () => query,
        range: (...args: any[]) => {
          mockRange(...args);
          return query;
        },
        abortSignal: (signal: AbortSignal) => mockRead(signal),
      };
      return query;
    },
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockRead.mockReset();
});
it("requests public card fields and coordinates without source payloads or ownership", () => {
  expect(JOB_MAP_FIELDS).toContain("latitude,longitude,address");
  expect(JOB_MAP_FIELDS).toContain("title_ru");
  expect(JOB_MAP_FIELDS).not.toMatch(
    /\*|raw_source|user_id|employer_id|created_by/,
  );
});
it("keeps valid coordinate boundaries and stable second-page ordering", () => {
  const query: any = {};
  for (const method of ["select", "eq", "gte", "lte", "order", "range"])
    query[method] = jest.fn(() => query);
  jobMapQuery({ from: jest.fn(() => query) } as any, 1);
  expect(query.range).toHaveBeenCalledWith(100, 199);
  expect(query.eq).toHaveBeenCalledWith("ishdasiz_job_available", true);
  expect(query.gte.mock.calls).toEqual([
    ["latitude", -90],
    ["longitude", -180],
  ]);
  expect(query.lte.mock.calls).toEqual([
    ["latitude", 90],
    ["longitude", 180],
  ]);
  expect(query.order.mock.calls).toEqual([
    ["created_at", { ascending: false }],
    ["id", { ascending: false }],
  ]);
});
it("shows source counts, retains loaded points on paging failure and retries the same page", async () => {
  mockRead
    .mockResolvedValueOnce({
      data: [{ id: "one", title_ru: "Учитель" }],
      count: 3,
      error: null,
    })
    .mockResolvedValueOnce({
      data: null,
      count: null,
      error: { code: "57014" },
    })
    .mockResolvedValueOnce({
      data: [
        { id: "one", title_ru: "Учитель" },
        { id: "two", title_ru: "Врач" },
      ],
      count: 3,
      error: null,
    });
  render(<MapPage />);
  await screen.findByText("Загружено 1 из 3 вакансий");
  fireEvent.click(screen.getByRole("button", { name: "Загрузить ещё" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Учитель")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  await screen.findByText("Загружено 2 из 3 вакансий");
  expect(mockRange.mock.calls).toEqual([
    [0, 99],
    [100, 199],
    [100, 199],
  ]);
});
it("never reports an initial failed load as zero available jobs and aborts on unmount", async () => {
  mockRead.mockResolvedValue({
    data: null,
    count: null,
    error: { code: "57014" },
  });
  const view = render(<MapPage />);
  await screen.findByText("Вакансии временно недоступны");
  expect(screen.queryByText(/Загружено 0/)).not.toBeInTheDocument();
  view.unmount();
  await waitFor(() => expect(mockRead.mock.calls[0][0].aborted).toBe(true));
});
