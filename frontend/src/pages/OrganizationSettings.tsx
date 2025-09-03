import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Settings, 
  Copy, 
  Check, 
  Eye, 
  EyeOff,
  Edit2,
  Save,
  X,
  AlertCircle,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useAuth, usePermission } from '../contexts/AuthContext';
import { organizationsApi } from '../services/api';
import { Organization } from '../types';

const OrganizationSettings: React.FC = () => {
  const { organization: currentOrg, user } = useAuth();
  const canEditOrg = usePermission('org.edit');
  const canViewMembers = usePermission('users.view');

  const [organization, setOrganization] = useState<Organization | null>(currentOrg);
  const [isEditing, setIsEditing] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    invite_code_enabled: true
  });

  useEffect(() => {
    if (currentOrg) {
      setOrganization(currentOrg);
      setEditForm({
        name: currentOrg.name,
        description: currentOrg.description || '',
        invite_code_enabled: currentOrg.invite_code_enabled
      });
    }
  }, [currentOrg]);

  const handleCopyInviteCode = async () => {
    if (organization?.invite_code) {
      try {
        await navigator.clipboard.writeText(organization.invite_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy invite code:', err);
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!organization || !canEditOrg) return;

    try {
      setLoading(true);
      setError(null);
      
      const updatedOrg = await organizationsApi.updateCurrent({
        name: editForm.name,
        description: editForm.description,
        invite_code_enabled: editForm.invite_code_enabled
      });
      
      setOrganization(updatedOrg);
      setIsEditing(false);
      setSuccess('Organization settings updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (organization) {
      setEditForm({
        name: organization.name,
        description: organization.description || '',
        invite_code_enabled: organization.invite_code_enabled
      });
    }
    setIsEditing(false);
    setError(null);
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
          <p className="text-gray-600">Manage your organization details and invite settings</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-md">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-4 rounded-md">
          <Check className="h-5 w-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Organization Details */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Organization Details</h2>
            {canEditOrg && (
              <div className="flex space-x-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveChanges}
                      disabled={loading}
                      className="btn btn-primary btn-sm"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={loading}
                      className="btn btn-secondary btn-sm"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input w-full"
                  placeholder="Enter organization name"
                />
              ) : (
                <p className="text-gray-900">{organization.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization ID
              </label>
              <p className="text-gray-900 font-mono">{organization.slug}</p>
              <p className="text-xs text-gray-500 mt-1">Cannot be changed</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              {isEditing ? (
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="input w-full h-24 resize-none"
                  placeholder="Describe your organization..."
                />
              ) : (
                <p className="text-gray-900">
                  {organization.description || 'No description provided'}
                </p>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Subscription & Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">Plan</div>
                <div className="text-lg font-semibold text-gray-900 capitalize">
                  {organization.subscription_plan}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">Max Users</div>
                <div className="text-lg font-semibold text-gray-900">
                  {organization.stats?.member_count || 0} / {organization.max_users}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">Max Projects</div>
                <div className="text-lg font-semibold text-gray-900">
                  {organization.stats?.project_count || 0} / {organization.max_projects}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Code Settings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Team Invitation</h2>
          <p className="text-sm text-gray-500">Share your organization's invite code for easy team onboarding</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">Organization Invite Code</h3>
              <p className="text-xs text-blue-700 mt-1">
                Share this code with new team members to join your organization
              </p>
              
              <div className="mt-3 flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <code className={`px-3 py-2 bg-white border rounded font-mono text-lg tracking-wider ${
                    showInviteCode ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {showInviteCode ? organization.invite_code : '•••-••••'}
                  </code>
                  <button
                    onClick={() => setShowInviteCode(!showInviteCode)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title={showInviteCode ? 'Hide code' : 'Show code'}
                  >
                    {showInviteCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {showInviteCode && (
                  <button
                    onClick={handleCopyInviteCode}
                    className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span className="text-sm">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span className="text-sm">Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {canEditOrg && (
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Enable Invite Code</h4>
                <p className="text-xs text-gray-500">Allow new users to join using the invite code</p>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEditing ? editForm.invite_code_enabled : organization.invite_code_enabled}
                  onChange={(e) => {
                    if (isEditing) {
                      setEditForm({ ...editForm, invite_code_enabled: e.target.checked });
                    }
                  }}
                  disabled={!isEditing}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Security Note</h4>
                <p className="text-xs text-yellow-700 mt-1">
                  Anyone with this invite code can join your organization as a team member. 
                  Keep it secure and only share with trusted individuals.
                </p>
                <p className="text-xs text-yellow-700 mt-2">
                  <strong>Registration URL:</strong> {window.location.origin}/register
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSettings;
