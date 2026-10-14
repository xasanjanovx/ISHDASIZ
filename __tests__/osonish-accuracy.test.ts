/** @jest-environment node */
import { transformDetail, type OsonishDetail } from "@/lib/scrapers/osonish";
import {
  parseOsonishConfigs,
  fetchOsonishConfigs,
} from "@/lib/scrapers/osonish-config";
import { publicJobDetail } from "@/lib/public-job";
import { getJobWorkMode } from "@/lib/work-mode";
import { getMappedValue, getEducationLabel } from "@/lib/mappings";

const sourceConfigs = [
  {
    code: "work_experience_list",
    value: [
      { id: 1, name: "Talab etilmaydi" },
      { id: 2, name: "1 yilgacha" },
      { id: 3, name: "1-3 yil" },
      { id: 4, name: "3-5 yil" },
      { id: 5, name: "5 yildan ortiq" },
    ],
  },
  {
    code: "work_type_list",
    value: [
      { id: 1, name: "Odatiy (ish joyida)" },
      { id: 2, name: "Smenali ish" },
      { id: 3, name: "Masofaviy" },
      { id: 4, name: "Gibrid (ish joyi + masofaviy)" },
      { id: 5, name: "Kasanachilik (uyda)" },
      { id: 6, name: "Ish joyi o‘zgaruvchan (mobil ishchi)" },
    ],
  },
  { code: "work_schedule_list", value: [{ id: 8, name: "2/2" }] },
  { code: "education_level_list", value: [{ id: 3, name: "Oliy(bakalavr)" }] },
];
const vacancy = (patch: Partial<OsonishDetail> = {}): OsonishDetail => ({
  id: 1,
  title: "Operator",
  status: 2,
  ...patch,
});
test("parses the current array config format and the older localized object format", () => {
  const parsed = parseOsonishConfigs(sourceConfigs);
  expect(parsed).toMatchObject({
    experience: { 3: "1-3 yil" },
    workMode: { 2: "Smenali ish" },
    education: { 3: "Oliy(bakalavr)" },
    schedule: { 8: "2/2" },
  });
  const old = sourceConfigs.map((x) => ({ ...x, value: { uz: x.value } }));
  expect(parseOsonishConfigs(old)).toEqual(parsed);
  expect(() =>
    parseOsonishConfigs([{ code: "work_type_list", value: [] }]),
  ).toThrow();
});
test("config requests have a bounded deadline, refresh cache and reuse it between detail batches", async () => {
  const original = global.fetch;
  const fetchMock = jest.fn(
    async () =>
      new Response(JSON.stringify({ success: true, data: sourceConfigs })),
  );
  global.fetch = fetchMock;
  try {
    expect(await fetchOsonishConfigs()).toMatchObject({
      workMode: { 2: "Smenali ish" },
    });
    await fetchOsonishConfigs();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      signal: expect.any(AbortSignal),
      cache: "no-store",
    });
  } finally {
    global.fetch = original;
  }
});
test.each([
  [1, "onsite"],
  [2, "onsite"],
  [3, "remote"],
  [4, "hybrid"],
  [5, "home"],
  [6, "onsite"],
  [99, null],
])(
  "work type %s has the same meaning with and without source config",
  (work_type, expected) => {
    expect(
      transformDetail(vacancy({ work_type: work_type as number })).work_mode,
    ).toBe(expected);
    expect(
      transformDetail(
        vacancy({ work_type: work_type as number }),
        parseOsonishConfigs(sourceConfigs),
      ).work_mode,
    ).toBe(expected);
  },
);
test.each([
  [1, 0],
  [2, 1],
  [3, 1],
  [4, 3],
  [5, 5],
  [99, undefined],
])(
  "experience code %s preserves the source requirement instead of an invented average",
  (work_experiance, expected) => {
    expect(transformDetail(vacancy({ work_experiance })).experience_years).toBe(
      expected,
    );
    expect(
      transformDetail(
        vacancy({ work_experiance }),
        parseOsonishConfigs(sourceConfigs),
      ).experience_years,
    ).toBe(expected);
  },
);
test("preserves source contacts and zero salaries without mutating the input", () => {
  const detail = vacancy({
    min_salary: 0,
    max_salary: 0,
    hr: { phone: "998998588698" } as any,
  });
  Object.freeze(detail.hr);
  Object.freeze(detail);
  expect(transformDetail(detail)).toMatchObject({
    salary_min: 0,
    salary_max: 0,
    contact_phone: "+998998588698",
    raw_source_json: { hr: { phone: "998998588698" } },
  });
});
test("public vacancy requirements include only approved source metadata and correct stale work-mode labels", () => {
  const projected = publicJobDetail({
    work_mode: "remote",
    raw_source_json: {
      work_type: 2,
      min_education: 3,
      private_token: "hidden",
      hr: { phone: "hidden" },
    },
  });
  expect(projected.raw_source_json).toMatchObject({
    work_type: 2,
    min_education: 3,
  });
  expect(projected.raw_source_json).not.toHaveProperty("private_token");
  expect(projected.raw_source_json).not.toHaveProperty("hr");
  expect(getJobWorkMode(projected)).toBe("onsite");
  expect(getEducationLabel(projected, "ru")).toBe("Высшее");
  expect(getMappedValue("working_days", 8, "ru")).toBe("2/2");
});

test('the imported experience range remains filterable using the original source code',async()=>{
 const {osonishJob}=await import('@/lib/import/osonish-job');
 const mapped=osonishJob(transformDetail(vacancy({work_experiance:3})),{regions:[],districts:[],categories:[]});
 expect(mapped).toMatchObject({experience:'3',experience_years:1,raw_source_json:{work_experiance:3}});
});
