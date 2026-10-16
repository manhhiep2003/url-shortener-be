# URL Shortener — A Scalable Link Management and Analytics System

> **Project type:** Solo personal project for Backend Developer Intern / Fresher CV  
> **Project scope:** A production-minded, single-developer implementation inspired by services such as Bitly  
> **Primary goal:** Demonstrate backend engineering fundamentals, data modeling, API design, caching, analytics, testing, and deployment without attempting to build a company-scale distributed platform.

---

## 1. Project Information

### 1.1. Project Name

- **English:** URL Shortener — A Scalable Link Management and Analytics System
- **Vietnamese:** Xây dựng hệ thống rút gọn, quản lý và thống kê liên kết

### 1.2. Project Summary

Build a web application that converts long URLs into short, shareable links. When a visitor opens a short link, the system resolves it to the original destination and redirects the visitor. Registered users can manage their links and review basic click analytics.

The project focuses on a complete, demonstrable product and sound backend design. It will use a modular monolith rather than separate microservices. The codebase will be structured so that important components—link creation, redirection, caching, and analytics—have clear responsibilities, while remaining maintainable for one developer.

### 1.3. Intended Users

1. **Guest visitor**
   - Opens a short link and is redirected to its destination.
   - Sees a clear error page when a link is invalid, expired, or disabled.

2. **Registered user**
   - Creates and manages short links.
   - Chooses a custom alias when available.
   - Sets an optional expiration date.
   - Reviews link status and click statistics.

3. **Administrator** *(optional stretch goal)*
   - Reviews reported or suspicious links.
   - Disables links that violate the application's usage rules.

---

## 2. Context and Problem Statement

Long URLs can be inconvenient to share in messages, presentations, social posts, and printed materials. They may be difficult to read, contain tracking parameters, or look untidy. A URL shortener provides a compact alias that redirects to the original address.

A basic implementation can store a short code and its destination in a database. However, a useful portfolio project should also address practical concerns:

- Short codes must be unique and difficult to guess by accident.
- Repeated redirects should not require a database query on every request.
- Users need a way to find, update, disable, and delete their own links.
- Expired or inactive links must not redirect.
- Analytics should count visits without making the redirect path unnecessarily slow.
- APIs should validate input, handle errors consistently, and be covered by tests.
- The service should be runnable locally and deployable with documented configuration.

This project will implement these requirements at a realistic individual-project scale. It will not claim to support millions of requests or provide globally distributed infrastructure unless that capacity is measured and demonstrated.

---

## 3. Proposed Solution

Develop a responsive web application and REST API with the following main capabilities:

1. Create short links from valid HTTP/HTTPS URLs.
2. Generate a unique short code, with an optional user-provided custom alias.
3. Redirect visitors from a short URL to the original destination.
4. Let authenticated users view, search, edit, disable, and delete their own links.
5. Support optional expiration dates and link status.
6. Cache frequently accessed short-code mappings with Redis.
7. Collect click events and display practical analytics.
8. Provide pagination, validation, rate limiting, structured logging, automated tests, and Docker-based local setup.

### 3.1. Architecture Decision

Use a **modular monolith** for the first release.

```text
Browser / API Client
        |
        v
   React Frontend
        |
        v
 NestJS REST API
   |     |      |
   |     |      +---- Redis Cache (short-code -> destination)
   |     |
   |     +----------- PostgreSQL (users, links, click events)
   |
   +----------------- Background processing (optional later)
```

The diagram represents logical responsibilities, not separate deployed microservices. The NestJS application can run as one service initially. A load balancer, multiple application instances, a message broker, and a dedicated analytics service are not required for the first version.

### 3.2. Main User Flows

#### Flow A — Create a short link

1. The user submits a destination URL and optional settings.
2. The API validates the URL, including the allowed schemes.
3. The API generates a short code or validates the requested custom alias.
4. The database stores the link and enforces uniqueness on the short code.
5. The API returns the short URL and link details.
6. If the alias already exists, the API returns a conflict response instead of overwriting another link.

#### Flow B — Open a short link

