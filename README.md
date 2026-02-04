# Monitor Emas Indonesia

Dashboard profesional untuk memantau harga emas Indonesia (IDR/gram) dengan tampilan Gold & Dark dan kalkulator investasi.

## Fitur

- **Harga real-time** per gram dalam IDR
- **Waktu diperbarui** (HH:mm:ss, DD MMMM YYYY)
- **Status harga**: Harga Naik (hijau) / Harga Turun (merah)
- **Kartu info**: Tertinggi hari ini, Terendah hari ini, Persen perubahan
- **Kalkulator investasi**: input Jumlah Gram → total perkiraan IDR

## Menjalankan proyek

```bash
npm install
npm run dev
```

Buka http://localhost:5173

## Sumber data

- **Tanpa API key**: data mock (IDR/gram ~1.400.000–1.500.000) dengan fluktuasi acak, diperbarui setiap 5 detik.
- **Dengan API key**: buat file `.env` dan isi:
  ```
  VITE_GOLD_API_KEY=your_goldapi_io_key
  ```
  Lalu jalankan ulang `npm run dev`.

## Tech stack

- React 18 + Vite
- Tailwind CSS (tema Slate-950 + Amber/Gold)
- Lucide Icons

Semua label dalam Bahasa Indonesia.
"# Monitor-Emas-Indonesia" 
