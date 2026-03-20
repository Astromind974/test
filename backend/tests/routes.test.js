/**
 * tests/routes.test.js
 * ---------------------
 * Tests d'intégration pour les routes Express.
 *
 * Le service IA Python est remplacé par un mock axios
 * afin que les tests ne nécessitent pas que le service soit démarré.
 */

const request = require("supertest");
const app = require("../src/index");

// Mock du module axios pour simuler le service IA
jest.mock("axios");
const axios = require("axios");

// Réponse simulée du service IA pour une image valide
const MOCK_AI_RESPONSE = {
  data: {
    filename: "test.jpg",
    top5: [
      { label: "tabby", score: 62.35 },
      { label: "tiger cat", score: 18.12 },
    ],
    animal_detected: true,
    best_label: "tabby",
    best_score: 62.35,
    animal_in_top5: null,
    db_id: 1,
  },
};

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe("GET /health", () => {
  test("retourne 200 avec status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// POST /api/analyze — validation des entrées
// ---------------------------------------------------------------------------

describe("POST /api/analyze — validation", () => {
  test("aucune image → 400", async () => {
    const res = await request(app).post("/api/analyze");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("formulaire vide → 400", async () => {
    const res = await request(app)
      .post("/api/analyze")
      .set("Content-Type", "multipart/form-data");
    expect(res.status).toBe(400);
  });

  test("URL avec schéma FTP → 400", async () => {
    const res = await request(app)
      .post("/api/analyze")
      .field("urls", "ftp://example.com/image.jpg");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/http\/https/i);
  });

  test("URL IP privée → 400", async () => {
    // isSafeUrl résout le DNS — on mock pour retourner une IP privée
    jest.spyOn(require("../src/utils/ssrf"), "isSafeUrl").mockResolvedValueOnce(false);
    const res = await request(app)
      .post("/api/analyze")
      .field("urls", "http://192.168.1.1/image.jpg");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non autoris/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/analyze — traitement d'une image valide
// ---------------------------------------------------------------------------

describe("POST /api/analyze — succès", () => {
  beforeEach(() => {
    axios.post.mockResolvedValue(MOCK_AI_RESPONSE);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("retourne 200 avec une image", async () => {
    const imageBuffer = Buffer.alloc(100, 0xff); // image factice
    const res = await request(app)
      .post("/api/analyze")
      .attach("images", imageBuffer, "test.jpg");
    expect(res.status).toBe(200);
  });

  test("la réponse contient les clés requises", async () => {
    const imageBuffer = Buffer.alloc(100, 0xff);
    const res = await request(app)
      .post("/api/analyze")
      .attach("images", imageBuffer, "test.jpg");
    expect(res.body).toHaveProperty("results");
    expect(res.body).toHaveProperty("errors");
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("success_count");
    expect(res.body).toHaveProperty("error_count");
  });

  test("total = success_count + error_count", async () => {
    const imageBuffer = Buffer.alloc(100, 0xff);
    const res = await request(app)
      .post("/api/analyze")
      .attach("images", imageBuffer, "test.jpg");
    const { total, success_count, error_count } = res.body;
    expect(total).toBe(success_count + error_count);
  });

  test("le résultat contient les champs d'analyse", async () => {
    const imageBuffer = Buffer.alloc(100, 0xff);
    const res = await request(app)
      .post("/api/analyze")
      .attach("images", imageBuffer, "cat.jpg");
    expect(res.body.success_count).toBe(1);
    const result = res.body.results[0];
    for (const field of ["filename", "top5", "animal_detected", "best_label", "best_score", "db_id"]) {
      expect(result).toHaveProperty(field);
    }
  });

  test("la réponse est du JSON", async () => {
    const imageBuffer = Buffer.alloc(100, 0xff);
    const res = await request(app)
      .post("/api/analyze")
      .attach("images", imageBuffer, "test.jpg");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});

// ---------------------------------------------------------------------------
// POST /api/analyze — erreur du service IA
// ---------------------------------------------------------------------------

describe("POST /api/analyze — erreur service IA", () => {
  test("erreur IA → comptabilisée dans errors", async () => {
    axios.post.mockRejectedValue(new Error("Service IA indisponible"));
    const imageBuffer = Buffer.alloc(100, 0xff);
    const res = await request(app)
      .post("/api/analyze")
      .attach("images", imageBuffer, "test.jpg");
    expect(res.status).toBe(200);
    expect(res.body.error_count).toBe(1);
    expect(res.body.errors[0].error).toMatch(/Service IA/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/locations
// ---------------------------------------------------------------------------

describe("GET /api/locations — succès", () => {
  const MOCK_LOCATIONS = {
    locations: [
      {
        id: 1,
        source: "cat.jpg",
        latitude: 48.8566,
        longitude: 2.3522,
        top1_label: "tabby",
        top1_score: 62.35,
        timestamp: "2024-01-01T00:00:00+00:00",
        is_animal: 1,
      },
    ],
  };

  test("retourne 200 avec la liste des positions", async () => {
    axios.get.mockResolvedValue({ data: MOCK_LOCATIONS });
    const res = await request(app).get("/api/locations");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("locations");
    expect(Array.isArray(res.body.locations)).toBe(true);
  });

  test("la réponse est du JSON", async () => {
    axios.get.mockResolvedValue({ data: MOCK_LOCATIONS });
    const res = await request(app).get("/api/locations");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  test("chaque position contient les champs requis", async () => {
    axios.get.mockResolvedValue({ data: MOCK_LOCATIONS });
    const res = await request(app).get("/api/locations");
    const loc = res.body.locations[0];
    for (const field of ["id", "source", "latitude", "longitude", "top1_label", "top1_score", "timestamp", "is_animal"]) {
      expect(loc).toHaveProperty(field);
    }
  });
});

describe("GET /api/locations — erreur service IA", () => {
  test("erreur IA → 502", async () => {
    axios.get.mockRejectedValue(new Error("Service IA indisponible"));
    const res = await request(app).get("/api/locations");
    expect(res.status).toBe(502);
    expect(res.body.error).toBeDefined();
  });
});
