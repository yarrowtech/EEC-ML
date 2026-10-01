/* eslint-disable react/prop-types */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  Bus,
  CalendarDays,
  ChevronRight,
  Download,
  FileText,
  Info,
  Megaphone,
  Pin,
  RefreshCw,
  WalletCards,
} from 'lucide-react';

import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { parentApiFetch } from './parentApi';

import {
  isFormalNotice,
  attachmentsForRole,
  documentForRole,
} from '../components/FormalNotice';

import { downloadAttachment, formatFileSize, getAttachmentMeta } from '../utils/noticeDisplay';

const PAGE_SIZE = 5;

const PAGE_MOTION = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut', staggerChildren: 0.05 } },
};

const ITEM_MOTION = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16 } },
};


/* ========================================================================= */
/* CATEGORIES                                                               */
/* ========================================================================= */
const CATEGORIES = [
  {
    value: 'all',
    label: 'All',
    Icon: Bell,
    tone: {
      icon: 'bg-violet-50 text-violet-600',
      active: 'border-violet-300 bg-violet-50',
      count: 'bg-violet-600 text-white',
    },
  },
  {
    value: 'general',
    label: 'General',
    Icon: Megaphone,
    tone: {
      icon: 'bg-slate-100 text-slate-600',
      active: 'border-slate-200 bg-white',
      count: 'bg-slate-100 text-slate-600',
    },
  },
  {
    value: 'academic',
    label: 'Academic',
    Icon: BookOpen,
    tone: {
      icon: 'bg-emerald-50 text-emerald-600',
      active: 'border-emerald-200 bg-emerald-50/40',
      count: 'bg-emerald-100 text-emerald-700',
    },
  },
  {
    value: 'exam',
    label: 'Exam',
    Icon: FileText,
    tone: {
      icon: 'bg-violet-50 text-violet-600',
      active: 'border-violet-200 bg-violet-50/40',
      count: 'bg-violet-100 text-violet-700',
    },
  },
  {
    value: 'events',
    label: 'Events',
    Icon: CalendarDays,
    tone: {
      icon: 'bg-orange-50 text-orange-600',
      active: 'border-orange-200 bg-orange-50/40',
      count: 'bg-orange-100 text-orange-700',
    },
  },
  {
    value: 'fee',
    label: 'Fee',
    Icon: WalletCards,
    tone: {
      icon: 'bg-rose-50 text-rose-600',
      active: 'border-rose-200 bg-rose-50/40',
      count: 'bg-rose-100 text-rose-700',
    },
  },
  {
    value: 'transport',
    label: 'Transport',
    Icon: Bus,
    tone: {
      icon: 'bg-violet-50 text-violet-600',
      active: 'border-violet-200 bg-violet-50/40',
      count: 'bg-violet-100 text-violet-700',
    },
  },
];


/* ========================================================================= */
/* CATEGORY HELPERS                                                         */
/* ========================================================================= */

const CATEGORY_TONE = {
  general: 'bg-slate-100 text-slate-700',
  academic: 'bg-emerald-50 text-emerald-700',
  exam: 'bg-violet-50 text-violet-700',
  events: 'bg-orange-50 text-orange-700',
  fee: 'bg-rose-50 text-rose-700',
  transport: 'bg-violet-50 text-violet-700',
};

const CATEGORY_ICON_STYLE = {
  general: 'bg-slate-100 text-slate-600',
  academic: 'bg-emerald-50 text-emerald-600',
  exam: 'bg-violet-50 text-violet-600',
  events: 'bg-orange-50 text-orange-600',
  fee: 'bg-rose-50 text-rose-600',
  transport: 'bg-violet-50 text-violet-600',
};


/* Older notices may not have a category. */
const categoryOf = (notice) => {
  const category = String(
    notice?.category || ''
  ).toLowerCase();

  if (CATEGORY_TONE[category]) {
    return category;
  }

  const type = String(
    notice?.type || ''
  ).toLowerCase();

  if (
    type === 'exam' ||
    type === 'result'
  ) {
    return 'exam';
  }

  if (type === 'fee') {
    return 'fee';
  }

  if (
    String(notice?.typeLabel || '').toLowerCase() ===
    'holiday'
  ) {
    return 'events';
  }

  return 'general';
};


