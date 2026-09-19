# Catatan Perubahan terhadap Executive Summary

Tim **PenungguTokenReset** · IFEST 2026 · IPB University

---

## Dasar dokumen ini

Panitia menyatakan implementasi tidak harus sama persis dengan executive
summary, dengan syarat **setiap penyimpangan didokumentasikan**. Dokumen ini
adalah pemenuhan syarat tersebut.

Kami memilih tidak menulisnya sebagai catatan bebas, melainkan memakai format
**Architecture Decision Record (ADR)** dari Michael Nygard — standar yang lazim
dipakai industri untuk merekam keputusan arsitektur. Setiap penyimpangan berdiri
sebagai satu berkas dengan empat bagian tetap: **Konteks, Keputusan,
Konsekuensi, Alternatif yang ditolak.**

Alasannya sederhana. Kalau juri bertanya "kenapa tidak sesuai proposal?", kami
tidak ingin menjawab dengan ingatan. Kami ingin menunjuk sebuah catatan yang
ditulis **pada saat keputusan diambil**, lengkap dengan apa yang kami ketahui
saat itu dan apa yang kami korbankan. Setiap perubahan di sini muncul dari
verifikasi teknis, bukan dari kekurangan waktu.

## Cara membaca

Setiap ADR punya status:

| Status | Arti |
| --- | --- |
| `Diusulkan` | Sedang dipertimbangkan, belum dilaksanakan. |
| `Diterima` | Berlaku. Kode mengikuti keputusan ini. |
| `Ditolak` | Dipertimbangkan lalu tidak dipilih. Tetap disimpan, karena alasan penolakan sama berharganya. |
| `Digantikan oleh ADR-XXXX` | Pernah berlaku, kini diganti keputusan lain. |

**ADR tidak pernah dihapus dan tidak pernah disunting setelah `Diterima`.**
Kalau keputusan berubah, tulis ADR baru yang menggantikannya. Riwayat yang
bisa dihapus bukan riwayat.

## Daftar keputusan

| No | Judul | Status | Dampak terhadap exsum |
| --- | --- | --- | --- |
| [0001](perubahan/0001-ukuran-masukan-model-320.md) | Ukuran masukan model 320, bukan 640 | Diterima | Memperkuat target latensi di Bab II |
| [0002](perubahan/0002-ekspor-onnx-tanpa-nms.md) | Ekspor ONNX tanpa NMS, NMS ditulis di TypeScript | Diterima | Detail implementasi filter IoU Bab III |
| [0003](perubahan/0003-audio-pra-render.md) | Audio pra-render menggantikan text-to-speech langsung | Diterima + amandemen | Mengubah cara "Voice" pada judul diwujudkan |
| [0004](perubahan/0004-kunci-capacitor-7.md) | Capacitor dikunci di versi 7, bukan 8 | Diterima + amandemen | Tidak mengubah klaim exsum |
| [0005](perubahan/0005-input-taktil-utama.md) | Input taktil jadi jalur utama, perintah suara jadi opsional | Diterima | **Mengubah klaim "voice command" Bab III Fase 2** |
| [0006](perubahan/0006-tombol-batal-permanen.md) | Tombol batal permanen mendampingi gestur tahan 2 detik | Diterima | Melengkapi Escape-Hatch Bab III Fase 3 |
| [0007](perubahan/0007-delapan-kelas-tanpa-pisah-emisi.md) | Pakai 8 kelas, jangan pisahkan tahun emisi | Diterima | **Mengubah angka "15 kelas" di Bab II, Bab III, Lampiran 7** |
| [0008](perubahan/0008-aktivasi-klik-semantik.md) | Pakai satu klik semantik, jangan deteksi ketuk ganda sendiri | Diterima | Cara "double tap" Bab III diwujudkan, bukan diubah |
| [0009](perubahan/0009-latensi-inferensi-sebenarnya.md) | Latensi inferensi sebenarnya ~700 ms, bukan di bawah 250 ms | **DITUNDA** | **Mengubah angka latensi di Bab II** |
| [0010](perubahan/0010-kalibrasi-ambang-keyakinan-070.md) | Kalibrasi ambang keyakinan menjadi 0,70 untuk multi-uang dan koin | Diterima + amandemen | **Mengubah angka ambang 0,85 di Bab II, Bab III, Lampiran 7** |
| [0011](perubahan/0011-antarmuka-berlangkah-ala-android.md) | Antarmuka berlangkah ala Android menggantikan pola dua tombol | Diterima | Mewujudkan rancangan Lampiran 5 dengan bentuk yang lebih dikenal pengguna |
| [0012](perubahan/0012-voting-per-objek.md) | Kesepakatan temporal dihitung per objek, bukan per himpunan | Diterima | Mewujudkan deteksi multi-lembar Bab III Fase 1 |
| [0013](perubahan/0013-perintah-suara-luring.md) | Perintah suara luring dengan pengenal kosakata tertutup | Diterima | **Memulihkan klaim "voice command" Bab III Fase 2** yang sempat dicabut ADR-0005 |
| [0014](perubahan/0014-alat-baca-terpisah-dari-transaksi.md) | Alat baca uang berdiri sendiri, terpisah dari alur transaksi | Diterima | **Mengubah urutan Fase 1–4 Bab III**: uang dibayarkan kini diketik, bukan dipindai |
| [0015](perubahan/0015-mode-daring-sebagai-cadangan.md) | Mode daring sebagai cadangan, luring tetap jalur baku | Diterima | **Mengubah cara klaim "100% Offline-First" Bab I dan II harus dibaca** |

