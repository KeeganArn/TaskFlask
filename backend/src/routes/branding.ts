import { Router, Response } from 'express';
import pool from '../database/config';
import { authenticate, requireOrganizationAdmin, requireFeature, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

// Get current branding for organization
router.get('/', authenticate, requireFeature('custom_branding'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const [rows] = await pool.execute(
      'SELECT * FROM organization_branding WHERE organization_id = ? LIMIT 1',
      [organizationId]
    );
    if ((rows as any[]).length === 0) {
      return res.json({
        organization_id: organizationId,
        logo_url: null,
        primary_color: '#3B82F6',
        secondary_color: '#1E40AF',
        accent_color: '#F59E0B',
        custom_css: null,
        white_label_enabled: false
      });
    }
    res.json((rows as any[])[0]);
  } catch (error) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update branding for organization
router.put('/', authenticate, requireFeature('custom_branding'), requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { logo_url, primary_color, secondary_color, accent_color, custom_css, white_label_enabled } = req.body;

    // Upsert branding row
    const [existing] = await pool.execute(
      'SELECT id FROM organization_branding WHERE organization_id = ? LIMIT 1',
      [organizationId]
    );

    if ((existing as any[]).length === 0) {
      await pool.execute(
        `INSERT INTO organization_branding 
         (organization_id, logo_url, primary_color, secondary_color, accent_color, custom_css, white_label_enabled)
         VALUES (?, ?, COALESCE(?, '#3B82F6'), COALESCE(?, '#1E40AF'), COALESCE(?, '#F59E0B'), ?, COALESCE(?, FALSE))`,
        [organizationId, logo_url || null, primary_color, secondary_color, accent_color, custom_css || null, white_label_enabled]
      );
    } else {
      await pool.execute(
        `UPDATE organization_branding SET 
           logo_url = COALESCE(?, logo_url),
           primary_color = COALESCE(?, primary_color),
           secondary_color = COALESCE(?, secondary_color),
           accent_color = COALESCE(?, accent_color),
           custom_css = COALESCE(?, custom_css),
           white_label_enabled = COALESCE(?, white_label_enabled),
           updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = ?`,
        [logo_url, primary_color, secondary_color, accent_color, custom_css, white_label_enabled, organizationId]
      );
    }

    const [rows] = await pool.execute(
      'SELECT * FROM organization_branding WHERE organization_id = ? LIMIT 1',
      [organizationId]
    );
    res.json((rows as any[])[0]);
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

// Public client portal branding by organization slug
router.get('/public/:slug', async (req: any, res: Response) => {
  try {
    const { slug } = req.params;
    const [org] = await pool.execute('SELECT id, name FROM organizations WHERE slug = ? LIMIT 1', [slug]);
    if ((org as any[]).length === 0) return res.status(404).json({ message: 'Organization not found' });
    const orgId = (org as any[])[0].id;
    const [rows] = await pool.execute('SELECT logo_url, primary_color, secondary_color, accent_color, white_label_enabled FROM organization_branding WHERE organization_id = ? LIMIT 1', [orgId]);
    const branding = (rows as any[])[0] || {
      logo_url: null,
      primary_color: '#3B82F6',
      secondary_color: '#1E40AF',
      accent_color: '#F59E0B',
      white_label_enabled: false
    };
    res.json({ organization: { id: orgId, name: (org as any[])[0].name, slug }, branding });
  } catch (error) {
    console.error('Public branding error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


