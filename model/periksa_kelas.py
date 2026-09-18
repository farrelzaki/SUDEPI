"""
Memeriksa `data.yaml` cocok dengan kontrak aplikasi.

    python model/periksa_kelas.py

KENAPA SKRIP INI ADA. Urutan kelas adalah satu-satunya kesalahan di seluruh
proyek yang bisa membuat SUDEPI menyebut nominal SALAH dengan penuh keyakinan.
Orang yang memakainya tidak bisa memeriksa ulang jawaban kami — itulah seluruh
alasan produk ini dibuat — sehingga ia akan mempercayainya.

Dan kekeliruan itu TIDAK akan tertangkap oleh satu pun dari 204 tes yang ada.
Tes hanya bisa memastikan kode konsisten dengan dirinya sendiri; ia tidak tahu
apa yang dilihat model saat dilatih. Satu-satunya pengujian sungguhan adalah
uang sungguhan di depan kamera.

Skrip ini menutup celah itu sejauh yang bisa ditutup mesin: memastikan berkas
yang dibaca saat TRAINING dan tabel yang dibaca saat INFERENSI menyebut hal
yang sama, dalam urutan yang sama.

Jalankan SEBELUM menekan train, dan sekali lagi SESUDAH ekspor.
"""

import re
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
KONTRAK = AKAR / "src" / "contracts" / "uang.ts"
DATA_YAML = Path(__file__).resolve().parent / "data.yaml"


def baca_kontrak() -> list[str]:
    """Menurunkan nama kelas yang diharapkan dari src/contracts/uang.ts."""
    teks = KONTRAK.read_text(encoding="utf-8")

    cocok = re.search(
        r"NOMINAL_URUT:\s*readonly Nominal\[\]\s*=\s*\[(.*?)\]", teks, re.S
    )
    if not cocok:
        sys.exit(f"Tidak menemukan NOMINAL_URUT di {KONTRAK}")

    nominal = [int(x) for x in re.findall(r"\d+", cocok.group(1).replace("_", ""))]

    kode_koin = re.search(r"KODE_KELAS_KOIN\s*=\s*(\d+)", teks)
    jumlah = re.search(r"JUMLAH_KELAS\s*=\s*(\d+)", teks)
    if not kode_koin or not jumlah:
        sys.exit("Tidak menemukan KODE_KELAS_KOIN atau JUMLAH_KELAS")

    nama = [f"rp{n}" for n in nominal] + ["koin"]

    if int(kode_koin.group(1)) != len(nominal):
        sys.exit(
            f"KODE_KELAS_KOIN={kode_koin.group(1)} tidak sama dengan jumlah "
            f"pecahan ({len(nominal)}). Kontraknya sendiri tidak konsisten."
        )
    if int(jumlah.group(1)) != len(nama):
        sys.exit(
            f"JUMLAH_KELAS={jumlah.group(1)} tidak sama dengan jumlah nama "
            f"({len(nama)}). Kontraknya sendiri tidak konsisten."
        )

    return nama


def baca_yaml() -> list[str]:
    """Membaca names dari data.yaml tanpa butuh pustaka YAML."""
    teks = DATA_YAML.read_text(encoding="utf-8")
    pasangan = re.findall(r"^\s*(\d+)\s*:\s*(\S+)\s*$", teks, re.M)
    if not pasangan:
        sys.exit(f"Tidak menemukan daftar names di {DATA_YAML}")

    urut = sorted(((int(i), n) for i, n in pasangan), key=lambda x: x[0])
    indeks = [i for i, _ in urut]
    if indeks != list(range(len(indeks))):
        sys.exit(f"Indeks kelas tidak berurutan dari 0: {indeks}")

    nc = re.search(r"^\s*nc:\s*(\d+)", teks, re.M)
    if nc and int(nc.group(1)) != len(urut):
        sys.exit(f"nc={nc.group(1)} tidak sama dengan jumlah names ({len(urut)})")

    return [n for _, n in urut]


def main() -> None:
    kontrak = baca_kontrak()
    yaml = baca_yaml()

    print("  idx  kontrak (uang.ts)      data.yaml")
    print("  ---  ---------------------  ---------------------")
    lebar = max(len(x) for x in kontrak + yaml) + 2
    cocok_semua = True

    for i in range(max(len(kontrak), len(yaml))):
        a = kontrak[i] if i < len(kontrak) else "(tidak ada)"
        b = yaml[i] if i < len(yaml) else "(tidak ada)"
        sama = a == b
        cocok_semua &= sama
        tanda = "  " if sama else "<-- BEDA"
        print(f"  {i:>3}  {a:<{lebar}} {b:<{lebar}} {tanda}")

    print()
    if cocok_semua:
        print(f"COCOK. {len(kontrak)} kelas, urutan sama persis.")
        print("Aman untuk training.")
        return

    print("TIDAK COCOK.")
    print()
    print("JANGAN menjalankan training dengan keadaan ini. Model yang dilatih")
    print("akan memetakan nominal ke indeks yang berbeda dari yang dibaca")
    print("aplikasi, dan SUDEPI akan menyebut nominal yang salah dengan penuh")
    print("keyakinan kepada orang yang tidak bisa memeriksanya.")
    print()
    print("Perbaiki data.yaml agar cocok dengan kontrak, bukan sebaliknya.")
    print("Kontrak adalah sumber kebenaran; ia dipakai seluruh aplikasi.")
    sys.exit(1)


if __name__ == "__main__":
    main()
