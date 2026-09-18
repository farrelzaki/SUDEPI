"""
Memeriksa berkas ONNX cocok dengan yang dibaca aplikasi.

    python model/periksa_onnx.py public/model/sudepi.onnx

Dijalankan SESUDAH ekspor, sebelum berkasnya diserahkan.

KENAPA SKRIP INI ADA. `src/vision/decode.ts` membaca tensor keluaran dengan
tata letak dan ukuran yang sangat spesifik. Kalau ekspornya memakai `imgsz`
lain, jumlah kelas lain, atau menyertakan NMS, hasilnya BUKAN galat yang jelas
— aplikasi tetap berjalan, lalu menghasilkan kotak di posisi acak atau nominal
yang salah.

Empat kesalahan yang paling mungkin terjadi, dan semuanya terlihat dari bentuk
tensor saja:

    imgsz bukan 320      -> jumlah jangkar bukan 2100
    jumlah kelas bukan 8 -> jumlah kanal bukan 12
    nms=True             -> bentuk keluaran sama sekali berbeda
    dynamic=True         -> dimensi bernilai simbolik, bukan angka

Skrip ini memeriksa keempatnya tanpa perlu menjalankan inferensi sungguhan.
"""

import sys
from pathlib import Path

try:
    import onnxruntime as ort
except ImportError:
    sys.exit("Butuh onnxruntime. Jalankan: python -m pip install onnxruntime")

AKAR = Path(__file__).resolve().parent.parent
KONTRAK = AKAR / "src" / "contracts" / "uang.ts"

UKURAN_MASUKAN = 320
JUMLAH_KELAS = 8
JUMLAH_KANAL = 4 + JUMLAH_KELAS  # 4 koordinat kotak + skor tiap kelas

# 40x40 + 20x20 + 10x10 pada imgsz 320 (stride 8, 16, 32)
JUMLAH_JANGKAR = (UKURAN_MASUKAN // 8) ** 2 + (UKURAN_MASUKAN // 16) ** 2 + (
    UKURAN_MASUKAN // 32
) ** 2


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    berkas = Path(sys.argv[1]).resolve()
    if not berkas.exists():
        sys.exit(f"Tidak menemukan {berkas}")

    ukuran_mb = berkas.stat().st_size / 1024 / 1024
    print(f"Berkas : {berkas}")
    print(f"Ukuran : {ukuran_mb:.1f} MB\n")

    try:
        sesi = ort.InferenceSession(str(berkas), providers=["CPUExecutionProvider"])
    except Exception as galat:  # noqa: BLE001
        print(f"GAGAL DIMUAT: {galat}")
        print()
        print("Kalau pesannya menyebut operator yang tidak didukung, kemungkinan")
        print("besar model diekspor dengan nms=True. Ulangi dengan nms=False —")
        print("lihat ADR-0002.")
        sys.exit(1)

    masuk = sesi.get_inputs()[0]
    keluar = sesi.get_outputs()[0]

    print(f"Masukan  : {masuk.name}  {masuk.shape}  {masuk.type}")
    print(f"Keluaran : {keluar.name}  {keluar.shape}  {keluar.type}\n")

    masalah: list[str] = []

    # --- masukan ---
    harapan_masuk = [1, 3, UKURAN_MASUKAN, UKURAN_MASUKAN]
    if len(masuk.shape) != 4:
        masalah.append(f"Masukan harus 4 dimensi, bukan {len(masuk.shape)}")
    else:
        for i, (ada, harus) in enumerate(zip(masuk.shape, harapan_masuk)):
            if isinstance(ada, str):
                masalah.append(
                    f"Masukan dimensi {i} bernilai simbolik ({ada!r}). "
                    f"Ekspor dengan dynamic=False."
                )
            elif ada != harus:
                masalah.append(f"Masukan dimensi {i} = {ada}, seharusnya {harus}")

    # --- keluaran ---
    if len(keluar.shape) != 3:
        masalah.append(
            f"Keluaran harus 3 dimensi [1, {JUMLAH_KANAL}, {JUMLAH_JANGKAR}], "
            f"bukan {len(keluar.shape)} dimensi. "
            f"Bentuk yang jauh berbeda biasanya berarti nms=True."
        )
    else:
        b, kanal, jangkar = keluar.shape
        if isinstance(kanal, str) or isinstance(jangkar, str):
            masalah.append("Keluaran bernilai simbolik. Ekspor dengan dynamic=False.")
        else:
            if b != 1:
                masalah.append(f"Batch keluaran = {b}, seharusnya 1")
            if kanal != JUMLAH_KANAL:
                kelas = kanal - 4
                masalah.append(
                    f"Kanal = {kanal}, seharusnya {JUMLAH_KANAL}. "
                    f"Berarti modelnya punya {kelas} kelas, bukan {JUMLAH_KELAS}. "
                    f"Periksa data.yaml lalu latih ulang."
                )
            if jangkar != JUMLAH_JANGKAR:
                # Turunkan imgsz yang sebenarnya dipakai dari jumlah jangkar.
                tebakan = ""
                for uk in (256, 320, 416, 448, 512, 640):
                    n = (uk // 8) ** 2 + (uk // 16) ** 2 + (uk // 32) ** 2
                    if n == jangkar:
                        tebakan = f" Sepertinya model diekspor pada imgsz={uk}."
                        break
                masalah.append(
                    f"Jangkar = {jangkar}, seharusnya {JUMLAH_JANGKAR}."
                    f"{tebakan} Ekspor ulang dengan imgsz={UKURAN_MASUKAN} "
                    f"— lihat ADR-0001."
                )

    if masuk.type != "tensor(float)":
        masalah.append(
            f"Tipe masukan {masuk.type}, seharusnya tensor(float). "
            f"Aplikasi mengirim Float32Array."
        )

    # --- laporan ---
    if masalah:
        print("TIDAK COCOK:\n")
        for m in masalah:
            print(f"  - {m}")
        print()
        print("Model dengan bentuk seperti ini TIDAK akan menghasilkan galat di")
        print("aplikasi. Ia akan berjalan dan menghasilkan kotak di posisi acak")
        print("atau nominal yang salah.")
        sys.exit(1)

    print(f"COCOK dengan src/vision/decode.ts.")
    print(f"  masukan  [1, 3, {UKURAN_MASUKAN}, {UKURAN_MASUKAN}]")
    print(f"  keluaran [1, {JUMLAH_KANAL}, {JUMLAH_JANGKAR}]  "
          f"({JUMLAH_KELAS} kelas + 4 koordinat)")
    print()
    print("Langkah terakhir yang TIDAK bisa diperiksa skrip mana pun:")
    print("uji dengan uang sungguhan di depan kamera, satu per satu pecahan.")
    print("Bentuk yang benar tidak menjamin urutan kelasnya benar.")


if __name__ == "__main__":
    main()
