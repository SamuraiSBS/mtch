# Модель данных mtch. MVP

Статус: **проект на утверждение**, 30 сентября 2026. PostgreSQL — источник истины. Все изменения схемы выполняются версионированными миграциями Drizzle. Ниже — логическая схема и обязательные инварианты; конкретные имена auth-таблиц согласуются с генерируемой схемой Better Auth при создании каркаса.

## Типы и соглашения

- Первичные ключи: UUID. Времена: `timestamptz` в UTC; UI показывает локальное время пользователя.
- Месячная зарплата: положительное целое число **рублей**, поля `salary_min_rub` и `salary_max_rub`, обе границы обязательны для профиля специалиста, Search Profile и предложения; `min <= max`. В интерфейсе не описывается налоговый режим.
- Email нормализуется (`trim`, lowercase) до записи и уникален. URL и Telegram username проходят валидацию; текстовые поля имеют явные лимиты.
- Справочники специализаций, городов и навыков содержат стабильные ID и уникальные нормализованные названия. Seed добавляет записи идемпотентно.
- Удаление аккаунтов, профилей и компаний через UI в MVP не предусмотрено. История предложений и Match не удаляется при редактировании профилей.

## Auth и роли

| Таблица | Ключевые поля | Ограничения |
|---|---|---|
| `users` | `id`, `email`, `name_for_auth`, `role`, `created_at`, `updated_at` | `email` unique, `role` not null и immutable после insert; роль одна |
| `sessions` | `id`, `user_id`, `token`, `expires_at`, timestamps | FK на пользователя, уникальный token, индекс срока действия |
| `accounts` | `id`, `user_id`, provider/password data | FK на пользователя; безопасный формат хеша контролирует Better Auth |
| `verifications` | поля библиотеки auth | могут существовать технически, хотя подтверждение email в MVP отключено |

Better Auth управляет полями/хешами сессий и аккаунтов. Приложение добавляет роль и проверяет её на сервере. Изменение `users.role` запрещается в API и ограничением/триггером БД; смена роли не является бизнес-операцией. При регистрации поле `name_for_auth`, если библиотека требует его до создания профиля, заполняется внутренним значением и не показывается как имя специалиста.

## Справочники

| Таблица | Поля | Ограничения и индексы |
|---|---|---|
| `professions` | `id`, `name`, `normalized_name`, `sort_order`, `is_active` | unique `normalized_name` |
| `cities` | `id`, `name`, `normalized_name`, `sort_order`, `is_active` | unique `normalized_name` |
| `skills` | `id`, `name`, `normalized_name`, `sort_order`, `is_active` | unique `normalized_name` |

Удаление использованных записей запрещено FK; вместо него допускается `is_active=false`, чтобы старые профили и snapshots оставались читаемыми.

## Специалист

### `specialist_profiles`

| Поле | Тип / смысл |
|---|---|
| `user_id` | PK и FK на `users.id`, только пользователь `SPECIALIST` |
| `first_name`, `last_name` | обязательные строки |
| `birth_date` | nullable date; возраст вычисляется, не хранится |
| `city_id` | nullable FK `cities.id` |
| `avatar_file_id` | обязательный FK `media_files.id` с видом `AVATAR` и тем же владельцем |
| `profession_id` | обязательный FK `professions.id` |
| `experience` | nullable enum опыта |
| `level` | nullable enum уровня |
| `cooperation_type` | nullable enum типа сотрудничества, одно значение |
| `about` | nullable, максимум 500 символов |
| `portfolio_url`, `github_url`, `behance_gitlab_url`, `telegram` | nullable |
| `resume_file_id` | nullable FK для будущего PDF; в базовом MVP не устанавливается через API |
| `salary_min_rub`, `salary_max_rub` | обязательные int, положительные, min <= max |
| `work_format`, `employment_type` | nullable enum, по одному значению |
| `search_status` | enum, not null, default `OPEN_TO_OFFERS` |
| `published_at`, `created_at`, `updated_at` | timestamps; `published_at` задаётся при первом сохранении |

### `specialist_skills`

