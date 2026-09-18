"""
Menguji model terhadap foto berlabel, dan mengumpulkan data untuk kalibrasi.

    python model/uji_model.py public/model/sudepi.onnx foto_uji/

Nama berkas menentukan jawaban yang benar. Letakkan foto dengan pola:

    foto_uji/
      rp50000_01.jpg     rp1000_01.jpg     koin_01.jpg
      rp50000_02.jpg     rp1000_02.jpg     koin_02.jpg
      50000_lecek.jpg    100000_redup.jpg

Awalan sebelum garis bawah dibaca sebagai kelas yang seharusnya. Boleh ditulis
`rp50000` atau `50000`.

MENUTUP CELAH YANG TERSISA. `periksa_onnx.py` memastikan BENTUK keluaran benar,
tetapi tidak bisa tahu apakah indeks 5 memang berarti Rp50.000. Kekeliruan
urutan kelas adalah satu-satunya kesalahan yang membuat SUDEPI menyebut nominal
salah DENGAN PENUH KEYAKINAN, dan selama ini hanya bisa diperiksa dengan
mengarahkan kamera ke uang satu per satu.

Dengan foto berlabel, pemeriksaan itu bisa dijalankan mesin — berulang kali,
konsisten, dan tercatat.

BONUS: KALIBRASI AMBANG. Skrip ini juga melaporkan sebaran skor keyakinan per
kelas. Itu yang dibutuhkan untuk menyetel `AMBANG_KEYAKINAN` secara terukur
alih-alih menebak. Kalau uang lecek konsisten berada di 0,78 sementara ambang
kita 0,70, sistem akan abstain terus-menerus — dan lebih baik mengetahuinya
dari angka daripada dari juri.

Prapemrosesan di sini SENGAJA meniru `src/vision/worker.ts` persis: letterbox
dengan bantalan abu-abu 114, RGB, dibagi 255, tata letak NCHW. Kalau keduanya
berbeda, hasil uji ini tidak mewakili apa yang terjadi di aplikasi.
"""

import sys
from collections import defaultdict
from pathlib import Path

# Konsol Windows sering bukan UTF-8, dan tanda pisah panjang berubah jadi '?'.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    import numpy as np
    import onnxruntime as ort
    from PIL import Image
except ImportError:
    sys.exit("Butuh onnxruntime, numpy, dan pillow. "
             "Jalankan: python -m pip install onnxruntime numpy pillow")

UKURAN = 320
JUMLAH_KELAS = 8
KANAL = 4 + JUMLAH_KELAS

KELAS = [
    "rp1000", "rp2000", "rp5000", "rp10000",
    "rp20000", "rp50000", "rp100000", "koin",
]

# Harus sama dengan tetapan di src/contracts/vision.ts.
AMBANG_KEYAKINAN = 0.70
AMBANG_IOU = 0.40
# Skor serendah ini pun dicatat, supaya sebarannya terlihat utuh saat kalibrasi.
AMBANG_MINAT = 0.25


def kelas_dari_nama(nama: str) -> str | None:
    awalan = nama.split("_")[0].lower().lstrip("_")
    if awalan in KELAS:
        return awalan
    if f"rp{awalan}" in KELAS:
        return f"rp{awalan}"
    return None


