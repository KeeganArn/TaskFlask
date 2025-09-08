import React, { useEffect, useState } from 'react';
import { crmApi } from '../services/api';

const CrmContacts: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ first_name?: string; last_name?: string; email?: string }>({});

  const load = async () => {
    try {
      setLoading(true);
      setItems(await crmApi.listContacts());
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      const created = await crmApi.createContact(form);
      setItems([created, ...items]);
      setForm({});
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create contact');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
      {error && <div className="mt-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="mt-4 bg-white p-4 rounded shadow">
        <div className="grid grid-cols-3 gap-2">
          <input className="border rounded px-3 py-2" placeholder="First name" value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Last name" value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="mt-3"><button className="px-4 py-2 text-sm rounded bg-primary-600 text-white" onClick={create}>Create</button></div>
      </div>

      {loading ? (
        <div className="mt-6 text-gray-500">Loading...</div>
      ) : (
        <div className="mt-6 overflow-hidden bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CrmContacts;