1. A visitor requests `GET /:code`.
2. The API checks Redis for the code-to-destination mapping.
3. On a cache miss, the API loads the link from PostgreSQL and may populate Redis.
4. The API checks whether the link exists, is active, and has not expired.
5. If valid, the API records or schedules a click event and responds with an HTTP redirect.
6. If invalid, disabled, or expired, the API returns an appropriate not-found or unavailable response.
7. Cache entries are invalidated when a link is edited, disabled, or deleted.

#### Flow C — Manage links

1. A registered user signs in.
2. The frontend requests the user's links with pagination and optional search.
3. The API scopes every management query to the authenticated user's ID.
4. The user can edit supported settings, disable/enable a link, or delete it.
5. The API invalidates relevant cache entries after a change.

#### Flow D — View analytics

1. The user opens the analytics page for a link they own.
2. The API aggregates click events over a selected time range.
3. The response shows total clicks, clicks over time, and available referrer/device summaries.
4. The interface clearly distinguishes approximate technical metadata from verified user identity or precise location.

---

## 4. Functional Requirements

### 4.1. Authentication and Account

The system shall:

- Allow users to register with an email address and password.
- Hash passwords using a suitable password-hashing library; never store plaintext passwords.
- Allow users to log in and log out.
- Protect link-management and analytics endpoints.
- Return only resources owned by the authenticated user.
- Provide a basic profile endpoint.
- Apply validation and rate limits to authentication endpoints.

**Scope decision:** Email verification, password reset emails, OAuth/social login, and multi-factor authentication are excluded from the first release unless time remains.

### 4.2. URL Creation and Short-Code Generation

The system shall:

- Accept a destination URL using the `http` or `https` scheme.
- Generate a short code automatically when no custom alias is supplied.
- Support an optional custom alias such as `/summer-sale`, subject to a documented character and length rule.
- Reject invalid URLs and unsupported schemes such as `javascript:`.
- Enforce short-code uniqueness at the database level.
- Handle collisions by generating another code and retrying a limited number of times.
- Return the short URL, destination URL, creation time, status, and expiration time.
- Allow a user to set an optional expiration date.
- Allow an optional descriptive title for easier link management.

**Generation approach:** Use a cryptographically secure random code from a URL-safe alphabet. This avoids exposing a sequential database ID and keeps implementation simple. A Base62-encoded database ID is a valid alternative, but is not required. A hash of the original URL alone is not sufficient because different users may want separate links to the same destination and hashes can introduce collision or policy concerns.

### 4.3. Redirection

The system shall:

- Resolve a short code to its destination URL.
- Return an HTTP `302 Found` redirect by default so the destination can be changed without permanently caching the redirect in clients.
- Return a clear response for unknown, disabled, or expired links.
- Avoid redirecting to a destination if the stored URL fails validation.
- Check link status and expiration before redirecting.
- Avoid leaking internal database errors to visitors.
- Record a click event for successful redirects, with a documented decision about whether bot or preview traffic is filtered.

**Implementation note:** The redirect endpoint is a latency-sensitive path. It should do as little work as practical before sending the redirect response.

### 4.4. Link Management

An authenticated owner shall be able to:

- List their own links with pagination.
- Search by title, short code, or destination URL.
- Sort by creation date or click count where practical.
- View one link's details.
- Update its title and expiration date.
- Enable or disable a link.
- Delete a link.
- View a link's current status: `ACTIVE`, `DISABLED`, or effectively `EXPIRED`.

The API must never allow one user to read or modify another user's link by guessing its ID or short code.

**Deletion policy:** For the first version, deleting a link removes it from active use and invalidates its cache entry. The implementation should document whether analytics are retained or deleted. A soft-delete field may be used if retaining records is useful, but implementing both soft deletion and a complex audit system is not required.

### 4.5. Redis Caching

The system shall:

- Cache the mapping from short code to the minimum data required for redirect validation.
- Check the cache before querying PostgreSQL.
- Populate the cache after a database lookup.
- Use a configurable TTL rather than keeping entries indefinitely.
- Invalidate or refresh cached data after edits, disablement, or deletion.
- Fall back to PostgreSQL when Redis is unavailable, where practical.
- Avoid caching invalid or expired links for long periods.

