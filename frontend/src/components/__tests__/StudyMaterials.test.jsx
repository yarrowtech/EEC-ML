/* global jest, describe, beforeEach, test, expect */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import StudyMaterials from '../StudyMaterials';

jest.mock('../AddOnsPortal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));

describe('StudyMaterials attachment safety', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'student-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        materials: [{
          _id: 'material-1',
          title: 'Legacy worksheet',
          subjectName: 'Mathematics',
          attachments: [{ name: 'worksheet.pdf', url: 'file:///tmp/worksheet.pdf', type: 'application/pdf' }],
        }],
      }),
    });
  });

  test('renders a local file reference as unavailable instead of a browser link', async () => {
    render(<StudyMaterials />);

    expect(await screen.findByText('Legacy worksheet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open attachments/i }));

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/ask your teacher to upload this file again/i)).toBeInTheDocument();
    expect(document.querySelector('a[href^="file:"]')).toBeNull();
  });
});
