# Evidence O

FIX-1 (header overflow), measured with Chrome DevTools MCP emulation, `scrollWidth` versus `clientWidth`:

| Viewport | Before | After |
| --- | --- | --- |
| 375 px | 467 vs 375 | 375 vs 375 |
| 320 px | worse | 320 vs 320 |
| 840 px | not measured | 825 vs 825 |
| 900 px | 1021 vs 885 | fits |
| 1080 px | 1132 vs 1065 | 1065 vs 1065 (also on /shop) |
