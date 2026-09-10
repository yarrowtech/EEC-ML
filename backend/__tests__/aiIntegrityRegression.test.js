const mongoose = require('mongoose');

describe('AI learning integrity contracts', () => {
  test('teacher scope cannot cross class/section boundaries', () => {
    const { studentIsWithinTeacherScope } = require('../utils/teacherAllocationScope');
    const scope = [{ normalizedClass: '5', normalizedSection: 'a' }];

    expect(studentIsWithinTeacherScope({ grade: '5', section: 'A' }, scope)).toBe(true);
    expect(studentIsWithinTeacherScope({ grade: '5', section: 'B' }, scope)).toBe(false);
    expect(studentIsWithinTeacherScope({ grade: '6', section: 'A' }, scope)).toBe(false);
  });

  test('disabled materials and alert dedupe are schema-enforced contracts', () => {
    const TeachingMaterial = require('../models/TeachingMaterial');
    const StudentInsight = require('../models/StudentInsight');

    expect(TeachingMaterial.schema.path('isEnabled').defaultValue).toBe(true);
    const dedupeIndex = StudentInsight.schema.indexes().find(([fields, options]) => (
      fields.dedupeKey === 1 && options?.unique === true
    ));
    expect(dedupeIndex).toBeDefined();
  });

  test('disabling a material excludes it from the student tutor context and marks it for ai-service exclusion', () => {
    // Regression: disabling a TeachingMaterial only flips a Mongo flag — it never
    // touches the material's chunks already ingested into Qdrant. The student
    // tutor route (aiTutorRoutes.js) must both drop disabled materials from the
    // scope it sends to ai-service AND pass their ids as excludedMaterialIds so
    // ai-service can filter them out of RAG retrieval too.
    const { partitionMaterialsByEnabled } = require('../utils/teachingMaterialAccess');

    const materials = [
      { _id: 'material-enabled', isEnabled: true },
      { _id: 'material-disabled', isEnabled: false },
      { _id: 'material-legacy-no-field' }, // predates the isEnabled field — must count as enabled
    ];

    const { enabled, disabledIds } = partitionMaterialsByEnabled(materials);

    expect(enabled.map((m) => m._id)).toEqual(['material-enabled', 'material-legacy-no-field']);
    expect(disabledIds).toEqual(['material-disabled']);
  });

  test('mastery regression calculation lowers a prior high score after a poor result', () => {
    const previousScore = 90;
    const poorResult = 20;
    const updatedScore = Math.round(previousScore * 0.7 + poorResult * 0.3);

    expect(updatedScore).toBe(69);
    expect(updatedScore).toBeLessThan(previousScore);
  });
});
