"""
Mengekspor bobot hasil training menjadi ONNX siap pakai, lengkap dengan
kuantisasi INT8 dan gerbang mutu.

    python model/ekspor.py runs/detect/train/weights/best.pt
    python model/ekspor.py best.pt --lewati-int8

Menghasilkan `public/model/sudepi.onnx` — langsung di tempat yang dibaca
aplikasi, tanpa perlu menyalin manual.

KENAPA SKRIP INI ADA. Langkah ekspor punya empat cara gagal sekaligus, dan
tidak satu pun menghasilkan galat yang jelas:

    imgsz salah   -> kotak muncul di posisi acak
    nms=True      -> model gagal dimuat di WASM (ADR-0002)
    dynamic=True  -> bentuk tensor jadi simbolik
    INT8 buruk    -> akurasi anjlok tanpa pesan apa pun

Tiga yang pertama dicegah dengan mengunci parameternya di sini, sehingga tidak
bisa salah ketik. Yang keempat dicegah gerbang mutu di bawah.

GERBANG MUTU INT8. Kuantisasi menukar ukuran dengan akurasi, dan pertukaran itu
tidak selalu menguntungkan. Skrip ini mengukur mAP@0.5 model INT8 terhadap
model FP32 pada set validasi yang sama, lalu MENOLAK INT8 kalau turun lebih
dari 3 poin.

Model FP32 YOLOv8n berukuran sekitar 12 MB — masih sangat wajar dibundel dalam
APK yang sudah 12 MB karena runtime WASM. Angka "~6 MB" di exsum adalah target,
bukan janji yang boleh menggerus akurasi. Hemat 6 MB tidak sepadan dengan salah
menyebut nominal uang orang.
"""

import shutil
import subprocess
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(__file__).resolve().parent
TUJUAN = AKAR / "public" / "model" / "sudepi.onnx"
DATA_YAML = MODEL_DIR / "data.yaml"

# Dikunci di sini supaya tidak bisa salah ketik. Jangan ubah tanpa membaca ADR.
UKURAN_MASUKAN = 320  # ADR-0001
PAKAI_NMS = False     # ADR-0002
OPSET = 12
DINAMIS = False

# Batas penurunan mAP yang masih boleh diterima demi ukuran lebih kecil.
AMBANG_TURUN_MAP = 3.0


def jalankan_periksa_kelas() -> None:
    """Menolak melanjutkan kalau data.yaml tidak cocok dengan kontrak."""
    print("== Memeriksa urutan kelas ==")
    hasil = subprocess.run(
        [sys.executable, str(MODEL_DIR / "periksa_kelas.py")],
        capture_output=True,
        text=True,
    )
    print(hasil.stdout.rstrip())
    if hasil.returncode != 0:
        print(hasil.stderr.rstrip())
        sys.exit(
            "\nBERHENTI. Jangan mengekspor model yang urutan kelasnya tidak "
            "cocok dengan aplikasi."
        )


