// Default seed for the pre-built section "blocks" library.
//
// Blocks are ready-made checklist sections — each with its own tasks and
// (optionally) a default person to assign every task to — that an admin can drop
// into the Onboarding or Offboarding template from the Checklist Template page
// with one click. Admins create and edit blocks IN THE APP; that live library is
// stored in the cloud database (see BlockLibrary in db.js). This file is only the
// starting set shown until an admin saves their own.
//
// Block fields:
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
