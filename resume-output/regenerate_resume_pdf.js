const { jsPDF } = require('../frontend/node_modules/jspdf');

const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
const width = pdf.internal.pageSize.getWidth();
const height = pdf.internal.pageSize.getHeight();
const left = 45;
const right = width - 45;
const contentWidth = right - left;
let y = 42;

const font = (size, family = 'helvetica', style = 'normal') => {
  pdf.setFont(family, style);
  pdf.setFontSize(size);
  pdf.setTextColor(17, 17, 17);
};

const write = (value, x = left, size = 7.7, family = 'helvetica', style = 'normal') => {
  font(size, family, style);
  pdf.text(value, x, y);
};

const wrap = (value, size = 7.5, leading = 9.1, indent = 0) => {
  font(size);
  pdf.splitTextToSize(value, contentWidth - indent).forEach((part) => {
    write(part, left + indent, size);
    y += leading;
  });
};

const section = (number, title) => {
  y += 3;
  write(String(number), left, 10.9, 'times', 'bold');
  write(title, left + 18, 10.9, 'times', 'bold');
  y += 12;
};

const bullet = (value, size = 7.45, leading = 8.95) => {
  write('•', left + 3, size);
  wrap(value, size, leading, 13);
  y += 0.7;
};

const entry = (title, date, organization, bullets = []) => {
  write(title, left, 8.05, 'helvetica', 'bold');
  if (date) {
    font(7.65);
    pdf.text(date, right, y, { align: 'right' });
  }
  y += 9.2;
  if (organization) {
    write(organization, left, 7.65);
    y += 8.8;
  }
  bullets.forEach((item) => bullet(item));
  y += 1;
};

pdf.setProperties({
  title: 'Koushik Bala - AI Engineer and Full-Stack Developer Resume',
  author: 'Koushik Bala',
  subject: 'ATS-optimized resume'
});

font(20.5, 'times', 'bold');
pdf.text('Koushik Bala', width / 2, y, { align: 'center' });
y += 20;
font(9.1);
pdf.text('Kolkata, India', width / 2, y, { align: 'center' });
y += 11;
font(8.05);
pdf.text('Phone: +91-9679005154    Email: koushikbala54@gmail.com', width / 2, y, { align: 'center' });
y += 10.5;
pdf.text('GitHub: github.com/koushikbala    LinkedIn: linkedin.com/in/koushikbalasxc', width / 2, y, { align: 'center' });
y += 9.5;
pdf.setDrawColor(34, 34, 34);
pdf.setLineWidth(0.7);
pdf.line(left, y, right, y);
y += 13;

section(1, 'Professional Summary');
wrap('AI Engineer and Full-Stack Developer with hands-on experience building production-oriented AI learning systems, Retrieval-Augmented Generation (RAG) pipelines, LLM evaluation workflows, responsive web applications, REST APIs, and database-driven platforms. Proficient in Python, FastAPI, React, JavaScript, Node.js, Express.js, MongoDB, Mongoose, Qdrant, embeddings, prompt engineering, and AI/ML integration. Experienced in document ingestion, hybrid retrieval, rubric-based scoring, structured model outputs, grounding, guardrails, role-based portals, cloud deployment, and automated testing.');

section(2, 'Technical Skills');
[
  'Programming Languages: Python, JavaScript (ES6+), C, C++, SQL, HTML5, CSS3',
  'Frontend: React, Vite, React Router, Tailwind CSS, Framer Motion, Responsive Design, Accessibility',
  'Backend and APIs: Node.js, Express.js, FastAPI, REST APIs, MongoDB, Mongoose, JWT Authentication, Middleware, Role-Based Access Control',
  'AI Engineering: Python, LLM Integration, Ollama, OpenRouter, Prompt Engineering, AI Orchestration, Structured JSON Outputs, Guardrails, Fallback Design',
  'RAG and Retrieval: Document Ingestion, OCR, Parsing, Chunking, Embeddings, nomic-embed-text, Qdrant, Metadata Filtering, Hybrid Semantic and Keyword Search, Reranking, Citations, Context Grounding',
  'AI Evaluation and ML: Rubric-Based Scoring, Answer Evaluation, Confidence Metrics, Speech and Writing Assessment, PyTorch, Keras, Deep Learning, Data Preprocessing',
  'Speech and Vision AI: Whisper, Faster-Whisper, Speech-to-Text, English, Bengali, Arabic, SpeechBrain, Qwen Vision, Computer Vision, Facial Recognition',
  'Testing and DevOps: Jest, React Testing Library, API Testing, Git, GitHub Enterprise, Docker, Vercel, Linux, CI/CD, AWS Fundamentals, Service Workers, Web Push',
  'Soft Skills: Communication, Teamwork, Adaptability, Time Management, Leadership, Problem-Solving'
].forEach((value) => wrap(value, 7.35, 8.65));

