import React, { useState, useEffect } from 'react';
import { Throughput, ServerWithThroughtput, useMoproxyStatus, useMoproxyVersion } from './backend';
import * as format from './formatUtils';


function useDocumentVisibility() {
  const [hidden, setHidden] = useState(document.hidden);
  const onVisibilityChange = () => setHidden(document.hidden);

  useEffect(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return hidden;
}

function FullThroughput(props: { bw: Throughput }) {
  return <>
    <span title="upload">↑</span>&nbsp;
    <span className="tx-speed">{format.humanThroughput(props.bw.tx_bps)}</span>&nbsp;
    <span title="download">↓</span>&nbsp;
    <span className="rx-speed">{format.humanThroughput(props.bw.rx_bps)}</span>
    </>
}

type ServerRowProps = {
  server: ServerWithThroughtput,
  onClick: (item: ServerWithThroughtput) => void,
  showFullTraffic: boolean,
}

function ServerRow(props: ServerRowProps) {
  const { server, throughput } = props.server;
  const url = format.proxyUrl(server);
  const totalThroughput = throughput.tx_bps + throughput.rx_bps;
  const columnThouughput = totalThroughput ? format.humanThroughput(totalThroughput) : "";

  return (
    <tr>
      <td><button title={url} onClick={() => props.onClick(props.server)}>{server.tag}</button></td>
      <td><span title="based on average delay or custom method">{server.status.score || "-"}</span></td>
      <td><span title="TCP handshake included">{format.durationToMills(server.status.delay?.Some) || "-"}</span></td>
      <td><span title="# current connections">{format.humanQuantity(server.status.conn_alive)}</span> /&nbsp;
        <span title="# total connections">{format.humanQuantity(server.status.conn_total)}</span></td>
      <td>
        { props.showFullTraffic ? <>
            <span title="total sent">{format.humanFileSize(server.traffic.tx_bytes)}</span> /&nbsp;
            <span title="total received">{format.humanFileSize(server.traffic.rx_bytes)}</span>
          </> : <>
            <span title="total traffic">{format.humanFileSize(server.traffic.tx_bytes + server.traffic.rx_bytes)}</span>
          </>
        }
      </td>
      <td><span title="throughput">{columnThouughput}</span></td>
    </tr>
  );
}

function TrafficSwitch(props: { full: boolean, onChange: (full: boolean) => void }) {
  return (
    <button onClick={() => props.onChange(!props.full)}>
      {props.full ? "Up / Down" : "Traffic"}
    </button>
  )
}

function ServerTable(props: { servers: [ServerWithThroughtput] }) {
  const [showFullTraffic, setShowFullTraffic] = useState(true);
  const [selectedServer, setSelectedServer] = useState<ServerWithThroughtput>();

  return (
    <table>
      <thead>
        <tr>
          <th>Server</th>
          <th>Score</th>
          <th>Delay</th>
          <th>CUR / TTL</th>
          <th><TrafficSwitch full={showFullTraffic} onChange={full => setShowFullTraffic(full)} /></th>
          <th>⇅</th>
        </tr>
      </thead>
      <tbody id="servers">
        {props.servers.map(s =>
          <ServerRow
            server={s} key={s.server.tag} showFullTraffic={showFullTraffic} onClick={setSelectedServer}
          />
        )}
      </tbody>
      {selectedServer &&
        <ServerDetail item={selectedServer} onDismiss={() => setSelectedServer(undefined)} />}
    </table>
  );
}

function Interval(props: { millis: number, onTick: () => void }) {
  useEffect(() => {
    const id = setInterval(props.onTick, props.millis);
    return () => clearInterval(id);
  }, [props.millis]);
  return <></>;
}

function Modal(props: { onDismiss: () => void, children: React.ReactNode }) {
  return (
    <div className="modal" role="dialog" onClick={props.onDismiss}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        {props.children}
      </div>
    </div>
  );
}

function ConnectionCloseHistory(props: { history: number, size: number }) {
  return (
    <ul className="close-history">
      {Array.from({ length: props.size }, (_, i) => {
        const ok = ((props.history >> i) & 0x01) === 0;
        return (
          <li key={i}
            className={ok ? "close-ok" : "close-err"}
            title={ok ? "closed normally" : "closed with error"}></li>
        )
      })}
    </ul>
  );
}

function ServerDetail(props: { onDismiss: () => void, item: ServerWithThroughtput }) {
  const { server, throughput } = props.item;
  return (
    <Modal onDismiss={props.onDismiss}>
      <h3 className="server-tag">{server.tag}<br />
        <small className="server-url">{format.proxyUrl(server)}</small>
      </h3>

      <p>
        <ConnectionCloseHistory
          history={server.status.close_history}
          size={Math.min(64, server.status.conn_total - server.status.conn_alive)} />
      </p>
    </Modal>
  )
}

function RefreshControl(props: { isLoading: boolean, onRefresh: () => void }) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const hidden = useDocumentVisibility();

  function autoRefreshOnChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAutoRefresh(event.target.checked)
  }

  return (
    <>
      <button id="refresh" disabled={props.isLoading} onClick={props.onRefresh}>Refresh</button>&nbsp;
      <input id="auto-refresh" type="checkbox" checked={autoRefresh} onChange={autoRefreshOnChange} />&nbsp;
      <label htmlFor="auto-refresh">auto</label>
      {autoRefresh && !hidden && <Interval millis={1000} onTick={props.onRefresh} />}
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
      {status?.servers && <ServerTable servers={status?.servers} />}
    </>
  );
}

export default App;
