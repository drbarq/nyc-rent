# Design plan — "MTA service advisory meets apartment hunt"

Checked against PRD §7 before any UI code was written.

1. The whole app reads as a printed service advisory: near-white paper, ink-black
   Helvetica-class grotesque, 1px ink rules for structure — no shadows, no cards,
   no gradient hero. The only color in the chrome is borrowed from real MTA line bullets.
2. Layout: full-bleed map; a single ruled left rail holds the black advisory header,
   data badge, weight sliders, and the ranked list; the detail panel slides over the
   map's right edge (bottom sheet on phones).
3. Signature element: authentic subway bullet strips — official line colors, white
   (black on N/Q/R/W yellow) letters — on every list row, the detail panel, and the
   comparison table. Everything around them stays quiet.
4. Score is the one continuous color: a desaturated printed gradient, muted red
   #B5483A → warm yellow #D9A441 → deep green #2E6B4F, used on map fills, rank
   stripes, and compare cells, with a legend.
5. Type: Helvetica Neue (the subway face), one big display weight for neighborhood
   names, tabular numerals for every figure; the map fly-to is the only animation;
   reduced motion respected; visible keyboard focus throughout.

Copy rules: plain, specific, sentence case. "Refresh rents," not "Sync data."
