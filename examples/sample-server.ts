import express from "express";

const app = express();
const PORT = 4000;

app.use(express.json());

// simple fake login — accepts any username, always returns the same token
app.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "username required" });
  }
  res.status(200).json({ token: "sample-server-fake-token" });
});
// simple in-memory store, just for demonstrating mutation + cleanup
let nextUserId = 1000;
const users: Record<number, { id: number; name: string }> = {};

app.post("/mutable-users", (req, res) => {
  const name = req.body?.name;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }
  const id = nextUserId++;
  users[id] = { id, name };
  res.status(201).json({ id, name });
});

app.delete("/mutable-users/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!users[id]) {
    return res.status(404).json({ error: "not found" });
  }
  delete users[id];
  res.status(204).send();
});

app.get("/mutable-users-count", (_req, res) => {
  res.status(200).json({ count: Object.keys(users).length });
});
// a protected route — only works with the right token
app.get("/protected", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== "Bearer sample-server-fake-token") {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.status(200).json({ secret: "you found it" });
});

// a couple of realistic endpoints to fuzz against

app.get("/users", (req, res) => {
  const id = Number(req.query.id);

  if (!Number.isInteger(id) || id < 1 || id > 9999) {
    return res.status(400).json({ error: "id must be an integer between 1 and 9999" });
  }

  res.status(200).json({ id, name: `User ${id}`, email: `user${id}@example.com` });
});

app.get("/products", (req, res) => {
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);

  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ error: "page must be a positive integer" });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: "limit must be between 1 and 100" });
  }

  res.status(200).json({ page, limit, products: [] });
});

app.listen(PORT, () => {
  console.log(`Sample server running at http://localhost:${PORT}`);
});