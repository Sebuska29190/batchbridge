export default function CookieBanner() {
  if (typeof window === 'undefined') return null;
  if (localStorage.getItem('cookies-accepted')) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px',
      justifyContent: 'center', flexWrap: 'wrap', fontSize: '13px',
    }}>
      <span style={{ color: 'var(--text-secondary)' }}>
        We use essential cookies only — language preference. No tracking.{' '}
        <a href="/privacy.html" style={{ color: 'var(--accent)' }}>Privacy</a>
      </span>
      <button
        onClick={() => { localStorage.setItem('cookies-accepted', '1'); window.location.reload(); }}
        style={{
          padding: '6px 18px', borderRadius: 'var(--radius-full)',
          background: 'var(--accent)', border: 'none', color: '#fff',
          fontWeight: 600, cursor: 'pointer', fontSize: '13px',
        }}
      >
        OK
      </button>
    </div>
  );
}
