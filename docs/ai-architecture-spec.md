# ISHDASIZ AI Architecture Specification

## 1. РЕКОМЕНДУЕМАЯ АРХИТЕКТУРА

### Pipeline: 4 шага с 1 моделью (gemini-2.5-flash)

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP A: Intent + Profile Extraction                             │
│ ─────────────────────────────────────                           │
│ Input: user_message + current_profile                           │
│ Output: JSON { intent, profile_updates, next_question }         │
│ LLM: gemini-2.5-flash, temp=0.1, max_tokens=400                │
│ Time: ~500ms                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP B: Supabase Query Builder (NO LLM)                         │
│ ─────────────────────────────────────                           │
│ Rules-based: profile → SQL filters                              │
│ category_id → eq(), region_id → eq(), salary → gte()           │
│ keywords → ilike() OR fulltext                                  │
│ LIMIT 30, ORDER BY salary_max DESC                             │
│ Time: ~100ms                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP C: Post-filter + Rerank                                    │
│ ─────────────────────────────                                   │
│ Input: user_profile + top_30_jobs (compact)                     │
│ Output: JSON { ranked_jobs[], excluded[], summary }             │
│ LLM: gemini-2.5-flash, temp=0.2, max_tokens=600                │
│ Time: ~1000ms                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP D: Response Composer (NO LLM)                              │
│ ─────────────────────────────                                   │
│ Template-based response in UZ/RU                                │
│ Attach ranked_jobs with reason_fit                              │
│ Time: ~10ms                                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Правило: Когда вызывать LLM

| Ситуация | Step A | Step B | Step C |
|----------|--------|--------|--------|
| Первое сообщение | ✓ | ✗ | ✗ |
| Уточняющий вопрос | ✓ | ✗ | ✗ |
| Полный профиль | ✓ | ✓ | ✓ |
| "bu emas" feedback | ✓ | ✓ | ✓ |
| "yana ko'rsat" | ✗ | ✓ | ✗ |

---

## 2. ДИАГРАММА ПОТОКА (ASCII)

```
                    ┌──────────────┐
                    │ User Message │
                    └──────┬───────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ [A] LLM: Intent + Profile Extraction                         │
│     "menga IT kerak Andijon 3mln" → { intent: search,        │
│       profile: {category: IT, region: Andijon, salary: 3M} } │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
              ┌────────────┴────────────┐
              │ intent == "search" ?    │
              └────────────┬────────────┘
            NO ↓                        ↓ YES
┌─────────────────────┐     ┌─────────────────────────────────┐
│ Return Question     │     │ [B] Build SQL Query              │
│ (next_question)     │     │     WHERE category_id = X        │
└─────────────────────┘     │           AND region_id = Y      │
                            │           AND salary_max >= Z    │
                            │     LIMIT 30                     │
                            └──────────────┬──────────────────┘
                                           ↓
                            ┌──────────────────────────────────┐
                            │ jobs.length > 0 ?                │
                            └──────────────┬───────────────────┘
                          NO ↓                              ↓ YES
               ┌─────────────────────┐      ┌─────────────────────────┐
               │ "Topilmadi" message │      │ [C] LLM: Rerank + Explain│
               └─────────────────────┘      │     Filter: IT ≠ shifokor│
                                            │     Rank by match_score  │
                                            │     Add reason_fit       │
                                            └────────────┬────────────┘
                                                         ↓
                                            ┌─────────────────────────┐
                                            │ [D] Compose Response    │
                                            │     "8 ta vakansiya..." │
                                            └─────────────────────────┘
```

---

## 3. ПРОМПТЫ

### STEP A: Intent + Profile Extraction

