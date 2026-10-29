const TYPES = ['mcq', 'blank', 'true_false', 'matching'];

function normalizeQuestion({ type, options, correctAnswer, matchingLeft }) {
  if (!TYPES.includes(type)) throw new Error('Unsupported question type');
  let cleanOptions = Array.isArray(options) ? options.map((item) => String(item || '').trim()).filter(Boolean) : [];
  let answer = String(correctAnswer ?? '').trim();
  let left = [];
  if (type === 'true_false') {
    cleanOptions = ['True', 'False'];
    if (!['true', 'false'].includes(answer.toLowerCase())) throw new Error('Correct answer must be True or False');
    answer = answer.toLowerCase() === 'true' ? 'True' : 'False';
  } else if (type === 'matching') {
    left = Array.isArray(matchingLeft) ? matchingLeft.map((item) => String(item || '').trim()) : [];
    let pairs;
    try { pairs = JSON.parse(answer); } catch (_) { throw new Error('Matching answers must be a JSON array'); }
    if (left.length < 2 || left.length > 12 || left.some((item) => !item) || new Set(left).size !== left.length
      || !Array.isArray(pairs) || pairs.length !== left.length || pairs.some((item) => typeof item !== 'string' || !item.trim())) {
      throw new Error('Provide 2–12 unique left items and one answer for each');
    }
    pairs = pairs.map((item) => item.trim());
    if (new Set(pairs).size !== pairs.length) throw new Error('Matching answers must be unique');
    // Independent ordering prevents the student payload from exposing the pairs.
    cleanOptions = [...pairs].sort((a, b) => a.localeCompare(b));
    answer = JSON.stringify(pairs);
  } else if (type === 'mcq') {
    if (cleanOptions.length < 2) throw new Error('At least two options are required for MCQ');
    if (!answer || !cleanOptions.includes(answer)) throw new Error('Correct answer must match one of the options');
  } else {
    cleanOptions = [];
    if (!answer) throw new Error('Correct answer is required');
  }
  return { options: cleanOptions, correctAnswer: answer, matchingLeft: left };
}

function gradeAnswer(question, answer) {
  const given = String(answer ?? '').trim();
  const expected = String(question.correctAnswer || '').trim();
  if (question.type === 'matching') {
    let selected;
    try { selected = JSON.parse(given); } catch (_) { throw new Error('Complete all matching pairs'); }
    if (!Array.isArray(selected) || selected.length !== question.matchingLeft.length
      || new Set(selected).size !== selected.length || selected.some((value) => !question.options.includes(value))) {
      throw new Error('Select a different valid answer for each matching item');
    }
    return selected.every((value, index) => value === JSON.parse(expected)[index]);
  }
  if (question.type === 'true_false' && !['true', 'false'].includes(given.toLowerCase())) throw new Error('Select True or False');
  return ['blank', 'true_false'].includes(question.type) ? given.toLowerCase() === expected.toLowerCase() : given === expected;
}
module.exports = { TYPES, normalizeQuestion, gradeAnswer };
