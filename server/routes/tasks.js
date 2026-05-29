import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { mapTask } from './state.js';

export const router = Router();

const canEdit = [requireAuth, requireRole('admin', 'team')];

async function fetchTask(id) {
  const { rows } = await pool.query(
    `SELECT id, category, task, project_id, assignee,
            to_char(due_date,'YYYY-MM-DD') AS due_date, status, priority, drive_link, note
       FROM tasks WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapTask(rows[0]) : null;
}

router.post('/tasks', canEdit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO tasks (category, task, project_id, assignee, due_date, status, priority, drive_link, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        b.category || 'General', String(b.task || '').trim(),
        b.projectId || null, b.assignee || '', b.dueDate || null,
        b.status || 'To Do', b.priority || 'Medium', b.driveLink || '', b.note || '',
      ]
    );
    res.status(201).json(await fetchTask(rows[0].id));
  } catch (err) {
    next(err);
  }
});

router.patch('/tasks/:id', canEdit, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const fields = [];
    const vals = [];
    let i = 1;
    const set = (col, val) => { fields.push(`${col} = $${i++}`); vals.push(val); };

    if (b.category !== undefined) set('category', b.category);
    if (b.task !== undefined) set('task', String(b.task).trim());
    if (b.projectId !== undefined) set('project_id', b.projectId || null);
    if (b.assignee !== undefined) set('assignee', b.assignee);
    if (b.dueDate !== undefined) set('due_date', b.dueDate || null);
    if (b.status !== undefined) set('status', b.status);
    if (b.priority !== undefined) set('priority', b.priority);
    if (b.driveLink !== undefined) set('drive_link', b.driveLink);
    if (b.note !== undefined) set('note', b.note);

    if (!fields.length) return res.json(await fetchTask(id));

    vals.push(id);
    await pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i}`, vals);
    const updated = await fetchTask(id);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/tasks/:id', canEdit, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM tasks WHERE id = $1`, [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
