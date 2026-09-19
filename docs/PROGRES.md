# Catatan Progres Teknis

Tim **PenungguTokenReset** · IFEST 2026 · Disusun untuk dewan juri

---

## Ringkasan

Aplikasi SUDEPI **sudah lengkap dan terbukti berjalan utuh di perangkat
Android sungguhan**, dari Mode Siaga sampai layar Transaksi Selesai.

**Bobot model hasil pelatihan sudah terpasang** (18 September 2026, 20.35):
YOLOv8n 8 kelas terkuantisasi INT8, 3,1 MB. Ia lolos pemeriksaan bentuk
`[1, 12, 2100]`, termuat di Galaxy M32, dan menjalankan inferensi sungguhan —
terlihat di logcat sebagai `Handling local request:
https://localhost/model/sudepi.onnx` diikuti keputusan per bingkai.

Rantai di sekelilingnya — kamera, inferensi, penyaringan, suara, layar
pedagang, dan penyimpanan riwayat — sudah lebih dulu divalidasi memakai model
tiruan, dan pergantian ke bobot asli tidak menuntut satu baris perubahan kode
pun. Yang belum selesai sekarang adalah **kalibrasi dengan uang sungguhan**,
bukan integrasi.

| Ukuran | Angka |
| --- | --- |
| Tes otomatis | **219 lulus** |
| Berkas TypeScript | `strict` penuh, `tsc --noEmit` bersih |
| Keputusan terdokumentasi (ADR) | **8** |
| Potongan suara Indonesia | 34, dibundel dalam APK |
| Ukuran APK | 12,1 MB |
| Waktu build Android | 14 detik (setelah cache hangat) |
| Perangkat uji | Samsung Galaxy M32, Android 12 |

## Cara kami bekerja: diverifikasi, bukan diasumsikan

Setiap klaim di dokumen ini punya bukti yang bisa diulang. Kami tidak menulis
"seharusnya bekerja" — kami menjalankannya, dan mencatat apa yang terjadi.

Yang diperiksa langsung di perangkat, bukan disimpulkan dari kode:

- Kamera menyala dan menampilkan uang sungguhan
- 34 potongan suara termuat (`termuat=34 gagal=0`)
- TalkBack membacakan label, dan ketuk ganda berpindah fase
- Riwayat tersimpan di IndexedDB perangkat (`selesai` ×16, agregat harian)
- Siklus penuh Siaga → Pindai → Kalkulator → Kasir → Kembalian → Selesai → Siaga
- **Seluruh siklus itu berjalan dengan jaringan HP dimatikan total**

Cara ini mahal, tetapi ia menemukan sebelas kesalahan yang **tidak satu pun**
tertangkap oleh 210 tes otomatis. Bagian berikutnya menjelaskannya.

## Klaim terbesar proposal, akhirnya diuji

SUDEPI menjanjikan **100% luring**. Itu klaim yang paling sering diucapkan di
proposal, dan yang paling membedakannya dari Google Lookout maupun Seeing AI —
tetapi sampai hari ini belum pernah dibuktikan.

Kami mematikan WiFi dan data seluler pada perangkat, memastikan benar-benar
terputus (`ping 8.8.8.8` menjawab *Network is unreachable*), lalu menjalankan
satu transaksi utuh:

```
Siaga → Pindai → Kalkulator → Layar kasir → Cek kembalian → Selesai → Siaga
```

Seluruhnya berjalan. Model termuat, 34 potongan suara termuat
(`termuat=34 gagal=0`), dan **tidak ada satu pun percobaan akses jaringan yang
tercatat di logcat** — bukan sekadar "gagal dengan anggun", melainkan memang
tidak pernah mencoba.

Itu bukan kebetulan melainkan sifat arsitektur: tidak ada satu baris pun kode
jaringan di aplikasi ini, sehingga secara struktural tidak ada tempat untuk
pergi. Konsekuensinya juga menjawab risiko nomor 7 Lampiran 8 — riwayat
transaksi tidak mungkin bocor ke pihak ketiga, karena tidak ada pihak ketiga.

**Diulang dengan model asli, 18 September 2026.** WiFi dan data seluler
dimatikan lewat `adb` sampai `ping` menjawab `Network is unreachable`, lalu
transaksi dijalankan di perangkat. Transaksi penuh sampai "Transaksi selesai"
berhasil.

