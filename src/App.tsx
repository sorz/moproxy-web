import React, { useState, useEffect } from 'react';

type Option<T> = null | { Some: T };

interface HttpProto {
  HTTP: {
    connect_with_payload: boolean,
  }
}

interface SocksV5Proto {
  SOCKSv5: {
    fake_handshaking: boolean,
  }
}

interface Throughput {
  tx_bps: number,
  rx_bps: number,
}

interface Duration {
  secs: number,
  nanos: number,
}

interface Traffic {
  tx_bytes: number,
  rx_bytes: number,
}

interface ServerConfig {
  test_dns: string,
  max_wait: Duration,
  listen_ports: [number],
  score_base: number,
}

interface ServerStatus {
  delay: Option<Duration>,
  score: number,
  conn_alive: number,
  conn_total: number,
  conn_error: number,
  close_history: number,
}

interface Server {
  addr: string,
  proto: SocksV5Proto | HttpProto,
  tag: string,
  config: ServerConfig,
  status: ServerStatus,
  traffic: Traffic,
}

interface ServerWithThroughtput {
  server: Server,
  throughput: Throughput,
};

interface MoproxyStatus {
  servers: [ServerWithThroughtput],
  uptime: Duration,
  throughput: Throughput,
}

function useMoproxyStatus() {
  const [status, setStatus] = useState<MoproxyStatus>();
  const [updateAt, setUpdateAt] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      setIsError(false);
      setIsLoading(true);

      try {
        const resp = await fetch(process.env.REACT_APP_STATUS_URI || 'notfound');
        setStatus(await resp.json());
      } catch (err) {
        setIsError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [updateAt]);

  return { status, isLoading, isError, setUpdateAt};
}

function humanDuration(duration: Duration): string {
  const secs = duration.secs;
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [["d", d], ["h", h], ["m", m], ["s", s]]
    .filter(x => x[1] > 0)
    .slice(0, 2)
    .map(x => `${x[1]}${x[0]}`)
    .join('');
}

function durationToMills(t: Duration | undefined): string | null {
  if (t == null || t == undefined) return null;
  let ms = Math.round(t.secs * 1000 + t.nanos / 1e6);
  return `${numberWithCommas(ms)} ms`;
}

function numberWithCommas(n: number): string {
  const parts = n.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".")
}

function humanFileSize(bytes: number): string {
  if (bytes == 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' '
    + ['B', 'KiB', 'MiB', 'GiB', 'TiB'][i];
};

function humanThroughput(bps: number) {
  if (bps == 0) return "0 bps";
  const i = Math.floor(Math.log(bps) / Math.log(1000));
  return (bps / Math.pow(1000, i)).toFixed(2) + ' '
    + ['bps', 'kbps', 'Mbps', 'Gbps', 'Tbps'][i];
}

function humanQuantity(n: number): string {
  if (n == 0) return '0';
  if (n > 1e4) return numberWithCommas(+(n / 1000).toFixed(0)) + 'k';
  if (n > 1e3) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function FullThroughput(props: { bw: Throughput }) {
  return <>
    <span title="upload">↑</span>&nbsp;
    <span className="tx-speed">{humanThroughput(props.bw.tx_bps)}</span>&nbsp;
    <span title="download">↓</span>&nbsp;
    <span className="rx-speed">{humanThroughput(props.bw.rx_bps)}</span>
    </>
}

function ServerRow(props: { server: ServerWithThroughtput }) {
  const { server, throughput } = props.server;
  const url = Object.keys(server.proto)[0] + "://" + server.addr;
  const totalThroughput = throughput.tx_bps + throughput.rx_bps;
  const columnThouughput = totalThroughput ? humanThroughput(totalThroughput) : "";

  return (
    <tr>
      <td><span title={url}>{server.tag}</span></td>
      <td><span title="based on average delay or custom method">{server.status.score}</span></td>
      <td><span title="TCP handshake included">{durationToMills(server.status.delay?.Some) || "-"}</span></td>
      <td><span title="# current connections">{humanQuantity(server.status.conn_alive)}</span> /&nbsp;
        <span title="# total connections">{humanQuantity(server.status.conn_total)}</span></td>
      <td><span title="total sent">{humanFileSize(server.traffic.tx_bytes)}</span> /&nbsp;
        <span title="total received">{humanFileSize(server.traffic.rx_bytes)}</span></td>
      <td><span title="throughput">{columnThouughput}</span></td>
    </tr>
  );
}

function App() {
  const { status, isLoading, isError, setUpdateAt } = useMoproxyStatus();

  if (isError) return <p>Error</p>;
  if (isLoading) return <p>Loading…</p>;
  if (status == null) return <></>;

  const totalAliveConns = status.servers.reduce((c, s) => c + s.server.status.conn_alive, 0);
  
  return (
    <>
      <h1>moproxy</h1>
      <p>moproxy (TODO: version) is running.&nbsp;
        {humanDuration(status.uptime)}
      </p>
      <button id="refresh">Refresh</button>&nbsp;
      <input id="auto-refresh" type="checkbox" checked />&nbsp;
      <label htmlFor="auto-refresh">auto</label>

      <h2>Proxy servers</h2>
      <p>
        Connections: <span id="total-alive-conn">{numberWithCommas(totalAliveConns)}</span>&nbsp;
        Throughput: <FullThroughput bw={status.throughput} />
      </p>
      <table>
        <thead>
          <tr><th>Server</th><th>Score</th><th>Delay</th>
            <th>CUR / TTL</th><th>Up / Down</th><th>⇅</th></tr>
        </thead>
        <tbody id="servers">
        {status.servers.map(s => <ServerRow server={s} key={s.server.tag} />)}
        </tbody>
      </table>
    </>
  );
}

export default App;
