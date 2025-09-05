import React, { useState, useEffect } from 'react';
import { Crown, Check, Users, HardDrive, Zap, Shield, CreditCard, TrendingUp } from 'lucide-react';
import { subscriptionsApi } from '../services/api';

interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  price_monthly: number | string;
  price_yearly: number | string;
  max_users: number | null;
  max_organizations: number | null;
  max_storage_gb: number;
  features: string[];
  is_active: boolean;
}

interface CurrentSubscription {
  id: number;
  plan_name: string;
  plan_slug: string;
  status: string;
  billing_cycle: string;
  trial_end?: string;
  current_period_end: string;
  features: string[];
  max_users: number | null;
  max_storage_gb: number;
}

interface UsageMetrics {
  users_count: number;
  storage_used_gb: number;
  api_calls_month: number;
}

const Billing: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansData, subscriptionData, usageData] = await Promise.all([
        subscriptionsApi.getPlans(),
        subscriptionsApi.getCurrentSubscription(),
        subscriptionsApi.getUsage()
      ]);
      
      setPlans(plansData);
      setCurrentSubscription(subscriptionData);
      setUsage(usageData);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planSlug: string) => {
    if (planSlug === currentSubscription?.plan_slug) return;
    
    setUpgrading(planSlug);
    try {
      const result = await subscriptionsApi.upgradePlan(planSlug, billingCycle);
      await fetchData(); // Refresh data
      
      // Show success message with plan details
      const message = result.subscription 
        ? `Successfully upgraded to ${result.subscription.plan_name}! Your new features are now active.`
        : 'Subscription updated successfully!';
      alert(message);
    } catch (error: any) {
      console.error('Error upgrading subscription:', error);
      
      // Show specific error message if available
      const errorMessage = error.response?.data?.message || 'Failed to update subscription. Please try again.';
      alert(errorMessage);
    } finally {
      setUpgrading(null);
    }
  };

  const formatPrice = (plan: SubscriptionPlan) => {
    const price = billingCycle === 'yearly' ? parseFloat(plan.price_yearly.toString()) : parseFloat(plan.price_monthly.toString());
    if (price === 0) return 'Free';
    
    const monthlyPrice = billingCycle === 'yearly' ? price / 12 : price;
    return `$${monthlyPrice.toFixed(0)}/mo`;
  };

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'time_tracking': return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'custom_branding': return <Crown className="h-4 w-4 text-purple-500" />;
      case 'analytics': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'sso': return <Shield className="h-4 w-4 text-red-500" />;
      case 'audit_logs': return <Shield className="h-4 w-4 text-gray-500" />;
      case 'api_access': return <Zap className="h-4 w-4 text-yellow-500" />;
      default: return <Check className="h-4 w-4 text-green-500" />;
    }
  };

  const getFeatureLabel = (feature: string) => {
    const labels: { [key: string]: string } = {
      'basic_messaging': 'Basic Messaging',
      'basic_tasks': 'Basic Tasks',
      'basic_projects': 'Basic Projects',
      'time_tracking': 'Time Tracking',
      'custom_branding': 'Custom Branding',
      'analytics': 'Analytics Dashboard',
      'priority_support': 'Priority Support',
      'advanced_permissions': 'Advanced Permissions',
      'sso': 'Single Sign-On (SSO)',
      'audit_logs': 'Audit Logs',
      'api_access': 'API Access',
      'custom_integrations': 'Custom Integrations',
      'dedicated_support': 'Dedicated Support',
      'white_labeling': 'White Labeling'
    };
    return labels[feature] || feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading billing information...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and billing information</p>
      </div>

      {/* Current Subscription & Usage */}
      {currentSubscription && usage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Plan */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-primary-600">{currentSubscription.plan_name}</h3>
                <p className="text-gray-500 capitalize">
                  {currentSubscription.status} • {currentSubscription.billing_cycle}
                </p>
                {currentSubscription.status === 'trialing' && currentSubscription.trial_end && (
                  <p className="text-orange-600 text-sm mt-1">
                    Trial ends: {new Date(currentSubscription.trial_end).toLocaleDateString()}
                  </p>
                )}
              </div>
              {currentSubscription.plan_slug !== 'free' && (
                <Crown className="h-8 w-8 text-yellow-500" />
              )}
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-gray-600">Team Members</span>
                </div>
                <span className="font-semibold">
                  {usage.users_count} / {currentSubscription.max_users || '∞'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <HardDrive className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-gray-600">Storage Used</span>
                </div>
                <span className="font-semibold">
                  {usage.storage_used_gb.toFixed(1)} GB / {currentSubscription.max_storage_gb} GB
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Zap className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-gray-600">API Calls (Month)</span>
                </div>
                <span className="font-semibold">{usage.api_calls_month.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing Toggle */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="ml-1 text-xs bg-green-100 text-green-800 px-1 rounded">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`border rounded-lg p-6 relative ${
                currentSubscription?.plan_slug === plan.slug
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {currentSubscription?.plan_slug === plan.slug && (
                <div className="absolute top-0 right-0 bg-primary-500 text-white px-3 py-1 rounded-bl-lg rounded-tr-lg text-xs font-medium">
                  Current Plan
                </div>
              )}
              
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">{formatPrice(plan)}</span>
                  {parseFloat(plan.price_monthly.toString()) > 0 && billingCycle === 'yearly' && (
                    <div className="text-sm text-gray-500">
                      <span className="line-through">${parseFloat(plan.price_monthly.toString())}/mo</span>
                      <span className="ml-2 text-green-600">billed yearly</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center text-sm">
                  <Users className="h-4 w-4 text-gray-400 mr-2" />
                  <span>{plan.max_users ? `Up to ${plan.max_users} users` : 'Unlimited users'}</span>
                </div>
                <div className="flex items-center text-sm">
                  <HardDrive className="h-4 w-4 text-gray-400 mr-2" />
                  <span>{plan.max_storage_gb} GB storage</span>
                </div>
                <div className="flex items-center text-sm">
                  <CreditCard className="h-4 w-4 text-gray-400 mr-2" />
                  <span>{plan.max_organizations ? `${plan.max_organizations} organizations` : 'Unlimited orgs'}</span>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Features:</h4>
                <ul className="space-y-2">
                  {(Array.isArray(plan.features) ? plan.features : []).map((feature) => (
                    <li key={feature} className="flex items-center text-sm">
                      {getFeatureIcon(feature)}
                      <span className="ml-2">{getFeatureLabel(feature)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                {currentSubscription?.plan_slug === plan.slug ? (
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-500 py-2 px-4 rounded-md cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.slug)}
                    disabled={upgrading === plan.slug}
                    className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                      plan.slug === 'free'
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {upgrading === plan.slug ? 'Updating...' : 
                     plan.slug === 'free' ? 'Downgrade' : 'Upgrade'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Billing;
