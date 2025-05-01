import httpsServer from "./app";

const PORT = process.env.PORT || 3000;

httpsServer.listen(PORT, () => {
  console.info(`🚀 HTTPS server running on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  console.warn("SIGTERM signal received: closing HTTPS server");
  httpsServer.close(async () => {
    console.warn("HTTPS server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.warn("SIGINT signal received: closing HTTPS server");
  httpsServer.close(async () => {
    console.warn("HTTPS server closed");
    process.exit(0);
  });
});
