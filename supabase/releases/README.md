# Обновление базы ISHDASIZ, октябрь 2026

Набор предназначен для существующей базы проекта с таблицами старой версии до апреля 2026. Это не установка с нуля. 10 октября 2026 выполнен аудит метаданных действующей базы через SQL Editor: 19 записей истории без повторов, новые функции отсутствуют. Полный отчёт: ../../docs/production-readiness-2026-10-10.md.

`2026-10-repair.json` задаёт точный порядок 40 миграций, зависимости и SHA-256 каждого файла. Все 40 уже применены (59 исторических версий); не повторять их или старый пакет. При подготовке исходного выпуска десять файлов получили уникальные 14-значные номера; прежние имена сохранены в `previousFilename`. Содержимое функций не менялось при переименовании.

Старая папка `supabase/migrations` содержит повторяющиеся номера и диагностические SQL. Нельзя выпускать её целиком через `db push` без сверки истории. Исторические файлы не переименованы: такое изменение может повторно запустить уже выполненный SQL.

## Локальные команды

Из корня сайта:

```sh
npm run test:db
npm run release:db:check
npm run release:db:prepare
```

Последняя команда создаёт в `.tmp/database-release/` отдельную папку с 40 проверенными миграциями, manifest, этим описанием, `audit.sql`, операционными SQL расписания и отчётом готовности. Она не читает `.env`, не подключается к Supabase, не применяет SQL и не изменяет историю миграций. Повреждённый или не включённый в manifest файл останавливает подготовку. Экспорт временный, его можно повторить из исходников.

## Перед применением на сервере

1. Снять резервную копию существующей базы и проверить восстановление на отдельной тестовой базе.
2. Запустить `audit.sql` из SQL editor и сопоставить схему, историю миграций и журналы прошлых публикаций. Запросы читают только метаданные и число конфликтов идентификаторов сообщений. В SQL editor нужно также посмотреть вкладку сообщений/NOTICE: там история миграций и число конфликтов. Пропущенные baseline-таблицы, несовместимые типы и конфликты требуют исправления плана. Проверка колонок охватывает ключевые зависимости, а не все возможные отличия живой схемы.
3. Проверить обе формы имени каждого переименованного файла. Если старое имя или его SQL уже применяли вручную, не считать новый номер основанием для повторного запуска: сначала сверить фактические изменения. Не помечать миграции выполненными без такой сверки.
4. На время обновления остановить старые bot workers, webhook и cron, которые пишут данные или напрямую публикуют сообщения. Выполнить набор сначала на восстановленной тестовой копии. Каждая миграция имеет собственную транзакцию; ошибка останавливает дальнейшее применение, но предыдущие транзакции уже могли завершиться. После ошибки сверить состояние, а не начинать весь набор вслепую.
5. Применить подтверждённые недостающие миграции в порядке manifest, затем выпустить совместимые сайт и бот. Старые версии после изменения прав запускать нельзя. Способ переноса в историю Supabase зависит от проверенного состояния проекта; автоматического `migration repair` здесь нет.
6. Повторить аудит прав, проверить вход, обязательное резюме, отклик, решения работодателя, закрытие/восстановление аккаунта и каналы тестовыми аккаунтами. Включить один транспорт бота и нужные фоновые задачи после проверки.

Интеграционный тест применяет все 29 настоящих SQL по порядку к синтетической старой схеме, затем повторяет набор. Он проверяет сохранность данных, права, отзыв сеансов, историю Telegram и итоговые триггеры. Он не заменяет прогон на копии живой базы.

Набор включает закрытую историю приглашений соискателя: доступ только через служебные RPC с проверкой владельца, роли и версии сеанса. Прямые публичные права на job_offers отозваны; истории и сообщения сохраняются. После выпуска проверить список, подробности, отметку прочтения и недоступную вакансию в обеих версиях бота и на сайте.

Набор также включает ishdasiz_web_application_action: веб-изменение статуса отклика проверяет аккаунт, текущего владельца и точную версию внутри транзакции. Сохраняются прежние варианты статуса сайта, в том числе возврат в ожидание. Для собеседования обязательна дата; интерфейс вводит и отображает время Узбекистана (UTC+5). Перед выпуском проверить передачу вакансии, одновременное изменение статуса и назначение собеседования.

Защищённое чтение ishdasiz_application_resume используется сайтом и обеими версиями бота. Оно выдаёт только активное резюме из конкретного отклика текущему работодателю, даже если резюме скрыто из публичного каталога. Архив, чужой владелец резюме, закрытый аккаунт или переданная вакансия отзывают доступ. При выпуске проверить этот сценарий тестовыми аккаунтами; опубликованность резюме и история отклика не меняются.

