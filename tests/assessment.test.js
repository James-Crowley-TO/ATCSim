# North Channel — a fictional 76 NM en-route sector.
# Coordinates are nautical miles from the upper-left corner.

MAP "North Channel"
SIZE 76 76

LAYER reference
STYLE color=#4d8398 opacity=0.22 width=1 pattern=dotted
CIRCLE 38 38 10
CIRCLE 38 38 20
CIRCLE 38 38 30
LINE 38 5 38 71 opacity=0.14
LINE 5 38 71 38 opacity=0.14

LAYER sector-boundaries
STYLE color=#67bdd5 opacity=0.52 width=1.4 pattern=dashed
LINE 6 17 18 6
LINE 18 6 38 9
LINE 38 9 53 4
LINE 53 4 70 20
LINE 70 20 66 40
LINE 66 40 72 57
LINE 72 57 53 70
LINE 53 70 34 65
LINE 34 65 13 72
LINE 13 72 4 50
LINE 4 50 10 33
LINE 10 33 6 17
ARC 38 38 27 225 45 pattern=hashed opacity=0.34 hash-spacing=18 hash-length=7
ARC 38 38 27 45 145 pattern=solid opacity=0.26

LAYER airways
STYLE color=#75a9ba opacity=0.34 width=1 pattern=solid
LINE 8 61 24 49
LINE 24 49 38 38
LINE 38 38 54 27
LINE 54 27 68 16
LINE 13 19 27 29 pattern=dashed
LINE 27 29 38 38 pattern=dashed
LINE 38 38 52 48 pattern=dashed
LINE 52 48 67 59 pattern=dashed
LINE 18 66 31 53 pattern=dotted opacity=0.28
LINE 31 53 45 42 pattern=dotted opacity=0.28
LINE 45 42 63 32 pattern=dotted opacity=0.28
LINE 11 53 30 44 pattern=hashed opacity=0.3 hash-spacing=15 hash-length=5

LAYER terminal-arcs
STYLE color=#8a82c9 opacity=0.34 width=1.2 pattern=dashed
ARC 24 49 8 205 25
ARC 54 27 7 20 210
CIRCLE 24 49 4 pattern=solid opacity=0.22
CIRCLE 54 27 3.5 pattern=dotted opacity=0.28

LAYER special-use
STYLE color=#d6a65b opacity=0.46 width=1.2 pattern=hashed hash-spacing=13 hash-length=6
CIRCLE 57 52 5.5
ARC 18 24 7 285 155 color=#cb7183 opacity=0.5
LINE 51.5 52 62.5 52 color=#d6a65b opacity=0.24 pattern=dashed

LAYER fixes
STYLE color=#9ad9e8 opacity=0.82 width=1.2 shape=triangle size=4.5 filled=false
POINT 13 19 label=ALDER
POINT 27 29 label=BRAVO shape=square rotation=45
POINT 38 38 label=NEXUS shape=circle size=5 filled=true color=#d4b65f opacity=0.9
POINT 52 48 label=RIVER shape=diamond
POINT 67 59 label=SOUTH shape=triangle rotation=180
POINT 24 49 label=WESTPORT shape=square size=5 color=#a9a1e0 opacity=0.75
POINT 54 27 label=EASTPORT shape=circle size=5 color=#a9a1e0 opacity=0.75
POINT 57 52 label=CYRUS shape=cross size=5 color=#e2b76c opacity=0.82
POINT 68 16 label="NORTH GATE" shape=triangle rotation=90 opacity=0.62
