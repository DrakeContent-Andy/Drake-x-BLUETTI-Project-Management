import './env.js';
import { pool, initSchema } from './db.js';

const PROJECTS = [
  { id:1, name:'Solar & Storage Live Expo', subject:'Exhibition', product:'', category:'Event/Campaign', month:'March 2026', status:'Completed', value:8935, driveLink:'', deliverables:[
    { text:'Channel partnership and communications — project coordination', driveLink:'' },
    { text:'Brand story video production — Ron staff interview (Energy Costs Saving)', driveLink:'' },
    { text:'Social media YouTube content published — 94K views', driveLink:'' },
    { text:'Exhibition venue photography and content capture (highlights, brand promo, archival)', driveLink:'' },
    { text:'RAW footage elements sourced on site', driveLink:'' },
    { text:'LinkedIn Expo Wrap-up post published — 32 Likes', driveLink:'' }
  ], note:'', showClient:true },
  { id:2, name:'Steve Lyons — EP2000 Testimonial', subject:'Steve Lyons', product:'EP2000', category:'Testimonial', month:'March 2026', status:'Completed', value:7500, driveLink:'', deliverables:[
    { text:'Production management — shoot coordination, venue logistics, team briefing, usage agreements', driveLink:'' },
    { text:'Shoot execution — on-location interviews, lighting, sound, B-roll footage', driveLink:'' },
    { text:'Post-production delivery — editing, colour grade, subtitles, brand elements', driveLink:'' },
    { text:'Long-form video: Real energy savings data — bill reduced to ~$23/month, zero grid reliance demonstrated', driveLink:'' },
    { text:'YouTube: Steve Lyons EP2000 — Testimonial & Installation — 38K views', driveLink:'' },
    { text:'LinkedIn post: Steve Lyons Testimonial published', driveLink:'' }
  ], note:'', showClient:true },
  { id:3, name:'Paid Ads — March Campaign', subject:'', product:'', category:'Paid Ads', month:'March 2026', status:'Completed', value:1005.50, driveLink:'', deliverables:[
    { text:'Spin to Win campaign creative production', driveLink:'' },
    { text:'Generic brand awareness campaign creative production', driveLink:'' }
  ], note:'', showClient:true },
  { id:4, name:'Alex De Garcia — EP2000 Social Content', subject:'Alex De Garcia', product:'EP2000', category:'Testimonial', month:'April 2026', status:'Completed', value:750, driveLink:'', deliverables:[
    { text:'Social statics: Product focus, reliability, zero carbon / word of mouth angles', driveLink:'' },
    { text:'Social statics: User experience — tech leadership, lifestyle change, energy independence', driveLink:'' },
    { text:'Social statics: System reliability proof — seamless switching, large capacity, energy freedom', driveLink:'' },
    { text:'YouTube content published — 22K views', driveLink:'' }
  ], note:'', showClient:true },
  { id:5, name:'Steve Lyons — EP2000 Social Content', subject:'Steve Lyons', product:'EP2000', category:'Testimonial', month:'April 2026', status:'Completed', value:750, driveLink:'', deliverables:[
    { text:'Social statics: Real energy savings — bill down to $23, near-zero electricity costs, smart app monitoring', driveLink:'' },
    { text:'Social statics: Product performance — 20kW inverter, multiple appliances simultaneously, unmatched value', driveLink:'' },
    { text:'YouTube content published — 93K views', driveLink:'' }
  ], note:'', showClient:true },
  { id:6, name:'Terrence Alfred — EP2000 Testimonial', subject:'Terrence Alfred', product:'EP2000', category:'Testimonial', month:'April 2026', status:'In Production', value:6000, driveLink:'', deliverables:[
    { text:'Production management — shoot coordination, venue logistics, team briefing, usage agreements', driveLink:'' },
    { text:'Shoot day 20 April — on-location interviews, lighting, B-roll', driveLink:'' },
    { text:'Post-production in progress — estimated May completion', driveLink:'' }
  ], note:'', showClient:true },
  { id:7, name:'Anil Sudhakar Rao — EP2000 Testimonial', subject:'Anil Sudhakar Rao', product:'EP2000', category:'Testimonial', month:'April 2026', status:'In Production', value:6000, driveLink:'', deliverables:[
    { text:'Production management — shoot coordination, venue logistics, team briefing, usage agreements', driveLink:'' },
    { text:'Shoot day 24 April — on-location interviews, lighting, B-roll', driveLink:'' },
    { text:'Post-production in progress — estimated May completion', driveLink:'' }
  ], note:'', showClient:true },
  { id:8, name:'Sydney Installation Case Study — EP2000', subject:'Sydney Customer', product:'EP2000', category:'Testimonial', month:'April 2026', status:'In Production', value:6000, driveLink:'', deliverables:[
    { text:'Production management — shoot coordination, venue logistics, team briefing, usage agreements', driveLink:'' },
    { text:'Shoot day 28 April — on-location interviews, lighting, B-roll', driveLink:'' },
    { text:'Post-production in progress — estimated May completion', driveLink:'' }
  ], note:'', showClient:true },
  { id:9, name:"Today's Show Campaign", subject:'Channel 9 Today Show', product:'EP2000', category:'Event/Campaign', month:'April 2026', status:'Completed', value:14346.48, driveLink:'', deliverables:[
    { text:'Channel partnership and coordination — 5-day morning broadcast giveaway activation', driveLink:'' },
    { text:'Giveaway broadcast video production', driveLink:'' },
    { text:'Day 1: Winner Kim Dakin — first winner reveal and giveaway promotion', driveLink:'' },
    { text:"Day 2: Brand warmth content — community care, new dad Jarred's story", driveLink:'' },
    { text:"Day 3: Multi-generational family — Tom's high-energy household", driveLink:'' },
    { text:'Day 4: Brand image video — Natalie Hargraves, single mum of three', driveLink:'' },
    { text:'Day 5: Jane McLeod — home battery improving family energy costs', driveLink:'' },
    { text:'Expert opinion video: Joel Gibson — home battery rebate drop urgency content', driveLink:'' },
    { text:"YouTube: Australia's Money Expert Explains the Home Battery Rebate Drop", driveLink:'' },
    { text:'Social statics: Jarred — emotional storytelling, family energy savings', driveLink:'' },
    { text:'Social statics: Joel Gibson — rebate urgency, 3–4 year payback', driveLink:'' },
    { text:'Social statics: Tom — brand social responsibility, solar + storage story', driveLink:'' }
  ], note:'', showClient:true },
  { id:10, name:'Paid Ads — April Campaign', subject:'', product:'', category:'Paid Ads', month:'April 2026', status:'Completed', value:300, driveLink:'', deliverables:[
    { text:'Google Ads creative concept', driveLink:'' },
    { text:'LinkedIn post: Blackout resilience angle — power never stops', driveLink:'' },
    { text:'LinkedIn post: Overnight off-grid use / EP2000 large capacity energy', driveLink:'' },
    { text:'LinkedIn post: Invite target audience to Smart Energy Expo', driveLink:'' },
    { text:'RAW material sourcing for creative assets', driveLink:'' }
  ], note:'', showClient:true },
];

