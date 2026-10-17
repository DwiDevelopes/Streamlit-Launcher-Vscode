import io

PATH = 'media/main.js'
s = io.open(PATH, encoding='utf-8', newline='').read()
MAP = [
    ('\\U0001F4CA', '\U0001F4CA'),  # bar chart
    ('\\U0001F4CC', '\U0001F4CC'),  # pushpin
    ('\\U0001F50E', '\U0001F50E'),  # magnifier
    ('\\U0001F333', '\U0001F333'),  # tree
    ('\\U0001F522', '\U0001F522'),  # input numbers
    ('\\U0001F4CB', '\U0001F4CB'),  # clipboard
]

total = 0
for old, new in MAP:
    n = s.count(old)
    total += n
    print(repr(old), '->', n, 'occurrence(s)')
    s = s.replace(old, new)

left = s.count('\\U')
print('total replaced:', total)
print('remaining literal \\U sequences:', left)

io.open(PATH, 'w', encoding='utf-8', newline='').write(s)
