#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { jsPDF } = require('../frontend/node_modules/jspdf');

const outputPath = path.join(__dirname, 'EEC_Data_Collection_Purpose_and_Use_Inventory.pdf');
const fontRegular = '/usr/share/fonts/truetype/lato/Lato-Medium.ttf';
const fontBold = '/usr/share/fonts/truetype/lato/Lato-Semibold.ttf';

const rows = [
  {
    no: '1',
    data: '**School / institution onboarding data**\nName, school code, campuses and addresses, school type, board, academic-year structure, estimated users, website, official email, contact person/phone, registration status, verification documents, subscription plan/status, commercial and payment status, administrative notes.',
    why: 'To verify that the institution is genuine and authorised, create its EEC tenant, configure the subscription and provide onboarding, billing and support.',
    use: 'EEC stores the record, reviews uploaded verification documents, approves or rejects registration, creates the school/tenant, activates subscribed features, manages renewals and contacts the authorised representative. Verification files may be stored through configured media/file storage. Access should be limited to authorised platform staff.'
  },
  {
    no: '2',
    data: '**Tenant, domain and branding configuration**\nOrganisation name, slug, domains/custom domains, school linkage, logo, favicon, colours, theme, settings, feature flags and payment-gateway configuration.',
    why: 'To separate each institution, route users to the correct tenant and provide the school’s approved branding and enabled modules.',
    use: 'EEC uses this data to resolve the institution from the domain, isolate records, display approved branding, enable features and apply tenant-specific settings. Payment-gateway secrets are intended to be encrypted and hidden from normal responses.'
  },
  {
    no: '3',
    data: '**Administrator and principal account data**\nName, username, email/mobile where configured, password hash, role, permissions, school/campus, status, login and account-management records.',
    why: 'To authenticate authorised decision-makers and control administrative access.',
    use: 'EEC creates the account, verifies credentials, issues an authenticated session/token, applies role and tenant permissions, records sensitive administrative actions and allows authorised configuration and reporting.'
  },
  {
    no: '4',
    data: '**Teacher and staff identity / employment data**\nName, employee or teacher identifier, username, contact details, photograph, department/designation, qualifications where entered, school/campus, classes/subjects allocated, attendance, leave, timetable and expense information.',
    why: 'To administer the institution workforce and allow personnel to perform assigned educational or operational duties.',
    use: 'EEC authenticates the user, assigns classes/subjects and permissions, generates timetables, records attendance and leave, supports expense/HR workflows and shows authorised information to school administrators. **Module dependent.**'
  },
  {
    no: '5',
    data: '**Student identity and enrolment data**\nUsername, password hash, student code, name, profile photograph, grade, section, roll number, gender, date/place of birth, admission date/number, academic year, batch/course, enrolment/form/serial numbers, address, PIN code, nationality, previous-school and transfer-certificate details, status and archive history.',
    why: 'To create the student record, establish enrolment and place the learner in the correct institution, campus, class, section, course and academic year.',
    use: 'EEC authenticates the Student, displays the correct portal, links academic and administrative records, prepares class lists and reports, maintains promotion/archive history and makes limited data available to authorised teachers, administrators and linked parents.'
  },
  {
    no: '6',
    data: '**Student contact and family / guardian data**\nStudent mobile, email and addresses; father/mother/guardian names, phones, email and occupations; parent/guardian link and emergency-contact information.',
    why: 'To maintain school records, verify family relationships, provide parent access and support communications or emergencies.',
    use: 'EEC stores the information in the institution tenant, links a verified parent/guardian account to the Student, sends authorised notices and permits role-limited parent views. Selected student and parent contact fields are encrypted by the current backend model. Relationship and access must be verified by the school.'
  },
  {
    no: '7',
    data: '**High-risk student profile data – collect only when necessary**\nBlood group, health issues, allergies, immunisation status, learning disabilities, caste, category, religion, Aadhaar number, birth-certificate number and related remarks.',
    why: 'Potentially for admission/legal records, emergency response, accessibility, learning support or institution reporting where a specific lawful requirement exists.',
    use: 'EEC can store and display these fields to authorised institution personnel. They should be disabled or left blank unless the school documents necessity, notice/consent or other lawful authority, access restrictions and retention. **They must not be used for advertising, unrelated profiling or unfair treatment. Current encryption does not cover every high-risk field; this requires remediation and legal review.**'
  },
  {
    no: '8',
    data: '**Parent / guardian account data**\nName, username, password hash, mobile, email, address, linked Student identifiers, relationship/authorisation and account activity.',
    why: 'To verify the adult account and provide access to authorised information about the linked child.',
    use: 'EEC authenticates the parent/guardian, verifies and enforces the child link, shows attendance, results, fees, notifications and other permitted reports, supports communications with the institution and records relevant actions. Contact fields are encrypted by the current model.'
  },
  {
    no: '9',
    data: '**Attendance, timetable and scheduling data**\nStudent/teacher identifiers, date, present/absent status, subject, entry/exit or schedule details, classes, rooms, meetings, holidays and timetable allocations.',
    why: 'To operate daily school schedules, record participation and keep authorised users informed.',
    use: 'EEC records attendance, generates summaries and reports, displays schedules, notifies relevant users and may use attendance as contextual information in dashboards or interventions. Attendance should not be treated by itself as proof of learning.'
  },
  {
    no: '10',
    data: '**Curriculum, lesson and teaching-material data**\nSubjects, curriculum maps, lesson plans, teacher materials, reading materials, rubrics, questions, external resources, uploaded documents and publication status.',
    why: 'To organise teaching content, deliver lessons and ground assessment or AI-assisted learning in institution-approved material.',
    use: 'EEC stores and presents content to authorised classes/users. Published teacher documents may be parsed, chunked, converted into embeddings and indexed in Qdrant/vector search so the AI tutor can retrieve relevant passages. Source and tenant metadata should be preserved.'
  },
  {
    no: '11',
    data: '**Assignments, examinations and results**\nAssignments, questions, answers/submissions, attempt times, marks, grades, feedback, exam results, report-card data, practice papers, quizzes, tryout/baseline results and promotion history.',
    why: 'To deliver assessments, evaluate submitted work, report achievement and manage academic progression.',
    use: 'EEC presents assignments/exams, stores submissions and attempts, calculates or records results, generates authorised reports and dashboards, and makes relevant results available to Students, teachers, administrators and linked parents. Important grading and promotion decisions require institution review.'
  },
  {
    no: '12',
    data: '**Learning progress, mastery and recommendation data**\nPractice attempts, mastery scores, progress records, strengths, weak areas, misconceptions, badges, spaced-repetition schedules, learning paths, student insights, development-category scores and intervention outcomes.',
    why: 'To help Students and educators understand progress, select practice and plan support.',
    use: 'EEC aggregates learning events into dashboards, schedules review, suggests learning paths or interventions and shows explanations to authorised users. These indicators may be algorithmic or model-generated and should be treated as support information—not as a sole or definitive measure of ability.'
  },
  {
    no: '13',
    data: '**Behaviour, wellbeing, observation and journal data**\nBehaviour events, mood/wellbeing entries, teacher/parent observations, notes, journal text, tags, intervention logs, remarks, risk or support indicators and parent-notification status.',
    why: 'To support pastoral care, student wellbeing, behaviour management, educator/parent collaboration and documented interventions.',
    use: 'EEC stores records, displays them to specifically authorised roles, supports follow-up/intervention tracking and may create summaries. **This is sensitive child-context data:** access, visibility, retention and parent/student disclosure rules must be defined; safeguarding concerns must be escalated to qualified humans rather than handled only by automation.'
  },
  {
    no: '14',
    data: '**Achievements, certificates and participation records**\nAchievement title/category/date, description, award type, issuer, certificate URL, badges and extracurricular or sports records.',
    why: 'To recognise and display authorised student achievements and participation.',
    use: 'EEC stores the achievement, displays it in authorised student/parent/teacher views and may include it in development or profile reports. Public sharing should require separate authority.'
  },
  {
    no: '15',
    data: '**Messages and collaboration content**\nChat threads, sender identity/type/name, text or encrypted ciphertext, encryption metadata/wrapped keys, timestamps, seen/read status, posts, comments, submissions, meeting requests and other communications.',
    why: 'To enable school-authorised communication and collaboration among Students, teachers, parents, principals and administrators.',
    use: 'EEC delivers and stores messages within authorised threads, synchronises chat in real time, records delivery/read status and may send notifications. Some chat content supports end-to-end encrypted storage; access and moderation depend on the feature and school policy. Do not submit unnecessary medical, financial or identity data.'
  },
  {
    no: '16',
    data: '**AI tutor conversations and learning memory**\nStudent identifier, school/campus, subject/topic, prompts/questions, assistant responses, chat title, errors, conversation history, rolling generated summary, key learning insights and session count.',
    why: 'To answer learning questions, preserve conversation continuity and provide more relevant educational support.',
    use: 'EEC stores tutor history, retrieves approved teaching content, generates responses and may create a rolling memory summary. Processing uses local models by default in the current configuration; content **may be sent to OpenRouter or another configured external model provider** when enabled. It must not be used to train a general model without an approved lawful process. Retention and deletion must include conversation, memory and vector records.'
  },
  {
    no: '17',
    data: '**Reading and speech-assessment data**\nAudio recording during processing, transcript, duration, reading speed, pronunciation/fluency/grammar/confidence/accent scores, mispronounced/missed/extra words, strengths, weaknesses, suggestions, raw evaluation and embedding status.',
    why: 'To provide reading, speech and pronunciation feedback and track language practice.',
    use: 'EEC transcribes audio using Whisper, evaluates speech/pronunciation using configured local models, stores transcript and assessment results, updates the language profile and displays feedback to authorised users. **Confirm whether raw audio is retained, where it is processed and the deletion period; accent/child-speech accuracy and fairness require evaluation.**'
  },
  {
    no: '18',
    data: '**Writing-assessment data**\nWriting prompt, student submission, word/character counts, grammar/vocabulary/tone/coherence and other scores, corrections, explanations, improved version, CEFR level, strengths, weaknesses, raw evaluation and embedding status.',
    why: 'To provide writing feedback and help educators and Students identify development areas.',
    use: 'EEC processes the submission with the configured assessment model, stores the original and generated analysis, updates the language profile and presents feedback. A teacher/Student must be able to review and correct generated feedback; improved versions should not be represented as the Student’s own work.'
  },
  {
    no: '19',
    data: '**Uploaded files and media**\nSchool logos and verification documents; photographs; certificates; teaching materials; assignment or alcove submissions; images, audio and other enabled uploads; original filename, URL/storage identifier and upload time.',
    why: 'To verify institutions, display profiles/branding, deliver teaching content and support enabled workflows.',
    use: 'EEC uploads or references files through configured storage such as Cloudinary or approved object storage, links them to the relevant tenant/user/record and serves them to authorised users. Teacher materials may also be indexed for retrieval. File-type, malware, access, retention and deletion controls must be documented.'
  },
  {
    no: '20',
    data: '**Fees, invoices and payment records**\nStudent/invoice identifiers, fee heads/installments, amount due/paid/balance/discount/late fee, due date, currency, payment method, transaction/reference/UTR, bank name where entered, payment date, gateway/order/payment identifiers, status, failure reason, payer role and notes.',
    why: 'To bill institution-authorised fees, receive or record payments, issue receipts and reconcile transactions.',
    use: 'EEC creates invoices, displays dues, initiates and verifies configured Razorpay payments, records cash/manual or online payment references, updates balances and provides reports/receipts. Complete card numbers, CVV/CVC, PINs, OTPs and banking passwords should remain with the payment provider and must not be entered into EEC support or notes.'
  },
  {
    no: '21',
    data: '**Teacher / staff HR workflow data**\nAttendance, entry/exit or status, leave type/dates/reason/approval, expense amount/category/description/receipt and related administrative decisions.',
    why: 'To support institution HR, leave, attendance and reimbursement workflows.',
    use: 'EEC stores the request or record, routes it to authorised administrators, records approval/status and produces institution reports. The institution determines the lawful employment purpose, access and retention. **Module dependent.**'
  },
  {
    no: '22',
    data: '**Support, complaints and feedback**\nTicket number/type/category, subject, message, priority, school/user identity and role, contact email/phone, target account, request details, resolution notes, password-reset activity and audit trail.',
    why: 'To answer questions, resolve faults, process complaints or authorised password resets and improve service operations.',
    use: 'EEC creates and assigns a support ticket, contacts the requester, investigates the relevant tenant/account, records actions and resolution, and uses aggregated issue patterns to improve reliability. Support staff should not request passwords, OTPs or unnecessary child data.'
  },
  {
    no: '23',
    data: '**Notifications and push-subscription data**\nUser/school/campus identifiers, user type, notification title/message/category, read/dismissed status, browser push endpoint, cryptographic subscription keys, user agent, delivery success/failure and permission state.',
    why: 'To deliver institution, assignment, exam, meeting, fee, security or other service notifications.',
    use: 'EEC stores in-app notifications, sends browser/desktop push messages after permission, records read/delivery state and disables failed subscriptions. Push content should be minimised because it may appear on a locked or shared device.'
  },
  {
    no: '24',
    data: '**Technical, authentication, audit and security data**\nIP address, timestamps, login and authentication events, actor/user identity and type, action, affected entity, device/browser or user-agent information, request and error details, security events and selected metadata.',
    why: 'To authenticate users, maintain tenant security, diagnose faults, prevent fraud/abuse, investigate incidents and demonstrate accountability.',
    use: 'EEC issues and validates access tokens, rate-limits requests, logs authorised and suspicious actions, detects errors or attacks and supports incident response. Logs must avoid secrets and unnecessary content, be access-restricted and retained only for the approved security/legal period.'
  },
  {
    no: '25',
    data: '**Browser storage and local preferences**\nAuthentication token and user type; cached API/chat data; UI theme or wallpaper; learning-continuity path; points/award flags; notification prompt timing; feedback-submitted flag and other local/session state.',
    why: 'To keep the user signed in, improve performance and remember device-specific preferences or unfinished activity.',
    use: 'The EEC web client stores these values in localStorage or sessionStorage on the user’s device and reads them on later visits. They are removed on sign-out only where the implemented logout flow clears them. Shared-device risk, cache expiry and minimisation require review; highly sensitive content should not be cached locally.'
  },
  {
    no: '26',
    data: '**Consent, archive, retention and deletion metadata**\nParent-consent timestamp/name, account last login, archive status/date/placement, data-retention expiry and timestamps for creation/update/deletion workflows.',
    why: 'To demonstrate authority, manage student exit/promotion, apply retention rules and support rights or deletion requests.',
    use: 'EEC records consent and archive metadata and can identify records for lifecycle action. **The repository does not yet demonstrate a complete, enforced retention/deletion process across every collection, uploaded file, Qdrant/vector record, AI memory, cache and backup. A final retention schedule and deletion workflow must be approved before publication.**'
  },
  {
    no: '27',
    data: '**Data shared with service providers – only when configured**\nPayment and transaction data to Razorpay; files/media to Cloudinary or configured storage; email details to the configured mail provider; push endpoint/keys to browser push services; teacher/student content or prompts to configured AI/model services; embeddings/content to Qdrant; meeting data to an enabled meeting provider such as Jitsi.',
    why: 'To deliver payments, storage, email, notifications, AI/retrieval and meeting functionality that EEC does not provide entirely within the browser or primary application server.',
    use: 'EEC sends only the data needed for the enabled service and receives status or outputs. Each provider, legal entity, purpose, location, retention, training/independent use, security and deletion terms must be recorded in a current subprocessor list. **No optional provider should receive student data until the school configuration, contract and privacy review authorise it.**'
  }
];

