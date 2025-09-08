import React, { useEffect, useState } from 'react';
import { crmApi } from '../services/api';

const CrmDeals: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ name: string; amount?: number; stage_id?: number }>({ name: '' });

  const load = async () => {
    try {
      setLoading(true);
      const [d, s] = await Promise.all([crmApi.listDeals(), crmApi.listStages().catch(() => [])]);
      setItems(d);
      setStages(s || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const seedStages = async () => {
    try {
      setStages(await crmApi.seedStages());
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to seed stages');
    }
  };

  const create = async () => {
    if (!form.name) return;
    try {
      const created = await crmApi.createDeal(form);
      setItems([created, ...items]);
      setForm({ name: '' });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create deal');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Deals</h1>
        <button className="px-3 py-2 text-sm rounded border" onClick={seedStages}>Seed default stages</button>
      </div>
      {error && <div className="mt-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="mt-4 bg-white p-4 rounded shadow">
        <div className="grid grid-cols-3 gap-2">
          <input className="border rounded px-3 py-2" placeholder="Deal name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Amount" type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
          <select className="border rounded px-3 py-2" value={form.stage_id || ''} onChange={e => setForm({ ...form, stage_id: Number(e.target.value) })}>
            <option value="">Stage</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{d.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{d.amount?.toFixed ? d.amount.toFixed(2) : d.amount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{d.stage_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CrmDeals;


