const env = import.meta.env

const marketProvider = (env.VITE_MARKET_DATA_PROVIDER ?? 'twelvedata').trim()
const marketDataEnabled = Boolean(env.VITE_MARKET_DATA_API_KEY?.trim())
const marketDataStatus: 'ok' | 'missing_key' = marketDataEnabled ? 'ok' : 'missing_key'

const openAiKey = (env.VITE_OPENAI_API_KEY ?? '').trim()
const openAiModel = (env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini').trim()
const openAiAvailable = openAiKey.length > 0

export const integrationConfig = {
  marketProvider,
  marketDataEnabled,
  marketDataStatus,
  marketDataStatusLabel: marketDataEnabled
    ? 'Canlı veri aktif'
    : 'Canlı veri hazırlığı',
  openAiKey,
  openAiModel,
  openAiAvailable,
  openAiStatusLabel: openAiAvailable ? 'OpenAI bağlı' : 'OpenAI anahtarı yok',
}