def ukur_map(model, data: str) -> float:
    """mAP@0.5 pada set validasi. Dipakai untuk membandingkan FP32 dan INT8."""
    hasil = model.val(data=data, imgsz=UKURAN_MASUKAN, verbose=False)
    return float(hasil.box.map50) * 100


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    bobot = Path(sys.argv[1]).resolve()
    lewati_int8 = "--lewati-int8" in sys.argv

    if not bobot.exists():
        sys.exit(f"Tidak menemukan bobot: {bobot}")

    # Penjaga kelas dijalankan LEBIH DULU, sebelum impor apa pun yang berat.
    # Ia penjaga paling mendasar di seluruh pipeline dan harus tetap bekerja
    # walaupun ultralytics belum terpasang — kalau tidak, pesan galat yang
    # muncul adalah soal paket yang kurang, bukan soal urutan kelas yang salah.
    jalankan_periksa_kelas()

    try:
        from ultralytics import YOLO
    except ImportError:
        sys.exit("Butuh ultralytics. Jalankan: python -m pip install ultralytics")

    print(f"\n== Mengekspor {bobot.name} ==")
    print(f"   imgsz={UKURAN_MASUKAN}  nms={PAKAI_NMS}  opset={OPSET}  "
          f"dynamic={DINAMIS}")

    model = YOLO(str(bobot))
    jalur_onnx = Path(
        model.export(
            format="onnx",
            imgsz=UKURAN_MASUKAN,
            opset=OPSET,
            simplify=True,
            nms=PAKAI_NMS,
            dynamic=DINAMIS,
        )
    )

    TUJUAN.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(jalur_onnx, TUJUAN)
    ukuran_fp32 = TUJUAN.stat().st_size / 1024 / 1024
    print(f"   -> {TUJUAN}  ({ukuran_fp32:.1f} MB)")

    # --- kuantisasi INT8 dengan gerbang mutu ---
    if lewati_int8:
        print("\n== INT8 dilewati atas permintaan ==")
    elif not DATA_YAML.exists():
        print(f"\n== INT8 dilewati: {DATA_YAML} tidak ada, mAP tak bisa diukur ==")
    else:
        try:
            from onnxruntime.quantization import QuantType, quantize_dynamic
        except ImportError:
            print("\n== INT8 dilewati: onnxruntime.quantization tidak tersedia ==")
        else:
            print("\n== Mengukur mAP model FP32 ==")
            map_fp32 = ukur_map(model, str(DATA_YAML))
            print(f"   mAP@0.5 = {map_fp32:.2f}")

            jalur_int8 = TUJUAN.with_name("sudepi-int8.onnx")
            quantize_dynamic(
                str(TUJUAN), str(jalur_int8), weight_type=QuantType.QUInt8
            )
            ukuran_int8 = jalur_int8.stat().st_size / 1024 / 1024

            print("\n== Mengukur mAP model INT8 ==")
            map_int8 = ukur_map(YOLO(str(jalur_int8)), str(DATA_YAML))
            print(f"   mAP@0.5 = {map_int8:.2f}")

            turun = map_fp32 - map_int8
            print(f"\n   FP32 {ukuran_fp32:.1f} MB  mAP {map_fp32:.2f}")
            print(f"   INT8 {ukuran_int8:.1f} MB  mAP {map_int8:.2f}"
                  f"   (turun {turun:.2f} poin)")

            if turun > AMBANG_TURUN_MAP:
                jalur_int8.unlink(missing_ok=True)
                print(f"\n   INT8 DITOLAK: turun {turun:.2f} poin, "
                      f"melebihi ambang {AMBANG_TURUN_MAP}.")
                print("   Memakai FP32. Hemat beberapa MB tidak sepadan dengan")
                print("   salah menyebut nominal uang orang.")
            else:
                shutil.copy2(jalur_int8, TUJUAN)
                jalur_int8.unlink(missing_ok=True)
                print(f"\n   INT8 DITERIMA: turun hanya {turun:.2f} poin.")
                print(f"   Memakai INT8, hemat "
                      f"{ukuran_fp32 - ukuran_int8:.1f} MB.")

    # --- periksa bentuk keluaran ---
    print("\n== Memeriksa bentuk keluaran ==")
    hasil = subprocess.run(
        [sys.executable, str(MODEL_DIR / "periksa_onnx.py"), str(TUJUAN)],
        capture_output=True,
        text=True,
    )
    print(hasil.stdout.rstrip())
    if hasil.returncode != 0:
        sys.exit("\nBERHENTI. Bentuk keluaran tidak cocok dengan aplikasi.")

    print(f"\nSELESAI. {TUJUAN} siap dipakai.")
    print("\nLangkah berikutnya, dan ini TIDAK bisa digantikan skrip mana pun:")
    print("  pasang APK, arahkan ke uang sungguhan, satu per satu ketujuh")
    print("  pecahan. Bentuk yang benar tidak menjamin urutan kelasnya benar.")


if __name__ == "__main__":
    main()
