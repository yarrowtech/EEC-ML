import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const markdownPath = resolve(currentDir, "EEC_AI_Tutor_Complete_Audit.md");
const outputPath = resolve(currentDir, "EEC_AI_Tutor_Complete_Audit.artifact.json");
const generatedAt = "2026-08-11T00:00:00+05:30";
const title = "EEC AI Tutor — Complete Research-Based Audit";

const markdown = await readFile(markdownPath, "utf8");
const lines = markdown.split("\n");

const firstSectionIndex = lines.findIndex((line) => /^## /.test(line));
if (firstSectionIndex < 0 || lines[0] !== `# ${title}`) {
  throw new Error("The audit Markdown does not have the expected title/section structure.");
}

const auditMetadata = lines.slice(1, firstSectionIndex).join("\n").trim();
const sections = [];
let active = [];

for (const line of lines.slice(firstSectionIndex)) {
  if (/^## /.test(line) && active.length) {
    sections.push(active.join("\n").trim());
    active = [];
  }
  active.push(line);
}
if (active.length) sections.push(active.join("\n").trim());

const slugify = (value) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "")
  .slice(0, 72);

const markdownBlocks = sections.map((body, index) => {
  const heading = body.split("\n", 1)[0].replace(/^##\s+/, "");
  const sectionBody = index === 0
    ? `${body.split("\n")[0]}\n\n${auditMetadata}\n\n${body.split("\n").slice(1).join("\n").trim()}`
    : body;
  return {
    id: `section-${slugify(heading) || index + 1}`,
    type: "markdown",
    body: sectionBody,
    sourceId: "audit_report",
  };
});

const scoreRows = [
  { category: "Architecture", score: 29, maximum: 100, assessment: "Critical learning-loop gaps", rank: 3 },
  { category: "Personalization", score: 31, maximum: 100, assessment: "Some UI adaptation; weak evidence linkage", rank: 4 },
  { category: "Learning Science", score: 22, maximum: 100, assessment: "Mastery, retention, transfer not defensible", rank: 2 },
  { category: "AI Safety", score: 17, maximum: 100, assessment: "Release-blocking service and child-safety gaps", rank: 1 },
  { category: "Teacher Integration", score: 40, maximum: 100, assessment: "Useful dashboards/interventions; no review loop", rank: 7 },
  { category: "Student Agency", score: 42, maximum: 100, assessment: "Good conversational choice; no durable goal/reject flow", rank: 8 },
  { category: "Data Architecture", score: 39, maximum: 100, assessment: "Broad LMS models; fragmented learning evidence", rank: 6 },
  { category: "Research Readiness", score: 9, maximum: 100, assessment: "No experiment or outcome-evaluation framework", rank: 0 },
];

const scoreChart = {
  id: "audit_scores",
  title: "Audit scores by category",
  subtitle: "No category reaches 50/100; research readiness and AI safety are the weakest areas.",
  type: "bar",
  dataset: "audit_scores",
  sourceId: "audit_scoring",
  valueFormat: "number",
  encodings: {
    x: { field: "category", type: "nominal", label: "Category" },
    y: { field: "score", type: "quantitative", label: "Score (0–100)" },
    tooltip: [
      { field: "score", type: "quantitative", label: "Score" },
      { field: "assessment", type: "nominal", label: "Assessment basis" },
    ],
  },
  options: { orientation: "vertical" },
};

const overallScoreCard = {
  id: "overall_score",
  description: "Unweighted mean of the eight required category scores, rounded from 28.6.",
  dataset: "overall_score",
  sourceId: "audit_scoring",
  metrics: [
    { label: "Overall score", field: "overall", format: "number" },
    { label: "Maximum", field: "maximum", format: "number" },
  ],
};

const sources = [
  { id: "audit_report", label: "Complete code audit and evidence matrix", path: "docs/audits/EEC_AI_Tutor_Complete_Audit.md" },
  {
    id: "audit_scoring",
    label: "Audit scoring rubric and category rationales",
    path: "docs/audits/EEC_AI_Tutor_Complete_Audit.md",
    query: {
      language: "sql",
      description: "Reproducible materialization of the reviewed rubric scores; the overall score is their rounded unweighted arithmetic mean.",
      sql: "WITH scores(category, score) AS (VALUES ('Architecture', 29), ('Personalization', 31), ('Learning Science', 22), ('AI Safety', 17), ('Teacher Integration', 40), ('Student Agency', 42), ('Data Architecture', 39), ('Research Readiness', 9))\nSELECT category, score, 100 AS maximum, ROUND(AVG(score) OVER ()) AS overall, AVG(score) OVER () AS exact_unweighted_mean FROM scores;",
      tables_used: ["docs/audits/EEC_AI_Tutor_Complete_Audit.md"],
      metric_definitions: [
        "Category score: evidence-weighted audit judgment against the user-specified requirements, on a 0–100 scale.",
        "Overall score: unweighted arithmetic mean of the eight category scores, rounded from 28.625 to 29.",
      ],
      filters: ["Repository state inspected on 2026-08-11"],
    },
  },
  { id: "mastery_code", label: "Current mastery route", path: "backend/routes/masteryRoutes.js" },
  { id: "tutor_frontend", label: "Student tutor implementation", path: "frontend/src/features/student/pages/SmartLearningTutor.jsx" },
  { id: "rag_service", label: "RAG and AI service", path: "ai-service/app.py" },
  { id: "tenant_plugin", label: "MongoDB organization scoping plugin", path: "backend/plugins/tenantPlugin.js" },
  { id: "uis_5e", label: "UiS Evidence in EdTech: The 5Es", href: "https://ebooks.uis.no/index.php/USPS/catalog/series/edtech" },
  { id: "ever", label: "EVER framework paper", href: "https://www.nature.com/articles/s41539-023-00186-7" },
  { id: "doe_ai", label: "U.S. Department of Education AI and the Future of Teaching and Learning", href: "https://www.ed.gov/sites/ed/files/documents/ai-report/ai-report.pdf" },
  { id: "unesco_genai", label: "UNESCO guidance for generative AI in education and research", href: "https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research" },
];

const titleBlock = { id: "report-title", type: "markdown", body: `# ${title}` };
const blocks = [titleBlock, markdownBlocks[0]];
blocks.push({ id: "score-strip", type: "metric-strip", cardIds: ["overall_score"] });
blocks.push({ id: "score-chart", type: "chart", chartId: "audit_scores" });
blocks.push(...markdownBlocks.slice(1));

const artifact = {
  surface: "report",
  manifest: {
    version: 1,
    surface: "report",
    title,
    description: "Repository-verified architecture, learning-science, safety, data, API, frontend, RAG, and research-readiness audit of EEC.",
    generatedAt,
    cards: [overallScoreCard],
    charts: [scoreChart],
    tables: [],
    sources,
    blocks,
  },
  snapshot: {
    version: 1,
    generatedAt,
    status: "ready",
    datasets: {
      overall_score: [{ overall: 29, maximum: 100, exact_unweighted_mean: 28.625 }],
      audit_scores: scoreRows,
    },
  },
  sources,
  package_info: {
    originUrl: "artifact://eec-ai-tutor-complete-audit",
  },
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(outputPath);
