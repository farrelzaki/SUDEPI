"""
Menghasilkan varian uang kusut, terlipat, dan redup dari foto bersih.

    python model/augmentasi.py dataset/                 # laporan saja
    python model/augmentasi.py dataset/ --terapkan      # tulis varian baru

Mitigasi risiko nomor 1 pada Lampiran 8: "Memperkaya dataset latih dengan
augmentasi kondisi kusut, redup, dan terlipat."

KENAPA TIDAK CUKUP MENGANDALKAN AUGMENTASI BAWAAN YOLO. Ultralytics sudah
menangani rotasi, perspektif, dan kecerahan (`degrees`, `perspective`,
`hsv_v`). Yang TIDAK ditanganinya adalah kekusutan dan lipatan — dan justru
itulah kondisi yang kami klaim kuat di proposal, sekaligus keadaan uang yang
sebenarnya beredar di pasar.

Dataset Rupiah publik hampir seluruhnya berisi uang mulus di latar bersih.
Melatih di atasnya lalu mendemokan dengan uang pasar adalah cara paling mudah
untuk gagal di depan juri.

BATASNYA. Ini simulasi, bukan pengganti uang lecek sungguhan. Ia menambah
ragam, bukan menciptakan kebenaran baru. Kalau sempat memotret uang kusut
asli, itu selalu lebih berharga daripada berapa pun varian buatan.

LABEL TIDAK DIUBAH. Seluruh distorsi di sini dirancang halus dan berpusat,
sehingga kotak batas asli tetap berlaku. Berkas `.txt` disalin apa adanya.
"""

import math
import random
import shutil
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageEnhance, ImageFilter
except ImportError:
    sys.exit("Butuh pillow dan numpy. Jalankan: python -m pip install pillow numpy")

# Pergeseran maksimum saat mengusutkan, dalam pecahan lebar gambar.
# Sengaja kecil supaya kotak batas asli tetap berlaku — begitu ini dinaikkan,
# labelnya harus ikut dihitung ulang, dan itu sumber kesalahan baru.
GESER_MAKS = 0.012


