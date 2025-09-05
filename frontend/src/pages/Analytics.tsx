import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Clock, Target, Activity, PieChart, Calendar } from 'lucide-react';
import { analyticsApi, subscriptionsApi } from '../services/api';

interface OverviewData {
  overview: {
    total_users: number;
    total_projects: number;
    total_tasks: number;
    completed_tasks: number;
  };
  activity_timeline: Array<{
    date: string;
    tasks_created: number;
  }>;
  completion_timeline: Array<{
    date: string;
    tasks_completed: number;
  }>;
  user_activity: Array<{
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    tasks_created: number;
    tasks_assigned: number;
    last_seen: string;
  }>;
  project_activity: Array<{
    id: number;
    name: string;
    total_tasks: number;
    completed_tasks: number;
    recent_tasks: number;
  }>;
  period_days: number;
}

interface TaskAnalytics {
  status_distribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  priority_distribution: Array<{
    priority: string;
    count: number;
  }>;
  completion_trend: Array<{
    date: string;
    completed_count: number;
  }>;
  completion_times: {
    avg_completion_days: number;
    min_completion_days: number;
    max_completion_days: number;
  };
  productive_users: Array<{
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    tasks_created: number;
    tasks_completed: number;
  }>;
}

interface TimeAnalytics {
  overview: {
    active_users: number;
    total_sessions: number;
    total_minutes: number;
    avg_session_minutes: number;
    billable_minutes: number;
  };
  daily_breakdown: Array<{
    date: string;
    total_minutes: number;
    session_count: number;
    active_users: number;
  }>;
  user_breakdown: Array<{
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    total_minutes: number;
    session_count: number;
    billable_minutes: number;
  }>;
  project_breakdown: Array<{
    id: number;
    name: string;
    total_minutes: number;
    session_count: number;
    avg_session_minutes: number;
  }>;
}