**Cache consistency rule:** PostgreSQL is the source of truth. Redis is an optimization, not the permanent storage for links. The application must define how cache invalidation works and test the important update cases.

### 4.6. Click Analytics

The system shall record a practical set of click-event fields:

- Link ID
- Click timestamp
- Referrer host or normalized referrer, when available
- User-agent summary or parsed device category, when available
- A coarse country/region only if a reliable geolocation provider is configured

The analytics API shall provide:

- Total recorded clicks for a link.
- Click counts grouped by day for a selected time range.
- Top referrer hosts when referrer data is available.
- A simple device-category breakdown when user-agent parsing is implemented.
- Pagination for raw click-event history if exposed.

**Privacy and accuracy rules:**

- Do not claim that IP-based location is exact.
- Do not store raw IP addresses indefinitely by default. Prefer not to persist them, or anonymize/truncate them if a technical need is demonstrated.
- Do not collect more personal data than needed for the demo.
- Explain that click counts may include bots, link previews, crawlers, or repeated visits unless filtering is implemented.
- Analytics must not block redirection for a long time.

**Solo-project implementation:** Start by writing click events directly to PostgreSQL after resolving a valid link. Measure the impact before introducing a queue or worker. If analytics writes noticeably slow redirects, a background queue can be added as a stretch goal.

### 4.7. API Safety and Abuse Controls

The system shall:

- Apply request validation and consistent error responses.
- Rate-limit link creation and authentication endpoints.
- Limit the maximum length of destination URLs and custom aliases.
- Reject unsupported URL schemes.
- Avoid exposing stack traces or secrets in API responses.
- Prevent users from managing resources they do not own.
- Provide a basic abuse-reporting or administrative disable mechanism only if time permits.

A URL shortener can be abused to conceal malicious destinations. The initial version should include basic controls and a clear usage policy, but does not need a full threat-intelligence integration or automated malware-scanning platform.

### 4.8. Administrator Functions *(Stretch Goal)*

If the core project is complete, add a minimal administrator role that can:

- List links reported by users.
- Disable a link and record a reason.
- Re-enable a link after review.
- View basic aggregate counts for users, links, and recorded clicks.

This module is optional and must not delay completion of the core user flows.

---

## 5. Non-Functional Requirements

### 5.1. Performance

- The redirect endpoint should use Redis for repeated lookups when Redis is configured.
- The system should avoid loading unrelated link data on the redirect path.
- Link lists and analytics queries must use pagination or bounded date ranges.
- Performance claims must be based on a repeatable local or deployed load test, not assumptions.
- Record baseline and cached redirect latency using a tool such as k6 or autocannon if time permits.

### 5.2. Reliability and Data Integrity

- PostgreSQL must enforce uniqueness for short codes.
- A failed custom-alias insert must not overwrite an existing link.
- Cache invalidation must occur after link state changes.
- The application should handle Redis downtime without losing the canonical link data.
- Database migrations and seed data must be repeatable.

### 5.3. Security

- Passwords must be securely hashed.
- Authentication credentials or tokens must not be logged.
- Every protected resource must be authorized against its owner.
- Input must be validated on the server, even if the frontend also validates it.
- Secrets must be supplied through environment variables and excluded from version control.
- CORS, security headers, and rate limits must be configured for the deployment environment.
- Redirect destinations must be validated to prevent unsafe-scheme redirects.

### 5.4. Maintainability

- Organize the backend into feature modules with clear responsibilities.
- Keep controller responsibilities limited to HTTP concerns.
- Put business rules in services or domain-level functions rather than duplicating them across controllers.
- Use DTO validation and a consistent error format.
- Document important architectural decisions, especially code generation, caching, analytics, and deletion behavior.
- Prefer a simple modular monolith over premature microservices.

### 5.5. Testability

- Unit-test short-code generation, URL validation, expiration checks, and link status rules.
- Integration-test database constraints and link ownership.
- End-to-end test create, redirect, update, disable, and delete flows.
- Test cache invalidation after a link is disabled or changed.
- Test invalid inputs, alias conflicts, expired links, and unauthorized access.

