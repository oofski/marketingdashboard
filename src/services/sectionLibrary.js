// Pre-built checklist sections ("building blocks").
//
// These are ready-made sections — each with its own tasks and (optionally) a
// default person to assign every task to — that an admin can drop into the
// Onboarding or Offboarding template from the Checklist Template page with one
// click. They are NOT auto-applied to anyone; they only get added when an admin
// chooses to add them, and from then on behave like any normal template section
// (so future hires/offboards built from that template pick them up).
//
// To add a new block, just append an entry below. Fields:
//   id            unique string (used as a React key)
//   company       label it's grouped under in the picker (e.g. a brand name)
//   template_type 'onboarding' or 'offboarding' — which template it belongs to
//   name          the section title that gets created
//   description   optional sub-text shown under the section
//   done_by_employee  true if the employee themselves completes these tasks
//   assignee      optional full name to assign every task to (must match a staff
//                 member's name exactly; falls back to Unassigned if not found)
//   tasks         array of { title } in order
export const SECTION_LIBRARY = [
  {
    id: 'ibw-institute-only',
    company: 'IBW',
    template_type: 'offboarding',
    name: 'Institute Only',
    description: 'Access removals for IBW institute staff.',
    done_by_employee: false,
    assignee: 'Kari Kennedy',
    tasks: [
      { title: 'Disable LearnAveda.net' },
      { title: 'Disable Qnity' },
      { title: 'Remove for Team Emails Group' },
      { title: 'Remove from MS Teams' },
      { title: 'Disable Shimzy Access (Admissions Only)' },
    ],
  },
];

// All distinct companies that have at least one block, in first-seen order.
export function libraryCompanies() {
  const seen = [];
  for (const b of SECTION_LIBRARY) if (!seen.includes(b.company)) seen.push(b.company);
  return seen;
}
