import { useState, useEffect } from 'react'
import { loadTxHistory, clearTxHistory } from '../lib/txHistory'
import { t } from '../i18n'

const statusIcons = {
  pending: '⏳',
  success: '✅',
  failed: '❌',
  cancelled: '🚫',
}

export default function TxHistory({ visible, onClose, triggerRefresh }) {
  const [history, setHistory] = useState([])
  const [showClear, setShowClear] = useState(false)

  useEffect(() => {
    if (visible) setHistory(loadTxHistory())
  }, [visible, triggerRefresh])

  if (!visible) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('history.title')}</h3>
          <div className="modal-actions">
            {history.length > 0 && (
              <button className="btn-text" onClick={() => setShowClear(true)}>{t('history.clear')}</button>
            )}
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        {showClear && (
          <div className="modal-confirm">
            <p>Clear all transaction history?</p>
            <div className="confirm-btns">
              <button className="btn-sm-outline" onClick={() => setShowClear(false)}>Cancel</button>
              <button className="btn-sm-danger" onClick={() => { clearTxHistory(); setHistory([]); setShowClear(false) }}>Clear</button>
            </div>
          </div>
        )}

        <div className="modal-body">
          {history.length === 0 ? (
            <div className="modal-empty">{t('history.empty')}</div>
          ) : (
            <div className="tx-list">
              {history.map(tx => (
                <div key={tx.id} className={`tx-row ${tx.status}`}>
                  <div className="tx-icon">{statusIcons[tx.status] || '❓'}</div>
                  <div className="tx-info">
                    <div className="tx-desc">{tx.description || `${tx.sourceTokens?.length || 0} tokens → ${tx.outputToken || '?'}`}</div>
                    <div className="tx-meta">
                      <span className={`tx-status ${tx.status}`}>{t(`history.${tx.status}`)}</span>
                      <span className="tx-time">{new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {tx.sourceChain && tx.destChain && (
                      <div className="tx-chains">{t('history.from')} {tx.sourceChain} → {t('history.to')} {tx.destChain}</div>
                    )}
                    {tx.txHash && (
                      <div className="tx-hash" title={tx.txHash}>{tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
