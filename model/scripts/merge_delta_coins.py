#!/usr/bin/env python3
"""
merge_delta_coins.py — Penggabung Cepat Delta (46k citra) + Koin ke Format SUDEPI 8-Kelas

Skrip ini membaca:
  1. model/ImageTraining/100.000 - Sigap Netra.v9-delta.yolov8.zip
  2. model/ImageTraining/coin rupiah.v1i.yolov8.zip
dan langsung menulis berkas zip terpadu:
  model/dataset_delta_sudepi.zip
dengan pemetaan 8 kelas standar SUDEPI (ADR-0007) dan pembobotan koin 6x.
"""

import os
import sys
import zipfile
import time
from pathlib import Path
import yaml

TARGET_CLASSES = {
    0: 'rp1000',
    1: 'rp2000',
    2: 'rp5000',
    3: 'rp10000',
    4: 'rp20000',
    5: 'rp50000',
    6: 'rp100000',
    7: 'koin'
}

# Pemetaan kelas Delta: ['1000', '10000', '100000', '2000', '20000', '5000', '50000']
MAP_DELTA = {
    0: 0,  # 1000   -> rp1000
    1: 3,  # 10000  -> rp10000
    2: 6,  # 100000 -> rp100000
    3: 1,  # 2000   -> rp2000
    4: 4,  # 20000  -> rp20000
    5: 2,  # 5000   -> rp5000
    6: 5   # 50000  -> rp50000
}

def main():
    t0 = time.time()
    base_dir = Path("model")
    img_dir = base_dir / "ImageTraining"
    delta_zip = img_dir / "100.000 - Sigap Netra.v9-delta.yolov8.zip"
    coin_zip = img_dir / "coin rupiah.v1i.yolov8.zip"
    out_zip = base_dir / "dataset_delta_sudepi.zip"

    if not delta_zip.exists() or not coin_zip.exists():
        print(f"[GALAT] Berkas zip tidak lengkap di {img_dir}")
        sys.exit(1)

    print("=== Menggabungkan Dataset Monster Delta + Koin ===")
    print(f"Sumber Delta: {delta_zip} ({delta_zip.stat().st_size / (1024*1024):.1f} MB)")
    print(f"Sumber Koin : {coin_zip} ({coin_zip.stat().st_size / (1024*1024):.1f} MB)")
    print(f"Output Target: {out_zip}")

    stats = {i: 0 for i in range(8)}
    total_imgs = 0

    # Buka zip input dan buat zip output
    with zipfile.ZipFile(delta_zip, 'r') as z_delta, \
         zipfile.ZipFile(coin_zip, 'r') as z_coin, \
         zipfile.ZipFile(out_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as z_out:

        # 1. Proses Dataset Delta (Uang Kertas 46k)
        print("\n[1/2] Memproses 46.611 citra Delta...")
        delta_namelist = z_delta.namelist()
        delta_imgs = [n for n in delta_namelist if n.lower().endswith(('.jpg', '.jpeg', '.png'))]
        print(f"  Total citra ditemukan di Delta: {len(delta_imgs)}")

        for idx, img_name in enumerate(delta_imgs):
            if idx % 10000 == 0 and idx > 0:
                print(f"  ... {idx}/{len(delta_imgs)} citra diproses ({time.time() - t0:.1f}s)")

            # Cari pasangan label .txt
            lbl_name = img_name.rsplit('.', 1)[0] + '.txt'
            # Di zip Roboflow, labels ada di folder labels/
            if '/images/' in lbl_name:
                lbl_name = lbl_name.replace('/images/', '/labels/')

            if lbl_name in delta_namelist:
                try:
                    raw_lbl = z_delta.read(lbl_name).decode('utf-8')
                except Exception:
                    continue

                new_lines = []
                for line in raw_lbl.strip().split('\n'):
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        src_cls = int(parts[0])
                        if src_cls in MAP_DELTA:
                            tgt_cls = MAP_DELTA[src_cls]
                            new_lines.append(f"{tgt_cls} {' '.join(parts[1:])}\n")
                            stats[tgt_cls] += 1

                if new_lines:
                    # Normalisasi path ke dataset/images/split/ dan dataset/labels/split/
                    # Roboflow struktur: train/images/... atau valid/images/...
                    split = 'train'
                    if 'valid' in img_name or 'val' in img_name:
                        split = 'val'
                    elif 'test' in img_name:
                        split = 'test'

                    filename_stem = Path(img_name).name
                    lbl_stem = Path(lbl_name).name

                    z_out.writestr(f"images/{split}/kertas_{filename_stem}", z_delta.read(img_name))
                    z_out.writestr(f"labels/{split}/kertas_{lbl_stem}", "".join(new_lines))
                    total_imgs += 1

        print(f"  -> Delta selesai: {total_imgs} citra disalin ke zip output.")

        # 2. Proses Dataset Koin (dengan oversampling 6x agar berimbang)
        print("\n[2/2] Memproses dataset koin (dengan oversampling 6x)...")
        coin_namelist = z_coin.namelist()
        coin_imgs = [n for n in coin_namelist if n.lower().endswith(('.jpg', '.jpeg', '.png'))]
        coin_added = 0

        OVERSAMPLE = 6  # 248 x 6 = ~1.488 citra koin (~2.850 bounding box)
        for mult in range(OVERSAMPLE):
            for img_name in coin_imgs:
                lbl_name = img_name.rsplit('.', 1)[0] + '.txt'
                if '/images/' in lbl_name:
                    lbl_name = lbl_name.replace('/images/', '/labels/')

                if lbl_name in coin_namelist:
                    try:
                        raw_lbl = z_coin.read(lbl_name).decode('utf-8')
                    except Exception:
                        continue

                    new_lines = []
                    for line in raw_lbl.strip().split('\n'):
                        parts = line.strip().split()
                        if len(parts) >= 5:
                            # Semua koin masuk ke kelas 7 (koin)
                            new_lines.append(f"7 {' '.join(parts[1:])}\n")
                            stats[7] += 1

                    if new_lines:
                        split = 'train'
                        if 'valid' in img_name or 'val' in img_name:
                            split = 'val'
                        elif 'test' in img_name:
                            split = 'test'

                        filename_stem = Path(img_name).name
                        lbl_stem = Path(lbl_name).name
                        prefix = f"koin_m{mult}_" if mult > 0 else "koin_"

                        z_out.writestr(f"images/{split}/{prefix}{filename_stem}", z_coin.read(img_name))
                        z_out.writestr(f"labels/{split}/{prefix}{lbl_stem}", "".join(new_lines))
                        coin_added += 1

        print(f"  -> Koin selesai: {coin_added} citra koin ditambahkan.")

        # 3. Tulis data.yaml di dalam root zip
        yaml_content = {
            'path': '/content/dataset',
            'train': 'images/train',
            'val': 'images/val',
            'test': 'images/test',
            'nc': 8,
            'names': TARGET_CLASSES
        }
        z_out.writestr("data.yaml", yaml.dump(yaml_content, sort_keys=False))

    size_mb = out_zip.stat().st_size / (1024 * 1024)
    print(f"\n=== PENGGABUNGAN SUKSES ({time.time() - t0:.1f} detik) ===")
    print(f"File Hasil: {out_zip} ({size_mb:.1f} MB)")
    print(f"Total Citra Terpadu: {total_imgs + coin_added}")
    print("\nDistribusi Bounding Box Resmi:")
    for i, name in TARGET_CLASSES.items():
        print(f"  Kelas {i} ({name:<10}): {stats[i]:>6} kotak")

if __name__ == '__main__':
    main()