Отметка прочтения ishdasiz_application_seen используется сайтом и обеими версиями бота. Она проверяет открытый аккаунт, версию сеанса, профиль соискателя и владельца каждого отклика в одной транзакции. Совпасть должны исходный статус и точное время ответа, включая микросекунды. Новое решение остаётся непрочитанным; чужой или пропавший отклик отменяет весь пакет. Бот отправляет отметку только после подтверждённой доставки подробностей. При выпуске проверить одновременное изменение ответа, закрытие аккаунта, повтор отметки и сбой Telegram.


### Полное резюме из каталога

Миграция 20261010200000_catalog_resume_detail.sql включена в текущий набор. Она закрывает анонимное чтение полной строки resumes и предоставляет служебный RPC с проверкой аккаунта, эпохи сеанса, работодателя/владельца и текущей публичной доступности документа. Краткие карточки каталога остаются доступны через серверный поиск.

Выпускать вместе с обновлённой страницей /resumes/[id], GET /api/resumes/[id] и серверным счётчиком резюме на главной. Старая страница напрямую читает resumes и после миграции перестанет работать. Без функции новая страница сообщает временную недоступность и не обходит проверку доступом к таблице. Полные резюме исключены из sitemap, поскольку требуют аккаунт. Проверки тестируют весь набор из 38 миграций на старой синтетической схеме; аудит реальной базы остаётся обязательным.


### Переписка и повтор отправки

Миграция 20261010210000_chat_actions.sql включена перед обновлением форматов работы в набор из 38 файлов. Служебный RPC атомарно проверяет аккаунт/эпоху сеанса, роли, участников и состояние собеседника перед записью. UUID сообщения служит идентификатором повтора: одинаковый запрос не создаёт вторую запись, изменённый или чужой запрос отклоняется. Истории и предпочтения скрытия не удаляются.

Обновить вместе с API /api/account/chat и /api/account/chat/[id], Conversation и ChatList. Новая отправка требует request_id; прочтение/восстановление требуют role; скрытие передаёт role в URL. Прежние клиенты без этих полей получают 400 и должны перезагрузить страницу. Без RPC новый сервер сообщает временную недоступность и не делает прямые записи. Уже сохранённое сообщение можно повторно подтвердить при закрытом собеседнике, но новую запись сделать нельзя. Старая история остаётся доступна авторизованному участнику; закрывший свой аккаунт пользователь должен сначала восстановить вход.

### Формат работы и география поиска

Миграция 20261010220000_job_work_mode.sql добавляет чистое вычисляемое поле ishdasiz_job_work_mode(jobs). Оно одинаково распознаёт канонические значения, числовые коды 1–4 и старые русские/узбекские подписи. Явный офисный или гибридный формат имеет приоритет над старым employment_type=remote. Код 2 (работа из дома) остаётся отдельным форматом и автоматически не означает работу из любого региона.

Обновить вместе с lib/job-catalog.ts и обеими копиями Telegram-бота. Поиск региона/района включает явно удалённые вакансии всей страны; остальные условия и доступность публикации сохраняются. Физические агрегатные счётчики районов сохраняют прежний смысл места офиса. Функции SECURITY INVOKER не обходят RLS и не меняют данные; публичный фильтр доступности продолжает исключать скрытые объявления и закрытых владельцев. Без вычисляемого поля новый запрос сообщает ошибку загрузки. Рабочая база проверена, набор применён; текущее состояние описано ниже.


### Обнаруженные предпосылки и бесплатное расписание

Первая миграция 20261006080000_channel_prerequisites.sql создаёт отсутствующие в действующей базе sync_events, channel_posts и sync_worker_locks, сразу закрывая их для браузерных ролей. Повтор сохраняет квитанции и аренды, не заменяет новую реализацию блокировки и не устанавливает устаревшие триггеры. Отсутствующий post_to_channel добавляется последующей миграцией как NULL; bigint региона резюме сохраняется. Полный набор проверен на таком синтетическом варианте схемы.

Операционные install/activate/pause-channel-schedule.sql из supabase/operations идут отдельно от 40 миграций. Установка создаёт выключенное задание Supabase Cron; активация требует Vault и согласованного выпуска сайта/базы. Частое расписание удалено из Vercel Hobby, где оно не поддерживается. Порядок и реальные результаты аудита — в docs/production-readiness-2026-10-10.md (в экспорте production-readiness.md).


### Локальная копия перед применением

