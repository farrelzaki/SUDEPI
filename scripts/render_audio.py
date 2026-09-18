"""
Merender potongan audio Bahasa Indonesia ke `public/audio/`.

Dijalankan SEKALI oleh pengembang, bukan saat aplikasi berjalan. Hasilnya
dibundel ke dalam APK, sehingga aplikasi tidak pernah membutuhkan jaringan
untuk bersuara. Lihat ADR-0003.

    python scripts/render_audio.py

Butuh internet (memakai suara neural Microsoft Edge) dan paket `edge-tts`:

    python -m pip install edge-tts

KENAPA TIDAK MEMAKAI speechSynthesis SAJA. Di dalam WebView Android, API itu
meneruskan permintaan ke mesin TTS sistem, yang hanya bekerja luring bila paket
suara Bahasa Indonesia sudah terpasang di perangkat itu. Paket itu tidak selalu
ada dan tidak bisa kami pasang dari dalam aplikasi. Kalau tidak ada, HP mencoba
mengambilnya dari jaringan — dan dalam mode pesawat aplikasi MEMBISU TOTAL.

Untuk aplikasi yang seluruh keluarannya suara dan dipakai orang yang tidak bisa
membaca layar, membisu bukan berarti berkurang fiturnya; ia sepenuhnya tidak
berguna. Dan kegagalan itu paling mungkin terjadi justru di HP yang baru
pertama kali dipasangi aplikasi kami — misalnya HP juri.
"""

import asyncio
import json
import sys
import tempfile
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("Butuh edge-tts. Jalankan: python -m pip install edge-tts")

try:
    import miniaudio
except ImportError:
    sys.exit("Butuh miniaudio. Jalankan: python -m pip install miniaudio")

# Ardi terdengar lebih tenang dan rendah, lebih mudah ditangkap di tengah
# kebisingan pasar dibanding suara bernada tinggi.
SUARA = "id-ID-ArdiNeural"

# Sedikit lebih lambat dari normal. Pengguna mendengar nominal SEKALI, sambil
# memegang uang dan menghadapi kasir yang menunggu; tidak ada kesempatan
# mengulang.
KECEPATAN = "-5%"

KELUARAN = Path(__file__).resolve().parent.parent / "public" / "audio"

# Hasil akhir disimpan sebagai WAV, bukan MP3.
#
# edge-tts hanya menghasilkan MPEG-2 Layer III 24 kHz — varian MP3 yang tidak
# umum. Versi MP3 sudah terbukti berjalan di WebView Galaxy M32, jadi ini bukan
# perbaikan atas kegagalan yang teramati, melainkan penghapusan satu variabel:
# WebView di HP juri bisa versi lain, dan kalau codec-nya bermasalah gejalanya
# adalah aplikasi MEMBISU tanpa pesan apa pun.
#
# WAV/PCM tidak melibatkan codec sama sekali. Biayanya 3,3 MB dibanding 415 KB,
# yang tidak berarti di samping runtime WASM 14 MB — dan murah untuk menukar
# satu kemungkinan gagal-senyap dengan kepastian.

# Potongan bilangan. Naskahnya ditulis apa adanya supaya edge-tts melafalkannya
# sebagai kata, bukan sebagai angka.
KLIP_BILANGAN = {
    "nol": "nol",
    "satu": "satu",
    "dua": "dua",
    "tiga": "tiga",
    "empat": "empat",
    "lima": "lima",
    "enam": "enam",
    "tujuh": "tujuh",
    "delapan": "delapan",
    "sembilan": "sembilan",
    "sepuluh": "sepuluh",
    "sebelas": "sebelas",
    "belas": "belas",
    "puluh": "puluh",
    "seratus": "seratus",
    "ratus": "ratus",
    "seribu": "seribu",
    "ribu": "ribu",
    "juta": "juta",
    "rupiah": "rupiah",
}

# Frasa sistem. WAJIB sama persis dengan TEKS_FRASA di src/audio/frasa.ts —
# kalau ada kunci yang tidak dirender, ia akan terdengar sebagai KEHENINGAN di
# tengah kalimat, dan itu jenis kegagalan yang tidak akan terlihat di kode.
KLIP_FRASA = {
    "arahkan_kamera": "Arahkan kamera ke uang",
    "belum_yakin_ulangi": "Belum yakin. Coba pindai lagi",
    "renggangkan_lembaran": "Renggangkan lembarannya",
    "total_belanja": "Total belanja",
    "uang_dibayar": "Uang dibayar",
    "kembalian": "Kembalian",
    "ditambah_koin": "ditambah koin",
    "uang_kurang": "Uang kurang dari total belanja",
    "transaksi_dibatalkan": "Transaksi dibatalkan",
    "transaksi_selesai": "Transaksi selesai",
    "mode_siaga": "Siap memindai",
    "terdeteksi": "Terdeteksi",
    "total": "Total",
    "tidak_ada_uang": "Tidak ada uang terdeteksi",
}

SEMUA = {**KLIP_BILANGAN, **KLIP_FRASA}


async def render(nama: str, teks: str) -> int:
    berkas = KELUARAN / f"{nama}.wav"

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as sementara:
        jalur_mp3 = Path(sementara.name)

    try:
        komunikasi = edge_tts.Communicate(teks, SUARA, rate=KECEPATAN)
        await komunikasi.save(str(jalur_mp3))

        pcm = miniaudio.decode_file(
            str(jalur_mp3),
            output_format=miniaudio.SampleFormat.SIGNED16,
            nchannels=1,
            sample_rate=24000,
        )
        miniaudio.wav_write_file(str(berkas), pcm)
    finally:
        jalur_mp3.unlink(missing_ok=True)

    return berkas.stat().st_size


async def main() -> None:
    KELUARAN.mkdir(parents=True, exist_ok=True)
    total = 0

    for nama, teks in SEMUA.items():
        ukuran = await render(nama, teks)
        total += ukuran
        print(f"  {nama:24} {ukuran:>7,} B   \"{teks}\"")

    # Manifes menyebut potongan yang TERSEDIA. Pemutar memakainya untuk
    # memutuskan apakah jalur sprite bisa dipakai atau harus jatuh ke TTS.
    manifes = {
        "suara": SUARA,
        "kecepatan": KECEPATAN,
        "format": "wav",
        "potongan": sorted(SEMUA.keys()),
    }
    (KELUARAN / "manifes.json").write_text(
        json.dumps(manifes, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"\n{len(SEMUA)} potongan, total {total / 1024:.0f} KB -> {KELUARAN}")


if __name__ == "__main__":
    asyncio.run(main())
