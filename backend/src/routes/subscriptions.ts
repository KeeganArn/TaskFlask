import { Router, Response } from 'express';
import pool from '../database/config';
import { authenticate, requireOrganizationAdmin, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

// Base features for Pro plan that Enterprise should inherit
const PRO_FEATURES = [
  'time_tracking',
  'custom_branding',
  'analytics',
  'priority_support',
  'advanced_permissions'
];

// Ensure higher tiers inherit lower tier features (e.g., Enterprise ⊇ Pro)
const augmentFeatures = (planSlug: string, rawFeatures: any): string[] => {
  let features: string[] = [];
  try {
    if (Array.isArray(rawFeatures)) {
      features = rawFeatures as string[];
    } else if (typeof rawFeatures === 'string') {
      features = JSON.parse(rawFeatures || '[]');
    } else {
      features = [];
    }
  } catch {
    features = [];
  }

  if (planSlug === 'enterprise') {
    const merged = new Set<string>([...features, ...PRO_FEATURES]);
    return Array.from(merged);
  }

  return features;
};

/**
 * GET /subscriptions/plans - Get all available subscription plans
 */
router.get('/plans', async (req, res: Response) => {
  try {
    // Ensure plans exist; seed defaults if table is empty
    const [countRows] = await pool.execute(`SELECT COUNT(*) as cnt FROM subscription_plans`);
    const total = (countRows as any[])[0]?.cnt ?? 0;
    if (total === 0) {
      await pool.execute(`
        INSERT INTO subscription_plans 
          (name, slug, price_monthly, price_yearly, max_users, max_organizations, max_storage_gb, features, is_active)
        VALUES
          ('Free', 'free', 0.00, 0.00, 5, 1, 1, '["basic_messaging","basic_tasks","basic_projects"]', TRUE),
          ('Pro', 'pro', 15.00, 150.00, 50, 3, 10, '["time_tracking","custom_branding","analytics","priority_support","advanced_permissions"]', TRUE),
          ('Enterprise', 'enterprise', 50.00, 500.00, NULL, NULL, 100, '["sso","audit_logs","api_access","custom_integrations","dedicated_support","white_labeling"]', TRUE)
      `);
    }

    const [plans] = await pool.execute(`
      SELECT id, name, slug, price_monthly, price_yearly, max_users, max_organizations, 
             max_storage_gb, features, is_active
      FROM subscription_plans 
      WHERE is_active = TRUE
      ORDER BY price_monthly ASC
    `);

    // Parse JSON fields safely
    const parsedPlans = (plans as any[]).map(plan => ({
      ...plan,
      name: plan.slug === 'free' ? 'Basic' : plan.name,
      max_organizations: 1,
      features: augmentFeatures(plan.slug, plan.features)
    }));

    res.json(parsedPlans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /subscriptions/current - Get current organization subscription
 */
router.get('/current', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;

    const [subscription] = await pool.execute(`
      SELECT 
        os.*,
        sp.name as plan_name,
        sp.slug as plan_slug,
        sp.price_monthly,
        sp.price_yearly,
        sp.max_users,
        sp.max_organizations,
        sp.max_storage_gb,
        sp.features
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON os.plan_id = sp.id
      WHERE os.organization_id = ?
      ORDER BY os.created_at DESC
      LIMIT 1
    `, [organizationId]);

    if ((subscription as any[]).length === 0) {
      // No subscription found: default to active Basic (free) with no trial
      const [freePlan] = await pool.execute(
        'SELECT * FROM subscription_plans WHERE slug = "free" LIMIT 1'
      );

      if ((freePlan as any[]).length > 0) {
        const plan = (freePlan as any[])[0];

        await pool.execute(`
          INSERT INTO organization_subscriptions 
          (organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_end)
          VALUES (?, ?, 'active', 'monthly', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 MONTH), NULL)
        `, [organizationId, plan.id]);

        res.json({
          id: null,
          organization_id: organizationId,
          plan_id: plan.id,
          status: 'active',
          billing_cycle: 'monthly',
          plan_name: plan.slug === 'free' ? 'Basic' : plan.name,
          plan_slug: plan.slug,
          price_monthly: plan.price_monthly,
          price_yearly: plan.price_yearly,
          max_users: plan.max_users,
          max_organizations: 1,
          max_storage_gb: plan.max_storage_gb,
          features: augmentFeatures(plan.slug, plan.features)
        });
      } else {
        res.status(404).json({ message: 'No subscription found' });
      }
    } else {
      const sub = (subscription as any[])[0];
      res.json({
        ...sub,
        plan_name: sub.plan_slug === 'free' ? 'Basic' : sub.plan_name,
        max_organizations: 1,
        features: augmentFeatures(sub.plan_slug, sub.features)
      });
    }
  } catch (error) {
    console.error('Error fetching current subscription:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /subscriptions/usage - Get current usage metrics
 */
router.get('/usage', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;

    // Get current user count
    const [userCount] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM organization_members 
      WHERE organization_id = ?
    `, [organizationId]);

    // Get storage usage (placeholder - would integrate with actual file storage)
    const [storageUsage] = await pool.execute(`
      SELECT COALESCE(SUM(metric_value), 0) as storage_used
      FROM usage_tracking 
      WHERE organization_id = ? AND metric_name = 'storage_used'
      AND recorded_at = CURDATE()
    `, [organizationId]);

    // Get API calls this month (placeholder)
    const [apiCalls] = await pool.execute(`
      SELECT COALESCE(SUM(metric_value), 0) as api_calls
      FROM usage_tracking 
      WHERE organization_id = ? AND metric_name = 'api_calls'
      AND recorded_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
    `, [organizationId]);

    res.json({
      users_count: (userCount as any[])[0].count,
      storage_used_gb: Math.round((storageUsage as any[])[0].storage_used / 1024 / 1024 / 1024 * 100) / 100,
      api_calls_month: (apiCalls as any[])[0].api_calls
    });
  } catch (error) {
    console.error('Error fetching usage metrics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /subscriptions/upgrade - Upgrade/change subscription plan
 */
router.post('/upgrade', authenticate, requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { plan_slug, billing_cycle = 'monthly' } = req.body;
    const organizationId = req.user!.organization_id;

    // Validate input
    if (!plan_slug) {
      return res.status(400).json({ message: 'Plan slug is required' });
    }

    if (!['monthly', 'yearly'].includes(billing_cycle)) {
      return res.status(400).json({ message: 'Invalid billing cycle' });
    }

    // Get the target plan
    const [targetPlan] = await pool.execute(
      'SELECT * FROM subscription_plans WHERE slug = ? AND is_active = TRUE',
      [plan_slug]
    );

    if ((targetPlan as any[]).length === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    const plan = (targetPlan as any[])[0];

    // Get current subscription to compare
    const [currentSub] = await pool.execute(`
      SELECT os.*, sp.name as current_plan_name, sp.slug as current_plan_slug 
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON os.plan_id = sp.id
      WHERE os.organization_id = ?
      ORDER BY os.created_at DESC
      LIMIT 1
    `, [organizationId]);

    // Calculate new period dates
    const periodStart = new Date();
    const periodEnd = new Date();
    if (billing_cycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    let subscriptionId;

    if ((currentSub as any[]).length > 0) {
      const current = (currentSub as any[])[0];
      
      // Check if it's actually a change
      if (current.current_plan_slug === plan_slug && current.billing_cycle === billing_cycle) {
        return res.status(400).json({ message: 'Already subscribed to this plan' });
      }

      // Update existing subscription
      await pool.execute(`
        UPDATE organization_subscriptions 
        SET plan_id = ?, status = 'active', billing_cycle = ?, 
            current_period_start = ?, current_period_end = ?, trial_end = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = ?
      `, [plan.id, billing_cycle, periodStart, periodEnd, organizationId]);
      
      subscriptionId = current.id;
      
      console.log(`Subscription updated: Organization ${organizationId} changed from ${current.current_plan_name} to ${plan.name}`);
    } else {
      // Create new subscription
      const [result] = await pool.execute(`
        INSERT INTO organization_subscriptions 
        (organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
        VALUES (?, ?, 'active', ?, ?, ?)
      `, [organizationId, plan.id, billing_cycle, periodStart, periodEnd]);
      
      subscriptionId = (result as any).insertId;
      
      console.log(`New subscription created: Organization ${organizationId} subscribed to ${plan.name}`);
    }

    // Sync organization row with selected plan (for settings page display)
    await pool.execute(
      `UPDATE organizations SET subscription_plan = ? WHERE id = ?`,
      [plan.slug, organizationId]
    );

    // Log the plan change for audit purposes
    await pool.execute(`
      INSERT INTO usage_tracking (organization_id, metric_name, metric_value, metadata)
      VALUES (?, 'plan_change', 1, ?)
    `, [organizationId, JSON.stringify({
      new_plan: plan.slug,
      billing_cycle,
      changed_at: new Date().toISOString()
    })]);

    // Compute final feature set with inheritance
    const features = augmentFeatures(plan.slug, plan.features);

    res.json({ 
      message: 'Subscription updated successfully',
      subscription: {
        id: subscriptionId,
        plan_id: plan.id,
        plan_name: plan.name,
        plan_slug: plan.slug,
        billing_cycle,
        status: 'active',
        current_period_start: periodStart,
        current_period_end: periodEnd,
        max_users: plan.max_users,
        max_organizations: 1,
        max_storage_gb: plan.max_storage_gb,
        features
      }
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /subscriptions/features - Check feature access for current organization
 */
router.get('/features/:feature?', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { feature } = req.params;

    const [subscription] = await pool.execute(`
      SELECT sp.features, sp.name as plan_name, sp.slug as plan_slug
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON os.plan_id = sp.id
      WHERE os.organization_id = ? AND os.status IN ('active', 'trialing')
      ORDER BY os.created_at DESC
      LIMIT 1
    `, [organizationId]);

    if ((subscription as any[]).length === 0) {
      return res.json({ 
        hasAccess: false, 
        features: [],
        plan_name: 'No Plan',
        message: 'No active subscription found' 
      });
    }

    const sub = (subscription as any[])[0];
    const features = augmentFeatures(sub.plan_slug, sub.features);

    if (feature) {
      // Check specific feature
      const hasAccess = features.includes(feature);
      res.json({ 
        hasAccess, 
        feature,
        plan_name: sub.plan_slug === 'free' ? 'Basic' : sub.plan_name,
        plan_slug: sub.plan_slug
      });
    } else {
      // Return all features
      res.json({ 
        features, 
        plan_name: sub.plan_slug === 'free' ? 'Basic' : sub.plan_name,
        plan_slug: sub.plan_slug
      });
    }
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Helper function to check if organization has feature access
 */
export const hasFeature = async (organizationId: number, feature: string): Promise<boolean> => {
  try {
    const [subscription] = await pool.execute(`
      SELECT sp.features, sp.slug as plan_slug
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON os.plan_id = sp.id
      WHERE os.organization_id = ? AND os.status IN ('active', 'trialing')
      ORDER BY os.created_at DESC
      LIMIT 1
    `, [organizationId]);

    if ((subscription as any[]).length === 0) {
      return false; // No active subscription
    }

    const row = (subscription as any[])[0];
    const features = augmentFeatures(row.plan_slug, row.features);
    return features.includes(feature);
  } catch (error) {
    console.error('Error checking feature access:', error);
    return false;
  }
};

export default router;
