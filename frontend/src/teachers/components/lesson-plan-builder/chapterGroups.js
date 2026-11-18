// Lessons are grouped under textbook chapters ("Chapter 1 — Computer Basics").
// Lessons without a chapter go last under "Not in a chapter yet".

export const unitLabel = (lesson) => {
  const n = Number(lesson?.unitNumber) > 0 ? Number(lesson.unitNumber) : null;
  const t = String(lesson?.unitTitle || '').trim();
  if (n && t) return `Chapter ${n} · ${t}`;
  if (n) return `Chapter ${n}`;
  if (t) return t;
  return '';
};

// Order inside a chapter: oldest first, newest last (ascending).
const lessonTime = (lesson) => {
  const raw = lesson?.createdAt || lesson?.chapter?.meta?.date || lesson?.lessonDate || lesson?.chapter?.createdAt || '';
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER; // undated → end
};

export const groupLessonsByUnit = (lessons = []) => {
  const groups = new Map();
  lessons.forEach((lesson) => {
    const n = Number(lesson?.unitNumber) > 0 ? Number(lesson.unitNumber) : null;
    const t = String(lesson?.unitTitle || '').trim();
    const key = n || t ? `${n || ''}|${t.toLowerCase()}` : '__none__';
    if (!groups.has(key)) groups.set(key, { key, unitNumber: n, unitTitle: t, label: unitLabel(lesson) || 'Not in a chapter yet', lessons: [] });
    groups.get(key).lessons.push(lesson);
  });
  groups.forEach((g) => {
    // stable: equal times keep their original order
    g.lessons = g.lessons
      .map((lesson, i) => ({ lesson, i }))
      .sort((x, y) => (lessonTime(x.lesson) - lessonTime(y.lesson)) || (x.i - y.i))
      .map(({ lesson }) => lesson);
  });
  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === '__none__') return 1;
    if (b.key === '__none__') return -1;
    return (a.unitNumber || 9999) - (b.unitNumber || 9999) || a.unitTitle.localeCompare(b.unitTitle);
  });
};

// Distinct chapters already used in this class (for quick picking).
export const knownUnits = (lessons = []) => groupLessonsByUnit(lessons)
  .filter((g) => g.key !== '__none__')
  .map(({ unitNumber, unitTitle, label }) => ({ unitNumber, unitTitle, label }));
