/**
 * Minimal custom document so Next.js generates .next/server/pages/_document.js.
 * Required for error overlay when using App Router. See Next.js custom document docs.
 */
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
