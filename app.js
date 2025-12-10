/* ===========================================================
   app.js — Cleaned, modular, final
   -----------------------------------------------------------
   TABLE OF CONTENTS
   1) CONFIG & DOM
   2) STATE
   3) HELPERS
   3.1) MODE MANAGER & UI BINDINGS
   4) RENDERING
   5) HIT TESTS & SELECTION
   6) DRAWING TOOLS
   7) UNDO / REDO / HISTORY (kept independent from CLEAR)
   8) DIAGNOSIS ASSIGN / AUTO-ASSIGN
   9) SINGLE CLEAR BUTTON (INDEPENDENT)
   10) RESET / SAVE / MISC
   11) UI UPDATES
   12) INIT
   =========================================================== */

/* ---------------- 1) CONFIG & DOM ---------------- */
const canvas = document.getElementById("canvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const tabOrgan = document.getElementById("tabOrgan");
const tabDraw = document.getElementById("tabDraw");
const imageSelect = document.getElementById("imageSelect");

const organName = document.getElementById("organName");
const diagnosisPanel = document.getElementById("diagnosisPanel");
const diagnosisSelect = document.getElementById("diagnosisSelect");
const diagnosisOther = document.getElementById("diagnosisOtherText");
const otherBoxWrapper = document.getElementById("otherBoxWrapper");

const drawModeSelect = document.getElementById("drawModeSelect");
const toggleFillBtn = document.getElementById("toggleFill");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const drawColour = document.getElementById("drawColour");
const drawThickness = document.getElementById("drawThickness");
const fillOpacitySlider = document.getElementById("fillOpacity");
const diagnosisOpacitySlider = document.getElementById("diagnosisOpacity");
const toggleOutlinesBtn = document.getElementById("toggleOutlines");
const clearSelectionBtn = document.getElementById("clearSelection");
const resetAllBtn = document.getElementById("resetAll");
const savePNGBtn = document.getElementById("savePNG");
const statusBox = document.getElementById("statusBox");
const canvasHolder = document.getElementById("canvasHolder");


/* ---------------- 2) STATE ---------------- */
/* Mode: "organ" or "draw" */
let mode = "organ";

/* Image and drawing state */
let img = new Image();
let shapes = []; // array of shape objects: {id, type: "stroke"|"smooth"|"line"|"polygon", points, x1,y1,x2,y2, color, thickness, diagnosis, filled}
let polygonPoints = [];
let currentLine = null;
let drawing = false;
let currentStroke = null; // {id, type:"stroke"|"smooth", points:[], color, thickness, ...}
let showOutlines = true;
let fillModeAuto = true;

/* Selection */
let selectedShapeIds = new Set();
let selectedOrgNames = new Set();
let activeShapeId = null;
let activeOrg = null;

/* 🔥 REQUIRED FIX — THIS WAS MISSING AND BROKE THE ENTIRE APP */
let organDiagnoses = {};   // <— THIS MUST EXIST

/* Undo/Redo stacks (UNDO must remain independent; CLEAR does NOT push here) */
let undoStack = [];
let redoStack = [];

/* id generator */
const uid = () => "id" + Math.floor(Math.random() * 1e12);




/* ---------------- 3) HELPERS ---------------- */
const logStatus = (m) => { if(statusBox) statusBox.textContent = m; console.log(m); };
const staticPath = (fn) => "static/" + encodeURIComponent(fn);

function debounce(fn, wait){ let t=null; return (...a)=>{ if(t) clearTimeout(t); t=setTimeout(()=>{ t=null; fn(...a); }, wait); }; }
function centroid(points){ if(!points||!points.length) return {x:0,y:0}; let x=0,y=0; for(const p of points){x+=p.x;y+=p.y;} return { x: x/points.length, y: y/points.length }; }
function distToSegment(px,py,x1,y1,x2,y2){ const A=px-x1,B=py-y1,C=x2-x1,D=y2-y1; const dot=A*C+B*D; const lenSq=C*C+D*D; let param = lenSq ? dot/lenSq : -1; let xx,yy; if(param<0){xx=x1;yy=y1;} else if(param>1){xx=x2;yy=y2;} else {xx=x1+param*C;yy=y1+param*D;} return Math.hypot(px-xx,py-yy); }
function pointInPoly(pt, poly){ if(!poly||poly.length<3) return false; let inside=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y; const intersect = ((yi>pt.y)!=(yj>pt.y)) && pt.x < (xj-xi)*(pt.y-yi)/(yj-yi)+xi; if(intersect) inside = !inside; } return inside; }

/* helper to get canvas coords */
function getCanvasPoint(evt){
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return { x: Math.round((evt.clientX - rect.left) * sx), y: Math.round((evt.clientY - rect.top) * sy) };
}


/* ---------------- 3.1) MODE MANAGER & UI BINDINGS ---------------- */
/* Centralized manager to avoid stuck/duplicate listeners */
(function initModeManager(){
  const tabs = { organ: tabOrgan, draw: tabDraw };
  const drawControls = [ drawModeSelect, drawColour, drawThickness, toggleFillBtn ];

  function setMode(newMode){
    if(!newMode) return;
    newMode = newMode === "draw" ? "draw" : "organ";

    // if no change, skip
    if(mode === newMode) return;
    mode = newMode;

    // UI tab highlight
    if(tabs.organ) tabs.organ.classList.toggle("active", mode === "organ");
    if(tabs.draw)  tabs.draw.classList.toggle("active", mode === "draw");

    // enable/disable draw controls
    if(Array.isArray(drawControls)){
      drawControls.forEach(el => { 
        if(!el) return;
        try { el.disabled = (mode !== "draw"); } catch(e){}
      });
    }

    // ---------------- FIX: Fully exit draw tool state when switching to organ mode ----------------
    if(mode === "organ"){
      if (drawModeSelect) drawModeSelect.value = "";   // <- THIS LINE FIXES BOTH OF YOUR REMAINING PROBLEMS

      polygonPoints = [];
      currentStroke = null;
      currentLine = null;
      drawing = false;
      drawEverything();
    }

    // ensure drawModeSelect is valid when entering draw mode
    if(mode === "draw" && drawModeSelect){
      const val = drawModeSelect.value;
      if(!val || !["pen","smooth","line","polygon"].includes(val)){
        drawModeSelect.value = "pen";
      }
    }

    updateUI && typeof updateUI === "function" && updateUI();
  }

  // attach tab clicks
  if(tabOrgan){
    tabOrgan.addEventListener("click", ()=> setMode("organ"));
  }
  if(tabDraw){
    tabDraw.addEventListener("click", ()=> setMode("draw"));
  }

  /* Prevent draw tools from forcing mode changes */
  if(drawModeSelect){
    drawModeSelect.addEventListener("change", ()=>{
      if (mode !== "draw") return;
    });
  }

  // simple toggles
  if(toggleFillBtn)
    toggleFillBtn.addEventListener("click", ()=>{
      fillModeAuto = !fillModeAuto;
      toggleFillBtn.textContent = `Fill Mode: ${fillModeAuto ? "AUTO" : "MANUAL"}`;
    });

  if(toggleOutlinesBtn)
    toggleOutlinesBtn.addEventListener("click", ()=>{
      showOutlines = !showOutlines;
      drawEverything();
    });

// init
  setMode(mode);
  // FIX: Explicitly ensure undo/redo buttons are enabled upon initialization,
  // as they are no longer managed by the drawControls disabling logic.
  if (undoBtn) undoBtn.disabled = false;
  if (redoBtn) redoBtn.disabled = false;

  window._setMode = setMode;
})();