```
SYSTEM PROMPT (temp=0.1, max_tokens=400):

Sen ISHDASIZ portalining AI assistentisan. Foydalanuvchi xabarini tahlil qilib, JSON qaytar.

VAZIFA:
1. Xabardan intent aniqlash
2. Profile ma'lumotlarini ajratib olish
3. Yetishmayotgan ma'lumotlarni aniqlash

INTENT TURLARI:
- search: Ish qidirish (soha yoki keyword aniqlangan)
- clarify: Ma'lumot yetmaydi, savol kerak
- feedback: "bu emas", "mos kelmadi" — noto'g'ri natijalar
- refine: "masofaviy", "3 mln" — filtr qo'shish
- greeting: Salomlashish

KATEGORIYALAR:
- it: dasturchi, developer, programmer, frontend, backend, web, mobile, kompyuter
- savdo: sotuvchi, kassir, sales, merchandiser, konsultant
- transport: haydovchi, kurier, yuk, taksi, logist
- tibbiyot: shifokor, hamshira, doctor, nurse, farmacevt
- talim: o'qituvchi, ustoz, teacher, repetitor
- qurilish: ishchi, usta, elektrik, santexnik, builder
- moliya: buxgalter, accountant, bank, hisobchi
- xizmat: oshpaz, ofitsiant, waiter, cook, farrosh, qorovul
- ishlab: operator, zavod, fabrika, texnik

HUDUDLAR: Toshkent, Andijon, Samarqand, Buxoro, Farg'ona, Namangan, Xorazm, Jizzax, Sirdaryo, Surxondaryo, Qashqadaryo, Navoiy

JSON FORMAT:
{
  "intent": "search|clarify|feedback|refine|greeting",
  "confidence": 0.0-1.0,
  "profile_updates": {
    "category_key": "it|savdo|transport|...|null",
    "region_name": "Toshkent|Andijon|null",
    "salary_min": 3000000,
    "experience_level": "junior|mid|senior|null",
    "work_mode": "remote|onsite|hybrid|any|null",
    "is_student": true|false|null,
    "gender": "male|female|null",
    "keywords": ["react", "frontend"],
    "exclude_keywords": ["tikuvchi"]
  },
  "missing_info": ["region", "salary"],
  "next_question": "Qaysi shaharda ishlashni xohlaysiz?",
  "feedback_type": "wrong_category|low_salary|wrong_region|null"
}

QOIDALAR:
1. Agar soha ANIQ bo'lsa → intent=search
2. Faqat "salom" yoki "ish kerak" → intent=clarify, next_question so'ra
3. "bu emas" → intent=feedback, feedback_type belgilash
4. "masofaviy", "3 mln", "erkak" → intent=refine
5. Bir xabarda ko'p ma'lumot bo'lsa, hammasini ajrat

Faqat JSON qaytar, boshqa hech narsa yo'q.
```

### STEP C: Rerank + Explain

```
SYSTEM PROMPT (temp=0.2, max_tokens=600):

Sen HR mutaxassisisisan. Vakansiyalarni foydalanuvchi profiliga solishtirib, eng moslarini tanla.

VAZIFA:
1. Har bir vakansiyani profil bilan taqqosla
2. Noto'g'ri kategoriyalarni CHIQARIB TASHLA
3. TOP 5-8 eng mos vakansiyalarni tanla
4. Har biriga qisqa tushuntirish yoz

NOTO'G'RI KATEGORIYALAR QOIDASI:
- IT so'ralgan → shifokor, hamshira, tikuvchi, oshpaz, haydovchi, o'qituvchi CHIQAR
- Haydovchi so'ralgan → dasturchi, shifokor, tikuvchi CHIQAR
- Sotuvchi so'ralgan → dasturchi, shifokor CHIQAR

JSON FORMAT:
{
  "summary": "8 ta mos vakansiya topildi, eng yuqori maoshlilarini ko'rsataman",
  "ranked_jobs": [
    {
      "idx": 1,
      "match_score": 85,
      "reason_fit": "React bilimingiz bor, bu vakansiyada ham kerak",
      "missing_skills": ["ingliz tili"],
      "advice": "Suhbatda portfolio ko'rsating"
    }
  ],
  "excluded_count": 5,
  "excluded_reason": "Tibbiyot vakansiyalari IT profiliga mos emas"
}

QOIDALAR:
1. match_score: 0-100, 70+ = yaxshi mos
2. reason_fit: 1-2 gap, aniq va foydali
3. missing_skills: profilga nisbatan yetishmayotgan skilllar
4. advice: ixtiyoriy, faqat foydali bo'lsa

Faqat JSON qaytar.
```

