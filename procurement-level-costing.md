# EEC ML Platform — Procurement-Level Costing

**Status:** Budgetary procurement baseline — vendor quotations must be attached before purchase approval.

**Currency:** Indian rupees (INR), excluding GST unless stated otherwise.

**Target deployment:** Approximately 10 schools, 1,000 registered users, 600–700 daily active users, and 150–200 peak concurrent users.

## Procurement assumptions

- Primary cloud region: AWS Mumbai (`ap-south-1`).
- Frontend: S3/CloudFront or an equivalent managed frontend provider.
- Backend: Node.js/Express and FastAPI services on managed compute or EC2.
- Database: MongoDB Atlas on AWS with a production replica set.
- Backup: MongoDB continuous backup plus encrypted S3 archive in a separate AWS account and preferably a separate region.
- File storage: private S3 bucket; Cloudinary only where image transformation or delivery features require it.
- AI: OpenAI-compatible LLM, embeddings, speech, OCR, and vision APIs as required by actual usage.
- Prices are provisional until current provider quotations, account-specific discounts, GST, and data-transfer charges are confirmed.

## Recurring procurement budget

| Procurement item | Monthly low | Monthly high | Annual low | Annual high | Quote/status |
|---|---:|---:|---:|---:|---|
| Frontend hosting and CDN | ₹1,500 | ₹4,000 | ₹18,000 | ₹48,000 | Confirm provider plan |
| Node.js API compute | ₹5,000 | ₹12,000 | ₹60,000 | ₹1,44,000 | Confirm instance/service |
| FastAPI AI compute | ₹8,000 | ₹30,000 | ₹96,000 | ₹3,60,000 | CPU baseline; GPU excluded |
| Load balancer and ingress | ₹3,000 | ₹8,000 | ₹36,000 | ₹96,000 | Confirm traffic/LCU usage |
| MongoDB Atlas production | ₹12,000 | ₹30,000 | ₹1,44,000 | ₹3,60,000 | Confirm tier, region, storage |
| Redis/cache/queue | ₹3,000 | ₹8,000 | ₹36,000 | ₹96,000 | Optional at launch |
| Application file storage | ₹2,000 | ₹12,000 | ₹24,000 | ₹1,44,000 | S3 or Cloudinary quote |
| MongoDB S3 backup archive | ₹1,000 | ₹8,000 | ₹12,000 | ₹96,000 | Includes retention/replication allowance |
| Email, SMS, and WhatsApp | ₹3,000 | ₹25,000 | ₹36,000 | ₹3,00,000 | Usage-based quotations required |
| Monitoring, logs, and alerting | ₹5,000 | ₹20,000 | ₹60,000 | ₹2,40,000 | CloudWatch/Sentry/etc. |
| WAF, secrets, security tooling | ₹3,000 | ₹15,000 | ₹36,000 | ₹1,80,000 | Confirm rules and log volume |
| Domain and DNS | ₹500 | ₹2,000 | ₹6,000 | ₹24,000 | Renewal dependent |
| AI model and external APIs | ₹15,000 | ₹1,00,000 | ₹1,80,000 | ₹12,00,000 | Must be measured and quota-controlled |
| Payment gateway fees | Variable | Variable | Variable | Variable | Percentage of collections |
| **Infrastructure and service subtotal** | **₹62,000** | **₹2,74,000** | **₹7,44,000** | **₹32,88,000** | Before staffing, GST, contingency |

## People and operations

| Role/service | Monthly low | Monthly high | Annual low | Annual high |
|---|---:|---:|---:|---:|
| Part-time DevOps consultant | ₹25,000 | ₹1,00,000 | ₹3,00,000 | ₹12,00,000 |
| Junior DevOps engineer | ₹40,000 | ₹85,000 | ₹4,80,000 | ₹10,20,000 |
| Mid-level DevOps engineer | ₹80,000 | ₹1,88,000 | ₹9,60,000 | ₹22,56,000 |
| Backend/frontend maintenance | ₹50,000 | ₹2,00,000 | ₹6,00,000 | ₹24,00,000 |
| Support and school onboarding | ₹25,000 | ₹1,00,000 | ₹3,00,000 | ₹12,00,000 |

For the procurement baseline, use a mid-level DevOps engineer plus application/support coverage:

- **People budget:** ₹1,55,000–₹4,88,000/month.
- Add 15–25% for employer costs, benefits, hiring fees, and statutory overhead where applicable.
- A 24/7 SLA requires an on-call rota or managed operations provider; one engineer alone is not sufficient.

## Recommended operating budget

| Budget level | Monthly estimate | Annual estimate | Intended use |
|---|---:|---:|---|
| Minimum controlled launch | ₹2,10,000 | ₹25,20,000 | Low AI usage, consultant DevOps, limited support |
| Recommended procurement baseline | ₹3,50,000 | ₹42,00,000 | 10 schools with production monitoring and backups |
| High-usage / stronger SLA | ₹6,00,000 | ₹72,00,000 | Higher AI/media volume, dedicated staff, stronger availability |

These totals include estimated infrastructure, AI services, communications, DevOps, maintenance, and support. They exclude payment processing fees because those depend on transaction value.

## One-time procurement and implementation budget

| One-time item | Estimated cost |
|---|---:|
| Cloud architecture and production deployment | ₹50,000–₹2,00,000 |
| CI/CD, infrastructure-as-code, secrets, and monitoring setup | ₹50,000–₹2,00,000 |
| MongoDB schema review, indexing, and migration tooling | ₹25,000–₹1,50,000 |
| Initial school data migration | ₹10,000–₹1,00,000 per school |
| Backup restore and disaster-recovery exercise | ₹10,000–₹50,000 |
| Security hardening and penetration test | ₹75,000–₹5,00,000 |
| Documentation and operational runbooks | ₹25,000–₹1,00,000 |
| **Expected one-time launch budget** | **₹2,25,000–₹12,00,000+** |

## Tax and contingency

Add the following to the approved purchase order:

- GST and applicable local taxes: confirm on every vendor invoice.
- Cloud/API overage reserve: 10–20% of recurring services.
- Currency fluctuation reserve: 5–10% for USD-priced services.
- Emergency recovery reserve: at least one month of infrastructure cost.

For approval purposes, add a combined **20–30% contingency** to the selected recurring budget until three months of real usage data is available.

## Vendor quotation checklist

Before issuing a purchase order, obtain written quotations that specify:

1. Vendor name, legal entity, and billing country.
2. Exact plan, region, quantity, and committed term.
3. Included storage, bandwidth, requests, tokens, audio minutes, and support.
4. Overage rates and automatic-spend behavior.
5. GST, taxes, currency conversion, and payment terms.
6. SLA, support response time, and service credits.
7. Data residency, encryption, retention, and deletion terms.
8. Backup retention, restore charges, and recovery-time expectations.
9. Annual renewal price and discount expiry.
10. Exit/export process and assistance if the provider is changed.

## Approval recommendation

Use **₹3,50,000/month plus GST** as the initial procurement baseline for approximately 10 schools, with a one-time implementation budget of **₹2,25,000–₹12,00,000**. Approve the upper range of **₹6,00,000/month** when the platform requires substantial AI usage, SMS/WhatsApp alerts, media storage, dedicated DevOps, or a stronger availability SLA.

This document becomes final only after the selected vendors provide current quotations and the first month of measured usage is used to replace the provisional ranges.
