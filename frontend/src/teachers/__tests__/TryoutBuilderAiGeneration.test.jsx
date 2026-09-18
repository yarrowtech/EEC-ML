/* global jest, describe, beforeEach, afterEach, test, expect, global */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineTryoutBuilder } from '../components/lesson-plan-builder/TryoutBuilder';

const jsonResponse = (data, ok = true) => Promise.resolve({
  ok,
  json: async () => data,
});

describe('InlineTryoutBuilder AI generation — RAG-grounded, non-mcq types', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'teacher-token');
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('normalizes a choice_matrix response into statements + answers', async () => {
    global.fetch = jest.fn(() => jsonResponse({
      success: true,
      data: {
        groundedInMaterial: true,
        questions: [{
          question: 'Mark each statement about photosynthesis as true or false.',
          statements: ['Plants release oxygen during photosynthesis.', 'Photosynthesis occurs only at night.'],
          answers: [true, false],
          explanation: 'Photosynthesis uses sunlight, so it happens during the day and releases oxygen.',
        }],
      },
    }));

    const user = userEvent.setup();
    render(
      <InlineTryoutBuilder
        tryouts={[]}
        onSaveTryouts={() => {}}
        topicTitle="Photosynthesis"
        subjectName="Science"
        gradeLevel="6"
      />
    );

    await user.selectOptions(screen.getAllByRole('combobox')[2], 'choice_matrix');
    await user.click(screen.getByRole('button', { name: /Generate With AI|Append AI Questions/i }));

    expect(await screen.findByText(/Mark each statement about photosynthesis/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ai-teacher/quiz-generate'),
      expect.objectContaining({
        body: expect.stringContaining('"questionType":"choice_matrix"'),
      })
    );
  });

  test('normalizes a cloze_text response into text + correctAnswers', async () => {
    global.fetch = jest.fn(() => jsonResponse({
      success: true,
      data: {
        groundedInMaterial: true,
        questions: [{
          text: 'Water boils at ${{input}} degrees Celsius at sea level.',
          correctAnswers: ['100'],
          explanation: 'Standard boiling point of water at sea-level atmospheric pressure.',
        }],
      },
    }));

    const user = userEvent.setup();
    render(
      <InlineTryoutBuilder
        tryouts={[]}
        onSaveTryouts={() => {}}
        topicTitle="States of Matter"
        subjectName="Science"
        gradeLevel="6"
      />
    );

    const typeSelect = screen.getAllByRole('combobox')[2];
    await user.selectOptions(typeSelect, 'cloze_text');
    await user.click(screen.getByRole('button', { name: /Generate With AI|Append AI Questions/i }));

    expect(await screen.findByText(/Water boils at/i)).toBeInTheDocument();
  });

  test('surfaces the "no material found" error instead of guessing content', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: false,
      json: async () => ({ error: 'No indexed material matched the selected class, section, subject, and topic.' }),
    }));

    const user = userEvent.setup();
    render(
      <InlineTryoutBuilder
        tryouts={[]}
        onSaveTryouts={() => {}}
        topicTitle="Untaught Topic"
        subjectName="Science"
        gradeLevel="6"
      />
    );

    await user.click(screen.getByRole('button', { name: /Generate With AI|Append AI Questions/i }));

    expect(await screen.findByText(/No indexed material matched/i)).toBeInTheDocument();
  });
});
