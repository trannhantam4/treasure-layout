/**
 * Centralized role-based authorization helpers.
 * Replaces inline `user?.role === 'admin' || user?.role === 'manager'` checks
 * duplicated across App.jsx, Admin.jsx, BrandManager.jsx, Events.jsx, Navigation.jsx, EventDetail.jsx.
 */
export const canManage = (user) => {
  const role = user?.role?.toLowerCase();
  return role === 'admin' || role === 'manager';
};
