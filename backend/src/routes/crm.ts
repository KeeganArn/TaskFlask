import { Router, Response } from 'express';
import pool from '../database/config';
import { authenticate, requireOrganizationAdmin, requirePlanIn, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

// All CRM features are Pro/Enterprise
const requireCrmPlan = requirePlanIn(['pro', 'enterprise']);

// Companies
router.get('/companies', authenticate, requireCrmPlan, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM companies WHERE organization_id = ? ORDER BY updated_at DESC', [req.user!.organization_id]);
    res.json(rows);
  } catch (error) {
    console.error('CRM list companies error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/companies', authenticate, requireCrmPlan, requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, domain, phone, website, address, tags, owner_user_id } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    const [r] = await pool.execute(
      `INSERT INTO companies (organization_id, name, domain, phone, website, address, tags, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.organization_id, name, domain || null, phone || null, website || null, address || null, tags ? JSON.stringify(tags) : '[]', owner_user_id || null]
    );
    const id = (r as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [id]);
    res.status(201).json((rows as any[])[0]);
  } catch (error) {
    console.error('CRM create company error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/companies/:id', authenticate, requireCrmPlan, requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, domain, phone, website, address, tags, owner_user_id } = req.body;
    await pool.execute(
      `UPDATE companies SET
        name = COALESCE(?, name),
        domain = COALESCE(?, domain),
        phone = COALESCE(?, phone),
        website = COALESCE(?, website),
        address = COALESCE(?, address),
        tags = COALESCE(?, tags),
        owner_user_id = COALESCE(?, owner_user_id),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [name || null, domain || null, phone || null, website || null, address || null, tags ? JSON.stringify(tags) : null, owner_user_id || null, id, req.user!.organization_id]
    );
    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ? AND organization_id = ?', [id, req.user!.organization_id]);
    if ((rows as any[]).length === 0) return res.status(404).json({ message: 'Company not found' });
    res.json((rows as any[])[0]);
  } catch (error) {
    console.error('CRM update company error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Contacts
router.get('/contacts', authenticate, requireCrmPlan, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM contacts WHERE organization_id = ? ORDER BY updated_at DESC', [req.user!.organization_id]);
    res.json(rows);
  } catch (error) {
    console.error('CRM list contacts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/contacts', authenticate, requireCrmPlan, requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { company_id, first_name, last_name, email, phone, title, tags, owner_user_id } = req.body;
    const [r] = await pool.execute(
      `INSERT INTO contacts (organization_id, company_id, first_name, last_name, email, phone, title, tags, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.organization_id, company_id || null, first_name || null, last_name || null, email || null, phone || null, title || null, tags ? JSON.stringify(tags) : '[]', owner_user_id || null]
    );
    const id = (r as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM contacts WHERE id = ?', [id]);
    res.status(201).json((rows as any[])[0]);
  } catch (error) {
    console.error('CRM create contact error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/contacts/:id', authenticate, requireCrmPlan, requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { company_id, first_name, last_name, email, phone, title, tags, owner_user_id } = req.body;
    await pool.execute(
      `UPDATE contacts SET
        company_id = COALESCE(?, company_id),
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        title = COALESCE(?, title),
        tags = COALESCE(?, tags),
        owner_user_id = COALESCE(?, owner_user_id),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [company_id || null, first_name || null, last_name || null, email || null, phone || null, title || null, tags ? JSON.stringify(tags) : null, owner_user_id || null, id, req.user!.organization_id]
    );
    const [rows] = await pool.execute('SELECT * FROM contacts WHERE id = ? AND organization_id = ?', [id, req.user!.organization_id]);
    if ((rows as any[]).length === 0) return res.status(404).json({ message: 'Contact not found' });
    res.json((rows as any[])[0]);
  } catch (error) {
    console.error('CRM update contact error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Deal stages
router.get('/stages', authenticate, requireCrmPlan, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM deal_stages WHERE organization_id = ? ORDER BY position ASC', [req.user!.organization_id]);
    res.json(rows);
  } catch (error) {
    console.error('CRM list stages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/stages/seed', authenticate, requireCrmPlan, requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.organization_id;
    const defaults = [
      { name: 'New', probability: 10 },
      { name: 'Qualified', probability: 25 },
      { name: 'Proposal', probability: 50 },
      { name: 'Negotiation', probability: 75 },
      { name: 'Won', probability: 100, is_won: true },
      { name: 'Lost', probability: 0, is_lost: true }
    ];
    let pos = 0;
    for (const s of defaults) {
      await pool.execute(
        `INSERT IGNORE INTO deal_stages (organization_id, name, probability, position, is_won, is_lost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orgId, s.name, s.probability || 0, pos++, !!s.is_won, !!s.is_lost]
      );
    }
    const [rows] = await pool.execute('SELECT * FROM deal_stages WHERE organization_id = ? ORDER BY position ASC', [orgId]);
    res.json(rows);
  } catch (error) {
    console.error('CRM seed stages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Deals
router.get('/deals', authenticate, requireCrmPlan, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.execute(
      `SELECT d.*, c.name as company_name, CONCAT(ct.first_name,' ',ct.last_name) as contact_name, ds.name as stage_name
       FROM deals d
       LEFT JOIN companies c ON d.company_id = c.id
       LEFT JOIN contacts ct ON d.contact_id = ct.id
       LEFT JOIN deal_stages ds ON d.stage_id = ds.id
       WHERE d.organization_id = ?
       ORDER BY d.updated_at DESC`,
      [req.user!.organization_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('CRM list deals error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/deals', authenticate, requireCrmPlan, requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { company_id, contact_id, name, stage_id, amount, currency, expected_close, owner_user_id, source, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    const [r] = await pool.execute(
      `INSERT INTO deals (organization_id, company_id, contact_id, name, stage_id, amount, currency, expected_close, owner_user_id, source, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.organization_id, company_id || null, contact_id || null, name, stage_id || null, amount || 0, currency || 'USD', expected_close || null, owner_user_id || null, source || null, notes || null]
    );
    const id = (r as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM deals WHERE id = ?', [id]);
    res.status(201).json((rows as any[])[0]);
  } catch (error) {
    console.error('CRM create deal error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/deals/:id', authenticate, requireCrmPlan, requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { company_id, contact_id, name, stage_id, amount, currency, expected_close, owner_user_id, source, notes } = req.body;
    await pool.execute(
      `UPDATE deals SET
        company_id = COALESCE(?, company_id),
        contact_id = COALESCE(?, contact_id),
        name = COALESCE(?, name),
        stage_id = COALESCE(?, stage_id),
        amount = COALESCE(?, amount),
        currency = COALESCE(?, currency),
        expected_close = COALESCE(?, expected_close),
        owner_user_id = COALESCE(?, owner_user_id),
        source = COALESCE(?, source),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [company_id || null, contact_id || null, name || null, stage_id || null, amount || null, currency || null, expected_close || null, owner_user_id || null, source || null, notes || null, id, req.user!.organization_id]
    );
    const [rows] = await pool.execute('SELECT * FROM deals WHERE id = ? AND organization_id = ?', [id, req.user!.organization_id]);
    if ((rows as any[]).length === 0) return res.status(404).json({ message: 'Deal not found' });
    res.json((rows as any[])[0]);
  } catch (error) {
    console.error('CRM update deal error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Activities
router.get('/activities', authenticate, requireCrmPlan, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.execute(
      `SELECT a.* FROM activities a WHERE a.organization_id = ? ORDER BY a.created_at DESC`,
      [req.user!.organization_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('CRM list activities error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/activities', authenticate, requireCrmPlan, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deal_id, company_id, contact_id, type, subject, content, due_at } = req.body;
    if (!type) return res.status(400).json({ message: 'type is required' });
    const [r] = await pool.execute(
      `INSERT INTO activities (organization_id, deal_id, company_id, contact_id, type, subject, content, due_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.organization_id, deal_id || null, company_id || null, contact_id || null, type, subject || null, content || null, due_at || null, req.user!.id]
    );
    const id = (r as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM activities WHERE id = ?', [id]);
    res.status(201).json((rows as any[])[0]);
  } catch (error) {
    console.error('CRM create activity error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


