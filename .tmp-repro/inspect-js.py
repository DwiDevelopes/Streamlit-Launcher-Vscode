s = open('media/main.js', encoding='utf-8').read()
markers = [
    "    function decisionTreeSection(sheet) {",
    "})();",
    "            ['summary', 'Summary'],",
    "        // ---- Stock & Inventory ----",
    "        stockSection(sheet);",
    "        // ---- Decision Tree ----",
    "    function decisionTreeSection",
]
for m in markers:
    print(repr(m), '->', s.count(m))
lines = s.split('\n')
idx = next(i for i, l in enumerate(lines) if l.startswith('    function decisionTreeSection'))
print('decisionTreeSection starts at line', idx + 1, '| total lines', len(lines))
for i in range(len(lines) - 6, len(lines)):
    print(i + 1, repr(lines[i]))
print('--- trailing whitespace-only lines inside decision tree section ---')
for i in range(idx, len(lines)):
    if lines[i].strip() == '' and lines[i] != '':
        print(i + 1, repr(lines[i]))
