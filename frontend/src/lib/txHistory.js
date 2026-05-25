const STORAGE_KEY = 'bb-tx-history'

export function loadTxHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveTxEntry(entry) {
  const history = loadTxHistory()
  history.unshift({
    id: Date.now().toString(36),
    timestamp: new Date().toISOString(),
    ...entry,
  })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)))
  } catch {}
}

export function clearTxHistory() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

export function updateTxStatus(id, status, txHash) {
  const history = loadTxHistory()
  const idx = history.findIndex(e => e.id === id)
  if (idx !== -1) {
    history[idx].status = status
    if (txHash) history[idx].txHash = txHash
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50))) } catch {}
  }
}
