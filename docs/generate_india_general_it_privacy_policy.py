#!/usr/bin/env python3
"""Generate a master India privacy-policy template for a portfolio of IT products."""

from __future__ import annotations

import copy
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET

from generate_eec_privacy_policy import DC, CP, TEMPLATE, W, body, heading, make_paragraph, make_run, qn


DOCS_DIR = Path(__file__).resolve().parent
OUTPUT = DOCS_DIR / "India_General_IT_Product_Data_Privacy_Master_Template.docx"


CONTENT: list[tuple[str, str]] = [
    ("title", "MASTER DATA PRIVACY POLICY AND PRODUCT NOTICE TEMPLATE"),
    ("subtitle", "For Information-Technology Products and Services in India"),
    ("center", "Websites | Mobile Applications | SaaS | Enterprise Software | AI/ML | Platforms | Connected Services"),
    ("center", "Version: 1.0 | Prepared: 26 August 2026"),
    ("center", "Policy Owner: [INSERT LEGAL ENTITY / PRIVACY FUNCTION]"),
    ("notice", "CONTROLLED MASTER TEMPLATE – DO NOT PUBLISH UNTIL THE CORE FIELDS AND A PRODUCT SCHEDULE ARE COMPLETED"),
    body("This document provides a common Indian privacy baseline for a portfolio of IT products. It is not a universal, ready-to-publish notice. Each product must complete Schedule A, remove inapplicable clauses, add sector-specific requirements and obtain legal and operational approval. Square-bracketed items are mandatory review fields and appear in red."),
    body("This template is designed around the Digital Personal Data Protection Act, 2023 (\u201cDPDP Act\u201d), Digital Personal Data Protection Rules, 2025 (\u201cDPDP Rules\u201d), Information Technology Act, 2000 (\u201cIT Act\u201d), applicable rules and CERT-In directions. It also identifies common triggers under consumer, intermediary, payment and other sectoral frameworks. It is not legal advice and does not establish compliance merely because it is adopted."),

    heading("1. PURPOSE, STATUS AND SCOPE"),
    body("[INSERT FULL LEGAL NAME AND ENTITY TYPE] (\u201cCompany\u201d, \u201cwe\u201d, \u201cour\u201d or \u201cus\u201d) adopts this Master Data Privacy Policy to establish common principles for Personal Data processed through its information-technology products and services offered in or from India."),
    body("This Master applies to products identified in the approved Product Register and may cover public websites, mobile applications, cloud software, subscription services, APIs, enterprise deployments, online platforms, AI and machine-learning features, communications tools, marketplaces, connected devices and support services (each a \u201cProduct\u201d and collectively the \u201cServices\u201d)."),
    body("A public-facing notice must name the relevant Product, operator, channels, purposes, data categories, recipients, retention, processing locations, rights route and product-specific risks. The Company shall not publish this Master unchanged as the notice for a Product whose actual processing has not been mapped and approved."),
    body("This Master applies to Personal Data processed digitally and to non-digital Personal Data that is subsequently digitised, to the extent covered by applicable law. It does not apply to data made publicly available by the Data Principal or another person under a legal obligation, where the statutory exclusion applies. Anonymous information that cannot reasonably identify an individual is outside scope, but pseudonymised data remains Personal Data where re-identification is reasonably possible."),

    heading("2. DEFINITIONS"),
    body("\u201cData Principal\u201d means the individual to whom Personal Data relates and includes a parent or lawful guardian acting for a child, and a lawful guardian acting for a person with disability, where applicable. \u201cData Fiduciary\u201d means a person who alone or with others determines the purpose and means of processing. \u201cData Processor\u201d means a person processing Personal Data on behalf of a Data Fiduciary. \u201cPersonal Data Breach\u201d, \u201cConsent Manager\u201d and \u201cSignificant Data Fiduciary\u201d have the meanings assigned by applicable law."),
    body("\u201cCustomer\u201d means an organisation or adult individual contracting for a Product. \u201cEnd User\u201d means an individual who accesses or uses a Product, including personnel, customers, consumers, creators, students, patients or other authorised users depending on the Product. \u201cProduct Schedule\u201d means the approved disclosure in Schedule A or its product-specific equivalent."),

    heading("3. COMPANY AND PRODUCT INFORMATION"),
    body("Operator / contracting entity: [INSERT FULL LEGAL NAME, ENTITY TYPE AND REGISTRATION IDENTIFIER]"),
    body("Registered office: [INSERT COMPLETE POSTAL ADDRESS]"),
    body("Corporate website: [INSERT URL]"),
    body("Privacy contact: [INSERT EMAIL, PHONE AND RIGHTS-REQUEST URL]"),
    body("Grievance Officer: [INSERT NAME, DESIGNATION AND CONTACT DETAILS]"),
    body("Product register location: [INSERT INTERNAL REGISTER OWNER AND REPOSITORY]"),
    body("Every Product owner must ensure the entity and contact information displayed in the relevant Product Schedule matches the actual contracting and processing entity."),

    heading("4. APPLICABILITY AND DATA-PROTECTION ROLES"),
    body("The Company may act as Data Fiduciary for its own websites, enquiries, direct user accounts, subscription administration, security, billing, support, product analytics, legal compliance and other purposes it determines."),
    body("For enterprise, white-label, institution-managed or customer-configured Services, the Customer may determine why End User data is processed. The Customer will ordinarily act as Data Fiduciary and the Company as Data Processor for that processing. The agreement and data-processing terms must allocate notice, consent, instruction, rights, security, breach, retention, audit, subprocessor and deletion responsibilities."),
    body("A Product may involve multiple independent or joint roles. The Product Schedule must describe the role for each purpose rather than assigning one role to the entire relationship. [COMPLETE ROLE-MAPPING AND APPROVE CUSTOMER-FACING DATA-PROCESSING TERMS.]"),

    heading("5. CATEGORIES OF PERSONAL DATA"),
    body("Depending on the Product, the Company may process the following categories. Only categories documented in the Product Schedule may be collected:"),
    body("5.1 Identity and profile data \u2013 name, username, photograph, age or date of birth, gender where relevant, account or customer identifiers, organisation, job title and profile attributes."),
    body("5.2 Contact data \u2013 postal address, email, telephone or mobile number, emergency contact and communication preferences."),
    body("5.3 Account and authentication data \u2013 login identifiers, password hashes, multi-factor authentication information, session tokens, recovery information, roles, permissions and account status."),
    body("5.4 Transaction and commercial data \u2013 subscriptions, orders, invoices, fees, purchases, refunds, transaction references, delivery or fulfilment details, entitlements and customer-service history."),
    body("5.5 Payment and financial data \u2013 payment status, bank or UPI references, billing details, limited payment metadata and, only where lawfully required, financial, KYC, credit or tax information. Payment-instrument credentials should ordinarily be collected directly by an authorised payment provider."),
    body("5.6 Content and communications \u2013 messages, posts, comments, files, documents, images, audio, video, reviews, feedback, support records and other user-generated or customer-supplied content."),
    body("5.7 Product-specific operational data \u2013 records created or managed through the relevant Product, as itemised in its Product Schedule. Examples may include employee, education, health, logistics, retail, hospitality, property, professional-service or other workflow records."),
    body("5.8 Device, network and usage data \u2013 IP address, device and browser details, operating system, application version, timestamps, referring pages, feature interactions, approximate location derived from IP, crash reports, diagnostics, logs and security events."),
    body("5.9 Precise location and sensor data \u2013 GPS, Bluetooth, camera, microphone, motion, device identifiers, telemetry or connected-device readings, only where an enabled feature requires them and the Product gives appropriate notice and controls."),
    body("5.10 AI and inferred data \u2013 prompts, model inputs and outputs, embeddings, classifications, recommendations, predictions, risk or preference indicators, moderation results, confidence information and human-review outcomes."),
    body("5.11 Sensitive-in-context data \u2013 passwords, financial information, health information, sexual orientation, biometric information, caste, religion, disability, government identifiers, precise location, children's data or confidential employment and communications data. These categories require documented necessity, restricted access and enhanced safeguards even where the DPDP Act does not use a separate statutory category."),
    body("5.12 Public and third-party data \u2013 information from public sources, Customer systems, integrations, identity providers, data partners, affiliates or service providers, where collection and reuse are lawful and transparent."),
    body("[COMPLETE A FIELD-LEVEL DATA INVENTORY. REMOVE EVERY CATEGORY NOT USED. IDENTIFY AADHAAR, BIOMETRIC, HEALTH, CHILD, PRECISE-LOCATION, FINANCIAL AND OTHER HIGH-RISK DATA SEPARATELY.]"),

    heading("6. SOURCES AND METHODS OF COLLECTION"),
    body("Personal Data may be collected directly when a person creates an account, buys or subscribes, completes a form, uploads content, communicates, participates in research or support, configures a Product or exercises rights; automatically through devices, logs, cookies, SDKs and similar technologies; from Customers and authorised users; from integrations and identity, payment, delivery, communication, security, analytics or AI providers; and from lawful public or commercial sources."),
    body("Where a Customer or user supplies another person's data, that supplier is responsible for having authority and providing required notice or obtaining required consent. The Company shall not assume that possession of a dataset establishes a lawful purpose."),

    heading("7. PURPOSES OF PROCESSING"),
    body("Subject to the Product Schedule, Personal Data may be processed to:"),
    body("7.1 Provide and administer the Product, including account creation, authentication, permissions, configuration, hosting, storage, synchronisation, fulfilment, support and contracted functionality."),
    body("7.2 Process subscriptions, orders, transactions, payments, refunds, invoices and account entitlements."),
    body("7.3 Communicate service notices, security alerts, transactional messages, support responses and Customer-authorised communications."),
    body("7.4 Secure the Services, prevent fraud and misuse, enforce terms, detect incidents, preserve auditability and protect users, Customers and the public."),
    body("7.5 Personalise or recommend features, content or workflows where lawfully authorised and described, with appropriate controls for children and high-impact decisions."),
    body("7.6 Operate AI-assisted features, retrieval, moderation, translation, transcription, classification, generation, search or analytics as described in Section 13."),
    body("7.7 Measure reliability, diagnose errors, perform research and improve products using data minimisation, aggregation, anonymisation or de-identification where reasonably practicable."),
    body("7.8 Comply with law, lawful directions and regulatory requirements; establish, exercise or defend legal claims; conduct audits and obtain professional advice."),
    body("7.9 Send permitted marketing to adult business contacts or users who have provided any required consent, subject to opt-out."),
    body("Personal Data shall not be sold as an independent data product or used for an incompatible undisclosed purpose. [COMPLETE THE PURPOSE-TO-DATA-TO-ROLE-TO-BASIS MATRIX IN SCHEDULE B.]"),

    heading("8. LAWFUL PURPOSE AND PROCESSING BASIS"),
    body("Where the Company acts as Data Fiduciary, it will process Personal Data for a lawful purpose on consent or another basis permitted by applicable law. Under the DPDP Act this may include a legitimate use specifically recognised by statute; it does not mean an unrestricted \u2018legitimate interests\u2019 basis."),
    body("Where the Company acts as Data Processor, it will process on documented instructions from the relevant Data Fiduciary, subject to applicable law and agreed exceptions for security, legal compliance and service administration."),
    body("Each Product owner must document the actual basis for every purpose and jurisdiction. [LEGAL TO APPROVE THE BASIS REGISTER AND ANY PROCESSING RELYING ON A STATUTORY LEGITIMATE USE, EXEMPTION, EMPLOYMENT PURPOSE, MEDICAL EMERGENCY, STATE FUNCTION OR RESEARCH EXCLUSION.]"),

    heading("9. NOTICE, CONSENT AND WITHDRAWAL"),
    body("Where consent is required, the Product will present a clear and standalone notice in plain language that itemises the Personal Data, specified purposes and enabled goods, services or uses. Consent must be specific, informed, unambiguous and indicated by clear affirmative action. Pre-ticked boxes, bundled unnecessary permissions and inactivity will not be treated as consent."),
    body("The notice must provide a link or other accessible means to withdraw consent, exercise rights and make a complaint. Withdrawal should be as easy as consent. Processing completed before withdrawal remains unaffected, but a Product may stop a feature that cannot operate without the relevant data."),
    body("Consent records shall identify the Data Principal or verified representative, notice and language version, purpose, action, timestamp, source, withdrawal and downstream effect. [DEFINE CONSENT LEDGER, VERSIONING, REVOCATION PROPAGATION AND PROOF-RETENTION PERIOD.]"),

    heading("10. CHILDREN AND PERSONS REQUIRING LAWFUL GUARDIANS"),
    body("A Product must determine whether it is intended for or likely to be used by persons under eighteen years of age. If so, its Product Schedule must state the age range, explain processing in age-appropriate language and implement verifiable parental or lawful-guardian consent where required by law."),
    body("Verification shall use a method permitted under the DPDP Rules and reasonably confirm that the consenting person is an adult parent or lawful guardian. [DOCUMENT AGE-ASSURANCE, PARENT/GUARDIAN LINKAGE, CONSENT EVIDENCE, WITHDRAWAL, ACCOUNT TRANSITION AT MAJORITY AND FAILED-VERIFICATION HANDLING.]"),
    body("The Company shall not undertake tracking or behavioural monitoring of children or targeted advertising directed at children where prohibited, subject to any lawful and documented exemption. Products must not cause processing likely to have a detrimental effect on a child's wellbeing. Profiling, engagement design, communications, location, camera, microphone and AI functions require a child-specific risk assessment."),
    body("Where a lawful guardian acts for a person with disability, the Product must implement the verification and representation mechanism required by applicable law without unnecessarily excluding or burdening the Data Principal."),

    heading("11. SHARING, RECIPIENTS AND DATA PROCESSORS"),
    body("Personal Data may be shared with authorised personnel, Customers, affiliates, professional advisers, auditors, insurers and vendors only where necessary for an approved purpose and subject to appropriate access, confidentiality and data-protection controls."),
    body("Processors may provide hosting, database, storage, content delivery, authentication, email, messaging, customer support, analytics, security, payment, logistics, communications, AI/model, vector-search, transcription, translation, fraud-prevention and other technical services. The current recipient categories and named subprocessors must appear in the Product Schedule or linked register."),
    body("Processor contracts should address documented instructions, confidentiality, security, breach support, deletion or return, subprocessor controls, audit evidence, location, government requests and assistance with Data Principal rights. [COMPLETE SCHEDULE D AND ESTABLISH A VENDOR-DUE-DILIGENCE AND CHANGE-NOTICE PROCESS.]"),
    body("Personal Data may be disclosed where required by law, court order or lawful government direction. Requests should be verified, assessed, minimised and recorded where permitted. Information may also be disclosed in a merger, acquisition, financing, restructuring or sale subject to confidentiality and lawful-purpose safeguards."),

    heading("12. INTERNATIONAL TRANSFER AND DATA LOCATION"),
    body("Personal Data may be processed outside India only as described in the relevant Product Schedule and subject to any restriction or condition specified by the Central Government under the DPDP framework, contractual commitments, sectoral localisation rules and government-access requirements."),
    body("Before enabling a foreign processor or region, the Product owner shall document the country, data, purpose, legal role, onward transfer, security, deletion, government-access and business-continuity implications. [INSERT APPROVED COUNTRIES, HOSTING REGIONS AND TRANSFER CONTROL.]"),

    heading("13. ARTIFICIAL INTELLIGENCE, AUTOMATED PROCESSING AND SYNTHETIC CONTENT"),
    body("A Product may use rules, analytics, machine learning or generative AI only for purposes disclosed in its Product Schedule. AI inputs and outputs may contain Personal Data. Prompts, retrieved content, embeddings, training or evaluation datasets, moderation records and model feedback must therefore be included in data mapping, access, retention, deletion and incident processes."),
    body("AI outputs may be incomplete, inaccurate, biased or unsafe. A Product must provide meaningful human review and a correction or appeal route before an output is used for employment, credit, insurance, admission, education, healthcare, policing, access to an essential service or another decision producing legal or similarly significant effects. [DOCUMENT MODEL PURPOSE, PROVIDER, VERSION, DATA FLOW, EVALUATION, HUMAN OVERRIDE, MONITORING AND ROLLBACK.]"),
    body("Personal Data shall not be used to train or improve a general-purpose or cross-customer model unless the responsible Data Fiduciary has approved a specific lawful and transparent process, data minimisation and any required consent. Customer content must not be exposed across tenants. External model providers may receive only the minimum approved context under appropriate contractual controls."),
    body("Products that create, modify, host or transmit synthetically generated information, including realistic audio, visual or audiovisual content, must assess the IT Rules, 2021 as amended in 2026 and implement any applicable labelling, provenance, user disclosure, verification, due-diligence, grievance and removal obligations. [COMPLETE AN SGI/DEEPFAKE FEATURE ASSESSMENT BEFORE RELEASE.]"),

    heading("14. USER-GENERATED CONTENT AND INTERMEDIARY FEATURES"),
    body("A Product that receives, stores or transmits third-party information, offers user-to-user communications, hosts public content or functions as an intermediary must complete a feature-level assessment under the IT Act and current IT Rules. The assessment must cover terms, due diligence, prohibited content, grievance handling, lawful orders, preservation, removal, user notices, appeals and any additional duties applicable to social-media, gaming, news, marketplace or significant intermediaries."),
    body("[IDENTIFY INTERMEDIARY FEATURES, ENTITY CLASSIFICATION, GRIEVANCE OFFICER, NODAL/COMPLIANCE CONTACTS IF APPLICABLE, TAKEDOWN WORKFLOW, EVIDENCE PRESERVATION AND SGI CONTROLS.]"),

    heading("15. PAYMENTS, E-COMMERCE AND REGULATED FINANCIAL FEATURES"),
    body("Where a Product facilitates payments, a payment gateway or regulated provider should ordinarily collect payment-instrument credentials directly. The Company may process billing details, transaction references and status needed for fulfilment, accounting, fraud management and support. Users must not send complete card numbers, CVV/CVC, PINs, OTPs or banking passwords through ordinary support channels."),
    body("An e-commerce or marketplace Product must assess the Consumer Protection Act, E-Commerce Rules and applicable advertising, pricing, seller, grievance, dark-pattern and consumer-disclosure obligations. A regulated financial or payment Product must separately assess RBI, SEBI, IRDAI, FIU-IND and other applicable requirements, including localisation, outsourcing, KYC, security, retention and incident reporting."),
    body("[IDENTIFY MERCHANT/SELLER/MARKETPLACE/PAYMENT ROLES, PAYMENT PROVIDERS, PCI SCOPE, REFUNDS, KYC, REGULATOR, OUTSOURCING AND CUSTOMER-PROTECTION OBLIGATIONS.]"),

    heading("16. DEVICE PERMISSIONS, LOCATION, BIOMETRICS AND CONNECTED PRODUCTS"),
    body("Camera, microphone, contacts, files, notifications, precise location, Bluetooth, local network, motion, biometric or other device permissions must be requested only when needed for a disclosed feature. The Product should provide just-in-time explanation and remain usable without optional permission where reasonably possible."),
    body("Biometric templates, face or voice recognition, continuous location, health sensors and connected-device telemetry require a high-risk assessment covering necessity, accuracy, bias, security, on-device alternatives, access, retention, deletion and consequences of error. [COMPLETE PERMISSION INVENTORY AND HIGH-RISK APPROVAL.]"),

    heading("17. COOKIES, SDKS AND SIMILAR TECHNOLOGIES"),
    body("Products may use technologies necessary for security, authentication, preferences, load balancing and core functionality. Non-essential advertising, cross-service tracking or analytics technologies will be enabled only after any required notice and consent."),
    body("Each web or mobile Product shall maintain a current cookie and SDK inventory stating provider, data, purpose, duration, recipient and choice. [IMPLEMENT CONSENT/PREFERENCE MANAGEMENT AND VERIFY THAT REJECTION IS HONOURED.]"),

    heading("18. MARKETING AND COMMUNICATION PREFERENCES"),
    body("The Company may send transactional and security communications necessary for the Services. Promotional email, SMS, telephone, push or messaging communications will be sent only where permitted and, where required, with consent. Recipients may opt out of non-essential marketing without losing essential service notices."),
    body("Products must assess telecom and anti-spam requirements, suppression lists, sender registration and channel-specific consent. Children's Personal Data shall not be used for targeted advertising or direct marketing."),

    heading("19. DATA PRINCIPAL RIGHTS"),
    body("Subject to applicable law and statutory commencement, Data Principals may request a summary of Personal Data and processing, identities of relevant recipients, correction, completion or updating, erasure, withdrawal of consent, grievance redressal and nomination. Other rights may apply under sectoral law or contract."),
    body("Requests may be submitted through [INSERT RIGHTS PORTAL/EMAIL]. Identity, account, authority, parenthood or guardianship may be reasonably verified. Verification must be proportionate and must not collect excessive new data."),
    body("If the Company acts only as Data Processor, the requester may be directed to the relevant Customer Data Fiduciary and the Company will provide agreed assistance. Responses may be limited where retention or non-disclosure is required by law or another person's rights would be adversely affected. Reasons and grievance routes will be supplied where required."),
    body("The operational workflow, acknowledgement target, response target, ownership, search scope, legal-hold check, correction, export and deletion evidence are set out in Schedule E. [APPROVE SERVICE LEVELS AND TEST END-TO-END COVERAGE.]"),

    heading("20. GRIEVANCE REDRESSAL, DPO AND CONTACTS"),
    body("Privacy and grievance contact: [INSERT NAME/DESIGNATION, EMAIL, PHONE, POSTAL ADDRESS AND WEB LINK]. The Company shall publish an accessible grievance mechanism and respond within the period required by applicable law and its approved procedure."),
    body("If designated a Significant Data Fiduciary, the Company will appoint a Data Protection Officer based in India and implement applicable assessments, audits and other duties. Even if a statutory DPO is not required, the Company shall assign an accountable privacy owner."),
    body("A Data Principal may complain to the Data Protection Board after exhausting the required grievance process when the relevant statutory provisions are in force. Product-specific regulatory or consumer escalation routes must also be disclosed where applicable."),

    heading("21. RETENTION, INACTIVITY, RETURN AND DELETION"),
    body("Personal Data shall be kept only while needed for its documented purpose, contractual service, security, legal obligation, dispute or legal claim. The Product owner must apply the approved schedule in Schedule C and must not use indefinite or \u2018as long as necessary\u2019 retention without a defined decision rule and owner."),
    body("Deletion must cover production databases, object and file storage, search indexes, vector stores, AI memory, caches, exports and reasonably accessible backups. Customer offboarding must specify export, return, deletion, backup expiry and certification. Legal holds must be authorised, scoped and reviewed."),
    body("Where the DPDP Rules prescribe inactivity notices or erasure for a covered class of Data Fiduciary, the Product shall provide required advance notice and preserve only permitted account-access or legally required information. [COMPLETE RETENTION SCHEDULE, DELETION AUTOMATION, BACKUP EXPIRY AND EVIDENCE.]"),

    heading("22. INFORMATION SECURITY AND PRIVACY BY DESIGN"),
    body("The Company will maintain reasonable technical and organisational safeguards proportionate to the nature, volume, context and risk of Personal Data. Controls may include governance, inventory, tenant segregation, least privilege, authentication and multi-factor authentication, password hashing, encryption in transit and at rest where appropriate, secrets and key management, secure development, threat modelling, code and dependency review, vulnerability management, logging, monitoring, backup, recovery, vendor management and personnel confidentiality."),
    body("New Products and material changes must complete a privacy and security review before launch. High-risk processing should undergo a documented impact assessment covering necessity, proportionality, affected groups, children, bias, surveillance, misuse, security, alternatives and residual risk. Production systems must not use development credentials, public storage or permissive test settings."),
    body("[IDENTIFY SECURITY OWNER, CONTROL STANDARD, ACCESS-REVIEW CADENCE, ENCRYPTION SCOPE, KEY ROTATION, VULNERABILITY/PENETRATION TESTING, BACKUP/DR, SECURE-DEVELOPMENT GATES AND INDEPENDENT ASSURANCE.]"),

    heading("23. PERSONAL DATA BREACHES AND CYBER INCIDENTS"),
    body("The Company will maintain a documented process to identify, report, triage, contain, investigate, preserve evidence, mitigate, notify, recover and review incidents. All personnel and processors must promptly report suspected compromise through [INSERT INCIDENT CHANNEL]."),
    body("The response team shall assess affected data and systems, Data Principals, children or vulnerable persons, likely harm, cross-tenant exposure, recovery, legal obligations and communications. The Company will notify the Data Protection Board and affected Data Principals in the form and stages required by the DPDP Rules when applicable, and meet CERT-In and sectoral reporting requirements."),
    body("CERT-In directions may require specified cyber incidents to be reported within six hours of noticing or being informed of them. Contractual notification to Customers must allow them to meet any shorter statutory deadline. [APPROVE SCHEDULE F, 24x7 OWNER, CONTACT TREE, SIX-HOUR ASSESSMENT PATH, TEMPLATES AND EXERCISE CADENCE.]"),

    heading("24. SECURITY LOGS, MONITORING AND GOVERNMENT REQUESTS"),
    body("Security and operational logging shall be limited to data necessary for detection, investigation, accountability, performance and legal compliance. Access to logs shall be restricted, monitored and time-bound. Products must not place secrets, full payment credentials or unnecessary content in logs."),
    body("System clocks, incident reporting, log retention and production of information shall follow applicable CERT-In directions. Government requests must be routed to authorised legal or compliance personnel, verified and documented, with disclosure limited to what is lawfully required."),

    heading("25. ACCURACY, FAIRNESS AND DATA MINIMISATION"),
    body("Products shall collect only data reasonably necessary for an approved purpose, make reasonable efforts to maintain accuracy where data may be used for a decision or disclosure, and provide appropriate correction mechanisms. Optional fields should be clearly distinguished from required fields."),
    body("Analytics, scoring, ranking, moderation and AI systems must be tested for material error, bias and disproportionate impact in their intended context. A convenient data point is not automatically a fair or valid basis for a consequential decision."),

    heading("26. PRODUCT-SPECIFIC AND SECTORAL REQUIREMENTS"),
    body("This Master does not replace sector-specific assessment. Before launch, the Product owner and Legal must identify every applicable category:"),
    body("26.1 Banking, lending, payments, insurance, securities or virtual digital assets \u2013 assess regulator, KYC/AML, outsourcing, localisation, cyber-resilience, customer protection, retention and breach obligations."),
    body("26.2 Health, wellness, medical devices or telemedicine \u2013 assess professional, clinical, health-record, consent, safety and medical-device requirements; do not imply diagnosis or confidentiality protections not actually implemented."),
    body("26.3 Education and children \u2013 assess verifiable parental consent, age-appropriate notice, child wellbeing, tracking, targeted advertising, school/institution role and safeguarding."),
    body("26.4 Telecommunications, messaging and communications \u2013 assess licences, subscriber verification, lawful interception, retention, spam and sector-security requirements."),
    body("26.5 E-commerce, marketplace, advertising and consumer services \u2013 assess seller/platform role, disclosures, grievances, pricing, dark patterns, advertising and consumer protection."),
    body("26.6 Intermediary, social media, gaming, news, public content and synthetic media \u2013 assess classification, due diligence, takedown, appeals, grievance, SGI and additional significant-intermediary duties."),
    body("26.7 Employment and workforce monitoring \u2013 assess necessity, employee notice, access, surveillance proportionality, retention and labour-law implications."),
    body("26.8 Government, critical infrastructure, defence or regulated enterprise Customers \u2013 assess tender, localisation, secrecy, security, audit and incident terms."),
    body("[LEGAL TO COMPLETE A WRITTEN SECTOR-TRIGGER DECISION FOR EACH PRODUCT. \u2018NOT APPLICABLE\u2019 REQUIRES A RECORDED REASON.]"),

    heading("27. USER AND CUSTOMER RESPONSIBILITIES"),
    body("Users must provide accurate information, protect credentials, respect permissions and other persons' privacy, avoid unlawful or harmful content, and promptly report suspected compromise. They must not bypass security, scrape records, impersonate another person or upload Personal Data without authority."),
    body("Customers acting as Data Fiduciaries must establish lawful purposes and notices, configure least-privilege access, manage End Users and consent, issue documented instructions, review integrations, honour rights, set retention, train administrators and avoid using Product outputs unfairly or without required human review."),

    heading("28. CHANGES, VERSIONING AND PRODUCT NOTICES"),
    body("The Company may update this Master and product notices for changes in processing, Products, law, guidance, providers or controls. Versions, approval, publication date and superseded notices must be recorded. Material changes will be communicated through an appropriate channel, and fresh consent will be obtained where required before affected processing begins."),
    body("Product teams must notify the Privacy owner before enabling a new data category, purpose, integration, processor, country, AI model, audience, device permission or materially different use. [DEFINE CHANGE-TRIGGER AND RELEASE-BLOCKING APPROVAL WORKFLOW.]"),

    heading("29. DPDP TRANSITION AND REVIEW DATES"),
    body("The DPDP Act and DPDP Rules were commenced in stages by notifications dated 13 November 2025. As at 26 August 2026, provisions specified for commencement on publication are operative. Further stages are scheduled one year and eighteen months after Gazette publication, including Rule 4 on 13 November 2026 and Rules 3, 5 to 16, 22 and 23 on 13 May 2027, subject to later notification or corrigendum."),
    body("The Company shall continue to comply with the IT Act, applicable rules, CERT-In directions and sectoral law during the transition. This Master must be reviewed before 13 November 2026, before 13 May 2027 and on any material legal change. [ASSIGN NAMED OWNER AND REVIEW DATES.]"),

    heading("30. GOVERNING LAW AND CONTACT"),
    body("This Policy is governed by the laws of India. Subject to mandatory law and the applicable Product terms, courts and tribunals at [INSERT CITY AND STATE] shall have jurisdiction."),
    body("Questions, rights requests and grievances may be sent to: [INSERT LEGAL ENTITY], [INSERT POSTAL ADDRESS], [INSERT PRIVACY EMAIL], [INSERT PHONE], [INSERT RIGHTS/GRIEVANCE URL]."),

    heading("SCHEDULE A – MANDATORY PRODUCT PRIVACY NOTICE"),
    body("Complete one approved schedule for every Product, deployment model or materially different audience. Publish the relevant information with the Product rather than this blank Master."),
    body("A1. Product name, version and URLs/app-store listings: [INSERT]"),
    body("A2. Operating and contracting entity; Data Fiduciary/Processor role by purpose: [INSERT]"),
    body("A3. Intended users, minimum age, geography and accessibility needs: [INSERT]"),
    body("A4. Enabled features and data categories, including optional fields and device permissions: [INSERT]"),
    body("A5. Itemised purposes, legal basis and whether data is required: [INSERT]"),
    body("A6. Sources, recipients, named processors and integrations: [INSERT]"),
    body("A7. Hosting, processing and support countries/regions: [INSERT]"),
    body("A8. Retention and deletion by category, including backups, logs and offboarding: [INSERT]"),
    body("A9. AI, profiling, automated decisions, model training and human-review route: [INSERT]"),
    body("A10. Children, guardian, high-risk, biometric, location, health or financial controls: [INSERT]"),
    body("A11. Cookies, SDKs, marketing and preference controls: [INSERT]"),
    body("A12. Rights, grievance, regulator and product-support contacts: [INSERT]"),
    body("A13. Product owner, Security approver, Privacy/Legal approver and approval date: [INSERT]"),

    heading("SCHEDULE B – DATA / PURPOSE / ROLE / BASIS REGISTER"),
    body("For each processing activity record: Product; feature; Data Principal; exact field/category; source; purpose; required/optional; Company role; Customer role; lawful basis; consent/notice version; recipients; country; retention; system of record; owner; risk tier; and approval. [ATTACH OR LINK APPROVED REGISTER.]"),

    heading("SCHEDULE C – RETENTION AND DELETION REGISTER"),
    body("For each record category document: purpose; trigger; active period; archive period; legal requirement; system and replicas; backup expiry; deletion/anonymisation method; legal-hold exception; Customer offboarding rule; evidence; owner; and review date. [ATTACH OR LINK APPROVED REGISTER.]"),

    heading("SCHEDULE D – PROCESSOR AND SUBPROCESSOR REGISTER"),
    body("For each provider document: legal entity; service; data; Data Principals; purpose; location; subprocessor chain; contract/DPA; security evidence; retention/deletion; training or independent-use restrictions; breach SLA; government-access process; approval; change notice; and exit plan. [ATTACH OR LINK CURRENT PUBLIC AND INTERNAL VERSIONS.]"),

    heading("SCHEDULE E – DATA PRINCIPAL REQUEST PROCEDURE"),
    body("Minimum workflow: intake and ticket; conflict-safe identity/authority verification; role determination; acknowledgement; system and processor search; legal-hold and exemption review; Customer coordination; access/correction/erasure/withdrawal action; quality review; response; deletion propagation; evidence; appeal or grievance; metrics and periodic test. [INSERT OWNERS AND SLAS.]"),

    heading("SCHEDULE F – BREACH AND CYBER-INCIDENT PROCEDURE"),
    body("Minimum workflow: immediate reporting; severity and six-hour CERT-In triage; containment; evidence preservation; affected systems/data/people/tenants; processor and Customer coordination; legal and child/high-risk assessment; regulatory and Data Principal notifications; recovery; credentials and keys; communications; post-incident review; corrective actions and closure evidence. [INSERT 24x7 CONTACT TREE AND APPROVED TEMPLATES.]"),

    heading("SCHEDULE G – PRODUCT PRIVACY LAUNCH CHECKLIST"),
    body("Release shall be blocked until: Product Schedule approved; data map and role/basis register complete; minimisation performed; child/high-risk/sector assessments complete; consent and notices tested; processors approved; transfers documented; retention and deletion implemented; rights flow tested; security review passed; logging safe; breach owner assigned; AI/SGI controls evaluated; app-store and permission disclosures aligned; accessibility and language reviewed; and evidence stored. [INSERT RELEASE GATE OWNER AND REPOSITORY.]"),

    ("notice", "END OF CONTROLLED MASTER TEMPLATE – ALL RED FIELDS REQUIRE RESOLUTION OR AN APPROVED NOT-APPLICABLE DECISION"),
]