def kebisingan_halus(tinggi: int, lebar: int, skala: int, rng) -> np.ndarray:
    """Kebisingan halus sederhana: acak kasar lalu diperbesar dan dihaluskan."""
    kasar = rng.random((max(2, tinggi // skala), max(2, lebar // skala)))
    gambar = Image.fromarray((kasar * 255).astype(np.uint8)).resize(
        (lebar, tinggi), Image.BICUBIC
    )
    gambar = gambar.filter(ImageFilter.GaussianBlur(radius=skala / 3))
    return np.asarray(gambar, dtype=np.float32) / 255.0


def kusutkan(gambar: Image.Image, rng) -> Image.Image:
    """
    Meniru uang kusut: permukaan digeser tak beraturan, lalu diberi bayangan
    mengikuti lekukannya.

    Pergeseran saja terlihat seperti gambar meleleh. Yang membuat mata (dan
    model) mengenali kekusutan adalah BAYANGAN pada lipatannya — bagian yang
    menghadap cahaya jadi terang, yang membelakangi jadi gelap.
    """
    arr = np.asarray(gambar.convert("RGB"), dtype=np.float32)
    tinggi, lebar = arr.shape[:2]

    peta_x = kebisingan_halus(tinggi, lebar, max(8, lebar // 12), rng) - 0.5
    peta_y = kebisingan_halus(tinggi, lebar, max(8, lebar // 12), rng) - 0.5
    kuat = GESER_MAKS * lebar

    yy, xx = np.meshgrid(np.arange(tinggi), np.arange(lebar), indexing="ij")
    sx = np.clip(xx + peta_x * kuat * 2, 0, lebar - 1).astype(np.int32)
    sy = np.clip(yy + peta_y * kuat * 2, 0, tinggi - 1).astype(np.int32)
    hasil = arr[sy, sx]

    # Bayangan lipatan. Rentang 0,80–1,15 menahan agar detail tidak hilang;
    # uang yang terlalu gelap justru tidak lagi mewakili kondisi nyata.
    terang = kebisingan_halus(tinggi, lebar, max(6, lebar // 18), rng)
    hasil *= (0.80 + 0.35 * terang)[..., None]

    return Image.fromarray(np.clip(hasil, 0, 255).astype(np.uint8))


def lipat(gambar: Image.Image, rng) -> Image.Image:
    """Satu garis lipatan: pita gelap tipis dengan tepi yang melunak."""
    arr = np.asarray(gambar.convert("RGB"), dtype=np.float32)
    tinggi, lebar = arr.shape[:2]

    tegak = rng.random() < 0.5
    panjang = lebar if tegak else tinggi
    posisi = rng.integers(int(panjang * 0.25), int(panjang * 0.75))
    tebal = max(2, panjang // 60)

    sumbu = np.arange(panjang)
    jarak = np.abs(sumbu - posisi)
    # Cekungan lipatan: paling gelap di garisnya, melunak ke tepi.
    pita = 1.0 - 0.35 * np.exp(-((jarak / tebal) ** 2))

    arr *= (pita[None, :, None] if tegak else pita[:, None, None])
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def redupkan(gambar: Image.Image, rng) -> Image.Image:
    """
    Meniru lapak pasar temaram: gelap, kontras turun, sedikit bintik, dan
    bayangan tangan di salah satu sisi.
    """
    hasil = ImageEnhance.Brightness(gambar).enhance(rng.uniform(0.35, 0.60))
    hasil = ImageEnhance.Contrast(hasil).enhance(rng.uniform(0.70, 0.90))

    arr = np.asarray(hasil.convert("RGB"), dtype=np.float32)
    tinggi, lebar = arr.shape[:2]

    # Bayangan menyapu dari satu sisi, meniru tangan atau badan yang menghalangi.
    sudut = rng.uniform(0, 2 * math.pi)
    yy, xx = np.meshgrid(
        np.linspace(-1, 1, tinggi), np.linspace(-1, 1, lebar), indexing="ij"
    )
    sapuan = xx * math.cos(sudut) + yy * math.sin(sudut)
    arr *= (0.65 + 0.35 * (sapuan - sapuan.min()) /
            (sapuan.max() - sapuan.min() + 1e-6))[..., None]

    # Bintik sensor, yang selalu muncul pada cahaya rendah.
    arr += rng.normal(0, 4.0, arr.shape)

    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


VARIAN = {
    "kusut": lambda g, r: kusutkan(g, r),
    "lipat": lambda g, r: lipat(kusutkan(g, r), r),
    "redup": lambda g, r: redupkan(g, r),
    "kusutredup": lambda g, r: redupkan(kusutkan(g, r), r),
}


def label_untuk(gambar: Path) -> Path | None:
    """Mencari berkas label YOLO milik sebuah gambar."""
    langsung = gambar.with_suffix(".txt")
    if langsung.exists():
        return langsung
    # Tata letak baku Ultralytics: images/... dan labels/...
    bagian = list(gambar.parts)
    if "images" in bagian:
        bagian[len(bagian) - 1 - bagian[::-1].index("images")] = "labels"
        kandidat = Path(*bagian).with_suffix(".txt")
        if kandidat.exists():
            return kandidat
    return None


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    folder = Path(sys.argv[1]).resolve()
    terapkan = "--terapkan" in sys.argv
    rng = np.random.default_rng(20260918)

    if not folder.is_dir():
        sys.exit(f"Bukan folder: {folder}")

    foto = [
        p for p in sorted(folder.rglob("*"))
        if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
        and not any(v in p.stem for v in VARIAN)
    ]
    if not foto:
        sys.exit(f"Tidak ada foto di {folder}")

    berlabel = [p for p in foto if label_untuk(p) is not None]

    print(f"Folder        : {folder}")
    print(f"Foto asli     : {len(foto):,}")
    print(f"Punya label   : {len(berlabel):,}")
    print(f"Varian        : {', '.join(VARIAN)}")
    print(f"Akan dihasilkan: {len(berlabel) * len(VARIAN):,} foto baru\n")

    if not berlabel:
        sys.exit(
            "Tidak ada foto yang punya berkas label. Augmentasi tanpa label\n"
            "tidak berguna untuk training — periksa struktur foldernya."
        )

    if not terapkan:
        print("Contoh nama keluaran:")
        for p in berlabel[:2]:
            for v in list(VARIAN)[:2]:
                print(f"  {p.name}  ->  {p.stem}_{v}{p.suffix}")
        print("\n(Mode laporan. Jalankan ulang dengan --terapkan untuk menulis.)")
        return

    dibuat = 0
    for p in berlabel:
        label = label_untuk(p)
        if label is None:
            continue
        asli = Image.open(p)
        for nama, fungsi in VARIAN.items():
            keluar = p.with_name(f"{p.stem}_{nama}{p.suffix}")
            if keluar.exists():
                continue
            fungsi(asli, rng).save(keluar, quality=92)
            # Label disalin APA ADANYA. Seluruh distorsi dirancang halus dan
            # berpusat sehingga kotak batas asli tetap berlaku.
            shutil.copy2(label, label.with_name(f"{label.stem}_{nama}.txt"))
            dibuat += 1
        if dibuat % 200 == 0 and dibuat:
            print(f"  {dibuat:,} varian...")

    print(f"\nSelesai. {dibuat:,} foto varian dibuat.")
    print("\nIngat: ini simulasi, bukan pengganti uang lecek sungguhan.")
    print("Kalau sempat memotret uang kusut asli, itu selalu lebih berharga.")


if __name__ == "__main__":
    main()