const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
doc.setProperties({
  title: 'EEC – Data Collection, Purpose and Use Inventory',
  subject: 'What data EEC collects, why it is collected and what EEC does with it',
  author: 'YarrowTech / EEC',
  creator: 'OpenAI Codex'
});
doc.addFileToVFS('Lato-Regular.ttf', fs.readFileSync(fontRegular).toString('base64'));
doc.addFont('Lato-Regular.ttf', 'Lato', 'normal');
doc.addFileToVFS('Lato-Bold.ttf', fs.readFileSync(fontBold).toString('base64'));
doc.addFont('Lato-Bold.ttf', 'Lato', 'bold');

const pageWidth = 297;
const pageHeight = 210;
const marginX = 6;
const topOther = 7;
const bottom = 10;
const widths = [10, 77, 71, 127];
const xs = [marginX, marginX + widths[0], marginX + widths[0] + widths[1], marginX + widths[0] + widths[1] + widths[2]];
const lineHeight = 3.85;
const fontSize = 8.1;
const paddingX = 1.7;
const paddingY = 1.7;
const headerHeight = 12;
let y = 24;

function setFont(style = 'normal', size = fontSize) {
  doc.setFont('Lato', style);
  doc.setFontSize(size);
}

function breakLongToken(token, maxWidth, style) {
  setFont(style);
  if (doc.getTextWidth(token) <= maxWidth) return [token];
  const pieces = [];
  let current = '';
  for (const char of token) {
    const test = current + char;
    if (current && doc.getTextWidth(test) > maxWidth) {
      pieces.push(current);
      current = char;
    } else current = test;
  }
  if (current) pieces.push(current);
  return pieces;
}

