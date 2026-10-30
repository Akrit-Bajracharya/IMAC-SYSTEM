import { describe, it, expect } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { routes, getProjectsRedirectPath } from '../index.js';
import { getAdminNavItems } from '../../components/layout/AdminLayout.js';
import { getEmployeeNavItems } from '../../components/layout/EmployeeLayout.js';

describe('Web App Route Table and Navigation Integrity Tests', () => {
  // Helper to test if a path matches a real route and not the wildcard catch-all
  function matchConcreteRoute(pathname: string) {
    const matches = matchRoutes(routes, pathname);
    expect(matches, `Expected pathname "${pathname}" to match at least one route`).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(0);

    const leafMatch = matches![matches!.length - 1];
    // Must not be the catch-all '*' 404 route
    expect(leafMatch.route.path, `Route for "${pathname}" resolved to catch-all '*'` ).not.toBe('*');
    return leafMatch;
  }

  describe('1. Sidebar Navigation Links Matching', () => {
    it('every active sidebar link in AdminLayout resolves to a registered concrete route', () => {
      const navItems = getAdminNavItems(true).filter((item) => item.visible !== false);
      expect(navItems.length).toBeGreaterThan(0);

      for (const item of navItems) {
        const leaf = matchConcreteRoute(item.to);
        expect(leaf.route.element, `Sidebar link "${item.to}" has no element attached`).toBeDefined();
      }
    });

    it('every active sidebar link in EmployeeLayout resolves to a registered concrete route', () => {
      const navItems = getEmployeeNavItems().filter((item) => item.visible !== false);
      expect(navItems.length).toBeGreaterThan(0);

      for (const item of navItems) {
        const leaf = matchConcreteRoute(item.to);
        expect(leaf.route.element, `Sidebar link "${item.to}" has no element attached`).toBeDefined();
      }
    });

    it('fails if a path has no matching route and resolves to catch-all * (negative test)', () => {
      const matches = matchRoutes(routes, '/admin/non-existent-subpath-xyz');
      expect(matches).not.toBeNull();
      const leafMatch = matches![matches!.length - 1];
      expect(leafMatch.route.path).toBe('*');
    });
  });

  describe('2. Specific Required Work Log and Settings Routes', () => {
    it('resolves Daily Log, History, Export and Settings links under Admin', () => {
      matchConcreteRoute('/admin/work-log');
      matchConcreteRoute('/admin/work-log/history');
      matchConcreteRoute('/admin/work-log/export');
      matchConcreteRoute('/admin/settings');
    });

    it('resolves Daily Log, History and Export links under Employee', () => {
      matchConcreteRoute('/employee/work-log');
      matchConcreteRoute('/employee/work-log/history');
      matchConcreteRoute('/employee/work-log/export');
    });
  });

  describe('3. Projects Routes & Row Detail Navigation', () => {
    it('resolves project list and project detail page under /admin', () => {
      const listMatch = matchConcreteRoute('/admin/projects');
      expect(listMatch.route.path).toBe('projects');

      const detailMatch = matchConcreteRoute('/admin/projects/11111111-1111-4111-8111-111111111111');
      expect(detailMatch.route.path).toBe('projects/:id');
    });

    it('resolves project list and project detail page under /employee', () => {
      const listMatch = matchConcreteRoute('/employee/projects');
      expect(listMatch.route.path).toBe('projects');

      const detailMatch = matchConcreteRoute('/employee/projects/22222222-2222-4222-8222-222222222222');
      expect(detailMatch.route.path).toBe('projects/:id');
    });

    it('resolves top-level /projects and /projects/:id redirects', () => {
      const topProjects = matchConcreteRoute('/projects');
      expect(topProjects.route.path).toBe('projects');

      const topProjectDetail = matchConcreteRoute('/projects/33333333-3333-4333-8333-333333333333');
      expect(topProjectDetail.route.path).toBe('projects/:id');
    });
  });

  describe('4. Role Protection & Redirect Resolution (Amendment 3)', () => {
    it('routes system_admin to /admin/projects and other roles to /employee/projects', () => {
      expect(getProjectsRedirectPath('system_admin')).toBe('/admin/projects');
      expect(getProjectsRedirectPath('system_admin', 'proj-123')).toBe('/admin/projects/proj-123');

      expect(getProjectsRedirectPath('hr_admin')).toBe('/employee/projects');
      expect(getProjectsRedirectPath('project_manager')).toBe('/employee/projects');
      expect(getProjectsRedirectPath('employee')).toBe('/employee/projects');
      expect(getProjectsRedirectPath('viewer')).toBe('/employee/projects');

      expect(getProjectsRedirectPath('employee', 'proj-456')).toBe('/employee/projects/proj-456');
    });

    it('strictly restricts /admin branch to system_admin and hr_admin, excluding non-admins', () => {
      const rootRoute = routes.find((r) => r.path === '/');
      expect(rootRoute).toBeDefined();

      const adminRoute = rootRoute?.children?.find((r) => r.path === 'admin');
      expect(adminRoute).toBeDefined();

      const element = adminRoute?.element as any;
      const allowedRoles = element.props.allowedRoles;

      // Only system_admin and hr_admin are permitted
      expect(allowedRoles).toEqual(['system_admin', 'hr_admin']);

      // Non-admins visiting /admin/* are not in allowedRoles and therefore get UnauthorizedPage (not-allowed)
      expect(allowedRoles.includes('employee')).toBe(false);
      expect(allowedRoles.includes('project_manager')).toBe(false);
      expect(allowedRoles.includes('viewer')).toBe(false);
    });

    it('enforces allowedRoles on /employee route branch', () => {
      const rootRoute = routes.find((r) => r.path === '/');
      const employeeRoute = rootRoute?.children?.find((r) => r.path === 'employee');
      expect(employeeRoute).toBeDefined();

      const element = employeeRoute?.element as any;
      expect(element.props.allowedRoles).toEqual(['employee', 'project_manager', 'viewer']);
    });
  });
});