/* ---------------- 4) RENDERING ---------------- */
/* leave complex fill behaviour to DIAGNOSIS_CONFIG in diagnoses.js */
/* ================================================
   CUSTOM PATTERN BUILDERS FOR ALL DIAGNOSES
   ================================================ */

window.PATTERN_BUILDERS = window.PATTERN_BUILDERS || {};

/* -------------------------------------------------
   1) POLYP – Strawberry outline with seeds
   ------------------------------------------------- */
window.PATTERN_BUILDERS.PATTERN_POLYP_STRAWBERRY = function(g){
    g.clearRect(0,0,40,40);

    g.beginPath();
    g.fillStyle = "rgba(150,30,150,1)";
    g.moveTo(20,4);
    g.bezierCurveTo(5,4,5,25,20,36);
    g.bezierCurveTo(35,25,35,4,20,4);
    g.fill();

    g.fillStyle = "rgba(255,255,255,0.9)";
    for(let i=0;i<10;i++){
        let x = Math.random()*24+8;
        let y = Math.random()*20+10;
        g.beginPath();
        g.ellipse(x, y, 2, 3, 0, 0, Math.PI*2);
        g.fill();
    }
};

/* -------------------------------------------------
   2) DIVERTICULOSIS – Elliptical sacs
   ------------------------------------------------- */
window.PATTERN_BUILDERS.PATTERN_DIVERTICULA_ELLIPSE = function(g){
    g.clearRect(0,0,40,40);
    for(let i=0;i<6;i++){
        g.beginPath();
        g.fillStyle = "rgba(230,200,120,1)";
        g.ellipse(
            Math.random()*36+2,
            Math.random()*36+2,
            Math.random()*5+2,
            Math.random()*7+3,
            Math.random()*Math.PI,
            0,
            Math.PI*2
        );
        g.fill();
    }
};

/* -------------------------------------------------
   3) VARICES / HEMORRHOIDS – Vertical blue veins w/ gradient
   ------------------------------------------------- */
window.PATTERN_BUILDERS.PATTERN_BLUE_VENOUS_VERTICAL = function(g){
    g.clearRect(0,0,40,40);

    for(let i=0;i<3;i++){
        let x = Math.random()*20+10;

        let grad = g.createLinearGradient(x,0,x,40);
        grad.addColorStop(0, "rgba(120,180,255,0.8)");
        grad.addColorStop(1, "rgba(0,60,200,1)");

        g.strokeStyle = grad;
        g.lineWidth = 4;

        g.beginPath();
        g.moveTo(x,0);
        g.bezierCurveTo(x-5,10, x+5,20, x,40);
        g.stroke();
    }
};

/* -------------------------------------------------
   4) BLEEDING – Single red fountain
   ------------------------------------------------- */
window.PATTERN_BUILDERS.PATTERN_BLEEDING_FOUNTAIN_RED = function(g){
    g.clearRect(0,0,40,40);

    g.fillStyle = "rgba(220,0,0,1)";

    g.beginPath();
    g.moveTo(20,35);
    g.bezierCurveTo(10,25, 10,15, 20,5);
    g.bezierCurveTo(30,15, 30,25, 20,35);
    g.fill();
};


/* -------------------------------------------------
   6) ULCER – Yellow crater with red rim
   ------------------------------------------------- */
window.PATTERN_BUILDERS.PATTERN_ULCER_YELLOW_BASE = function(g){
    g.clearRect(0,0,40,40);

    g.fillStyle = "rgba(255,230,80,1)";
    g.beginPath();
    g.ellipse(20,20,12,8,0,0,Math.PI*2);
    g.fill();

    g.strokeStyle = "rgba(200,0,0,1)";
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(20,20,14,10,0,0,Math.PI*2);
    g.stroke();
};

/* -------------------------------------------------
   7) BARRETTS – Pink smooth gradient
   ------------------------------------------------- */
window.PATTERN_BUILDERS.PATTERN_BARRETTS_SMOOTH = function(g){
    g.clearRect(0,0,40,40);

    let grad = g.createLinearGradient(0,0,40,40);
    grad.addColorStop(0, "rgba(255,150,150,1)");
    grad.addColorStop(1, "rgba(255,120,130,1)");

    g.fillStyle = grad;
    g.fillRect(0,0,40,40);
};

// -------------------------------------------------
// BRUIT – Single black speaker icon (no waves)
// -------------------------------------------------
window.PATTERN_BUILDERS.PATTERN_BRUIT_SPEAKER_ICON = function(g){
    g.clearRect(0,0,40,40);

    g.fillStyle = "black";

    // Speaker rectangle (body)
    g.fillRect(10, 14, 8, 12);  // x, y, width, height

    // Speaker cone (triangle)
    g.beginPath();
    g.moveTo(18, 14);
    g.lineTo(26, 10);
    g.lineTo(26, 30);
    g.lineTo(18, 26);
    g.closePath();
    g.fill();
};

/* -------------------------------------------------
   8) STRICTURE – Single vertical hourglass gradient
   ------------------------------------------------- */
  window.PATTERN_BUILDERS.PATTERN_STRICTURE_HOURGLASS_SINGLE = function(g){
    g.clearRect(0,0,40,40);

    // Gradient matching your desired purple→pink shading
    let grad = g.createLinearGradient(0,0,0,40);
    grad.addColorStop(0, "rgba(255,80,180,1)");
    grad.addColorStop(0.5, "rgba(130,0,120,1)");
    grad.addColorStop(1, "rgba(255,80,180,1)");

    g.fillStyle = grad;

    // ---------------------------------------------------
    // LEFT HALF OF HOURGLASS (from x=20 to x=0)
    // ---------------------------------------------------
    g.beginPath();
    g.moveTo(20,0);
    g.bezierCurveTo(10,0,  10,10,  20,20);
    g.bezierCurveTo(10,30, 10,40, 20,40);
    g.closePath();
    g.fill();

    // ---------------------------------------------------
    // RIGHT HALF OF HOURGLASS (mirror image)
    // ---------------------------------------------------
    g.beginPath();
    g.moveTo(20,0);
    g.bezierCurveTo(30,0,  30,10,  20,20);
    g.bezierCurveTo(30,30, 30,40,  20,40);
    g.closePath();
    g.fill();
};
 



