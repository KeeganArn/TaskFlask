import { pool } from './config';

/**
 * Database Migration Script - V1 to V2
 * Migrates from single-tenant to multi-tenant with RBAC
 */

interface MigrationStep {
  name: string;
  query: string;
  rollback?: string;
}

const migrationSteps: MigrationStep[] = [
  {
    name: 'Create organizations table',
    query: `
      CREATE TABLE IF NOT EXISTS organizations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        logo_url VARCHAR(255),
        invite_code VARCHAR(20) UNIQUE NOT NULL,
        invite_code_enabled BOOLEAN DEFAULT TRUE,
        subscription_plan ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
        max_users INT DEFAULT 5,
        max_projects INT DEFAULT 10,
        settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `,
    rollback: 'DROP TABLE IF EXISTS organizations'
  },
  
  {
    name: 'Create roles table',
    query: `
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions JSON,
        is_system_role BOOLEAN DEFAULT FALSE,
        organization_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        UNIQUE KEY unique_role_per_org (name, organization_id)
      )
    `,
    rollback: 'DROP TABLE IF EXISTS roles'
  },

  {
    name: 'Insert default system roles',
    query: `
      INSERT INTO roles (name, display_name, description, permissions, is_system_role, organization_id) VALUES
      ('org_owner', 'Organization Owner', 'Full access within organization', '["org.*", "projects.*", "tasks.*", "users.*", "settings.*"]', TRUE, NULL),
      ('org_admin', 'Organization Admin', 'Administrative access within organization', '["projects.*", "tasks.*", "users.view", "users.invite", "settings.view"]', TRUE, NULL),
      ('project_manager', 'Project Manager', 'Manage projects and teams', '["projects.view", "projects.edit", "projects.create", "tasks.*", "users.view"]', TRUE, NULL),
      ('team_lead', 'Team Lead', 'Lead team members and manage assigned projects', '["projects.view", "projects.edit", "tasks.*", "users.view"]', TRUE, NULL),
      ('developer', 'Developer', 'Work on tasks and projects', '["projects.view", "tasks.view", "tasks.edit", "tasks.create", "tasks.comment"]', TRUE, NULL),
      ('viewer', 'Viewer', 'Read-only access to assigned projects', '["projects.view", "tasks.view"]', TRUE, NULL)
    `
  },

  {
    name: 'Create default organization for existing data',
    query: `
      INSERT INTO organizations (name, slug, invite_code, description, subscription_plan, max_users, max_projects)
      VALUES ('Default Organization', 'default', 'DEF-0001', 'Migrated from single-tenant setup', 'premium', 999, 999)
    `
  },

  {
    name: 'Backup existing users table',
    query: `
      CREATE TABLE users_backup AS SELECT * FROM users
    `,
    rollback: 'DROP TABLE IF EXISTS users_backup'
  },

  {
    name: 'Add new columns to users table',
    query: `
      ALTER TABLE users
      ADD COLUMN first_name VARCHAR(50) AFTER password_hash,
      ADD COLUMN last_name VARCHAR(50) AFTER first_name,
      ADD COLUMN avatar_url VARCHAR(255) AFTER last_name,
      ADD COLUMN phone VARCHAR(20) AFTER avatar_url,
      ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC' AFTER phone,
      ADD COLUMN language VARCHAR(10) DEFAULT 'en' AFTER timezone,
      ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER language,
      ADD COLUMN email_verified BOOLEAN DEFAULT TRUE AFTER is_active,
      ADD COLUMN email_verification_token VARCHAR(255) AFTER email_verified,
      ADD COLUMN password_reset_token VARCHAR(255) AFTER email_verification_token,
      ADD COLUMN password_reset_expires TIMESTAMP NULL AFTER password_reset_token,
      ADD COLUMN last_login TIMESTAMP NULL AFTER password_reset_expires,
      ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
    `
  },

  {
    name: 'Create organization_members table',
    query: `
      CREATE TABLE IF NOT EXISTS organization_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        user_id INT NOT NULL,
        role_id INT NOT NULL,
        invited_by INT,
        invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'active', 'suspended', 'left') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
        FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_per_org (organization_id, user_id)
      )
    `,
    rollback: 'DROP TABLE IF EXISTS organization_members'
  },

  {
    name: 'Migrate existing users to default organization as owners',
    query: `
      INSERT INTO organization_members (organization_id, user_id, role_id, joined_at, status)
      SELECT 1, u.id, r.id, u.created_at, 'active'
      FROM users u
      CROSS JOIN roles r
      WHERE r.name = 'org_owner' AND r.is_system_role = TRUE
    `
  },

  {
    name: 'Backup existing projects table',
    query: `
      CREATE TABLE projects_backup AS SELECT * FROM projects
    `,
    rollback: 'DROP TABLE IF EXISTS projects_backup'
  },

  {
    name: 'Add new columns to projects table',
    query: `
      ALTER TABLE projects
      ADD COLUMN organization_id INT NOT NULL DEFAULT 1 AFTER description,
      ADD COLUMN owner_id INT NOT NULL AFTER organization_id,
      ADD COLUMN status ENUM('active', 'archived', 'completed') DEFAULT 'active' AFTER owner_id,
      ADD COLUMN priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium' AFTER status,
      ADD COLUMN start_date DATE AFTER priority,
      ADD COLUMN end_date DATE AFTER start_date,
      ADD COLUMN budget DECIMAL(10,2) AFTER end_date,
      ADD COLUMN color_code VARCHAR(7) AFTER budget,
      ADD COLUMN settings JSON AFTER color_code,
      ADD FOREIGN KEY fk_projects_organization (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      ADD FOREIGN KEY fk_projects_owner (owner_id) REFERENCES users(id) ON DELETE RESTRICT
    `
  },

  {
    name: 'Set project owners based on existing user_id',
    query: `
      UPDATE projects SET owner_id = user_id WHERE user_id IS NOT NULL
    `
  },

  {
    name: 'Remove old user_id column from projects',
    query: `
      ALTER TABLE projects DROP COLUMN user_id
    `
  },

  {
    name: 'Create project_members table',
    query: `
      CREATE TABLE IF NOT EXISTS project_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('viewer', 'contributor', 'manager') DEFAULT 'manager',
        permissions JSON,
        added_by INT,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_per_project (project_id, user_id)
      )
    `,
    rollback: 'DROP TABLE IF EXISTS project_members'
  },

  {
    name: 'Add project owners as managers',
    query: `
      INSERT INTO project_members (project_id, user_id, role, added_at)
      SELECT id, owner_id, 'manager', created_at FROM projects
    `
  },

  {
    name: 'Backup existing tasks table',
    query: `
      CREATE TABLE tasks_backup AS SELECT * FROM tasks
    `,
    rollback: 'DROP TABLE IF EXISTS tasks_backup'
  },

  {
    name: 'Add new columns to tasks table and update structure',
    query: `
      ALTER TABLE tasks
      ADD COLUMN organization_id INT NOT NULL DEFAULT 1 AFTER project_id,
      ADD COLUMN assignee_id INT AFTER organization_id,
      ADD COLUMN reporter_id INT NOT NULL AFTER assignee_id,
      ADD COLUMN parent_task_id INT AFTER reporter_id,
      ADD COLUMN sprint_id INT AFTER parent_task_id,
      ADD COLUMN start_date DATE AFTER due_date,
      ADD COLUMN estimated_hours DECIMAL(5,2) AFTER start_date,
      ADD COLUMN actual_hours DECIMAL(5,2) AFTER estimated_hours,
      ADD COLUMN progress_percentage INT DEFAULT 0 AFTER actual_hours,
      ADD COLUMN labels JSON AFTER progress_percentage,
      ADD COLUMN attachments JSON AFTER labels,
      MODIFY COLUMN status ENUM('backlog', 'todo', 'in-progress', 'review', 'completed', 'cancelled') DEFAULT 'todo',
      MODIFY COLUMN priority ENUM('lowest', 'low', 'medium', 'high', 'highest') DEFAULT 'medium',
      ADD FOREIGN KEY fk_tasks_organization (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      ADD FOREIGN KEY fk_tasks_assignee (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
      ADD FOREIGN KEY fk_tasks_reporter (reporter_id) REFERENCES users(id) ON DELETE RESTRICT,
      ADD FOREIGN KEY fk_tasks_parent (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    `
  },

  {
    name: 'Set task reporters based on existing user_id',
    query: `
      UPDATE tasks SET reporter_id = user_id, assignee_id = user_id WHERE user_id IS NOT NULL
    `
  },

  {
    name: 'Remove old user_id column from tasks',
    query: `
      ALTER TABLE tasks DROP COLUMN user_id
    `
  },

  {
    name: 'Create additional tables for enhanced functionality',
    query: `
      CREATE TABLE IF NOT EXISTS task_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT,
        comment_type ENUM('comment', 'status_change', 'assignment', 'attachment') DEFAULT 'comment',
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS time_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        description TEXT,
        hours DECIMAL(5,2) NOT NULL,
        date_logged DATE NOT NULL,
        is_billable BOOLEAN DEFAULT FALSE,
        hourly_rate DECIMAL(8,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS invitations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        organization_id INT NOT NULL,
        role_id INT NOT NULL,
        invited_by INT NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
      );
    `
  },

  {
    name: 'Create performance indexes',
    query: `
      CREATE INDEX idx_organizations_slug ON organizations(slug);
      CREATE INDEX idx_users_email_verification ON users(email_verification_token);
      CREATE INDEX idx_users_password_reset ON users(password_reset_token);
      CREATE INDEX idx_org_members_org_user ON organization_members(organization_id, user_id);
      CREATE INDEX idx_org_members_user ON organization_members(user_id);
      CREATE INDEX idx_org_members_status ON organization_members(status);
      CREATE INDEX idx_projects_organization ON projects(organization_id);
      CREATE INDEX idx_projects_owner ON projects(owner_id);
      CREATE INDEX idx_projects_status ON projects(status);
      CREATE INDEX idx_project_members_project ON project_members(project_id);
      CREATE INDEX idx_project_members_user ON project_members(user_id);
      CREATE INDEX idx_tasks_organization ON tasks(organization_id);
      CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
      CREATE INDEX idx_tasks_reporter ON tasks(reporter_id);
      CREATE INDEX idx_task_comments_task ON task_comments(task_id);
      CREATE INDEX idx_time_entries_task ON time_entries(task_id);
      CREATE INDEX idx_time_entries_user ON time_entries(user_id);
      CREATE INDEX idx_time_entries_date ON time_entries(date_logged);
      CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
      CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
      CREATE INDEX idx_invitations_token ON invitations(token);
      CREATE INDEX idx_invitations_email ON invitations(email);
    `
  }
];

