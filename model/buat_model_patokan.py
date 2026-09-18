"""
Membuat YOLOv8n berbobot ACAK untuk mengukur latensi sungguhan.

    python model/buat_model_patokan.py

Menghasilkan `public/model/sudepi.onnx` dengan arsitektur YOLOv8n yang
sebenarnya, 8 kelas, `imgsz=320`, `nms=False` — persis seperti model asli
nanti, hanya bobotnya belum dilatih.

=============================== KENAPA PERLU ===============================

Exsum menjanjikan latensi inferensi **di bawah 250 ms**, dan itu angka yang
paling sering diucapkan di Bab II. Sampai sekarang belum pernah diukur.

`buat_model_uji.py` tidak bisa menjawabnya: model itu hanya mengeluarkan
konstanta tanpa menghitung apa pun, sehingga latensi yang terbaca darinya
mendekati nol dan tidak berarti apa-apa.

Model ini punya beban komputasi yang SAMA dengan model asli, karena
arsitekturnya memang sama. Latensi yang terukur dengannya adalah latensi yang
akan dialami pengguna.

Yang TIDAK bisa dijawabnya: akurasi. Bobotnya acak, jadi deteksinya sampah.
Gunanya murni mengukur kecepatan.

Kalau hasilnya melampaui 250 ms di HP sasaran, kita masih punya waktu memilih:
menurunkan `imgsz` ke 256, menurunkan laju bingkai, atau menerima angka yang
lebih tinggi dan menyebutkannya terus terang. Mengetahuinya sekarang jauh lebih
murah daripada mengetahuinya pada jam ke-20.

JANGAN dipakai demo, sama seperti buat_model_uji.py.

============================================================================
"""

import re
import sys
import tempfile
from pathlib import Path

try:
    import ultralytics
    from ultralytics import YOLO
except ImportError:
    sys.exit("Butuh ultralytics. Jalankan: python -m pip install ultralytics")

AKAR = Path(__file__).resolve().parent.parent
TUJUAN = AKAR / "public" / "model" / "sudepi.onnx"
PENANDA = AKAR / "public" / "model" / "MODEL_TIRUAN"

UKURAN = 320  # ADR-0001
KELAS = 8     # ADR-0007


def arsitektur_8_kelas() -> Path:
    """
    Menyalin yolov8.yaml bawaan lalu mengganti `nc` menjadi 8.

    Percobaan pertama memakai `YOLO("yolov8n.yaml").model.nc = 8`, dan itu
    TIDAK bekerja — atribut itu diubah setelah jaringan terlanjur dibangun,
    sehingga kepalanya tetap 80 kelas. Ketahuan karena `periksa_onnx.py`
    melaporkan 84 kanal, bukan 12.

    Jumlah kelas harus sudah benar sejak berkas arsitektur dibaca.
    """
    asal = Path(ultralytics.__file__).parent / "cfg" / "models" / "v8" / "yolov8.yaml"
    teks = re.sub(r"^nc:\s*\d+", f"nc: {KELAS}", asal.read_text(encoding="utf-8"), count=1, flags=re.M)

    # Nama berkas diakhiri "n" supaya ultralytics memilih skala nano.
    tujuan = Path(tempfile.mkdtemp()) / "sudepi_patokann.yaml"
    tujuan.write_text(teks, encoding="utf-8")
    return tujuan


def main() -> None:
    # Dibangun dari berkas arsitektur, BUKAN dari bobot terlatih — jaringannya
    # berbobot acak. Itu yang kita mau: yang diukur adalah beban komputasinya,
    # bukan kepandaiannya.
    yaml = arsitektur_8_kelas()
    print(f"Membangun YOLOv8n dengan {KELAS} kelas, bobot acak...")
    yolo = YOLO(str(yaml))

    print(f"Mengekspor ke ONNX: imgsz={UKURAN}, nms=False, opset=12")
    jalur = Path(
        yolo.export(
            format="onnx",
            imgsz=UKURAN,
            opset=12,
            simplify=True,
            nms=False,
            dynamic=False,
            verbose=False,
        )
    )

    TUJUAN.parent.mkdir(parents=True, exist_ok=True)
    jalur.replace(TUJUAN)

    PENANDA.write_text(
        "Berkas public/model/sudepi.onnx saat ini adalah MODEL PATOKAN.\n"
        "Arsitekturnya YOLOv8n sungguhan tetapi bobotnya ACAK — deteksinya\n"
        "sampah. Gunanya hanya mengukur latensi inferensi yang sebenarnya.\n"
        "Hapus berkas ini dan sudepi.onnx begitu model asli tersedia.\n",
        encoding="utf-8",
    )

    ukuran = TUJUAN.stat().st_size / 1024 / 1024
    print(f"\nDitulis : {TUJUAN}  ({ukuran:.1f} MB)")
    print(f"Penanda : {PENANDA}")
    print()
    print("Sekarang pasang ke HP dan baca angka latensi di pratinjau:")
    print("  pnpm build && npx cap sync android && npx cap run android")
    print()
    print("INI BUKAN PENDETEKSI UANG. Bobotnya acak. Jangan dipakai demo.")


if __name__ == "__main__":
    main()
