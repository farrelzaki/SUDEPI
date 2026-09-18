#!/usr/bin/env python3
"""
gabung_racikan.py — Universal Dataset Merger untuk Koleksi Zip Pilihan Fajar

Skrip ini memindai folder (default: model/ImageTraining/ atau folder yang ditentukan):
1. Menemukan semua berkas .zip dataset YOLOv8.
2. Membaca data.yaml di setiap zip untuk mendeteksi nama kelasnya.
3. Mengonversi anotasi poligon (segmentation) ke bounding box YOLOv8 secara otomatis.
4. Menyelaraskan seluruh kelas ke 8 kelas resmi SUDEPI (ADR-0007).
5. Menerapkan auto-balancing / oversampling koin agar porsi koin tidak tenggelam.
6. Menghasilkan berkas zip terpadu: model/dataset_racikan_sudepi.zip.
"""

import os
import sys
import zipfile
import time
import re
from pathlib import Path
import yaml

# Pastikan output konsol mendukung karakter UTF-8 di Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

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

# Pola untuk mengenali nama kelas ke indeks target SUDEPI
PATTERNS = [
    (7, r'koin|coin|logam|100$|200$|500$'), # kelas koin
    (6, r'100\.?000|100k|seratus'),
    (5, r'50\.?000|50k|limapuluh'),
    (4, r'20\.?000|20k|duapuluh'),
    (3, r'10\.?000|10k|sepuluh'),
    (2, r'5\.?000|5k|limaribu'),
    (1, r'2\.?000|2k|duaribu'),
    (0, r'1\.?000|1k|seribu'),
]

def petakan_nama_kelas(nama: str) -> int | None:
    n = str(nama).lower().replace(' ', '').replace('_', '').replace('-', '')
    for target_idx, pattern in PATTERNS:
        if re.search(pattern, n):
            return target_idx
    return None

def polygon_ke_bbox(parts: list[str]) -> str | None:
    """
    Jika line memiliki > 5 elemen (format poligon: class x1 y1 x2 y2 ...),
    konversi ke format bounding box YOLO: class cx cy w h.
    """
    if len(parts) < 5:
        return None
    cls_id = parts[0]
    coords = [float(x) for x in parts[1:]]
    if len(coords) == 4:
        # Sudah format cx cy w h
        cx, cy, w, h = coords
        if 0 <= cx <= 1 and 0 <= cy <= 1 and 0 < w <= 1 and 0 < h <= 1:
            return f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n"
        return None
    
    # Poligon format x1, y1, x2, y2, ...
    if len(coords) >= 6:
        xs = coords[0::2]
        ys = coords[1::2]
        xmin, xmax = min(xs), max(xs)
        ymin, ymax = min(ys), max(ys)
        
        # Clamp ke [0, 1]
        xmin, xmax = max(0.0, xmin), min(1.0, xmax)
        ymin, ymax = max(0.0, ymin), min(1.0, ymax)
        
        w = xmax - xmin
        h = ymax - ymin
        if w <= 0.001 or h <= 0.001:
            return None
        cx = xmin + w / 2.0
        cy = ymin + h / 2.0
        return f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n"
    return None

