import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ArrowRight, Mail, Phone, Search, Rocket, Home } from 'lucide-react';

const NEXT_STEPS = [
  {
    icon: Search,
    title: 'Review Process',
    desc: 'Our admin team will review your registration and verify your submitted documents.',
  },
  {
    icon: Mail,
    title: 'Email Notification',
    desc: 'You will receive an email notification once your registration is approved.',
  },
  {
    icon: Phone,
    title: 'Phone Call',
    desc: 'Our sales team will connect with you shortly.',
  },
  {
    icon: Rocket,
    title: 'Get Started',
    desc: 'After approval, you can create admin accounts and start using the platform.',
  },
];

const CONFETTI = [
  { className: 'top-0 left-2 w-1.5 h-1.5 bg-orange-400', delay: 0 },
  { className: 'top-1 right-0 w-1 h-1 bg-emerald-400', delay: 0.3 },
  { className: 'bottom-1 left-0 w-1 h-1 bg-sky-400', delay: 0.6 },
  { className: '-bottom-1 right-2 w-1.5 h-1.5 bg-amber-300', delay: 0.9 },
];

const SchoolRegistrationSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Preserved from the previous implementation — not rendered directly in
  // this design (the approved mockup has no school-summary card), but kept
  // available since the registration flow still passes it through.
  const schoolData = location.state?.schoolData;
  void schoolData;

  const prefersReducedMotion = useReducedMotion();

  return (
    <main className="relative h-dvh overflow-hidden bg-[#FFFDF8] flex items-center justify-center px-3 py-3 sm:px-4 sm:py-4">
      <style>{`
        @keyframes successBlobFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(18px, -14px) scale(1.05); }
        }
        @keyframes successParticleDrift {
          0%, 100% { transform: translateY(0); opacity: .35; }
          50% { transform: translateY(-16px); opacity: .8; }
        }
        @keyframes successImageFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .success-blob { animation: successBlobFloat 9s ease-in-out infinite; }
        .success-blob-slow { animation: successBlobFloat 13s ease-in-out infinite; }
        .success-particle { animation: successParticleDrift 6s ease-in-out infinite; }
        .success-image-float { animation: successImageFloat 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .success-blob, .success-blob-slow, .success-particle, .success-image-float { animation: none; }
        }
      `}</style>

      {/* ── Background: radial gradients, blurred glow, grain, particles ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,#FFF8EC_0%,transparent_55%),radial-gradient(circle_at_85%_15%,#FFF5E0_0%,transparent_50%),radial-gradient(circle_at_50%_100%,#FFF7EB_0%,transparent_60%)]" />
        <div className="success-blob absolute -top-24 -left-20 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-orange-200/40 blur-[90px]" />
        <div className="success-blob-slow absolute top-1/3 -right-24 w-80 h-80 sm:w-[26rem] sm:h-[26rem] rounded-full bg-amber-200/35 blur-[100px]" />
        <div className="success-blob absolute -bottom-24 left-1/4 w-72 h-72 rounded-full bg-yellow-100/50 blur-[90px]" />

        {/* subtle grain */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.035] mix-blend-multiply">
          <filter id="successGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#successGrain)" />
        </svg>

        {/* light particles */}
        {[
          { top: '18%', left: '8%', delay: 0 },
          { top: '30%', left: '92%', delay: 1 },
          { top: '70%', left: '12%', delay: 2 },
          { top: '82%', left: '88%', delay: 1.5 },
          { top: '10%', left: '50%', delay: 0.6 },
        ].map((p, i) => (
          <span
            key={i}
            className="success-particle absolute w-1.5 h-1.5 rounded-full bg-orange-300/70"
            style={{ top: p.top, left: p.left, animationDelay: `${p.delay}s` }}
          />
        ))}
      </div>

      {/* ── Main glass card — capped to the viewport; overflow-y-auto is a
           safety net only (so content is never clipped/hidden on very short
           screens), the compact spacing below is tuned to avoid needing it
           on typical phone/tablet/laptop/desktop viewports. ── */}
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-[1400px] max-h-full overflow-y-auto rounded-[24px] sm:rounded-[32px] border border-white/40 bg-white/80 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(194,120,3,0.25)] p-4 sm:p-5 lg:p-6"
      >
        <div
          className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6 lg:grid-cols-[46%_54%] lg:items-center
                     [grid-template-areas:'icon'_'heading'_'subtitle'_'image'_'timeline'_'help'_'button']
                     lg:[grid-template-areas:'image_icon'_'image_heading'_'image_subtitle'_'image_timeline'_'image_help'_'image_button']"
        >
          {/* ── Illustration (left on desktop, reflows between subtitle & timeline on mobile) ── */}
          <div className="[grid-area:image] flex items-center justify-center">
            <div className="relative w-full max-w-[150px] sm:max-w-[100%] lg:max-w-[100%] xl:max-w-[100%]">
              <div
                aria-hidden="true"
                className="absolute inset-0 m-auto w-full h-full rounded-full bg-orange-200/40 blur-3xl"
              />
              <motion.img
                src="/register-success.png"
                alt="Illustration of a smiling admin giving a thumbs up after successfully submitting the school registration"
                className="relative w-full h-full max-w-full object-contain drop-shadow-[0_15px_30px_rgba(194,120,3,0.25)]"
                //  ${
                  // prefersReducedMotion ? '' : 'success-image-float'}
              />
            </div>
          </div>

          {/* ── Success icon ── */}
          <div className="[grid-area:icon] flex justify-center">
            <div className="relative">
              <div aria-hidden="true" className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-emerald-300/40 blur-2xl" />
              {!prefersReducedMotion &&
                CONFETTI.map((c, i) => (
                  <motion.span
                    key={i}
                    aria-hidden="true"
                    className={`absolute rounded-sm ${c.className}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0, 1, 1, 0.6], rotate: [0, 90] }}
                    transition={{ duration: 2.2, delay: 0.4 + c.delay, repeat: Infinity, repeatDelay: 1.6 }}
                  />
                ))}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-100 border border-emerald-200/70 flex items-center justify-center shadow-lg shadow-emerald-100"
              >
                <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" strokeWidth={3} aria-hidden="true" />
              </motion.div>
            </div>
          </div>

          {/* ── Heading ── */}
          <motion.h1
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="[grid-area:heading] text-center text-[19px] sm:text-[22px] lg:text-[24px] xl:text-[28px] font-bold leading-tight text-[#1F2937]"
          >
            Registration Submitted <span className="text-emerald-600">Successfully!</span>
          </motion.h1>

          {/* ── Subtitle ── */}
          <motion.p
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="[grid-area:subtitle] text-center text-[11px] sm:text-xs lg:text-sm text-gray-500"
          >
            Thank you for registering your school with us.
          </motion.p>

          {/* ── Next steps card ── */}
          <div className="[grid-area:timeline] flex justify-center">
          <motion.section
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            aria-labelledby="next-steps-heading"
            className="[grid-area:timeline] w-2/3 rounded-[14px] sm:rounded-[18px] bg-white border border-gray-100 shadow-[0_12px_32px_-16px_rgba(15,23,42,0.12)] p-3 sm:p-4"
          >
            <h2 id="next-steps-heading" className="text-center text-xs sm:text-sm font-bold text-gray-800 mb-1.5 sm:mb-2">
              What happens next?
            </h2>

            <ol className="space-y-0">
              {NEXT_STEPS.map((step, idx) => {
                const isLast = idx === NEXT_STEPS.length - 1;
                return (
                  <motion.li
                    key={step.title}
                    initial={prefersReducedMotion ? undefined : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.15 + idx * 0.06 }}
                    className="relative flex gap-2 sm:gap-3"
                  >
                    <div className="relative shrink-0">
                      {/* <span className="absolute top-2 -left-3 z-10 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] font-bold ring-2 ring-white">
                        {idx + 1}
                      </span> */}
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <step.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" aria-hidden="true" />
                      </div>
                      {!isLast && (
                        <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 top-7 sm:top-8 bottom-0 w-px bg-emerald-200" />
                      )}
                    </div>
                    <div className={isLast ? 'pb-0' : 'pb-1.5 sm:pb-2'}>
                      <h3 className="text-[11px] sm:text-xs font-semibold text-gray-800 leading-snug">{step.title}</h3>
                      <p className="text-[10px] sm:text-[11px] text-gray-500 leading-snug">{step.desc}</p>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </motion.section>
          </div>
          {/* ── Help card ── */}
          <motion.section
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            aria-labelledby="help-heading"
            className="[grid-area:help] w-full rounded-[12px] sm:rounded-[16px] bg-white border border-gray-100 shadow-[0_10px_28px_-16px_rgba(15,23,42,0.1)] p-2.5 sm:p-3"
          >
            <h2 id="help-heading" className="text-center text-[11px] sm:text-xs font-bold text-gray-800 mb-1.5">
              Need Help?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-[11px]">
              <a
                href="mailto:electroniceducaresales@yarrowtech.co.in"
                className="flex items-center justify-center gap-1.5 text-gray-600 rounded-lg px-2 py-1 hover:bg-amber-50 hover:text-amber-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Mail size={12} className="text-amber-500 shrink-0" aria-hidden="true" />
                <span className="break-all">electroniceducaresales@yarrowtech.co.in</span>
              </a>
              <a
                href="tel:+919830590929"
                className="flex items-center justify-center gap-1.5 text-gray-600 rounded-lg px-2 py-1 hover:bg-amber-50 hover:text-amber-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Phone size={12} className="text-amber-500 shrink-0" aria-hidden="true" />
                <span>+91 9830590929</span>
              </a>
            </div>
          </motion.section>

          {/* ── Back to home button ── */}
          <div className="[grid-area:button] flex justify-center">
            <motion.button
              type="button"
              onClick={() => navigate('/')}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -2 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 px-4 sm:px-5 rounded-full text-white text-[11px] sm:text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 transition-shadow focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
            >
              <Home size={14} aria-hidden="true" />
              Back to Home
            </motion.button>
          </div>
        </div>
      </motion.div>
    </main>
  );
};

export default SchoolRegistrationSuccess;
