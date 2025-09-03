import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, Building2, Users, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { RegisterRequest } from '../types';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, isLoading } = useAuth();
  
  const invitationToken = searchParams.get('token');
  const invitedEmail = searchParams.get('email');
  
  const [registrationType, setRegistrationType] = useState<'organization' | 'join' | 'invitation'>(
    invitationToken ? 'invitation' : 'organization'
  );
  
  const [formData, setFormData] = useState<RegisterRequest>({
    username: '',
    email: invitedEmail || '',
    password: '',
    first_name: '',
    last_name: '',
    organization_name: '',
    organization_slug: '',
    organization_invite_code: '',
    invitation_token: invitationToken || undefined
  });
  
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugSuggestion, setSlugSuggestion] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (registrationType === 'organization') {
      if (!formData.organization_name || !formData.organization_slug) {
        setError('Organization name and ID are required');
        return;
      }
    } else if (registrationType === 'join') {
      if (!formData.organization_invite_code) {
        setError('Organization invite code is required');
        return;
      }
    }

    try {
      await register(formData);
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-generate organization slug
    if (name === 'organization_name' && registrationType === 'organization') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      setSlugSuggestion(slug);
      setFormData(prev => ({
        ...prev,
        organization_slug: slug
      }));
    }
  };

  const handleRegistrationTypeChange = (type: 'organization' | 'join' | 'invitation') => {
    setRegistrationType(type);
    setError(null);
    
    if (type === 'organization') {
      setFormData(prev => ({
        ...prev,
        organization_invite_code: '',
        invitation_token: undefined
      }));
    } else if (type === 'join') {
      setFormData(prev => ({
        ...prev,
        organization_name: '',
        organization_slug: '',
        invitation_token: undefined
      }));
    } else if (type === 'invitation') {
      setFormData(prev => ({
        ...prev,
        organization_name: '',
        organization_slug: '',
        organization_invite_code: ''
      }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100">
            <UserPlus className="h-6 w-6 text-primary-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              sign in to existing account
            </Link>
          </p>
        </div>

        {/* Registration Type Selection */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">How would you like to get started?</h3>
          </div>
            
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => handleRegistrationTypeChange('organization')}
                className={`relative flex items-center p-4 border rounded-lg text-left transition-colors ${
                  registrationType === 'organization'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Building2 className="h-6 w-6 text-primary-600 mr-3" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Create New Organization</div>
                  <div className="text-sm text-gray-500">Start fresh with your own workspace</div>
                </div>
                {registrationType === 'organization' && (
                  <CheckCircle className="h-5 w-5 text-primary-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleRegistrationTypeChange('join')}
                className={`relative flex items-center p-4 border rounded-lg text-left transition-colors ${
                  registrationType === 'join'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Users className="h-6 w-6 text-primary-600 mr-3" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Join Organization</div>
                  <div className="text-sm text-gray-500">Use your company's invite code</div>
                </div>
                {registrationType === 'join' && (
                  <CheckCircle className="h-5 w-5 text-primary-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleRegistrationTypeChange('invitation')}
                className={`relative flex items-center p-4 border rounded-lg text-left transition-colors ${
                  registrationType === 'invitation'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Mail className="h-6 w-6 text-primary-600 mr-3" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Email Invitation</div>
                  <div className="text-sm text-gray-500">Use a personal invitation link</div>
                </div>
                {registrationType === 'invitation' && (
                  <CheckCircle className="h-5 w-5 text-primary-600" />
                )}
              </button>
            </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Personal Information */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="mt-1 relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="John"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="mt-1 relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username *
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleInputChange}
                className="mt-1 relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="johndoe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                disabled={!!invitedEmail}
                className="mt-1 relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="relative block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="relative block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Organization Information */}
            {registrationType === 'organization' && (
              <>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Organization Details</h4>
                </div>
                
                <div>
                  <label htmlFor="organization_name" className="block text-sm font-medium text-gray-700">
                    Organization Name *
                  </label>
                  <input
                    id="organization_name"
                    name="organization_name"
                    type="text"
                    required={registrationType === 'organization'}
                    value={formData.organization_name}
                    onChange={handleInputChange}
                    className="mt-1 relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Acme Corporation"
                  />
                </div>

                <div>
                  <label htmlFor="organization_slug" className="block text-sm font-medium text-gray-700">
                    Organization ID *
                  </label>
                  <input
                    id="organization_slug"
                    name="organization_slug"
                    type="text"
                    required={registrationType === 'organization'}
                    value={formData.organization_slug}
                    onChange={handleInputChange}
                    className="mt-1 relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="acme-corp"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This will be used in your organization URL. Use lowercase letters, numbers, and hyphens only.
                  </p>
                </div>
              </>
            )}

            {/* Organization Invite Code */}
            {registrationType === 'join' && (
              <>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Join Organization</h4>
                </div>
                
                <div>
                  <label htmlFor="organization_invite_code" className="block text-sm font-medium text-gray-700">
                    Organization Invite Code *
                  </label>
                  <input
                    id="organization_invite_code"
                    name="organization_invite_code"
                    type="text"
                    required={registrationType === 'join'}
                    value={formData.organization_invite_code}
                    onChange={handleInputChange}
                    className="mt-1 relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm uppercase tracking-wider"
                    placeholder="ABC-1234"
                    maxLength={8}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter the invite code provided by your organization admin. Format: ABC-1234
                  </p>
                </div>
              </>
            )}

            {/* Email Invitation Token */}
            {registrationType === 'invitation' && !invitationToken && (
              <div>
                <label htmlFor="invitation_token" className="block text-sm font-medium text-gray-700">
                  Invitation Code
                </label>
                <input
                  id="invitation_token"
                  name="invitation_token"
                  type="text"
                  value={formData.invitation_token || ''}
                  onChange={handleInputChange}
                  className="mt-1 relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter your invitation code"
                />
                <p className="mt-1 text-xs text-gray-500">
                  You should have received this code via email from your organization admin.
                </p>
              </div>
            )}

            {invitationToken && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-800">
                    You're joining via invitation. Complete the form to create your account.
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating account...
                </div>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </>
              )}
            </button>
          </div>

          <div className="text-center text-xs text-gray-500">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-primary-600 hover:text-primary-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-primary-600 hover:text-primary-500">
              Privacy Policy
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;