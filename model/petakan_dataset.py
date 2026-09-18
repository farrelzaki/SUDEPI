"""
Memetakan dataset Rupiah publik ke skema 8 kelas SUDEPI.

    python model/petakan_dataset.py <folder-dataset>
    python model/petakan_dataset.py <folder-dataset> --terapkan

Tanpa `--terapkan` skrip hanya MELAPORKAN apa yang akan dilakukan, tanpa
mengubah satu berkas pun. Jalankan begitu dulu, baca laporannya, baru terapkan.

KENAPA PERLU. Dataset Rupiah publik memakai nama kelas yang berbeda-beda:
"100000", "seratus ribu", "IDR100k", kadang memisahkan tahun emisi menjadi
"100000_2016" dan "100000_2022". Skema kita menggabungkan emisi (ADR-0007) dan
memakai nama `rp100000`. Tanpa pemetaan, indeks kelas dataset tidak akan cocok
dengan indeks yang dibaca aplikasi.

Dan ketidakcocokan itu TIDAK menghasilkan galat. Training tetap berjalan, mAP
tetap bagus, lalu aplikasi menyebut nominal yang salah dengan penuh keyakinan.
Karena itu skrip ini menolak menebak: nama yang tidak dikenali dilaporkan dan
harus dipetakan manual, bukan dibuang diam-diam.

Yang diubah: angka indeks kelas di setiap berkas label `.txt` (kolom pertama),
dan `data.yaml` di folder dataset. Berkas gambar tidak disentuh.
"""

import re
import shutil
import sys
from collections import Counter
from pathlib import Path

AKAR = Path(__file__).resolve().parent
KELAS_KAMI = [
    "rp1000",
    "rp2000",
    "rp5000",
    "rp10000",
    "rp20000",
    "rp50000",
    "rp100000",
    "koin",
]

# Pola pengenal, dicoba terhadap nama kelas yang sudah dinormalkan (huruf kecil,
# tanpa spasi/garis). Sengaja longgar supaya menangkap variasi penamaan, tetapi
# TIDAK pernah menebak: yang tidak cocok dilaporkan, bukan dibuang.
POLA = [
    ("koin", r"koin|coin|logam"),
    # 100.000 diperiksa LEBIH DULU daripada 1.000, karena "100000" mengandung
    # "1000" dan akan salah cocok kalau urutannya terbalik.
    ("rp100000", r"100\.?000|100k|seratusribu|ratusribu"),
    ("rp50000", r"50\.?000|50k|limapuluhribu"),
    ("rp20000", r"20\.?000|20k|duapuluhribu"),
    ("rp10000", r"10\.?000|10k|sepuluhribu"),
    ("rp5000", r"5\.?000|5k|limaribu"),
    ("rp2000", r"2\.?000|2k|duaribu"),
    ("rp1000", r"1\.?000|1k|seribu"),
]


def normalkan(nama: str) -> str:
    return re.sub(r"[\s_\-]+", "", nama.strip().lower())


def tebak_kelas(nama: str) -> str | None:
    n = normalkan(nama)
    for kelas, pola in POLA:
        if re.search(pola, n):
            return kelas
    return None