// -------------------------------------------------
// FISTULA – Single green curly tube (pattern tile)
// -------------------------------------------------
window.PATTERN_BUILDERS.PATTERN_FISTULA_CURLY_TUBE = function(g){
    g.clearRect(0,0,40,40);

    // Strong green for visibility
    g.strokeStyle = "rgba(0,180,80,1)";
    g.lineWidth = 4;
    g.lineCap = "round";

    g.beginPath();
    g.moveTo(8,30);
    g.bezierCurveTo(5,20, 15,15, 10,10);
    g.bezierCurveTo(5,5, 20,5, 25,12);
    g.bezierCurveTo(30,18, 28,25, 20,30);
    g.stroke();
};

// -------------------------------------------------
// SCAR – Brown tree bark repeating texture
// -------------------------------------------------
window.PATTERN_BUILDERS.PATTERN_SCAR_BARK = function(g){
    g.clearRect(0,0,40,40);

    // Base brown
    g.fillStyle = "rgba(130,80,40,1)";
    g.fillRect(0,0,40,40);

    // Bark grain lines (random)
    for(let i=0;i<6;i++){
        let x = Math.random()*40;

        g.strokeStyle = (Math.random() > 0.5)
            ? "rgba(180,130,90,1)"    // light grain
            : "rgba(90,60,30,1)";     // dark streak

        g.lineWidth = Math.random()*2 + 1;

        g.beginPath();
        g.moveTo(x,0);
        g.bezierCurveTo(x+2,10, x-2,20, x+1,40);
        g.stroke();
    }
};


/* -------------------------------------------------
   9) VASCULAR ABNORMALITY – Red cobweb
   ------------------------------------------------- */
window.PATTERN_BUILDERS.PATTERN_VASC_COBWEB = function(g){
    g.clearRect(0,0,40,40);

    g.strokeStyle = "rgba(220,0,0,1)";
    g.lineWidth = 2;

    for(let i=0;i<4;i++){
        let cx = Math.random()*30+5, cy = Math.random()*30+5;
        g.beginPath();
        g.moveTo(cx,cy);
        for(let j=0;j<5;j++){
            let ang = Math.random()*Math.PI*2;
            let len = Math.random()*14+6;
            g.lineTo(cx + Math.cos(ang)*len, cy + Math.sin(ang)*len);
            g.moveTo(cx,cy);
        }
        g.stroke();
    }
};

/* -------------------------------------------------
   10) PALPABLE MASS – Restored original speck pattern
   ------------------------------------------------- */
window.PATTERN_BUILDERS.PATTERN_MASS_SOLID_FILL = function(g){
    // Reuse the original speck pattern visually
    g.clearRect(0,0,40,40);
    for(let i=0;i<12;i++){
        g.beginPath();
        g.fillStyle = "rgba(120,60,40,1)";
        g.arc(Math.random()*36+2, Math.random()*36+2, Math.random()*3+1, 0, Math.PI*2);
        g.fill();
    }
};



function ensureCanvasSize(w,h){ if(!canvas) return; canvas.width = w; canvas.height = h; }

function drawEverything(showHalo=true){
  if(!ctx) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(img && img.naturalWidth) ctx.drawImage(img,0,0,canvas.width,canvas.height);

  drawOrganLayer();
  drawShapesLayer();
  drawLabelsLayer();

  if(showHalo) drawSelectionHalo();
  drawCurrentPreview();
}

/* applyDiagnosisFill uses DIAGNOSIS_CONFIG */
function applyDiagnosisFill(diag, ctr, strokeColor, targetCtx = ctx){
  if(!targetCtx) return;
  const cfg = (typeof DIAGNOSIS_CONFIG !== "undefined" && DIAGNOSIS_CONFIG[diag])
    ? DIAGNOSIS_CONFIG[diag]
    : (typeof DIAGNOSIS_CONFIG !== "undefined" ? DIAGNOSIS_CONFIG["__DEFAULT__"] : null);

  const alpha = parseFloat(fillOpacitySlider?.value || 0.6);

  if(cfg){
    if(cfg.fillType === 'gradient'){
      const radius = Math.max(canvas.width, canvas.height) * 0.12;
      const g = targetCtx.createRadialGradient(ctr.x, ctr.y, 2, ctr.x, ctr.y, radius);
      // default stops (diagnoses.js may define different fills via DIAGNOSIS_CONFIG)
      g.addColorStop(0,"rgba(255,60,60,1.0)");
      g.addColorStop(0.5,"rgba(255,80,80,0.45)");
      g.addColorStop(1,"rgba(255,80,80,0)");
      targetCtx.fillStyle = g;
      targetCtx.fillRect(0,0,canvas.width,canvas.height);
      return;
    }
    if(cfg.fillType === 'pattern'){
      if(!window._APP_PATTERNS) window._APP_PATTERNS = {};
      const name = cfg.fillValue;
      if(!window._APP_PATTERNS[name]){
        const c = document.createElement("canvas");
        c.width = 40; c.height = 40;
        const g = c.getContext("2d");
        g.clearRect(0,0,40,40);
        // procedural patterns (kept minimal)
        if(name === "PATTERN_SPECK"){ g.fillStyle="#f8e8e8"; g.fillRect(0,0,40,40); for(let i=0;i<20;i++){ g.fillStyle=`rgba(90,40,40,${Math.random()*0.5+0.15})`; g.fillRect(Math.random()*36,Math.random()*36,Math.random()*5+1,Math.random()*5+1); } }
        else if(name === "PATTERN_NODULAR"){ for(let i=0;i<8;i++){ g.beginPath(); g.fillStyle="#9b7a4e"; g.arc(Math.random()*36+2, Math.random()*36+2, Math.random()*3+1,0,Math.PI*2); g.fill(); } }
        else if(name === "PATTERN_STONES"){ for(let i=0;i<20;i++){ g.beginPath(); g.fillStyle="rgba(190,140,50,1)"; g.ellipse(Math.random()*56+2,Math.random()*56+2,Math.random()*5+2,Math.random()*3+1,Math.random()*Math.PI,0,Math.PI*2);     g.fill(); } }
        else if (window.PATTERN_BUILDERS && window.PATTERN_BUILDERS[name]) {
        // Use custom pattern builder provided elsewhere (diagnoses.js, pattern file, etc.)
        window.PATTERN_BUILDERS[name](g);
      }
        else { g.fillStyle = cfg.fillValue || "rgba(255,230,200,0.35)"; g.fillRect(0,0,40,40); }
        window._APP_PATTERNS[name] = ctx.createPattern(c, "repeat");
      }
      targetCtx.globalAlpha = alpha;
      targetCtx.fillStyle = window._APP_PATTERNS[name];
      targetCtx.fillRect(0,0,canvas.width,canvas.height);
      targetCtx.globalAlpha = 1;
      return;
    }
    if(cfg.fillType === 'color' || cfg.fillType === 'default'){
      targetCtx.globalAlpha = alpha;
      targetCtx.fillStyle = cfg.fillValue || "rgba(255,220,60,0.45)";
      targetCtx.fillRect(0,0,canvas.width,canvas.height);
      targetCtx.globalAlpha = 1;
      return;
    }
  }

  // fallback
  targetCtx.globalAlpha = alpha;
  targetCtx.fillStyle = strokeColor || "rgba(255,220,60,0.45)";
  targetCtx.fillRect(0,0,canvas.width,canvas.height);
  targetCtx.globalAlpha = 1;
}

