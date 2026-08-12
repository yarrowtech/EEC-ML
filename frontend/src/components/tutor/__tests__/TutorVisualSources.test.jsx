import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TutorVisualSources, { safeSourcePageUrl } from '../TutorVisualSources';


describe('TutorVisualSources', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'student-token');
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
    }));
    URL.createObjectURL = jest.fn(() => 'blob:visual-page');
    URL.revokeObjectURL = jest.fn();
  });

  test('renders a protected teacher PDF page image', async () => {
    render(<TutorVisualSources citations={[{
      material_id: 'material-1',
      source_name: 'mathematics.pdf',
      source_url: 'https://cdn.example.test/mathematics.pdf',
      visual_pages: [{ page_number: 4, description: 'A number line.' }],
    }]} />);

    expect(screen.getByText('Visual evidence from teacher material')).toBeInTheDocument();
    const summary = screen.getByText('mathematics.pdf · page 4');
    expect(global.fetch).not.toHaveBeenCalled();
    fireEvent.click(summary);
    await waitFor(() => expect(screen.getByAltText('mathematics.pdf, page 4')).toHaveAttribute('src', 'blob:visual-page'));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ai-tutor/source-page?materialId=material-1&page=4'),
      { headers: { Authorization: 'Bearer student-token' } },
    );
  });

  test('rejects unsafe source protocols', () => {
    expect(safeSourcePageUrl('javascript:alert(1)', 1)).toBe('');
  });

  test('deduplicates the same cited source page across legacy material ids', () => {
    render(<TutorVisualSources citations={[
      {
        material_id: 'current-id',
        source_name: 'eemm102.pdf',
        source_url: 'https://cdn.example.test/eemm102.pdf',
        visual_pages: [{ page_number: 1 }],
      },
      {
        material_id: 'legacy-id',
        source_name: 'eemm102.pdf',
        source_url: 'https://cdn.example.test/eemm102.pdf',
        visual_pages: [{ page_number: 1 }],
      },
    ]} />);

    expect(screen.getAllByText('eemm102.pdf · page 1')).toHaveLength(1);
  });
});
