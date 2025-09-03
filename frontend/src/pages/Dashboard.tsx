import React, { useEffect, useState } from 'react';
import { LayoutDashboard, CheckSquare, FolderOpen, Clock, TrendingUp } from 'lucide-react';
import { Task, Project } from '../types';
import { tasksApi, projectsApi } from '../services/api';

const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

    useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksData, projectsData] = await Promise.all([
          tasksApi.getAll().catch(() => []),
          projectsApi.getAll().catch(() => [])
        ]);
        
        console.log('Tasks API response:', tasksData);
        console.log('Projects API response:', projectsData);
        
        setTasks(tasksData || []);
        setProjects(projectsData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data - using fallback data');
        // Set empty arrays as fallback
        setTasks([]);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Ensure tasks and projects are arrays
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  const stats = [
    {
      name: 'Total Tasks',
      value: safeTasks.length,
      icon: CheckSquare,
      color: 'bg-blue-500',
    },
    {
      name: 'Total Projects',
      value: safeProjects.length,
      icon: FolderOpen,
      color: 'bg-green-500',
    },
    {
      name: 'In Progress',
      value: safeTasks.filter(task => task.status === 'in-progress').length,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      name: 'Completed',
      value: safeTasks.filter(task => task.status === 'completed').length,
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
    {
      name: 'Overdue',
      value: safeTasks.filter(task => {
        if (task.status === 'completed') return false;
        const dueDate = new Date(task.due_date || task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dueDate < today;
      }).length,
      icon: Clock,
      color: 'bg-red-500',
    },
  ];

  const recentTasks = safeTasks
    .sort((a, b) => new Date(b.updated_at || b.updatedAt).getTime() - new Date(a.updated_at || a.updatedAt).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome to your task management overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="card">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overdue Tasks */}
      {(() => {
        const overdueTasks = safeTasks.filter(task => {
          if (task.status === 'completed') return false;
          const dueDate = new Date(task.due_date || task.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return dueDate < today;
        });
        
        if (overdueTasks.length > 0) {
          return (
            <div className="card border-l-4 border-l-red-500">
              <h2 className="text-lg font-semibold text-red-700 mb-4">⚠️ Overdue Tasks</h2>
              <div className="space-y-3">
                {overdueTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <p className="text-sm text-gray-600">{task.description}</p>
                      <p className="text-xs text-red-600 mt-1">
                        Due: {new Date(task.due_date || task.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        task.priority === 'high' ? 'bg-red-100 text-red-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Recent Tasks */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h2>
        {recentTasks.length === 0 ? (
          <p className="text-gray-500">No tasks yet. Create your first task to get started!</p>
        ) : (
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">{task.title}</h3>
                  <p className="text-sm text-gray-600">{task.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status.replace('-', ' ')}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    task.priority === 'high' ? 'bg-red-100 text-red-800' :
                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
