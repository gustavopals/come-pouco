const config = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--cp-color-background)',
        surface: 'var(--cp-color-surface)',
        'surface-raised': 'var(--cp-color-surface-raised)',
        foreground: 'var(--cp-color-foreground)',
        primary: 'var(--cp-color-primary)',
        'primary-foreground': 'var(--cp-color-primary-foreground)',
        'primary-soft': 'var(--cp-color-primary-soft)',
        accent: 'var(--cp-color-accent)',
        'accent-foreground': 'var(--cp-color-accent-foreground)',
        muted: 'var(--cp-color-muted)',
        'muted-foreground': 'var(--cp-color-muted-foreground)',
        border: 'var(--cp-color-border)',
        success: 'var(--cp-color-success)',
        warning: 'var(--cp-color-warning)',
        danger: 'var(--cp-color-danger)',
        info: 'var(--cp-color-info)',
        focus: 'var(--cp-color-focus)',
      },
      fontFamily: {
        sans: ['var(--cp-font-family-sans)'],
        mono: ['var(--cp-font-family-mono)'],
      },
      spacing: {
        0: 'var(--cp-space-0)',
        1: 'var(--cp-space-1)',
        2: 'var(--cp-space-2)',
        3: 'var(--cp-space-3)',
        4: 'var(--cp-space-4)',
        6: 'var(--cp-space-6)',
        8: 'var(--cp-space-8)',
        12: 'var(--cp-space-12)',
        16: 'var(--cp-space-16)',
        24: 'var(--cp-space-24)',
      },
      borderRadius: {
        sm: 'var(--cp-radius-sm)',
        md: 'var(--cp-radius-md)',
        lg: 'var(--cp-radius-lg)',
        full: 'var(--cp-radius-full)',
      },
      boxShadow: {
        sm: 'var(--cp-shadow-sm)',
        md: 'var(--cp-shadow-md)',
        lg: 'var(--cp-shadow-lg)',
        xl: 'var(--cp-shadow-xl)',
      },
      transitionDuration: {
        instant: 'var(--cp-duration-instant)',
        short: 'var(--cp-duration-short)',
        medium: 'var(--cp-duration-medium)',
        long: 'var(--cp-duration-long)',
      },
      transitionTimingFunction: {
        standard: 'var(--cp-ease-standard)',
        emphasized: 'var(--cp-ease-emphasized)',
        exit: 'var(--cp-ease-exit)',
      },
      maxWidth: {
        content: 'var(--cp-layout-content-max)',
      },
      width: {
        sidebar: 'var(--cp-layout-sidebar-width)',
        rail: 'var(--cp-layout-sidebar-rail)',
      },
      height: {
        topbar: 'var(--cp-layout-topbar-height)',
      },
    },
  },
};

module.exports = config;
