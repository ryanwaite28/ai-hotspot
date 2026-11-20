import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'HotSpot',
  description: 'Intentional, chronological social media',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <header className="site-header">
          <strong aria-label="HotSpot home">HotSpot</strong>
          <nav aria-label="Primary navigation">
            <a href="/">Home</a>
            <a href="/compose">Compose</a>
            <a href="/media">Media</a>
            <a href="/stories">Stories</a>
            <a href="/subscriptions">Subscriptions</a>
            <a href="/campaigns">Campaigns</a>
            <a href="/live">Live</a>
            <a href="/settings">Settings</a>
          </nav>
        </header>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
