import React, { useEffect, useState } from 'react';
import { crmApi } from '../services/api';

const CrmActivities: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ type: 'call'|'meeting'|'email'|'task'|'note'; subject?: string }>({ type: 'note' });

  const load = async () => {
    try {
      setLoading(true);
      setItems(await crmApi.listActivities());
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      const created = await crmApi.createActivity(form as any);
      setItems([created, ...items]);
      setForm({ type: 'note' });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create activity');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Activities</h1>
      {error && <div className="mt-4 p-3 rounded bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}

      <div className="mt-4 bg-white dark:bg-gray-800 p-4 rounded shadow">
        <div className="grid grid-cols-3 gap-2">
          <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}>
            <option value="note">Note</option>
            <option value="task">Task</option>
            <option value="email">Email</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
          </select>
          <input className="input" placeholder="Subject" value={form.subject || ''} onChange={e => setForm({ ...form, subject: e.target.value })} />
        </div>
        <div className="mt-3"><button className="px-4 py-2 text-sm rounded bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500" onClick={create}>Create</button></div>
      </div>

      {loading ? (
        <div className="mt-6 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : (
        <div className="mt-6 overflow-hidden bg-white dark:bg-gray-800 shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subject</th>
            </tr></thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{a.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{a.subject || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CrmActivities;


