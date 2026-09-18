# AGENTS.md

## Tujuan

Gunakan file ini sebagai aturan utama untuk AI agent yang bekerja di proyek ini.
Workflow harus mendalam, berbasis bukti, aman, dapat dilacak, dan tetap efisien.

## Sumber Kebenaran

- `AGENTS.md`: aturan kerja, mode, checkpoint, dan standar proyek.
- `TASK.md`: task, scope, kriteria selesai, risiko, dan status persetujuan.
- `PROJECT_STATE.md`: kondisi terbaru, fase aktif, keputusan, dan handoff sesi.

Tiga file di atas mengatur **proses kerja**. Keputusan **teknis sistem** berada di:

- `CLAUDE.md`: penunjuk arah singkat, struktur kode, versi yang dikunci, aturan wajib.
- `docs/KONTRAK.md`: tipe dan antarmuka lintas-modul. **Beku**; ubah hanya setelah disepakati.
- `docs/PLAN.md`, `docs/ARSITEKTUR.md`, `docs/AKSESIBILITAS.md`: stack, arsitektur, dan standar aksesibilitas.
- `docs/PERUBAHAN.md`: setiap penyimpangan dari executive summary **wajib** dicatat sebagai ADR di sini. Panitia menilai ini.

Keduanya berlaku sekaligus: ikuti checkpoint di file ini, dan patuhi keputusan teknis di `docs/`.

Jangan mencampur daftar task ke `PROJECT_STATE.md` atau aturan permanen ke `TASK.md`.
Jika isi file berbeda dengan kondisi nyata proyek, laporkan perbedaannya dan jangan mengarang.

## Mode Kerja

Mode default workflow ini adalah `competition`.

### Mode competition

- Gunakan pendekatan evidence-based dan jangan mengambil kesimpulan tanpa memeriksa sumber yang relevan.
- Kerjakan satu task aktif pada satu waktu.
- Gunakan checkpoint wajib sebelum berpindah fase.
- Jangan menulis file sebelum scope dan rencana disetujui pengguna.
- Jangan memperluas scope tanpa persetujuan baru.
- Laporkan asumsi, risiko, alternatif, dan hal yang belum terverifikasi.
- Berhenti setelah setiap fase penting dan tunggu konfirmasi pengguna.

### Mode standard

Mode ini hanya digunakan jika pengguna memintanya secara eksplisit.

- Perubahan kecil boleh dikerjakan setelah pemberitahuan tanpa menunggu persetujuan tambahan.
- Perubahan besar tetap harus dijelaskan rencana dan dampaknya, lalu menunggu persetujuan pengguna.
- Verifikasi tetap wajib dilakukan sesuai dampak perubahan.

Jangan mengganti mode secara otomatis. Jika mode belum tercatat di `PROJECT_STATE.md`, gunakan `competition`. Perubahan mode harus dikonfirmasi pengguna.

## Cara Memulai Sesi

1. Baca file ini terlebih dahulu.
2. Baca `TASK.md` untuk melihat task aktif dan backlog.
3. Baca `PROJECT_STATE.md` untuk mengetahui mode, fase, keputusan, dan pekerjaan yang tertunda.
4. Jika pengguna sudah memberikan pekerjaan secara langsung, gunakan pekerjaan tersebut sebagai task yang sedang diusulkan.
5. Jika belum ada task atau instruksi pekerjaan, tanyakan kepada pengguna pekerjaan yang ingin dipilih.
6. Pahami tujuan, batasan, non-goals, dependensi, dan kriteria selesai.
7. Jika kebutuhan penting masih ambigu, tanyakan sebelum mengambil keputusan.
8. Dalam mode `competition`, mulai dari checkpoint Scope dan jangan langsung mengubah file.

## Checkpoint Mode Competition

Gunakan urutan berikut. Setelah setiap fase, berhenti dan tunggu konfirmasi sebelum melanjutkan.

1. **Scope**: rangkum tujuan, konteks, batasan, non-goals, dan kriteria sukses.
2. **Discovery**: periksa file, struktur, implementasi, test, konfigurasi, dan bukti lain yang relevan.
3. **Analysis**: jelaskan masalah, akar penyebab, alternatif, rekomendasi, risiko, dan hal yang belum diketahui.
4. **Plan**: tulis file yang akan diubah, perubahan per file, urutan kerja, dan rencana verifikasi.
5. **Approval**: minta persetujuan eksplisit sebelum menulis file atau menjalankan perubahan yang berdampak.
6. **Implementation**: kerjakan hanya scope yang disetujui dan berhenti jika menemukan masalah di luar scope.
7. **Verification**: jalankan pemeriksaan yang relevan, termasuk regresi dan edge case yang masuk akal.
8. **Handoff**: perbarui task dan state, laporkan hasil, risiko, hal yang belum terverifikasi, dan usulan langkah berikutnya.

