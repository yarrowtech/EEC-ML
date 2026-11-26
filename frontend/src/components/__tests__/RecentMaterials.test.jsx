/* global jest, describe, test, expect, beforeEach */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TabletRecentMaterials } from '../DashboardHome';

const mockMatchMedia = (matches) => {
  window.matchMedia = jest.fn(() => ({ matches, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('token', 't');
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      materials: [
        { _id: 'm1', subjectName: 'Science', chapterTitle: 'Plants', createdAt: '2026-11-20T10:00:00Z', attachments: [{ name: 'Plants notes.pdf', url: 'https://cdn.example.com/plants.pdf', type: 'application/pdf' }] },
        { _id: 'm2', subjectName: 'English', chapterTitle: 'Poems', createdAt: '2026-11-19T10:00:00Z', attachments: [{ name: 'Poem.docx', url: 'javascript:alert(1)' }] },
      ],
    }),
  }));
});

describe('Recent Study Materials (upright tablet)', () => {
  test('shows the latest files with type icons on an upright tablet', async () => {
    mockMatchMedia(true);
    render(<MemoryRouter><TabletRecentMaterials /></MemoryRouter>);
    expect(await screen.findByText('Plants notes.pdf')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'PDF file' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'DOC file' })).toBeInTheDocument();
    expect(screen.getByText('Plants notes.pdf').closest('a')).toHaveAttribute('href', 'https://cdn.example.com/plants.pdf');
    // an unsafe link is never used — the row falls back to the Study Materials page
    expect(screen.getByText('Poem.docx').closest('a')).toHaveAttribute('href', '/student/study-materials');
    expect(screen.getByRole('link', { name: /View all/ })).toHaveAttribute('href', '/student/study-materials');
  });

  test('is not shown (or fetched) on phones, landscape tablets or desktops', () => {
    mockMatchMedia(false);
    const { container } = render(<MemoryRouter><TabletRecentMaterials /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
