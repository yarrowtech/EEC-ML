# EEC ML Platform Cost Plan

This document is a planning estimate for running the EEC school-management and AI-learning platform in production. Prices are indicative monthly estimates in Indian rupees (INR), excluding GST, and must be confirmed with providers before procurement.

## Assumptions

- 10 schools and approximately 1,000 registered users.
- 600–700 daily active users and 150–200 peak concurrent users.
- Node.js/Express backend, FastAPI AI service, React/Vite frontend, MongoDB, object storage, and Socket.IO.
- Approximately 100,000–150,000 API requests per day and 10–20 GB of new files per month.
- One primary region with disaster-recovery backups in another region.

## Recommended architecture

```text
Users → CDN/WAF → Frontend → Load balancer → Node.js API + FastAPI AI
                                      ↓
                              MongoDB Atlas replica set
                                      ↓
                         Continuous backup + encrypted S3 archive
```

The S3 backup bucket should be in a separate AWS account, or at minimum a separate security boundary, and preferably a different region from production. It must not be hosted on the application server.

## Monthly infrastructure estimate

| Component | Starter / pilot | Production baseline | Notes |
|---|---:|---:|---|
| Frontend hosting and CDN | ₹0–₹1,500 | ₹1,500–₹4,000 | Vercel/Netlify or S3 + CloudFront |
| Node.js backend server | ₹2,000–₹5,000 | ₹5,000–₹12,000 | 2–4 vCPU; use two instances for high availability |
| FastAPI AI service | ₹2,000–₹8,000 | ₹8,000–₹30,000 | CPU instance; GPU costs are separate |
| Load balancer and TLS | ₹0–₹3,000 | ₹3,000–₹8,000 | Managed load balancer; SSL is usually free |
| MongoDB Atlas primary | ₹4,000–₹10,000 | ₹12,000–₹30,000 | Replica set, storage, IOPS, and backup tier vary |
| Redis/cache, if required | ₹0–₹3,000 | ₹3,000–₹8,000 | Sessions, queues, rate limits, and Socket.IO scaling |
| User file storage | ₹500–₹4,000 | ₹2,000–₹12,000 | S3 recommended; Cloudinary may cost more |
| MongoDB backup archive on S3 | ₹200–₹2,000 | ₹1,000–₹8,000 | Retention, replication, and restore volume dependent |
| Email/SMS/push | ₹500–₹5,000 | ₹3,000–₹25,000 | SMS/WhatsApp usually costs more than email |
| Monitoring and logs | ₹1,000–₹5,000 | ₹5,000–₹20,000 | CloudWatch, Sentry, retention, uptime checks |
| Security services | ₹0–₹3,000 | ₹3,000–₹15,000 | WAF, secrets, scanning, audit logs |
| Domain/DNS | ₹100–₹1,000 | ₹500–₹2,000 | Renewal and DNS hosting |
| **Total, excluding AI model usage** | **₹10,300–₹50,500** | **₹46,500–₹174,000** | Broad planning range |

## MongoDB and S3 backup costs

Use MongoDB Atlas rather than installing MongoDB on the same server as the API.

- Pilot/shared MongoDB cluster: approximately ₹4,000–₹10,000/month.
- Production replica-set cluster: approximately ₹12,000–₹30,000/month.
- Larger or highly available deployment: ₹30,000+/month.

Enable automated snapshots and point-in-time recovery. Also export encrypted archives to a private S3 bucket such as:

```text
s3://eec-mongodb-backups-prod/mongodb/YYYY/MM/DD/backup.archive.gz
```

S3 Standard storage is roughly ₹2–₹5 per GB/month. A 100 GB archive may cost only a few hundred rupees monthly for storage, but cross-region replication, Object Lock, long retention, and restore operations can raise the total to ₹1,000–₹8,000/month or more.

Recommended retention:

- Daily backups: 30–90 days.
- Weekly backups: 6–12 months.
- Monthly backups: 1–7 years, according to contracts and legal requirements.

Enable Block Public Access, versioning, Object Lock/WORM retention, KMS encryption, CloudTrail, and a separate backup IAM role. Test a restore at least quarterly.

## AI and external API costs

AI usage is variable and should be budgeted separately from server hosting.

| API/service | Planning estimate | Cost driver |
|---|---:|---|
| OpenAI/other LLM API | ₹5,000–₹75,000+/month | Prompts, output tokens, model, tutor requests |
| Embeddings/vector indexing | ₹500–₹15,000/month | Documents ingested and embedding size |
| Speech-to-text | ₹1,000–₹30,000/month | Audio minutes processed |
| Text-to-speech | ₹500–₹20,000/month | Characters or audio minutes |
| Vision/image understanding | ₹1,000–₹30,000/month | Images and model selected |
| Qdrant/vector database | ₹0–₹15,000/month | Self-hosted server or managed cluster |
| GPU hosting for local models | ₹25,000–₹2,00,000+/month | GPU type, uptime, and storage |
| Cloudinary media | ₹2,000–₹15,000+/month | Storage, bandwidth, transformations |

