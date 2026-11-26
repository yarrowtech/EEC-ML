/* global describe, test, expect */
import React from 'react';
import { render, screen } from '@testing-library/react';
import FileTypeIcon, { fileKindOf, fileKindName } from '../FileTypeIcon';

describe('FileTypeIcon', () => {
  test.each([
    [{ type: 'application/pdf' }, 'pdf'],
    [{ name: 'Chapter 1 notes.PDF' }, 'pdf'],
    [{ url: 'https://cdn.example.com/a/b/worksheet.pdf?sig=123' }, 'pdf'],
    [{ name: 'essay.docx' }, 'word'],
    [{ type: 'application/msword' }, 'word'],
    [{ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, 'word'],
    [{ name: 'marks.xlsx' }, 'excel'],
    [{ name: 'list.csv' }, 'excel'],
    [{ name: 'lesson.pptx' }, 'ppt'],
    [{ type: 'image/png' }, 'image'],
    [{ name: 'diagram.jpg' }, 'image'],
    [{ name: 'experiment.mp4' }, 'video'],
    [{ name: 'readme.txt' }, 'text'],
    [{ name: 'mystery.bin' }, 'file'],
  ])('%o → %s', (attachment, kind) => {
    expect(fileKindOf(attachment)).toBe(kind);
  });

  test('friendly names', () => {
    expect(fileKindName('word')).toBe('Word document');
    expect(fileKindName('pdf')).toBe('PDF');
  });

  test('draws the coloured label for the kind', () => {
    render(<><FileTypeIcon kind="pdf" /><FileTypeIcon kind="word" /></>);
    expect(screen.getByRole('img', { name: 'PDF file' })).toHaveTextContent('PDF');
    expect(screen.getByRole('img', { name: 'DOC file' })).toHaveTextContent('DOC');
  });
});
