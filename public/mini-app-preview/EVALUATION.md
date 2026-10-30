# Самопроверка Discovery — 29 октября 2026

| Требование | Проверяемый результат |
| --- | --- |
| Убрать маленькие кнопки | На главной нет `.flow-intent`; две основные карточки ведут к нужным формам. |
| Переименовать карточки | «Xodim izlash» и «Ish topish», без повторных действий. |
| Профиль в один ряд | Профиль, объявления и заявки расположены рядом под картой. |
| Карта и числа | Интерактивный Ташкент, масштабирование и настоящие счётчики локальных записей; цифры не выданы за живую базу. |
| Первое окно через 3 секунды | Один показ, закрытие, правильная форма, без прерывания черновика и без постоянной роли. |
| Резюме в базе | Сохранение бесплатно; в интерфейсе нет отправки резюме на канал и оплаты резюме. |
| Доступ после публикации | До подтверждения видны только количества; карточки и контакты закрыты. |
| Только конкретная вакансия | Другая вакансия не получает доступ; изменение критериев отзывает прежнее подтверждение. |
| Точность подбора | Профессия и формат обязательны, причины и частичные совпадения разделены; нет выдуманного процента. |
| Расстояние | Считается по двум добровольно заданным точкам; без них показывается район, а не выдуманные километры. |

Оценка относится к проверке интерактивного предпросмотра. Серверные права, настоящая база, оплаты и публикации в @ishdasiz ещё требуют интеграции и не считаются выполненными этими локальными проверками.


Обновление 30 октября: приветственное окно по центру, демо-надпись с карты убрана без подмены источника данных; сфера скрыта и определяется по справочнику должностей. Проверены смена сферы при смене должности, неизвестная должность без ложного старого значения, сохранение черновика, новые рамки списков и выбор клавиатурой, небольшие подсказки и их доступность. Цена показана отдельной карточкой 0 so‘m, название поля — «Kompaniya yoki tashkilot nomi». Регион перенесён на первый шаг и не спрашивается повторно.


## Publication copy and typography — 30 October 2026

The large 0-so‘m form card and optional-channel caption are replaced by one non-interactive line directly beneath the page title. Eligible vacancies say “Sayt va kanalda bepul joylang”; after that account has used its free channel publication, only the website is described as free. No first-use quota explanation or channel price appears while completing/reviewing the form. The normal publication button checks the allowance after the click and opens existing prices if payment is required. Listing repost actions open review first; the menu no longer links directly to tariffs. CVs always say they are free and saved in the resume database, with no channel option.

The interface now uses the existing self-hosted full Inter Variable face (optical size and weight axes), including Uzbek Latin and Cyrillic. Headings, field labels, input values, options and action text have a coordinated size/weight/tracking hierarchy; helper text is more readable. The original logo remains an image. This supersedes the earlier Onest and 0-so‘m-card design notes. The packaged flow and form checks validate the updated delayed-price behavior and typography; the preview still does not post, charge or authorize production data.


## Animated placement seal and comparable compensation — 30 October 2026

The free-placement message is right aligned with an original CSS/SVG ruby gift seal, quiet shine and a small animated sparkle. It is informational, not a button. Reduced/disabled motion removes the animation; hidden-page/modal pauses also apply. Existing free-channel eligibility and delayed prices remain unchanged.

Vacancies now have seven steps: role/organization/region, schedule, location, requirements, duties, compensation, contacts. Resumes have five: identity, skills, location/work format, expected compensation, contacts. Legacy draft contact steps migrate forward without discarding entered amounts. Both forms explicitly choose month, shift, hour or service in UZS; shift length and service scope are clarified when relevant. Per-unit draft amounts survive toggling/reload and are never converted silently. Amounts have grouped digits, an entered-value summary, positive integer/range validation and a negotiated-payment option. A large difference from comparable offers produces a non-blocking check hint.

The estimate uses only explicitly typed, non-sample, non-archived vacancy records from the last 90 days matching canonical profession, region, work format, employment and experience. Currency/period must match; shifts also match duration and services match the normalized scope. The current vacancy/account are excluded. Repeated vacancies are reduced to one median contribution per employer, outliers are removed with 1.5-IQR fences, and at least five independent employers must remain. The shown center is the median, with a 25th–75th percentile typical range and visible count/window. Users choose whether to apply that range. Missing/insufficient data shows no number. It is an estimate of advertised offers, not actual take-home earnings.

The local preview calculator uses browser-local records only. Demo jobs, legacy records without explicit units and unrelated professions are not market evidence. No public salary dataset with reliable time units has been connected, and no market numbers are fabricated. Production rollout needs server-side period/currency/shift/scope persistence and a fresh, validated aggregate source with the same cohort rules; existing jobs.payment_type describes a payment method, not the monthly/hourly period. Matching and numeric search filters now also distinguish payment bases; the job-specific candidate grant fingerprint includes them. No production migration, API call, post or charge is performed by this preview.

Compensation QA uses explicitly synthetic fixtures, never shipped as real averages. It covers units/scope/duration, minimum sample, independent employers, outliers, currency/freshness, amount grouping, unit drafts, negotiated pay, validation/warnings, range application, period-aware matching/filtering, five viewport sizes/both themes and reduced/disabled motion. Existing full vacancy/CV journeys follow the new later compensation steps.
