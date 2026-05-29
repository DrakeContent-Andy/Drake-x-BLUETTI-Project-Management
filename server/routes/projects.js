import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { mapProject } from './state.js';

export const router = Router();

// All project writes are admin or team (not client).
const canEdit = [requireAuth, requireRole('admin', 'team')];

async function fetchProject(id, role) {
  const { rows } = await pool.query(
    `SELECT id, name, subject, product, category, month, status, value, drive_link,
            deliverables, note, show_client FROM projects WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapProject(rows[0], role === 'admin') : null;
}

router.post('/projects', canEdit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const deliverables = Array.isArray(b.deliverables) ? b.deliverables : [];
    // Only admins may set a dollar value.
    const value = req.role === 'admin' ? (Number(b.value) || 0) : 0;
    const { rows } = await pool.query(
      `INSERT INTO projects (name, subject, product, category, month, status, value, drive_link, deliverables, note, show_client)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        String(b.name || '').trim(), b.subject || '', b.product || '', b.category || 'Other',
        b.month || '', b.status || 'Planning', value, b.driveLink || '',
        JSON.stringify(deliverables), b.note || '', b.showClient !== false,
      ]
    );
    res.status(201).json(await fetchProject(rows[0].id, req.role));
  } catch (err) {
    next(err);
  }
});

router.patch('/projects/:id', canEdit, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const fields = [];
    const vals = [];
    let i = 1;
    const set = (col, val) => { fields.push(`${col} = $${i++}`); vals.push(val); };

    if (b.name !== undefined) set('name', String(b.name).trim());
    if (b.subject !== undefined) set('subject', b.subject);
    if (b.product !== undefined) set('product', b.product);
    if (b.category !== undefined) set('category', b.category);
    if (b.month !== undefined) set('month', b.month);
    if (b.status !== undefined) set('status', b.status);
    if (b.driveLink !== undefined) set('drive_link', b.driveLink);
    if (b.deliverables !== undefined) set('deliverables', JSON.stringify(Array.isArray(b.deliverables) ? b.deliverables : []));
    if (b.note !== undefined) set('note', b.note);
    if (b.showClient !== undefined) set('show_client', !!b.showClient);
    // Value changes are admin-only; silently ignored for team.
    if (b.value !== undefined && req.role === 'admin') set('value', Number(b.value) || 0);

    if (!fields.length) return res.json(await fetchProject(id, req.role));

    vals.push(id);
    await pool.query(`UPDATE projects SET ${fields.join(', ')} WHERE id = $${i}`, vals);
    const updated = await fetchProject(id, req.role);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/projects/:id', canEdit, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    // Unlink tasks pointing at this project so we don't orphan references.
    await pool.query(`UPDATE tasks SET project_id = NULL WHERE project_id = $1`, [id]);
    await pool.query(`DELETE FROM projects WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
