import React, { useState, useEffect } from 'react';
import { Play, Pause, Clock, Edit, Trash2, Filter, Calendar, BarChart3 } from 'lucide-react';
import { timeTrackingApi, tasksApi, subscriptionsApi } from '../services/api';

interface TimeSession {
  id: number;
  task_id: number;
  task_title: string;
  task_description: string;
  project_name: string;
  description: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  is_billable: boolean;
  hourly_rate: number | null;
  username: string;
  first_name: string;
  last_name: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  project_id: number;
  project_name: string;
}

interface TimeStats {
  user_stats: {
    total_minutes: number;
    session_count: number;
    billable_minutes: number;
  };
  project_breakdown: Array<{
    project_name: string;
    project_id: number;
    total_minutes: number;
  }>;
  organization_stats?: {
    total_minutes: number;
    active_users: number;
    total_sessions: number;
  };
}

export default function TimeTracking() {
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Filters
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState('week');
  const [statsPeriod, setStatsPeriod] = useState<'today' | 'week' | 'month'>('week');

  // Form states
  const [showStartForm, setShowStartForm] = useState(false);
  const [startForm, setStartForm] = useState({
    task_id: '',
    description: '',
    is_billable: false,
    hourly_rate: ''
  });

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchData();
      fetchTasks();
    }
  }, [hasAccess, selectedTaskId, dateRange]);

  useEffect(() => {
    if (hasAccess) {
      fetchStats();
    }
  }, [hasAccess, statsPeriod]);

  // Update current time every second for active session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const checkAccess = async () => {
    try {
      const result = await subscriptionsApi.checkFeature('time_tracking');
      setHasAccess(result.hasAccess);
    } catch (error) {
      console.error('Error checking feature access:', error);
      setHasAccess(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const params: any = {};
      if (selectedTaskId) params.task_id = selectedTaskId;
      
      // Set date range
      if (dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setDate(now.getDate() - 30);
            break;
        }
        
        params.start_date = startDate.toISOString();
      }

      const [sessionsData, activeData] = await Promise.all([
        timeTrackingApi.getSessions(params),
        timeTrackingApi.getActiveSession()
      ]);

      setSessions(sessionsData);
      setActiveSession(activeData);
    } catch (error) {
      console.error('Error fetching time tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const tasksData = await tasksApi.getTasks();
      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await timeTrackingApi.getStats(statsPeriod);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const sessionData = await timeTrackingApi.startSession(
        parseInt(startForm.task_id),
        startForm.description || undefined,
        startForm.is_billable,
        startForm.hourly_rate ? parseFloat(startForm.hourly_rate) : undefined
      );

      setActiveSession(sessionData);
      setShowStartForm(false);
      setStartForm({ task_id: '', description: '', is_billable: false, hourly_rate: '' });
      await fetchData();
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start time tracking session');
    }
  };

  const handleStopSession = async () => {
    if (!activeSession) return;

    try {
      await timeTrackingApi.stopSession(activeSession.id);
      setActiveSession(null);
      await fetchData();
      await fetchStats();
    } catch (error) {
      console.error('Error stopping session:', error);
      alert('Failed to stop time tracking session');
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      await timeTrackingApi.deleteSession(sessionId);
      await fetchData();
      await fetchStats();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session');
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getActiveDuration = () => {
    if (!activeSession) return 0;
    
    const startTime = new Date(activeSession.start_time);
    const now = currentTime;
    return Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Time Tracking Unavailable</h2>
          <p className="text-gray-600 mb-4">
            Time tracking is a Pro feature. Upgrade your plan to start tracking time on your tasks.
          </p>
          <button
            onClick={() => window.location.href = '/billing'}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading time tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Time Tracking</h1>
          <p className="mt-2 text-gray-600">Track time spent on tasks and analyze your productivity</p>
        </div>

        {/* Active Session */}
        {activeSession ? (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 bg-primary-600 rounded-full">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-primary-900">
                    Currently tracking: {activeSession.task_title}
                  </h3>
                  <p className="text-primary-700">{activeSession.project_name}</p>
                  <p className="text-sm text-primary-600">
                    Started at {formatTime(activeSession.start_time)} • 
                    Duration: {formatDuration(getActiveDuration())}
                  </p>
                </div>
              </div>
              <button
                onClick={handleStopSession}
                className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                <Pause className="h-4 w-4" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">No active session</h3>
                <p className="text-gray-600">Start tracking time on a task</p>
              </div>
              <button
                onClick={() => setShowStartForm(true)}
                className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
              >
                <Play className="h-4 w-4" />
                <span>Start Tracking</span>
              </button>
            </div>
          </div>
        )}

        {/* Start Session Form */}
        {showStartForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Start Time Tracking</h3>
              <form onSubmit={handleStartSession}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task</label>
                  <select
                    value={startForm.task_id}
                    onChange={(e) => setStartForm({ ...startForm, task_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select a task</option>
                    {tasks.map(task => (
                      <option key={task.id} value={task.id}>
                        {task.title} ({task.project_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                  <input
                    type="text"
                    value={startForm.description}
                    onChange={(e) => setStartForm({ ...startForm, description: e.target.value })}
                    placeholder="What are you working on?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="mb-4 flex items-center">
                  <input
                    type="checkbox"
                    id="billable"
                    checked={startForm.is_billable}
                    onChange={(e) => setStartForm({ ...startForm, is_billable: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="billable" className="text-sm font-medium text-gray-700">
                    Billable time
                  </label>
                </div>

                {startForm.is_billable && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={startForm.hourly_rate}
                      onChange={(e) => setStartForm({ ...startForm, hourly_rate: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700"
                  >
                    Start Tracking
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStartForm(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sessions List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Sessions</h2>
                  <div className="flex items-center space-x-4">
                    <select
                      value={selectedTaskId || ''}
                      onChange={(e) => setSelectedTaskId(e.target.value ? parseInt(e.target.value) : null)}
                      className="text-sm border border-gray-300 rounded-md px-3 py-1"
                    >
                      <option value="">All tasks</option>
                      {tasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-3 py-1"
                    >
                      <option value="today">Today</option>
                      <option value="week">This week</option>
                      <option value="month">This month</option>
                      <option value="all">All time</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {sessions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No time sessions found for the selected period.
                  </div>
                ) : (
                  sessions.map(session => (
                    <div key={session.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{session.task_title}</h3>
                          <p className="text-sm text-gray-600">{session.project_name}</p>
                          {session.description && (
                            <p className="text-sm text-gray-500 mt-1">{session.description}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>{formatDate(session.start_time)}</span>
                            <span>{formatTime(session.start_time)} - {session.end_time ? formatTime(session.end_time) : 'In progress'}</span>
                            <span className="font-medium">{formatDuration(session.duration_minutes)}</span>
                            {session.is_billable && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                Billable
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-6">
            {stats && (
              <>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Your Stats</h3>
                    <select
                      value={statsPeriod}
                      onChange={(e) => setStatsPeriod(e.target.value as 'today' | 'week' | 'month')}
                      className="text-sm border border-gray-300 rounded-md px-3 py-1"
                    >
                      <option value="today">Today</option>
                      <option value="week">This week</option>
                      <option value="month">This month</option>
                    </select>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Time</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatDuration(stats.user_stats.total_minutes)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Sessions</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {stats.user_stats.session_count}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Billable Time</p>
                      <p className="text-xl font-semibold text-green-600">
                        {formatDuration(stats.user_stats.billable_minutes)}
                      </p>
                    </div>
                  </div>
                </div>

                {stats.project_breakdown.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Time by Project</h3>
                    <div className="space-y-3">
                      {stats.project_breakdown.map(project => (
                        <div key={project.project_id} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 truncate">{project.project_name}</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatDuration(project.total_minutes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stats.organization_stats && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Organization Stats</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Time</span>
                        <span className="text-sm font-medium">
                          {formatDuration(stats.organization_stats.total_minutes)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Active Users</span>
                        <span className="text-sm font-medium">
                          {stats.organization_stats.active_users}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Sessions</span>
                        <span className="text-sm font-medium">
                          {stats.organization_stats.total_sessions}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
