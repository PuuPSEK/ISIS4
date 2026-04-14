const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// ВАЖНО: указываем папку public
app.use(express.static(path.join(__dirname, "..", "public")));

// главная страница
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on http://localhost:3000");
});