export default function Analytics() {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [taskAnalytics, setTaskAnalytics] = useState<TaskAnalytics | null>(null);
  const [timeAnalytics, setTimeAnalytics] = useState<TimeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [hasTimeTracking, setHasTimeTracking] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    }
  }, [hasAccess, period]);

  const checkAccess = async () => {
    try {
      const [analyticsResult, timeTrackingResult] = await Promise.all([
        subscriptionsApi.checkFeature('analytics'),
        subscriptionsApi.checkFeature('time_tracking')
      ]);
      
      setHasAccess(analyticsResult.hasAccess);
      setHasTimeTracking(timeTrackingResult.hasAccess);
    } catch (error) {
      console.error('Error checking feature access:', error);
      setHasAccess(false);
      setHasTimeTracking(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const promises = [
        analyticsApi.getOverview(period),
        analyticsApi.getTaskAnalytics(period)
      ];

      if (hasTimeTracking) {
        promises.push(analyticsApi.getTimeTrackingAnalytics(period));
      }

      const results = await Promise.all(promises);
      
      setOverviewData(results[0]);
      setTaskAnalytics(results[1]);
      
      if (hasTimeTracking && results[2]) {
        setTimeAnalytics(results[2]);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'todo': return 'bg-gray-500';
      case 'blocked': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Analytics Unavailable</h2>
          <p className="text-gray-600 mb-4">
            Analytics dashboard is a Pro feature. Upgrade your plan to get insights into your team's productivity.
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
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="mt-2 text-gray-600">Insights into your team's productivity and performance</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>Overview</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'tasks'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4" />
                <span>Tasks</span>
              </div>
            </button>
            {hasTimeTracking && (
              <button
                onClick={() => setActiveTab('time')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'time'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Time Tracking</span>
                </div>
              </button>
            )}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && overviewData && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Team Members</p>
                    <p className="text-2xl font-bold text-gray-900">{overviewData.overview.total_users}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Projects</p>
                    <p className="text-2xl font-bold text-gray-900">{overviewData.overview.total_projects}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Target className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                    <p className="text-2xl font-bold text-gray-900">{overviewData.overview.total_tasks}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-gray-900">{overviewData.overview.completed_tasks}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Creation Timeline</h3>
                <div className="space-y-2">
                  {overviewData.activity_timeline.slice(0, 10).map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{formatDate(item.date)}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, (item.tasks_created / Math.max(...overviewData.activity_timeline.map(t => t.tasks_created))) * 100)}%`
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.tasks_created}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Active Users</h3>
                <div className="space-y-3">
                  {overviewData.user_activity.slice(0, 5).map(user => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-gray-500">@{user.username}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {user.tasks_created + user.tasks_assigned} tasks
                        </p>
                        <p className="text-xs text-gray-500">
                          {user.tasks_created} created, {user.tasks_assigned} assigned
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Project Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Performance</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Tasks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recent Activity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completion Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {overviewData.project_activity.map(project => (
                      <tr key={project.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {project.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {project.total_tasks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {project.completed_tasks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {project.recent_tasks} new tasks
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{
                                  width: `${project.total_tasks > 0 ? (project.completed_tasks / project.total_tasks) * 100 : 0}%`
                                }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-500">
                              {project.total_tasks > 0 ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && taskAnalytics && (
          <div className="space-y-8">
            {/* Status Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Status Distribution</h3>
                <div className="space-y-3">
                  {taskAnalytics.status_distribution.map(status => (
                    <div key={status.status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(status.status)}`}></div>
                        <span className="text-sm text-gray-700 capitalize">{status.status.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getStatusColor(status.status)}`}
                            style={{ width: `${status.percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12 text-right">
                          {status.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
                <div className="space-y-3">
                  {taskAnalytics.priority_distribution.map(priority => (
                    <div key={priority.priority} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getPriorityColor(priority.priority)}`}></div>
                        <span className="text-sm text-gray-700 capitalize">{priority.priority}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{priority.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Completion Metrics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Completion Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {taskAnalytics.completion_times.avg_completion_days?.toFixed(1) || 0} days
                  </p>
                  <p className="text-sm text-gray-600">Average completion time</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {taskAnalytics.completion_times.min_completion_days || 0} days
                  </p>
                  <p className="text-sm text-gray-600">Fastest completion</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {taskAnalytics.completion_times.max_completion_days || 0} days
                  </p>
                  <p className="text-sm text-gray-600">Longest completion</p>
                </div>
              </div>
            </div>

            {/* Top Performers */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
              <div className="space-y-3">
                {taskAnalytics.productive_users.map((user, index) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary-100 rounded-full text-primary-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {user.tasks_created + user.tasks_completed} tasks
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.tasks_created} created • {user.tasks_completed} completed
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Time Tracking Tab */}
        {activeTab === 'time' && hasTimeTracking && timeAnalytics && (
          <div className="space-y-8">
            {/* Time Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Time</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatDuration(timeAnalytics.overview.total_minutes)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900">{timeAnalytics.overview.active_users}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Activity className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Sessions</p>
                    <p className="text-2xl font-bold text-gray-900">{timeAnalytics.overview.total_sessions}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Billable Time</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatDuration(timeAnalytics.overview.billable_minutes)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Time by User */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Time by Team Member</h3>
              <div className="space-y-3">
                {timeAnalytics.user_breakdown.map(user => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{user.session_count} sessions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {formatDuration(user.total_minutes)}
                      </p>
                      <p className="text-xs text-green-600">
                        {formatDuration(user.billable_minutes)} billable
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time by Project */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Time by Project</h3>
              <div className="space-y-3">
                {timeAnalytics.project_breakdown.map(project => (
                  <div key={project.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{project.name}</p>
                      <p className="text-xs text-gray-500">
                        {project.session_count} sessions • Avg: {formatDuration(project.avg_session_minutes)}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDuration(project.total_minutes)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