Konfirmasi seperti `lanjut`, `setuju`, atau `proceed` hanya berlaku untuk fase yang dijelaskan secara langsung. Jangan menganggapnya sebagai persetujuan untuk semua fase berikutnya.

Untuk task yang benar-benar kecil dan tanpa risiko, beberapa fase boleh digabung jika alasannya dijelaskan. Discovery, approval sebelum menulis, dan verification tidak boleh dilewati dalam mode `competition`.

## Aturan Perubahan File

- Sebelum menulis atau mengubah file, beri tahu file yang akan diubah dan tujuan perubahannya.
- Dalam mode `competition`, jangan menulis file apa pun sebelum checkpoint Approval disetujui.
- Jangan menimpa, menghapus, atau membatalkan perubahan pengguna yang tidak terkait.
- Pilih perubahan terkecil yang menyelesaikan masalah.
- Jangan menambah dependency, konfigurasi, atau abstraksi baru tanpa alasan yang jelas.
- Jangan menyimpan password, API key, token, atau data sensitif di file proyek.
- Jangan mengarang hasil test, isi file, atau perilaku sistem.
- Jika scope berubah, berhenti, jelaskan dampaknya, dan minta persetujuan baru.

## Klasifikasi Perubahan

Anggap perubahan sebagai perubahan besar jika melibatkan salah satu hal berikut:

- Perubahan database, migrasi, atau struktur data penting.
- Perubahan autentikasi, otorisasi, keamanan, atau data sensitif.
- Penambahan dependency utama atau perubahan konfigurasi deployment.
- Perubahan arsitektur, API publik, atau kontrak antar bagian sistem.
- Penghapusan fitur atau perubahan pada banyak file yang saling berkaitan.

Perubahan kecil biasanya berupa perbaikan bug lokal, perubahan teks, styling sederhana, atau perubahan pada sedikit file tanpa dampak luas.

Jika klasifikasi perubahan tidak jelas, perlakukan sebagai perubahan besar dan minta persetujuan pengguna.

## Pengelolaan Task Dan State

- Hanya ada satu task aktif pada satu waktu.
- Task langsung dari chat dapat menjadi task aktif setelah scope-nya disepakati.
- Catat task ke `TASK.md` jika pekerjaan melewati satu fase, membutuhkan lebih dari satu sesi, atau perlu dilacak.
- Perbarui `TASK.md` saat status, scope, kriteria, atau hasil task berubah.
- Perbarui `PROJECT_STATE.md` saat memulai sesi, melewati checkpoint, membuat keputusan, menemukan blocker, mengubah arah, berhenti, atau menyelesaikan task.
- Jaga `PROJECT_STATE.md` tetap ringkas; jangan menyalin seluruh percakapan.

## Verifikasi

- Jalankan test, lint, build, atau pemeriksaan lain yang relevan jika tersedia.
- Dalam mode `competition`, verifikasi hasil terhadap kriteria selesai, regresi yang mungkin, edge case penting, dan risiko yang teridentifikasi.
- Sesuaikan kedalaman verifikasi dengan dampak perubahan.
- Jangan menjalankan pemeriksaan mahal yang tidak relevan.
- Periksa kembali diff, file terdampak, dan hasil akhir.
- Jika verifikasi tidak dapat dijalankan, jelaskan alasannya dan dampaknya.
- Jangan menyatakan task selesai jika kriteria selesai belum terpenuhi.

## Format Laporan Checkpoint

Pada setiap checkpoint, laporkan:

- Fase yang selesai.
- Fakta atau bukti yang ditemukan.
- Asumsi dan hal yang belum diketahui.
- Keputusan atau rekomendasi.
- Risiko dan dampak.
- Fase berikutnya yang diusulkan.
- Pertanyaan konfirmasi yang jelas.

## Format Laporan Akhir

Setelah pekerjaan selesai, laporkan secara ringkas:

- Tujuan dan hasil yang dicapai.
- Perubahan dan file yang dibuat atau diubah.
- Verifikasi yang dijalankan dan hasilnya.
- Hal yang belum terverifikasi.
- Risiko atau pekerjaan lanjutan.

## Prinsip Umum

- Utamakan kejelasan daripada kecanggihan.
- Pertahankan kompatibilitas dengan perilaku yang sudah ada kecuali perubahan memang diminta.
- Gunakan istilah dan pola yang konsisten dengan proyek.
- Dokumentasikan keputusan penting beserta alasan dan dampaknya.
- Jangan terburu-buru; lebih baik berhenti untuk konfirmasi daripada membuat asumsi penting.
