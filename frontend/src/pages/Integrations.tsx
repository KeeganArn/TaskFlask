import React, { useEffect, useState } from 'react';
import api from '../services/api';

type Connection = { id: number; provider: string; connected_at: string };

const providers = [
  { key: 'github', name: 'GitHub', description: 'Sync issues, link commits, auto-close tasks' },
  { key: 'slack', name: 'Slack', description: 'Send notifications and create tasks from messages' },
];

const Integrations: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const rows = await api.get('/integrations').then(res => res.data);
      setConnections(rows);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isConnected = (key: string) => connections.some(c => c.provider === key);

  const connect = async (provider: string) => {
    try {
      setLoading(true);
      await api.post('/integrations/connect', { provider });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to connect ${provider}`);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async (provider: string) => {
    try {
      setLoading(true);
      await api.post('/integrations/disconnect', { provider });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || `Failed to disconnect ${provider}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Integrations</h1>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map(p => (
          <div key={p.key} className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{p.description}</div>
              </div>
              {isConnected(p.key) ? (
                <button onClick={() => disconnect(p.key)} className="px-3 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500">Disconnect</button>
              ) : (
                <button onClick={() => connect(p.key)} className="px-3 py-2 text-sm rounded bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500">Connect</button>
              )}
            </div>
            {isConnected(p.key) && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Connected · {new Date(connections.find(c => c.provider === p.key)!.connected_at).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Integrations;