def baca_names(yaml_teks: str) -> list[str]:
    """Mendukung dua bentuk penulisan names yang lazim di dataset publik."""
    pasangan = re.findall(r"^\s*(\d+)\s*:\s*(.+?)\s*$", yaml_teks, re.M)
    if pasangan:
        urut = sorted(((int(i), n) for i, n in pasangan), key=lambda x: x[0])
        return [n.strip("'\"") for _, n in urut]

    daftar = re.search(r"names\s*:\s*\[(.*?)\]", yaml_teks, re.S)
    if daftar:
        return [x.strip().strip("'\"") for x in daftar.group(1).split(",") if x.strip()]

    return []


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    folder = Path(sys.argv[1]).resolve()
    terapkan = "--terapkan" in sys.argv

    yaml_dataset = folder / "data.yaml"
    if not yaml_dataset.exists():
        sys.exit(f"Tidak menemukan {yaml_dataset}")

    asal = baca_names(yaml_dataset.read_text(encoding="utf-8"))
    if not asal:
        sys.exit(f"Tidak bisa membaca daftar names dari {yaml_dataset}")

    print(f"Dataset : {folder}")
    print(f"Kelas   : {len(asal)}\n")

    # --- pemetaan indeks lama -> indeks baru ---
    peta: dict[int, int] = {}
    tak_dikenali: list[tuple[int, str]] = []

    print("  lama  nama asal                 ->  baru  kelas kami")
    print("  ----  ------------------------      ----  ----------")
    for i, nama in enumerate(asal):
        kelas = tebak_kelas(nama)
        if kelas is None:
            tak_dikenali.append((i, nama))
            print(f"  {i:>4}  {nama:<24}      ????  TIDAK DIKENALI")
        else:
            baru = KELAS_KAMI.index(kelas)
            peta[i] = baru
            print(f"  {i:>4}  {nama:<24}      {baru:>4}  {kelas}")

    if tak_dikenali:
        print()
        print("BERHENTI. Ada kelas yang tidak dikenali:")
        for i, nama in tak_dikenali:
            print(f"  - indeks {i}: {nama!r}")
        print()
        print("Skrip ini sengaja TIDAK menebak. Kelas yang salah dipetakan")
        print("membuat SUDEPI menyebut nominal keliru dengan penuh keyakinan,")
        print("dan tidak ada tes yang bisa menangkapnya.")
        print()
        print("Tambahkan polanya ke daftar POLA di skrip ini, lalu ulangi.")
        sys.exit(1)

    # --- hitung berapa label yang terdampak ---
    label = sorted(folder.rglob("labels/**/*.txt"))
    if not label:
        label = sorted(folder.rglob("*.txt"))
        label = [p for p in label if p.name != "classes.txt"]

    hitung: Counter[int] = Counter()
    baris_total = 0
    for berkas in label:
        for baris in berkas.read_text(encoding="utf-8").splitlines():
            if not baris.strip():
                continue
            baris_total += 1
            hitung[int(baris.split()[0])] += 1

    print(f"\nBerkas label : {len(label):,}")
    print(f"Kotak        : {baris_total:,}\n")
    print("  kelas kami       kotak")
    print("  ---------------  -------")
    for i, kelas in enumerate(KELAS_KAMI):
        n = sum(v for k, v in hitung.items() if peta.get(k) == i)
        tanda = "   <-- KOSONG" if n == 0 else ""
        print(f"  {i} {kelas:<13}  {n:>7,}{tanda}")

    kosong = [k for i, k in enumerate(KELAS_KAMI) if not any(
        peta.get(x) == i for x in hitung)]
    if kosong:
        print()
        print("Kelas tanpa satu pun contoh: " + ", ".join(kosong))
        print("Model tidak akan pernah bisa mengenalinya. Perlu difoto sendiri")
        print("sebelum training, atau diterima sebagai keterbatasan yang")
        print("disebutkan terus terang saat presentasi.")

    if not terapkan:
        print("\n(Mode laporan. Jalankan ulang dengan --terapkan untuk mengubah.)")
        return

    # --- terapkan ---
    print("\nMenerapkan...")
    cadangan = folder / "labels_sebelum_dipetakan"
    if not cadangan.exists():
        cadangan.mkdir()
        for berkas in label:
            shutil.copy2(berkas, cadangan / f"{berkas.parent.name}__{berkas.name}")
        print(f"  cadangan label -> {cadangan}")

    for berkas in label:
        keluar = []
        for baris in berkas.read_text(encoding="utf-8").splitlines():
            if not baris.strip():
                continue
            bagian = baris.split()
            bagian[0] = str(peta[int(bagian[0])])
            keluar.append(" ".join(bagian))
        berkas.write_text("\n".join(keluar) + "\n", encoding="utf-8")

    shutil.copy2(AKAR / "data.yaml", folder / "data.yaml")
    print(f"  {len(label):,} berkas label ditulis ulang")
    print(f"  data.yaml disalin dari {AKAR / 'data.yaml'}")
    print("\nSelesai. Jalankan `python model/periksa_kelas.py` sebelum training.")


if __name__ == "__main__":
    main()