Yang dapat kami tunjukkan dari logcat secara langsung: pemuatan model,
inferensi, deteksi nominal, dan seluruh keluaran suara berjalan tanpa jaringan,
**tanpa satu pun percobaan koneksi dari proses aplikasi**. Bagian sisa alur
disaksikan langsung oleh penguji, bukan dibaca dari log — kami menuliskannya
apa adanya alih-alih mengklaim lebih.

Catatan sebelumnya tetap berlaku: pengujian luring pertama memakai model
tiruan karena bobot asli belum tersedia, dan yang dibuktikannya adalah
kemandirian dari jaringan, bukan akurasi deteksi.

## Sebelas kesalahan yang hanya ditemukan dengan menjalankan

Ini bagian yang paling ingin kami sampaikan, karena ia menjelaskan mengapa
verifikasi di perangkat tidak bisa digantikan tes.

**Semuanya gagal dalam diam.** Tidak ada pesan galat, tidak ada aplikasi
berhenti. Bagi pengguna tunanetra, kegagalan senyap adalah kegagalan yang tidak
bisa dipahami sama sekali — ia hanya mengetuk, dan tidak terjadi apa-apa.

| # | Kesalahan | Akibatnya bagi pengguna | Ditemukan lewat |
| --- | --- | --- | --- |
| 1 | Ketukan ditolak setelah nominal diucapkan | Mendengar "seratus ribu, lanjut", mengetuk, tidak terjadi apa-apa | Menelusuri antarmuka |
| 2 | Tombol bersarang di dalam tombol | Menekan "+50.000" justru **menunjukkan angka salah ke pedagang** | Menelusuri antarmuka |
| 3 | Label menjanjikan yang akan ditolak | Diundang mengetuk, lalu ditolak tanpa penjelasan | Menelusuri antarmuka |
| 4 | Path model salah diselesaikan di Web Worker | Model **tidak akan pernah ditemukan** saat diserahkan | Membaca logcat perangkat |
| 5 | Label bertabrakan dengan petunjuk TalkBack | Mendengar dua instruksi yang bertentangan | Uji dengan TalkBack |
| 6 | Aplikasi meredam suaranya sendiri | Suara nyaris tak terdengar tepat saat bicara | Uji dengar |
| 7 | Tingkat suara terlalu rendah | Tenggelam pada volume HP yang wajar | Uji dengar |
| 8 | Label mengulang nominal yang sudah diucapkan | Mendengar angka sama dua kali, dari dua suara | Uji dengar |
| 9 | Layar Selesai justru memulai transaksi baru | Label menjanjikan kembali ke siaga, kamera malah menyala lagi | Menelusuri di perangkat |
| 10 | Peringatan abstain diulang tiap bingkai | Kalimat memotong dirinya sendiri; **saluran suara tersumbat** | Uji dengan uang terlipat |
| 11 | Kamera hidup sekali saja per pembukaan aplikasi | Transaksi kedua mengarahkan uang ke alat yang **sudah tidak melihat** | Uji dua transaksi berturut-turut |

Nomor 10 dan 11 baru muncul setelah model asli terpasang, karena keduanya
menuntut transaksi sungguhan dari awal sampai akhir — bukan satu layar yang
diperiksa sendiri-sendiri.

**Nomor 10** hanya kentara pada uang TERLIPAT, sebab di situlah keyakinan
bertahan lama tepat di bawah ambang alih-alih melintasinya. Bingkai datang
sekitar sekali per 0,85 detik sementara kalimat peringatannya lebih panjang
dari itu, jadi tiap bingkai memotong ucapan sebelumnya di tengah kata. Bagi
orang awas ini menjengkelkan; bagi pengguna kami melumpuhkan, karena suara
adalah satu-satunya saluran keluaran yang mereka punya dan saluran itu jadi
tersumbat sampai kalimatnya tidak pernah utuh.

**Nomor 11** adalah kegagalan senyap yang paling mahal di seluruh daftar ini.
Layar kalkulator berada di cabang render berbeda dari pratinjau, sehingga React
membuat ulang elemen video setiap kali pengguna melewatinya — sementara
pemindai masih memegang elemen yang lama. Kamera tetap menyala di tingkat
sistem dan tidak ada satu pun galat; gambarnya hanya masuk ke elemen yang sudah
tidak ada di halaman. Bagi pengguna yang tidak bisa melihat layar, kamera mati
tampak sama persis dengan kamera yang belum menemukan uang.