### 5.6. Deployment and Operations

- Provide a Docker Compose setup for the API, PostgreSQL, and Redis.
- Provide an `.env.example` with descriptions and safe placeholder values.
- Include database migration and seed commands.
- Add a health endpoint for application readiness.
- Include structured logs for errors and important operations without logging secrets.
- Deploy a demonstrable version to a low-cost hosting option if feasible; document any infrastructure limitations.

---

## 6. Proposed Technology Stack

| Area | Technology | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | A focused dashboard without excessive frontend complexity |
| UI | Tailwind CSS or a small component library | Build a clean, responsive interface quickly |
| Backend | NestJS + TypeScript | Modular REST API, dependency injection, guards, validation, and testing |
| Database | PostgreSQL | Relational integrity, indexes, constraints, and analytics aggregation |
| ORM | Prisma | Typed database access and manageable schema migrations |
| Cache | Redis | Fast short-code lookups and cache-expiration support |
| Authentication | JWT or secure cookie-based sessions | Choose one approach and implement it consistently |
| Validation | `class-validator` / `class-transformer` | Request DTO validation in NestJS |
| Testing | Jest + Supertest | Unit, integration, and HTTP end-to-end tests |
| API documentation | Swagger / OpenAPI | Interactive API documentation |
| Local environment | Docker Compose | Reproducible API, database, and cache setup |
| Load testing | k6 or autocannon *(optional)* | Measure redirect behavior and compare cache-hit/miss paths |
| Deployment | Any suitable platform supporting Node.js and PostgreSQL | Publish a live demo without requiring a complex cloud architecture |

**Database and ORM decision:** PostgreSQL and Prisma are suitable for this project. PostgreSQL handles relational constraints and aggregation; Prisma provides type-safe access and migrations. Redis complements the database for hot redirect lookups but does not replace PostgreSQL.

---

## 7. Data Model Proposal

The first version should keep the schema intentionally small.

### 7.1. `User`

| Field | Type / rule | Purpose |
|---|---|---|
| `id` | UUID or generated integer | Primary key |
| `email` | Unique | Login identity |
| `passwordHash` | String | Hashed password |
| `role` | `USER` / `ADMIN` | Authorization; `ADMIN` can be deferred |
| `createdAt` | Timestamp | Account creation time |
| `updatedAt` | Timestamp | Last update time |

### 7.2. `ShortLink`

| Field | Type / rule | Purpose |
|---|---|---|
| `id` | UUID or generated integer | Internal primary key |
| `code` | Unique string, indexed | Public short code |
| `destinationUrl` | Text | Original destination |
| `title` | Nullable string | Optional display name |
| `ownerId` | Foreign key to `User` | Ownership |
| `status` | `ACTIVE` / `DISABLED` | Whether redirects are allowed |
| `expiresAt` | Nullable timestamp | Optional expiration |
| `createdAt` | Timestamp | Creation time |
| `updatedAt` | Timestamp | Last update time |

Suggested indexes:
- Unique index on `code`.
- Index on `(ownerId, createdAt)` for a user's link list.
- Optional index on `(ownerId, status)` if filtering is implemented frequently.

### 7.3. `ClickEvent`

| Field | Type / rule | Purpose |
|---|---|---|
| `id` | Generated primary key | Event identity |
| `shortLinkId` | Foreign key to `ShortLink` | Link that was opened |
| `clickedAt` | Timestamp, indexed | Time-series analytics |
| `referrerHost` | Nullable string | Referring website host |
| `deviceType` | Nullable enum/string | Desktop, mobile, tablet, or unknown |
| `countryCode` | Nullable string | Optional coarse location from a configured provider |

Suggested indexes:
- Index on `(shortLinkId, clickedAt)` for analytics by time.
- Optional index on `(shortLinkId, referrerHost)` if referrer aggregation becomes expensive.

### 7.4. Relationships

- One `User` owns many `ShortLink` records.
- One `ShortLink` has many `ClickEvent` records.
- Click events should reference the link using a foreign key.
- A short code is unique globally in the first version.
- Redis entries are derived from database records and are not represented as relational tables.

