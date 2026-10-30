const request = require("supertest");

const mockQuery = jest.fn();
jest.mock("mysql2/promise", () => ({
  createPool: () => ({
    query: (...args) => mockQuery(...args),
    getConnection: jest.fn(),
    end: jest.fn()
  })
}));

const app = require("./server");

beforeEach(() => mockQuery.mockReset());

describe("BrightBank API", () => {
  test("GET /api/health returns alive", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("alive");
  });

  test("GET /api/ready returns 200 when database is up", async () => {
    mockQuery.mockResolvedValue([[{ 1: 1 }]]);
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body.database).toBe("connected");
  });

  test("GET /api/ready returns 503 when database is down", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"));
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("not_ready");
  });

  test("POST /api/deposit rejects a non-numeric amount", async () => {
    const res = await request(app).post("/api/deposit").send({ amount: "abc" });
    expect(res.status).toBe(400);
  });

  test("POST /api/withdraw rejects an amount over 1,000,000", async () => {
    const res = await request(app).post("/api/withdraw").send({ amount: "1000001" });
    expect(res.status).toBe(400);
  });

  test("POST /api/deposit rejects malformed JSON", async () => {
    const res = await request(app)
      .post("/api/deposit")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid JSON request body");
  });
});
