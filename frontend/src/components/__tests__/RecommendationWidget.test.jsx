/* global jest, describe, beforeEach, test, expect, global */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RecommendationWidget from '../RecommendationWidget';

const jsonResponse = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

describe('RecommendationWidget — student agency (accept/dismiss)', () => {
  const items = [
    { id: 'rec-1', type: 'weak_topic', subject: 'Math', topicId: 't1', topicTitle: 'Fractions', label: 'Review', reason: 'Score dipped', action: 'practice_basic' },
    { id: 'rec-2', type: 'new_topic', subject: 'Science', topicId: 't2', topicTitle: 'Cells', label: 'Explore', reason: 'Ready for this', action: 'explain' },
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'student-token');
    global.fetch = jest.fn((url) => {
      if (String(url).includes('/api/recommendations/student')) return jsonResponse({ data: items });
      return jsonResponse({ success: true }); // accept/dismiss decision calls
    });
  });

  test('accepting a recommendation starts the tutor and posts an accept decision', async () => {
    const onStartTutor = jest.fn();
    render(<RecommendationWidget onStartTutor={onStartTutor} />);

    await screen.findByText(/Fractions/);
    fireEvent.click(screen.getByText(/Review — Fractions/));

    expect(onStartTutor).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Math', topic: 'Fractions', mode: 'practice_basic' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/recommendations/rec-1/accept'),
      expect.objectContaining({ method: 'POST' })
    ));
  });

  test('dismissing a recommendation removes it and posts a dismiss decision without starting the tutor', async () => {
    const onStartTutor = jest.fn();
    render(<RecommendationWidget onStartTutor={onStartTutor} />);

    await screen.findByText(/Fractions/);
    fireEvent.click(screen.getAllByTitle('Not interested in this right now')[0]);

    expect(onStartTutor).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/Fractions/)).not.toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/recommendations/rec-1/dismiss'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(screen.getByText(/Cells/)).toBeInTheDocument();
  });
});
