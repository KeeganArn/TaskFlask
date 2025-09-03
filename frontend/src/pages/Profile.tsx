import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, Building } from 'lucide-react';

const Profile: React.FC = () => {
  const { user, organization } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  if (!user) {
    return <div>Loading...</div>;
  }

  const getDisplayName = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.username || user.email;
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center space-x-6">
            <div className="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center text-white text-xl font-medium">
              {user.avatar_url ? (
                <img className="h-20 w-20 rounded-full" src={user.avatar_url} alt="" />
              ) : (
                getInitials()
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{getDisplayName()}</h1>
              <p className="text-sm text-gray-500">{user.email}</p>
              {organization && (
                <p className="text-sm text-gray-600 flex items-center mt-1">
                  <Building className="h-4 w-4 mr-1" />
                  {organization.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                <User className="h-4 w-4 inline mr-2" />
                Username
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  value={user.username || ''}
                  disabled={!isEditing}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                <Mail className="h-4 w-4 inline mr-2" />
                Email
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  value={user.email || ''}
                  disabled={!isEditing}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <div className="mt-1">
                <input
                  type="text"
                  value={user.first_name || ''}
                  disabled={!isEditing}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <div className="mt-1">
                <input
                  type="text"
                  value={user.last_name || ''}
                  disabled={!isEditing}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50"
                />
              </div>
            </div>

            {user.created_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Member Since
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    value={new Date(user.created_at).toLocaleDateString()}
                    disabled
                    className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-primary-600 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              {isEditing ? 'Save Changes' : 'Edit Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
