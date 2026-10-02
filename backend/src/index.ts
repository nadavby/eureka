/** @format */

import initApp from "./server";
import http from "http";
import https from "https";
import fs from "fs";
import { initSocket } from "./services/notification.socket.service";

const port = process.env.PORT || 3000;

initApp().then((app) => {
  let server;
  // TLS is normally terminated by a reverse proxy / load balancer;
  // serve HTTPS directly only when certificate paths are provided.
  if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH),
    };
    server = https.createServer(options, app);
  } else {
    server = http.createServer(app);
  }

  // Initialize Socket.IO
  initSocket(server);

  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
