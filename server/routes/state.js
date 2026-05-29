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
    category: r.category,
    task: r.task,
    projectId: r.project_id,
    assignee: r.assignee || '',
    dueDate: r.due_date || '',
    status: r.status,
    priority: r.priority,
    driveLink: r.drive_link || '',
    note: r.note || '',
  };
}

// Builds the same nested shape the frontend's DATA object used, scoped by role.
export async function loadState(role) {
  const includeValue = role === 'admin';

  const projQ = await pool.query(
    `SELECT id, name, subject, product, category, month, status, value, drive_link,
            deliverables, note, show_client
       FROM projects
      ${role === 'client' ? 'WHERE show_client = TRUE' : ''}
      ORDER BY sort_order, id`
  );
  const projects = projQ.rows.map((r) => mapProject(r, includeValue));

  let tasks = [];
  let monthlyGoals = [];
  let settings = { assignees: [] };
  let slack = undefined;

  if (role !== 'client') {
    const taskQ = await pool.query(
      `SELECT id, category, task, project_id, assignee,
              to_char(due_date,'YYYY-MM-DD') AS due_date, status, priority, drive_link, note
         FROM tasks ORDER BY id`
    );
    tasks = taskQ.rows.map(mapTask);

    const goalQ = await pool.query(
      `SELECT id, month, category, description, target FROM goals ORDER BY month, id`
    );
    const byMonth = {};
    for (const g of goalQ.rows) {
      (byMonth[g.month] ||= []).push({ id: g.id, category: g.category, description: g.description, target: g.target });
    }
    monthlyGoals = Object.entries(byMonth).map(([month, goals]) => ({ month, goals }));

    const aQ = await pool.query(`SELECT value FROM settings WHERE key = 'assignees'`);
    settings = { assignees: aQ.rows[0] ? aQ.rows[0].value : [] };
  }

  if (role === 'admin') {
    const sQ = await pool.query(`SELECT value FROM settings WHERE key = 'slack'`);
    slack = sQ.rows[0] ? sQ.rows[0].value : null;
  }

  return { role, settings, projects, tasks, monthlyGoals, ...(slack !== undefined ? { slack } : {}) };
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
