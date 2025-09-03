import pool from './config';

/**
 * Fix existing users who have organization_id = NULL
 * Sets their organization_id based on their organization_members entries
 */
async function fixUserOrganizations() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Fixing user organization_id fields...');
    
    // Update users.organization_id based on their organization_members entries
    const [result] = await connection.execute(`
      UPDATE users u
      JOIN organization_members om ON u.id = om.user_id
      SET u.organization_id = om.organization_id
      WHERE u.organization_id IS NULL 
      AND om.status = 'active'
    `);
    
    console.log('Updated users:', (result as any).affectedRows);
    
    // Show the updated users
    const [updatedUsers] = await connection.execute(`
      SELECT u.id, u.email, u.username, u.organization_id, o.name as org_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.organization_id IS NOT NULL
    `);
    
    console.log('Users with organization_id set:');
    console.table(updatedUsers);
    
  } catch (error) {
    console.error('Error fixing user organizations:', error);
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  fixUserOrganizations()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export default fixUserOrganizations;
