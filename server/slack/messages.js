// Builds Slack message text + blocks from the full (admin-scoped) state.
// All date logic is string-based on 'YYYY-MM-DD' to avoid timezone drift.

const DONE_STATUSES = new Set(['Done', 'Completed', 'Void']);

export function todayInTz(tz) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

export function dowInTz(tz) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

export function hhmmInTz(tz) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date());
}

export function monthLabelInTz(tz) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', year: 'numeric' }).format(new Date());
}

export function dayOfMonthInTz(tz) {
  return parseInt(new Intl.DateTimeFormat('en-CA', { timeZone: tz, day: '2-digit' }).format(new Date()), 10);
}

export function isLastDayOfMonth(tz) {
  const today = dayOfMonthInTz(tz);
  // Add a day (UTC ms) then read the day-of-month in tz; if it dropped to 1, today was the last.
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: tz, day: '2-digit' })
    .format(new Date(Date.now() + 24 * 60 * 60 * 1000));
  return parseInt(tomorrow, 10) === 1 && today > 1;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function projectName(state, id) {
  if (!id) return null;
  const p = state.projects.find((x) => x.id === id);
  return p ? p.name : null;
}

function groupByAssignee(tasks) {
  const groups = {};
  for (const t of tasks) (groups[t.assignee || 'Unassigned'] ||= []).push(t);
  return groups;
}

// ── Weekly: tasks due this week (today .. +6), grouped by assignee ──
export function buildWeekly(state, tz) {
  const today = todayInTz(tz);
  const weekEnd = addDays(today, 6);
  const due = state.tasks.filter(
    (t) => t.dueDate && !DONE_STATUSES.has(t.status) && t.dueDate >= today && t.dueDate <= weekEnd
  );

  const header = `:calendar: *Tasks due this week* (${today} – ${weekEnd})`;
  if (!due.length) {
    return { text: 'Tasks due this week', blocks: section(header + '\n\n_Nothing due this week. :tada:_') };
  }
  due.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const groups = groupByAssignee(due);
  let body = '';
  for (const who of Object.keys(groups).sort()) {
    body += `\n\n*${who}*`;
    for (const t of groups[who]) {
      const proj = projectName(state, t.projectId);
      body += `\n• ${t.task} — _${t.status}_ · due ${t.dueDate}${proj ? ` · ${proj}` : ''}`;
    }
  }
  return { text: 'Tasks due this week', blocks: section(header + body) };
}

// ── Overdue reminder: past-due, not done, grouped by assignee ──
export function buildOverdue(state, tz) {
  const today = todayInTz(tz);
  const overdue = state.tasks.filter(
    (t) => t.dueDate && !DONE_STATUSES.has(t.status) && t.dueDate < today
  );
  const header = ':rotating_light: *Overdue tasks*';
  if (!overdue.length) {
    return { text: 'Overdue tasks', blocks: section(header + '\n\n_No overdue tasks. Nice work! :muscle:_') };
  }
  overdue.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const groups = groupByAssignee(overdue);
  let body = '';
  for (const who of Object.keys(groups).sort()) {
    body += `\n\n*${who}*`;
    for (const t of groups[who]) {
      const proj = projectName(state, t.projectId);
      body += `\n• ${t.task} — was due ${t.dueDate} · _${t.status}_${proj ? ` · ${proj}` : ''}`;
    }
  }
  return { text: 'Overdue tasks', blocks: section(header + body) };
}

// ── Monthly summary: completed projects this month, deliverables, total value ──
export function buildMonthly(state, monthLabel) {
  const projects = state.projects.filter((p) => p.month === monthLabel && p.status === 'Completed');
  const total = projects.reduce((s, p) => s + Number(p.value || 0), 0);
  const fmtAUD = (n) => 'AUD $' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const header = `:moneybag: *${monthLabel} — Monthly Summary*`;
  if (!projects.length) {
    return { text: `${monthLabel} summary`, blocks: section(header + '\n\n_No completed projects recorded this month._') };
  }

  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: header } }];
  for (const p of projects) {
    let txt = `*${p.name}* — ${fmtAUD(p.value)}`;
    const dels = (p.deliverables || []).slice(0, 8);
    for (const d of dels) txt += `\n› ${d.text}`;
    if ((p.deliverables || []).length > 8) txt += `\n› _…and ${p.deliverables.length - 8} more_`;
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: txt } });
  }
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `*${projects.length} project${projects.length !== 1 ? 's' : ''} · Total ${fmtAUD(total)}*` },
  });
  return { text: `${monthLabel} summary — ${fmtAUD(total)}`, blocks };
}

function section(mrkdwn) {
  return [{ type: 'section', text: { type: 'mrkdwn', text: mrkdwn } }];
}
