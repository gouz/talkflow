/* eslint-disable no-undef */
import dotenv from "dotenv";
import { readdirSync, existsSync } from "node:fs";
import open, { apps } from "open";
import type {
  SliDeskFile,
  ServerOptions,
  SliDeskPlugin,
  PluginsJSON,
} from "../types";

const { log } = console;

const getFile = (req: Request, path: string) => {
  const fileurl = req.url.replace(
    new RegExp(`^https?://${req.headers.get("host")}`, "g"),
    "",
  );
  const file = Bun.file(
    fileurl.match(/https?:\/\/(\S*)/g) ? fileurl : `${path}${fileurl}`,
  );
  if (file.size !== 0)
    return new Response(file, {
      headers: {
        "Content-Type": file.type,
      },
    });
  return new Response(`${req.url} not found`, { status: 404 });
};

interface BunServer {
  publish(
    topic: string,
    data: string | ArrayBufferView | ArrayBuffer,
    compress?: boolean,
  ): number;
}

let serverFiles: SliDeskFile = {};
let serverPlugins: PluginsJSON = {};
let serverPath: string = "";

const getPlugins = async (pluginsDir: string) => {
  await Promise.all(
    readdirSync(pluginsDir).map(async (plugin) => {
      const pluginPath = `${pluginsDir}/${plugin}/plugin.json`;
      const pluginFile = Bun.file(pluginPath);
      const exists = await pluginFile.exists();
      if (exists) {
        const json = await pluginFile.json();
        if (json.addRoutes || json.addWS) {
          let obj = { type: "external", ...json };
          if (json.addRoutes) {
            const { default: addRoutes } = await import(
              `${path}/${json.addRoutes}`
            );
            obj = { ...obj, addRoutes };
          }
          if (json.addWS) {
            const { default: addWS } = await import(`${path}/${json.addWS}`);
            obj = { ...obj, addWS };
          }
          serverPlugins[plugin] = obj;
        }
      }
    }),
  );
};

export default class Server {
  #server: BunServer;
  #options: ServerOptions;

  async create(files: SliDeskFile, options: ServerOptions, path: string) {
    serverFiles = files;
    serverPath = path;
    this.#options = options;
    const slideskEnvFile = Bun.file(`${path}/.env`);
    let env: any = {};
    if (slideskEnvFile.size !== 0) {
      const buf = await slideskEnvFile.text();
      env = dotenv.parse(buf);
    }
    const pluginsDir = `${path}/plugins`;
    if (existsSync(pluginsDir)) await getPlugins(pluginsDir);
    const serverOptions = {
      port: options.port,
      async fetch(req) {
        const url = new URL(req.url);
        let res = null;
        switch (url.pathname) {
          case "/ws":
            return this.upgrade(req)
              ? undefined
              : new Response("WebSocket upgrade error", { status: 400 });
          case "/":
            if (
              !req.headers.get("host").startsWith("localhost") &&
              req.headers.get("host") === `${options.domain}:${options.port}` &&
              !options.interactive
            )
              return new Response("");
            return new Response(serverFiles["/index.html"].content, {
              headers: serverFiles["/index.html"].headers,
            });
          default:
            if (Object.keys(serverFiles).includes(url.pathname))
              return new Response(serverFiles[url.pathname].content, {
                headers: serverFiles[url.pathname].headers,
              });
            await Promise.all(
              [...Object.values(serverPlugins)].map(async (plugin) => {
                if ((plugin as SliDeskPlugin).addRoutes) {
                  res = await (plugin as SliDeskPlugin).addRoutes(req, env);
                }
              }),
            );
            if (res !== null) return res;
            return getFile(req, serverPath);
        }
      },
      websocket: {
        open(ws) {
          ws.subscribe("slidesk");
        },
        async message(ws, message) {
          const json = JSON.parse(message);
          if (json.plugin && serverPlugins[json.plugin]?.addWS) {
            ws.publish(
              "slidesk",
              JSON.stringify({
                action: `${json.plugin}_response`,
                response: await serverPlugins[json.plugin].addWS(message),
              }),
            );
          } else {
            ws.publish("slidesk", message);
          }
        },
        close(ws) {
          ws.unsubscribe("slidesk");
        },
      },
      tls: {},
    };
    if (env.HTTPS === "true") {
      serverOptions.tls = {
        key: Bun.file(env.KEY),
        cert: Bun.file(env.CERT),
        passphrase: env.PASSPHRASE ? Bun.file(env.PASSPHRASE) : "",
      };
    }
    this.#server = Bun.serve(serverOptions);
    await this.#display(env.HTTPS === "true");
  }

  async #display(https: boolean) {
    if (this.#options.notes) {
      log(
        `Your speaker view is available on: \x1b[1m\x1b[36;49mhttp${
          https ? "s" : ""
        }://${this.#options.domain}:${this.#options.port}/notes.html\x1b[0m`,
      );
      if (this.#options.open)
        await open(
          `http${https ? "s" : ""}://${this.#options.domain}:${
            this.#options.port
          }/notes.html`,
          { app: { name: apps[this.#options.open] } },
        );
    }
    log(
      `Your presentation is available on: \x1b[1m\x1b[36;49mhttp${
        https ? "s" : ""
      }://${this.#options.domain}:${this.#options.port}\x1b[0m`,
    );
    if (this.#options.open && !this.#options.notes)
      await open(
        `http${https ? "s" : ""}://${this.#options.domain}:${this.#options.port}`,
        { app: { name: apps[this.#options.open] } },
      );
    log();
  }

  setFiles(files: SliDeskFile) {
    serverFiles = files;
    this.#server.publish("slidesk", JSON.stringify({ action: "reload" }));
  }

  send(action) {
    this.#server.publish("slidesk", JSON.stringify({ action }));
  }
}