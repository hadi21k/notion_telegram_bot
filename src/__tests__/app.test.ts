import request from "supertest";
import app from "../app";

describe("App", () => {
  describe("GET /health", () => {
    it("should return 200 OK with status", async () => {
      const response = await request(app)
        .get("/health")
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toEqual({
        status: "OK",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle non-existent routes", async () => {
      const response = await request(app)
        .get("/non-existent-route")
        .expect("Content-Type", /json/)
        .expect(404);

      expect(response.body).toBeDefined();
    });
  });
});
