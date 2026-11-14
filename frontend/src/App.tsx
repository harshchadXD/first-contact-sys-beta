export default function App() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#050608',
        color: '#E2E8F0',
        fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: '#0B0F17',
          border: '1px solid #1E293B',
          borderRadius: '8px',
          padding: '3rem 2.5rem',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            color: '#38BDF8',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '1.5rem',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#38BDF8',
              display: 'inline-block',
            }}
          />
          System Ready
        </div>

        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginBottom: '0.5rem',
            color: '#E2E8F0',
          }}
        >
          First Contact<span style={{ color: '#38BDF8' }}>.sys</span>
        </h1>

        <p
          style={{
            fontSize: '1rem',
            color: '#FACC15',
            fontWeight: 500,
            letterSpacing: '0.04em',
            marginBottom: '1.5rem',
          }}
        >
          Lunar landing-site explorer
        </p>

        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1E293B',
            borderRadius: '6px',
            padding: '1rem',
            color: '#94A3B8',
            fontSize: '0.875rem',
            letterSpacing: '0.02em',
          }}
        >
          Project initialized. No scientific data loaded.
        </div>
      </div>
    </main>
  )
}