`specialist_user_id` FK, `skill_id` FK, составной PK (`specialist_user_id`, `skill_id`), индекс по `skill_id`. Сохранённый опубликованный профиль должен иметь минимум один навык; это проверяется транзакцией сервиса, поскольку обычный CHECK не может считать строки дочерней таблицы.

Профиль, сохранённый после регистрации, считается опубликованным. В ленту попадают только профили с `published_at IS NOT NULL` и `search_status IN (ACTIVE, OPEN_TO_OFFERS)`. При `NOT_LOOKING` запись, предложения и Match сохраняются.

## Компания и медиа

### `companies`

| Поле | Тип / смысл |
|---|---|
| `id` | PK |
| `owner_user_id` | обязательный уникальный FK на `users.id`, только `EMPLOYER` |
| `name` | обязательное название |
| `description` | обязательное описание, до 500 символов |
| `work_format` | обязательный enum |
| `founded_year` | обязательный год, разумный диапазон от 1800 до текущего года |
| `size_band` | обязательное значение из предложенного списка `1–10`, `11–50`, `51–200`, `201–1000`, `1000+` сотрудников; подтверждается вместе с планом |
| `industry` | обязательная строка |
| `website_url` | nullable URL |
| `logo_file_id` | обязательный FK `media_files.id`, вид `COMPANY_LOGO`, владелец тот же employer |
| `contact_email`, `telegram`, `phone` | nullable; после Match всегда доступен email аккаунта владельца |
| `created_at`, `updated_at` | timestamps |

Одна компания на работодателя обеспечивается unique `owner_user_id`. Компания должна быть сохранена до создания Search Profile или предложения. Роль владельца и соответствие владельца медиа проверяются транзакцией сервиса.

### `company_photos`

`id`, `company_id` FK, `file_id` FK на `media_files.id`, `sort_order`, timestamps. Дополнительных фото может не быть; логотип обязателен и хранится отдельно.

### `company_social_links`

`id`, `company_id` FK, `platform` (`TELEGRAM`, `INSTAGRAM`, `TIKTOK`, `OTHER`), `value` (валидная ссылка/username), `sort_order`, timestamps. У компании может быть 0..N ссылок, в том числе несколько одного типа, если они различны. Уникальность (`company_id`, `platform`, `value`) предотвращает точный дубль.

### `media_files`

`id`, `owner_user_id` FK, `kind` (`AVATAR`, `COMPANY_LOGO`, `COMPANY_PHOTO`; будущий `RESUME_PDF`), `storage_key` unique, `mime_type`, `byte_size`, `created_at`. `storage_key` — непрозрачный относительный ключ внутри volume, а не URL и не путь от клиента. Бинарное содержимое не хранится в БД. Доступ к файлу проверяется через API. Максимальный размер и проверка сигнатуры файла осуществляются до записи и повторно при привязке.

## Search Profile

### `search_profiles`

| Поле | Тип / смысл |
|---|---|
| `id` | PK |
| `company_id` | обязательный FK на компанию |
| `title` | обязательное название поиска |
| `profession_id` | обязательный FK |
| `target_level` | обязательный enum |
| `minimum_experience` | обязательный enum; означает нижнюю допустимую категорию |
| `salary_min_rub`, `salary_max_rub` | обязательный положительный диапазон |
| `work_format`, `employment_type` | обязательные enum |
| `created_at`, `updated_at`, `deleted_at` | timestamps; nullable `deleted_at` скрывает Search Profile из текущего списка без потери истории предложений |

### `search_profile_skills`

`search_profile_id` FK, `skill_id` FK, составной PK, индекс по `skill_id`. Минимум один навык при сохранении. Search Profile не является вакансией, не публикуется специалистам и не содержит состояния «активный»: выбранный ID передаётся в запросе ленты. Удаление в UI устанавливает `deleted_at`; уже отправленные предложения остаются связаны с записью и snapshot. Изменение Search Profile не меняет ранее отправленных предложений.

## Предложения и Match

### `offers`