### 7.5. Deliberately Excluded from the Initial Schema

Do not add these unless a real requirement appears:

- Separate `Order` or payment tables, because the first version does not sell anything.
- A dedicated analytics warehouse.
- A message-broker event store.
- Multi-tenant organization and team tables.
- Complex subscription, billing, and audit modules.
- A separate database for Redis data.

---

## 8. REST API Proposal

Use a versioned API prefix such as `/api/v1`. The redirect endpoint can remain at `/:code` so short links are convenient to share.

### 8.1. Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create an account |
| `POST` | `/api/v1/auth/login` | Authenticate |
| `POST` | `/api/v1/auth/logout` | End the session, if session-based auth is used |
| `GET` | `/api/v1/users/me` | Get the current user's profile |

### 8.2. Short-Link Management

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/links` | Create a short link |
| `GET` | `/api/v1/links` | List the current user's links with pagination and search |
| `GET` | `/api/v1/links/:id` | Get one owned link |
| `PATCH` | `/api/v1/links/:id` | Update title or expiration |
| `PATCH` | `/api/v1/links/:id/status` | Enable or disable a link |
| `DELETE` | `/api/v1/links/:id` | Delete a link |

Example create request:

```json
{
  "destinationUrl": "https://example.com/articles/backend-engineering",
  "title": "Backend engineering article",
  "customAlias": "backend-notes",
  "expiresAt": null
}
```

Example response:

```json
{
  "id": "link-id",
  "code": "backend-notes",
  "shortUrl": "https://your-domain.example/backend-notes",
  "destinationUrl": "https://example.com/articles/backend-engineering",
  "title": "Backend engineering article",
  "status": "ACTIVE",
  "expiresAt": null,
  "createdAt": "2026-10-16T10:00:00.000Z"
}
```

These examples illustrate the contract; the actual domain and ID format will depend on deployment configuration.

### 8.3. Redirect

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/:code` | Resolve a short code, record a click, and redirect |

Expected behavior:
- Valid active link: HTTP `302` with a `Location` header.
- Unknown code: HTTP `404`.
- Disabled or expired link: return a documented unavailable/not-found response.
- Invalid or unsafe stored destination: do not redirect; log a safe diagnostic.

