import { pool } from './config';

const initDatabase = async () => {
  console.log('Initializing database...');
  
  try {
    // Create users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Users table created');

    // Create projects table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Projects table created');

    // Create tasks table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        status ENUM('todo', 'in-progress', 'completed') DEFAULT 'todo',
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        due_date DATE,
        project_id INT,
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Tasks table created');

    // Create indexes
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)');
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)');
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)');
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)');
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
    console.log('✓ Indexes created');

    // Check if sample user exists
    const [existingUsers] = await pool.execute('SELECT COUNT(*) as count FROM users');
    const userCount = (existingUsers as any[])[0]?.count || 0;

    if (userCount === 0) {
      // Insert sample user
      await pool.execute(`
        INSERT INTO users (username, email, password_hash) VALUES 
        ('demo_user', 'demo@flowbit.com', '$2a$10$example.hash.for.demo.purposes')
      `);
      console.log('✓ Sample user created');

      // Insert sample projects
      await pool.execute(`
        INSERT INTO projects (name, description, user_id) VALUES 
        ('Personal Tasks', 'My personal task management', 1),
        ('Work Projects', 'Work-related projects and tasks', 1),
        ('Learning Goals', 'Skills and knowledge development', 1)
      `);
      console.log('✓ Sample projects created');

      // Insert sample tasks
      await pool.execute(`
        INSERT INTO tasks (title, description, status, priority, due_date, project_id, user_id) VALUES 
        ('Complete project proposal', 'Write and submit the quarterly project proposal', 'in-progress', 'high', '2024-01-15', 2, 1),
        ('Learn React hooks', 'Study and practice React hooks for state management', 'todo', 'medium', '2024-01-20', 3, 1),
        ('Review code changes', 'Code review for the authentication feature', 'completed', 'low', '2024-01-10', 2, 1),
        ('Plan weekend activities', 'Organize activities for the upcoming weekend', 'todo', 'low', '2024-01-13', 1, 1),
        ('Update documentation', 'Update API documentation with new endpoints', 'in-progress', 'medium', '2024-01-18', 2, 1)
      `);
      console.log('✓ Sample tasks created');
    } else {
      console.log('✓ Sample data already exists');
    }

    console.log('Database initialization completed successfully!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Run initialization if this file is executed directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('Database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}

export default initDatabase;
