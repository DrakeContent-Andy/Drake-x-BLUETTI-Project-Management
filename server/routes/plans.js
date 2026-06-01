import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { mapPlan } from './state.js';

export const router = Router();

const canEdit = [requireAuth, requireRole('admin', 'team')];

// Normalise an options array of { label, description, recommended }.
function cleanOptions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((o) => ({
    label: String(o.label || '').trim() || 'Plan',
    description: String(o.description || '').trim(),
    recommended: !!o.recommended,
  }));
}

async function fetchPlan(id) {
  const { rows } = await pool.query(
    `SELECT id, month, project_name, note, options FROM plans WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapPlan(rows[0]) : null;
}

router.post('/plans', canEdit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO plans (month, project_name, note, options) VALUES ($1,$2,$3,$4) RETURNING id`,
      [b.month || '', String(b.projectName || '').trim(), b.note || '', JSON.stringify(cleanOptions(b.options))]
    );
    res.status(201).json(await fetchPlan(rows[0].id));
  } catch (err) {
    next(err);
  }
});

router.patch('/plans/:id', canEdit, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const fields = [];
    const vals = [];
    let i = 1;
    const set = (col, val) => { fields.push(`${col} = $${i++}`); vals.push(val); };
    if (b.month !== undefined) set('month', b.month);
    if (b.projectName !== undefined) set('project_name', String(b.projectName).trim());
    if (b.note !== undefined) set('note', b.note);
    if (b.options !== undefined) set('options', JSON.stringify(cleanOptions(b.options)));
    if (!fields.length) return res.json(await fetchPlan(id));
    vals.push(id);
    await pool.query(`UPDATE plans SET ${fields.join(', ')} WHERE id = $${i}`, vals);
    const updated = await fetchPlan(id);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/plans/:id', canEdit, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM plans WHERE id = $1`, [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
