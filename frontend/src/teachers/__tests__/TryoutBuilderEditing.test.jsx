/* global jest, describe, test, expect */
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineTryoutBuilder } from '../components/lesson-plan-builder/TryoutBuilder';

const question = (id, text) => ({ id, type: 'mcq', question: text, options: ['A', 'B', 'C', 'D'], correctAnswer: 2 });

function Harness({ initial = [] }) {
  const [questions, setQuestions] = useState(initial);
  const [visible, setVisible] = useState(true);
  return <>
    <button onClick={() => setVisible(!visible)}>Toggle tryout tab</button>
    {visible && <InlineTryoutBuilder tryouts={questions} onSaveTryouts={setQuestions} />}
  </>;
}

describe('Tryout editing and navigation', () => {
  test('retains a new draft after Back and leaving the tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Multiple Choice/ }));
    await user.type(screen.getByRole('textbox', { name: 'Question' }), 'New draft');
    expect(screen.queryByRole('button', { name: 'Generate With AI' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Toggle tryout tab' }));
    await user.click(screen.getByRole('button', { name: 'Toggle tryout tab' }));
    const edit = screen.getByRole('button', { name: 'Edit question 1' });
    edit.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('New draft');
  });

  test('retains existing edits on leaving the tab without Done', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[question('one', 'Original')]} />);
    await user.click(screen.getByRole('button', { name: 'Edit question 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Question' }), ' updated');
    await user.click(screen.getByRole('button', { name: 'Toggle tryout tab' }));
    await user.click(screen.getByRole('button', { name: 'Toggle tryout tab' }));
    await user.click(screen.getByRole('button', { name: 'Edit question 1' }));
    expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue('Original updated');
  });

  test('keeps editing the same question when an earlier question is deleted', async () => {
    const user = userEvent.setup();
    const save = jest.fn();
    render(<InlineTryoutBuilder tryouts={[question('one', 'First'), question('two', 'Second')]} onSaveTryouts={save} />);
    await user.click(screen.getByRole('button', { name: 'Edit question 2' }));
    await user.click(screen.getByRole('button', { name: 'Delete question 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Question' }), ' edited');
    expect(save.mock.calls.at(-1)[0]).toEqual([expect.objectContaining({ id: 'two', question: 'Second edited' })]);
  });

  test('preserves the correct option when removing an earlier option', async () => {
    const user = userEvent.setup();
    const save = jest.fn();
    render(<InlineTryoutBuilder tryouts={[question('one', 'Choose')]} onSaveTryouts={save} />);
    await user.click(screen.getByRole('button', { name: 'Edit question 1' }));
    await user.click(screen.getByRole('button', { name: 'Remove option 1' }));
    expect(save.mock.calls.at(-1)[0][0]).toMatchObject({ options: ['B', 'C', 'D'], correctAnswer: 1 });
    await user.click(screen.getByRole('button', { name: 'Remove option 2' }));
    expect(save.mock.calls.at(-1)[0][0].correctAnswer).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Edit question 1' }));
    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument();
  });
});