function layoutRichText(markup, maxWidth, forceBold = false) {
  const lines = [[]];
  let currentWidth = 0;
  let bold = forceBold;
  const tokens = markup.split(/(\*\*|\n|\s+)/).filter((token) => token !== '');

  function newLine() {
    lines.push([]);
    currentWidth = 0;
  }

  for (const token of tokens) {
    if (token === '**') {
      if (!forceBold) bold = !bold;
      continue;
    }
    if (token === '\n') {
      newLine();
      continue;
    }
    const style = bold ? 'bold' : 'normal';
    const normalized = token.replace(/\s+/g, ' ');
    if (normalized === ' ' && currentWidth === 0) continue;
    for (const piece of breakLongToken(normalized, maxWidth, style)) {
      setFont(style);
      const width = doc.getTextWidth(piece);
      if (currentWidth > 0 && currentWidth + width > maxWidth) newLine();
      const value = currentWidth === 0 ? piece.replace(/^ +/, '') : piece;
      setFont(style);
      const valueWidth = doc.getTextWidth(value);
      if (value) lines[lines.length - 1].push({ text: value, style, width: valueWidth });
      currentWidth += valueWidth;
    }
  }
  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}

function drawRichLines(lines, x, startY) {
  lines.forEach((line, index) => {
    let cursorX = x;
    for (const span of line) {
      setFont(span.style);
      doc.text(span.text, cursorX, startY + index * lineHeight, { baseline: 'top' });
      cursorX += span.width;
    }
  });
}