| Поле | Тип / смысл |
|---|---|
| `id` | PK |
| `employer_user_id`, `company_id` | FK работодателя и его компании |
| `specialist_user_id` | FK адресата со статусом роли `SPECIALIST` |
| `search_profile_id` | FK Search Profile, принадлежащего указанной компании |
| `position_title` | обязательное название позиции |
| `salary_min_rub`, `salary_max_rub` | обязательные собственные условия, min <= max |
| `description`, `work_format`, `employment_type`, `message` | обязательные собственные условия |
| `status` | `SENT`, `ACCEPTED`, `REJECTED`, `WITHDRAWN` |
| `search_profile_snapshot` | versioned JSONB: название, профессия, уровень, опыт, навыки, зарплата, формат, занятость на момент отправки |
| `specialist_snapshot` | versioned JSONB: релевантные видимые поля и навыки на момент отправки; без контактов |
| `company_name_snapshot`, `score_at_send` | неизменяемый контекст истории |
| `sent_at`, `resolved_at`, `created_at` | timestamps |

Явные поля предложения — юридически/продуктово значимые условия; snapshots сохраняют контекст расчёта и поиска. После insert разрешён только переход `status` и установка `resolved_at`, остальные бизнес-поля неизменяемы. Это защищается сервисом и тестами; при необходимости DB trigger блокирует UPDATE этих колонок.

Индексы и ограничения:

- Частичный unique (`employer_user_id`, `specialist_user_id`) **WHERE status IN (`SENT`, `ACCEPTED`)**. Он допускает историю `REJECTED`/`WITHDRAWN`, но запрещает два активных предложения и повтор после принятия.
- Индексы (`specialist_user_id`, `sent_at DESC`), (`company_id`, `sent_at DESC`), (`search_profile_id`).
- Составные FK/проверки обеспечивают, что `company_id` принадлежит `employer_user_id`, а `search_profile_id` — этой же компании; проверка роли адресата остаётся в серверном сервисе.

### `matches`

`id` PK, `offer_id` unique FK, `employer_user_id`, `specialist_user_id`, `company_id`, `accepted_at`. Unique (`employer_user_id`, `specialist_user_id`) запрещает второй Match этой пары. Одна запись создаётся только транзакцией `SENT` → `ACCEPTED`; несколько работодателей могут иметь Match с одним специалистом. Контакты открываются по существующему Match, участникам которого соответствует текущая сессия. Принятие старого предложения допустимо и при статусе специалиста `NOT_LOOKING`.

## Enum и важные правила

| Enum | Значения |
|---|---|
| `user_role` | `SPECIALIST`, `EMPLOYER` |
| `experience` | `NONE`, `UNDER_1`, `FROM_1_TO_3`, `FROM_3_TO_5`, `OVER_5` (ранг по порядку) |
| `level` | `INTERN`, `JUNIOR`, `MIDDLE`, `SENIOR` |
| `cooperation_type` | `STAFF`, `PROJECT`, `FREELANCE`, `INTERNSHIP` |
| `work_format` | `REMOTE`, `HYBRID`, `OFFICE` |
| `employment_type` | `FULL_TIME`, `PART_TIME`, `PROJECT`, `INTERNSHIP` |
| `search_status` | `ACTIVE`, `OPEN_TO_OFFERS`, `NOT_LOOKING` |
| `offer_status` | `SENT`, `ACCEPTED`, `REJECTED`, `WITHDRAWN` |

У предложения допустимы только переходы из `SENT`: специалист → `ACCEPTED`/`REJECTED`, работодатель → `WITHDRAWN`. Все конечные состояния остаются в истории. Роли, диапазоны и ownership проверяются до записи; проверки конкурентных состояний и создание Match выполняются атомарно.

## Индексация ленты и миграции

Индексы по `specialist_profiles` (`search_status`, `profession_id`, `level`, `experience`, `work_format`, `city_id`), по таблицам навыков и зарплатным границам помогают фильтровать кандидатов. На demo-объёме score рассчитывается после отбора доступных записей; сортировка и пагинация выполняются уже по рассчитанному score со стабильным вторичным ключом. Это не runtime-хранилище: данные и связи находятся в PostgreSQL.

Первая миграция создаёт схему и DB-ограничения. Следующие миграции меняют её без destructive reset. Seed не заменяет миграции и должен быть идемпотентным. Схема достижений ФСП не придумывается до спецификации 5 октября; она добавляется отдельно, с FK к специалисту и данными происхождения/подтверждения по фактическому API.