def proses_zip(zip_path: Path):
    """Mengekstrak metadata dan daftar file gambar/label dari satu zip."""
    with zipfile.ZipFile(zip_path, 'r') as z:
        namelist = z.namelist()
        yaml_candidates = [f for f in namelist if f.endswith('.yaml') or f.endswith('.yml')]
        class_mapping = {}
        
        is_coin_dataset = 'coin' in zip_path.name.lower() or 'koin' in zip_path.name.lower()
        
        if yaml_candidates:
            yaml_content = z.read(yaml_candidates[0]).decode('utf-8')
            try:
                yd = yaml.safe_load(yaml_content)
                names = yd.get('names', [])
                if isinstance(names, list):
                    for i, name in enumerate(names):
                        mapped = petakan_nama_kelas(name)
                        if is_coin_dataset:
                            mapped = 7 # Paksa ke koin jika ini dataset koin
                        if mapped is not None:
                            class_mapping[i] = mapped
                elif isinstance(names, dict):
                    for i, name in names.items():
                        mapped = petakan_nama_kelas(name)
                        if is_coin_dataset:
                            mapped = 7
                        if mapped is not None:
                            class_mapping[int(i)] = mapped
            except Exception as e:
                print(f"  [PERINGATAN] Gagal parsing {yaml_candidates[0]}: {e}")
        
        # Fallback jika class_mapping masih kosong tapi dataset koin
        if is_coin_dataset and not class_mapping:
            for k in range(10): class_mapping[k] = 7
            
        print(f"\n📂 Memproses {zip_path.name}:")
        print(f"   Ukuran: {zip_path.stat().st_size / (1024*1024):.1f} MB")
        print(f"   Pemetaan Kelas: {class_mapping}")
        
        imgs = [f for f in namelist if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
        print(f"   Jumlah Gambar: {len(imgs)}")
        return class_mapping, is_coin_dataset

def main():
    t0 = time.time()
    input_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("model/ImageTraining")
    out_zip = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("model/dataset_hibrida_sudepi.zip")
    
    # Periksa input_dir atau cari di Downloads jika kosong
    if not input_dir.exists():
        input_dir.mkdir(parents=True, exist_ok=True)
        
    zips = sorted(list(input_dir.glob("*.zip")))
    if not zips:
        # Coba cek Downloads/Compressed
        dl_compressed = Path.home() / "Downloads" / "Compressed"
        if dl_compressed.exists():
            zips = sorted(list(dl_compressed.glob("*.zip")))
            if zips:
                print(f"[INFO] Mengambil berkas zip langsung dari {dl_compressed}")
                
    if not zips:
        print(f"[GALAT] Tidak menemukan berkas .zip di {input_dir} atau Downloads!")
        print("Silakan taruh file-file zip datasetmu di folder model/ImageTraining/")
        sys.exit(1)
        
    print("==========================================================")
    print("🚀 SUDEPI Universal Dataset Merger — Edisi Hibrida Emas")
    print("==========================================================")
    print(f"Target Output: {out_zip}\n")
    
    # Pre-scan total citra koin asli dan deteksi apakah ada dataset besar (Delta)
    total_koin_asli = 0
    total_kertas_asli = 0
    has_large_dataset = False
    
    for zp in zips:
        is_coin = 'coin' in zp.name.lower() or 'koin' in zp.name.lower()
        with zipfile.ZipFile(zp) as z_tmp:
            n_imgs = len([f for f in z_tmp.namelist() if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')) and 'readme' not in f.lower()])
            if is_coin:
                total_koin_asli += n_imgs
            else:
                total_kertas_asli += n_imgs
                if n_imgs > 10000:
                    has_large_dataset = True
                    
    # Jika ada dataset besar (Delta >10k citra), koin wajib di-oversample 8x agar mencapai ~15% total box
    if has_large_dataset:
        faktor_koin = 8
    elif total_koin_asli >= 800:
        faktor_koin = 1
    else:
        faktor_koin = max(1, 1000 // max(1, total_koin_asli))
        
    print(f"📊 Citra Kertas Asli Terdeteksi : {total_kertas_asli}")
    print(f"📊 Citra Koin Asli Terdeteksi   : {total_koin_asli}")
    print(f"⚖️ Faktor Pengali Koin         : {faktor_koin}x (Auto-Balancing {'Hibrida' if has_large_dataset else 'Dinamis'})\n")

    stats = {i: 0 for i in range(8)}
    split_stats = {'train': 0, 'valid': 0, 'test': 0}
    total_imgs = 0
    
    with zipfile.ZipFile(out_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as z_out:
        for zip_idx, zip_path in enumerate(zips):
            mapping, is_coin = proses_zip(zip_path)
            faktor_kali = faktor_koin if is_coin else 1
            
            with zipfile.ZipFile(zip_path, 'r') as z_in:
                namelist = set(z_in.namelist())
                imgs = [f for f in z_in.namelist() if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')) and 'readme' not in f.lower()]
                
                clean_stem = re.sub(r'[^a-zA-Z0-9_]', '_', zip_path.stem)
                prefix = f"z{zip_idx}_{clean_stem}"
                
                for idx, img_name in enumerate(imgs):
                    split = 'train'
                    if 'valid/' in img_name or 'val/' in img_name or '/valid/' in img_name or '/val/' in img_name:
                        split = 'valid'
                    elif 'test/' in img_name or '/test/' in img_name:
                        split = 'test'
                        
                    # Cari pasangan label
                    base_name = img_name.rsplit('.', 1)[0]
                    lbl_candidates = [
                        base_name + '.txt',
                        base_name.replace('/images/', '/labels/') + '.txt',
                        base_name.replace('images/', 'labels/') + '.txt'
                    ]
                    lbl_name = next((c for c in lbl_candidates if c in namelist and 'readme' not in c.lower()), None)
                    
                    if not lbl_name:
                        # Jika gambar background negatif (tanpa label), tetap proses dengan label kosong
                        if 'negatif' in img_name.lower() or 'bg_' in img_name.lower():
                            raw_lbl = ""
                        else:
                            continue
                    else:
                        try:
                            raw_lbl = z_in.read(lbl_name).decode('utf-8', errors='ignore')
                        except Exception:
                            continue
                            
                    try:
                        img_bytes = z_in.read(img_name)
                    except Exception:
                        continue
                        
                    new_lines = []
                    for line in raw_lbl.strip().split('\n'):
                        parts = line.strip().split()
                        if not parts:
                            continue
                        try:
                            src_cls = int(parts[0])
                        except ValueError:
                            continue
                            
                        if src_cls in mapping:
                            tgt_cls = mapping[src_cls]
                            parts[0] = str(tgt_cls)
                            bbox_line = polygon_ke_bbox(parts)
                            if bbox_line:
                                new_lines.append(bbox_line)
                                stats[tgt_cls] += faktor_kali
                                
                    if not new_lines:
                        # Jika background negatif, izinkan label kosong
                        if not ('negatif' in img_name.lower() or 'bg_' in img_name.lower()):
                            continue
                        
                    lbl_content = ''.join(new_lines).encode('utf-8')
                    ext = img_name.rsplit('.', 1)[1]
                    
                    for rep in range(faktor_kali):
                        rep_tag = f"_r{rep}" if rep > 0 else ""
                        out_img_name = f"images/{split}/{prefix}_{idx:05d}{rep_tag}.{ext}"
                        out_lbl_name = f"labels/{split}/{prefix}_{idx:05d}{rep_tag}.txt"
                        
                        z_out.writestr(out_img_name, img_bytes)
                        z_out.writestr(out_lbl_name, lbl_content)
                        total_imgs += 1
                        split_stats[split] += 1
                        
        # Tulis data.yaml resmi SUDEPI 8-kelas
        yaml_dict = {
            'path': '/content/dataset',
            'train': 'images/train',
            'val': 'images/valid',
            'test': 'images/test',
            'nc': 8,
            'names': TARGET_CLASSES
        }
        z_out.writestr('data.yaml', yaml.dump(yaml_dict, sort_keys=False))
        
    durasi = time.time() - t0
    print("\n==========================================================")
    print(f"🎉 SUKSES! Dataset Racikan Terpadu Selesai dalam {durasi:.1f} detik")
    print(f"📦 Output : {out_zip} ({out_zip.stat().st_size / (1024*1024):.1f} MB)")
    print(f"🖼️ Total Citra : {total_imgs}")
    print(f"   - Train : {split_stats['train']} citra")
    print(f"   - Valid : {split_stats['valid']} citra")
    print(f"   - Test  : {split_stats['test']} citra")
    print("📊 Sebaran Kotak Anotasi per Kelas:")
    for i in range(8):
        persen = (stats[i] / sum(stats.values()) * 100) if sum(stats.values()) > 0 else 0
        print(f"   [{i}] {TARGET_CLASSES[i]:<10}: {stats[i]:>6} kotak ({persen:4.1f}%)")
    print("==========================================================")

if __name__ == '__main__':
    main()