---

## 4. JSON SCHEMAS

### UserProfile (Session State)

```typescript
interface UserProfile {
  // Stage
  stage: 'profiling' | 'searching' | 'refining';
  
  // Core data
  category_id: string | null;
  category_key: string | null;  // it, savdo, transport, etc.
  region_id: number | null;
  region_name: string | null;
  
  // Filters
  salary_min: number | null;
  work_mode: 'remote' | 'onsite' | 'hybrid' | 'any' | null;
  experience_level: 'junior' | 'mid' | 'senior' | null;
  is_student: boolean | null;
  gender: 'male' | 'female' | null;
  
  // Skills
  keywords: string[];
  skills: string[];
  exclude_keywords: string[];
  
  // Meta
  missing_info: string[];  // ['region', 'salary']
  history: string[];
  last_job_ids: number[];
  search_count: number;
}
```

### Step A Output

```typescript
interface StepAOutput {
  intent: 'search' | 'clarify' | 'feedback' | 'refine' | 'greeting';
  confidence: number;  // 0.0-1.0
  
  profile_updates: Partial<UserProfile>;
  
  missing_info: string[];  // What's still needed
  next_question: string | null;  // UZ question text
  
  feedback_type: 'wrong_category' | 'low_salary' | 'wrong_region' | null;
}
```

### Step C Output

```typescript
interface StepCOutput {
  summary: string;
  
  ranked_jobs: Array<{
    idx: number;          // Index in input array (1-based)
    match_score: number;  // 0-100
    reason_fit: string;   // UZ explanation
    missing_skills: string[];
    advice: string | null;
  }>;
  
  excluded_count: number;
  excluded_reason: string;
}
```

### Final API Response

```typescript
interface ChatResponse {
  response: string;  // Human-readable message
  
  jobs: Array<Job & {
    match_score?: number;
    reason_fit?: string;
    missing_skills?: string[];
    advice?: string;
  }>;
  
  intent: string;
  profile: UserProfile;
  total_found: number;
  
  next_question?: string;
  suggestions?: string[];
}
```

---

## 5. КАК СОБИРАТЬ ПРОФИЛЬ

### Минимальный набор вопросов (3-5)

| # | Поле | Вопрос (UZ) | Обязательно? |
|---|------|-------------|--------------|
| 1 | category | "Qaysi sohada ish qidiryapsiz?" | ДА |
| 2 | region | "Qaysi shaharda ishlashni xohlaysiz?" | НЕТ |
| 3 | salary_min | "Minimal qancha oylik kutasiz?" | НЕТ |
| 4 | work_mode | "Ofisda yoki masofaviy?" | НЕТ |
| 5 | experience | "Qancha ish tajribangiz bor?" | НЕТ |

### Правило "достаточно информации"

```javascript
function canSearch(profile) {
  // MUST have category OR keywords
  const hasCategory = !!profile.category_id;
  const hasKeywords = profile.keywords?.length > 0;
  
  return hasCategory || hasKeywords;
}

function shouldAskMore(profile) {
  // Ask region only if NOT remote
  if (!profile.region_id && profile.work_mode !== 'remote') {
    return { field: 'region', question: "Qaysi shaharda?" };
  }
  
  // Don't ask too many questions - max 2 before search
  if (profile.questions_asked >= 2) {
    return null;
  }
  
  return null;
}
```

### Feedback Handling ("bu emas")

