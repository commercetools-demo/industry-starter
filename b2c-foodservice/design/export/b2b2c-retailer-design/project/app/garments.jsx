/* =========================================================================
   VELA — Studio garment renderer
   Original flat-lay activewear illustrations used as product imagery.
   <Garment type="leggings" palette={...} bg="..." /> -> SVG, square framing.
   ========================================================================= */

// Each palette: base fabric, shade (shadow), light (highlight), seam line, label
function paletteFor(colorway) {
  return {
    base:  colorway.base,
    shade: colorway.shade || colorway.base,
    light: colorway.light || colorway.base,
    seam:  colorway.seam || 'rgba(0,0,0,0.14)',
  };
}

function Garment({ type, colorway, className, bgTint }) {
  const uid = React.useId().replace(/[:]/g, '');
  const p = paletteFor(colorway);
  const gid = `g-${uid}`;
  const sid = `s-${uid}`;
  const bg = bgTint || 'rgba(0,0,0,0)';

  return (
    <svg className={className} viewBox="0 0 400 480" preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg" role="img" aria-label={type}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.5" stopColor={p.base} />
          <stop offset="1" stopColor={p.shade} />
        </linearGradient>
        <linearGradient id={`${gid}-x`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={p.shade} />
          <stop offset="0.5" stopColor={p.base} />
          <stop offset="1" stopColor={p.shade} />
        </linearGradient>
        <radialGradient id={sid} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(0,0,0,0.16)" />
          <stop offset="1" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* studio backdrop */}
      <rect x="0" y="0" width="400" height="480" fill={bg} />
      {/* contact shadow */}
      <ellipse cx="200" cy="432" rx="120" ry="26" fill={`url(#${sid})`} />

      {GARMENTS[type] ? GARMENTS[type](gid, p) : GARMENTS.tee(gid, p)}
    </svg>
  );
}

// helper to render a thin seam path
function seam(d, p, w) {
  return <path d={d} fill="none" stroke={p.seam} strokeWidth={w || 2.4} strokeLinecap="round" strokeLinejoin="round" />;
}

