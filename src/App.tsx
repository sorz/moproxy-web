import React, { useState, useEffect } from 'react';
import { Throughput, ServerWithThroughtput, useMoproxyStatus, useMoproxyVersion } from './backend';
import * as format from './formatUtils';

function FullThroughput(props: { bw: Throughput }) {
  return <>
    <span title="upload">↑</span>&nbsp;
    <span className="tx-speed">{format.humanThroughput(props.bw.tx_bps)}</span>&nbsp;
    <span title="download">↓</span>&nbsp;
    <span className="rx-speed">{format.humanThroughput(props.bw.rx_bps)}</span>
    </>
}

function ServerRow(props: { server: ServerWithThroughtput }) {
  const { server, throughput } = props.server;
  const url = Object.keys(server.proto)[0] + "://" + server.addr;
  const totalThroughput = throughput.tx_bps + throughput.rx_bps;
  const columnThouughput = totalThroughput ? format.humanThroughput(totalThroughput) : "";

  return (
    <tr>
      <td><span title={url}>{server.tag}</span></td>
      <td><span title="based on average delay or custom method">{server.status.score}</span></td>
      <td><span title="TCP handshake included">{format.durationToMills(server.status.delay?.Some) || "-"}</span></td>
      <td><span title="# current connections">{format.humanQuantity(server.status.conn_alive)}</span> /&nbsp;
        <span title="# total connections">{format.humanQuantity(server.status.conn_total)}</span></td>
      <td><span title="total sent">{format.humanFileSize(server.traffic.tx_bytes)}</span> /&nbsp;
        <span title="total received">{format.humanFileSize(server.traffic.rx_bytes)}</span></td>
      <td><span title="throughput">{columnThouughput}</span></td>
    </tr>
  );
}

function Interval(props: { millis: number, onTick: () => void }) {
  useEffect(() => {
    const id = setInterval(props.onTick, props.millis);
    return () => clearInterval(id);
  });
  return <></>;
}
function RefreshControl(props: { isLoading: boolean, onRefresh: () => void }) {
  const [autoRefresh, setAutoRefresh] = useState(true);

  function autoRefreshOnChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAutoRefresh(event.target.checked)
  }

  return (
    <>
      <button id="refresh" disabled={props.isLoading} onClick={props.onRefresh}>Refresh</button>&nbsp;
      <input id="auto-refresh" type="checkbox" checked={autoRefresh} onChange={autoRefreshOnChange} />&nbsp;
      <label htmlFor="auto-refresh">auto</label>
      {autoRefresh && <Interval millis={1000} onTick={props.onRefresh} />}
    </>
  );
}

function App() {
  const version = useMoproxyVersion();
  const { status, isLoading, isError, setUpdateAt } = useMoproxyStatus();

  const totalAliveConns = status == null ? 0 :
    status.servers.reduce((c, s) => c + s.server.status.conn_alive, 0);

  function refresh() {
    setUpdateAt(Date.now());
  }
  
  return (
    <>
      <h1>moproxy</h1>
      <p>moproxy {version && `(${version})`} is running.&nbsp;
        {status?.uptime && format.humanDuration(status.uptime)}.&nbsp;
        {isError && <span title="error on refresh status">[offline]</span> }
      </p>
      <RefreshControl isLoading={isLoading} onRefresh={refresh} />
      <h2>Proxy servers</h2>
      <p>
        Connections: <span id="total-alive-conn">
          {status && format.numberWithCommas(totalAliveConns)}</span>&nbsp;
        Throughput: {status && <FullThroughput bw={status.throughput} />}
      </p>
      <table>
        <thead>
          <tr><th>Server</th><th>Score</th><th>Delay</th>
            <th>CUR / TTL</th><th>Up / Down</th><th>⇅</th></tr>
        </thead>
        <tbody id="servers">
        {status && status.servers.map(s => <ServerRow server={s} key={s.server.tag} />)}
        </tbody>
      </table>
    </>
  );
}

export default App;