export const runMigration = async (): Promise<void> => {
  console.log('🚀 Starting database migration from V1 to V2...');
  
  // Start transaction
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    // Check if migration has already been run
    const [existing] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'organizations'"
    );
    
    if ((existing as any[])[0].count > 0) {
      console.log('⚠️  Migration appears to have already been run. Skipping...');
      await connection.rollback();
      connection.release();
      return;
    }

    // Execute each migration step
    for (let i = 0; i < migrationSteps.length; i++) {
      const step = migrationSteps[i];
      console.log(`📝 Step ${i + 1}/${migrationSteps.length}: ${step.name}`);
      
      try {
        await connection.execute(step.query);
        console.log(`✅ Completed: ${step.name}`);
      } catch (error) {
        console.error(`❌ Failed: ${step.name}`, error);
        throw error;
      }
    }

    // Commit transaction
    await connection.commit();
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    // Rollback on error
    await connection.rollback();
    console.error('💥 Migration failed, rolling back...', error);
    throw error;
  } finally {
    connection.release();
  }
};

export const rollbackMigration = async (): Promise<void> => {
  console.log('🔄 Rolling back migration...');
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    // Restore from backups and drop new tables
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop new tables
    await connection.execute('DROP TABLE IF EXISTS invitations');
    await connection.execute('DROP TABLE IF EXISTS audit_logs');
    await connection.execute('DROP TABLE IF EXISTS time_entries');
    await connection.execute('DROP TABLE IF EXISTS task_comments');
    await connection.execute('DROP TABLE IF EXISTS project_members');
    await connection.execute('DROP TABLE IF EXISTS organization_members');
    
    // Restore original tables
    await connection.execute('DROP TABLE IF EXISTS tasks');
    await connection.execute('DROP TABLE IF EXISTS projects');
    await connection.execute('DROP TABLE IF EXISTS users');
    
    await connection.execute('RENAME TABLE tasks_backup TO tasks');
    await connection.execute('RENAME TABLE projects_backup TO projects');
    await connection.execute('RENAME TABLE users_backup TO users');
    
    // Drop new tables
    await connection.execute('DROP TABLE IF EXISTS roles');
    await connection.execute('DROP TABLE IF EXISTS organizations');
    
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    await connection.commit();
    console.log('✅ Rollback completed successfully!');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    connection.release();
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    rollbackMigration()
      .then(() => {
        console.log('Rollback completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Rollback failed:', error);
        process.exit(1);
      });
  } else {
    runMigration()
      .then(() => {
        console.log('Migration completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  }
}
