# Skenario Demo & Daftar Periksa Penjurian

Status: **aktif** · Dipakai pada jam 19 sampai 24

> Dokumen ini dibaca dalam keadaan lelah dan tertekan. Karena itu sengaja
> dibuat pendek dan berbentuk daftar centang, bukan penjelasan.

---

## Persiapan perangkat (selesaikan di jam 19)

- [ ] APK rilis terpasang di **HP demo utama**
- [ ] APK rilis terpasang di **HP cadangan** (HP yang berbeda, bukan cadangan dari merek yang sama)
- [ ] Kedua HP: **mode pesawat menyala**, Wi-Fi mati, data seluler mati
- [ ] Kedua HP: baterai di atas 80%, mode hemat daya **mati**
  (mode hemat daya membatasi CPU dan merusak latensi inferensi)
- [ ] Kedua HP: kecerahan layar maksimum, rotasi otomatis **mati**
- [ ] Kedua HP: TalkBack dapat dinyalakan dengan pintasan, dan sudah dicoba
- [ ] Lensa kamera dibersihkan
- [ ] Uang peraga siap: **kondisi bagus** dan **kondisi lecek**, keduanya
- [ ] Beberapa keping koin siap
- [ ] APK tersalin ke flashdisk sebagai cadangan terakhir

## Naskah demo utama (target 90 detik)

Latih sampai bisa tanpa membaca. Sebutkan angkanya dengan lantang saat
melakukan, supaya juri bisa mengikuti tanpa melihat layar kecil.

| # | Tindakan | Yang seharusnya terjadi | Kalimat untuk juri |
| --- | --- | --- | --- |
| 1 | Buka aplikasi | Kamera langsung hidup, suara "arahkan kamera" | "Tidak ada layar masuk. Kamera langsung siap." |
| 2 | Bidik **tiga lembar** uang sekaligus | Menyebut tiap nominal, lalu totalnya | "Multi-lembar sekaligus. Google Lookout hanya bisa satu per satu." |
| 3 | Ketuk dua kali | Masuk kalkulator, bergetar | "Ketuk ganda. Gestur yang sama dengan TalkBack." |
| 4 | Masukkan total belanja lewat roda taktil | Angka diucapkan tiap perubahan | "Tanpa mencari tombol. Cukup putar." |
| 5 | Konfirmasi | Kembalian dihitung dan diucapkan | "Di bawah lima belas detik sejak pindai." |
| 6 | Balik layar ke arah juri | Angka 72 pt terbaca dari jarak satu meter | "Ini yang dilihat pedagang. Transparansi dua arah." |
| 7 | Bidik uang kembalian + koin | Menyebut nominal kertas, lalu menyimpulkan nilai koin | "Koin tidak dideteksi nilainya, tapi diturunkan dari selisih." |
| 8 | Selesai | "Transaksi selesai", kembali ke Mode Siaga | — |

## Demo yang justru paling meyakinkan

Kalau hanya sempat menunjukkan satu hal tambahan, tunjukkan ini.

**Demo Abstain.** Bidik uang yang sangat lecek, atau bidik dengan tangan
sengaja bergoyang. Sistem **tidak** menyebut nominal apa pun, melainkan berkata
"belum yakin, coba pindai lagi".

Lalu katakan:

> "Sistem kami boleh berkata tidak tahu. Untuk pengguna yang tidak bisa
> memeriksa ulang jawaban kami, menebak itu lebih berbahaya daripada diam."

Ini yang membedakan SUDEPI dari prototipe pembaca uang lainnya, dan inilah
bagian yang paling sulit ditiru. Sebagian besar tim akan menampilkan deteksi
yang berhasil. Menampilkan kegagalan yang **ditangani dengan benar** adalah
sinyal kematangan rekayasa yang jauh lebih kuat.

**Demo mode pesawat.** Perlihatkan ikon pesawat di bilah status sebelum mulai.
Butuh tiga detik, dan langsung membuktikan klaim terbesar di proposal.

Jalur ini **sudah pernah diuji dan lulus**: seluruh siklus Fase 1 sampai 4
berjalan dengan WiFi dan data seluler dimatikan, tanpa satu pun percobaan akses
jaringan tercatat di logcat. Jadi saat demo kamu tidak sedang berharap, kamu
sedang mengulang sesuatu yang sudah terbukti.

## Kalau ada yang gagal saat demo

- **Deteksi meleset:** jangan diulang-ulang berkali-kali. Katakan
  "ini kondisi cahaya yang sulit", geser ke tempat lebih terang, lanjutkan.
  Panik yang terlihat lebih merugikan daripada satu deteksi yang gagal.
- **Aplikasi berhenti paksa:** buka lagi. Aplikasi mulai dari Mode Siaga tanpa
  kehilangan apa pun. Sebutkan bahwa tidak ada state yang hilang karena semua
  tersimpan lokal.
- **HP utama bermasalah:** pindah ke HP cadangan tanpa banyak komentar.
  Lanjutkan seolah memang direncanakan.
- **Fitur yang dipotong ditanyakan juri:** jawab dengan menunjuk ADR-nya.
  "Kami memutuskan itu di ADR-0005, ini alasannya." Keputusan yang
  terdokumentasi menunjukkan pertimbangan; alasan yang dikarang di tempat
  menunjukkan sebaliknya.

## Pertanyaan yang mungkin ditanyakan juri

| Pertanyaan | Jawaban singkat |
| --- | --- |
| "Kenapa tidak sesuai proposal?" | Tunjuk `docs/PERUBAHAN.md`. Enam keputusan, lima memperkuat, satu mempersempit dan alasannya ada. |
| "Kenapa perintah suaranya tidak ada?" | ADR-0005. Web Speech API mengirim audio ke server; kami memilih mempertahankan jaminan luring. Vosk adalah rencana setelah lomba. |
| "Bagaimana kalau salah sebut nominal?" | Rantai empat saringan, lalu abstain. Tunjukkan demonya langsung. |
| "Bedanya dengan Google Lookout?" | Multi-lembar, kalkulator kembalian, dan layar pedagang. Lookout tidak punya ketiganya. |
| "Kenapa modelnya bukan 640?" | ADR-0001. Uang adalah objek besar; 640 terbuang percuma, dan 320 membuat target latensi tercapai tanpa multithread. |
| "Datanya disimpan di mana?" | IndexedDB di perangkat. Tidak ada satu pun panggilan jaringan di seluruh kode. |

## Uji akhir sebelum tidur (jam 22)

Jalankan naskah demo utama **tiga kali berturut-turut tanpa satu pun
kegagalan**, di HP demo utama, dalam mode pesawat.

Kalau ada satu saja yang gagal, itu bukan "nanti juga beres". Perbaiki, lalu
ulangi ketiganya dari awal.

- [ ] Percobaan 1 lulus
- [ ] Percobaan 2 lulus
- [ ] Percobaan 3 lulus
- [ ] Diulang di HP cadangan, minimal satu kali lulus
- [ ] Diulang dengan TalkBack menyala, minimal satu kali lulus