/* ---------------- ORGAN LAYER ---------------- */
function drawOrganLayer(){
  if(!ctx || !window.ORGANS) return;
  for(const name in ORGANS){
    const poly = ORGANS[name];
    if(!poly||!poly.length) continue;
    const path = new Path2D();
    path.moveTo(poly[0].x, poly[0].y);
    for(let i=1;i<poly.length;i++) path.lineTo(poly[i].x, poly[i].y);
    path.closePath();
    const diag = organDiagnoses[name];
    if(diag){
      ctx.save(); ctx.clip(path);
      applyDiagnosisFill(diag, centroid(poly), null, ctx);
      ctx.restore();
    }
    if(showOutlines){ ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(20,30,60,0.18)"; ctx.stroke(path); ctx.restore(); }
  }
}

/* ---------------- SHAPES LAYER ---------------- */
function drawShapesLayer(){
  if(!ctx) return;
  for(const s of shapes){
    if(!s) continue;
    if(s.type==="stroke") drawStrokeShape(s);
    else if(s.type==="smooth") drawSmoothStroke(s);
    else if(s.type==="line") drawLineShape(s);
    else if(s.type==="polygon") drawPolygonOrClosedShape(s);
    // preserve any other legacy types defensively (no-op)
  }
}

/* ----- Freehand Stroke ----- */
function drawStrokeShape(s){
  if(!ctx) return;
  const pts = s.points;
  if(!pts||pts.length<1) return;
  if(s.diagnosis) drawGlowLineAroundStroke(s);
  ctx.save(); ctx.lineJoin="round"; ctx.lineCap="round"; ctx.lineWidth=s.thickness; ctx.strokeStyle=s.color;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); ctx.restore();
}

/* ----- Smooth (Wavy) Stroke ----- */
function drawSmoothStroke(s){
  if(!ctx) return;
  const pts = s.smoothed || s.points; // prefer smoothed points if present
  if(!pts||pts.length<1) return;
  if(s.diagnosis) drawGlowLineAroundStroke(s);
  ctx.save(); ctx.lineJoin="round"; ctx.lineCap="round"; ctx.lineWidth=s.thickness; ctx.strokeStyle=s.color;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); ctx.restore();
}

/* ----- Line Shapes ----- */
function drawLineShape(s){
  if(!ctx) return;
  if(s.diagnosis) drawGlowForLine(s);
  ctx.save(); ctx.lineWidth = s.thickness; ctx.strokeStyle = s.color; ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke(); ctx.restore();
}

/* ----- Glow for line ----- */
function drawGlowForLine(s){
  if(!ctx) return;
  const glow = glowColorForDiag(s.diagnosis, s.color);
  ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 28; ctx.strokeStyle = glow; ctx.lineWidth = (s.thickness || 4) + 8;
  ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke(); ctx.restore();
}

/* ----- Glow for freehand ----- */
function drawGlowLineAroundStroke(s){
  if(!ctx) return;
  const pts = s.smoothed || s.points;
  if(!pts || pts.length < 2) return;
  const glow = glowColorForDiag(s.diagnosis, s.color);
  ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 26; ctx.strokeStyle = glow; ctx.lineWidth = (s.thickness||4)+8;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); ctx.restore();
}

/* ----- Polygon + Closed Shapes ----- */
function drawPolygonOrClosedShape(s){
  if(!ctx) return;
  const pts = s.points; if(!pts||pts.length<3) return;
  const path = new Path2D(); path.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++) path.lineTo(pts[i].x,pts[i].y); path.closePath();
  if(s.diagnosis && s.filled){ ctx.save(); ctx.clip(path); applyDiagnosisFill(s.diagnosis, centroid(pts), s.color, ctx); ctx.restore(); }
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,0,0,0.65)"; ctx.stroke(path); ctx.restore();
}

/* glow helpers */
function glowColorForDiag(diag, strokeColor){
  if(typeof DIAGNOSIS_CONFIG!=="undefined" && DIAGNOSIS_CONFIG[diag] && DIAGNOSIS_CONFIG[diag].glowColor) return DIAGNOSIS_CONFIG[diag].glowColor;
  if(typeof DIAGNOSIS_CONFIG!=="undefined" && DIAGNOSIS_CONFIG["__DEFAULT__"] && DIAGNOSIS_CONFIG["__DEFAULT__"].glowColor) return DIAGNOSIS_CONFIG["__DEFAULT__"].glowColor;
  return strokeColor || "rgba(255,220,60,0.9)";
}