### 8.4. Analytics

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/links/:id/analytics/summary` | Total clicks and summary |
| `GET` | `/api/v1/links/:id/analytics/timeline` | Click counts grouped by day |
| `GET` | `/api/v1/links/:id/analytics/referrers` | Top referrer hosts |
| `GET` | `/api/v1/links/:id/analytics/devices` | Device-category breakdown |

Every analytics endpoint must verify that the requested link belongs to the authenticated user. Date ranges should have a maximum allowed span to avoid unbounded database work.

### 8.5. Operational Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Basic process health |
| `GET` | `/api` or `/api/docs` | Swagger documentation, depending on configuration |

---

## 9. Frontend Pages

The frontend should be compact and support the complete core flow.

1. **Register / Login**
   - Form validation and clear API errors.
2. **Dashboard**
   - Total links, total recorded clicks, and recently created links.
3. **Create Link**
   - Destination URL, optional title, optional custom alias, and optional expiration.
4. **My Links**
   - Paginated table, search, status, copy-short-link action, edit, disable, and delete.
5. **Link Details**
   - Original destination, short URL, status, creation and expiration information.
6. **Analytics**
   - Total clicks, daily trend chart, referrer breakdown, and device breakdown when data is available.
7. **Error / unavailable link page**
   - Clear messaging for unknown, disabled, or expired codes.

The frontend is a supporting part of the portfolio project. Prioritize a usable and consistent interface over elaborate animations or a large design system.

---

## 10. Testing Strategy

### 10.1. Unit Tests

Cover:
- Short-code generation format and allowed characters.
- URL scheme validation.
- Expiration-time checks.
- Redirect eligibility for active, disabled, and expired links.
- Custom alias validation.
- Analytics date-range validation.

### 10.2. Integration Tests

Cover:
- Database uniqueness for short codes.
- Link creation and owner assignment.
- Link queries scoped to the current user.
- Cache hit and cache miss behavior.
- Cache invalidation after update, disable, and delete.
- Click-event creation and analytics aggregation.

### 10.3. End-to-End Tests

At minimum, verify these scenarios:

1. A user registers and logs in.
2. The user creates a link and receives a short URL.
3. Opening the short URL redirects to the original destination.
4. A second user cannot access or modify the first user's link.
5. A duplicate custom alias returns a conflict.
6. An expired or disabled link does not redirect.
7. Editing or disabling a link does not leave a stale Redis redirect.
8. Analytics reflect successful recorded clicks.

### 10.4. Manual Verification

- Run the complete application using Docker Compose.
- Verify Swagger documentation.
- Test validation and error responses.
- Restart the application and confirm PostgreSQL data persists.
- Temporarily stop Redis and verify the documented fallback behavior if implemented.

---

## 11. Implementation Plan for One Developer

The project should be delivered in milestones. Each milestone should leave the application in a runnable state.

### Milestone 1 — Foundation

- Initialize the NestJS and React applications.
- Configure PostgreSQL, Prisma, migrations, and Docker Compose.
- Add environment-variable validation and a health endpoint.
- Establish API response and error-handling conventions.

**Completion criteria:** The API starts locally, connects to PostgreSQL, and can run migrations from a clean environment.

### Milestone 2 — Core Link Functionality

- Implement short-code generation.
- Implement URL and custom-alias validation.
- Build create, list, details, update, disable, and delete APIs.
- Add ownership checks and database constraints.
- Implement the redirect endpoint without Redis first.

**Completion criteria:** A user can create a link, open it, and manage only their own links.

### Milestone 3 — Authentication and Frontend

- Implement registration and login.
- Protect private API routes.
- Build the dashboard and link-management pages.
- Add pagination, search, copy-link, and user-facing error messages.

**Completion criteria:** A user can complete the main flow through the web interface without manually calling the API.

### Milestone 4 — Redis and Correctness

- Add Redis lookup caching.
- Configure TTL and cache-miss behavior.
- Invalidate cache entries after link state changes.
- Add tests for cache consistency and Redis fallback behavior.

**Completion criteria:** Repeated redirects can use cached mappings, and updates do not continue redirecting to stale destinations.

### Milestone 5 — Analytics

- Add click-event persistence.
- Implement summary, timeline, referrer, and device aggregation as time allows.
- Add the analytics dashboard.
- Document counting limitations and privacy decisions.

**Completion criteria:** Creating and opening a short link produces visible, explainable analytics.

### Milestone 6 — Quality and Delivery

- Add unit, integration, and end-to-end tests for critical flows.
- Add Swagger documentation.
- Add rate limiting and security configuration.
- Prepare `.env.example`, seed data, and a clear README.
- Deploy the application if feasible.
- Capture a small, reproducible redirect performance comparison with and without cache, if time permits.

**Completion criteria:** Another developer can clone the repository, follow the README, run the application, and verify the main features.

### Stretch Goals — Only After the Core Is Stable

Choose at most one or two:
- Minimal administrator screen for disabling reported links.
- Background queue for analytics writes.
- QR-code generation for short links.
- Bulk link creation from a CSV file.
- Custom domain support.
- More robust bot/preview traffic filtering.
- A small load test and performance report.

Do not implement all stretch goals just to increase the feature count.

---

## 12. Deliverables

The finished project should include:

1. A working web application for authentication, link management, and analytics.
2. A NestJS REST API with documented endpoints.
3. A PostgreSQL schema managed by Prisma migrations.
4. Redis-based caching for redirect lookups.
5. Unit, integration, and end-to-end tests for the critical paths.
6. Docker Compose configuration for local development.
7. An `.env.example` file containing placeholders, not real secrets.
8. A README covering setup, architecture, environment variables, migrations, test commands, API documentation, and known limitations.
9. A concise architecture diagram and database ERD.
10. Optional live deployment and a short demo recording.

---

## 13. Portfolio and CV Presentation

### 13.1. Suggested CV Entry

**URL Shortener — Link Management & Analytics Platform** | Personal Project

- Built a URL-shortening REST API using NestJS, TypeScript, PostgreSQL, and Prisma, with unique short-code generation, custom aliases, expiration, and authenticated link management.
- Added Redis caching for redirect lookups and cache invalidation when links are updated or disabled.
- Implemented click analytics with time-based aggregation and a React dashboard.
- Added API validation, ownership authorization, rate limiting, automated tests, Swagger documentation, and Docker Compose for reproducible local setup.

Only keep claims that are implemented and verified. If analytics, deployment, load testing, or a security control is not completed, remove it or label it as planned rather than presenting it as finished.

### 13.2. What Makes This Project Convincing

The project's value is not the number of boxes in an architecture diagram. It is the ability to explain and demonstrate:

- Why the short code is generated randomly and how collisions are handled.
- Why the database remains the source of truth when Redis is used.
- How stale cache entries are prevented after a link changes.
- How ownership checks stop one user from modifying another user's links.
- How redirect latency differs between cache hits and misses.
- How analytics are aggregated and what the click count does and does not mean.
- Which tests protect the most important business rules.
- What the system currently supports and what has intentionally been left out.

### 13.3. Evidence to Capture

- A successful create-and-redirect demonstration.
- A custom-alias conflict response.
- A disabled or expired link response.
- A cache-hit versus cache-miss measurement, if load testing is completed.
- Analytics populated after opening a link.
- Passing test output.
- A clean local startup using the documented Docker Compose steps.

---

## 14. Scope Boundaries and Risks

### Included in the first release

- Single-user-owned links with account authentication.
- Random short-code generation and optional custom aliases.
- HTTP/HTTPS destination validation.
- Redirect handling and expiration/status checks.
- Link management, Redis caching, and basic click analytics.
- React dashboard, automated tests, API documentation, and Docker-based setup.

### Excluded from the first release

- A distributed microservice architecture.
- A dedicated message broker and analytics data warehouse.
- Multi-region deployment and global load balancing.
- Guaranteed support for millions of links or requests.
- Enterprise teams, billing, subscriptions, and paid plans.
- Advanced machine-learning fraud detection.
- Guaranteed exact visitor geolocation.
- High-availability infrastructure requiring multiple production nodes.

### Main Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Short-code collision | Database unique constraint and bounded retry |
| Stale cache after link changes | Centralized invalidation and integration tests |
| Abuse of short links | Scheme validation, rate limits, reporting/disable option |
| Analytics slows redirects | Keep redirect work small; measure before adding a queue |
| Analytics data is misleading | Document bot, preview, and repeat-click limitations |
| Scope grows too large | Finish the core flows before adding stretch goals |
| Secrets leak into Git | `.env.example`, ignored local `.env`, and deployment secrets |

---

## 15. Definition of Done

The project is ready to present in a CV when all of the following are true:

- [ ] A new developer can run it by following the README.
- [ ] A user can register, log in, create a short link, and open it successfully.
- [ ] Custom aliases are validated and uniqueness is enforced by PostgreSQL.
- [ ] Expired and disabled links cannot redirect.
- [ ] Users cannot manage links belonging to other users.
- [ ] Redis caching works and cache invalidation is tested.
- [ ] Click analytics are visible and their limitations are documented.
- [ ] Critical unit and end-to-end tests pass.
- [ ] Swagger documents the primary API endpoints.
- [ ] No real credentials or secrets are committed.
- [ ] The CV describes only features that have actually been implemented and verified.

---

## 16. Recommended Build Order

For a solo developer, prioritize in this order:

1. **Correct link creation and redirection**
2. **Authentication and ownership authorization**
3. **Link management and expiration**
4. **Tests for critical business rules**
5. **Redis caching and invalidation**
6. **Click analytics**
7. **Frontend polish and deployment**
8. **One optional stretch feature**

A reliable, tested application with a clear README is stronger portfolio evidence than an unfinished diagram promising load balancers, multiple application servers, a separate analytics service, and million-link scale.
