import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpenText } from 'lucide-react';

const TOPIC_CONTENT = {
  algebra: {
    title: 'Algebra',
    image:
      'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1800&q=80',
    intro:
      'Algebra is the language of patterns and relationships in mathematics. Instead of working only with fixed numbers, algebra uses symbols like x, y, and z to represent unknown values and general rules.',
    sections: [
      {
        heading: 'What You Learn In Algebra',
        text:
          'Students learn how to form expressions, solve equations, and simplify mathematical statements. Core ideas include variables, constants, coefficients, terms, and operations. These ideas build the foundation for higher mathematics.',
      },
      {
        heading: 'Why Algebra Is Important',
        text:
          'Algebra develops logical thinking and problem-solving. It helps students model real-life situations such as cost calculations, speed-time-distance problems, and data relationships. It is also essential for geometry, trigonometry, statistics, and calculus.',
      },
      {
        heading: 'Key Topics In This Chapter',
        text:
          'This topic usually covers algebraic expressions, identities, linear equations, and factorization. Students practice transforming expressions and finding unknown values using step-by-step methods and verification.',
      },
      {
        heading: 'How To Study Effectively',
        text:
          'Read each concept carefully, solve examples line by line, and then attempt mixed practice questions. Focus on writing every step clearly and checking the final answer by substitution whenever possible.',
      },
    ],
  },
};

const AILearningTopicReader = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const topicMatch = location.pathname.match(/\/topic\/([^/]+)/);
  const topicSlug = topicMatch?.[1] ? decodeURIComponent(topicMatch[1]) : 'Topic';
  const topicKey = String(topicSlug || '').trim().toLowerCase();
  const content = TOPIC_CONTENT[topicKey] || {
    title: topicSlug,
    image:
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1800&q=80',
    intro: 'Read this topic carefully to build conceptual understanding before attempting practice and assessment.',
    sections: [
      {
        heading: 'Overview',
        text: 'This section contains study material for the selected topic. Review concepts, examples, and important points before moving to practice.',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] px-4 py-6 sm:px-6 lg:px-8" style={{ fontFamily: 'Lexend, sans-serif' }}>
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-64 w-full sm:h-80">
            <img src={content.image} alt={content.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                <BookOpenText size={14} /> Topic Reader
              </p>
              <h1 className="text-3xl font-black text-white sm:text-5xl">{content.title}</h1>
            </div>
          </div>

          <div className="space-y-8 p-6 sm:p-8 lg:p-10">
            <p className="text-base leading-8 text-slate-700 sm:text-lg">{content.intro}</p>

            {content.sections.map((section) => (
              <article key={section.heading} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                <h2 className="text-xl font-bold text-slate-900">{section.heading}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">{section.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AILearningTopicReader;