В экспорт включены database-backup.md и два PowerShell-скрипта в backup-tools для просмотра. Они не запускаются при подготовке релиза; программы PostgreSQL и реальные архивы сюда не включаются. Скрипты запускаются из исходного проекта через npm run backup:database / npm run test:backup. Переносимые PostgreSQL-инструменты находятся отдельно в .tmp/postgres-client-17.11. При ручном запуске копии скрипта из экспорта указывайте -PgBin явно. Настоящий прикладной архив получен и восстановлен; ограничения области и закрытое доказательство описаны в database-backup.md.

## Production follow-up — 12 October 2026

The initial 33 migrations were applied atomically and site PR #1 deployed. Five performance migrations through 20261012113500, the candidate protocol 20261012130000 and queue retention 20261012143000 are applied in Production (59 historical versions in total). Do not replay already applied migrations or the old atomic bundle. Confirm live history before any further change.

The final public vacancy predicate is a parsed SQL RETURN expression with SECURITY INVOKER, allowing scalar conditions to inline. Existing SECURITY DEFINER helpers retain private owner checks. The restrictive account policy skips those lookups only for ownerless imports. Function signatures, grants and publication rules remain compatible. Intermediate follow-ups remain in history because they were applied while diagnosing the live instance.

A covering partial index supports public catalog counters. The homepage uses one aggregate for total/category/special groups and fetches its six cards without an exact REST count. This removes the former per-category and special-count fan-out. The new aggregate exposes counts only.

Validation: 71 database tests including 726 legacy source/publication/owner combinations and account close/restore, seven homepage tests, TypeScript and production build pass. Native restoration retained all vacancy visibility and aggregate results. The native public RLS count took ~28 ms and the new home aggregate ~59 ms; these local measurements do not predict host timing. Live read-only checks after VACUUM (ANALYZE) jobs passed: home aggregate ~820 ms (24,666 available vacancies), category/district aggregate ~355 ms, full statistics ~2,370 ms including network. Public role timeout and the free service plan were not raised.

The site follow-up [PR #2](https://github.com/xasanjanovx/ISHDASIZ/pull/2) is merged and deployed: main 1635848 is Ready in Production and its rendered homepage contains six real cards and 24,666 vacancies. The bot webhook is configured at https://ishdasiz.uz/api/telegram/webhook with max_connections=1 and pending updates preserved. User SMS/bot checks and channel schedule activation remain separate release gates.

## Candidate import follow-up (deployed)

The live source changes totals during enumeration. Migration 20261012130000 introduces a v2 candidate queue rather than treating public pagination as a full snapshot. Existing v1 runs remain compatible. Current list IDs and valid existing imported source IDs receive explicit detail checks; overlap and total drift are accepted, malformed IDs and page bounds are rejected. Only confirmed active/filled/404 outcomes change individual job availability. Publication choices, manual fields, applications and closed accounts remain protected. Late arrivals outside the queue are untouched. Unavailable cards are retried and recorded as errors without preventing the remaining checks; the final run is failed if any details remain unavailable.

Daily Vercel cron starts the run. The protected continuation endpoint never creates a run, pins its ID, and stops for a live lease, delayed retry, no progress, terminal status, eight steps or its request budget. Supabase operations `install/activate/pause-import-schedule.sql` are independent of channel publication. Install is inactive and sends no HTTP. This migration is applied and PR #3 deployed as main 74d74f9 in ishdasiz-hp69. pg_cron/pg_net and the matching Vault credential are configured; import continuation is active every five minutes. Telegram publication remains disabled. The first live candidate queue has 48,038 IDs and is still being processed; its progress continued after the local runner and manual Production request ended.

## Queue retention and refresh cadence (applied)

Migration 20261012143000 was applied at 13:06:55 UTC on 12 October with an exact history check. Postflight confirmed 59 versions, the private helper and the unchanged active import schedule. The live run retained all 48,038 candidates and continued processing without errors. The migration archives the exact safe progress projection of at most one terminal v2 run per acquired lease after seven days, then removes only that run's temporary item rows. Checkpoints, request IDs, run history, counters and business records remain. Live, recent and v1 queues are preserved; retries of old request IDs still return the original terminal result. The archival helper and cached summaries remain private.

Public-list candidates always receive detail checks, including reappearing vacancies. Existing active/unchecked imported IDs are checked daily. Known IDs with a confirmed filled/removed result less than seven days old can wait until the next weekly check if absent from today's list; no absence cleanup occurs. This reduces repeated work after the initial refresh. Applying this migration does not shrink the existing live queue.

Validation: 78 database tests pass, including rollback on a cleanup failure, exact cached progress, request idempotence, private grants and refresh cadence. A native PostgreSQL rehearsal on the real restored archive archived 40,810 temporary items in a new claim (~26 ms), preserved the exact prior summary and all 40,812 jobs. These are local measurements under an 8-second statement budget.