section(3, 'Professional Experience');
entry('Core Engineering Team Member and Team Lead', 'August 2025 – Present', 'HouseofMusa [CitiMart Group], Kolkata, India', [
  'Built and enhanced an AI-powered Learning Management System (LMS) and ERP platform using React, Tailwind CSS, Express.js, MongoDB, REST APIs, and a Python FastAPI AI service.',
  'Engineered a RAG pipeline for teacher-approved curriculum material: document parsing and OCR, chunking, embeddings with nomic-embed-text, Qdrant storage, tenant-aware metadata filtering, hybrid retrieval, reranking, and source citations.',
  'Developed modular AI capabilities for tutor chat, question generation, summaries, flashcards, visual explanations, language practice, and AI-assisted learning workflows through a centralized orchestration layer.',
  'Implemented AI evaluation workflows for assignment and language submissions using rubric-based scoring, strict structured JSON outputs, measurable confidence signals, and local-model/API fallback handling.',
  'Built a multilingual speech-to-text and language assessment pipeline for English, Bengali, and Arabic using Whisper/Faster-Whisper, word timestamps, confidence scoring, and pronunciation analysis.',
  'Developed a Qwen Vision-based facial recognition system for image analysis and AI-powered vision workflows.',
  'Implemented teacher workflows for assignment creation, student submission review, AI evaluation, grading, feedback, and result publishing.',
  'Developed role-specific portal navigation and targeted notification flows with module-level counts, visited-state tracking, and parent-module rollups.',
  'Added automated regression coverage with Jest and React Testing Library, validating user flows, routing, evaluation states, and UI behavior.',
  'Managed Vercel deployments and GitHub Enterprise version control, improving code delivery speed by 25%.',
  'Contributed to a scalable online fantasy gaming platform by building responsive interfaces and optimizing API performance.'
]);

section(4, 'Projects');
entry('AI-Powered LMS and ERP Platform', '2025–2026', '', [
  'Built a Python/FastAPI AI service with modular orchestration, RAG-backed tutor chat, curriculum document ingestion, OCR, chunking, embeddings, Qdrant retrieval, prompt grounding, citations, and rubric-based evaluation for teacher and student workflows.'
]);
entry('Multilingual Speech-to-Text and Language Assessment', '2025–2026', 'Python, Whisper/Faster-Whisper, SpeechBrain', [
  'Built speech-to-text and language assessment workflows supporting English, Bengali, and Arabic, including word-level timestamps, confidence scores, pronunciation analysis, and structured feedback.'
]);
entry('Qwen Vision Facial Recognition System', '2025–2026', 'Python, Qwen Vision, Computer Vision', [
  'Developed a vision-based facial recognition system using a Qwen Vision model for image analysis and AI-assisted identity workflows.'
]);
entry('E-commerce Website', '2025', 'React, Express.js, MongoDB', [
  'Developed a full-stack e-commerce platform with secure authentication, payment integration, REST APIs, database persistence, and responsive design.'
]);
entry('Deep Learning Model for Rock Classification', '2024', 'Python, PyTorch, Keras', [
  'Built a rock-type classification model with data preprocessing and deep learning techniques for image-based classification.'
]);
entry('Zerodha Landing Page Clone', '2025', 'React, Tailwind CSS', [
  'Designed a responsive landing page clone with reusable React components and utility-first styling.'
]);

section(5, 'Education');
entry('Master of Science (M.Sc.) in Computer Science', 'Expected 2025', 'St. Xavier’s College (Autonomous), Kolkata, India');
entry('Bachelor of Science (B.Sc. Hons.) in Computer Science', '', 'University of Kalyani, India');

section(6, 'Certifications and Training');
bullet('C++ Basic Certification — CodeChef');
bullet('Data Analytics and Blockchain BootCamp — National Institute of Electronics and Information Technology (NIELIT)');
bullet('AWS Certified Cloud Practitioner — In Progress');

section(7, 'Achievements');
bullet('Developed and deployed production-ready web applications on cloud platforms.');
bullet('Recognized by CitiMart Group for contributions to AI-based ERP development during internship.');

if (y > height - 22) throw new Error(`Resume overflowed the page at y=${y}`);
pdf.save('resume-output/Koushik_Bala_ATS_Resume.pdf');