def siapkan(gambar: Image.Image) -> np.ndarray:
    """Letterbox ke 320x320 dengan bantalan 114, persis seperti worker.ts."""
    lebar, tinggi = gambar.size
    skala = min(UKURAN / lebar, UKURAN / tinggi)
    baru = (max(1, round(lebar * skala)), max(1, round(tinggi * skala)))

    kanvas = Image.new("RGB", (UKURAN, UKURAN), (114, 114, 114))
    kanvas.paste(
        gambar.convert("RGB").resize(baru, Image.BILINEAR),
        ((UKURAN - baru[0]) // 2, (UKURAN - baru[1]) // 2),
    )

    piksel = np.asarray(kanvas, dtype=np.float32) / 255.0  # HWC
    return np.expand_dims(piksel.transpose(2, 0, 1), 0)    # NCHW


def iou(a, b) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    kiri, atas = max(ax, bx), max(ay, by)
    kanan, bawah = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    if kanan <= kiri or bawah <= atas:
        return 0.0
    irisan = (kanan - kiri) * (bawah - atas)
    gabungan = aw * ah + bw * bh - irisan
    return irisan / gabungan if gabungan > 0 else 0.0


def dekode(keluaran: np.ndarray) -> list[tuple[int, float, tuple]]:
    """Decode + gating + NMS class-agnostic, meniru decode.ts dan nms.ts."""
    data = keluaran[0]  # [KANAL, JANGKAR]
    skor_kelas = data[4:, :]
    kelas = skor_kelas.argmax(axis=0)
    skor = skor_kelas.max(axis=0)

    kandidat = []
    for i in np.flatnonzero(skor >= AMBANG_MINAT):
        cx, cy, w, h = data[0:4, i]
        kandidat.append((int(kelas[i]), float(skor[i]),
                         (cx - w / 2, cy - h / 2, w, h)))

    kandidat.sort(key=lambda x: -x[1])
    disimpan: list[tuple[int, float, tuple]] = []
    for k in kandidat:
        if all(iou(k[2], s[2]) <= AMBANG_IOU for s in disimpan):
            disimpan.append(k)
    return disimpan


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)

    model_path, folder = Path(sys.argv[1]), Path(sys.argv[2])
    if not model_path.exists():
        sys.exit(f"Tidak menemukan model: {model_path}")
    if not folder.is_dir():
        sys.exit(f"Bukan folder: {folder}")

    foto = sorted(
        p for p in folder.rglob("*")
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    if not foto:
        sys.exit(f"Tidak ada foto di {folder}")

    sesi = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    nama_masuk = sesi.get_inputs()[0].name

    benar = salah = tanpa_deteksi = dilewati = 0
    skor_per_kelas: dict[str, list[float]] = defaultdict(list)
    tertukar: dict[tuple[str, str], int] = defaultdict(int)

    print(f"Model : {model_path}")
    print(f"Foto  : {len(foto)}\n")

    for berkas in foto:
        harusnya = kelas_dari_nama(berkas.stem)
        if harusnya is None:
            dilewati += 1
            continue

        keluar = sesi.run(None, {nama_masuk: siapkan(Image.open(berkas))})[0]
        deteksi = dekode(np.asarray(keluar))
        lolos = [d for d in deteksi if d[1] >= AMBANG_KEYAKINAN]

        if not lolos:
            tanpa_deteksi += 1
            skor_tertinggi = max((d[1] for d in deteksi), default=0.0)
            print(f"  {berkas.name:<28} TIDAK TERDETEKSI  "
                  f"(skor tertinggi {skor_tertinggi:.2f}, di bawah "
                  f"{AMBANG_KEYAKINAN})")
            if deteksi:
                skor_per_kelas[harusnya].append(skor_tertinggi)
            continue

        teratas = max(lolos, key=lambda d: d[1])
        terbaca = KELAS[teratas[0]]
        skor_per_kelas[harusnya].append(teratas[1])

        if terbaca == harusnya:
            benar += 1
        else:
            salah += 1
            tertukar[(harusnya, terbaca)] += 1
            print(f"  {berkas.name:<28} SALAH: terbaca {terbaca}, "
                  f"seharusnya {harusnya}  (skor {teratas[1]:.2f})")

    # ---------------------------------------------------------------- laporan
    diuji = benar + salah + tanpa_deteksi
    print(f"\n{'='*62}")
    print(f"Benar          : {benar:>4} / {diuji}")
    print(f"Salah sebut    : {salah:>4}   <-- paling berbahaya")
    print(f"Tidak terdeteksi: {tanpa_deteksi:>3}   (abstain, aman)")
    if dilewati:
        print(f"Dilewati       : {dilewati:>4}   (nama berkas tidak dikenali)")

    if skor_per_kelas:
        print(f"\nSebaran skor keyakinan per kelas (untuk kalibrasi ambang):")
        print(f"  {'kelas':<12} {'n':>4}  {'min':>6} {'rerata':>7} {'maks':>6}")
        print(f"  {'-'*12} {'-'*4}  {'-'*6} {'-'*7} {'-'*6}")
        for k in KELAS:
            v = skor_per_kelas.get(k)
            if not v:
                continue
            tanda = "  <-- di bawah ambang" if min(v) < AMBANG_KEYAKINAN else ""
            print(f"  {k:<12} {len(v):>4}  {min(v):>6.2f} "
                  f"{sum(v)/len(v):>7.2f} {max(v):>6.2f}{tanda}")

    if tertukar:
        print(f"\nPola tertukar:")
        for (a, b), n in sorted(tertukar.items(), key=lambda x: -x[1]):
            print(f"  {a} terbaca sebagai {b}  ({n}x)")
        print("\nKalau polanya sistematis — misalnya SELURUH rp50000 terbaca")
        print("rp20000 — itu bukan masalah akurasi melainkan URUTAN KELAS.")
        print("Periksa data.yaml, jangan menambah data latih.")

    print(f"\n{'='*62}")
    if salah > 0:
        print("ADA SALAH SEBUT. Jangan dipakai sebelum ini nol.")
        print("Salah sebut jauh lebih berbahaya daripada tidak terdeteksi:")
        print("pengguna tidak bisa memeriksa ulang jawaban kita.")
        sys.exit(1)

    # Model yang tidak pernah mendeteksi apa pun BUKAN model yang aman.
    # Tanpa pemeriksaan ini, model rusak akan dilaporkan lolos hanya karena ia
    # tidak pernah salah sebut — dan "tidak pernah salah" itu sepele dicapai
    # dengan tidak pernah menjawab.
    if benar == 0:
        print("TIDAK ADA SATU PUN YANG TERDETEKSI.")
        print()
        print("Ini bukan abstain yang aman, ini model yang tidak bekerja.")
        print("Aplikasi yang tidak pernah menyebut nominal tidak berguna sama")
        print("sekali bagi orang yang tidak bisa melihat uangnya.")
        print()
        print("Periksa berurutan: apakah trainingnya benar-benar konvergen")
        print("(lihat mAP di akhir training), apakah datanya cukup, dan apakah")
        print("foto uji ini memang mewakili yang dilihat kamera.")
        sys.exit(1)

    rasio = benar / diuji
    if rasio < 0.7:
        print(f"HANYA {rasio * 100:.0f}% yang terbaca benar.")
        print()
        print("Tidak ada salah sebut, jadi tidak berbahaya — tetapi terlalu")
        print("sering abstain membuat pengguna menyerah dan kembali bergantung")
        print("pada orang lain, yang justru ingin kita hindari.")
        print()
        print("Lihat sebaran skor di atas: kalau banyak yang mendekati ambang,")
        print("kalibrasi ambangnya. Kalau jauh di bawah, perkaya data latihnya.")
        sys.exit(1)

    if tanpa_deteksi > 0:
        print(f"{rasio * 100:.0f}% terbaca benar, tanpa satu pun salah sebut.")
        print()
        print("Sisanya tidak terdeteksi, dan itu perilaku yang benar — sistem")
        print("memilih abstain daripada menebak. Lihat sebaran skor di atas")
        print("untuk memutuskan apakah ambangnya perlu disesuaikan.")
    else:
        print("Seluruh foto terbaca benar.")


if __name__ == "__main__":
    main()
