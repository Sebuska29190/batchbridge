import { rubicAggregator } from './rubic'
import { lifiAggregator } from './lifi'
import { relayAggregator } from './relay'
import { paraswapAggregator } from './paraswap'
import type { Aggregator } from './types'

export type { Aggregator, Quote, QuoteRequest, QuoteStep } from './types'
export { rubicAggregator, lifiAggregator, relayAggregator, paraswapAggregator }

/** All aggregators, in no particular order — the quote engine filters and ranks them per request. */
export const ALL_AGGREGATORS: Aggregator[] = [
  rubicAggregator,
  lifiAggregator,
  relayAggregator,
  paraswapAggregator,
]
