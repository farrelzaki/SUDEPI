# Tempat bobot model

> **Sudah terisi.** `sudepi.onnx` berisi bobot asli hasil pelatihan (YOLOv8n
> 8 kelas, INT8, 3,1 MB), terpasang 18 September 2026. Model patokan berbobot
> acak beserta penanda `MODEL_TIRUAN` sudah dibuang. Bagian di bawah ini tetap
> disimpan sebagai rujukan bila model perlu dilatih ulang.

Letakkan berkas hasil training di sini, dengan nama persis:

```
public/model/sudepi.onnx
```

Vite menyalin seluruh isi `public/` apa adanya ke `dist/`, lalu Capacitor
memasukkannya ke APK. Tidak ada langkah lain yang perlu dijalankan.

## Sudah diverifikasi di HP sungguhan

Jalur pemuatannya sudah diuji di Galaxy M32 (Android 12) memakai berkas tiruan.
Log Capacitor menunjukkan permintaan sampai ke alamat yang benar:

```
Handling local request: https://localhost/model/sudepi.onnx
```

Jadi begitu berkas ONNX yang asli ditaruh di sini, ia akan termuat. Tidak ada
lagi yang perlu diubah di sisi kode.

## Spesifikasi yang tidak boleh meleset

Rinciannya beserta cara memverifikasi bentuk keluaran ada di
[`model/README.md`](../../model/README.md) bagian "Catatan dari Farrel".
Ringkasnya: 8 kelas, `imgsz=320`, `nms=False`, keluaran `[1, 12, 2100]`.
