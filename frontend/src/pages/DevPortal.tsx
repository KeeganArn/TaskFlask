import React, { useEffect, useState } from 'react';
import api from '../services/api';

type ApiKey = { id: number; name: string; key_prefix: string; permissions: string[]; last_used_at?: string; expires_at?: string; is_active: boolean; created_at: string };

const DevPortal: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const load = async () => {
    try {
      const rows = await api.get('/api-keys').then(res => res.data);
      setKeys(rows);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load API keys');
    }
  };

  useEffect(() => { load(); }, []);

  const createKey = async () => {
    try {
      setError(null);
      const res = await api.post('/api-keys', { name, permissions: ['*'] });
      setCreatedKey(res.data.api_key);
      setName('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create API key');
    }
  };

  const toggle = async (id: number) => {
    await api.put(`/api-keys/${id}/toggle`);
    await load();
  };

  const remove = async (id: number) => {
    await api.delete(`/api-keys/${id}`);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Developer Portal</h1>
        <a className="text-sm text-primary-600 hover:underline" href="/api/openapi.json" target="_blank" rel="noreferrer">OpenAPI JSON</a>
      </div>

      {error && <div className="mt-4 p-3 rounded bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}
      {createdKey && (
        <div className="mt-4 p-3 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm">
          Copy your API key now — it won't be shown again: <code className="font-mono">{createdKey}</code>
        </div>
      )}

      <div className="mt-6 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-2">
          <input className="input" placeholder="Key name (e.g., CI/CD)" value={name} onChange={e => setName(e.target.value)} />
          <button className="px-3 py-2 text-sm rounded bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500" onClick={createKey} disabled={!name}>Create API Key</button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden bg-white dark:bg-gray-800 shadow ring-1 ring-black ring-opacity-5 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800"><tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Prefix</th>
            <th className="px-6 py-3"></th>
          </tr></thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {keys.map(k => (
              <tr key={k.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{k.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{k.key_prefix}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                  <button onClick={() => toggle(k.id)} className={`px-2 py-1 rounded text-white ${k.is_active ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}>{k.is_active ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => remove(k.id)} className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DevPortal;


