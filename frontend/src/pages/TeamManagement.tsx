import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Settings, 
  Shield, 
  Edit, 
  Trash2,
  Crown,
  Plus,
  X,
  Check,
  AlertCircle,
  Circle,
  Minus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { organizationsApi, authApi, messagesApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { OrganizationMember, Role, CreateRoleRequest } from '../types';



const availablePermissions = [
  { id: 'projects.*', label: 'All Project Permissions', category: 'Projects' },
  { id: 'projects.view', label: 'View Projects', category: 'Projects' },
  { id: 'projects.create', label: 'Create Projects', category: 'Projects' },
  { id: 'projects.edit', label: 'Edit Projects', category: 'Projects' },
  { id: 'projects.delete', label: 'Delete Projects', category: 'Projects' },
  { id: 'tasks.*', label: 'All Task Permissions', category: 'Tasks' },
  { id: 'tasks.view', label: 'View Tasks', category: 'Tasks' },
  { id: 'tasks.create', label: 'Create Tasks', category: 'Tasks' },
  { id: 'tasks.edit', label: 'Edit Tasks', category: 'Tasks' },
  { id: 'tasks.delete', label: 'Delete Tasks', category: 'Tasks' },
  { id: 'users.*', label: 'All User Permissions', category: 'Users' },
  { id: 'users.view', label: 'View Team Members', category: 'Users' },
  { id: 'users.invite', label: 'Invite Users', category: 'Users' },
  { id: 'users.edit', label: 'Edit User Roles', category: 'Users' },
  { id: 'settings.*', label: 'All Settings Permissions', category: 'Settings' },
  { id: 'settings.view', label: 'View Settings', category: 'Settings' },
  { id: 'settings.edit', label: 'Edit Settings', category: 'Settings' }
];

const TeamManagement: React.FC = () => {
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'roles'>('members');
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [currentUserStatus, setCurrentUserStatus] = useState<'online' | 'busy' | 'dnd' | 'offline'>('online');
  const [newRole, setNewRole] = useState<CreateRoleRequest>({
    name: '',
    display_name: '',
    description: '',
    permissions: []
  });

  // Status utilities
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'busy': return 'text-yellow-500';
      case 'dnd': return 'text-red-500';
      case 'offline': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'busy': return 'Busy';
      case 'dnd': return 'Do Not Disturb';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  // Fetch real organization members and roles
  useEffect(() => {
    const fetchTeamData = async () => {
      if (!organization) return;
      
      try {
        setLoading(true);
        console.log('Fetching team data for organization:', organization.id);
        
        const [membersData, rolesData] = await Promise.all([
          organizationsApi.getMembers().catch((error) => {
            console.error('Error fetching members:', error);
            return [];
          }),
          organizationsApi.getRoles().catch((error) => {
            console.error('Error fetching roles:', error);
            return [];
          })
        ]);
        
        console.log('Members data received:', membersData);
        console.log('Roles data received:', rolesData);
        
        setMembers(membersData || []);
        setRoles(rolesData || []);
        
      } catch (error) {
        console.error('Error fetching team data:', error);
        setMembers([]);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [organization]);

  const isOwner = user && members.find(m => m.user_id === user.id)?.role?.name === 'owner';

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!newRole.name || !newRole.display_name || newRole.permissions.length === 0) {
      return;
    }

    try {
      // Create role via API
      const createdRole = await organizationsApi.createRole({
        name: newRole.name,
        display_name: newRole.display_name,
        description: newRole.description,
        permissions: newRole.permissions
      });

      // Add to local state
      setRoles([...roles, createdRole]);
      setShowCreateRoleModal(false);
      setNewRole({ name: '', display_name: '', description: '', permissions: [] });
    } catch (error) {
      console.error('Error creating role:', error);
      alert('Failed to create role. Please try again.');
    }
  };

  const handlePermissionToggle = (permission: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const getInitials = (member: OrganizationMember) => {
    const name = member.user?.first_name && member.user?.last_name 
      ? `${member.user.first_name} ${member.user.last_name}`
      : member.user?.username || member.user?.email || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getDisplayName = (member: OrganizationMember) => {
    return member.user?.first_name && member.user?.last_name 
      ? `${member.user.first_name} ${member.user.last_name}`
      : member.user?.username || member.user?.email || 'Unknown User';
  };

  const startMessage = async (memberId: number) => {
    try {
      if (memberId === user?.id) {
        alert("You can't message yourself!");
        return;
      }
      
      // Create or find direct message room
      const room = await messagesApi.createDirectMessage(memberId);
      navigate('/messages');
    } catch (error) {
      console.error('Error starting message:', error);
      alert('Failed to start message. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600">Manage your team members and roles</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowCreateRoleModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Role
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
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Team Members ({members.length})
          </button>
          
          <button
            onClick={() => setActiveTab('roles')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'roles'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="h-4 w-4 inline mr-2" />
            Roles ({roles.length})
          </button>
        </nav>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {members.map((member) => (
              <li key={member.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                        {getInitials(member)}
                      </div>
                      {/* Status indicator */}
                      <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center ${
                        member.user?.user_status === 'online' ? 'bg-green-500' :
                        member.user?.user_status === 'busy' ? 'bg-yellow-500' :
                        member.user?.user_status === 'dnd' ? 'bg-red-500' : 'bg-gray-400'
                      }`}>
                        <Circle className="h-2 w-2 fill-current text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 flex items-center">
                        {getDisplayName(member)}
                        {member.role?.name === 'owner' && (
                          <Crown className="h-4 w-4 text-yellow-500 ml-2" title="Organization Owner" />
                        )}
                        {member.user_id === user?.id && (
                          <button
                            onClick={() => setShowStatusModal(true)}
                            className="ml-2 text-xs text-gray-500 hover:text-gray-700"
                          >
                            (You)
                          </button>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500">{member.user?.email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`flex items-center text-xs ${getStatusColor(member.user?.user_status || 'offline')}`}>
                          <Circle className="h-2 w-2 fill-current mr-1" />
                          {getStatusText(member.user?.user_status || 'offline')}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">{member.role?.display_name}</span>
                        {member.user?.status_message && (
                          <>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-gray-400 italic">{member.user.status_message}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isOwner && member.role?.name !== 'owner' && (
                    <div className="flex items-center space-x-2">
                      <select
                        value={member.role_id}
                        onChange={async (e) => {
                          try {
                            const newRoleId = parseInt(e.target.value);
                            await organizationsApi.updateMemberRole(member.user_id, newRoleId);
                            
                            // Update local state
                            setMembers(prevMembers => 
                              prevMembers.map(m => 
                                m.user_id === member.user_id 
                                  ? { ...m, role_id: newRoleId, role: roles.find(r => r.id === newRoleId) || m.role }
                                  : m
                              )
                            );
                          } catch (error) {
                            console.error('Failed to update member role:', error);
                            alert('Failed to update member role. Please try again.');
                          }
                        }}
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
                  
                  {/* Message Button */}
                  {member.user_id !== user?.id && (
                    <div className="mt-3">
                      <button
                        onClick={() => startMessage(member.user_id)}
                        className="w-full bg-primary-600 text-white text-sm px-3 py-1 rounded-md hover:bg-primary-700 transition-colors"
                      >
                        Send Message
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
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
                
                {isOwner && !role.is_system_role && (
                  <div className="flex space-x-1">
                    <button className="p-1 text-gray-400 hover:text-gray-600">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              
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
          ))}
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create New Role</h3>
              <button
                onClick={() => setShowCreateRoleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role Name</label>
                  <input
                    type="text"
                    required
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., developer"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Display Name</label>
                  <input
                    type="text"
                    required
                    value={newRole.display_name}
                    onChange={(e) => setNewRole({ ...newRole, display_name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Developer"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                  placeholder="Describe what this role can do..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
                <div className="space-y-3">
                  {Object.entries(
                    availablePermissions.reduce((acc, perm) => {
                      if (!acc[perm.category]) acc[perm.category] = [];
                      acc[perm.category].push(perm);
                      return acc;
                    }, {} as Record<string, typeof availablePermissions>)
                  ).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-800 mb-2">{category}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {perms.map((permission) => (
                          <label key={permission.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={newRole.permissions.includes(permission.id)}
                              onChange={() => handlePermissionToggle(permission.id)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{permission.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateRoleModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-primary-700"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Update Your Status</h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Choose your availability status. Your status will automatically change to offline when you're inactive.
            </p>
            
            <div className="space-y-3">
              {[
                { value: 'online', label: 'Online', color: 'bg-green-500', description: 'Available and ready to work' },
                { value: 'busy', label: 'Busy', color: 'bg-yellow-500', description: 'Working but may be slow to respond' },
                { value: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500', description: 'Please do not interrupt' }
              ].map((status) => (
                <button
                  key={status.value}
                  onClick={async () => {
                    try {
                      await authApi.updateUserStatus(status.value);
                      setCurrentUserStatus(status.value as any);
                      setShowStatusModal(false);
                      // Refresh team data to see updated status
                      window.location.reload();
                    } catch (error) {
                      console.error('Failed to update status:', error);
                      alert('Failed to update status. Please try again.');
                    }
                  }}
                  className={`w-full flex items-center p-3 rounded-lg border-2 transition-colors ${
                    currentUserStatus === status.value 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full ${status.color} mr-3 flex items-center justify-center`}>
                    <Circle className="h-2 w-2 fill-current text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">{status.label}</div>
                    <div className="text-sm text-gray-500">{status.description}</div>
                  </div>
                  {currentUserStatus === status.value && (
                    <Check className="h-5 w-5 text-primary-600 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
