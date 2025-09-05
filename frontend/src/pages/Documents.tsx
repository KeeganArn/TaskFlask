import React, { useEffect, useMemo, useState } from 'react';
import { Plus, FileText, Eye, Trash2, Edit2, RefreshCw, Users } from 'lucide-react';
import { documentsApi } from '../services/api';
import { usePermission } from '../contexts/AuthContext';

interface DocumentItem {
  id: number;
  organization_id: number;
  title: string;
  content: string | null;
  created_by: number;
  updated_by?: number | null;
  visibility: 'org' | 'private';
  created_at: string;
  updated_at: string;
  author_username?: string;
  author_first_name?: string;
  author_last_name?: string;
}

interface ActiveView {
  session_id: number;
  document_id: number;
  document_title: string;
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  started_at: string;
  last_heartbeat: string;
  duration_seconds: number;
}

const HEARTBEAT_MS = 20000;
const ACTIVE_VIEWS_POLL_MS = 15000;

const Documents: React.FC = () => {
  const canManageUsers = usePermission('users.view');

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [form, setForm] = useState<{ title: string; content: string; visibility: 'org' | 'private' }>({
    title: '',
    content: '',
    visibility: 'org',
  });

  const [viewing, setViewing] = useState<DocumentItem | null>(null);
  const [viewSessionId, setViewSessionId] = useState<number | null>(null);

  const [activeViews, setActiveViews] = useState<ActiveView[]>([]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await documentsApi.list();
      setDocuments(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveViews = async () => {
    if (!canManageUsers) return;
    try {
      const data = await documentsApi.activeViews();
      setActiveViews(data);
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (!canManageUsers) return;
    fetchActiveViews();
    const t = setInterval(fetchActiveViews, ACTIVE_VIEWS_POLL_MS);
    return () => clearInterval(t);
  }, [canManageUsers]);

  // Handle view heartbeat
  useEffect(() => {
    if (!viewing || !viewSessionId) return;
    const t = setInterval(async () => {
      try { await documentsApi.heartbeat(viewSessionId); } catch {}
    }, HEARTBEAT_MS);
    return () => { clearInterval(t); };
  }, [viewing, viewSessionId]);

  // End session on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (viewSessionId) {
        navigator.sendBeacon(`/api/documents/views/${viewSessionId}/end`);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [viewSessionId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', content: '', visibility: 'org' });
    setShowEditor(true);
  };

  const openEdit = (doc: DocumentItem) => {
    setEditing(doc);
    setForm({ title: doc.title, content: doc.content || '', visibility: doc.visibility });
    setShowEditor(true);
  };

  const saveDoc = async () => {
    try {
      if (editing) {
        await documentsApi.update(editing.id, form);
      } else {
        await documentsApi.create(form);
      }
      setShowEditor(false);
      await fetchDocuments();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to save');
    }
  };

  const removeDoc = async (doc: DocumentItem) => {
    if (!confirm('Delete this document?')) return;
    try {
      await documentsApi.remove(doc.id);
      await fetchDocuments();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to delete');
    }
  };

  const startViewing = async (doc: DocumentItem) => {
    try {
      const res = await documentsApi.startView(doc.id);
      setViewSessionId(res.session_id);
      setViewing(doc);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to open document');
    }
  };

  const stopViewing = async () => {
    try {
      if (viewSessionId) {
        await documentsApi.endView(viewSessionId);
      }
    } finally {
      setViewing(null);
      setViewSessionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <div className="flex items-center space-x-3">
            <button onClick={fetchDocuments} className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </button>
            <button onClick={openCreate} className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
              <Plus className="h-4 w-4 mr-2" /> New Document
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Documents list */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">All Documents</h2>
                <span className="text-sm text-gray-500">{documents.length} items</span>
              </div>

              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : error ? (
                <div className="p-8 text-center text-red-600">{error}</div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {documents.map(doc => (
                    <li key={doc.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <FileText className="h-5 w-5 text-primary-600" />
                            <h3 className="text-md font-semibold text-gray-900">{doc.title}</h3>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Updated {new Date(doc.updated_at).toLocaleString()} • Visibility: {doc.visibility}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => startViewing(doc)} className="text-blue-600 hover:text-blue-800" title="Open">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(doc)} className="text-gray-700 hover:text-gray-900" title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => removeDoc(doc)} className="text-red-600 hover:text-red-800" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                  {documents.length === 0 && (
                    <li className="p-8 text-center text-gray-500">No documents yet.</li>
                  )}
                </ul>
              )}
            </div>

            {/* Viewer */}
            {viewing && (
              <div className="mt-6 bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-5 w-5 text-green-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Viewing: {viewing.title}</h2>
                  </div>
                  <button onClick={stopViewing} className="text-sm px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Close</button>
                </div>
                <div className="p-6">
                  <pre className="whitespace-pre-wrap text-gray-800">{viewing.content}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Manager panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-gray-700" />
                  <h2 className="text-lg font-semibold text-gray-900">Active Viewers</h2>
                </div>
                <button onClick={fetchActiveViews} className="text-sm text-gray-600 hover:text-gray-800 flex items-center">
                  <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </button>
              </div>
              {!canManageUsers ? (
                <div className="p-6 text-gray-500 text-sm">You don't have permission to view team activity.</div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {activeViews.map(v => (
                    <li key={v.session_id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-gray-900 font-medium">{v.first_name} {v.last_name} (@{v.username})</p>
                          <p className="text-xs text-gray-600">Looking at: <span className="font-medium">{v.document_title}</span></p>
                          <p className="text-xs text-gray-500">Since {new Date(v.started_at).toLocaleTimeString()} • Last seen {new Date(v.last_heartbeat).toLocaleTimeString()}</p>
                        </div>
                        <div className="text-xs text-gray-700">{Math.floor(v.duration_seconds / 60)}m {v.duration_seconds % 60}s</div>
                      </div>
                    </li>
                  ))}
                  {canManageUsers && activeViews.length === 0 && (
                    <li className="p-6 text-gray-500 text-sm">No active viewers.</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Editor modal */}
        {showEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{editing ? 'Edit Document' : 'New Document'}</h3>
                <button onClick={() => setShowEditor(false)} className="text-gray-500 hover:text-gray-800">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Document title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="w-full border rounded px-3 py-2 h-56"
                    placeholder="Write your document..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                  <select
                    value={form.visibility}
                    onChange={(e) => setForm({ ...form, visibility: e.target.value as 'org' | 'private' })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="org">Organization</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button onClick={() => setShowEditor(false)} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
                <button onClick={saveDoc} className="px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;


