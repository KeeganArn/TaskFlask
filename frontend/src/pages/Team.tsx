import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Settings, 
  Mail, 
  Shield, 
  MoreVertical, 
  Edit, 
  Trash2,
  Crown,
  Clock,
  X,
  Check,
  AlertCircle,
  Copy
} from 'lucide-react';
import { useAuth, usePermission } from '../contexts/AuthContext';
import { organizationsApi, authApi } from '../services/api';
import { OrganizationMember, Role, Invitation, InviteUserRequest } from '../types';
import { getDisplayName, getInitials, formatRelativeTime, getStatusColor } from '../services/api';

const Team: React.FC = () => {
  const { organization, hasPermission } = useAuth();
  const canInviteUsers = usePermission('users.invite') || true; // Allow all users for now
  const canManageUsers = usePermission('users.edit') || true;  // Allow all users for now
  const canViewRoles = usePermission('roles.view') || true;    // Allow all users for now
  const canManageRoles = usePermission('roles.create') || false;

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'invitations'>('members');
  
  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteUserRequest>({ email: '', role_id: 0 });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch data with fallbacks
      const membersPromise = organizationsApi.getMembers({ status: filterStatus }).catch(() => []);
      const rolesPromise = canViewRoles ? organizationsApi.getRoles().catch(() => []) : Promise.resolve([]);
      const invitationsPromise = canInviteUsers ? organizationsApi.getInvitations().catch(() => []) : Promise.resolve([]);
      
      const [membersData, rolesData, invitationsData] = await Promise.all([
        membersPromise,
        rolesPromise,
        invitationsPromise
      ]);
      
      setMembers(membersData || []);
      setRoles(rolesData || []);
      setInvitations(invitationsData || []);
    } catch (error) {
      console.error('Error fetching team data:', error);
      // Set empty arrays as fallback
      setMembers([]);
      setRoles([]);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.role_id) return;

    try {
      setInviteLoading(true);
      setInviteError(null);
      const response = await authApi.invite(inviteForm);
      
      setShowInviteModal(false);
      setInviteForm({ email: '', role_id: 0 });
      fetchData(); // Refresh invitations
      
      // Show success message with invitation link (in production, this would be sent via email)
      alert(`Invitation sent! Token: ${response.invitation_token}`);
    } catch (error: any) {
      setInviteError(error.response?.data?.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleUpdateMemberRole = async (userId: number, roleId: number) => {
    try {
      await organizationsApi.updateMemberRole(userId, roleId);
      fetchData();
    } catch (error) {
      console.error('Error updating member role:', error);
    }
  };

  const handleUpdateMemberStatus = async (userId: number, status: string) => {
    try {
      await organizationsApi.updateMemberStatus(userId, status);
      fetchData();
    } catch (error) {
      console.error('Error updating member status:', error);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    
    try {
      await organizationsApi.removeMember(userId);
      fetchData();
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const handleCancelInvitation = async (invitationId: number) => {
    try {
      await organizationsApi.cancelInvitation(invitationId);
      fetchData();
    } catch (error) {
      console.error('Error canceling invitation:', error);
    }
  };

  const filteredMembers = members.filter(member => {
    const user = member.user;
    if (!user) return false;
    
    const matchesSearch = searchTerm === '' || 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.first_name && user.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.last_name && user.last_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesSearch;
  });

  if (loading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600">Manage organization members, roles, and permissions</p>
        </div>
        {canInviteUsers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Members ({members.length})
          </button>
          
          {canViewRoles && (
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'roles'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Shield className="h-4 w-4 inline mr-2" />
              Roles ({roles.length})
            </button>
          )}
          
          {canInviteUsers && (
            <button
              onClick={() => setActiveTab('invitations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'invitations'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-2" />
              Invitations ({invitations.length})
            </button>
          )}
        </nav>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="">All</option>
            </select>
          </div>

          {/* Members List */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {filteredMembers.map((member) => (
                <li key={member.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                        {member.user?.avatar_url ? (
                          <img className="h-10 w-10 rounded-full" src={member.user.avatar_url} alt="" />
                        ) : (
                          getInitials(getDisplayName(member.user!))
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {getDisplayName(member.user!)}
                        </h3>
                        <p className="text-sm text-gray-500">{member.user?.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(member.status)}`}>
                            {member.status}
                          </span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">{member.role?.display_name}</span>
                          {member.user?.last_login && (
                            <>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-gray-500">
                                Last active {formatRelativeTime(member.user.last_login)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {canManageUsers && (
                      <div className="flex items-center space-x-2">
                        <select
                          value={member.role_id}
                          onChange={(e) => handleUpdateMemberRole(member.user_id, parseInt(e.target.value))}
                          className="text-sm border-gray-300 rounded-md"
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && canViewRoles && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Organization Roles</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <div key={role.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-gray-900">{role.display_name}</h4>
                      {role.is_system_role && (
                        <Crown className="h-4 w-4 text-yellow-500" title="System Role" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {role.member_count} members • {role.permissions.length} permissions
                    </p>
                  </div>
                </div>
                
                <div className="mt-3">
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 3).map((permission) => (
                      <span key={permission} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {permission}
                      </span>
                    ))}
                    {role.permissions.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                        +{role.permissions.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && canInviteUsers && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Pending Invitations</h3>
          
          {invitations.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No pending invitations</h3>
              <p className="mt-1 text-sm text-gray-500">Invite team members to get started.</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{invitation.email}</h4>
                        <p className="text-sm text-gray-500">
                          Role: {invitation.role?.display_name} • 
                          Expires {formatRelativeTime(invitation.expires_at)}
                        </p>
                        {invitation.is_expired && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 mt-1">
                            <Clock className="h-3 w-3 mr-1" />
                            Expired
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(invitation.token)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Copy invitation token"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Cancel invitation"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Invite User</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="user@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  required
                  value={inviteForm.role_id}
                  onChange={(e) => setInviteForm({ ...inviteForm, role_id: parseInt(e.target.value) })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.display_name}
                    </option>
                  ))}
                </select>
              </div>
              
              {inviteError && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{inviteError}</span>
                </div>
              )}
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;
