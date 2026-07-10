// The default onboarding checklist, transcribed from the company's paper
// "Onboarding Checklist" template. Edit this file (or use Admin → Checklist
// Template in the app) to change the master checklist. Existing employees keep
// the checklist they were created with; changes here only affect NEW employees.

// Staff who tasks can be assigned to. Each becomes a login so they can see
// "My Tasks". Usernames + the default password are shown to the admin in
// Admin → Staff. Everyone should change their password after first sign-in.
export const DEFAULT_STAFF = [
  { full_name: 'Jennifer Garcia', username: 'jgarcia', role: 'admin' },
  { full_name: 'Sandy Nguyen', username: 'snguyen', role: 'admin' },
  { full_name: 'Alyssa Jacobs', username: 'ajacobs', role: 'staff' },
  { full_name: 'Brittany York', username: 'byork', role: 'staff' },
  { full_name: 'Kali Winter', username: 'kwinter', role: 'staff' },
  { full_name: 'Meegan Hass', username: 'mhass', role: 'staff' },
  { full_name: 'Hayley Stumbris', username: 'hstumbris', role: 'staff' },
  { full_name: 'Kari Kennedy', username: 'kkennedy', role: 'staff' },
  { full_name: 'Susan Haise', username: 'shaise', role: 'staff' },
];

export const DEFAULT_STAFF_PASSWORD = 'welcome123';

// Each section maps to a block on the paper checklist. `doneByEmployee` marks
// the section the new hire completes themselves (the NHP paperwork). For every
// task, `assignee` is the default staff member responsible (matched by
// full_name to DEFAULT_STAFF); null means "unassigned" on the paper form.
export const DEFAULT_SECTIONS = [
  {
    name: 'New Hire Paperwork (NHP)',
    description: 'Completed by the employee.',
    doneByEmployee: true,
    tasks: [
      { title: 'I-9 and I-9 identification' },
      { title: 'W-4' },
      { title: 'Withholding' },
      { title: 'Direct deposit info' },
      { title: 'Health insurance info' },
      { title: 'Electronic distribution form' },
      { title: 'Confidentiality agreement' },
      { title: 'Noncompete' },
      { title: 'Systems Handbook' },
      { title: 'Device handling' },
      { title: 'State License Agreement' },
    ],
  },
  {
    name: 'Before Start Date / Systems',
    description: 'Accounts, access and setup completed before day one.',
    tasks: [
      { title: 'Background check', assignee: 'Jennifer Garcia' },
      { title: 'Email address setup', assignee: 'Sandy Nguyen' },
      { title: 'Building badge', assignee: 'Alyssa Jacobs' },
      { title: 'Zenoti set up – clock in/out, amenities, commission, schedule, permissions', assignee: 'Brittany York' },
      { title: 'Add to Keep & Share / Advanced Scheduler', assignee: 'Sandy Nguyen' },
      { title: 'Training Program', assignee: 'Sandy Nguyen' },
      { title: '3CX set up', assignee: 'Brittany York' },
      { title: 'Teams / SharePoint and Group set ups', assignee: 'Brittany York' },
      { title: 'Add to station availability spreadsheet', assignee: 'Sandy Nguyen' },
      { title: 'Update employee schedule and license number', assignee: 'Jennifer Garcia' },
      { title: 'Aveda Pure Pro & Ultra Academy setup', assignee: 'Kali Winter' },
      { title: 'Set up email signature', assignee: 'Meegan Hass' },
      { title: 'Team member email contact list', assignee: null },
      { title: 'Update spreadsheet for 30/60/90', assignee: 'Sandy Nguyen' },
      { title: 'Bio on website', assignee: 'Hayley Stumbris' },
      { title: 'Invite to Neroli Team Facebook page', assignee: 'Hayley Stumbris' },
      { title: 'Headshots', assignee: 'Hayley Stumbris' },
      { title: 'Admin & SKN Bar: Share team contact info w/ Susan via text', assignee: 'Sandy Nguyen' },
      { title: 'IBW: Order nametag', assignee: null },
      { title: 'IBW: Provide classroom key', assignee: 'Kari Kennedy' },
      { title: 'IBW: Set up Advantage (SIS)', assignee: null },
      { title: 'IBW: Set up LearnAveda.net', assignee: 'Kali Winter' },
      { title: 'Admissions: Set up Hubspot', assignee: 'Brittany York' },
    ],
  },
  {
    name: 'Payroll / Benefits',
    description: 'Payroll system and benefits enrollment.',
    tasks: [
      { title: 'Added to UKG', assignee: 'Jennifer Garcia' },
      { title: 'Make paper file folder', assignee: 'Sandy Nguyen' },
      { title: 'Update employee time w/ eligible PTO', assignee: 'Meegan Hass' },
    ],
  },
  {
    name: 'Training & Touchdowns',
    description: 'Orientation and check-in milestones.',
    tasks: [
      { title: 'Orientation', assignee: 'Sandy Nguyen' },
      { title: 'Add 30/60/90 calendar invite', assignee: 'Sandy Nguyen' },
      { title: 'First day meeting w/ service provider', assignee: null },
    ],
  },
  {
    name: 'UKG Setup',
    description: 'Detailed UKG profile configuration.',
    tasks: [
      { title: 'Add Cost Center', assignee: 'Jennifer Garcia' },
      { title: 'Add Skills (Advanced Scheduler)', assignee: 'Sandy Nguyen' },
      { title: 'Add Voya Code (Extra Fields)', assignee: 'Meegan Hass' },
      { title: 'Add Work Schedule (Employee Profile)', assignee: 'Jennifer Garcia' },
      { title: 'Add Scheduler Profile', assignee: 'Sandy Nguyen' },
      { title: 'Add Performance Profile', assignee: 'Sandy Nguyen' },
      { title: 'Update ACA Profile', assignee: 'Meegan Hass' },
    ],
  },
];

