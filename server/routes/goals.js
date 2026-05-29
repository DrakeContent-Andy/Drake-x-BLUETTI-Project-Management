import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

export const router = Router();

const canEdit = [requireAuth, requireRole('admin', 'team')];

router.post('/goals', canEdit, async (req, res, next) => {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO goals (month, category, description, target) VALUES ($1,$2,$3,$4)
       RETURNING id, month, category, description, target`,
      [b.month || '', b.category || 'General', String(b.description || '').trim(), b.target || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/goals/:id', canEdit, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const fields = [];
    const vals = [];
    let i = 1;
    const set = (col, val) => { fields.push(`${col} = $${i++}`); vals.push(val); };
    if (b.category !== undefined) set('category', b.category);
    if (b.description !== undefined) set('description', String(b.description).trim());
    if (b.target !== undefined) set('target', b.target);
    if (!fields.length) return res.json({ ok: true });
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE goals SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, month, category, description, target`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/goals/:id', canEdit, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM goals WHERE id = $1`, [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
