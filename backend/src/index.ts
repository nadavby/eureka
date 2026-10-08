import http from "http";
import https from "https";
import fs from "fs";
import initApp from "./server";
import { initSocket } from "./services/notification.socket.service";
import { config } from "./lib/config";
import { logger } from "./lib/logger";

const start = async () => {
  const app = await initApp();

  // TLS is normally terminated by a reverse proxy / load balancer;
  // serve HTTPS directly only when certificate paths are provided.
  const server =
    config.SSL_KEY_PATH && config.SSL_CERT_PATH
      ? https.createServer({ key: fs.readFileSync(config.SSL_KEY_PATH), cert: fs.readFileSync(config.SSL_CERT_PATH) }, app)
      : http.createServer(app);

  initSocket(server);
  server.listen(config.PORT, () => logger.info({ port: config.PORT }, "Server listening"));
};

start().catch((err) => {
  logger.fatal({ err }, "Startup failed");
  process.exit(1);
});
