import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createLobby, matchRequest } from "../server/matchmaking.js";

const lobby = createLobby();
const web = fileURLToPath(new URL("../web", import.meta.url));
const port = Number(process.env.PORT ?? 0);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/match") {
      const input = new Request(url, {
        method: req.method, headers: req.headers, duplex: "half",
        body: req.method === "POST" ? Readable.toWeb(req) : undefined,
      });
      const response = await matchRequest(input, lobby);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    const pathname = decodeURIComponent(url.pathname);
    const path = resolve(web, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!path.startsWith(web + sep) || !types[extname(path)]) {
      res.writeHead(404).end();
      return;
    }
    const contents = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)], "cache-control": "no-store" });
    res.end(contents);
  } catch (error) {
    res.writeHead(error.code === "ENOENT" ? 404 : 500).end();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Open http://127.0.0.1:${server.address().port}/`);
});
