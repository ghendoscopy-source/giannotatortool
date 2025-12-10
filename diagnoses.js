// diagnoses.js — Clean final version

const DIAGNOSIS_LIST = [
  "Ascites",
  "Barrett’s mucosa",
  "Bleeding",
  "Bruit",
  "Diverticulosis",
  "Fistula",
  "Hepatomegaly",
  "Hemorrhoids",
  "Hernia",
  "Inflammation",
  "Nodular",             // updated from Nodularity
  "Palpable mass",
  "Polyp",
  "Scar",
  "Splenomegaly",
  "Stones",
  "Stricture",
  "Tenderness",
  "Ulcer",
  "Varices",
  "Vascular abnormality",
];

const DIAGNOSIS_CONFIG = {

    /* ============================
       GRADIENT-BASED (no changes)
       ============================ */

    "Inflammation": {
        fillType: "gradient",
        fillValue: "red_glow_gradient_inflammation",
        glowColor: "rgba(255,80,60,0.9)"
    },

    "Tenderness": {
        fillType: "gradient",
        fillValue: "red_glow_gradient_tenderness",
        glowColor: "rgba(255,70,120,0.9)"
    },

    /* ============================
       EXISTING OLD PATTERNS
       ============================ */

    "Nodular": {
        fillType: "pattern",
        fillValue: "PATTERN_NODULAR",
        glowColor: "rgba(150,100,80,0.9)"
    },

    "Stones": {
        fillType: "pattern",
        fillValue: "PATTERN_STONES",
        glowColor: "rgba(255,212,64,0.95)"
    },

    "Palpable mass": {
        fillType: "pattern",
        fillValue: "PATTERN_MASS_SOLID_FILL",
        glowColor: "rgba(200,120,100,0.9)"
    },

    /* ============================
       NEW PATTERNS
       ============================ */

    "Polyp": {
        fillType: "pattern",
        fillValue: "PATTERN_POLYP_STRAWBERRY",
        glowColor: "rgba(180,100,180,0.9)"
    },

    "Diverticulosis": {
        fillType: "pattern",
        fillValue: "PATTERN_DIVERTICULA_ELLIPSE",
        glowColor: "rgba(230,160,80,0.9)"
    },

    "Varices": {
        fillType: "pattern",
        fillValue: "PATTERN_BLUE_VENOUS_VERTICAL",
        glowColor: "rgba(80,140,255,0.9)"
    },

    "Hemorrhoids": {
        fillType: "pattern",
        fillValue: "PATTERN_BLUE_VENOUS_VERTICAL",
        glowColor: "rgba(80,140,255,0.9)"
    },

    "Bleeding": {
        fillType: "pattern",
        fillValue: "PATTERN_BLEEDING_FOUNTAIN_RED",
        glowColor: "rgba(255,60,60,0.9)"
    },

    "Vascular abnormality": {
        fillType: "pattern",
        fillValue: "PATTERN_VASC_COBWEB",
        glowColor: "rgba(255,120,120,0.9)"
    },

    "Barrett’s mucosa": {
        fillType: "pattern",
        fillValue: "PATTERN_BARRETTS_SMOOTH",
        glowColor: "rgba(255,170,160,0.9)"
    },

    "Stricture": {
        fillType: "pattern",
        fillValue: "PATTERN_STRICTURE_HOURGLASS_SINGLE",
        glowColor: "rgba(255,130,100,0.9)"
    },

    "Ulcer": {
        fillType: "pattern",
        fillValue: "PATTERN_ULCER_YELLOW_BASE",
        glowColor: "rgba(255,140,80,0.9)"
    },

    "Bruit": {
        fillType: "pattern",
        fillValue: "PATTERN_BRUIT_SPEAKER_ICON", 
        glowColor: "rgba(255,200,80,0.9)"
    },

   "Fistula": {
    fillType: "pattern",
    fillValue: "PATTERN_FISTULA_CURLY_TUBE",
    glowColor: "rgba(255,180,100,0.9)"
    },

    "Scar": {
    fillType: "pattern",
    fillValue: "PATTERN_SCAR_BARK",
    glowColor: "rgba(150,100,60,0.9)"
    },


    /* ============================
       COLOR-BASED SIMPLE STATES
       ============================ */

    "Ascites": {
        fillType: "color",
        fillValue: "rgba(140,180,220,0.55)",
        glowColor: "rgba(140,180,220,0.9)"
    },

    "Hernia": {
        fillType: "color",
        fillValue: "rgba(222,184,135,0.6)",
        glowColor: "rgba(222,184,135,0.9)"
    },

    /* ============================
       DEFAULT CLINICAL FINDINGS
       ============================ */

    "Hepatomegaly": { fillType: "default", glowColor: "rgba(255,210,80,0.9)" },
    "Splenomegaly": { fillType: "default", glowColor: "rgba(255,210,80,0.9)" },

    /* ============================
       FREE TEXT — MUST NOT CHANGE
       ============================ */

    "Other": {
        fillType: "default",
        glowColor: "rgba(255,170,0,0.9)"
    },

    /* ============================
       SAFER NEUTRAL DEFAULT
       ============================ */

    "__DEFAULT__": {
        fillType: "color",
        fillValue: "rgba(160,160,160,0.25)",
        glowColor: "rgba(160,160,160,0.5)"
    }
};