The AI service includes Qdrant, OpenAI-compatible clients, speech libraries, OCR, and document processing. Local CPU inference can reduce API bills but needs more capacity and is slower. Add a dedicated GPU only after measuring usage.

Control AI spend with monthly provider limits, per-school quotas, token/cost logging, embedding caches, cheaper models for routine tasks, and asynchronous document ingestion. Browsers must never call AI providers directly.

## Communication and payment costs

- Email services such as AWS SES, Postmark, or SendGrid: approximately ₹500–₹5,000/month for normal notifications.
- SMS/WhatsApp: approximately ₹2,000–₹25,000/month initially; actual price depends on templates, operator, and volume.
- Payment gateways: commonly a percentage plus taxes per transaction. For example, ₹10,00,000 monthly collections at an effective 2% plus GST would cost approximately ₹23,600.

## Maintenance and staffing

Infrastructure bills do not include people. Plan approximately ₹50,000–₹1,50,000/month for part-time production maintenance and support. A dedicated team or 24/7 SLA may require ₹2,00,000–₹6,00,000+/month.

Typical work includes dependency updates, security reviews, monitoring, incident response, backup restore tests, database maintenance, school onboarding, and data migrations.

### DevOps salary planning

Indicative India salary ranges for a DevOps/SRE engineer are:

| DevOps role | Monthly salary | Annual salary | Suitable use |
|---|---:|---:|---|
| Junior DevOps engineer | ₹35,000–₹70,000 | ₹4.2–₹8.4 lakh | CI/CD, deployments, logs, routine monitoring |
| Mid-level DevOps engineer | ₹70,000–₹1,50,000 | ₹8.4–₹18 lakh | Cloud, backups, security, scaling, incident response |
| Senior DevOps/SRE engineer | ₹1,50,000–₹3,00,000+ | ₹18–₹36 lakh+ | Architecture, reliability, compliance, 24/7 readiness |
| Part-time consultant | ₹25,000–₹1,00,000/month | Contract based | Pilot deployments and periodic reviews |

For the first production release, a mid-level DevOps engineer or an experienced part-time consultant should own infrastructure-as-code, CI/CD, secrets, monitoring, backup verification, restore drills, patching, and disaster recovery. Salary figures exclude employer costs, benefits, hiring fees, and taxes; budget an additional 15–25% for those costs where applicable.

### Staffing budget including DevOps

| Operating model | Monthly people cost | Annual people cost |
|---|---:|---:|
| Pilot with consultant | ₹25,000–₹1,00,000 | ₹3–₹12 lakh |
| One junior DevOps engineer | ₹40,000–₹85,000 | ₹4.8–₹10.2 lakh |
| One mid-level DevOps engineer | ₹80,000–₹1,88,000 | ₹9.6–₹22.6 lakh |
| DevOps plus application/support team | ₹1,50,000–₹4,00,000+ | ₹18–₹48 lakh+ |

These people costs are separate from cloud infrastructure and AI API bills. A 24/7 support commitment normally requires on-call coverage or a managed operations provider, not just one engineer working normal office hours.

## One-time and occasional costs

- Initial deployment and security hardening: ₹50,000–₹2,00,000.
- Legacy data migration per school: ₹10,000–₹1,00,000+, based on data quality and volume.
- Security penetration test: ₹75,000–₹5,00,000+.
- Disaster-recovery exercise: ₹10,000–₹50,000 per exercise.

## Recommended total budgets

### Pilot: 1–3 schools

- Infrastructure: ₹15,000–₹50,000/month.
- AI/external APIs: ₹5,000–₹30,000/month.
- Maintenance/support: ₹30,000–₹1,00,000/month.
- **Expected total: ₹50,000–₹1,80,000/month.**

### Initial production: approximately 10 schools

- Infrastructure: ₹46,500–₹1,74,000/month.
- AI/external APIs: ₹10,000–₹1,00,000/month.
- Maintenance/support: ₹50,000–₹1,50,000/month.
- **Expected total: ₹1,06,500–₹4,24,000/month**, excluding payment fees and taxes.

### Larger operation: 50+ schools

Use separate API workers, queues, multiple availability zones, formal observability, tenant-isolation testing, and a disaster-recovery plan. Budget approximately **₹3,00,000–₹10,00,000+/month**, driven mainly by AI, media, support, and SLA requirements.

## Cost controls

- Tag cloud resources by environment, service, and school where possible.
- Set billing alerts at 50%, 75%, and 100% of the monthly budget.
- Review MongoDB, S3, CDN, AI, email, and SMS usage monthly.
- Keep development, staging, and production accounts/projects separate.
- Confirm provider pricing, regional taxes, data-transfer fees, and retention requirements before signing contracts.
