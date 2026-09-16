/* global jest, describe, test, expect */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChapterItem from '../components/lesson-plan-builder/ChapterItem';

const chapter = { id: 'chapter-1', title: 'Fractions', status: 'draft', isDraft: true };

describe('ChapterItem', () => {
  test('clicking the progress bar area (below the title button) still selects the chapter', async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(
      <ChapterItem
        chapter={chapter}
        index={0}
        total={3}
        isActive={false}
        onClick={onClick}
        onDragStart={() => {}}
        onDrop={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
      />
    );

    // "33% mapped" badge sits below the title button, in the area that used
    // to fall outside the clickable region.
    await user.click(screen.getByText('33% mapped'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('clicking the title still selects the chapter exactly once (no double-fire from bubbling)', async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(
      <ChapterItem
        chapter={chapter}
        index={0}
        total={3}
        isActive={false}
        onClick={onClick}
        onDragStart={() => {}}
        onDrop={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
      />
    );

    await user.click(screen.getByText('Fractions'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('rename and delete buttons do not trigger chapter selection', async () => {
    const onClick = jest.fn();
    const onDelete = jest.fn();
    const user = userEvent.setup();
    render(
      <ChapterItem
        chapter={chapter}
        index={0}
        total={3}
        isActive={false}
        onClick={onClick}
        onDragStart={() => {}}
        onDrop={() => {}}
        onDelete={onDelete}
        onRename={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete chapter Fractions' }));
    expect(onDelete).toHaveBeenCalledWith('chapter-1');
    expect(onClick).not.toHaveBeenCalled();
  });
});
