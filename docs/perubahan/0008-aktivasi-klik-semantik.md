# ADR-0008: Pakai satu klik semantik, jangan deteksi ketuk ganda sendiri

- **Status:** Diterima
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab II (SMART/Specific), Bab III Fase 1–4 ("double tap untuk melanjutkan")

## Konteks

Exsum menyebut **ketuk ganda** sebagai cara melanjutkan di setiap fase. Saat
mengimplementasikannya, kami menemukan bahwa menuliskannya secara harfiah
justru merusak pengalaman pengguna sasaran.

TalkBack menyisipkan dirinya di antara jari pengguna dan halaman. Sentuhan
ditafsirkan ulang sebelum sampai ke kita:

| Gestur fisik pengguna | Yang diterima halaman |
| --- | --- |
| Ketuk satu kali | *(tidak ada — TalkBack membacakan label)* |
| **Ketuk dua kali** | **satu peristiwa `click`** |

Artinya, ketuk ganda yang diminta exsum **sudah menjadi gestur aktivasi bawaan
TalkBack**, dan hasilnya sampai ke halaman sebagai satu klik biasa.

Kalau kami menuliskan deteksi ketuk ganda sendiri — menunggu dua peristiwa
sentuh dalam 400 ms — maka pengguna TalkBack harus melakukan **ketuk ganda dua
kali** untuk satu tindakan. Fitur yang dimaksudkan mempermudah justru
menggandakan usaha bagi orang yang paling membutuhkannya.

Halaman web juga tidak dapat mengetahui apakah TalkBack sedang aktif, sehingga
tidak ada cara menyediakan dua perilaku berbeda secara otomatis.

## Keputusan

Seluruh tindakan dipicu lewat elemen `<button>` semantik dan peristiwa `click`
biasa. Kami tidak menulis deteksi ketuk ganda sama sekali.

Hasilnya, gestur fisik yang dilakukan pengguna tepat seperti yang dijanjikan
exsum:

- **Dengan TalkBack aktif** (mayoritas pengguna sasaran): ketuk satu kali untuk
  mendengar labelnya, **ketuk dua kali untuk melanjutkan**. Persis bunyi exsum,
  tanpa satu baris kode gestur pun.
- **Tanpa TalkBack**: satu ketukan langsung melanjutkan.

Risiko ketukan tak sengaja pada mode tanpa TalkBack ditekan oleh rancangan
alurnya sendiri: sistem selalu mengucapkan hasil lebih dulu dan tidak pernah
mengunci nominal tanpa konfirmasi terpisah, sedangkan setiap fase punya tombol
"Batalkan" permanen (ADR-0006).

## Konsekuensi

**Menjadi lebih baik**

- Pengguna TalkBack mendapat tepat satu ketuk ganda per tindakan, bukan dua.
- Tidak ada kode penanganan gestur yang perlu ditulis, diuji, dan dikalibrasi
  ambang waktunya. Kelas bug ini hilang seluruhnya.
- Seluruh elemen otomatis masuk urutan fokus TalkBack dan dapat dijangkau
  dengan geser kanan-kiri.
- Memenuhi WCAG 2.2 kriteria 2.1.1 (papan ketik) tanpa usaha tambahan.

**Menjadi lebih buruk**

- Pengguna tanpa TalkBack dapat mengaktifkan tombol dengan satu ketukan, yang
  secara harfiah berbeda dari bunyi exsum.
- Karena TalkBack tidak dapat dideteksi, kami tidak bisa menampilkan petunjuk
  yang berbeda untuk kedua mode. Label ditulis netral: "ketuk untuk lanjut".

## Alternatif yang ditolak

- **Menulis deteksi ketuk ganda sendiri.** Ditolak karena memaksa pengguna
  TalkBack melakukan ketuk ganda dua kali. Kesetiaan harfiah pada proposal
  tidak sebanding dengan merugikan pengguna yang justru menjadi alasan produk
  ini ada.
- **Menyediakan saklar "mode TalkBack" di pengaturan.** Menambah satu hal yang
  harus dipahami dan disetel pengguna sebelum aplikasi bisa dipakai, padahal
  perilaku bawaan sudah benar untuk keduanya.
- **Menebak dari `navigator.userAgent` atau pengukuran waktu sentuh.** Tebakan
  yang salah menghasilkan antarmuka yang tidak merespons sama sekali, dan
  pengguna tidak akan tahu penyebabnya.
