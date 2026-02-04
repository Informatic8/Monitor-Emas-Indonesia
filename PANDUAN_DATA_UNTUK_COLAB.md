# Ekspor Data Harga Emas ke CSV

Untuk mendapatkan data grafik dalam format **.csv** (untuk analisis atau machine learning di Google Colab atau di mana pun):

1. Buka website **Monitor Emas Indonesia** dan biarkan grafik mengumpulkan data (minimal 2 titik).
2. Klik tombol **"Unduh Data (CSV)"** di kanan atas kartu grafik.
3. File akan terunduh dengan nama seperti `harga_emas_2026-02-04.csv`.

**Kolom di dalam CSV:**
- **timestamp** – waktu pengambilan (format ISO)
- **waktu** – waktu tampil (HH:mm:ss)
- **harga_per_gram_idr** – harga emas per gram dalam Rupiah

File CSV ini siap diunggah ke Google Colab atau digunakan di kode Anda.