```javascript
function handleFeedback(profile, feedbackType) {
  switch (feedbackType) {
    case 'wrong_category':
      // Add to exclude list
      profile.exclude_keywords.push(...getExcludeKeywords(profile.category_key));
      // Re-search with exclusions
      break;
      
    case 'low_salary':
      // Increase salary threshold by 50%
      profile.salary_min = (profile.salary_min || 2000000) * 1.5;
      break;
      
    case 'wrong_region':
      // Clear region, ask again
      profile.region_id = null;
      return { question: "Boshqa qaysi shaharda qidiraylik?" };
  }
}
```

---

## 6. РЕЛЕВАНТНОСТЬ БЕЗ ДОРОГИХ ВЫЗОВОВ

### Стратегия: DB → Local Filter → LLM Rerank

```
Step 1: DB Query (LIMIT 30)
     ↓
Step 2: Local Blacklist Filter (remove 10-15)
     ↓
Step 3: LLM Rerank (TOP 15 → TOP 8)
```

### IT Whitelist/Blacklist

```javascript
const IT_WHITELIST = [
  'dasturchi', 'developer', 'programmer', 'frontend', 'backend',
  'fullstack', 'devops', 'QA', 'tester', 'web', 'mobile', 'react',
  'vue', 'angular', 'node', 'python', 'java', 'javascript', 'typescript',
  'android', 'ios', 'flutter', 'designer', 'UI', 'UX', 'figma',
  'data', 'analyst', 'ML', 'AI', 'system admin', 'network', 'database'
];

const IT_BLACKLIST = [
  'shifokor', 'hamshira', 'doctor', 'nurse', 'tikuvchi', 'tailor',
  'oshpaz', 'cook', 'haydovchi', 'driver', 'sotuvchi', 'seller',
  'kassir', 'qorovul', 'guard', 'farrosh', 'cleaner', 'o\'qituvchi',
  'teacher', 'tarbiyachi'
];

function localFilterIT(jobs) {
  return jobs.filter(job => {
    const title = (job.title_uz || job.title_ru || '').toLowerCase();
    // Exclude if title contains blacklist word
    if (IT_BLACKLIST.some(word => title.includes(word))) return false;
    // Include if title contains whitelist word OR category is IT
    return job.category_id === IT_CATEGORY_ID || 
           IT_WHITELIST.some(word => title.includes(word));
  });
}
```

### Когда использовать description vs title

| Ситуация | Title | Description | Requirements |
|----------|-------|-------------|--------------|
| DB Query | ✓ ilike | ✗ | ✗ |
| Local Filter | ✓ | ✗ | ✗ |
| LLM Rerank | ✓ | ✓ (first 100 chars) | ✓ (first 100 chars) |

---

## 7. ОПТИМИЗАЦИЯ ТОКЕНОВ И СКОРОСТИ

### Кэширование

```javascript
// Cache 1: Query → Profile extraction (5 min TTL)
const extractionCache = new Map();

// Cache 2: Profile hash → Job IDs (2 min TTL)
const searchCache = new Map();

// Cache 3: Job ID → Compact representation
const jobSnippetCache = new Map();

function getProfileHash(profile) {
  return `${profile.category_id}:${profile.region_id}:${profile.salary_min}:${profile.work_mode}`;
}
```

### Compact Job Representation for LLM

```javascript
function compactJob(job) {
  return {
    idx: job.idx,
    title: job.title_uz || job.title_ru,
    company: job.company_name || 'Nomalum',
    salary: `${(job.salary_min/1e6).toFixed(1)}-${(job.salary_max/1e6).toFixed(1)} mln`,
    region: job.region_name?.slice(0, 15) || '',
    // Only first 100 chars of requirements
    req: (job.requirements_uz || '').slice(0, 100)
  };
}

// Before: 2000 tokens per job
// After: 100 tokens per job
```

### Speed Optimization

