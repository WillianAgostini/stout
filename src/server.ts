import cluster from "node:cluster";
import {
  IncomingMessage,
  Server,
  ServerResponse,
  createServer,
} from "node:http";
import { availableParallelism } from "node:os";
import { execute } from "./index";
import { HttpServer, request, response } from "./types";

const listen = (
  hostname: string,
  port: number,
  handler?: () => Promise<void> | void,
): Promise<HttpServer> => {
  const server = createServer(async (req, res) => {
    try {
      await execute(req as request, res as response);
    } catch (err) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, hostname, async () => {
      if (handler) await handler();
      resolve(server);
    });
  });
};

export const start = async (
  opts: {
    hostname: string;
    port: number;
  },
  handler?: () => Promise<void> | void,
) => {
  return await listen(opts.hostname, opts.port, handler);
};

export const startWithCluster = async (
  opts: {
    hostname: string;
    port: number;
    numCPUs?: number;
  },
  handler: () => Promise<void> | void,
) => {
  opts.numCPUs = opts.numCPUs || availableParallelism();

  if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);

    for (let i = 0; i < opts.numCPUs; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker) => {
      console.log(`worker ${worker.process.pid} died`);
    });
  } else {
    await start(opts, handler);
    console.log(`Worker ${process.pid} started`);
  }
};

export const close = (
  server: Server<typeof IncomingMessage, typeof ServerResponse>,
) => {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  });
};
