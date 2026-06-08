import { Link } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'

interface LegalLayoutProps {
  title: string
  description: string
  lastUpdated?: string
  children: React.ReactNode
}

export function LegalLayout({ title, description, lastUpdated = 'June 2026', children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F8FBFC] font-inter text-[#32323F]">
      <Helmet>
        <title>{title} | KinetiMap</title>
        <meta name="description" content={description} />
      </Helmet>

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E0EEF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#006D77] flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <span className="font-bricolage font-bold text-xl text-[#32323F] group-hover:text-[#006D77] transition-colors">
              KinetiMap
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-[#32323F]/60 hover:text-[#006D77] transition-colors">
              Log in
            </Link>
            <Link
              to="/signup"
              className="bg-[#006D77] hover:bg-[#005560] text-white text-sm font-bold px-4 py-2 rounded-lg transition-all shadow-sm"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Page header */}
        <div className="mb-10 pb-8 border-b border-[#E0EEF0]">
          <span className="text-[#006D77] text-xs font-bold uppercase tracking-widest block mb-3">Legal</span>
          <h1 className="font-bricolage font-bold text-3xl sm:text-4xl text-[#32323F] mb-3">{title}</h1>
          <p className="text-sm text-[#32323F]/50 font-medium">Last updated: {lastUpdated}</p>
        </div>

        {/* Page body */}
        <div className="prose-legal">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E0EEF0] bg-white mt-16 py-10 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#32323F]/50 font-semibold">
          <p>© 2026 KinetiMap. A product by esemdot.</p>
          <div className="flex items-center gap-5">
            <Link to="/terms" className="hover:text-[#006D77] transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-[#006D77] transition-colors">Privacy Policy</Link>
            <Link to="/refund" className="hover:text-[#006D77] transition-colors">Refund Policy</Link>
            <a href="mailto:support@kinetimap.app" className="hover:text-[#006D77] transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      <style>{`
        .prose-legal h2 {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-weight: 700;
          font-size: 1.2rem;
          color: #32323F;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          padding-top: 1rem;
          border-top: 1px solid #E0EEF0;
        }
        .prose-legal h2:first-child {
          border-top: none;
          padding-top: 0;
          margin-top: 0;
        }
        .prose-legal p {
          color: rgba(50, 50, 63, 0.75);
          line-height: 1.8;
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }
        .prose-legal ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
          color: rgba(50, 50, 63, 0.75);
          font-size: 0.95rem;
          line-height: 1.8;
        }
        .prose-legal ul li {
          margin-bottom: 0.35rem;
        }
        .prose-legal a {
          color: #006D77;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .prose-legal a:hover {
          color: #005560;
        }
        .prose-legal strong {
          color: #32323F;
          font-weight: 700;
        }
        .prose-legal .legal-callout {
          background: #EDF6F9;
          border: 1px solid #E0EEF0;
          border-left: 3px solid #006D77;
          border-radius: 0.5rem;
          padding: 0.9rem 1.1rem;
          font-size: 0.9rem;
          color: rgba(50, 50, 63, 0.8);
          margin-bottom: 1.25rem;
        }
      `}</style>
    </div>
  )
}
