import { Helmet } from 'react-helmet-async'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Home } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 50%, #EDF6F9 0%, #E0EEF0 100%)',
      color: '#32323f', fontFamily: '"Inter", sans-serif'
    }}>
      <Helmet>
        <title>Page Not Found | KinetiMap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header style={{
        padding: '24px 40px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid rgba(0, 109, 119, 0.08)',
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(10px)'
      }}>
        <span style={{
          fontFamily: '"Bricolage Grotesque", sans-serif',
          fontSize: '20px',
          fontWeight: 700,
          color: '#006D77'
        }}>
          KinetiMap
        </span>
      </header>

      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px'
      }}>
        <section className="auth-card-in" style={{
          width: '100%',
          maxWidth: '480px',
          background: '#ffffff',
          border: '1px solid #E0EEF0',
          borderRadius: '16px',
          padding: '48px 32px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 109, 119, 0.05)'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#FEF2F2',
            color: '#C0392B',
            marginBottom: '24px'
          }}>
            <AlertTriangle size={32} />
          </div>

          <h1 style={{
            fontFamily: '"Bricolage Grotesque", sans-serif',
            fontSize: '48px',
            fontWeight: 800,
            color: '#006D77',
            margin: '0 0 12px',
            lineHeight: 1
          }}>
            404
          </h1>

          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#32323f',
            margin: '0 0 16px'
          }}>
            Page Not Found
          </h2>

          <p style={{
            fontSize: '15px',
            color: '#666',
            lineHeight: 1.6,
            margin: '0 0 32px'
          }}>
            We couldn't find the page you are looking for. It may have been moved, or the link might be broken. If this is an error, please let us know.
          </p>

          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#006D77',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background 0.2s ease, transform 0.1s ease',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#005560'; e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#006D77'; e.currentTarget.style.transform = 'scale(1)' }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.02)' }}
          >
            <Home size={16} />
            Return Home
          </Link>
        </section>
      </main>

      <footer style={{
        padding: '24px 40px',
        textAlign: 'center',
        borderTop: '1px solid rgba(0, 109, 119, 0.08)',
        background: 'rgba(255, 255, 255, 0.4)',
        fontSize: '13px',
        color: '#888'
      }}>
        © {new Date().getFullYear()} KinetiMap. All rights reserved. Registered in the UK.
      </footer>
    </div>
  )
}