/* ---------------- SELECTION HALO ---------------- */
function drawSelectionHalo(){
  if(!ctx) return;

  // ---- Shape halos ----
  for(const id of selectedShapeIds){
    const s = shapes.find(x=>x.id===id); 
    if(!s) continue;

    ctx.save();
    ctx.shadowColor="rgba(30,130,255,0.45)";
    ctx.shadowBlur=22;
    ctx.strokeStyle="rgba(30,130,255,0.9)";
    ctx.lineWidth=(s.thickness||4)+6;

    ctx.beginPath();
    if(s.type==="stroke" || s.type==="smooth"){
      const pts = s.smoothed || s.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i=1;i<pts.length;i++){
        ctx.lineTo(pts[i].x, pts[i].y);
      }
    }
    else if(s.type==="line"){
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    else if(s.type==="polygon"){
      const pts = s.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i=1;i<pts.length;i++){
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
    }

    ctx.stroke();
    ctx.restore();
  }

  // ---- Organ halos ----
  for(const name of selectedOrgNames){
    const poly = ORGANS[name];
    if(!poly) continue;

    ctx.save();
    ctx.fillStyle="rgba(180,220,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for(let i=1;i<poly.length;i++){
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}


 /* ---------------- LABELS ---------------- */
function drawLabelsLayer(){
  if(!ctx) return;

  ctx.save();
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = parseFloat(diagnosisOpacitySlider ? diagnosisOpacitySlider.value : 0.9);

  /* ----------- SMART LABEL HELPERS ----------- */
  function polygonArea(poly) {
    let area = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      area += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
    }
    return Math.abs(area / 2);
  }

  function isInsidePoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect =
        ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /* ----------- ORGAN LABELS (SMART + ALWAYS SHOW DIAGNOSIS) ----------- */
  for (const name in ORGANS) {
    const poly = ORGANS[name];
    if (!poly) continue;

    const diag = organDiagnoses[name] || null;

    // show label if: organ selected OR diagnosis exists
    if (!selectedOrgNames.has(name) && !diag) continue;

    const c = centroid(poly);
    const area = polygonArea(poly);
    const isSmall = area < 2500;

    const candidates = [];
    if (isSmall) {
      candidates.push({ x: c.x, y: c.y - 40 });
      candidates.push({ x: c.x + 60, y: c.y });
      candidates.push({ x: c.x - 60, y: c.y });
      candidates.push({ x: c.x, y: c.y + 40 });
    } else {
      candidates.push({ x: c.x, y: c.y });
    }

    let chosen = candidates[0];
    for (const cand of candidates) {
      if (!isInsidePoly(cand.x, cand.y, poly)) {
        chosen = cand;
        break;
      }
    }

    // ORGAN NAME
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(chosen.x - 60, chosen.y - 10, 120, 20);
    ctx.fillStyle = "#000";
    ctx.fillText(name, chosen.x, chosen.y);

    // DIAGNOSIS BELOW
    if (diag) {
      const dy = chosen.y + 22;
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(chosen.x - 60, dy - 10, 120, 20);
      ctx.fillStyle = "#000";
      ctx.fillText(diag, chosen.x, dy);
    }
  }

  /* ----------- SHAPE LABELS (UNCHANGED) ----------- */
  for (const s of shapes) {
    if (!s || !s.diagnosis) continue;

    let c;
    if (s.type === "line") {
      c = { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
    } else {
      c = centroid(s.points || (s.smoothed || []));
    }

    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(c.x - 45, c.y - 20, 90, 26);
    ctx.fillStyle = "#000";
    ctx.fillText(s.diagnosis, c.x, c.y - 4);
  }

  ctx.restore();
}



/* ---------------- 5) HIT TESTS & SELECTION ---------------- */
function findShapeAtPoint(pt){
  for(let i=shapes.length-1;i>=0;i--){
    const s = shapes[i];
    if(!s) continue;
    // strokes and smooth both tested the same way
    if(s.type === "stroke" || s.type === "smooth"){
      const pts = s.smoothed || s.points;
      for(let j=0;j<pts.length-1;j++){
        if(distToSegment(pt.x,pt.y,pts[j].x,pts[j].y,pts[j+1].x,pts[j+1].y) <= Math.max(8, s.thickness+4)) return s;
      }
    } else if(s.type === "line"){
      if(distToSegment(pt.x,pt.y,s.x1,s.y1,s.x2,s.y2) <= Math.max(8, s.thickness+4)) return s;
    } else if(s.type === "polygon"){
      if(pointInPoly(pt, s.points)) return s;
    }
  }
  return null;
}

function findOrganAtPoint(pt){
  if(!window.ORGANS) return null;
  for(const name in ORGANS) if(pointInPoly(pt, ORGANS[name])) return name;
  return null;
}

/* canvas click selection */
if(canvas) canvas.addEventListener("click", (evt)=>{
  const pt = getCanvasPoint(evt);

  if(mode === "draw"){
    const hitShape = findShapeAtPoint(pt);
    if(hitShape){
      // toggle selection of clicked shape
      if(selectedShapeIds.has(hitShape.id)){
        selectedShapeIds.delete(hitShape.id);
        if(activeShapeId === hitShape.id) activeShapeId = null;
      } else {
        selectedShapeIds.add(hitShape.id);
        activeShapeId = hitShape.id;
      }
      // clear organ selection
      selectedOrgNames.clear(); activeOrg = null;
      updateUI(); drawEverything(); return;
    }
    // empty -> clear shape selection
    selectedShapeIds.clear(); activeShapeId = null; updateUI(); drawEverything(); return;
  }

 if (mode === "organ") {
    const hitOrgan = findOrganAtPoint(pt);

    if (hitOrgan) {
        // MULTI-SELECT BEHAVIOR RESTORED
        if (selectedOrgNames.has(hitOrgan)) {
            selectedOrgNames.delete(hitOrgan);
        } else {
            selectedOrgNames.add(hitOrgan);
        }

        // activeOrg = last selected organ (so diagnosis box knows what to target)
        activeOrg = [...selectedOrgNames].at(-1) || null;

        // clear shape selection
        selectedShapeIds.clear();
        activeShapeId = null;

        updateUI();
        drawEverything();
        return;
    }

    // empty click → clear all
    selectedOrgNames.clear();
    activeOrg = null;
    selectedShapeIds.clear();
    activeShapeId = null;
    updateUI();
    drawEverything();
  }
});


/* ---------------- 6) DRAWING TOOLS ---------------- */
/* Smooth smoothing helper */
function smoothPath(points) {
  const smoothed = [];
  const size = Math.min(5, points.length);
  for (let i = 0; i < points.length; i++) {
    let x = 0, y = 0, count = 0;
    for (let j = Math.max(0, i - size); j <= i; j++) {
      x += points[j].x; y += points[j].y; count++;
    }
    smoothed.push({ x: x / count, y: y / count });
  }
  return smoothed;
}

/* finalize freehand -> important: keep types consistent */
function finalizeFreehandStrokeAsShape(strokeObj) {
  const pts = strokeObj.points.slice();

  // decide whether to close freehand into polygon (only for pen and only if endpoints near)
  let shouldClose = false;
  if(strokeObj.type === "stroke"){
    // check end-to-start proximity
    const first = pts[0]; const last = pts[pts.length-1];
    if(first && last && Math.hypot(first.x-last.x, first.y-last.y) < 12 && pts.length > 6) shouldClose = true;
  }

  if(shouldClose){
    // convert to polygon (closed) — keep diagnosis logic (poly gets fill when diagnosis applied)
    const shape = {
      id: uid(),
      type: "polygon",
      points: pts,
      color: strokeObj.color,
      thickness: strokeObj.thickness,
      diagnosis: null,
      filled: false
    };
    if(fillModeAuto){
      if(diagnosisSelect && diagnosisSelect.value){
        shape.diagnosis = diagnosisSelect.value === "Other" ? (diagnosisOther?diagnosisOther.value.trim()||"Other":"Other") : diagnosisSelect.value;
        shape.filled = !!shape.diagnosis;
      }
    } else { shape.diagnosis = "Other"; shape.filled = true; }

    shapes.push(shape);
    undoStack.push({ type:"add", item: JSON.parse(JSON.stringify(shape)) });
    redoStack = [];
    logStatus("Closed freehand -> polygon created");
    return;
  }

  // else keep as open stroke (type preserved: stroke or smooth)
  const shape = {
    id: uid(),
    type: strokeObj.type === "smooth" ? "smooth" : "stroke",
    points: pts,
    color: strokeObj.color,
    thickness: strokeObj.thickness,
    diagnosis: null,
    filled: false
  };

  if(fillModeAuto){
    // for open strokes, we keep diagnosis as null by default; diagnosis UI can set it later (glow only)
    if(diagnosisSelect && diagnosisSelect.value){
      // do not auto-fill open strokes — keep as null unless you want default behavior
      // This preserves original behavior: open strokes generally have glow, not fill.
      // If you do want auto assignment uncomment following:
      // shape.diagnosis = (diagnosisSelect.value === "Other" ? (diagnosisOther?diagnosisOther.value.trim()||"Other":"Other") : diagnosisSelect.value);
      // shape.filled = !!shape.diagnosis;
    }
  } else {
    // manual fill mode: if you want open strokes to be assigned "Other" by default, leave this commented or set per earlier behavior
    // shape.diagnosis = "Other"; shape.filled = true;
  }

  shapes.push(shape);
  undoStack.push({ type:"add", item: JSON.parse(JSON.stringify(shape)) });
  redoStack = [];
  logStatus("Freehand stroke created");
}

/* Polygon finisher (double-click or right-click) */
function finishPolygonImmediate() {
  if(!polygonPoints || polygonPoints.length < 2){ polygonPoints=[]; drawEverything(); logStatus("Polygon cancelled"); return; }

  if(polygonPoints.length === 2){
    const lineObj = { id: uid(), type: "line", x1: polygonPoints[0].x, y1: polygonPoints[0].y, x2: polygonPoints[1].x, y2: polygonPoints[1].y, color: drawColour?drawColour.value:"#ff0000", thickness: parseInt(drawThickness?drawThickness.value:3), diagnosis: null };
    shapes.push(lineObj); undoStack.push({ type:"add", item: JSON.parse(JSON.stringify(lineObj)) }); redoStack = []; polygonPoints=[]; drawEverything(); logStatus("Line created"); drawModeSelect.value = "pen"; return;
  }

  const pts = polygonPoints.slice();
  const poly = { id: uid(), type: "polygon", points: pts, color: drawColour?drawColour.value:"#ff0000", thickness: parseInt(drawThickness?drawThickness.value:3), diagnosis: null, filled: false };
  if(fillModeAuto){
    if(diagnosisSelect && diagnosisSelect.value){ poly.diagnosis = diagnosisSelect.value === "Other" ? (diagnosisOther?diagnosisOther.value.trim()||"Other":"Other") : diagnosisSelect.value; poly.filled = !!poly.diagnosis; }
  } else { poly.diagnosis = "Other"; poly.filled = true; }
  shapes.push(poly); undoStack.push({ type:"add", item: JSON.parse(JSON.stringify(poly)) }); redoStack=[]; polygonPoints=[]; drawEverything(); logStatus("Polygon created");
  // auto-disable polygon tool
  drawModeSelect.value = "pen";
}

/* ---------- MOUSE EVENTS (drawing, previewing) ---------- */
if(canvas){
  canvas.addEventListener("mousedown", (evt)=>{
    if(mode !== "draw") return;
    const p = getCanvasPoint(evt);
    const tool = drawModeSelect ? drawModeSelect.value : "pen";

    if(tool === "polygon"){
      if(polygonPoints.length > 2){
        const first = polygonPoints[0];
        if(Math.hypot(p.x-first.x, p.y-first.y) < 15){ finishPolygonImmediate(); return; }
      }
      polygonPoints.push(p); drawEverything(false); logStatus(`Polygon: ${polygonPoints.length} points (dbl-click/right-click to finish)`); return;
    }

    if(tool === "line"){
      currentLine = { id: uid(), type: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: drawColour?drawColour.value:"#ff0000", thickness: parseInt(drawThickness?drawThickness.value:3), diagnosis: null };
      drawEverything(false); return;
    }

    if(tool === "pen" || tool === "smooth"){
      drawing = true;
      currentStroke = { id: uid(), type: tool === "smooth" ? "smooth" : "stroke", points: [p], thickness: parseInt(drawThickness?drawThickness.value:4), color: drawColour?drawColour.value:"#000", diagnosis:null, filled:false };
      drawEverything(false); return;
    }
  });

  canvas.addEventListener("mousemove", (evt)=>{
    if(mode !== "draw") return;
    const p = getCanvasPoint(evt);
    const tool = drawModeSelect ? drawModeSelect.value : "pen";

    if(tool === "line" && currentLine){ currentLine.x2 = p.x; currentLine.y2 = p.y; drawEverything(false); return; }

    if(drawing && currentStroke){
      const last = currentStroke.points[currentStroke.points.length-1];
      if(!last || last.x !== p.x || last.y !== p.y) currentStroke.points.push(p);

      if(currentStroke.type === "smooth"){
        currentStroke.smoothed = smoothPath(currentStroke.points);
      }

      drawEverything(false);
      return;
    }
  });

  canvas.addEventListener("mouseup", (evt)=>{
    if(mode !== "draw") return;
    const tool = drawModeSelect ? drawModeSelect.value : "pen";

    if(tool === "line" && currentLine){ shapes.push(currentLine); undoStack.push({ type:"add", item: JSON.parse(JSON.stringify(currentLine)) }); redoStack=[]; currentLine=null; drawEverything(); return; }

    if(drawing && currentStroke){
      if(currentStroke.points.length < 2){ drawing=false; currentStroke=null; drawEverything(); return; }

      // use smoothed result if smooth
      if(currentStroke.type === "smooth"){
        currentStroke.smoothed = currentStroke.smoothed || smoothPath(currentStroke.points);
      }

      // finalize (might auto-close for pen)
      finalizeFreehandStrokeAsShape(currentStroke);

      drawing = false;
      currentStroke = null;
      drawEverything();
      return;
    }
  });

  canvas.addEventListener("dblclick", (evt)=>{ if(mode !== "draw") return; if(drawModeSelect && drawModeSelect.value === "polygon") finishPolygonImmediate(); });
  canvas.addEventListener("contextmenu", (evt)=>{ if(mode !== "draw") return; if(drawModeSelect && drawModeSelect.value === "polygon"){ evt.preventDefault(); finishPolygonImmediate(); } });
}

/* preview overlay */
function drawCurrentPreview(){
  if(!ctx) return;
  ctx.save();
  // polygon preview
  if(polygonPoints && polygonPoints.length){
    ctx.beginPath(); ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y); for(let i=1;i<polygonPoints.length;i++) ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
    ctx.strokeStyle="rgba(0,0,0,0.2)"; ctx.lineWidth=2; ctx.stroke();
    for(const p of polygonPoints){ ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fillStyle="#000"; ctx.fill(); }
  }
  // preview line
  if(currentLine){ ctx.beginPath(); ctx.moveTo(currentLine.x1,currentLine.y1); ctx.lineTo(currentLine.x2,currentLine.y2); ctx.strokeStyle=currentLine.color; ctx.lineWidth=currentLine.thickness; ctx.stroke(); }
  // preview freehand
  if(currentStroke){
    const pts = currentStroke.type === "smooth" ? (currentStroke.smoothed || currentStroke.points) : currentStroke.points;
    if(pts && pts.length){ ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.strokeStyle=currentStroke.color; ctx.lineWidth=currentStroke.thickness; ctx.stroke(); }
  }
  ctx.restore();
}

