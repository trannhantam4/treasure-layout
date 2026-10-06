/**
 * Global luxury toast dispatch utility.
 * Can be called anywhere (components, hooks, async utility functions).
 */
export const toast = {
  show: (message, type = 'info', duration = 3800) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app:toast', {
          detail: {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            message: String(message || ''),
            type,
            duration,
          },
        })
      );
    }
  },
  success: (message, duration = 3800) => toast.show(message, 'success', duration),
  error: (message, duration = 4800) => toast.show(message, 'error', duration),
  info: (message, duration = 3800) => toast.show(message, 'info', duration),
  warning: (message, duration = 4200) => toast.show(message, 'warning', duration),
};

// Safety interceptor: seamlessly replaces native window.alert with luxury toast notifications
if (typeof window !== 'undefined') {
  window.alert = (message) => {
    const text = String(message || '');
    const lower = text.toLowerCase();
    if (
      lower.includes('fail') ||
      lower.includes('error') ||
      lower.includes('unauthorized') ||
      lower.includes('could not') ||
      lower.includes('issue')
    ) {
      toast.error(text);
    } else if (
      lower.includes('success') ||
      lower.includes('registered') ||
      lower.includes('joined') ||
      lower.includes('imported') ||
      lower.includes('saved') ||
      lower.includes('deleted')
    ) {
      toast.success(text);
    } else if (
      lower.includes('fill out') ||
      lower.includes('empty') ||
      lower.includes('required') ||
      lower.includes('please')
    ) {
      toast.warning(text);
    } else {
      toast.info(text);
    }
  };
}

export default toast;
