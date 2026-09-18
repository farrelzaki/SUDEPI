# Aksesibilitas SUDEPI

Status: **aktif** · Acuan: WCAG 2.2 Level AA · Pembaca layar sasaran: Google TalkBack

> Wajib dibaca sebelum menyentuh apa pun di `src/ui/`.
> Di proyek ini aksesibilitas bukan lapisan pemolesan di akhir. Ia adalah
> produknya.

---

## Satu asumsi yang mengubah segalanya

Tulis kode dengan anggapan **layarnya mati.**

Bukan "pengguna kesulitan melihat", tapi benar-benar tidak ada gambar sama
sekali. Kalau sebuah alur hanya bisa diselesaikan dengan melihat sesuatu, alur
itu belum selesai dikerjakan. Ini bukan gaya bahasa — ini cara mengujinya:
tutup layar dengan telapak tangan, lalu selesaikan transaksinya.

Satu-satunya pengecualian adalah Merchant Display di Fase 3, yang memang
ditujukan untuk mata pedagang, bukan mata pengguna.

## Pola layar: dua tombol, tidak pernah lebih

Setiap fase punya bentuk yang sama persis:

```
┌─────────────────────────────┐
│                             │
│   TINDAKAN UTAMA            │  <button>, 75% tinggi layar
│   (pratinjau kamera         │  aria-label menjelaskan
│    atau isi fase)           │  keadaan DAN akibat menekannya
│                             │
├─────────────────────────────┤
│   BATALKAN                  │  <button>, 25% tinggi layar
└─────────────────────────────┘  posisi tetap di semua fase
```

Kenapa bentuknya seragam: pengguna tunanetra menavigasi lewat **ingatan otot
dan posisi tetap**, bukan dengan memindai layar. Tata letak yang berubah-ubah
antar fase memaksa penjelajahan ulang setiap kali, dan itu persis beban yang
ingin kita hapus.

**Dilarang** menambah tombol ketiga ke sebuah fase. Kalau terasa butuh, yang
sebenarnya kamu butuhkan adalah fase baru.

## Gestur dan TalkBack

TalkBack menyisipkan dirinya di antara jari pengguna dan halaman. Sentuhan
ditafsirkan ulang sebelum sampai ke kita:

| Gestur pengguna | Saat TalkBack aktif | Saat TalkBack mati |
| --- | --- | --- |
| Ketuk satu kali | Fokuskan elemen, bacakan labelnya | (tidak dipakai) |
| Ketuk dua kali | **Aktifkan elemen terfokus** | Aktifkan, ditangani aplikasi |
| Geser kanan/kiri | Pindah fokus antar elemen | (tidak dipakai) |
| Ketuk dua kali + tahan | Tidak diteruskan dengan andal | Escape-Hatch |

Ada keberuntungan di sini: **"ketuk ganda untuk melanjutkan" dari exsum persis
sama dengan gestur aktivasi bawaan TalkBack.** Jadi untuk maju, tidak ada yang
perlu diakali. Cukup pakai `<button>` biasa, dan keduanya bekerja.

Yang tidak bisa diandalkan hanyalah gestur tahan. Karena itu tombol
"Batalkan" permanen ada (ADR-0006).

**Konsekuensi praktis: jangan pernah memasang penangan sentuh pada `<div>`.**
Elemen non-semantik tidak masuk ke urutan fokus TalkBack, sehingga pengguna
yang memakai pembaca layar tidak akan pernah bisa mencapainya. Selalu
`<button>`.

## Menulis aria-label

Label dibacakan lewat suara, sekali, tanpa bisa dilihat ulang. Ia harus
menjawab dua hal sekaligus: **apa keadaannya sekarang** dan **apa yang terjadi
kalau saya ketuk dua kali.**

```html
<!-- Buruk: menyebut keadaan, tapi tidak memberi jalan -->
<button aria-label="Terdeteksi lima puluh ribu rupiah">

<!-- Baik -->
<button aria-label="Terdeteksi lima puluh ribu rupiah.
                    Ketuk dua kali untuk lanjut ke kalkulator.">

<!-- Buruk: tidak ada yang bisa dilakukan pengguna dengan informasi ini -->
<button aria-label="Memindai">

<!-- Baik: memberi tahu apa yang harus dilakukan tubuhnya -->
<button aria-label="Mencari uang. Arahkan kamera ke uang,
                    jarak sekitar dua puluh sentimeter.">
```

Aturannya: kalau label tidak memberi tahu pengguna apa yang bisa ia lakukan
selanjutnya, label itu belum selesai.

## Dua sumber suara, dan cara menghindari tabrakan

