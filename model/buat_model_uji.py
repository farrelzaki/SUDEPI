"""
Membuat model ONNX TIRUAN untuk menguji pipeline.

    python model/buat_model_uji.py

Menghasilkan `public/model/sudepi.onnx` berisi model yang bentuk keluarannya
sama persis dengan YOLOv8n asli, tetapi isinya TETAP: ia selalu "mendeteksi"
selembar Rp50.000 dan satu koin di posisi yang sama, apa pun yang dilihat
kamera.

=============================== BACA INI DULU ===============================

MODEL INI BUKAN PENDETEKSI UANG. Ia tidak melihat apa pun.

Gunanya satu: membuktikan seluruh rantai aplikasi tersambung — decode,
NMS, voting temporal, state machine, audio, haptik, dan penyimpanan riwayat —
SEBELUM model sungguhan selesai dilatih. Tanpa ini, 32 dari 34 potongan audio
tidak pernah bisa dipicu, dan Fase 2 sampai 4 tidak pernah bisa dijalankan di
perangkat.

JANGAN PERNAH dipakai untuk demo. Aplikasi yang menyebut nominal tanpa melihat
uang adalah kebalikan dari seluruh tujuan produk ini. Hapus berkasnya begitu
model asli tersedia:

    rm public/model/sudepi.onnx

Skrip ini juga menulis `public/model/MODEL_TIRUAN` sebagai penanda, supaya
ketahuan kalau ada yang lupa menggantinya.

=============================================================================
"""

import sys
from pathlib import Path

try:
    import numpy as np
    import onnx
    from onnx import TensorProto, helper, numpy_helper
except ImportError:
    sys.exit("Butuh onnx dan numpy. Jalankan: python -m pip install onnx numpy")

AKAR = Path(__file__).resolve().parent.parent
KELUARAN = AKAR / "public" / "model" / "sudepi.onnx"
PENANDA = AKAR / "public" / "model" / "MODEL_TIRUAN"

UKURAN = 320
JUMLAH_KELAS = 8
KANAL = 4 + JUMLAH_KELAS
JANGKAR = (UKURAN // 8) ** 2 + (UKURAN // 16) ** 2 + (UKURAN // 32) ** 2

# Kelas 5 = rp50000, kelas 7 = koin. Lihat data.yaml.
KELAS_UANG = 5
KELAS_KOIN = 7


def buat_keluaran() -> np.ndarray:
    """Menyusun tensor keluaran tetap berbentuk [1, 12, 2100]."""
    keluar = np.zeros((1, KANAL, JANGKAR), dtype=np.float32)

    # Dua "deteksi" pada dua jangkar berbeda. Koordinatnya dalam piksel ruang
    # masukan model dengan titik acuan TENGAH kotak, sama seperti YOLOv8.
    #
    # Sengaja ditempatkan berjauhan supaya tidak saling menindih dan lolos NMS
    # sebagai dua objek terpisah — kalau bertumpuk, salah satunya akan disaring
    # dan kita tidak menguji jalur koin.
    deteksi = [
        (0, 160.0, 110.0, 240.0, 110.0, KELAS_UANG),  # selembar Rp50.000
        (1, 160.0, 250.0, 60.0, 60.0, KELAS_KOIN),    # satu koin
    ]

    for jangkar, cx, cy, lebar, tinggi, kelas in deteksi:
        keluar[0, 0, jangkar] = cx
        keluar[0, 1, jangkar] = cy
        keluar[0, 2, jangkar] = lebar
        keluar[0, 3, jangkar] = tinggi
        # Skor jauh di atas AMBANG_KEYAKINAN (0,85) supaya lolos gating dan
        # voting temporal dengan cepat.
        keluar[0, 4 + kelas, jangkar] = 0.97

    return keluar


def main() -> None:
    tensor = buat_keluaran()

    # Graf yang mengabaikan masukan sepenuhnya: ia hanya mengeluarkan konstanta.
    # Masukan tetap dideklarasikan supaya bentuknya cocok dengan yang dikirim
    # aplikasi, dan supaya periksa_onnx.py bisa memeriksanya seperti model asli.
    masuk = helper.make_tensor_value_info(
        "images", TensorProto.FLOAT, [1, 3, UKURAN, UKURAN]
    )
    keluar = helper.make_tensor_value_info(
        "output0", TensorProto.FLOAT, [1, KANAL, JANGKAR]
    )

    konstanta = helper.make_node(
        "Constant",
        inputs=[],
        outputs=["output0"],
        value=numpy_helper.from_array(tensor, name="nilai_tetap"),
    )

    graf = helper.make_graph(
        [konstanta], "sudepi_model_tiruan", [masuk], [keluar]
    )
    model = helper.make_model(
        graf,
        producer_name="buat_model_uji.py",
        opset_imports=[helper.make_opsetid("", 12)],
    )
    model.doc_string = (
        "MODEL TIRUAN. Tidak melihat apa pun; selalu mengeluarkan deteksi yang "
        "sama. Hanya untuk menguji pipeline. JANGAN dipakai untuk demo."
    )
    onnx.checker.check_model(model)

    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(model, str(KELUARAN))
    PENANDA.write_text(
        "Berkas public/model/sudepi.onnx saat ini adalah MODEL TIRUAN.\n"
        "Ia tidak melihat apa pun dan selalu menyebut Rp50.000 ditambah koin.\n"
        "Hapus berkas ini dan sudepi.onnx begitu model asli tersedia.\n",
        encoding="utf-8",
    )

    ukuran = KELUARAN.stat().st_size / 1024
    print(f"Ditulis : {KELUARAN}  ({ukuran:.0f} KB)")
    print(f"Penanda : {PENANDA}")
    print()
    print(f"Bentuk keluaran [1, {KANAL}, {JANGKAR}]")
    print("Selalu 'mendeteksi': satu lembar Rp50.000 dan satu koin.")
    print()
    print("INI BUKAN PENDETEKSI UANG. Jangan dipakai untuk demo.")
    print("Hapus begitu model asli tersedia:")
    print("  rm public/model/sudepi.onnx public/model/MODEL_TIRUAN")


if __name__ == "__main__":
    main()