function drawTitle() {
  setFont('bold', 14);
  doc.text('EEC – DATA COLLECTION, PURPOSE AND USE INVENTORY', marginX, 7, { baseline: 'top' });
  setFont('normal', 8.3);
  doc.text('Implementation-backed draft: what EEC collects, why it is needed, and what happens to it. Module-dependent and high-risk fields must be confirmed before publication.', marginX, 14, { baseline: 'top' });
  doc.text('Scope reviewed: backend models, AI service configuration, payment, upload, communication, push-notification and browser-storage flows. Prepared 26 August 2026.', marginX, 18, { baseline: 'top' });
}

function drawHeader() {
  doc.setDrawColor(0);
  doc.setLineWidth(0.28);
  doc.setFillColor(245, 245, 245);
  widths.forEach((width, index) => doc.rect(xs[index], y, width, headerHeight, 'FD'));
  setFont('bold', 8.8);
  doc.text('No.', xs[0] + widths[0] / 2, y + 4.2, { align: 'center', baseline: 'top' });
  doc.text('What data EEC collects', xs[1] + widths[1] / 2, y + 4.2, { align: 'center', baseline: 'top' });
  doc.text('Why EEC collects it', xs[2] + widths[2] / 2, y + 4.2, { align: 'center', baseline: 'top' });
  doc.text('What EEC does with it', xs[3] + widths[3] / 2, y + 4.2, { align: 'center', baseline: 'top' });
  y += headerHeight;
}