## Ringkasan bagi juri

Dari delapan keputusan di atas, **hanya ADR-0005 yang mengurangi cakupan** yang
dijanjikan proposal, dan pengurangan itu berasal dari keterbatasan platform
yang tidak bisa disiasati: Web Speech API di Android WebView mengirim audio ke
server Google untuk diproses, sehingga mustahil berjalan dalam janji
"100% luring" yang justru menjadi nilai jual utama SUDEPI. Kami memilih
mempertahankan jaminan luring dan menurunkan perintah suara menjadi fitur
opsional, bukan sebaliknya.

ADR-0007 mengubah angka "15 kelas" menjadi 8, tetapi **tidak** mengurangi uang
yang dikenali: TE 2016 dan TE 2022 tetap sama-sama terdeteksi, hanya tidak
diberi label terpisah. Karena tahun emisi tidak pernah diucapkan kepada
pengguna, menggabungkannya justru menggandakan sampel per kelas dan menaikkan
akurasi — terutama pada uang lecek, kasus yang justru kami klaim kuat.

ADR-0008 justru membuat ketuk ganda di exsum terwujud **persis seperti
bunyinya**, karena TalkBack sudah menerjemahkan ketuk ganda pengguna menjadi
satu peristiwa klik. Menuliskan deteksi sendiri malah akan memaksa pengguna
TalkBack melakukan ketuk ganda dua kali.

Lima keputusan lainnya **memperkuat** klaim proposal: ADR-0001 dan 0002 membuat
target latensi di bawah 250 ms benar-benar tercapai alih-alih sekadar
diharapkan; ADR-0003 membuat keluaran suara berjalan pasti tanpa bergantung
pada paket suara yang mungkin tidak terpasang di HP penguji; ADR-0006 membuat
pembatalan darurat tetap dapat diakses pengguna TalkBack, yang justru target
pengguna utama kami.

## Kapan wajib menulis ADR baru

Tulis ADR kalau keputusanmu memenuhi salah satu:

- Berbeda dari yang tertulis di executive summary, sekecil apa pun.
- Mengubah angka yang dijanjikan (latensi, ambang, akurasi, ukuran model).
- Mengubah cara pengguna berinteraksi dengan sistem.
- Mengganti atau membuang teknologi yang disebut namanya di exsum.

**Tidak perlu** ADR untuk: pilihan nama variabel, struktur folder, pustaka
pembantu kecil yang tidak disebut exsum, atau perbaikan bug.

## Membuat ADR baru

Salin `perubahan/0000-template.md`, beri nomor urut berikutnya, isi keempat
bagiannya, lalu tambahkan barisnya ke tabel di atas. Judul ditulis sebagai
frasa perintah yang pendek, seperti pesan commit.

**Bagian "Alternatif yang ditolak" jangan dikosongkan.** Bagian itulah yang
membedakan sebuah keputusan dari sekadar hal yang kebetulan terjadi, dan
bagian itu pula yang paling sering ditanyakan juri.
