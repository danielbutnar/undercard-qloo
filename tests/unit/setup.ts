// Unit tests run offline: no call reaches Qloo, the model or any other host. An unmocked fetch
// or socket throws; a test that needs a response stubs fetch (vi.stubGlobal), and
// vi.unstubAllGlobals puts this guard back.
import net from "node:net";

const refuse = (what: string) =>
  new Error(`no network in unit tests: ${what}; stub fetch instead`);

globalThis.fetch = async (input: RequestInfo | URL) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  throw refuse(url);
};

net.Socket.prototype.connect = function connect() {
  throw refuse("a socket");
} as typeof net.Socket.prototype.connect;