Yang juga layak dicatat: dugaan pertama kami tentang nomor 11 keliru. Kami
menduga penolakan `play()`, memasang pencatatan untuk membuktikannya, dan
pencatatan itulah yang menunjukkan dugaan itu salah sekaligus mengarahkan ke
sebab sebenarnya.

Nomor 9 ditemukan lewat audit kecil: kami memeriksa frasa suara mana yang
dideklarasikan tetapi tidak pernah diucapkan. Dua di antaranya ternyata bukan
sisa kode, melainkan **fitur yang hilang** — salah satunya mitigasi risiko
nomor 2 di Lampiran 8 yang belum pernah diimplementasikan.

Nomor 2 dan 4 layak disorot.

**Nomor 2** adalah kebalikan dari seluruh tujuan produk ini: pengguna menekan
tombol untuk memasukkan total belanja, dan aplikasi justru menampilkan kembalian
yang salah kepada pedagang. Penyebabnya elemen `<button>` bersarang di dalam
`<button>` — sah menurut kompilator, terlarang menurut HTML, dan tak terlihat
dari kode.

**Nomor 4** akan meledak tepat pada detik bobot model diserahkan, yaitu saat
paling tidak ada waktu untuk mendiagnosisnya. Gejalanya hanya "kok tidak
mendeteksi apa-apa". Ditemukan karena kami membaca logcat perangkat, bukan
karena ada yang gagal.

## Satu diagnosis yang salah, dan koreksinya

Kami sempat menyimpulkan bahwa Chrome menolak format audio hasil render, dan
menuliskannya sebagai alasan di kode maupun di ADR-0003.

**Itu keliru.** Penelusuran lanjutan menunjukkan permintaan berkas audio di
peramban tersebut dikembalikan dengan status 204 dan nol byte — berkasnya tidak
pernah sampai ke pemroses audio, sementara `curl` ke alamat yang sama menerima
89.900 byte. Penyebabnya ada di peramban itu, bukan pada format audionya.

Alasan yang salah sudah diperbaiki di kedua tempat. Kami mencatatnya di sini
dengan sengaja: dokumen yang memuat alasan yang bisa dipatahkan lebih berbahaya
daripada dokumen yang tidak memberi alasan sama sekali.

## Delapan keputusan yang menyimpang dari proposal

Rinciannya di [`PERUBAHAN.md`](PERUBAHAN.md), ditulis dalam format
Architecture Decision Record. Ringkasnya:

| ADR | Keputusan | Sifat |
| --- | --- | --- |
| 0001 | Masukan model 320, bukan 640 | Memperkuat target latensi |
| 0002 | Ekspor tanpa NMS, NMS ditulis sendiri | Detail implementasi |
| 0003 | Audio pra-render, bukan TTS saat berjalan | Menjamin suara tetap ada |
| 0004 | Capacitor dikunci di versi 7 | Tidak mengubah klaim |
| 0005 | Input taktil jadi jalur utama | **Mempersempit klaim perintah suara** |
| 0006 | Tombol batal permanen | Melengkapi Escape-Hatch |
| 0007 | 8 kelas, tahun emisi tidak dipisah | Mengubah angka "15 kelas" |
| 0008 | Klik semantik, bukan deteksi ketuk ganda | Mewujudkan, bukan mengubah |

**Hanya ADR-0005 yang mengurangi cakupan.** Web Speech API mengirim audio ke
server untuk diproses, sehingga mustahil berjalan dalam janji 100% luring yang
justru menjadi pembeda utama SUDEPI. Kami memilih mempertahankan jaminan luring
dan menurunkan perintah suara menjadi fitur opsional — cakupan yang lebih
sempit tetapi benar, di atas cakupan yang lebih luas tetapi tidak jujur.

Dua yang paling menguntungkan:

**ADR-0007** menggabungkan tahun emisi karena sistem tidak pernah
mengucapkannya. Sampel per kelas menjadi dua kali lipat — keuntungan akurasi
terbesar yang bisa didapat tanpa menambah satu foto pun, dan paling terasa
justru pada uang lecek.

**ADR-0008** menemukan bahwa ketuk ganda yang dijanjikan proposal sudah menjadi
gestur aktivasi bawaan TalkBack. Menuliskan deteksinya sendiri justru akan
memaksa pengguna tunanetra melakukan ketuk ganda **dua kali**. Jadi janji itu
terpenuhi dengan tidak menulis kode gestur sama sekali.