const GARMENTS = {
  // ---- High-rise leggings (flat lay, front) ----
  leggings: (gid, p) => (
    <g>
      <path d="M132 96 Q200 84 268 96 L272 150 Q280 230 256 320 L236 446 Q218 452 206 446 L200 320 L194 446 Q182 452 164 446 L144 320 Q120 230 128 150 Z"
            fill={`url(#${gid})`} />
      {/* waistband */}
      <path d="M132 96 Q200 84 268 96 L266 132 Q200 122 134 132 Z" fill={p.shade} opacity="0.5" />
      {seam("M134 130 Q200 120 266 130", p)}
      {/* center + inseam */}
      {seam("M200 132 L200 318", p, 2)}
      {seam("M168 444 L188 320", p, 2)}
      {seam("M232 444 L212 320", p, 2)}
      {/* ankle cuffs */}
      {seam("M150 432 Q168 438 188 432", p)}
      {seam("M250 432 Q232 438 212 432", p)}
      {/* side panel highlight */}
      <path d="M138 150 Q132 250 150 330" fill="none" stroke={p.light} strokeWidth="6" opacity="0.35" strokeLinecap="round" />
      <path d="M262 150 Q268 250 250 330" fill="none" stroke={p.light} strokeWidth="6" opacity="0.35" strokeLinecap="round" />
    </g>
  ),

  // ---- Sports bra ----
  bra: (gid, p) => (
    <g>
      {/* straps */}
      <path d="M150 150 Q158 196 168 224 L150 230 Q138 190 130 156 Z" fill={`url(#${gid})`} />
      <path d="M250 150 Q242 196 232 224 L250 230 Q262 190 270 156 Z" fill={`url(#${gid})`} />
      {/* band/body */}
      <path d="M128 210 Q200 196 272 210 L276 300 Q200 320 124 300 Z" fill={`url(#${gid})`} />
      {/* scoop neckline */}
      <path d="M150 214 Q200 250 250 214 Q200 236 150 214 Z" fill={p.shade} opacity="0.45" />
      {seam("M150 214 Q200 248 250 214", p)}
      {/* underband */}
      {seam("M132 286 Q200 300 268 286", p, 3)}
      <path d="M130 286 Q200 300 270 286 L272 300 Q200 316 128 300 Z" fill={p.shade} opacity="0.4" />
      {seam("M200 240 L200 286", p, 1.6)}
    </g>
  ),

  // ---- Racerback tank ----
  tank: (gid, p) => (
    <g>
      <path d="M150 132 Q200 120 250 132 L246 150 Q236 156 232 178 L240 360 Q200 372 160 360 L168 178 Q164 156 154 150 Z"
            fill={`url(#${gid})`} />
      {/* neckline */}
      <path d="M170 134 Q200 156 230 134 Q200 146 170 134 Z" fill={p.shade} opacity="0.4" />
      {seam("M170 134 Q200 156 230 134", p)}
      {/* armholes */}
      {seam("M156 150 Q150 200 168 250", p, 2)}
      {seam("M244 150 Q250 200 232 250", p, 2)}
      {seam("M166 352 Q200 362 234 352", p, 2)}
    </g>
  ),

  // ---- Training tee ----
  tee: (gid, p) => (
    <g>
      <path d="M150 128 L120 150 Q104 170 100 206 L126 224 Q134 210 140 196 L150 360 Q200 372 250 360 L260 196 Q266 210 274 224 L300 206 Q296 170 280 150 L250 128 Q200 116 150 128 Z"
            fill={`url(#${gid})`} />
      {/* collar */}
      <path d="M172 128 Q200 150 228 128 Q200 140 172 128 Z" fill={p.shade} opacity="0.4" />
      {seam("M172 128 Q200 150 228 128", p)}
      {/* sleeve seams */}
      {seam("M150 130 Q140 170 142 200", p, 2)}
      {seam("M250 130 Q260 170 258 200", p, 2)}
      {seam("M126 222 Q120 210 122 198", p, 2)}
      {seam("M274 222 Q280 210 278 198", p, 2)}
      {seam("M156 354 Q200 364 244 354", p, 2)}
    </g>
  ),

  // ---- Long-sleeve training top ----
  longsleeve: (gid, p) => (
    <g>
      <path d="M150 126 L116 146 Q92 230 86 320 L118 332 Q132 268 140 214 L150 360 Q200 372 250 360 L260 214 Q268 268 282 332 L314 320 Q308 230 284 146 L250 126 Q200 114 150 126 Z"
            fill={`url(#${gid})`} />
      <path d="M172 126 Q200 148 228 126 Q200 138 172 126 Z" fill={p.shade} opacity="0.4" />
      {seam("M172 126 Q200 148 228 126", p)}
      {seam("M150 128 Q140 240 142 320", p, 2)}
      {seam("M250 128 Q260 240 258 320", p, 2)}
      {/* cuffs */}
      {seam("M90 318 Q102 326 118 322", p)}
      {seam("M310 318 Q298 326 282 322", p)}
      {seam("M156 354 Q200 364 244 354", p, 2)}
    </g>
  ),

  // ---- Hoodie ----
  hoodie: (gid, p) => (
    <g>
      {/* hood */}
      <path d="M158 132 Q200 104 242 132 Q236 168 200 176 Q164 168 158 132 Z" fill={p.shade} opacity="0.55" />
      <path d="M150 130 L112 150 Q88 232 82 322 L116 334 Q130 270 138 214 L146 366 Q200 380 254 366 L262 214 Q270 270 284 334 L318 322 Q312 232 288 150 L250 130 Q244 162 200 170 Q156 162 150 130 Z"
            fill={`url(#${gid})`} />
      {seam("M150 130 Q156 164 200 172 Q244 164 250 130", p)}
      {/* pocket */}
      <path d="M150 290 L250 290 L244 338 L156 338 Z" fill={p.shade} opacity="0.3" />
      {seam("M150 290 L250 290 L244 338 L156 338 Z", p)}
      {/* drawstrings */}
      {seam("M188 168 L186 226", p, 2.2)}
      {seam("M212 168 L214 226", p, 2.2)}
      <circle cx="186" cy="228" r="3.4" fill={p.seam} />
      <circle cx="214" cy="228" r="3.4" fill={p.seam} />
      {seam("M150 132 Q140 240 142 322", p, 2)}
      {seam("M250 132 Q260 240 258 322", p, 2)}
      {seam("M90 320 Q104 330 120 324", p)}
      {seam("M310 320 Q296 330 280 324", p)}
    </g>
  ),

  // ---- Zip jacket ----
  jacket: (gid, p) => (
    <g>
      <path d="M150 122 L114 144 Q90 228 84 320 L116 332 Q130 268 138 212 L146 364 Q200 376 254 364 L262 212 Q270 268 284 332 L316 320 Q310 228 286 144 L250 122 Q200 112 150 122 Z"
            fill={`url(#${gid})`} />
      {/* collar */}
      <path d="M150 122 Q200 112 250 122 L246 142 Q200 134 154 142 Z" fill={p.shade} opacity="0.5" />
      {seam("M154 142 Q200 134 246 142", p)}
      {/* center zip */}
      {seam("M200 130 L200 366", p, 2.6)}
      <rect x="197" y="150" width="6" height="200" fill={p.shade} opacity="0.35" />
      {/* zip pull */}
      <rect x="196" y="196" width="8" height="14" rx="2" fill={p.seam} />
      {/* sleeve + cuff seams */}
      {seam("M150 124 Q140 240 142 320", p, 2)}
      {seam("M250 124 Q260 240 258 320", p, 2)}
      {seam("M92 318 Q104 328 120 322", p)}
      {seam("M308 318 Q296 328 280 322", p)}
      {/* hand pockets */}
      {seam("M150 300 L176 296", p, 2)}
      {seam("M250 300 L224 296", p, 2)}
    </g>
  ),

  // ---- Training shorts ----
  shorts: (gid, p) => (
    <g>
      <path d="M134 150 Q200 138 266 150 L272 196 Q268 248 250 286 L210 286 L200 230 L190 286 L150 286 Q132 248 128 196 Z"
            fill={`url(#${gid})`} />
      <path d="M134 150 Q200 138 266 150 L264 178 Q200 168 136 178 Z" fill={p.shade} opacity="0.5" />
      {seam("M136 176 Q200 166 264 176", p)}
      {seam("M200 178 L200 228", p, 2)}
      {seam("M152 282 Q172 288 190 282", p, 2)}
      {seam("M248 282 Q228 288 210 282", p, 2)}
    </g>
  ),

  // ---- Joggers ----
  joggers: (gid, p) => (
    <g>
      <path d="M132 118 Q200 106 268 118 L276 168 Q282 250 258 330 L242 430 Q224 436 210 430 L200 300 L190 430 Q176 436 158 430 L142 330 Q118 250 124 168 Z"
            fill={`url(#${gid})`} />
      <path d="M132 118 Q200 106 268 118 L266 150 Q200 140 134 150 Z" fill={p.shade} opacity="0.5" />
      {seam("M134 148 Q200 138 266 148", p)}
      {seam("M200 150 L200 298", p, 2)}
      {/* cuffs */}
      <path d="M154 410 Q176 418 196 410 L194 430 Q176 436 158 430 Z" fill={p.shade} opacity="0.4" />
      <path d="M246 410 Q224 418 204 410 L206 430 Q224 436 242 430 Z" fill={p.shade} opacity="0.4" />
      {seam("M154 410 Q176 418 196 410", p)}
      {seam("M246 410 Q224 418 204 410", p)}
      {/* side stripe */}
      <path d="M140 168 Q132 260 150 340" fill="none" stroke={p.light} strokeWidth="5" opacity="0.35" strokeLinecap="round" />
    </g>
  ),

  // ---- Cap (accessory) ----
  cap: (gid, p) => (
    <g>
      <path d="M120 250 Q120 168 200 168 Q280 168 280 250 Q200 232 120 250 Z" fill={`url(#${gid})`} />
      <path d="M112 250 Q200 234 290 252 Q300 268 286 280 L120 278 Q104 266 112 250 Z" fill={p.shade} opacity="0.7" />
      {seam("M200 170 L200 244", p, 2)}
      {seam("M164 178 Q160 214 174 248", p, 1.8)}
      {seam("M236 178 Q240 214 226 248", p, 1.8)}
      <circle cx="200" cy="174" r="5" fill={p.seam} />
    </g>
  ),

  // ---- Tote / duffel (accessory) ----
  bag: (gid, p) => (
    <g>
      <path d="M150 196 Q150 150 200 150 Q250 150 250 196" fill="none" stroke={p.base} strokeWidth="10" />
      <path d="M124 196 L276 196 Q286 196 286 208 L278 348 Q276 360 264 360 L136 360 Q124 360 122 348 L114 208 Q114 196 124 196 Z"
            fill={`url(#${gid})`} />
      {seam("M124 220 L276 220", p, 2)}
      {seam("M200 220 L200 352", p, 1.8)}
    </g>
  ),

  // ---- Water bottle (accessory) ----
  bottle: (gid, p) => (
    <g>
      <rect x="178" y="118" width="44" height="26" rx="6" fill={p.shade} />
      <path d="M170 150 Q170 142 200 142 Q230 142 230 150 L236 360 Q236 380 216 382 L184 382 Q164 380 164 360 Z"
            fill={`url(#${gid})`} />
      {seam("M170 210 L230 210", p, 2)}
      {seam("M168 280 L232 280", p, 2)}
      <rect x="176" y="120" width="48" height="10" rx="5" fill={p.seam} opacity="0.5" />
    </g>
  ),
};

Object.assign(window, { Garment, GARMENTS });
