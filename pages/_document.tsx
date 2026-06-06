// pages/_document.tsx
// Inline pre-hydration script: read the stored theme and apply the `dark`
// class to <html> before first paint to avoid a flash of unstyled content.
import { Html, Head, Main, NextScript } from 'next/document'

const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('op-rewrite-theme');
    var theme = stored || 'system';
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    var root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.colorScheme = resolved;
  } catch (e) {
    /* localStorage unavailable — fall back to system */
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  }
})();
`.trim()

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head />
      <body>
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
