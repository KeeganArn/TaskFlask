import React, { useEffect, useMemo, useState } from 'react';
import { ticketsApi } from '../services/api';
import { Link } from 'react-router-dom';

interface TicketType { id: number; key_slug: string; display_name: string; }
interface Ticket {
  id: number;
  ticket_type_id: number;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
}

const OrgTickets: React.FC = () => {
  const [types, setTypes] = useState<TicketType[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ ticket_type_id?: number; title: string; description?: string; priority?: string }>({ title: '' });

  const typeMap = useMemo(() => Object.fromEntries(types.map(t => [t.id, t.display_name])), [types]);

  const load = async () => {
    try {
      setLoading(true);
      const [tt, t] = await Promise.all([ticketsApi.listTypes(), ticketsApi.list()]);
      setTypes(tt);
      setTickets(t);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createTicket = async () => {
    if (!form.ticket_type_id || !form.title) return;
    try {
      const created = await ticketsApi.create({
        ticket_type_id: form.ticket_type_id,
        title: form.title,
        description: form.description,
        priority: (form.priority as any) || 'medium'
      });
      setTickets([created, ...tickets]);
      setForm({ title: '' });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create ticket');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
      </div>
      {error && <div className="mt-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="mt-6 bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-4 gap-2">
          <select className="border rounded px-3 py-2" value={form.ticket_type_id || ''} onChange={e => setForm({ ...form, ticket_type_id: Number(e.target.value) })}>
            <option value="">Select type</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
          </select>
          <input className="border rounded px-3 py-2" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Description (optional)" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          <select className="border rounded px-3 py-2" value={form.priority || 'medium'} onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="mt-3">
          <button className="px-4 py-2 text-sm rounded bg-primary-600 text-white" onClick={createTicket}>Create Ticket</button>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 text-gray-500">Loading...</div>
      ) : (
        <div className="mt-6 overflow-hidden bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickets.map(t => (
                <tr key={t.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{typeMap[t.ticket_type_id] || t.ticket_type_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><Link className="text-primary-600 hover:text-primary-900" to={`/tickets-org/${t.id}`}>{t.title}</Link></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrgTickets;


