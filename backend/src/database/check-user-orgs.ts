import pool from './config';

/**
 * Check the current state of users and their organization assignments
 */
async function checkUserOrganizations() {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== CHECKING USER ORGANIZATION ASSIGNMENTS ===\n');
    
    // Show all users and their organization_id
    console.log('1. Users table organization_id field:');
    const [users] = await connection.execute(`
      SELECT id, email, username, organization_id, user_status
      FROM users 
      ORDER BY id
    `);
    console.table(users);
    
    // Show organization_members table
    console.log('\n2. Organization members table:');
    const [members] = await connection.execute(`
      SELECT om.id, om.user_id, om.organization_id, om.status, 
             u.email, o.name as org_name
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      JOIN organizations o ON om.organization_id = o.id
      ORDER BY om.id
    `);
    console.table(members);
    
    // Show users with missing organization_id
    console.log('\n3. Users with NULL organization_id:');
    const [nullOrgUsers] = await connection.execute(`
      SELECT u.id, u.email, u.username, u.organization_id,
             COUNT(om.id) as membership_count
      FROM users u
      LEFT JOIN organization_members om ON u.id = om.user_id AND om.status = 'active'
      WHERE u.organization_id IS NULL
      GROUP BY u.id
    `);
    
    if ((nullOrgUsers as any[]).length > 0) {
      console.table(nullOrgUsers);
      console.log('\n⚠️  Found users with NULL organization_id!');
    } else {
      console.log('✅ All users have organization_id set');
    }
    
    // Show organizations
    console.log('\n4. Organizations:');
    const [orgs] = await connection.execute(`
      SELECT id, name, slug, invite_code, 
             (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count,
             (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND status = 'active') as member_count
      FROM organizations o
      ORDER BY id
    `);
    console.table(orgs);
    
  } catch (error) {
    console.error('Error checking user organizations:', error);
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  checkUserOrganizations()
    .then(() => {
      console.log('\n=== CHECK COMPLETE ===');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export default checkUserOrganizations;