SUDEPI bersuara sendiri lewat audio sprite (ADR-0003). TalkBack juga bersuara.
Kalau keduanya bicara bersamaan, tidak ada yang bisa ditangkap.

Aturan pembagiannya:

- **TalkBack** membacakan hal yang bersifat **navigasi**: nama tombol, keadaan
  fokus, label elemen. Ini datang gratis dari HTML semantik.
- **SUDEPI** mengucapkan hal yang bersifat **hasil**: nominal terdeteksi, total,
  kembalian, perintah abstain. Ini adalah inti produknya, dan tidak boleh
  bergantung pada pembaca layar yang mungkin tidak aktif.

Supaya tidak dobel, `aria-live` dipakai **secara hemat**:

```html
<!-- Untuk hal yang harus memotong pembicaraan: abstain, uang kurang -->
<div role="alert" aria-live="assertive" />

<!-- Umumnya JANGAN mencerminkan ucapan SUDEPI ke aria-live,
     karena TalkBack akan membacakannya lagi setelah suara kita selesai. -->
```

Sediakan pengaturan **"Sumber suara: Aplikasi / TalkBack"** di `pengaturan`,
dengan nilai bawaan Aplikasi. Ini jalan keluar yang jujur untuk sesuatu yang
tidak bisa dideteksi secara terprogram: halaman web tidak dapat mengetahui
apakah TalkBack sedang aktif.

## Merchant Display (Fase 3)

Ini satu-satunya layar yang dirancang untuk mata, yaitu mata pedagang, dilihat
sekilas dari jarak sekitar satu meter, seringkali di bawah cahaya lapak yang
buruk.

- Tinggi angka minimal **72 pt**. Pakai `clamp()` supaya ikut mengisi layar
  pada HP besar, bukan ukuran tetap.
- Rasio kontras minimal **7:1**, melampaui syarat AA yang 4,5:1. Alasannya
  praktis, bukan formal: layar akan dilihat di bawah sinar matahari pasar.
- Tampilkan **tiga angka saja**: total belanja, uang dibayar, kembalian.
  Tidak ada ikon, tidak ada hiasan, tidak ada penjelasan.
- Setiap angka diberi label teks yang jelas. Pedagang belum pernah melihat
  aplikasi ini sebelumnya dan tidak akan diberi penjelasan.
- Kunci orientasi pada mode potret. Rotasi tak terduga saat layar dibalik ke
  arah pedagang akan membingungkan keduanya.

## Daftar periksa WCAG 2.2 AA yang relevan

Bukan seluruh standar, hanya yang benar-benar menyentuh SUDEPI.

| Kriteria | Yang kita lakukan |
| --- | --- |
| 1.4.3 Kontras minimum | Semua teks minimal 4,5:1. Merchant Display 7:1. |
| 1.4.11 Kontras non-teks | Batas tombol dan panduan Sonar Aiming minimal 3:1. |
| 2.1.1 Papan ketik | Semua aksi lewat `<button>`, jadi otomatis terpenuhi. |
| 2.4.7 Fokus terlihat | Cincin fokus tebal, tidak pernah `outline: none`. |
| 2.5.5 Ukuran target | Seluruh target jauh melebihi 44x44 px. Kita memakai seperempat layar. |
| 2.5.7 Gerakan seret | Tidak ada gestur seret sama sekali. Roda taktil juga bisa dioperasikan dengan ketukan. |
| 2.5.8 Ukuran target minimum | Terpenuhi dengan sangat lapang. |
| 3.2.2 Saat input | Mengubah nilai tidak pernah langsung memicu perpindahan fase. Selalu butuh konfirmasi. |
| 3.3.1 Identifikasi galat | Abstain dan uang kurang diumumkan lewat suara, bukan hanya teks. |
| 3.3.7 Masukan berulang | Hasil pindai Fase 1 dapat dipakai langsung sebagai nominal bayar. |

## Cara mengujinya

Tes otomatis tidak menangkap satu pun hal di halaman ini. Verifikasi dilakukan
dengan tangan, dan hasilnya dicatat di `docs/DEMO.md`.

1. Nyalakan TalkBack di HP uji. **Biarkan menyala selama pengembangan UI.**
   Mematikannya "supaya lebih gampang menguji" berarti kamu menguji aplikasi
   yang berbeda dari yang akan dipakai orang.
2. Selesaikan satu transaksi penuh **dengan telapak tangan menutupi layar.**
   Kalau tidak bisa, itu bug, dengan tingkat keparahan tinggi.
3. Jalankan di bawah cahaya redup, untuk memastikan senter otomatis menyala.
4. Uji tombol Batalkan dari setiap fase. Semuanya harus kembali ke Mode Siaga.
5. Ulangi seluruhnya dalam mode pesawat.
