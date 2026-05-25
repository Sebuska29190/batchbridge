const pl = {
  nav: { connect: 'Połącz Portfel', chain: 'Sieć', disconnect: 'Rozłącz' },
  hero: { badge: 'Transakcje Grupowe', title: 'Bridge\'uj tokeny\npomiędzy chainami', subtitle: 'Wybierz wiele tokenów i bridge\'uj je w jednej transakcji EIP-5792', cta: 'Rozpocznij' },
  chains: { from: 'Z', to: 'Do' },
  tokens: { receive: 'Odbierz Jako', select: 'Wybierz Tokeny', refresh: 'Odśwież', loading: 'Ładowanie tokenów...', empty: 'Nie znaleziono tokenów na', noRoute: 'Brak trasy', addOutput: 'Dodaj token (0x...)', addSource: 'Dodaj token z adresu (0x...)', selected: 'wybranych', selectOutputFirst: 'Najpierw wybierz token docelowy', maxBatch: 'Maksymalnie 10 tokenów na partię', noTokensFound: 'Nie znaleziono zweryfikowanych tokenów' },
  slippage: { label: 'Tolerancja Poślizgu', custom: 'Własna' },
  quote: { receive: 'Otrzymujesz', netFee: 'Opłata sieciowa', relayFee: 'Opłata Relay', total: 'Łączne opłaty', estTime: 'Szacowany czas', route: 'Trasa', getQuote: 'Pobierz Wycenę', gettingQuote: 'Pobieranie wyceny...', bridge: 'Bridge\'uj', bridging: 'Bridge\'owanie...', ready: 'Wycena gotowa' },
  status: { processing: 'Przetwarzanie', complete: 'Bridge zakończony', again: 'Bridge\'uj ponownie', close: 'Zamknij' },
  history: { title: 'Historia Transakcji', empty: 'Brak transakcji', pending: 'Oczekująca', success: 'Udana', failed: 'Nieudana', from: 'Z', to: 'Do', clear: 'Wyczyść historię', cleared: 'Historia wyczyszczona' },
  advanced: { title: 'Tryb Zaawansowany', gasLimit: 'Limit Gazu', deadline: 'Deadline (min)', fallbacks: 'Korzystaj z fallbacków', extLiquidity: 'Zewnętrzna płynność' },
  search: { title: 'Szukaj tokena', placeholder: 'Szukaj po nazwie lub symbolu...', notFound: 'Nie znaleziono' },
  errors: { connectWallet: 'Najpierw połącz portfel', failed: 'Operacja nieudana', tryAgain: 'Spróbuj ponownie' },
  footer: 'Niekustodialny interfejs bridge. Wszystkie transakcje wykonywane przez zdecentralizowane protokoły.',
}

const en = {
  nav: { connect: 'Connect Wallet', chain: 'Chain', disconnect: 'Disconnect' },
  hero: { badge: 'Batch Transactions', title: 'Bridge tokens\nacross chains', subtitle: 'Select multiple tokens and bridge them in a single EIP-5792 transaction', cta: 'Start Bridging' },
  chains: { from: 'From', to: 'To' },
  tokens: { receive: 'Receive As', select: 'Select Tokens', refresh: 'Refresh', loading: 'Loading tokens...', empty: 'No tokens found on', noRoute: 'No route', addOutput: 'Add custom token (0x...)', addSource: 'Add token by address (0x...)', selected: 'selected', selectOutputFirst: 'Select output token first', maxBatch: 'Maximum 10 tokens per batch', noTokensFound: 'No verified tokens found' },
  slippage: { label: 'Slippage Tolerance', custom: 'Custom' },
  quote: { receive: 'You receive', netFee: 'Network fee', relayFee: 'Relay fee', total: 'Total fees', estTime: 'Est. time', route: 'Route', getQuote: 'Get Quote', gettingQuote: 'Getting Quote...', bridge: 'Bridge', bridging: 'Bridging...', ready: 'Quote ready' },
  status: { processing: 'Processing', complete: 'Bridge complete', again: 'Bridge again', close: 'Close' },
  history: { title: 'Transaction History', empty: 'No transactions yet', pending: 'Pending', success: 'Success', failed: 'Failed', from: 'From', to: 'To', clear: 'Clear history', cleared: 'History cleared' },
  advanced: { title: 'Advanced Mode', gasLimit: 'Gas Limit', deadline: 'Deadline (min)', fallbacks: 'Use fallbacks', extLiquidity: 'External liquidity' },
  search: { title: 'Search token', placeholder: 'Search by name or symbol...', notFound: 'Not found' },
  errors: { connectWallet: 'Connect wallet first', failed: 'Operation failed', tryAgain: 'Try again' },
  footer: 'Non-custodial Bridge Interface. All transactions are executed via decentralized protocols.',
}

const translations = { pl, en }
let currentLocale = 'en'

export function setLocale(locale) {
  currentLocale = locale
  if (typeof window !== 'undefined') {
    localStorage.setItem('bb-locale', locale)
  }
}

export function getLocale() {
  return currentLocale
}

export function initLocale() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('bb-locale')
    if (saved && translations[saved]) currentLocale = saved
  }
}

export function t(path) {
  const keys = path.split('.')
  let value = translations[currentLocale]
  for (const key of keys) {
    if (value) value = value[key]
  }
  return value || path
}

export { translations }