def generate() -> None:
    with ZipFile(TEMPLATE) as zin:
        files = {name: zin.read(name) for name in zin.namelist()}

    document = ET.fromstring(files["word/document.xml"])
    doc_body = document.find(qn(W, "body"))
    if doc_body is None:
        raise RuntimeError("Template document has no body")
    existing = list(doc_body.findall(qn(W, "p")))
    prototypes = {
        "title": existing[0],
        "subtitle": existing[1],
        "center": existing[2],
        "notice": existing[1],
        "heading": existing[5],
        "body": existing[6],
    }
    sect_pr = doc_body.find(qn(W, "sectPr"))
    saved_sect_pr = copy.deepcopy(sect_pr) if sect_pr is not None else None
    for child in list(doc_body):
        doc_body.remove(child)
    for kind, text in CONTENT:
        doc_body.append(make_paragraph(kind, text, prototypes))
    if saved_sect_pr is not None:
        doc_body.append(saved_sect_pr)
    files["word/document.xml"] = ET.tostring(document, encoding="utf-8", xml_declaration=True)

    footer = ET.fromstring(files["word/footer1.xml"])
    footer_p = footer.find(qn(W, "p"))
    if footer_p is not None:
        for child in list(footer_p):
            if child.tag == qn(W, "r"):
                footer_p.remove(child)
        footer_p.append(make_run("India IT Products | Master Data Privacy Template | Controlled draft"))
    files["word/footer1.xml"] = ET.tostring(footer, encoding="utf-8", xml_declaration=True)

    core = ET.fromstring(files["docProps/core.xml"])
    values = {
        qn(DC, "title"): "India General IT Product Data Privacy Master Template",
        qn(DC, "subject"): "Master privacy policy, product notice and implementation schedules for IT products in India",
        qn(DC, "creator"): "Privacy / Legal Template",
        qn(CP, "lastModifiedBy"): "OpenAI Codex",
        qn(DC, "description"): "Product-neutral Indian privacy master covering DPDP transition, IT products, AI, SGI, intermediaries, security and product-specific schedules.",
    }
    for tag, value in values.items():
        node = core.find(tag)
        if node is None:
            node = ET.SubElement(core, tag)
        node.text = value
    files["docProps/core.xml"] = ET.tostring(core, encoding="utf-8", xml_declaration=True)

    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as zout:
        for name, data in files.items():
            zout.writestr(name, data)
    print(OUTPUT)


if __name__ == "__main__":
    generate()