## Yang membuat sistem ini boleh berkata tidak tahu

Empat saringan berurutan sebelum sebuah nominal boleh diucapkan:

1. **Confidence gating** — skor minimal 0,70 (dikalibrasi, ADR-0010)
2. **NMS class-agnostic, IoU > 0,40** — mencegah lembaran bertumpuk terhitung ganda
3. **Voting temporal, 3 dari 5 bingkai** — membunuh kedipan akibat guncangan tangan
4. **Konfirmasi pengguna** — nominal dikunci hanya setelah disetujui

Saringan ketiga yang sebenarnya mewujudkan janji anti salah-sebut. Keyakinan
0,9 pada satu bingkai bisa muncul dari kilatan cahaya; kesalahan seperti itu
tidak bertahan antar bingkai, sedangkan deteksi yang benar stabil selama uangnya
masih di depan kamera. Yang dituntut bukan keyakinan tinggi sesaat, melainkan
**kesepakatan**.

Gagal di tahap mana pun berarti Abstain: sistem berkata "belum yakin, coba
pindai lagi" dan mencatat kejadiannya. Abstain adalah keluaran yang sah, bukan
kegagalan.

Ada satu keadaan yang tidak bisa diselesaikan sistem sendiri, dan di situ ia
meminta bantuan. Ketika dua kotak deteksi bertumpang tindih berat, muncul
pertanyaan yang mustahil dijawab dari satu bingkai: itu satu lembar yang
terbaca dua kali, atau dua lembar yang bertumpuk? Sistem tidak menebak — ia
menyebut nominalnya lebih dulu, lalu berkata **"renggangkan lembarannya"**.
Pengguna menyelesaikannya dalam satu detik. Ini mitigasi risiko nomor 2 pada
Lampiran 8.

## Yang belum selesai

Ditulis apa adanya.

| Hal | Keadaan |
| --- | --- |
| Bobot model hasil pelatihan | **Sudah terpasang** dan berjalan di perangkat |
| Akurasi sesungguhnya | **Belum diukur.** Butuh uang sungguhan di depan kamera |
| Urutan kelas terhadap uang asli | **Terverifikasi** dengan uang fisik, 18 September 2026 |
| Uji mode pesawat dengan model asli | Belum diulang |
| Uji transaksi dengan layar tertutup telapak tangan | Belum |
| Kalibrasi ambang dengan uang lecek | Belum |
| Perintah suara (STT) | **Ada, luring**, dengan pengenal buatan sendiri. Perlu dilatih sekali per penutur; belum konsisten di lapangan (ADR-0013) |
| Mode daring (cadangan) | **Ada, baku MATI.** Dinyalakan sendiri lewat saklar di beranda (ADR-0015) |

**Urutan kelas adalah risiko terbesar yang pernah tersisa, dan ia sudah
ditutup.** Pemeriksaan bentuk memastikan keluaran model berukuran benar, tetapi
tidak bisa tahu apakah indeks ke-5 memang berarti Rp50.000. Kalau urutannya
tertukar, SUDEPI menyebut nominal yang salah **dengan penuh keyakinan** —
satu-satunya mode kegagalan yang tidak tertangkap kebijakan abstain.

Karena itu ia tidak diperiksa dengan skrip melainkan dengan uang fisik di depan
kamera, dan setiap pecahan disebut benar. Uang yang TERLIPAT ikut diuji, dan
justru dari situlah kesalahan nomor 10 di bawah ditemukan.

Pipeline sudah divalidasi memakai model tiruan, sehingga risiko integrasi
tinggal kecil. Yang tidak bisa dijamin sebelum model asli ada adalah akurasi —
dan itu memang hanya bisa diukur dengan uang sungguhan di depan kamera.

## Cara memeriksa klaim di dokumen ini

```bash
pnpm install
pnpm test          # 210 tes
pnpm typecheck     # tsc --noEmit
pnpm build         # bundel produksi
pnpm cap:run       # pasang ke HP Android terhubung

python model/periksa_kelas.py    # urutan kelas cocok dengan kontrak
python model/periksa_onnx.py public/model/sudepi.onnx
```

Riwayat commit sengaja ditulis panjang: setiap pesan commit menjelaskan bukan
hanya apa yang berubah, tetapi mengapa, dan apa yang sudah diverifikasi.

```bash
git log --format='%h  %s'
```