/* ---------------- 7) UNDO / REDO ---------------- */
/* Undo only for drawing operations (add/edit). CLEAR is independent. */
function pushUndoAdd(item){
  undoStack.push({ type: "add", item: JSON.parse(JSON.stringify(item)) });
  redoStack = [];
  updateUI(); // <--- ADD THIS LINE
}
/* ---------------- UPDATED: doUndo() ---------------- */
function doUndo(){
  if(!undoStack.length) return;
  const op = undoStack.pop();
  
  if(op.type === "add"){
    // remove added shape
    shapes = shapes.filter(s => s.id !== op.item.id);
    redoStack.push(op);
    logStatus("Undo: Removed shape");
    updateUI(); 
    drawEverything();
  } 
  else if(op.type === "deleteShape"){
    // restore deleted shape
    shapes.push(op.item); 
    redoStack.push(op); 
    logStatus("Undo: Restored shape");
    updateUI(); 
    drawEverything();
  }
  else if(op.type === "diagnosisChange"){
    // 🔥 NEW: Restore previous diagnosis state
    
    // Restore shape diagnoses
    op.before.shapes.forEach(shapeState => {
      const shape = shapes.find(s => s.id === shapeState.id);
      if (shape) {
        shape.diagnosis = shapeState.diagnosis;
        shape.filled = shapeState.filled;
      }
    });
    
    // Restore organ diagnoses
    op.before.organs.forEach(organState => {
      if (organState.diagnosis === null) {
        delete organDiagnoses[organState.name];
      } else {
        organDiagnoses[organState.name] = organState.diagnosis;
      }
    });
    
    redoStack.push(op);
    logStatus("Undo: Diagnosis change reverted");
    updateUI();
    drawEverything();
  }
}
/* ---------------- UPDATED: doRedo() ---------------- */
function doRedo(){
  if(!redoStack.length) return;
  const op = redoStack.pop();
  
  if(op.type === "add"){
    // re-add shape
    shapes.push(op.item); 
    undoStack.push(op); 
    logStatus("Redo: Added shape");
    updateUI(); 
    drawEverything();
  } 
  else if(op.type === "deleteShape"){
    // re-delete shape
    shapes = shapes.filter(s => s.id !== op.item.id); 
    undoStack.push(op); 
    logStatus("Redo: Deleted shape");
    updateUI(); 
    drawEverything();
  }
  else if(op.type === "diagnosisChange"){
    // 🔥 NEW: Re-apply diagnosis changes
    
    // Re-apply shape diagnoses
    op.after.shapes.forEach(shapeState => {
      const shape = shapes.find(s => s.id === shapeState.id);
      if (shape) {
        shape.diagnosis = shapeState.diagnosis;
        shape.filled = shapeState.filled;
      }
    });
    
    // Re-apply organ diagnoses
    op.after.organs.forEach(organState => {
      if (organState.diagnosis === null) {
        delete organDiagnoses[organState.name];
      } else {
        organDiagnoses[organState.name] = organState.diagnosis;
      }
    });
    
    undoStack.push(op);
    logStatus("Redo: Diagnosis change reapplied");
    updateUI();
    drawEverything();
  }
}


