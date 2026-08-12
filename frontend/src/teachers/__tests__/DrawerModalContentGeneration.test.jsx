/* global jest, describe, beforeEach, test, expect, global */
/* eslint-disable react/display-name, react/prop-types */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DrawerModal from '../components/lesson-plan-builder/DrawerModal';

jest.mock('../components/lesson-plan-builder/RichTextEditor', () => ({ value = '' }) => <div>{value}</div>);
jest.mock('../components/lesson-plan-builder/UploadDropzone', () => () => null);
jest.mock('../components/lesson-plan-builder/FileUploadCard', () => () => null);
jest.mock('../components/lesson-plan-builder/AssessmentCard', () => () => null);
jest.mock('../components/lesson-plan-builder/TryoutBuilder', () => ({ InlineTryoutBuilder: () => null }));
jest.mock('../components/RichTextMaterialEditor', () => () => null);
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

const response = (data, ok = true) => Promise.resolve({
  ok,
  json: () => Promise.resolve(data),
});

describe('DrawerModal content generation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'teacher-token');
    global.fetch = jest.fn(() => response({
      success: true,
      data: {
        objectives: ['Understand place value', 'Round large numbers'],
        flow: {
          HOOK: 'Compare two travel distances.',
          'I DO': 'Model place value with a chart.',
          'WE DO': 'Round sample distances together.',
          'YOU DO': 'Complete one rounding problem.',
        },
        explanation: '1. Identify each digit position.\n2. Compare place values.',
        recap: '• Place determines digit value.\n• Round using the next digit.',
      },
    }));
  });

  test('sends selected mathematics metadata and applies generated fields', async () => {
    const onUpdate = jest.fn();
    render(
      <DrawerModal
        open
        chapter={{
          id: 'chapter-1',
          title: 'Mathematics Chapter 001',
          learningObjectives: [],
          instructionalFlow: [],
          explanation: '',
          recap: '',
          assessments: [],
        }}
        durations={['40 Minutes']}
        assessmentTypes={[]}
        classId="class-1"
        sectionId="section-1"
        subjectId="subject-1"
        subjectName="Mathematics"
        onUpdate={onUpdate}
        onClose={jest.fn()}
        onSaveVersion={jest.fn()}
        externalStep={3}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Generate with AI' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const [updatedChapter] = onUpdate.mock.calls.at(-1);
    expect(updatedChapter.learningObjectives).toEqual([
      'Understand place value',
      'Round large numbers',
    ]);
    expect(updatedChapter.explanation).toContain('Identify each digit position');
    expect(updatedChapter.recap).toContain('Place determines digit value');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/ai-teacher/generate-content');
    expect(JSON.parse(options.body)).toMatchObject({
      subject: 'Mathematics',
      subjectId: 'subject-1',
      classId: 'class-1',
      sectionId: 'section-1',
      chapterTitle: 'Mathematics Chapter 001',
    });
  });
});
