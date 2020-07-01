import React, { useState } from 'react';
import { Throughput, ServerWithThroughtput, useMoproxyStatus } from './backend';
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
        {format.humanDuration(status.uptime)}
      </p>
      <button id="refresh">Refresh</button>&nbsp;
      <input id="auto-refresh" type="checkbox" checked />&nbsp;
      <label htmlFor="auto-refresh">auto</label>

      <h2>Proxy servers</h2>
      <p>
        Connections: <span id="total-alive-conn">{format.numberWithCommas(totalAliveConns)}</span>&nbsp;
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
