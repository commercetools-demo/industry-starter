/**
 * The 12 Malva services. Names and one-sentence descriptions are verbatim from design/malva/specs/plp.md
 * (the Claude Design prototype). Long-form copy (included, steps, records, faq) is DRAFT content written for the
 * demo (realistic, not flagged; the owner may edit it, SO-03 in plans/TODO-MANUAL-TESTING.md). The German copy is in
 * `services.de.ts`; the en-US copy is here.
 */
export type CategoryKey = 'plumbing' | 'waste-management';
export type Sector = 'facilities' | 'manufacturing' | 'property' | 'healthcare';
export type Frequency = 'one-off' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual';

export const SECTORS: Sector[] = ['facilities', 'manufacturing', 'property', 'healthcare'];
export const FREQUENCIES: Frequency[] = ['one-off', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'];

export interface ServiceDef {
  /** Slug, also the URL segment and the suffix of the product key (`mpw-svc-<slug>`). */
  slug: string;
  name: string;
  /** The card sentence from the design. */
  summary: string;
  category: CategoryKey;
  sectors: Sector[];
  frequencies: Frequency[];
  needsWasteDetails: boolean;
  included: string[];
  steps: string[];
  records: string[];
  faq: { question: string; answer: string }[];
  /** Slugs of related services (at most 3, never itself). */
  related: string[];
  /** Search phrase for the image script. */
}

const ALL: Sector[] = ['facilities', 'manufacturing', 'property', 'healthcare'];

export const SERVICES: ServiceDef[] = [
  {
    slug: 'pipe-installation-repair',
    name: 'Pipe installation & repair',
    summary: 'Mains, process and distribution pipework in steel, copper and PE. Planned shutdown works with isolation plans.',
    category: 'plumbing',
    sectors: ALL,
    frequencies: ['one-off', 'annual'],
    needsWasteDetails: false,
    included: ['Site survey and written scope before work starts', 'Installation or repair in steel, copper and PE', 'Isolation and shutdown plan agreed with your site team', 'Pressure testing, flushing and commissioning'],
    steps: ['We survey the site and agree the scope and shutdown window', 'Our engineers isolate, install or repair and test the pipework', 'We commission, record the results and hand over the as-built details'],
    records: ['Pressure test certificate', 'As-built pipework record', 'Isolation plan'],
    faq: [
      { question: 'Can you work outside production hours?', answer: 'Yes. Shutdown works are planned around your production or opening hours, including nights and weekends.' },
      { question: 'Which materials do you work with?', answer: 'Steel, copper and PE for mains, process and distribution pipework.' },
      { question: 'Do you provide emergency repairs?', answer: 'Contracted clients have a 4-hour emergency response on the 24/7 line.' },
    ],
    related: ['drain-cleaning-cctv-survey', 'backflow-water-testing', 'commercial-fit-outs'],
  },
  {
    slug: 'drain-cleaning-cctv-survey',
    name: 'Drain cleaning & CCTV survey',
    summary: 'High-pressure jetting and recorded CCTV surveys with condition-graded reports.',
    category: 'plumbing',
    sectors: ALL,
    frequencies: ['one-off', 'quarterly', 'annual'],
    needsWasteDetails: false,
    included: ['High-pressure water jetting of drains and gullies', 'Recorded CCTV survey of drain runs', 'Condition-graded report with photographs', 'Recommended repairs in priority order'],
    steps: ['We agree access and the lines to survey', 'We jet and clean, then run the camera and record the survey', 'You receive the graded report in the client portal'],
    records: ['CCTV survey report', 'Condition grading by run', 'Cleaning record'],
    faq: [
      { question: 'How is the condition graded?', answer: 'Each run is graded from 1 (good) to 5 (collapsed) with photographs of defects.' },
      { question: 'How long does a survey take?', answer: 'A typical commercial site takes one day; larger sites are scheduled in phases.' },
      { question: 'Can this be scheduled regularly?', answer: 'Yes, quarterly or annual cleaning and survey visits can be set up as a planned contract.' },
    ],
    related: ['pipe-installation-repair', 'grease-trap-servicing', 'backflow-water-testing'],
  },
  {
    slug: 'backflow-water-testing',
    name: 'Backflow & water testing',
    summary: 'Backflow preventer testing, legionella risk assessments and water-quality sampling.',
    category: 'plumbing',
    sectors: ['facilities', 'manufacturing', 'property', 'healthcare'],
    frequencies: ['one-off', 'quarterly', 'annual'],
    needsWasteDetails: false,
    included: ['Backflow preventer inspection and testing', 'Legionella risk assessment', 'Water-quality sampling and lab analysis', 'Remedial recommendations'],
    steps: ['We register your backflow devices and sample points', 'We test and sample on the agreed schedule', 'Results and any remedial actions are logged for audit'],
    records: ['Backflow test certificate', 'Legionella risk assessment', 'Water sample results'],
    faq: [
      { question: 'Who needs backflow testing?', answer: 'Sites with backflow preventers on their water supply, including process, healthcare and food premises.' },
      { question: 'How often do we test?', answer: 'Typically annually, and quarterly for higher-risk systems such as healthcare water systems.' },
      { question: 'Are results audit-ready?', answer: 'Yes. Certificates and results are stored in the client portal for inspections.' },
    ],
    related: ['drain-cleaning-cctv-survey', 'boiler-hot-water', 'compliance-reporting'],
  },
  {
    slug: 'boiler-hot-water',
    name: 'Boiler & hot water',
    summary: 'Commercial boilers, calorifiers and hot water systems — service, repair, replacement.',
    category: 'plumbing',
    sectors: ALL,
    frequencies: ['one-off', 'annual'],
    needsWasteDetails: false,
    included: ['Annual service of commercial boilers and calorifiers', 'Fault finding and repair', 'Replacement design and installation', 'Hot water temperature and safety checks'],
    steps: ['We inspect the plant and agree a service or replacement plan', 'We service, repair or replace with minimal disruption', 'We test, commission and record the system settings'],
    records: ['Service record', 'Safety check certificate', 'Commissioning record'],
    faq: [
      { question: 'Do you replace as well as service?', answer: 'Yes. We design, supply and install replacement boilers, calorifiers and hot water systems.' },
      { question: 'Can you work without losing hot water?', answer: 'Where possible we phase works or provide temporary supply to keep the site running.' },
      { question: 'Do you cover gas safety?', answer: 'Work is carried out by qualified engineers and recorded for compliance.' },
    ],
    related: ['backflow-water-testing', 'pipe-installation-repair', 'commercial-fit-outs'],
  },
  {
    slug: 'commercial-fit-outs',
    name: 'Commercial fit-outs',
    summary: 'First and second-fix plumbing for offices, plants, wards and retail units.',
    category: 'plumbing',
    sectors: ALL,
    frequencies: ['one-off'],
    needsWasteDetails: false,
    included: ['First-fix and second-fix plumbing', 'Sanitaryware and wash facilities', 'Coordination with the main contractor', 'Testing and handover documents'],
    steps: ['We review the drawings and agree the programme with your contractor', 'We carry out first fix, then second fix at the agreed stages', 'We test, snag and hand over with full documentation'],
    records: ['Test and commissioning certificates', 'Handover pack', 'As-built drawings'],
    faq: [
      { question: 'Can you work with our main contractor?', answer: 'Yes. We coordinate programme, access and sign-off with the main contractor.' },
      { question: 'Do you fit out clinical areas?', answer: 'Yes, including wards and clinical wash facilities with the required water-safety measures.' },
      { question: 'Is maintenance available afterwards?', answer: 'Yes, a planned maintenance contract can start at handover.' },
    ],
    related: ['pipe-installation-repair', 'boiler-hot-water', 'drain-cleaning-cctv-survey'],
  },
  {
    slug: 'general-waste-collection',
    name: 'General waste collection',
    summary: 'Scheduled pickups sized to site volume, with bin and compactor options.',
    category: 'waste-management',
    sectors: ALL,
    frequencies: ['weekly', 'fortnightly', 'monthly'],
    needsWasteDetails: false,
    included: ['Scheduled collections sized to your volume', 'Bins, skips or compactors', 'Collection and weighing records', 'Flexible extra pickups'],
    steps: ['We assess your volumes and agree containers and frequency', 'Our crews collect on schedule and record weights', 'You review collections and costs in the client portal'],
    records: ['Waste transfer notes', 'Collection and weight log', 'Monthly summary'],
    faq: [
      { question: 'Can we change frequency?', answer: 'Yes. Frequency and container sizes can be adjusted as your volumes change.' },
      { question: 'Do you provide compactors?', answer: 'Yes, bins, skips and compactors are available depending on volume.' },
      { question: 'Are transfer notes provided?', answer: 'Yes, a waste transfer note for every collection, stored digitally.' },
    ],
    related: ['recycling', 'compliance-reporting', 'hazardous-waste'],
  },
  {
    slug: 'recycling',
    name: 'Recycling',
    summary: 'Segregated streams for cardboard, plastics, metals and glass with monthly rate reporting.',
    category: 'waste-management',
    sectors: ALL,
    frequencies: ['weekly', 'fortnightly', 'monthly'],
    needsWasteDetails: false,
    included: ['Separate streams for cardboard, plastics, metals and glass', 'Segregation guidance and staff briefings', 'Monthly recycling and diversion-rate reports', 'Annual waste reduction plan'],
    steps: ['We audit your waste streams and set up segregation', 'We collect each stream and weigh it', 'You receive monthly diversion-rate reporting'],
    records: ['Recycling certificates', 'Monthly diversion-rate report', 'Stream weight log'],
    faq: [
      { question: 'What can be recycled?', answer: 'Cardboard, plastics, metals and glass, collected as separate streams.' },
      { question: 'How is the diversion rate measured?', answer: 'Weights recycled divided by total weights collected, reported monthly.' },
      { question: 'Do you help staff segregate correctly?', answer: 'Yes, with signage and on-site staff briefings.' },
    ],
    related: ['general-waste-collection', 'compliance-reporting', 'hazardous-waste'],
  },
  {
    slug: 'hazardous-waste',
    name: 'Hazardous waste',
    summary: 'Licensed collection of oils, solvents, chemicals and batteries with consignment notes.',
    category: 'waste-management',
    sectors: ['manufacturing', 'healthcare', 'facilities'],
    frequencies: ['one-off', 'monthly', 'quarterly'],
    needsWasteDetails: true,
    included: ['Licensed collection of oils, solvents, chemicals and batteries', 'Packaging and labelling guidance', 'Consignment notes for every collection', 'Treatment at permitted sites only'],
    steps: ['We classify your waste and agree packaging and labelling', 'A licensed driver collects and issues the consignment note', 'We track the waste to permitted treatment and close the record'],
    records: ['Consignment notes', 'Carrier licence details', 'Treatment confirmation'],
    faq: [
      { question: 'What do we need to provide?', answer: 'Waste types and quantities, and your site permit or licence number where relevant.' },
      { question: 'Who treats the waste?', answer: 'Only permitted treatment sites, recorded on the consignment note.' },
      { question: 'Can you collect at short notice?', answer: 'One-off collections can usually be arranged quickly after classification.' },
    ],
    related: ['liquid-waste-tankering', 'compliance-reporting', 'medical-clinical-waste'],
  },
  {
    slug: 'grease-trap-servicing',
    name: 'Grease trap servicing',
    summary: 'Scheduled emptying and cleaning for kitchens and food production.',
    category: 'waste-management',
    sectors: ['facilities', 'manufacturing', 'healthcare', 'property'],
    frequencies: ['monthly', 'quarterly'],
    needsWasteDetails: false,
    included: ['Scheduled emptying and cleaning of grease traps', 'Disposal at a permitted site', 'Service record after every visit', 'Advice to reduce fats, oils and grease'],
    steps: ['We register your traps and agree the schedule', 'We empty, clean and inspect each trap', 'We record the visit and dispose of the waste compliantly'],
    records: ['Service record per visit', 'Waste transfer notes', 'Inspection notes'],
    faq: [
      { question: 'How often should traps be emptied?', answer: 'Monthly or quarterly depending on kitchen output; we recommend a frequency after a first visit.' },
      { question: 'Do you service food production sites?', answer: 'Yes, kitchens and food production premises.' },
      { question: 'Is disposal included?', answer: 'Yes, waste goes to a permitted site and is documented.' },
    ],
    related: ['drain-cleaning-cctv-survey', 'liquid-waste-tankering', 'general-waste-collection'],
  },
  {
    slug: 'medical-clinical-waste',
    name: 'Medical / clinical waste',
    summary: 'Segregated, tracked collection for clinics, labs and care facilities.',
    category: 'waste-management',
    sectors: ['healthcare'],
    frequencies: ['weekly', 'fortnightly', 'monthly'],
    needsWasteDetails: true,
    included: ['Segregated containers for clinical waste streams', 'Tracked collection from site to treatment', 'Staff guidance on segregation and storage', 'Audit-ready records for inspections'],
    steps: ['We assess your waste streams and supply containers', 'Trained drivers collect and track each container', 'You download the records for audits from the client portal'],
    records: ['Consignment notes', 'Tracking and treatment records', 'Annual waste report'],
    faq: [
      { question: 'Which facilities do you serve?', answer: 'Clinics, laboratories and care facilities.' },
      { question: 'Is every container tracked?', answer: 'Yes, from your site to final treatment, with records available for audits.' },
      { question: 'Do you train our staff?', answer: 'We provide segregation and storage guidance on request.' },
    ],
    related: ['hazardous-waste', 'compliance-reporting', 'backflow-water-testing'],
  },
  {
    slug: 'liquid-waste-tankering',
    name: 'Liquid waste & tankering',
    summary: 'Tanker collection of process effluent, sludge and interceptor contents.',
    category: 'waste-management',
    sectors: ['manufacturing', 'facilities'],
    frequencies: ['one-off', 'monthly', 'quarterly'],
    needsWasteDetails: true,
    included: ['Tanker collection of process effluent and sludge', 'Emptying of interceptors and separators', 'Disposal at permitted treatment sites', 'Documentation for every load'],
    steps: ['We analyse the liquid waste and agree handling and permits', 'A tanker collects on the agreed schedule', 'We record the load and confirm treatment'],
    records: ['Consignment notes', 'Load records', 'Treatment confirmation'],
    faq: [
      { question: 'What liquids can you take?', answer: 'Process effluent, sludge and interceptor contents, subject to classification.' },
      { question: 'Can tankers access our site?', answer: 'We check access and connections during the survey.' },
      { question: 'Do you provide one-off collections?', answer: 'Yes, as well as monthly and quarterly schedules.' },
    ],
    related: ['hazardous-waste', 'grease-trap-servicing', 'compliance-reporting'],
  },
  {
    slug: 'compliance-reporting',
    name: 'Compliance reporting',
    summary: 'Waste transfer notes, audit trails and annual reports in one portal.',
    category: 'waste-management',
    sectors: ALL,
    frequencies: ['monthly', 'quarterly', 'annual'],
    needsWasteDetails: false,
    included: ['Waste transfer and consignment notes stored digitally', 'Monthly recycling and diversion-rate reports', 'Audit-ready records for ISO and regulatory inspections', 'Annual waste reduction plan'],
    steps: ['We connect your collections to your client portal account', 'Records are created automatically with every collection', 'You export reports for audits and your annual review'],
    records: ['Waste transfer notes', 'Diversion-rate reports', 'Annual waste report'],
    faq: [
      { question: 'Where do I find my records?', answer: 'In the client portal, by site, waste type and date.' },
      { question: 'Do reports cover all waste streams?', answer: 'Yes, every stream collected under your contract.' },
      { question: 'Can I share reports with auditors?', answer: 'Yes. Documents can be downloaded as PDFs.' },
    ],
    related: ['recycling', 'general-waste-collection', 'medical-clinical-waste'],
  },
];

export const serviceKey = (slug: string): string => `mpw-svc-${slug}`;
export const serviceSku = (slug: string): string => `MPW-${slug.toUpperCase()}`;
