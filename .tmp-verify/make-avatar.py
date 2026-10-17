"""Buat ikon profil bawaan Pet Community (scratch, hasilnya media/community-default.png)."""
from PIL import Image, ImageDraw

S = 128
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# kartu bundar gelap (senada tema pet)
d.rounded_rectangle((4, 4, S - 4, S - 4), radius=28, fill=(43, 48, 56, 255), outline=(75, 85, 99, 255), width=2)

# badan + kepala laba-laba sederhana
d.ellipse((44, 58, 84, 98), fill=(58, 65, 73, 255))          # badan
d.ellipse((48, 34, 80, 66), fill=(52, 58, 66, 255), outline=(75, 85, 99, 255), width=2)  # kepala

# kaki (garis)
for x1, y1, x2, y2 in [
    (48, 62, 26, 48), (46, 70, 22, 68), (48, 78, 26, 88), (52, 86, 34, 100),
    (80, 62, 102, 48), (82, 70, 106, 68), (80, 78, 102, 88), (76, 86, 94, 100),
]:
    d.line((x1, y1, x2, y2), fill=(34, 38, 44, 255), width=6)

# mata + pupil
d.ellipse((52, 44, 62, 54), fill=(232, 246, 255, 255))
d.ellipse((66, 44, 76, 54), fill=(232, 246, 255, 255))
d.ellipse((55, 47, 60, 52), fill=(23, 50, 74, 255))
d.ellipse((69, 47, 74, 52), fill=(23, 50, 74, 255))

# antena kecil di atas kepala
d.line((56, 34, 50, 22), fill=(143, 163, 184, 255), width=3)
d.line((72, 34, 78, 22), fill=(143, 163, 184, 255), width=3)
d.ellipse((46, 18, 54, 26), fill=(242, 193, 78, 255))
d.ellipse((74, 18, 82, 26), fill=(242, 193, 78, 255))

img.save("media/community-default.png")
print("ditulis: media/community-default.png", img.size)
