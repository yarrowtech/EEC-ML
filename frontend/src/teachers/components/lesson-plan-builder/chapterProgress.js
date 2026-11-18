// How complete a chapter is — shared by the chapter list (percentage) and the
// editor's step list (✓ / ! marks), so both always agree.

const plainText = (v) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
const countUploads = (uploads) => Object.values(uploads || {})
  .reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);

// true = filled in, false = required but missing, null = optional and empty
export const stepStatus = (key, chapter = {}) => {
  switch (key) {
    case 'info': {
      const title = String(chapter.title || '').trim();
      return Boolean(title && !/^untitled (chapter|lesson)$/i.test(title) && chapter.lessonDate && String(chapter.duration || '').trim());
    }
    case 'materials': return countUploads(chapter.contentUploads) > 0;
    case 'intro': return Boolean(plainText(chapter.introductionText));
    case 'content': return Boolean(plainText(chapter.explanation));
    case 'assessment': return ((chapter.worksheetFiles || []).length + (chapter.assessments || []).length) > 0;
    case 'language': return null;
    case 'tryout': return (chapter.tryouts || []).length > 0 ? true : null;
    case 'publish': return chapter.status === 'published' && !chapter.isDraft ? true : null;
    default: return null;
  }
};

// The five parts every chapter needs.
export const REQUIRED_STEPS = ['info', 'materials', 'intro', 'content', 'assessment'];

// 0–100: share of the required parts this chapter has filled in. Depends only
// on the chapter itself — never on how many other chapters there are.
export const chapterCompletion = (chapter = {}) => {
  const done = REQUIRED_STEPS.filter((key) => stepStatus(key, chapter) === true).length;
  return Math.round((done / REQUIRED_STEPS.length) * 100);
};
