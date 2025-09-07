import React, { useEffect, useState } from 'react';
import { clientTicketsApi } from '../services/clientApi';

interface TicketType { id: number; display_name: string; }
interface Ticket { id: number; title: string; status: string; priority: string; ticket_type_id: number; }

const ClientPortal: React.FC = () => {
  const [types, setTypes] = useState<TicketType[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [form, setForm] = useState<{ ticket_type_id?: number; title: string; description?: string; priority?: string }>({ title: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [tt, t] = await Promise.all([
        clientTicketsApi.listTypes(),
        clientTicketsApi.list()
      ]);
      setTypes(tt);
      setTickets(t);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load');
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      const created = await clientTicketsApi.create({
        ticket_type_id: form.ticket_type_id!,
        title: form.title,
        description: form.description,
        priority: (form.priority as any) || 'medium'
      });
      setTickets([created, ...tickets]);
      setForm({ title: '' });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create');
    }
  };

  const addComment = async (ticketId: number) => {
    const text = prompt('Add a comment');
    if (!text) return;
    try {
      await clientTicketsApi.addComment(ticketId, text);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to comment');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-semibold">Client Portal</h1>
      {error && <div className="mt-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="mt-6 bg-white shadow rounded p-4">
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
          <button className="px-4 py-2 text-sm rounded bg-primary-600 text-white" onClick={create}>Create Ticket</button>
        </div>
      </div>

      <div className="mt-6 bg-white shadow rounded overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tickets.map(t => (
              <tr key={t.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.priority}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button className="text-primary-600 hover:text-primary-900" onClick={() => addComment(t.id)}>Comment</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientPortal;


