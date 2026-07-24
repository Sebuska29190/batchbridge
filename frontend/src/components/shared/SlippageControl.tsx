interface Props {
  value: number
  customValue: string
  onChange: (val: number) => void
  onCustomChange: (val: string) => void
}

const PRESETS = [
  { label: '0.1%', value: 0.1 },
  { label: '0.5%', value: 0.5 },
  { label: '1.0%', value: 1.0 },
]

export default function SlippageControl({ value, customValue, onChange, onCustomChange }: Props) {
  return (
    <div className="slippage-control">
      <span className="slippage-label">Slippage</span>
      <div className="slippage-options">
        {PRESETS.map(p => (
          <button
            key={p.value}
            className={`slippage-btn ${value === p.value && !customValue ? 'active' : ''}`}
            onClick={() => { onChange(p.value); onCustomChange('') }}
          >
            {p.label}
          </button>
        ))}
        <div className="slippage-custom">
          <input
            type="number"
            placeholder="Custom"
            value={customValue}
            onChange={e => {
              onCustomChange(e.target.value)
              const parsed = parseFloat(e.target.value)
              if (Number.isFinite(parsed) && parsed > 0) onChange(Math.min(Math.max(parsed, 0.01), 50))
            }}
            min="0.01"
            max="50"
            step="0.1"
          />
          <span>%</span>
        </div>
      </div>
    </div>
  )
}
