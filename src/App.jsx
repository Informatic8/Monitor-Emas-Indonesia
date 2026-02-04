import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { Gem, ArrowUp, ArrowDown, Clock, TrendingUp, TrendingDown, Calculator, LineChart as LineChartIcon, Download, ShoppingCart, ArrowLeftRight } from 'lucide-react'
import { fetchGoldPrice, formatIDR, REFRESH_INTERVAL_MS } from './lib/goldPrice'

const MAX_POINTS_RENDER = 180

/** Downsample agar render grafik tetap cepat (max MAX_POINTS_RENDER titik) */
function downsampleForChart(data) {
  if (!data || data.length <= MAX_POINTS_RENDER) return data ?? []
  const out = []
  const step = (data.length - 1) / (MAX_POINTS_RENDER - 1)
  for (let i = 0; i < MAX_POINTS_RENDER; i++) {
    const idx = i === MAX_POINTS_RENDER - 1 ? data.length - 1 : Math.round(i * step)
    out.push(data[idx])
  }
  return out
}

/** Ubah titik-titik menjadi path SVG kurva halus (Catmull-Rom → cubic Bezier) */
function pointsToSmoothPath(points, closeToBottom = false, bottomY = 0) {
  if (!points || points.length < 2) return ''
  const p = (i) => {
    if (i < 0) return points[0]
    if (i >= points.length) return points[points.length - 1]
    return points[i]
  }
  let d = `M ${p(0).x} ${p(0).y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = p(i - 1)
    const p1 = p(i)
    const p2 = p(i + 1)
    const p3 = p(i + 2)
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }
  if (closeToBottom && bottomY != null) {
    d += ` L ${p(points.length - 1).x} ${bottomY} L ${p(0).x} ${bottomY} Z`
  }
  return d
}

/** Grafik area dengan SVG; data didownsample & di-memo agar responsif */
const PriceChart = memo(function PriceChart({ data, formatIDR }) {
  const [hovered, setHovered] = useState(null)
  const padding = { top: 12, right: 12, bottom: 28, left: 52 }
  const width = 600
  const height = 280

  const displayData = useMemo(() => downsampleForChart(data), [data])
  if (!displayData || displayData.length < 2) return null

  const prices = displayData.map((d) => d.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const points = useMemo(() => {
    return displayData.map((d, i) => {
      const x = padding.left + (i / (displayData.length - 1)) * chartW
      const y = padding.top + chartH - ((d.price - minP) / range) * chartH
      return { ...d, x, y }
    })
  }, [displayData, minP, maxP, range, chartW, chartH, padding.left, padding.top])

  const baseY = padding.top + chartH
  const areaPath = useMemo(
    () => pointsToSmoothPath(points, true, baseY),
    [points, baseY]
  )
  const linePath = useMemo(
    () => pointsToSmoothPath(points, false),
    [points]
  )

  const hoverPoint = hovered != null ? points[hovered] : null
  const axisY = useMemo(() => [minP, (minP + maxP) / 2, maxP], [minP, maxP])
  const axisXIndices = useMemo(
    () => [0, Math.floor(displayData.length / 2), displayData.length - 1].filter((idx) => points[idx]),
    [displayData.length, points]
  )

  return (
    <div className="w-full h-full min-h-[264px] relative" style={{ maxWidth: width }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHovered(null)}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#goldGradient)" />
        <path d={linePath} fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {axisY.map((v, i) => {
          const y = padding.top + chartH - ((v - minP) / range) * chartH
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={padding.left - 6} y2={y} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">
                {(v / 1e6).toFixed(2)}Jt
              </text>
            </g>
          )
        })}
        {axisXIndices.map((idx) => (
          <text key={idx} x={points[idx].x} y={height - 6} textAnchor="middle" fill="#94a3b8" fontSize="10">
            {displayData[idx].waktu}
          </text>
        ))}
        <rect
          x={padding.left}
          y={padding.top}
          width={chartW}
          height={chartH}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const t = (e.clientX - rect.left) / rect.width
            const idx = Math.round(t * (points.length - 1))
            setHovered(Math.max(0, Math.min(idx, points.length - 1)))
          }}
        />
        {hoverPoint && (
          <g>
            <line
              x1={hoverPoint.x}
              y1={hoverPoint.y}
              x2={hoverPoint.x}
              y2={padding.top + chartH}
              stroke="rgba(245,158,11,0.5)"
              strokeWidth={1}
              strokeDasharray="4"
            />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r={4} fill="#F59E0B" />
          </g>
        )}
      </svg>
      {hoverPoint && (
        <div
          className="absolute z-10 px-3 py-2 rounded-lg bg-slate-800/95 border border-white/10 text-sm shadow-xl pointer-events-none"
          style={{ left: Math.min(hoverPoint.x - 60, width - 140), top: hoverPoint.y - 50 }}
        >
          <div className="text-slate-400 text-xs">{hoverPoint.waktu}</div>
          <div className="text-amber-400 font-semibold">{formatIDR(hoverPoint.price)}</div>
        </div>
      )}
    </div>
  )
})

function useGoldPrice(apiKey = null) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (previousPrice = null) => {
    try {
      setError(null)
      const result = await fetchGoldPrice({
        apiKey: apiKey || import.meta.env.VITE_GOLD_API_KEY || null,
        previousPrice,
      })
      setData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!data) return
    const t = setInterval(() => {
      load(data.pricePerGram)
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [data?.pricePerGram, load])

  return { data, loading, error, refresh: () => load(data?.pricePerGram) }
}

/** Penyimpanan riwayat cukup untuk 1 hari (refresh tiap 15 detik) */
const MAX_CHART_POINTS = 5760

function usePriceHistory(data) {
  const [history, setHistory] = useState([])
  const prevTs = useRef(null)
  useEffect(() => {
    if (!data?.pricePerGram || !data?.timestamp) return
    const ts = data.timestamp
    if (ts === prevTs.current) return
    prevTs.current = ts
    const d = new Date(ts)
    const waktu = d.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setHistory((h) => {
      const next = [
        ...h,
        {
          time: ts,
          price: data.pricePerGram,
          waktu,
          sellPrice: data.sellPrice,
          buyBackPrice: data.buyBackPrice,
        },
      ]
      return next.length > MAX_CHART_POINTS ? next.slice(-MAX_CHART_POINTS) : next
    })
  }, [data?.pricePerGram, data?.timestamp, data?.sellPrice, data?.buyBackPrice])
  return history
}

function formatTimestamp(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const time = d.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  return `${time}, ${date}`
}

export default function App() {
  const { data, loading, error } = useGoldPrice()
  const [grams, setGrams] = useState('')
  const chartData = usePriceHistory(data)

  const pricePerGram = data?.pricePerGram ?? 0
  const previousPrice = data?.previousPrice ?? pricePerGram
  const isUp = pricePerGram >= previousPrice
  const percentChange = previousPrice
    ? (((pricePerGram - previousPrice) / previousPrice) * 100).toFixed(2)
    : '0.00'
  const totalIDR = grams !== '' && !Number.isNaN(Number(grams)) && Number(grams) >= 0
    ? Math.round(Number(grams) * pricePerGram)
    : 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex items-center justify-center gap-3 mb-8">
        <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
          <Gem className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent">
          Monitor Emas Indonesia
        </h1>
      </header>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* Main Price Card - Glassmorphism */}
      <div className="glass-card max-w-2xl mx-auto p-6 sm:p-8 mb-6 shadow-gold-glow">
        {loading && !data ? (
          <div className="text-center py-12 text-amber-400/80">Memuat harga...</div>
        ) : (
          <>
            <p className="text-slate-400 text-sm sm:text-base mb-1">Harga per gram</p>
            <p className="text-4xl sm:text-5xl lg:text-6xl font-bold text-amber-400 tracking-tight">
              {formatIDR(pricePerGram)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                {isUp ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {isUp ? 'Harga Naik' : 'Harga Turun'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400 text-sm">
                <Clock className="w-4 h-4" />
                Diperbarui: {formatTimestamp(data?.timestamp)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Grafik Harga */}
      <div className="glass-card max-w-4xl mx-auto p-4 sm:p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-slate-300">
            <LineChartIcon className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Grafik Harga Emas</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              const hasSellBuy = chartData.some((d) => d.sellPrice != null || d.buyBackPrice != null)
              const header = hasSellBuy
                ? 'timestamp,waktu,harga_per_gram_idr,sell_price,buy_back_price\n'
                : 'timestamp,waktu,harga_per_gram_idr\n'
              const rows = chartData.map((d) => {
                const base = `${d.time},${d.waktu},${d.price}`
                return hasSellBuy ? `${base},${d.sellPrice ?? ''},${d.buyBackPrice ?? ''}` : base
              }).join('\n')
              const csv = header + rows
              const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `harga_emas_${new Date().toISOString().slice(0, 10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            disabled={chartData.length < 2}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 disabled:pointer-events-none transition"
          >
            <Download className="w-4 h-4" />
            Unduh Data (CSV)
          </button>
        </div>
        <div className="h-64 sm:h-80 w-full flex items-center justify-center">
          {chartData.length < 2 ? (
            <div className="text-slate-500 text-sm">Mengumpulkan data grafik...</div>
          ) : (
            <PriceChart data={chartData} formatIDR={formatIDR} />
          )}
        </div>
      </div>

      {/* SELL & BUY Back Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-4">
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            Harga Jual (SELL)
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-emerald-400">
            {data?.sellPrice ? formatIDR(data.sellPrice) : '—'}
          </p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <ArrowLeftRight className="w-4 h-4 text-blue-400" />
            Harga Beli Kembali (BUY Back)
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-blue-400">
            {data?.buyBackPrice ? formatIDR(data.buyBackPrice) : '—'}
          </p>
        </div>
      </div>

      {/* Sub-cards: Tertinggi, Terendah, Persen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Tertinggi Hari Ini
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-amber-400/90">
            {data ? formatIDR(data.dailyHigh) : '—'}
          </p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            Terendah Hari Ini
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-amber-400/90">
            {data ? formatIDR(data.dailyLow) : '—'}
          </p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            {Number(percentChange) >= 0 ? (
              <ArrowUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <ArrowDown className="w-4 h-4 text-red-400" />
            )}
            Perubahan (%)
          </div>
          <p
            className={`text-xl sm:text-2xl font-semibold ${
              Number(percentChange) >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {percentChange}%
          </p>
        </div>
      </div>

      {/* Kalkulator Investasi */}
      <div className="glass-card max-w-2xl mx-auto p-6 sm:p-8">
        <div className="flex items-center gap-2 text-slate-300 mb-4">
          <Calculator className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold">Kalkulator Investasi Emas</h2>
        </div>
        <label className="block text-sm text-slate-400 mb-2">Jumlah Gram</label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Contoh: 5"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition"
        />
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-slate-400 text-sm mb-1">Total perkiraan (IDR)</p>
          <p className="text-2xl sm:text-3xl font-bold text-amber-400">
            {formatIDR(totalIDR)}
          </p>
        </div>
      </div>

      <footer className="mt-10 text-center text-slate-500 text-sm">
        Harga dari spot emas global (goldprice.org) &amp; kurs USD/IDR (exchangerate-api.com). Bukan saran investasi.
      </footer>
    </div>
  )
}
