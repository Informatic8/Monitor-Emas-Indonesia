/**
 * Sumber data harga emas (prioritas):
 * 1. emas.maulanar.my.id (jika tersedia) - dengan SELL & BUY Back
 * 2. Harga asli: goldprice.org (XAU USD/oz) + open.er-api.com (kurs USD/IDR) → IDR/gram
 * 3. Jika GOLD_API_KEY diset: GoldAPI.io
 * 4. Fallback: data mock
 */

const GRAMS_PER_TROY_OZ = 31.1035
const REFRESH_MS = 5000

/**
 * Format angka ke Rupiah Indonesia
 */
export function formatIDR(value) {
  if (value == null || Number.isNaN(value)) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Coba ambil dari emas.maulanar.my.id (prioritas pertama)
 */
async function fetchMaulanarGoldPrice(previousPrice = null) {
  const endpoints = [
    'https://www.emas.maulanar.my.id/api/gold',
    'https://www.emas.maulanar.my.id/api/price',
    'https://www.emas.maulanar.my.id/api',
    'https://emas.maulanar.my.id/api/gold',
    'https://emas.maulanar.my.id/api/price',
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      // Coba berbagai format response
      let pricePerGram = null
      let sellPrice = null
      let buyBackPrice = null
      if (data.pricePerGram || data.price_per_gram || data.harga_per_gram) {
        pricePerGram = data.pricePerGram || data.price_per_gram || data.harga_per_gram
      } else if (data.price || data.harga) {
        pricePerGram = data.price || data.harga
      } else if (Array.isArray(data) && data[0]) {
        pricePerGram = data[0].pricePerGram || data[0].price || data[0].harga
        sellPrice = data[0].sellPrice || data[0].sell_price || data[0].harga_jual
        buyBackPrice = data[0].buyBackPrice || data[0].buy_back_price || data[0].harga_beli
      }
      if (pricePerGram == null) continue
      // Jika tidak ada SELL/BUY Back, estimasi dari spread umum (SELL +2%, BUY Back -2%)
      if (sellPrice == null) sellPrice = Math.round(pricePerGram * 1.02)
      if (buyBackPrice == null) buyBackPrice = Math.round(pricePerGram * 0.98)
      return {
        pricePerGram: Math.round(pricePerGram),
        sellPrice: Math.round(sellPrice),
        buyBackPrice: Math.round(buyBackPrice),
        previousPrice: previousPrice ?? Math.round(pricePerGram),
        dailyHigh: Math.round(pricePerGram * 1.005),
        dailyLow: Math.round(pricePerGram * 0.995),
        timestamp: new Date().toISOString(),
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Harga emas real: goldprice.org (USD/oz) + kurs USD/IDR
 * Referensi: harga spot global mirip dengan platform seperti Pluang (https://pluang.com/asset/gold)
 */
async function fetchRealGoldPrice(previousPrice = null) {
  const [goldRes, rateRes] = await Promise.all([
    fetch('https://data-asg.goldprice.org/dbXRates/USD', { cache: 'no-store' }),
    fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' }),
  ])
  if (!goldRes.ok || !rateRes.ok) return null
  const gold = await goldRes.json()
  const rate = await rateRes.json()
  const xauPrice = gold?.items?.[0]?.xauPrice
  const xauClose = gold?.items?.[0]?.xauClose
  const usdToIdr = rate?.rates?.IDR
  if (xauPrice == null || usdToIdr == null) return null

  const pricePerGram = Math.round((xauPrice * usdToIdr) / GRAMS_PER_TROY_OZ)
  const prevGram = xauClose != null ? Math.round((xauClose * usdToIdr) / GRAMS_PER_TROY_OZ) : (previousPrice ?? pricePerGram)
  const dailyHigh = Math.max(pricePerGram, prevGram) + Math.round(pricePerGram * 0.002)
  const dailyLow = Math.min(pricePerGram, prevGram) - Math.round(pricePerGram * 0.002)
  // Estimasi SELL (+2%) dan BUY Back (-2%) dari harga spot
  const sellPrice = Math.round(pricePerGram * 1.02)
  const buyBackPrice = Math.round(pricePerGram * 0.98)

  return {
    pricePerGram,
    sellPrice,
    buyBackPrice,
    previousPrice: prevGram,
    dailyHigh,
    dailyLow,
    timestamp: new Date().toISOString(),
  }
}

/**
 * GoldAPI.io (jika API key ada)
 */
async function fetchGoldAPI(apiKey) {
  if (!apiKey || !apiKey.trim()) return null
  try {
    const res = await fetch('https://www.goldapi.io/api/XAU/USD', {
      headers: { 'x-access-token': apiKey } },
    )
    if (!res.ok) return null
    const data = await res.json()
    const pricePerOzUSD = data.price ?? data.close
    if (pricePerOzUSD == null) return null
    const rateRes = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
    const rate = await rateRes.json()
    const usdToIdr = rate?.rates?.IDR ?? 16800
    const pricePerGram = Math.round((pricePerOzUSD * usdToIdr) / GRAMS_PER_TROY_OZ)
    const prev = data.previous_close ?? pricePerGram
    const sellPrice = Math.round(pricePerGram * 1.02)
    const buyBackPrice = Math.round(pricePerGram * 0.98)
    return {
      pricePerGram,
      sellPrice,
      buyBackPrice,
      previousPrice: Math.round((prev * usdToIdr) / GRAMS_PER_TROY_OZ),
      dailyHigh: pricePerGram + 5000,
      dailyLow: pricePerGram - 5000,
      timestamp: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Mock (fallback jika API gagal)
 */
async function fetchMockGoldPrice(previousPrice = null) {
  await new Promise((r) => setTimeout(r, 200))
  const base = 2_900_000
  const delta = (Math.random() - 0.5) * 20000
  const pricePerGram = Math.round((previousPrice ?? base) + delta)
  const sellPrice = Math.round(pricePerGram * 1.02)
  const buyBackPrice = Math.round(pricePerGram * 0.98)
  return {
    pricePerGram,
    sellPrice,
    buyBackPrice,
    previousPrice: previousPrice ?? pricePerGram,
    dailyHigh: pricePerGram + 15000,
    dailyLow: pricePerGram - 15000,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Ambil harga emas: coba maulanar → real → GoldAPI → mock
 */
export async function fetchGoldPrice({ apiKey, previousPrice } = {}) {
  // Prioritas 1: emas.maulanar.my.id
  const maulanar = await fetchMaulanarGoldPrice(previousPrice)
  if (maulanar) return maulanar
  // Prioritas 2: GoldAPI.io (jika ada API key)
  const fromGoldAPI = apiKey || import.meta.env.VITE_GOLD_API_KEY
  if (fromGoldAPI) {
    const r = await fetchGoldAPI(fromGoldAPI)
    if (r) return r
  }
  // Prioritas 3: goldprice.org + exchangerate
  const real = await fetchRealGoldPrice(previousPrice)
  if (real) return real
  // Fallback: mock
  return fetchMockGoldPrice(previousPrice)
}

export const REFRESH_INTERVAL_MS = REFRESH_MS
