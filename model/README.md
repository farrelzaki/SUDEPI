# Model SUDEPI

Pemilik pelaksanaan: **Fajar** · Pemilik rancangan pipeline: **Farrel**

> **Ini jalur kritis proyek.** Tanpa model, tidak ada produk. Semua pekerjaan
> lain punya jalan memutar; yang ini tidak. Kerjakan lebih dulu, dan jalankan
> trainingnya **sekarang** — sebagian besar waktunya adalah menunggu GPU, dan
> selama menunggu kamu bebas mengerjakan Capacitor.

---

## Targetnya apa

Satu berkas `sudepi.onnx` (dan `sudepi-int8.onnx` kalau lolos gerbang mutu)
yang diletakkan di `public/model/`, lalu dimuat ONNX Runtime Web di dalam
WebView.

| Sifat | Nilai | Kenapa |
| --- | --- | --- |
| Arsitektur | YOLOv8-Nano | Paling ringan yang masih akurat untuk CPU ponsel |
| Kelas | **8** | 7 pecahan + 1 koin. Lihat ADR-0007 |
| `imgsz` | **320** | Bukan 640. Lihat ADR-0001 |
| Ekspor | **`nms=False`** | NMS ditulis di TypeScript. Lihat ADR-0002 |
| Keluaran | `[1, 12, 2100]` | 8 kelas + 4 koordinat = 12 kanal |

Ketiga angka bertanda tebal itu tidak boleh diubah tanpa membaca ADR-nya
lebih dulu. Semuanya punya alasan yang sudah diverifikasi.

## Urutan kelas — jangan sampai salah

**WAJIB** sama persis dengan `TABEL_DENOMINASI` di `src/contracts/uang.ts`:

```yaml
names:
  0: rp1000
  1: rp2000
  2: rp5000
  3: rp10000
  4: rp20000
  5: rp50000
  6: rp100000
  7: koin
```

Kalau urutannya bergeser satu saja, SUDEPI akan menyebut nominal yang salah
**dengan penuh keyakinan**, dan orang yang tidak bisa memeriksa ulang akan
mempercayainya. Ini kegagalan paling berbahaya yang bisa terjadi pada produk
ini, dan ia tidak akan tertangkap oleh tes mana pun — hanya oleh uang sungguhan
di depan kamera.

Periksa ulang `data.yaml` sebelum menekan train.

## Langkah

### 1. Dataset

Mulai dari dataset Rupiah publik di Roboflow Universe, jangan mengumpulkan dari
nol:

- [Indonesia Rupiah Detection](https://universe.roboflow.com/indonesia-rupiah-currency-dataset/indonesia-rupiah-detection) — ±1.143 citra, pecahan 1.000 sampai 50.000
- [indonesia banknote 2022](https://universe.roboflow.com/agil-skripsi-3/indonesia-banknote-2022)
- [Indonesian Banknotes](https://universe.roboflow.com/orbitaibanknotes/indonesian-banknotes)

Unduh dalam format **YOLOv8**, lalu **petakan ulang nama kelasnya** ke skema di
atas. Dataset publik biasanya memisahkan emisi atau memakai nama berbeda;
gabungkan ke 7 kelas nominal.

**Dua kelas yang kemungkinan besar tidak tercakup dan harus kita foto sendiri:**

- **Rp100.000** — tidak ada di dataset 1.143 citra itu
- **koin** — hampir pasti tidak ada di dataset mana pun

Untuk keduanya, potret sekitar 80–150 citra per kelas dengan variasi sudut,
jarak, latar, dan pencahayaan. Sertakan juga **uang lecek, terlipat, dan
kondisi redup** — itu justru kasus yang kita klaim kuat di proposal, dan
dataset publik cenderung berisi uang mulus di latar bersih.

### 2. Training

Jalankan di Google Colab dengan GPU T4 (gratis). Notebook: `latih.ipynb`.

```python
from ultralytics import YOLO

model = YOLO('yolov8n.pt')
model.train(
    data='data.yaml',
    imgsz=320,          # ADR-0001
    epochs=100,
    batch=64,           # 320px ringan, batch besar aman di T4
    patience=25,
    degrees=10, shear=5, perspective=0.0005,   # uang dipegang miring
    hsv_v=0.5,          # lapak pasar temaram
    fliplr=0.5,
    mosaic=1.0,
    close_mosaic=15,
)
```

Perkiraan waktu: **30–45 menit** untuk 100 epoch pada imgsz 320 di T4. Pada 640
angkanya sekitar 2 jam — inilah salah satu keuntungan ADR-0001 yang tidak
langsung terlihat.

Jangan tunggu selesai sambil menatap layar. Nyalakan, lalu kerjakan Capacitor.

### 3. Ekspor

```bash
yolo export model=runs/detect/train/weights/best.pt \
  format=onnx imgsz=320 opset=12 simplify=True nms=False dynamic=False
```

`nms=False` itu wajib, bukan preferensi. Operator NMS hasil ekspor tidak
seluruhnya didukung backend WASM, dan kita butuh IoU class-agnostic yang bisa
dikalibrasi tanpa mengekspor ulang. Lihat ADR-0002.

### 4. Kuantisasi INT8 dan gerbang mutu

```python
from onnxruntime.quantization import quantize_static, CalibrationDataReader
# kalibrasi STATIS dengan ~200 citra dari set validasi, bukan dinamis
```

**Gerbang mutu yang wajib dipatuhi:**

> Ukur mAP@0.5 model INT8 terhadap model FP32 pada set validasi yang sama.
> **Kalau turun lebih dari 3 poin, buang INT8 dan kirim FP32.**

YOLOv8n FP32 berukuran sekitar 12 MB — masih sangat wajar dibundel dalam APK.
Angka "~6 MB" di exsum adalah target, bukan janji yang boleh menggerus akurasi.
Hemat 6 MB tidak sebanding dengan salah menyebut nominal uang orang.

### 5. Serahkan

Letakkan berkas final di `public/model/sudepi.onnx`, lalu bilang ke Farrel.
Catat juga di `versi_model`: ukuran, checksum, jumlah kelas, dan mAP-nya.

## Kalau waktunya mepet

Urutan prioritas kalau harus memotong:

1. **Model apa pun yang jalan** mengalahkan model sempurna yang belum selesai.
   Latih pada dataset publik apa adanya dulu, walau tanpa 100.000 dan koin.
2. Tambahkan **Rp100.000** — pecahan ini terlalu sering dipakai untuk dilewat.
3. Tambahkan **koin**. Kalau benar-benar tidak sempat, presensi koin masih bisa
   diturunkan dari selisih di `core/koin.ts` tanpa mendeteksi koin sama sekali;
   yang hilang hanya konfirmasi visualnya.
4. Terakhir, perkaya dengan uang lecek.

Sampaikan sejujurnya ke Farrel sampai mana yang sempat dikerjakan, supaya
ambang keyakinan dikalibrasi sesuai kenyataan — bukan sesuai harapan.

---

## Catatan dari Farrel — 18 September 2026

Ditulis di sini, bukan lewat chat, supaya agen AI-mu ikut membacanya.

### Aplikasinya sudah selesai dan menunggu modelmu

Seluruh alur Fase 1 sampai 4 sudah jadi, teruji 174 tes, dan sudah ditelusuri
langsung di browser sampai layar SELESAI. APK juga sudah terbentuk.

**Satu-satunya yang menghambat sekarang adalah bobot model.** Begitu ada, aku
tinggal menaruhnya dan menjalankan.

### Yang harus kamu serahkan

Satu berkas di lokasi ini, persis:

```
public/model/sudepi.onnx
```

Spesifikasinya tidak boleh meleset:

| Hal | Nilai | Kalau meleset |
| --- | --- | --- |
| Jumlah kelas | **8** | Bentuk keluaran berubah, decode gagal total |
| `imgsz` | **320** | Latensi melewati anggaran, atau kotak salah posisi |
| NMS | **`nms=False`** | Operator tidak didukung WASM, model gagal dimuat |
| Bentuk keluaran | `[1, 12, 2100]` | Kalau berbeda, berarti salah satu di atas meleset |

### Bahaya terbesar: urutan kelas

`data.yaml` **wajib** persis seperti ini, dan urutannya menentukan segalanya:

```yaml
names:
  0: rp1000
  1: rp2000
  2: rp5000
  3: rp10000
  4: rp20000
  5: rp50000
  6: rp100000
  7: koin
```

Kalau bergeser satu saja, SUDEPI akan menyebut nominal yang salah **dengan
penuh keyakinan**. Tidak ada satu pun dari 174 tes yang bisa menangkapnya —
hanya uang sungguhan di depan kamera. Ini kegagalan paling berbahaya yang bisa
terjadi pada produk ini.

Periksa ulang berkas itu sebelum menekan train, lalu periksa sekali lagi
sesudahnya.

### Berkas bantu yang sudah disiapkan Farrel

Tiga berkas di folder ini dipegang Farrel, bukan kamu. Pakai apa adanya; kalau
terasa ada yang salah, bilang, jangan perbaiki sendiri.

| Berkas | Gunanya |
| --- | --- |
| `data.yaml` | Konfigurasi dataset dengan urutan 8 kelas yang benar |
| `periksa_kelas.py` | Memastikan `data.yaml` cocok dengan kontrak aplikasi |
| `petakan_dataset.py` | Memetakan nama kelas dataset publik ke skema kita |

**Alur pemakaiannya:**

```bash
# 1. Lihat dulu apa yang akan dipetakan. Tidak mengubah apa pun.
python model/petakan_dataset.py dataset/

# 2. Kalau laporannya benar, baru terapkan. Label lama dicadangkan otomatis.
python model/petakan_dataset.py dataset/ --terapkan

# 3. WAJIB, sebelum menekan train.
python model/periksa_kelas.py
```

`periksa_kelas.py` keluar dengan kode 1 kalau urutannya tidak cocok, jadi bisa
dipasang sebagai syarat di notebook-mu. Ia sudah diuji menangkap pertukaran
20.000 dengan 50.000.

`petakan_dataset.py` sengaja **menolak menebak**. Nama kelas yang tidak
dikenali membuatnya berhenti dengan exit 1 tanpa menyentuh satu berkas pun,
dan memintamu menambahkan polanya. Kelas yang salah dipetakan tidak
menghasilkan galat apa pun — training tetap jalan, mAP tetap bagus, lalu
aplikasi menyebut nominal yang salah dengan penuh keyakinan.

Skrip itu juga melaporkan **kelas yang tidak punya satu pun contoh**. Pada
dataset publik biasanya `koin` dan `rp100000` kosong — itu yang harus kita
foto sendiri.

### Cara cepat memastikan modelmu benar

Setelah ekspor, jalankan ini:

```python
import onnxruntime as ort
s = ort.InferenceSession('sudepi.onnx')
print(s.get_inputs()[0].shape)    # harus [1, 3, 320, 320]
print(s.get_outputs()[0].shape)   # harus [1, 12, 2100]
```

Kalau kanalnya bukan 12, jumlah kelasmu bukan 8. Kalau jangkarnya bukan 2100,
`imgsz`-mu bukan 320.

### Kalau waktumu mepet

Urutan prioritas sudah ditulis di bagian "Kalau waktunya mepet" di atas. Yang
paling penting: **model apa pun yang jalan mengalahkan model sempurna yang
belum selesai.** Serahkan yang ada lebih dulu, perbaiki belakangan — aku bisa
langsung memasangnya dan kita tahu lebih awal kalau ada yang tidak cocok.

Sampaikan sejujurnya sampai mana yang sempat dikerjakan, supaya ambang
keyakinan dikalibrasi sesuai kenyataan, bukan sesuai harapan.
