import { useState } from 'react';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
}

export function TokenModal({
  tokens,
  selected,
  onSelect,
  onClose,
  title,
}: {
  tokens: Token[];
  selected: Token | null;
  onSelect: (token: Token) => void;
  onClose: () => void;
  title: string;
}) {
  const [search, setSearch] = useState('');

  const filtered = tokens.filter(t =>
    !search || t.symbol.toLowerCase().includes(search.toLowerCase())
    || t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="overlay-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        <input
          type="text"
          placeholder="Search token..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: '14px', outline: 'none', marginBottom: '8px',
          }}
        />

        <div style={{ overflowY: 'auto', flex: 1, maxHeight: '400px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No tokens found</div>
          ) : filtered.map(token => (
            <button
              key={token.address}
              onClick={() => onSelect(token)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 8px', background: selected?.address === token.address ? 'var(--accent-bg)' : 'transparent',
                border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--text)', cursor: 'pointer',
                transition: 'all 0.1s', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = selected?.address === token.address ? 'var(--accent-bg)' : 'transparent')}
            >
              <img src={token.logo} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{token.symbol}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
