import { Duration, Server } from "./backend";

export function humanDuration(duration: Duration): string {
  const secs = duration.secs;
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [
    ["d", d],
    ["h", h],
    ["m", m],
    ["s", s],
  ]
    .filter((x) => x[1] > 0)
    .slice(0, 2)
    .map((x) => `${x[1]}${x[0]}`)
    .join("");
}

export function durationToMills(t: Duration | undefined): string | null {
  if (t === null || t === undefined) return null;
  let ms = Math.round(t.secs * 1000 + t.nanos / 1e6);
  return `${numberWithCommas(ms)} ms`;
}

export function numberWithCommas(
  n: number,
  alwaysWithSign: boolean = false
): string {
  const parts = n.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const result = parts.join(".");
  return n >= 0 && alwaysWithSign ? "+" + result : result;
}

export function humanFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (
    (bytes / Math.pow(1024, i)).toFixed(2) +
    " " +
    ["B", "KiB", "MiB", "GiB", "TiB"][i]
  );
}

export function humanThroughput(bps: number) {
  if (bps === 0) return "0 bps";
  const i = Math.floor(Math.log(bps) / Math.log(1000));
  return (
    (bps / Math.pow(1000, i)).toFixed(2) +
    " " +
    ["bps", "kbps", "Mbps", "Gbps", "Tbps"][i]
  );
}

export function humanQuantity(n: number): string {
  if (n === 0) return "0";
  if (n > 1e4) return numberWithCommas(+(n / 1000).toFixed(0)) + "k";
  if (n > 1e3) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

export function proxyUrl(server: Server) {
  return Object.keys(server.proto)[0] + "://" + server.addr;
}
