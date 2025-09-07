import React, { useEffect, useState } from 'react';
import { ticketsApi } from '../services/api';

interface TicketType {
  id: number;
  organization_id: number;
  key_slug: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

const TicketTypes: React.FC = () => {
  const [types, setTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ key_slug: string; display_name: string; description?: string }>({ key_slug: '', display_name: '' });

  const load = async () => {
    try {
      setLoading(true);
      const data = await ticketsApi.listTypes();
      setTypes(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load ticket types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createType = async () => {
    try {
      setError('');
      const created = await ticketsApi.createType(form);
      setTypes([created, ...types]);
      setForm({ key_slug: '', display_name: '' });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create ticket type');
    }
  };

  const toggleActive = async (t: TicketType) => {
    try {
      const updated = await ticketsApi.updateType(t.id, { is_active: !t.is_active });
      setTypes(types.map(tt => tt.id === t.id ? updated : tt));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Ticket Types</h1>
      {error && <div className="mt-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="mt-6 bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-3 gap-2">
          <input className="border rounded px-3 py-2" placeholder="key_slug (e.g., dev)" value={form.key_slug} onChange={e => setForm({ ...form, key_slug: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Display name" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Description (optional)" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="mt-3">
          <button className="px-4 py-2 text-sm rounded bg-primary-600 text-white" onClick={createType}>Add Type</button>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 text-gray-500">Loading...</div>
      ) : (
        <div className="mt-6 overflow-hidden bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {types.map(t => (
                <tr key={t.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.key_slug}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.display_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{t.is_active ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-900" onClick={() => toggleActive(t)}>{t.is_active ? 'Disable' : 'Enable'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TicketTypes;


