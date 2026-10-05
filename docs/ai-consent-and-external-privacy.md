# AI consent and external-provider privacy

Implemented 5 October 2026 as the first batch from REMAINING_WORK_CHECKLIST.md.

## Parent workflow

Open **Parent portal → Child Profile → AI personalisation**. The selected child's current status is fetched without a browser cache. A parent can grant or withdraw personalisation and receives success or failure feedback. Switching children remounts the control and cancels the old status request.

Access requires an authoritative ParentUser.childrenIds link and matching school. Legacy name-only links cannot authorise consent changes: the school must verify and repair the ID link. No child names or actor IDs supplied by the browser are trusted.

Withdrawal blocks subsequent personalised tutor-context construction and the parent home-support, weekly-digest and monthly-report endpoints, including their cached reports. Course-material tutoring remains available and still processes submitted questions. Other AI report/assessment entry points require further coverage review. Withdrawal neither deletes existing records nor cancels requests already in flight. Re-grant clears the withdrawal timestamp. Explicit withdrawal overrides a permissive organisation policy.

## Backend contract

- `GET /api/ai-consent/parent/:studentId`: authenticated linked parent reads `data.allowed`, `requiresConsent`, `reason`, `consentGivenAt`, `withdrawnAt`.
- `PUT /api/ai-consent/parent/:studentId`: body `{ "granted": true }` or `{ "granted": false }`; actor comes from the authenticated parent and school-scoped record.
- `DELETE /api/ai-consent/admin/:studentId`: school admin records withdrawal.
- Existing `POST /api/ai-tutor/admin/consent/:studentId` still records a guardian's grant, now through the transactional service.

The new optional StudentUser.parentConsentWithdrawnAt field defaults to null. Existing consent records remain valid. No bulk data migration ran. Consent mutation and AuditLog insertion share a MongoDB transaction, so a replica set is required; standalone MongoDB saves fail rather than silently skip auditing. Failed audit writes abort the transaction. Real replica-set rollback/concurrency testing is still pending.

School policy is resolved through School.organizationId → Organization.settings.ai.personalisationRequiresConsent. Missing/failed policy lookup requires consent, and a missing student never gets personalisation even when an organisation policy permits it.

Teacher conversation reads retain allocation checks, now selecting grade/section for those checks, accept limits of 1–50, and persist `ai_conversation.read` before returning content. Audits include actor, student, school and conversation count; schema timestamps supply the access time. Conversation text is not included in the audit.

## AI boundary

`app/core/privacy.py` redacts common email addresses, phone/long numeric identifiers, labelled names/addresses/dates of birth and supported structured identity keys. It processes shared LangChain input immediately before external generation and the direct assessment fallback payload before its HTTP request. Input messages are copied, not mutated. Local Ollama prompts retain their existing content.

This is conservative data minimisation, **not complete anonymisation**. Unlabelled names, contextual re-identification, images, unusual identifier formats and multilingual narrative need further evaluation. Numeric patterns can also redact long numbers in learning content. Training extraction, provider retention, external tracing and historic logs are not covered by this batch. A malformed learning-path response no longer writes raw output to application logs.

Assessment fallback now honours OPENROUTER_MODEL and OPENROUTER_BASE_URL, so deployment owners should verify their selected model's assessment quality. Shared external generation uses a 60-second timeout with one retry (the overall operation can exceed 60 seconds). This is bounded retry, not a new automatic provider failover system.

## Validation

- Backend: `npm test -- --runInBand parentReportConsent aiConsent aiTutorCorrection` — 27 tests passed, with local socket permission outside the sandbox.
- Frontend: `npm test -- --runInBand ParentAiConsent` — 4 tests passed.
- Frontend: `npx eslint src/features/ai-consent/ParentAiConsent.jsx` — passed; React-version configuration warning remains.
- Frontend: `npm run build` — passed, existing large-chunk warnings remain.
- AI service: `.venv/bin/python -m pytest tests/test_external_privacy.py -q` — 5 tests passed; dependency deprecation warning remains.

These are focused mock/unit/API tests, not a live end-to-end certification. No live student records, provider calls or deployment settings were changed.

## Manual acceptance in a designated test environment

1. With a replica-set database, grant consent for one linked test child. Check the persisted fields and audit actor/school/timestamp.
2. Withdraw and verify the tutor no longer sends saved learning context; all three parent AI report routes must return AI_CONSENT_REQUIRED even with a warm report cache.
3. Re-grant, confirm the intended report flow works, and verify a second child is unchanged.
4. Attempt another-school and unlinked child IDs; verify no status/data or writes are permitted.
5. Simulate an audit/database failure; ensure no successful consent update is reported and transaction changes roll back.
6. Read a conversation as an allocated teacher, check its audit, then try an unallocated teacher and an audit-write failure.
7. Check phone/tablet layout, keyboard focus, slow responses, expired login and failed saves in Child Profile.
8. In a test provider adapter, inspect redaction for synthetic identifiers and assess whether educational content is preserved. Never use real child PII as a test fixture.
