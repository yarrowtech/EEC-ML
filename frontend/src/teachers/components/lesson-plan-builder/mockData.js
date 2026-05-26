export const initialChapters = [
  {
    id: 'ch-1',
    title: 'Introduction to Linear Equations',
    duration: '45 Minutes',
    description: '<p>Students identify variables and constants from real-life examples.</p>',
    files: [
      { id: 'f-1', name: 'Lesson-Slides.ppt', type: 'ppt' },
      { id: 'f-2', name: 'Worksheet-1.pdf', type: 'pdf' },
    ],
    assessments: [
      { id: 'a-1', title: 'Quick Quiz', type: 'Quiz', dueDate: '2026-05-29', marks: 10 },
    ],
  },
  {
    id: 'ch-2',
    title: 'Graphing in Two Variables',
    duration: '2 Classes',
    description: '<p>Practice plotting points and drawing best-fit lines.</p>',
    files: [{ id: 'f-3', name: 'Graphing-Guide.docx', type: 'docx' }],
    assessments: [
      { id: 'a-2', title: 'Homework Set A', type: 'Homework', dueDate: '2026-06-01', marks: 20 },
      { id: 'a-3', title: 'MCQ Practice', type: 'MCQ Test', dueDate: '2026-06-03', marks: 15 },
    ],
  },
  {
    id: 'ch-3',
    title: 'Word Problems and Applications',
    duration: '1 Week',
    description: '<p>Focus on translating narrative problems into equations.</p>',
    files: [],
    assessments: [],
  },
];

export const durationOptions = ['45 Minutes', '2 Classes', '1 Week'];

export const assessmentTypes = ['Quiz', 'Homework', 'Assignment', 'MCQ Test', 'Practical Task'];
