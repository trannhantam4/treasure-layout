/**
 * Global confirmation dialog utility.
 * Dispatches an event that mounts the luxury ConfirmModal dialog and returns a Promise<boolean>.
 * 
 * Also intercepts native `window.confirm(message)` so any legacy or external confirmation
 * automatically uses this styled dialog asynchronously when awaited, or via confirmDialog().
 */

export const confirmDialog = (options) => {
  if (typeof window === 'undefined') return Promise.resolve(false);

  const config = typeof options === 'string'
    ? { message: options }
    : (options || {});

  return new Promise((resolve) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    window.dispatchEvent(
      new CustomEvent('app:confirm', {
        detail: {
          id,
          title: config.title || 'PLEASE CONFIRM',
          message: config.message || 'Are you sure you want to proceed?',
          confirmText: config.confirmText || 'Confirm',
          cancelText: config.cancelText || 'Cancel',
          confirmVariant: config.confirmVariant || 'danger', // 'danger' | 'primary' | 'warning'
          icon: config.icon || '⚠️',
          resolve,
        },
      })
    );
  });
};

// Fallback/alias
export default confirmDialog;