function newPage() {
  doc.addPage();
  y = topOther;
  drawHeader();
}

function drawRow(row) {
  let noLines = layoutRichText(row.no, widths[0] - 2 * paddingX, true);
  let dataLines = layoutRichText(row.data, widths[1] - 2 * paddingX);
  let whyLines = layoutRichText(row.why, widths[2] - 2 * paddingX);
  let useLines = layoutRichText(row.use, widths[3] - 2 * paddingX);
  let firstChunk = true;

  while (noLines.length || dataLines.length || whyLines.length || useLines.length) {
    let available = pageHeight - bottom - y;
    if (available < 18) {
      newPage();
      available = pageHeight - bottom - y;
    }
    const maxLines = Math.max(1, Math.floor((available - 2 * paddingY) / lineHeight));
    const longest = Math.max(noLines.length, dataLines.length, whyLines.length, useLines.length);
    const take = Math.min(longest, maxLines);
    const noChunk = firstChunk ? noLines.splice(0, take) : [];
    const dataChunk = dataLines.splice(0, take);
    const whyChunk = whyLines.splice(0, take);
    const useChunk = useLines.splice(0, take);
    if (!firstChunk) noLines = [];
    const usedLines = Math.max(1, noChunk.length, dataChunk.length, whyChunk.length, useChunk.length);
    const height = usedLines * lineHeight + 2 * paddingY;

    doc.setDrawColor(0);
    doc.setLineWidth(0.23);
    widths.forEach((width, index) => doc.rect(xs[index], y, width, height));
    drawRichLines(noChunk, xs[0] + paddingX, y + paddingY);
    drawRichLines(dataChunk, xs[1] + paddingX, y + paddingY);
    drawRichLines(whyChunk, xs[2] + paddingX, y + paddingY);
    drawRichLines(useChunk, xs[3] + paddingX, y + paddingY);
    y += height;
    firstChunk = false;

    if (dataLines.length || whyLines.length || useLines.length) newPage();
  }
}

drawTitle();
drawHeader();
rows.forEach(drawRow);

const pages = doc.getNumberOfPages();
for (let page = 1; page <= pages; page += 1) {
  doc.setPage(page);
  setFont('normal', 7.1);
  doc.setTextColor(85);
  doc.text(`EEC data inventory – confirm scope, retention, recipients and legal basis before publication | Page ${page} of ${pages}`, pageWidth / 2, pageHeight - 5.1, { align: 'center' });
  doc.setTextColor(0);
}

fs.writeFileSync(outputPath, Buffer.from(doc.output('arraybuffer')));
console.log(outputPath);
