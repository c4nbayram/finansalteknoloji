export type MarketTabId = 'abd' | 'kripto' | 'emtia' | 'doviz'

export type InstrumentConfig = {
  id: string
  symbol: string
  providerSymbol: string
  label: string
  market: MarketTabId
  sector: string
  exchange?: string
}

export const marketTabs: Array<{ id: MarketTabId; label: string }> = [
  { id: 'abd', label: 'ABD' },
  { id: 'kripto', label: 'Kripto' },
  { id: 'emtia', label: 'Emtia' },
  { id: 'doviz', label: 'Döviz' },
]

export const instruments: InstrumentConfig[] = [
  {
    id: 'aapl',
    symbol: 'AAPL',
    providerSymbol: 'AAPL',
    label: 'Apple',
    market: 'abd',
    sector: 'Teknoloji',
    exchange: 'NASDAQ',
  },
  {
    id: 'msft',
    symbol: 'MSFT',
    providerSymbol: 'MSFT',
    label: 'Microsoft',
    market: 'abd',
    sector: 'Teknoloji',
    exchange: 'NASDAQ',
  },
  {
    id: 'nvda',
    symbol: 'NVDA',
    providerSymbol: 'NVDA',
    label: 'NVIDIA',
    market: 'abd',
    sector: 'Yarı iletken',
    exchange: 'NASDAQ',
  },
  {
    id: 'tsla',
    symbol: 'TSLA',
    providerSymbol: 'TSLA',
    label: 'Tesla',
    market: 'abd',
    sector: 'Otomotiv',
    exchange: 'NASDAQ',
  },
  {
    id: 'btcusd',
    symbol: 'BTC/USD',
    providerSymbol: 'BTC/USD',
    label: 'Bitcoin',
    market: 'kripto',
    sector: 'Kripto',
  },
  {
    id: 'ethusd',
    symbol: 'ETH/USD',
    providerSymbol: 'ETH/USD',
    label: 'Ethereum',
    market: 'kripto',
    sector: 'Kripto',
  },
  {
    id: 'solusd',
    symbol: 'SOL/USD',
    providerSymbol: 'SOL/USD',
    label: 'Solana',
    market: 'kripto',
    sector: 'Kripto',
  },
  {
    id: 'bnbusd',
    symbol: 'BNB/USD',
    providerSymbol: 'BNB/USD',
    label: 'BNB',
    market: 'kripto',
    sector: 'Kripto',
  },
  {
    id: 'xauusd',
    symbol: 'XAU/USD',
    providerSymbol: 'XAU/USD',
    label: 'Altın',
    market: 'emtia',
    sector: 'Kıymetli Metal',
  },
  {
    id: 'xagusd',
    symbol: 'XAG/USD',
    providerSymbol: 'XAG/USD',
    label: 'Gümüş',
    market: 'emtia',
    sector: 'Kıymetli Metal',
  },
  {
    id: 'usdtry',
    symbol: 'USD/TRY',
    providerSymbol: 'USD/TRY',
    label: 'Dolar / TL',
    market: 'doviz',
    sector: 'FX',
  },
  {
    id: 'eurtry',
    symbol: 'EUR/TRY',
    providerSymbol: 'EUR/TRY',
    label: 'Euro / TL',
    market: 'doviz',
    sector: 'FX',
  },
  {
    id: 'gbptry',
    symbol: 'GBP/TRY',
    providerSymbol: 'GBP/TRY',
    label: 'Sterlin / TL',
    market: 'doviz',
    sector: 'FX',
  },
]