/* -----------------------------------------------------------
   8) DIAGNOSIS ASSIGN / AUTO-ASSIGN  (CLEANED + FIXED)
   ----------------------------------------------------------- */

function assignDiagnosisToTarget(diagnosisText) {
    if (!diagnosisText) return;

    /* ---------- 1) Capture BEFORE state for undo ---------- */
    const beforeState = {
        shapes: shapes
            .filter(s => selectedShapeIds.has(s.id))
            .map(s => ({
                id: s.id,
                diagnosis: s.diagnosis,
                filled: s.filled
            })),

        organs: Array.from(selectedOrgNames).map(org => ({
            name: org,
            diagnosis: organDiagnoses[org] || null
        }))
    };

    /* ---------- 2) Apply to selected SHAPES ---------- */
    if (selectedShapeIds.size > 0) {
        shapes.forEach(s => {
            if (selectedShapeIds.has(s.id)) {
                s.diagnosis = diagnosisText;

                // polygons get fill, open strokes only glow
                s.filled = (s.type === "polygon") && !!diagnosisText;
            }
        });
    }

    /* ---------- 3) Apply to selected ORGANS ---------- */
    if (selectedOrgNames.size > 0) {
        selectedOrgNames.forEach(org => {
            organDiagnoses[org] = diagnosisText;
        });
    }

    /* ---------- 4) Capture AFTER state for redo ---------- */
    const afterState = {
        shapes: shapes
            .filter(s => selectedShapeIds.has(s.id))
            .map(s => ({
                id: s.id,
                diagnosis: s.diagnosis,
                filled: s.filled
            })),

        organs: Array.from(selectedOrgNames).map(org => ({
            name: org,
            diagnosis: organDiagnoses[org]
        }))
    };

    /* ---------- 5) Push unified diagnosisChange → UNDO ---------- */
    if (beforeState.shapes.length > 0 || beforeState.organs.length > 0) {
        undoStack.push({
            type: "diagnosisChange",
            before: beforeState,
            after: afterState
        });
        redoStack = [];
        logStatus(
            `Diagnosis "${diagnosisText}" assigned to `
            + `${beforeState.shapes.length} shape(s) and `
            + `${beforeState.organs.length} organ(s)`
        );
    }

    /* ---------- 6) Clear selection state ---------- */
    selectedOrgNames.clear();
    selectedShapeIds.clear();
    activeOrg = null;
    activeShapeId = null;

    /* ---------- 7) Reset UI ---------- */
    if (diagnosisSelect) diagnosisSelect.value = "";
    if (diagnosisOther) diagnosisOther.value = "";
    if (otherBoxWrapper) otherBoxWrapper.style.display = "none";

    updateUI();
    drawEverything();
}


/* ---------------- 9) SINGLE CLEAR BUTTON (INDEPENDENT CLEAR) ---------------- */
/* Clear only removes selected items: shapes OR clear organ diagnosis.
   Undo now supported; reset not affected */

if (clearSelectionBtn) {
  clearSelectionBtn.addEventListener("click", () => {

    // 1) Clear selected shapes => DELETE them
    if (selectedShapeIds.size > 0) {
      const deletedShapes = shapes.filter(s => selectedShapeIds.has(s.id));

      deletedShapes.forEach(shape => {
        undoStack.push({
          type: "deleteShape",
          item: JSON.parse(JSON.stringify(shape))
        });
      });

      shapes = shapes.filter(s => !selectedShapeIds.has(s.id));
      selectedShapeIds.clear();
      activeShapeId = null;
      redoStack = [];
      
      logStatus(`Deleted ${deletedShapes.length} shape(s)`);
      updateUI();
      drawEverything();
      return;
    }

    // 2) Clear organ diagnosis (single organ selected)
    if (selectedOrgNames.size === 1) {
      const org = [...selectedOrgNames][0];
      const previousDiagnosis = organDiagnoses[org] || null;

      if (previousDiagnosis) {
        undoStack.push({
          type: "diagnosisChange",
          before: {
            shapes: [],
            organs: [{ name: org, diagnosis: previousDiagnosis }]
          },
          after: {
            shapes: [],
            organs: [{ name: org, diagnosis: null }]
          }
        });
        redoStack = [];
      }

      delete organDiagnoses[org];
      selectedOrgNames.clear();
      activeOrg = null;

      logStatus(`Cleared diagnosis for ${org}`);
      updateUI();
      drawEverything();
      return;
    }

    // Nothing selected → do nothing
  });
}


