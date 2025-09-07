import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { clientsApi } from '../services/api';

interface Client {
  id: number;
  organization_id: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

const Clients: React.FC = () => {
  const { hasPermission } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [form, setForm] = useState<{ name: string; email: string; phone?: string; company?: string }>({ name: '', email: '' });
  const [creatingUserFor, setCreatingUserFor] = useState<Client | null>(null);
  const [clientUserForm, setClientUserForm] = useState<{ email: string; password: string; first_name?: string; last_name?: string }>({ email: '', password: '' });

  const canManage = hasPermission('users.manage') || hasPermission('org.edit');

  const load = async () => {
    try {
      setLoading(true);
      const data = await clientsApi.list();
      setClients(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createClient = async () => {
    try {
      setError('');
      const created = await clientsApi.create(form);
      setClients([created, ...clients]);
      setCreateOpen(false);
      setForm({ name: '', email: '' });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create client');
    }
  };

  const createClientUser = async () => {
    if (!creatingUserFor) return;
    try {
      setError('');
      const password_hash = await clientsApi.hashPassword(clientUserForm.password);
      await clientsApi.createUser(creatingUserFor.id, {
        email: clientUserForm.email,
        password_hash,
        first_name: clientUserForm.first_name,
        last_name: clientUserForm.last_name
      });
      setCreatingUserFor(null);
      setClientUserForm({ email: '', password: '' });
      alert('Client user created. Share login URL with the client.');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create client user');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
        {canManage && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
          >
            New Client
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="mt-6 text-gray-500">Loading...</div>
      ) : (
        <div className="mt-6 overflow-hidden bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.company || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {canManage && (
                      <button
                        onClick={() => setCreatingUserFor(c)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        Create Login
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create client modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">New Client</h2>
            <div className="space-y-3">
              <input className="w-full border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="w-full border rounded px-3 py-2" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <input className="w-full border rounded px-3 py-2" placeholder="Phone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="w-full border rounded px-3 py-2" placeholder="Company" value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button className="px-4 py-2 text-sm rounded border" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="px-4 py-2 text-sm rounded bg-primary-600 text-white" onClick={createClient}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Create client user modal */}
      {creatingUserFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Create Login for {creatingUserFor.name}</h2>
            <div className="space-y-3">
              <input className="w-full border rounded px-3 py-2" placeholder="Email" value={clientUserForm.email} onChange={e => setClientUserForm({ ...clientUserForm, email: e.target.value })} />
              <input className="w-full border rounded px-3 py-2" placeholder="Password" type="password" value={clientUserForm.password} onChange={e => setClientUserForm({ ...clientUserForm, password: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="w-full border rounded px-3 py-2" placeholder="First name" value={clientUserForm.first_name || ''} onChange={e => setClientUserForm({ ...clientUserForm, first_name: e.target.value })} />
                <input className="w-full border rounded px-3 py-2" placeholder="Last name" value={clientUserForm.last_name || ''} onChange={e => setClientUserForm({ ...clientUserForm, last_name: e.target.value })} />
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <button className="px-4 py-2 text-sm rounded border" onClick={() => setCreatingUserFor(null)}>Cancel</button>
              <button className="px-4 py-2 text-sm rounded bg-primary-600 text-white" onClick={createClientUser}>Create Login</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;


