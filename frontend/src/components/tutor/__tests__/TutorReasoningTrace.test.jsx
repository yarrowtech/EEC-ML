import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import TutorReasoningTrace from '../TutorReasoningTrace';

describe('TutorReasoningTrace', () => {
  it('renders nothing when there is no lineage and no text citations', () => {
    const { container } = render(<TutorReasoningTrace lineage={null} citations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when citations are all visual-page sources', () => {
    const { container } = render(
      <TutorReasoningTrace lineage={null} citations={[{ material_id: 'm1', visual_pages: [1] }]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('stays collapsed until the toggle is clicked, then shows lineage details', () => {
    const lineage = {
      model: 'llama3.2:3b',
      mode: 'explain',
      promptSource: 'prompts/chat/explain.txt',
      retrievalChunkCount: 4,
      citationCount: 2,
      rewrittenQuery: 'how do plants make food',
    };
    render(<TutorReasoningTrace lineage={lineage} citations={[]} />);

    expect(screen.queryByText(/llama3\.2:3b/)).toBeNull();

    fireEvent.click(screen.getByText('Why this answer?'));

    expect(screen.getByText('llama3.2:3b')).toBeInTheDocument();
    expect(screen.getByText('explain')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/how do plants make food/)).toBeInTheDocument();
  });

  it('lists text-based source material but skips visual-only citations', () => {
    const citations = [
      { material_id: 'm1', source_name: 'Photosynthesis Notes', chapter_title: 'Ch 3' },
      { material_id: 'm2', source_name: 'Diagram Sheet', visual_pages: [2] },
    ];
    render(<TutorReasoningTrace lineage={null} citations={citations} />);

    fireEvent.click(screen.getByText('Why this answer?'));

    expect(screen.getByText('Photosynthesis Notes — Ch 3')).toBeInTheDocument();
    expect(screen.queryByText(/Diagram Sheet/)).toBeNull();
  });
});
