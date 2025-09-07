import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ticketsApi } from '../services/api';

const OrgTicketDetail: React.FC = () => {
  const { id } = useParams();
  const ticketId = Number(id);
  const [data, setData] = useState<{ ticket: any; comments: any[] } | null>(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');

  const load = async () => {
    try {
      const res = await ticketsApi.getById(ticketId);
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load');
    }
  };

  useEffect(() => { if (ticketId) load(); }, [ticketId]);

  const addComment = async () => {
    try {
      if (!comment.trim()) return;
      await ticketsApi.addComment(ticketId, comment);
      setComment('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to comment');
    }
  };

  if (!data) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{data.ticket.title}</h1>
      <p className="text-sm text-gray-500">Type: {data.ticket.type_name} • Status: {data.ticket.status} • Priority: {data.ticket.priority}</p>

      <div className="mt-6 bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">Description</h2>
        <p className="text-gray-700 whitespace-pre-wrap">{data.ticket.description || '-'}</p>
      </div>

      <div className="mt-6 bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-3">Comments</h2>
        <div className="space-y-3">
          {data.comments.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="text-gray-800">{c.comment}</div>
              <div className="text-gray-400">{new Date(c.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex space-x-2">
          <input className="flex-1 border rounded px-3 py-2" placeholder="Write a comment" value={comment} onChange={e => setComment(e.target.value)} />
          <button className="px-4 py-2 rounded bg-primary-600 text-white" onClick={addComment}>Comment</button>
        </div>
      </div>
    </div>
  );
};

export default OrgTicketDetail;


