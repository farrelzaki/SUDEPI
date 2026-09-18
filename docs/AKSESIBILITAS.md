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

## Pola layar: satu langkah per layar, seperti Android

> Bagian ini diganti oleh **ADR-0011**. Sebelumnya kami memakai pola kaku
> "tindakan utama 75% layar, Batalkan 25%, tidak pernah lebih dari dua tombol".
> Pola itu konsisten — tetapi konsisten dengan dirinya sendiri saja.

Setiap fase adalah satu layar dengan bentuk yang sama:

```
┌─────────────────────────────┐
│ ‹   01 / 04                 │  kembali + penghitung langkah
│ Judul langkah               │
│ Keterangan singkat          │
│ ▓▓▓▓▓░░░░░░░░░░░░░░░░       │  batang kemajuan
├─────────────────────────────┤
│                             │
│   isi fase                  │  kamera, papan angka, atau
│   (seluruhnya juga          │  layar pedagang
│    sasaran ketuk)           │
│                             │
├─────────────────────────────┤
│   TINDAKAN UTAMA            │  selalu tombol pertama di bawah
│   Batal dan kembali         │  selalu tepat di bawahnya
└─────────────────────────────┘
```

Kenapa bentuknya begini: pengguna kami memakai Android setiap hari dengan
TalkBack. Mereka sudah hafal tombol kembali di pojok kiri atas, satu langkah
per layar, dan tindakan di bawah. **Aksesibilitas sering kali bukan berarti
membuat sesuatu yang berbeda, melainkan sesuatu yang sudah dikenal.**

Yang tetap dipertahankan dari pola lama:

- **Seluruh layar tetap menjadi sasaran tindakan utama** (`LapisanKetuk`).
  Lapisan itu `aria-hidden`, supaya TalkBack tidak menemukan dua kendali yang
  mengerjakan satu hal.
- **Urutan tetap.** Tindakan utama selalu tombol pertama di area aksi, batal
  selalu tepat di bawahnya, di setiap fase.

Satu pengecualian yang harus diingat: **layar papan angka tidak punya lapisan
ketuk.** Layar itu penuh tombol, dan sasaran sebesar layar di belakangnya akan
menelan setiap ketukan yang meleset sedikit lalu mengunci nominal yang belum
selesai diketik.

## Detak kerja: keheningan tidak boleh berarti dua hal

Inferensi memakan sekitar 0,7 detik per bingkai, dan selama tidak ada yang
cukup diyakini, sistem tidak mengatakan apa pun. Bagi pengguna yang tidak bisa
melihat layar, keheningan itu **tidak bisa dibedakan dari kerusakan** — ia tidak
tahu apakah sistem sedang berusaha, kameranya tertutup jari, atau aplikasinya
memang mati. Yang terjadi kemudian: ia berhenti mencoba dan kembali bergantung
pada orang lain, yaitu hal yang justru ingin kita hapus.

Karena itu ada **detak**: bunyi pendek 45 milidetik, satu per bingkai yang
selesai diproses.

| Keadaan | Bunyi | Artinya bagi pengguna |
| --- | --- | --- |
| Menyiapkan kamera dan model | denyut dalam tiap 0,9 detik | "tunggu, belum mulai melihat" |
| Tidak ada objek | satu nada rendah | "aku hidup, belum melihat apa-apa" |
| Ada objek, belum diyakini | dua nada naik | "ada sesuatu, sedang kupastikan" |
| Stabil | **tidak ada detak** | nominalnya diucapkan, itu sudah cukup |

Tiga aturan yang mengikat bagian ini:

1. **Detak berhenti selagi sistem bicara.** Kalimat yang menyampaikan nominal
   uang tidak boleh ditumpangi bunyi apa pun.
2. **Satu detak sama dengan satu bingkai sungguhan**, bukan timer hiasan.
   Kalau perangkat melambat karena panas, detaknya ikut melambat — pengguna
   mendengar keadaan yang sebenarnya.
3. **Bukan kalimat.** "Sedang mencari" yang diulang tiap bingkai akan menyumbat
   satu-satunya saluran keluaran yang kita punya; itu persis kesalahan nomor 10
   di `PROGRES.md`. Arah nada yang naik dipilih karena ia satu-satunya isyarat
   yang bisa ditangkap tanpa harus mengingat nada sebelumnya.

Bunyinya dibangkitkan osilator Web Audio, bukan berkas rekaman: tetap luring,
dan menambah nol byte ke APK.

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
kalau elemen ini diaktifkan.**

```html
<!-- Buruk: menyebut keadaan, tapi tidak memberi jalan -->
<button aria-label="Terdeteksi lima puluh ribu rupiah">

<!-- Baik -->
<button aria-label="Terdeteksi lima puluh ribu rupiah.
                    Lanjut ke kalkulator.">

<!-- Buruk: tidak ada yang bisa dilakukan pengguna dengan informasi ini -->
<button aria-label="Memindai">

<!-- Baik: memberi tahu apa yang harus dilakukan tubuhnya -->
<button aria-label="Mencari uang. Arahkan kamera ke uang,
                    jarak sekitar dua puluh sentimeter.">
```

Aturannya: kalau label tidak memberi tahu pengguna apa yang bisa ia lakukan
selanjutnya, label itu belum selesai.

**Jangan tulis kata "ketuk" di dalam label.** TalkBack sudah menambahkan
sendiri "Tombol, ketuk dua kali untuk mengaktifkan" setelah membacakan
deskripsi kita. Kalau kita ikut menulis "ketuk untuk lanjut", pengguna
mendengar dua instruksi yang saling bertentangan — "ketuk" versus "ketuk dua
kali" — dan yang lebih membingungkan, instruksi kita yang salah.

Tulis **akibatnya**, bukan perintahnya:

```html
<!-- Buruk: bertabrakan dengan petunjuk TalkBack -->
<button aria-label="Terdeteksi lima puluh ribu rupiah.
                    Ketuk untuk lanjut ke kalkulator.">

<!-- Baik: TalkBack yang menyediakan cara mengaktifkannya -->
<button aria-label="Terdeteksi lima puluh ribu rupiah.
                    Lanjut ke kalkulator.">
```

Terverifikasi langsung di Galaxy M32 dengan TalkBack menyala. Dijaga oleh tes
di `src/ui/label.test.ts`.

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
| 2.5.7 Gerakan seret | Tidak ada gestur seret sama sekali. Seluruh nominal dimasukkan lewat ketukan pada papan angka. |
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
