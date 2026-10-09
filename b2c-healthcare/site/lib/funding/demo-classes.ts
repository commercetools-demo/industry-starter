/**
 * Demo-only: which medication class a SKU belongs to, for the demo cost-share rules. A real scheme would answer from
 * its own formulary; the storefront would send the SKU (or a code) and take the answer. `resolver.test.ts` keeps
 * this table in step with the seed (`scripts/seed/data/medications.ts`).
 */
export const DEMO_SKU_CLASS: Readonly<Record<string, string>> = {
  'MED-amoxicillin-500-mg': 'antibiotics',
  'MED-ibuprofen-400-mg': 'pain-relief',
  'MED-cetirizine-10-mg': 'allergy',
  'MED-atorvastatin-20-mg': 'cardiovascular',
  'MED-lisinopril-10-mg': 'cardiovascular',
  'MED-azithromycin-250-mg': 'antibiotics',
  'MED-ciprofloxacin-500-mg': 'antibiotics',
  'MED-amoxicillin-clavulanate-875-125-mg': 'antibiotics',
  'MED-acetaminophen-500-mg': 'pain-relief',
  'MED-naproxen-220-mg': 'pain-relief',
  'MED-loratadine-10-mg': 'allergy',
  'MED-fexofenadine-180-mg': 'allergy',
  'MED-amlodipine-5-mg': 'cardiovascular',
  'MED-metoprolol-50-mg': 'cardiovascular',
  'MED-metformin-500-mg': 'diabetes',
  'MED-omeprazole-20-mg': 'digestive',
  'MED-famotidine-20-mg': 'digestive',
  'MED-sertraline-50-mg': 'mental-health',
  'MED-alprazolam-0-5-mg': 'mental-health',
  'MED-tramadol-50-mg': 'pain-relief',
};