// Tasks start empty — the new project-centric progress board is populated in-app.
const TASKS = [];

const GOALS = [
  { month:'May 2026', category:'Testimonial', description:'Complete post-production on all 3 April shoots (Terrence, Anil, Sydney)', target:'3 edits' },
  { month:'May 2026', category:'Social Media', description:'Publish minimum 4 LinkedIn posts', target:'4 posts' },
  { month:'May 2026', category:'Social Media', description:'Publish minimum 6 Instagram/Facebook posts', target:'6 posts' },
  { month:'May 2026', category:'Paid Ads', description:'Deliver Pack003 creative assets to Bluetti', target:'1 pack' },
  { month:'May 2026', category:'KOL', description:'Finalise and sign Neerav Bhatt contract', target:'1 KOL signed' },
  { month:'May 2026', category:'KOC', description:'Dispatch all pending product gifts', target:'2 dispatched' },
];

const DEFAULT_SETTINGS = {
  assignees: ['Andy', 'Luke', 'Martin', 'Maverick'],
  slack: {
    enabled: false,
    weeklyChannel: '',
    overdueChannel: '',
    monthlyChannel: '',
    weeklyDay: 1,          // 0=Sun .. 6=Sat (Monday)
    weeklyTime: '09:00',   // 24h HH:MM in the configured timezone
    monthlyDay: 'last',    // 'last' day of month, or a day number 1-28
    monthlyTime: '17:00',
    timezone: 'Australia/Sydney',
  },
};

// Seed defaults only if the projects table is empty. Does NOT close the pool,
// so it is safe to call from the server boot sequence.
export async function seedIfEmpty() {
  await ensureSettings();
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM projects');
  if (rows[0].n > 0) {
    console.log('Projects already exist — skipping data seed.');
    return;
  }

  for (const p of PROJECTS) {
    await pool.query(
      `INSERT INTO projects (id, name, subject, product, category, month, status, value, drive_link, deliverables, note, show_client, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [p.id, p.name, p.subject, p.product, p.category, p.month, p.status, p.value, p.driveLink,
       JSON.stringify(p.deliverables), p.note, p.showClient, p.id]
    );
  }
  await pool.query(`SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects))`);

  for (const t of TASKS) {
    await pool.query(
      `INSERT INTO tasks (id, task, project_id, assignee, start_date, due_date, status, priority, drive_link, note, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [t.id, t.task, t.projectId, t.assignee, t.startDate || null, t.dueDate || null, t.status, t.priority, t.driveLink, t.note, t.description || '']
    );
  }
  if (TASKS.length) {
    await pool.query(`SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks))`);
  }

  for (const g of GOALS) {
    await pool.query(
      `INSERT INTO goals (month, category, description, target) VALUES ($1,$2,$3,$4)`,
      [g.month, g.category, g.description, g.target]
    );
  }

  console.log('Seed complete: %d projects, %d tasks, %d goals.', PROJECTS.length, TASKS.length, GOALS.length);
}

async function ensureSettings() {
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('assignees', $1)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(DEFAULT_SETTINGS.assignees)]
  );
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('slack', $1)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(DEFAULT_SETTINGS.slack)]
  );
}

// CLI entry: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await initSchema();
    await seedIfEmpty();
    await pool.end();
  })().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
