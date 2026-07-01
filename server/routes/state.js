import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const router = Router();

export function mapProject(r, includeValue) {
  return {
    id: r.id,
    name: r.name,
    subject: r.subject || '',
    product: r.product || '',
    category: r.category,
    month: r.month || '',
    status: r.status,
    value: includeValue ? Number(r.value || 0) : null,
    driveLink: r.drive_link || '',
    deliverables: Array.isArray(r.deliverables) ? r.deliverables : [],
    note: r.note || '',
    showClient: r.show_client,
  };
}

export function mapTask(r) {
  return {
    id: r.id,
    task: r.task,
    projectId: r.project_id,
    assignee: r.assignee || '',
    startDate: r.start_date || '',
    dueDate: r.due_date || '',
    status: r.status,
    priority: r.priority,
    driveLink: r.drive_link || '',
    note: r.note || '',
    description: r.description || '',
    log: Array.isArray(r.log) ? r.log : [],
  };
}

export function mapPlan(r) {
  return {
    id: r.id,
    month: r.month || '',
    projectName: r.project_name || '',
    note: r.note || '',
    options: Array.isArray(r.options) ? r.options : [],
  };
}

export function mapReport(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    month: r.month || '',
    title: r.title || '',
    results: Array.isArray(r.results) ? r.results : [],
    showClient: r.show_client,
  };
}

// Builds the nested shape the frontend's DATA object uses, scoped by role.
export async function loadState(role) {
  // Both admin and client see dollar values; team stays price-blind.
  const includeValue = role === 'admin' || role === 'client';

  const projQ = await pool.query(
    `SELECT id, name, subject, product, category, month, status, value, drive_link,
            deliverables, note, show_client
       FROM projects
      ${role === 'client' ? 'WHERE show_client = TRUE' : ''}
      ORDER BY sort_order, id`
  );
  const projects = projQ.rows.map((r) => mapProject(r, includeValue));

  let tasks = [];
  let plans = [];
  let reports = [];
  let settings = { assignees: [] };
  let slack = undefined;

  // Reports & Results are visible to everyone, including the client.
  // The client only sees reports flagged show_client AND tied to a project
  // they can see (or with no project link).
  const repQ = await pool.query(
    `SELECT id, project_id, month, title, results, show_client
       FROM reports
      ${role === 'client' ? 'WHERE show_client = TRUE' : ''}
      ORDER BY sort_order, id`
  );
  reports = repQ.rows.map(mapReport);
  if (role === 'client') {
    const visibleIds = new Set(projects.map((p) => p.id));
    reports = reports.filter((r) => !r.projectId || visibleIds.has(r.projectId));
  }

  // Tasks (the progress board) are visible to everyone, including the client.
  const taskQ = await pool.query(
    `SELECT id, task, project_id, assignee,
            to_char(start_date,'YYYY-MM-DD') AS start_date,
            to_char(due_date,'YYYY-MM-DD') AS due_date,
            status, priority, drive_link, note, description, log
       FROM tasks ORDER BY id`
  );
  tasks = taskQ.rows.map(mapTask);
  if (role === 'client') {
    // Only tasks tied to a project the client can see, and strip the internal note.
    const visibleIds = new Set(projects.map((p) => p.id));
    tasks = tasks
      .filter((t) => t.projectId && visibleIds.has(t.projectId))
      .map((t) => ({ ...t, note: '' }));
  }

  if (role !== 'client') {
    const planQ = await pool.query(
      `SELECT id, month, project_name, note, options FROM plans ORDER BY sort_order, id`
    );
    plans = planQ.rows.map(mapPlan);

    const aQ = await pool.query(`SELECT value FROM settings WHERE key = 'assignees'`);
    settings = { assignees: aQ.rows[0] ? aQ.rows[0].value : [] };
  }

  if (role === 'admin') {
    const sQ = await pool.query(`SELECT value FROM settings WHERE key = 'slack'`);
    slack = sQ.rows[0] ? sQ.rows[0].value : null;
  }

  return { role, settings, projects, tasks, plans, reports, ...(slack !== undefined ? { slack } : {}) };
}

router.get('/state', requireAuth, async (req, res, next) => {
  try {
    res.json(await loadState(req.role));
  } catch (err) {
    next(err);
  }
});

// Full data export for backups (admin only). Includes dollar values.
router.get('/export', requireAuth, async (req, res, next) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const data = await loadState('admin');
    res.json({ exportedAt: new Date().toISOString(), ...data });
  } catch (err) {
    next(err);
  }
});