/* ---------------- 10) RESET / SAVE / MISC ---------------- */
if(resetAllBtn) resetAllBtn.addEventListener("click", ()=>{
  shapes = [];
  polygonPoints = [];
  selectedShapeIds.clear();
  selectedOrgNames.clear();
  activeShapeId = null; activeOrg = null;
  // keep undo/redo independent by design; do NOT push reset into undo
  undoStack = []; redoStack = [];
  organDiagnoses = {}; // if you want to preserve organDiagnoses on reset, change this
  drawEverything();
  logStatus("Reset All performed");
});

if(savePNGBtn) savePNGBtn.addEventListener("click", ()=>{
  if(!canvas) return;
  const link = document.createElement("a");
  link.download = "diagnosis.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

/* Undo/Redo UI bindings */
if(undoBtn) undoBtn.addEventListener("click", ()=> { doUndo(); });
if(redoBtn) redoBtn.addEventListener("click", ()=> { doRedo(); });


/* ---------- RESTORE DIAGNOSIS UI EVENT HANDLERS ---------- */

if (diagnosisSelect) {
    diagnosisSelect.addEventListener("change", () => {
        const val = diagnosisSelect.value;

        if (!val) return;

        // If user selects "Other" → reveal text box but do NOT assign yet
        if (val === "Other") {
            if (otherBoxWrapper) otherBoxWrapper.style.display = "block";
            return;
        }

        // Normal diagnosis assignment
        assignDiagnosisToTarget(val);
    });
}

if (diagnosisOther) {

    // Commit typed "Other" text on Enter
    diagnosisOther.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const t = diagnosisOther.value.trim();
            if (t) assignDiagnosisToTarget(t);
        }
    });

    // Also commit when leaving the text field
    diagnosisOther.addEventListener("blur", () => {
        const t = diagnosisOther.value.trim();
        if (t) assignDiagnosisToTarget(t);
    });
}



/* ---------------- 11) UI UPDATES ---------------- */
function updateUI() {

  /* ---------------- 1) Populate diagnosis dropdown (once) ---------------- */
  if (diagnosisSelect && diagnosisSelect.options.length <= 1) {
    diagnosisSelect.innerHTML = '<option value="">-- choose diagnosis --</option>';

    if (typeof DIAGNOSIS_LIST !== "undefined") {
      DIAGNOSIS_LIST.forEach(dx => {
        const opt = document.createElement("option");
        opt.value = dx;
        opt.textContent = dx;
        diagnosisSelect.add(opt);
      });
    }

    // Always include "Other" at bottom
    const optO = document.createElement("option");
    optO.value = "Other";
    optO.textContent = "Other";
    diagnosisSelect.add(optO);
  }


  /* ---------------- 2) Determine active organ (selection) ---------------- */
  if (selectedOrgNames.size === 1) {
    activeOrg = [...selectedOrgNames][0];
  } else if (selectedOrgNames.size === 0) {
    // keep activeOrg only if shape is active; else null
    if (!activeShapeId) activeOrg = null;
  }


  /* ---------------- 3) Show diagnosis panel based on selection ---------------- */
  if (activeShapeId) {

    organName.textContent = `Shape: ${activeShapeId}`;
    diagnosisPanel.style.display = "block";

    // Load existing shape diagnosis
    const s = shapes.find(x => x.id === activeShapeId);
    if (s && s.diagnosis) {
      if (diagnosisSelect) diagnosisSelect.value = s.diagnosis;
      if (s.diagnosis === "Other") {
        otherBoxWrapper.style.display = "block";
        if (diagnosisOther) diagnosisOther.value = s.diagnosis;
      } else {
        otherBoxWrapper.style.display = "none";
        if (diagnosisOther) diagnosisOther.value = "";
      }
    } else {
      if (diagnosisSelect) diagnosisSelect.value = "";
      otherBoxWrapper.style.display = "none";
      if (diagnosisOther) diagnosisOther.value = "";
    }

  } else if (activeOrg) {

    organName.textContent = `Organ: ${activeOrg}`;
    diagnosisPanel.style.display = "block";

    // Load organ diagnosis from organDiagnoses
    const diag = organDiagnoses[activeOrg] || "";

    if (diag) {
      // Normal diagnosis
      if (diagnosisSelect) diagnosisSelect.value = DIAGNOSIS_LIST.includes(diag) ? diag : "Other";

      if (diagnosisSelect.value === "Other") {
        otherBoxWrapper.style.display = "block";
        if (diagnosisOther) diagnosisOther.value = diag;
      } else {
        otherBoxWrapper.style.display = "none";
        if (diagnosisOther) diagnosisOther.value = "";
      }
    } else {
      // No diagnosis yet
      if (diagnosisSelect) diagnosisSelect.value = "";
      otherBoxWrapper.style.display = "none";
      if (diagnosisOther) diagnosisOther.value = "";
    }

  } else {

    // Nothing selected
    organName.textContent = "None";
    diagnosisPanel.style.display = "none";
    if (diagnosisSelect) diagnosisSelect.value = "";
    otherBoxWrapper.style.display = "none";
    if (diagnosisOther) diagnosisOther.value = "";
  }


  /* ---------------- 4) Control CLEAR button enable/disable ---------------- */
  if (clearSelectionBtn) {
    clearSelectionBtn.disabled = !(
      selectedShapeIds.size > 0 ||
      selectedOrgNames.size === 1
    );
  }

/* ---------------- 5) Control UNDO/REDO button enable/disable ---------------- */
  if (undoBtn) {
    undoBtn.disabled = undoStack.length === 0;
  }
  if (redoBtn) {
    redoBtn.disabled = redoStack.length === 0;
  }
} // End of updateUI


/* ---------------- 12) INIT (canonical) ---------------- */

function loadSelectedImage() {
  if (!imageSelect) return;

  const path =
    imageSelect.value ||
    (imageSelect.options?.length ? imageSelect.options[0].value : null);

  if (!path) {
    logStatus("No image selected");
    img = new Image();
    drawEverything();
    return;
  }

  img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    ensureCanvasSize(img.width, img.height);
    drawEverything();
    logStatus("Image loaded: " + path);
  };

  img.onerror = () => {
    logStatus("Image failed to load: " + path);
    drawEverything();
  };

  img.src = path;
}

function init() {

  /* Canvas resizing */
  function resize() {
    const r = canvasHolder.getBoundingClientRect();
    ensureCanvasSize(
      Math.max(800, Math.round(r.width)),
      Math.max(600, Math.round(r.height))
    );
    drawEverything();
  }
 
  /* Populate image dropdown */
  if (imageSelect) {
    imageSelect.innerHTML = "";

    const imageFiles = [
      "static/image 1.png",
      "static/image 2.png",
      "static/image 3.png",
      "static/image 4.png"
    ];

    imageFiles.forEach(path => {
      const opt = document.createElement("option");
      opt.value = path;
      opt.textContent = path.replace("static/", "");
      imageSelect.add(opt);
    });

    imageSelect.addEventListener("change", loadSelectedImage);
  }

  /* Load the first image */
  loadSelectedImage();

  updateUI();
  drawEverything();

  logStatus("App initialized");
}

/* Run init immediately */
init();