// The offboarding checklist (transcribed from the company's "Offboarding
// Checklist" template). Used for the separate Offboarding template; it is only
// applied to an employee when an admin clicks "Start offboarding".
export const DEFAULT_OFFBOARDING_SECTIONS = [
  {
    name: 'Upon Resignation',
    tasks: [
      { title: 'Remove access to Facebook', assignee: 'Hayley Stumbris' },
      { title: 'Bio removed from website', assignee: 'Hayley Stumbris' },
      { title: 'Block Outlook/Teams user', assignee: 'Sandy Nguyen' },
      { title: 'GM Touchdown', assignee: null },
      { title: 'Close service provider books in Zenoti', assignee: 'Brittany York' },
      { title: 'Liaison verify no new guests in books', assignee: null },
      { title: 'No longer signed up for education / verify education for last 12 months', assignee: 'Kali Winter' },
      { title: "Put on Susan's calendar – service providers, instructors, and biz team", assignee: 'Sandy Nguyen' },
      { title: 'Process termination w/ Aflac, Nationwide and UHC', assignee: 'Meegan Hass' },
      { title: 'Exit Information Email', assignee: 'Diego Linden-Zayas' },
    ],
  },
  {
    name: 'Prior to Last Day',
    tasks: [
      { title: 'Turn in keys/assets', assignee: null },
      { title: 'Exit Interview', assignee: 'Jennifer Garcia' },
      { title: 'Disable Parking', assignee: 'Meegan Hass' },
    ],
  },
  {
    name: 'At End of Last Day',
    tasks: [
      { title: 'Disable Zenoti', assignee: 'Brittany York' },
      { title: 'Delete Outlook/Teams user', assignee: 'Sandy Nguyen' },
      { title: 'Notify VOYA of employment change', assignee: 'Meegan Hass' },
      { title: 'Remove from station availability spreadsheet', assignee: 'Sandy Nguyen' },
      { title: 'HR file removed from filing cabinet', assignee: 'Diego Linden-Zayas' },
      { title: 'Process termination in UKG', assignee: 'Sandy Nguyen' },
      { title: 'Remove Email Signature', assignee: 'Meegan Hass' },
    ],
  },
];