| Техника | Время | Описание |
|---------|-------|----------|
| Parallel calls | -500ms | Step A и DB query параллельно (если profile ready) |
| Compact jobs | -300ms | 100 токенов vs 2000 на вакансию |
| Local filter | -200ms | Убираем явно нерелевантные до LLM |
| Limit 15 to LLM | -400ms | Step C получает только 15 вакансий |
| Low temperature | -100ms | temp=0.1 для Step A (детерминированный) |

### Итоговое время

```
Step A: 500ms (LLM)
Step B: 100ms (DB)
Step C: 1000ms (LLM, 15 jobs)
Step D: 10ms (template)
────────────────
TOTAL: ~1.6 секунды
```

---

## 8. ПРИМЕРЫ ДИАЛОГОВ

### Пример 1: Полный профиль сразу

```
USER: "menga IT ish kerak Andijon, tajriba yo'q, 3 mln, masofaviy"

STEP A OUTPUT:
{
  "intent": "search",
  "confidence": 0.95,
  "profile_updates": {
    "category_key": "it",
    "region_name": "Andijon",
    "salary_min": 3000000,
    "work_mode": "remote",
    "experience_level": "junior"
  },
  "missing_info": [],
  "next_question": null
}

STEP B: SQL Query
SELECT * FROM jobs 
WHERE category_id = 'IT-UUID' 
  AND region_id = 2 
  AND salary_max >= 3000000 
  AND work_mode = 'remote'
ORDER BY salary_max DESC
LIMIT 30

STEP C: Rerank (5 jobs found, 3 after IT filter)
{
  "summary": "Andijondan 3 ta masofaviy IT vakansiya topildi",
  "ranked_jobs": [
    {"idx": 1, "match_score": 88, "reason_fit": "Junior uchun mos, React o'rgatishadi"},
    {"idx": 2, "match_score": 75, "reason_fit": "Maosh yuqori, lekin tajriba so'raladi"}
  ]
}

RESPONSE:
"IT sohasi, Andijon viloyati, masofaviy, 3+ mln

3 ta vakansiya topildi:

1. Junior Frontend Developer - TechCo
   ✓ Junior uchun mos, React o'rgatishadi
   Maosh: 3-5 mln

2. ..."
```

### Пример 2: Feedback "bu emas"

```
USER: [after seeing results] "bu emas, bular IT emas"

STEP A OUTPUT:
{
  "intent": "feedback",
  "confidence": 0.9,
  "feedback_type": "wrong_category",
  "profile_updates": {
    "exclude_keywords": ["operator", "zavod"]
  },
  "next_question": null
}

ACTION: 
1. Add exclude_keywords to profile
2. Re-run search with exclusions
3. Local filter more aggressively

RESPONSE:
"Tushunarli. Faqat IT vakansiyalarni ko'rsataman.

[New filtered results...]"
```

### Пример 3: Короткое уточнение

```
USER: "erkak kishi uchun"

STEP A OUTPUT:
{
  "intent": "refine",
  "confidence": 0.85,
  "profile_updates": {
    "gender": "male"
  },
  "missing_info": [],
  "next_question": null
}

ACTION:
- Update profile.gender = 'male'
- Re-run search (Note: gender filter typically in raw_source_json)
- If no gender field in DB, filter in Step C by checking requirements text

RESPONSE:
"Erkaklar uchun vakansiyalarni ko'rsataman.

[Filtered results...]"
```

---

## QISQACHA XULOSA

| Komponent | Texnologiya | Vaqt |
|-----------|-------------|------|
| Step A | gemini-2.5-flash, temp=0.1 | 500ms |
| Step B | Supabase SQL | 100ms |
| Step C | gemini-2.5-flash, temp=0.2 | 1000ms |
| Step D | Template | 10ms |
| **JAMI** | | **~1.6s** |

### Kalit qoidalar:

1. **Bitta model** — gemini-2.5-flash
2. **2 ta LLM call** — extraction + rerank
3. **Local filter** — IT blacklist before LLM
4. **Compact jobs** — 100 tokens per job
5. **Cache** — profile hash → job IDs
6. **Intent-driven** — search only when profile ready