/* ========================================================================= */
/* DATE                                                                      */
/* ========================================================================= */

const formatDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
};


/* ========================================================================= */
/* CATEGORY ICON                                                             */
/* ========================================================================= */

const CategoryIcon = ({
  category,
  size = 23,
  active = false,
}) => {
  const iconMap = {
    general: Megaphone,
    academic: BookOpen,
    exam: FileText,
    events: CalendarDays,
    fee: WalletCards,
    transport: Bus,
  };

  const Icon =
    iconMap[category] || Megaphone;

  return (
    <span
      className={`
        flex
        h-10
        w-10
        shrink-0
        items-center
        justify-center
        rounded-full
        ${
          active
            ? 'bg-violet-50 text-violet-600'
            : CATEGORY_ICON_STYLE[category] ||
              CATEGORY_ICON_STYLE.general
        }
      `}
    >
      <Icon
        size={size}
        strokeWidth={2.2}
      />
    </span>
  );
};


const stripRichMarkers = (value) => String(value || '').split('**').join('');

const detailParagraphs = (notice) => {
  if (isFormalNotice(notice)) {
    const doc = documentForRole(notice.document, 'parent');
    return (doc?.paragraphs || []).map(stripRichMarkers).filter(Boolean);
  }

  return String(notice?.message || 'No additional details available.')
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const detailBullets = (notice) => {
  const doc = isFormalNotice(notice) ? documentForRole(notice.document, 'parent') : null;
  const bullets = [];

  (doc?.details || []).forEach((item) => {
    if (item?.label && item?.value) bullets.push(`${item.label}: ${stripRichMarkers(item.value)}`);
  });
  (doc?.instructions || []).forEach((line) => { if (line) bullets.push(stripRichMarkers(line)); });
  (doc?.sections || []).forEach((section) => { if (section?.text) bullets.push(stripRichMarkers(section.text)); });

  if (!bullets.length && notice?.priority === 'high') bullets.push('This notice has been marked important by the school.');
  return bullets.slice(0, 4);
};

const NoticeDetailPage = ({ notice, onBack, onFeedback }) => {
  const cat = categoryOf(notice);
  const Icon = {
    general: Megaphone,
    academic: BookOpen,
    exam: FileText,
    events: CalendarDays,
    fee: WalletCards,
    transport: Bus,
  }[cat] || Megaphone;
  const doc = isFormalNotice(notice) ? documentForRole(notice.document, 'parent') : null;
  const paragraphs = detailParagraphs(notice);
  const bullets = detailBullets(notice);
  const attachments = attachmentsForRole(notice?.attachments || [], 'parent').filter((attachment) => attachment?.url);
  const sender = notice?.createdByName || doc?.signature?.filter(Boolean)?.slice(-1)?.[0] || 'School Administration';
  const signature = doc?.signature?.filter(Boolean)?.slice(-1)?.[0] || sender;
  const title = notice?.title || doc?.subject || 'School Notice';

  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="h-[calc(100dvh-8.5rem)] overflow-hidden bg-[#f5f8ff] p-3 text-[#10145c] sm:h-[calc(100dvh-6.5rem)] sm:p-3 lg:h-[calc(100dvh-8rem)] lg:p-3">
      <div className="mx-auto flex h-full max-w-[1500px] flex-col">
        <motion.div variants={ITEM_MOTION} className="mb-3 flex shrink-0 items-center gap-2 text-xs font-semibold sm:text-xs">
          <button type="button" onClick={onBack} aria-label="Back to notices" className="flex h-8 w-8 items-center justify-center rounded-full text-[#294375] transition hover:bg-white hover:text-blue-600">
            <ArrowLeft size={20} />
          </button>
          <button type="button" onClick={onBack} className="text-[#294375] transition hover:text-blue-600">Notices</button>
          <ChevronRight size={18} className="text-[#294375]" />
          <span className="font-extrabold text-[#070b49]">Notice Details</span>
        </motion.div>

        <motion.article variants={ITEM_MOTION} className="flex min-h-0 flex-1 flex-col rounded-lg border border-blue-100 bg-white px-4 py-4 shadow-[0_8px_28px_rgba(30,64,175,0.08)] sm:px-6 lg:overflow-hidden lg:px-7">
          <header className="flex shrink-0 flex-col gap-4 border-b border-blue-100 pb-4 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 sm:h-20 sm:w-20">
              <Icon size={38} strokeWidth={2.6} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-0.5 text-xs font-bold capitalize ${CATEGORY_TONE[cat] || CATEGORY_TONE.general}`}>{cat}</span>
                {notice?.isPinned && <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-0.5 text-xs font-bold text-rose-600"><Pin size={15} fill="currentColor" />Pinned</span>}
              </div>
              <h1 className="text-xl font-black leading-tight tracking-tight text-[#070b49] sm:text-xl lg:text-3xl">{title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-[#294375]"><span>{formatDate(notice?.createdAt || doc?.date)}</span><span className="hidden h-5 w-px bg-blue-200 sm:inline-block" /><span>From {sender}</span></p>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1 text-sm leading-6 text-[#19356d] sm:text-base sm:leading-7">
            {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {bullets.length > 0 && (
              <div className="flex gap-5 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-[#19356d]"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"><Info size={18} /></span><ul className="list-disc space-y-1 pl-5">{bullets.map((line) => <li key={line}>{line}</li>)}</ul></div>
            )}
            <p>For any queries, please contact the class teacher or school administration.</p>
            <div><p>Regards,</p><p className="font-black text-[#070b49]">{signature}</p></div>
          </div>

          {attachments.length > 0 && (
            <section className="shrink-0 border-t border-blue-100 pt-4"><h2 className="mb-2 text-base font-black text-[#070b49]">Attachment</h2><div className="space-y-3">{attachments.map((attachment) => { const meta = getAttachmentMeta(attachment); return (<div key={attachment.url} className="flex items-center gap-4 rounded-lg border border-blue-100 bg-blue-50/45 p-3 sm:p-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500"><FileText size={26} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#0b1a55]">{attachment.name || 'Attachment'}</p><p className="text-sm font-medium text-[#294375]">{meta.label}{attachment.size ? ` - ${formatFileSize(attachment.size)}` : ''}</p></div><button type="button" onClick={() => downloadAttachment(attachment)} aria-label="Download attachment" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-600 transition hover:bg-blue-50"><Download size={18} /></button></div>); })}</div></section>
          )}

          <footer className="mt-5 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onBack} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white px-5 text-sm font-bold text-blue-600 transition hover:bg-blue-50 sm:min-w-[190px]"><ArrowLeft size={18} />Back to Notices</button>
            {notice?.typeLabel === 'feedback_window' && <button type="button" onClick={onFeedback} className="inline-flex h-12 items-center justify-center gap-3 rounded-lg bg-blue-600 px-6 text-base font-bold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 sm:min-w-[250px]"><BarChart3 size={18} />Track Child&apos;s Feedback</button>}
          </footer>
        </motion.article>
      </div>
    </motion.div>
  );
};


/* ========================================================================= */
/* PAGE                                                                      */
/* ========================================================================= */

const ParentNotices = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [notices, setNotices] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [category, setCategory] =
    useState('all');


  const [highlightId, setHighlightId] =
    useState('');

  const [selectedNoticeId, setSelectedNoticeId] =
    useState('');

  const [page, setPage] = useState(1);


  /* ======================================================================= */
  /* LOAD NOTICES                                                            */
  /* ======================================================================= */

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response =
          await parentApiFetch(
            '/api/notifications/user?kind=notice',
            {
              cache: 'no-store',
            },
            navigate
          );

        const data =
          await response
            .json()
            .catch(() => []);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'Unable to load notices'
          );
        }

        setNotices(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (err) {
        setError(
          err?.message ||
            'Unable to load notices'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate]
  );


  useEffect(() => {
    load();
  }, [load]);


  /* ======================================================================= */
  /* DASHBOARD NOTICE DEEP LINK                                             */
  /* ======================================================================= */

  const focusId =
    location.state?.openNoticeId || '';

  useEffect(() => {
    if (
      !focusId ||
      loading ||
      !notices.some(
        (notice) =>
          String(notice._id) ===
          String(focusId)
      )
    ) {
      return undefined;
    }

    setCategory('all');


    setSelectedNoticeId(focusId);

    setHighlightId(focusId);

    setTimeout(() => {
      document
        .getElementById(
          `notice-${focusId}`
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
    }, 100);

    setTimeout(() => {
      setHighlightId('');
    }, 2600);

    navigate(
      location.pathname,
      {
        replace: true,
        state: null,
      }
    );

    return undefined;
  }, [
    focusId,
    loading,
    notices,
    navigate,
    location.pathname,
  ]);


  /* ======================================================================= */
  /* VISIBLE NOTICES                                                         */
  /* ======================================================================= */

  const visible = useMemo(() => {
    return notices
      .filter(
        (notice) =>
          category === 'all' ||
          categoryOf(notice) ===
            category
      )
      .sort(
        (a, b) =>
          Number(
            Boolean(b?.isPinned)
          ) -
            Number(
              Boolean(a?.isPinned)
            ) ||
          new Date(
            b?.createdAt || 0
          ) -
            new Date(
              a?.createdAt || 0
            )
      );
  }, [
    notices,
    category,
  ]);


  const selectedNotice = useMemo(
    () => notices.find((notice) => String(notice._id) === String(selectedNoticeId)) || null,
    [notices, selectedNoticeId]
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  const pagedVisible = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visible.slice(start, start + PAGE_SIZE);
  }, [visible, page]);

  useEffect(() => {
    setPage(1);
  }, [category]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);


  /* ======================================================================= */
  /* COUNTS                                                                  */
  /* ======================================================================= */

  const counts = useMemo(() => {
    const result = {
      all: notices.length,
    };

    notices.forEach((notice) => {
      const currentCategory =
        categoryOf(notice);

      result[currentCategory] =
        (result[currentCategory] || 0) +
        1;
    });

    return result;
  }, [notices]);


  /* ======================================================================= */
  /* RENDER                                                                  */
  /* ======================================================================= */

  if (selectedNotice) {
    return (
      <NoticeDetailPage
        notice={selectedNotice}
        onBack={() => setSelectedNoticeId('')}
        onFeedback={() => navigate('/parents/teacher-feedback')}
      />
    );
  }

  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="flex h-[calc(100dvh-8.5rem)] flex-col overflow-hidden bg-[#f5f8ff] p-3 sm:h-[calc(100dvh-6.5rem)] sm:p-3 lg:h-[calc(100dvh-6rem)]">

      {/* ================================================================= */}
      {/* HEADER                                                            */}
      {/* ================================================================= */}

      <motion.div variants={ITEM_MOTION} className="mb-2 flex shrink-0 items-center justify-between gap-3">

        <div className="flex min-w-0 items-center gap-3">

          <span
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-violet-100
              text-violet-600
            "
          >
            <Bell
              size={20}
              strokeWidth={2.2}
            />
          </span>

          <div className="min-w-0">

            <h1
              className="
                text-xl
                font-extrabold
                tracking-tight
                text-[#10145c]
                sm:text-xl
              "
            >
              Notices
            </h1>

            <p className="text-xs text-slate-500 sm:text-xs">
              Official announcements from the school.
            </p>

          </div>
        </div>


        {/* Refresh */}
        <button
          type="button"
          onClick={() =>
            load({
              silent: true,
            })
          }
          disabled={refreshing}
          aria-label="Refresh notices"
          className="
            inline-flex
            h-9
            shrink-0
            items-center
            gap-2
            rounded-xl
            border
            border-violet-200
            bg-white
            px-3
            text-xs
            font-semibold
            text-violet-600
            shadow-sm
            transition
            hover:bg-violet-50
            disabled:opacity-60
            sm:h-10
            sm:px-4
          "
        >
          <RefreshCw
            size={15}
            className={
              refreshing
                ? 'animate-spin'
                : ''
            }
          />

          <span>
            Refresh
          </span>
        </button>

      </motion.div>


      {/* ================================================================= */}
      {/* CATEGORY NAVIGATION                                               */}
      {/* ================================================================= */}

      <motion.div
        variants={ITEM_MOTION}
        className="
          mb-2
          shrink-0
          overflow-x-auto
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >

        <div className="flex min-w-max gap-2">

          {CATEGORIES.map(
            ({
              value,
              label,
              Icon,
              tone,
            }) => {

              const active =
                category === value;

              const count =
                counts[value] || 0;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setCategory(value)
                  }
                  className={`
                    flex
                    h-12
                    min-w-28
                    shrink-0
                    items-center
                    gap-2.5
                    rounded-xl
                    border
                    px-3
                    text-left
                    transition-all
                    duration-200
                    ${
                      active
                        ? tone.active
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                    }
                  `}
                >

                  {/* Circular Icon */}
                  <span
                    className={`
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      ${
                        active
                          ? 'bg-violet-50 text-violet-600'
                          : tone.icon
                      }
                    `}
                  >
                    <Icon
                      size={17}
                      strokeWidth={2.2}
                    />
                  </span>


                  {/* Category Title + Count */}
                  <span
                    className="
                      flex
                      min-w-0
                      items-center
                      gap-1.5
                    "
                  >

                    <span
                      className={`
                        truncate
                        text-xs
                        font-semibold
                        ${
                          active
                            ? 'text-[#10145c]'
                            : 'text-slate-700'
                        }
                      `}
                    >
                      {label}
                    </span>


                    {/* NUMBER ONLY BADGE */}
                    <span
                      className={`
                        inline-flex
                        h-5
                        min-w-5
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        px-1.5
                        text-[10px]
                        font-bold
                        leading-none
                        ${tone.count}
                      `}
                    >
                      {count}
                    </span>

                  </span>

                </button>
              );
            }
          )}

        </div>

      </motion.div>


      {/* ================================================================= */}
      {/* CONTENT                                                           */}
      {/* ================================================================= */}

      {loading ? (

        <div
          className="
            min-h-0
            flex-1
            overflow-hidden
            rounded-xl
            border
            border-slate-100
            bg-white
            p-4
          "
        >
          <Loading />
        </div>

      ) : error ? (

        <div
          className="
            min-h-0
            flex-1
            overflow-hidden
            rounded-xl
            border
            border-slate-100
            bg-white
            p-4
          "
        >
          <ErrorState
            message={error}
            onRetry={() => load()}
          />
        </div>

      ) : visible.length === 0 ? (

        <div
          className="
            min-h-0
            flex-1
            overflow-hidden
            rounded-xl
            border
            border-slate-100
            bg-white
            p-4
          "
        >
          <EmptyState
            title="No notices"
            hint="School notices will appear here."
            icon={Megaphone}
          />
        </div>

      ) : (

        <div className="flex min-h-0 flex-1 flex-col gap-3">

          <AnimatePresence mode="wait">
            <motion.div
              key={`${category}-${page}`}
              variants={PAGE_MOTION}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="grid min-h-0 flex-1 content-start gap-2 overflow-hidden lg:grid-rows-5"
            >

          {pagedVisible.map((notice) => {

            const cat =
              categoryOf(notice);

            const scope = [
              notice?.className,
              notice?.sectionName,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <motion.article
                variants={ITEM_MOTION}
                layout
                key={notice._id}
                id={`notice-${notice._id}`}
                className={`
                  scroll-mt-24
                  overflow-hidden
                  rounded-xl
                  border
                  bg-white
                  shadow-[0_2px_10px_rgba(15,23,42,0.035)]
                  transition-all
                  duration-300
                  ${
                    highlightId ===
                    String(
                      notice._id
                    )
                      ? 'border-violet-400 ring-4 ring-violet-100'
                      : 'border-slate-100 hover:border-blue-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)]'
                  }
                `}
              >

                {/* ===================================================== */}
                {/* MAIN NOTICE ROW                                       */}
                {/* ===================================================== */}

                <button
                  type="button"
                  onClick={() => setSelectedNoticeId(notice._id)}
                  className="
                    group
                    flex
                    h-[72px]
                    w-full
                    text-left
                    items-center
                    gap-3
                    px-3
                    py-2
                    sm:px-4
                  "
                >

                  {/* Category Icon */}
                  <CategoryIcon
                    category={cat}
                    size={20}
                  />


                  {/* Main Content */}
                  <div className="min-w-0 flex-1">

                    {/* Badges */}
                    <div
                      className="
                        mb-1
                        flex
                        flex-wrap
                        items-center
                        gap-1.5
                      "
                    >

                      <span
                        className={`
                          rounded-full
                          px-2
                          py-0.5
                          text-[10px]
                          font-semibold
                          capitalize
                          ${CATEGORY_TONE[cat]}
                        `}
                      >
                        {cat}
                      </span>

                      {notice?.isPinned && (
                        <span
                          className="
                            inline-flex
                            items-center
                            gap-1
                            rounded-full
                            bg-rose-50
                            px-2
                            py-0.5
                            text-[10px]
                            font-semibold
                            text-rose-600
                          "
                        >
                          <Pin
                            size={10}
                            fill="currentColor"
                          />
                          Pinned
                        </span>
                      )}

                      {notice?.priority ===
                        'high' && (
                        <span
                          className="
                            rounded-full
                            bg-red-50
                            px-2
                            py-0.5
                            text-[10px]
                            font-semibold
                            text-red-600
                          "
                        >
                          Important
                        </span>
                      )}

                    </div>


                    {/* Title */}
                    <h2
                      className="
                        truncate
                        text-sm
                        font-bold
                        leading-5
                        text-[#10145c]
                        sm:text-base
                      "
                    >
                      {notice?.title ||
                        'School Notice'}
                    </h2>


                    {/* Metadata */}
                    {(scope ||
                      notice?.createdByName) && (
                      <p
                        className="
                          mt-0.5
                          truncate
                          text-[10px]
                          text-slate-400
                        "
                      >
                        {[
                          notice?.createdByName &&
                            `From ${notice.createdByName}`,
                          scope,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}

                  </div>


                  {/* Date */}
                  <div
                    className="
                      hidden
                      shrink-0
                      text-right
                      sm:block
                    "
                  >
                    <p
                      className="
                        text-xs
                        font-medium
                        text-slate-500
                      "
                    >
                      {formatDate(
                        notice?.createdAt
                      )}
                    </p>
                  </div>


                  {/* Mobile Date */}
                  <div
                    className="
                      shrink-0
                      sm:hidden
                    "
                  >
                    <p
                      className="
                        text-[10px]
                        font-medium
                        text-slate-400
                      "
                    >
                      {formatDate(
                        notice?.createdAt
                      )}
                    </p>
                  </div>


                  {/* Chevron */}
                  <span
                    className="
                      flex
                      h-8
                      w-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-lg
                      text-slate-400
                      transition
                      group-hover:bg-blue-50
                      group-hover:text-blue-600
                    "
                  >
                    <ChevronRight size={18} />
                  </span>

                </button>


              </motion.article>
            );
          })}
            </motion.div>
          </AnimatePresence>

          <motion.div variants={ITEM_MOTION} className="flex shrink-0 flex-col gap-2 rounded-xl border border-slate-100 bg-white px-3 py-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-slate-500">
              Showing {visible.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, visible.length)} of {visible.length} notices
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45">Previous</button>
              <span className="min-w-16 text-center text-xs font-bold text-[#10145c]">{page} / {totalPages}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg border border-blue-200 bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">Next</button>
            </div>
          </motion.div>

        </div>

      )}

    </motion.div>
  );
};


export default ParentNotices;