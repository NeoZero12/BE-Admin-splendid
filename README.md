# Splendid Admin API

Backend REST TypeScript untuk panel `splendid-admin`, dibuat dengan Express. API mendukung autentikasi admin, sesi Bearer, dan CRUD data pada MySQL/MariaDB.

## Menjalankan lokal

```powershell
Copy-Item .env.example .env
# Edit .env: set kredensial admin, AUTH_TOKEN_SECRET, dan akses MySQL
npm install
npm run dev
```

Pastikan layanan MySQL/MariaDB aktif. Backend membuat database `DB_NAME` (default `admin_splendid`) bila belum tersedia, lalu menerapkan tabel dari `database/schema.sql` saat startup. Akun database harus memiliki izin membuat database saat database belum ada serta membuat tabel. API berjalan pada `http://localhost:4000/api`.

Frontend menggunakan endpoint same-origin `/api` dan meneruskan permintaan ke backend melalui `BACKEND_API_URL` (default `http://127.0.0.1:4000/api`). Cara ini menghindari masalah CORS di browser. `CORS_ORIGIN` tetap menerima satu atau beberapa origin frontend yang dipisah koma untuk klien yang mengakses API langsung.

## Endpoint

| Method | Endpoint | Auth | Hasil |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Tidak | Status API |
| `POST` | `/api/auth/login` | Tidak | `{ email, password }` → `{ token, expiresAt, user }`; menerima akun `.env` atau admin terdaftar |
| `POST` | `/api/auth/register` | Bearer | `{ name, email, password }` → membuat akun admin baru |
| `GET` | `/api/auth/me` | Bearer | Data admin aktif |
| `POST` | `/api/auth/logout` | Bearer | Mengakhiri sesi aktif |
| `POST` | `/api/auth/change-password` | Bearer | `{ currentPassword, newPassword }` → memperbarui kata sandi admin aktif (12–128 karakter) |
| `GET` | `/api/data/:collection` | Bearer | `{ data: [...] }` |
| `GET` | `/api/data/:collection/:id` | Bearer | `{ data: record }` |
| `POST` | `/api/data/:collection` | Bearer | Buat record dan kembalikan `{ data: record }` |
| `PUT`, `PATCH` | `/api/data/:collection/:id` | Bearer | Ganti/perbarui record |
| `DELETE` | `/api/data/:collection/:id` | Bearer | Hapus record |

Schema menyediakan tabel khusus `flowers`, `birds`, `fish`, `pets`, `supplies`, `inventory`, `users`, `community_posts`, `market_locations`, dan `admin_profiles`, ditambah `admin_users` serta `admin_records` untuk data lama atau koleksi tambahan. Kolom khusus menyimpan nilai yang dapat dicari (nama, kategori, harga, stok, status, lokasi, dan lainnya); kolom JSON menjaga data tambahan tetap utuh. Data koleksi lama di `admin_records` dipindahkan satu kali dengan aman saat startup dan salinan lamanya dipertahankan.

Akun admin tambahan memiliki kata sandi yang di-hash dengan scrypt. Pendaftaran admin hanya dapat dilakukan menggunakan token admin aktif; login bootstrap tetap memakai `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `.env`. Sesi aktif disimpan di memori proses dan berakhir saat server restart atau masa berlakunya habis.

Build produksi: `npm run build`, lalu `npm start`.
