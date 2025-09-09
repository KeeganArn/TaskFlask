import { hasPermission } from '../src/middleware/rbac';

describe('RBAC helpers', () => {
  test('wildcard allows everything', () => {
    expect(hasPermission(['*'], 'crm.view')).toBe(true);
    expect(hasPermission(['*'], 'anything.here')).toBe(true);
  });

  test('category wildcard allows sub-permissions', () => {
    expect(hasPermission(['crm.*'], 'crm.view')).toBe(true);
    expect(hasPermission(['crm.*'], 'crm.edit')).toBe(true);
    expect(hasPermission(['crm.*'], 'tasks.view')).toBe(false);
  });
});


