// Third-party simulation library for the Virtual Lab ("Import from library").
//
// Provider: PhET Interactive Simulations, University of Colorado Boulder —
// free HTML5 simulations licensed CC-BY 4.0 (attribution required, shown to
// students under every embedded simulation). Embedding in an iframe is allowed.
//
// Mapping: chapters follow the NCERT textbooks used by CBSE. ICSE and most State
// Boards cover the same topics in the same class, so entries list all three; a
// school can edit this file to change or extend the mapping. Every URL was
// checked to exist when this list was made.

export const SIM_PROVIDERS = {
  phet: {
    name: 'PhET',
    attribution: 'PhET Interactive Simulations, University of Colorado Boulder — https://phet.colorado.edu (CC-BY 4.0)',
    // only these hosts may be embedded (teacher-pasted links are checked too)
    hosts: ['phet.colorado.edu'],
  },
};

export const BOARDS = ['CBSE', 'ICSE', 'State Board'];
const ALL_BOARDS = BOARDS;

const phetUrl = (slug) => `https://phet.colorado.edu/sims/html/${slug}/latest/${slug}_all.html`;

const sim = (slug, title, cls, subject, chapter, objective) => ({
  id: `phet-${slug}-${cls}-${chapter}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  provider: 'phet',
  slug,
  title,
  url: phetUrl(slug),
  boards: ALL_BOARDS,
  className: String(cls),
  subject,
  chapter,
  objective,
});

export const SIMULATION_CATALOG = [
  // ── Class 6 ──
  sim('circuit-construction-kit-dc', 'Circuit Construction Kit', 6, 'Science', 'Electricity and Circuits', 'Build simple circuits with a cell, bulb and switch and see when the bulb glows.'),
  sim('fractions-intro', 'Fractions Intro', 6, 'Mathematics', 'Fractions', 'Show fractions with shapes and number lines and compare them.'),
  sim('ratio-and-proportion', 'Ratio and Proportion', 6, 'Mathematics', 'Ratio and Proportion', 'Explore equal ratios by changing two quantities together.'),
  sim('color-vision', 'Color Vision', 6, 'Science', 'Light, Shadows and Reflections', 'Mix coloured lights and see how we see colours.'),

  // ── Class 7 ──
  sim('ph-scale-basics', 'pH Scale: Basics', 7, 'Science', 'Acids, Bases and Salts', 'Test everyday liquids and find which are acidic, basic or neutral.'),
  sim('energy-forms-and-changes', 'Energy Forms and Changes', 7, 'Science', 'Heat', 'See how heat flows and how energy changes from one form to another.'),
  sim('number-line-integers', 'Number Line: Integers', 7, 'Mathematics', 'Integers', 'Place positive and negative numbers on a number line and compare them.'),
  sim('area-builder', 'Area Builder', 7, 'Mathematics', 'Perimeter and Area', 'Build shapes and find their area and perimeter.'),

  // ── Class 8 ──
  sim('forces-and-motion-basics', 'Forces and Motion: Basics', 8, 'Science', 'Force and Pressure', 'Push and pull objects and see how forces change motion.'),
  sim('under-pressure', 'Under Pressure', 8, 'Science', 'Force and Pressure', 'Explore how pressure in a liquid changes with depth.'),
  sim('friction', 'Friction', 8, 'Science', 'Friction', 'Rub two surfaces together and watch friction produce heat.'),
  sim('waves-intro', 'Waves Intro', 8, 'Science', 'Sound', 'Make waves and change their frequency and amplitude.'),
  sim('balloons-and-static-electricity', 'Balloons and Static Electricity', 8, 'Science', 'Some Natural Phenomena', 'Rub a balloon and see how electric charges move.'),
  sim('john-travoltage', 'John Travoltage', 8, 'Science', 'Some Natural Phenomena', 'Build up static charge and watch it discharge as a spark.'),
  sim('geometric-optics-basics', 'Geometric Optics: Basics', 8, 'Science', 'Light', 'Trace light through lenses and mirrors and see the image form.'),

  // ── Class 9 ──
  sim('states-of-matter-basics', 'States of Matter: Basics', 9, 'Science', 'Matter in Our Surroundings', 'Heat and cool particles and watch solids, liquids and gases change.'),
  sim('build-an-atom', 'Build an Atom', 9, 'Science', 'Structure of the Atom', 'Build atoms from protons, neutrons and electrons.'),
  sim('isotopes-and-atomic-mass', 'Isotopes and Atomic Mass', 9, 'Science', 'Structure of the Atom', 'Make isotopes and see how atomic mass is calculated.'),
  sim('forces-and-motion-basics', 'Forces and Motion: Basics', 9, 'Science', 'Force and Laws of Motion', 'Test Newton’s laws by applying forces to objects.'),
  sim('gravity-and-orbits', 'Gravity and Orbits', 9, 'Science', 'Gravitation', 'See how gravity keeps planets and moons in orbit.'),
  sim('buoyancy-basics', 'Buoyancy: Basics', 9, 'Science', 'Gravitation', 'Find out why some objects float and others sink.'),
  sim('density', 'Density', 9, 'Science', 'Gravitation', 'Compare mass and volume of blocks to find their density.'),
  sim('energy-skate-park-basics', 'Energy Skate Park: Basics', 9, 'Science', 'Work and Energy', 'Watch kinetic and potential energy change as a skater moves.'),
  sim('waves-intro', 'Waves Intro', 9, 'Science', 'Sound', 'Explore how sound waves travel and how pitch and loudness change.'),
  sim('graphing-lines', 'Graphing Lines', 9, 'Mathematics', 'Linear Equations in Two Variables', 'Plot lines and see how slope and intercept change them.'),

  // ── Class 10 ──
  sim('balancing-chemical-equations', 'Balancing Chemical Equations', 10, 'Science', 'Chemical Reactions and Equations', 'Balance equations so atoms are the same on both sides.'),
  sim('reactants-products-and-leftovers', 'Reactants, Products and Leftovers', 10, 'Science', 'Chemical Reactions and Equations', 'See which reactant runs out and what is left over.'),
  sim('acid-base-solutions', 'Acid-Base Solutions', 10, 'Science', 'Acids, Bases and Salts', 'Compare strong and weak acids and bases.'),
  sim('ph-scale-basics', 'pH Scale: Basics', 10, 'Science', 'Acids, Bases and Salts', 'Measure the pH of everyday solutions.'),
  sim('bending-light', 'Bending Light', 10, 'Science', 'Light – Reflection and Refraction', 'Shine light into different materials and see it bend.'),
  sim('geometric-optics-basics', 'Geometric Optics: Basics', 10, 'Science', 'Light – Reflection and Refraction', 'Form images with convex and concave lenses and mirrors.'),
  sim('ohms-law', 'Ohm’s Law', 10, 'Science', 'Electricity', 'Change voltage and resistance and see how current changes.'),
  sim('resistance-in-a-wire', 'Resistance in a Wire', 10, 'Science', 'Electricity', 'See how length, area and material change a wire’s resistance.'),
  sim('circuit-construction-kit-dc', 'Circuit Construction Kit', 10, 'Science', 'Electricity', 'Build series and parallel circuits and measure them.'),
  sim('natural-selection', 'Natural Selection', 10, 'Science', 'Heredity', 'See how traits help a population survive over generations.'),
  sim('greenhouse-effect', 'The Greenhouse Effect', 10, 'Science', 'Our Environment', 'See how greenhouse gases trap heat in the atmosphere.'),

  // ── Class 11 ──
  sim('forces-and-motion-basics', 'Forces and Motion: Basics', 11, 'Physics', 'Laws of Motion', 'Apply forces and test Newton’s laws.'),
  sim('projectile-motion', 'Projectile Motion', 11, 'Physics', 'Motion in a Plane', 'Launch projectiles and see how angle and speed change the path.'),
  sim('gravity-and-orbits', 'Gravity and Orbits', 11, 'Physics', 'Gravitation', 'Explore orbits and how gravity depends on mass and distance.'),
  sim('hookes-law', 'Hooke’s Law', 11, 'Physics', 'Mechanical Properties of Solids', 'Stretch springs and find the spring constant.'),
  sim('pendulum-lab', 'Pendulum Lab', 11, 'Physics', 'Oscillations', 'Find what changes the time period of a pendulum.'),
  sim('masses-and-springs', 'Masses and Springs', 11, 'Physics', 'Oscillations', 'Hang masses on springs and study the oscillation.'),
  sim('wave-on-a-string', 'Wave on a String', 11, 'Physics', 'Waves', 'Make waves on a string and observe reflection and frequency.'),
  sim('gas-properties', 'Gas Properties', 11, 'Chemistry', 'States of Matter', 'Change pressure, volume and temperature of a gas.'),
  sim('build-an-atom', 'Build an Atom', 11, 'Chemistry', 'Structure of Atom', 'Build atoms and ions and check their charge and mass.'),
  sim('molecule-shapes', 'Molecule Shapes', 11, 'Chemistry', 'Chemical Bonding and Molecular Structure', 'Build molecules and see their 3D shapes (VSEPR).'),

  // ── Class 12 ──
  sim('charges-and-fields', 'Charges and Fields', 12, 'Physics', 'Electric Charges and Fields', 'Place charges and see the electric field and potential.'),
  sim('coulombs-law', 'Coulomb’s Law', 12, 'Physics', 'Electric Charges and Fields', 'Measure the force between two charges.'),
  sim('ohms-law', 'Ohm’s Law', 12, 'Physics', 'Current Electricity', 'Relate voltage, current and resistance.'),
  sim('circuit-construction-kit-dc', 'Circuit Construction Kit', 12, 'Physics', 'Current Electricity', 'Build circuits and verify Kirchhoff’s rules.'),
  sim('bending-light', 'Bending Light', 12, 'Physics', 'Ray Optics and Optical Instruments', 'Study refraction and total internal reflection.'),
  sim('molarity', 'Molarity', 12, 'Chemistry', 'Solutions', 'Change solute amount and volume and see the molarity.'),
  sim('concentration', 'Concentration', 12, 'Chemistry', 'Solutions', 'Explore concentration and saturation of solutions.'),
  sim('beers-law-lab', 'Beer’s Law Lab', 12, 'Chemistry', 'Solutions', 'See how concentration changes light absorbed by a solution.'),
];

/** True only for embeddable links from an approved provider. */
export const isAllowedSimUrl = (url) => {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'https:') return false;
    return Object.values(SIM_PROVIDERS).some((p) => p.hosts.includes(u.hostname));
  } catch {
    return false;
  }
};

/** Normalises a pasted PhET page link (…/simulations/density) to its embeddable HTML5 URL. */
export const toEmbeddableSimUrl = (raw) => {
  const text = String(raw || '').trim();
  const page = text.match(/^https:\/\/phet\.colorado\.edu\/(?:[a-z_-]+\/)?simulations\/([a-z0-9-]+)/i);
  if (page) return phetUrl(page[1].toLowerCase());
  return isAllowedSimUrl(text) ? text : '';
};

export const catalogClasses = () => [...new Set(SIMULATION_CATALOG.map((s) => s.className))].sort((a, b) => Number(a) - Number(b));
export const catalogSubjects = (className) => [...new Set(SIMULATION_CATALOG.filter((s) => !className || s.className === String(className)).map((s) => s.subject))].sort();

/** Experiment (kind 'embed') made from a catalogue entry or a pasted link. */
export const experimentFromSimulation = (entry, newId) => ({
  id: newId(),
  kind: 'embed',
  provider: entry.provider || 'phet',
  title: entry.title,
  simUrl: entry.url,
  attribution: SIM_PROVIDERS[entry.provider || 'phet']?.attribution || '',
  source: entry.className ? { board: entry.boards?.[0] || '', className: entry.className, subject: entry.subject, chapter: entry.chapter } : null,
  objective: entry.objective || '',
  materials: [],
  stages: [
    { title: 'Open the simulation', instruction: 'Look around the simulation and find all the controls.' },
    { title: 'Change one thing at a time', instruction: 'Change one control and watch carefully what happens.' },
    { title: 'Find the pattern', instruction: 'Try a few values and work out the rule behind what you see.' },
  ],
  jars: [],
  totalDays: 0,
  days: [],
  conclusion: '',
  questions: [],
  xp: { complete: 10, observations: 5, quiz: 10 },
});
