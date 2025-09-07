import React, { useState } from 'react';
import { clientAuthApi } from '../services/clientApi';

const ClientLogin: React.FC = () => {
  const [organization_slug, setOrganizationSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const { token } = await clientAuthApi.login({ organization_slug, email, password });
      localStorage.setItem('clientToken', token);
      window.location.href = '/client';
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-6 rounded-lg shadow">
        <h1 className="text-xl font-semibold">Client Login</h1>
        {error && <div className="mt-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <input className="w-full border rounded px-3 py-2" placeholder="Organization slug" value={organization_slug} onChange={e => setOrganizationSlug(e.target.value)} />
          <input className="w-full border rounded px-3 py-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full border rounded px-3 py-2" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="w-full px-4 py-2 rounded bg-primary-600 text-white">Login</button>
        </form>
      </div>
    </div>
  );
};

export default ClientLogin;


