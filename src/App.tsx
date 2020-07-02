import React, { useState, useEffect, useRef } from 'react';
import { Throughput, ServerWithThroughtput, useMoproxyStatus, useMoproxyVersion } from './backend';
import * as format from './formatUtils';
import deepEqual from "deep-equal";


function useDocumentEventListener<K extends keyof DocumentEventMap>(
  event: K, callback: (event: DocumentEventMap[K]) => void) {
  useEffect(() => {
    document.addEventListener(event, callback);
    return () => document.removeEventListener(event, callback);
  }, []);
}

function useDocumentVisibility() {
  const [hidden, setHidden] = useState(document.hidden);
  useDocumentEventListener('visibilitychange', () => setHidden(document.hidden));
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
  const refSelectedServerTag = useRef<string>();
  const refServerTags = useRef<string[]>();

  const findServerByTag = (tag: string) => props.servers.find((s) => s.server.tag == tag);

  if (selectedServer) {
    refSelectedServerTag.current = selectedServer.server.tag;
    refServerTags.current = props.servers.map(s => s.server.tag);
    const updated = findServerByTag(selectedServer.server.tag);
    if (updated && !deepEqual(selectedServer, updated)) setSelectedServer(updated);
  }

  // Keyboard shortcut
  useDocumentEventListener('keydown', e => {
    if (!refSelectedServerTag.current || !refServerTags.current) return;
    if (e.key != 'ArrowLeft' && e.key != 'ArrowRight') return;
    const origIdx = refServerTags.current.findIndex(tag => tag == refSelectedServerTag.current);
    if (origIdx == -1) return;
    const newIdx = origIdx + (e.key == 'ArrowLeft' ? -1 : 1)
    if (newIdx < 0 || newIdx >= props.servers.length) return;
    pushSelectedServer(props.servers[newIdx]);
    e.stopPropagation();
  });

  // History management
  function pushSelectedServer(server: ServerWithThroughtput | undefined) {
    if (server == undefined) {
      window.history.pushState("", "", "/");
    } else {
      const tag = server.server.tag;
      window.history.pushState(tag, "", `#${tag}`);
    }
    setSelectedServer(server);
  }

  function onPopStateCallback(event: PopStateEvent) {
    const tag = event.state as string;
    const server = findServerByTag(tag);
    setSelectedServer(server);
  }

  const tagOnUrl = window.location.hash.slice(1);
  if (tagOnUrl && !selectedServer) {
    setSelectedServer(findServerByTag(tagOnUrl));
  }

  useEffect(() => {
    window.addEventListener('popstate', onPopStateCallback);
    return () => window.removeEventListener('popstate', onPopStateCallback);
  }, []);

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
            server={s} key={s.server.tag} showFullTraffic={showFullTraffic} onClick={pushSelectedServer}
          />
        )}
      </tbody>
      {selectedServer &&
        <ServerDetail item={selectedServer} onDismiss={() => pushSelectedServer(undefined)} />}
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
  useDocumentEventListener("keydown", e => e.keyCode === 27 && props.onDismiss());
  return (
    <div className="modal" role="dialog" onClick={props.onDismiss}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        {props.children}
        <button className="action-close" onClick={props.onDismiss} autoFocus>CLOSE</button>
      </div>
    </div>
  );
}

function bitCount(n: bigint) {
  // Hamming weight
  n = n - ((n >> 1n) & 0x5555555555555555n);
  n = (n & 0x3333333333333333n) + ((n >> 2n) & 0x3333333333333333n);
  n = ((n + (n >> 4n) & 0xF0F0F0F0F0F0F0Fn) * 0x101010101010101n) >> 56n;
  return BigInt.asUintN(8, n);
}

function ConnectionCloseHistory(props: { history: bigint, size: number }) {
  const errCount = bitCount(props.history);
  return (
    <div>
      <ul className="close-history-diagram" >
        {Array.from({ length: props.size }, (_, i) => {
          const ok = ((props.history >> BigInt(i)) & 0x01n) === 0n;
          return (
            <li key={i}
              className={ok ? "close-ok" : "close-err"}
              title={ok ? "closed normally" : "closed with error"}></li>
          )
        })}
      </ul>
      <span className="close-history-summary"
          title={`${errCount.toString()} error(s) in the lastest ${props.size} closed connection(s)`}>
        {errCount.toString()}
        <span>/{props.size}</span>
      </span>
    </div>
  );
}

function ServerDetail(props: { onDismiss: () => void, item: ServerWithThroughtput }) {
  const { server, throughput } = props.item;
  const history = BigInt(server.status.close_history);
  const history_size = Math.min(64, server.status.conn_total - server.status.conn_alive);
  return (
    <Modal onDismiss={props.onDismiss}>
      <h3 className="server-tag">{server.tag}<br />
        <small className="server-url">{format.proxyUrl(server)}</small>
      </h3>
      <div className="server-details">
        <p className="listen-ports">
          <span>Listen ports:</span>
          TCP
          <ul>{server.config.listen_ports.map(port => (
            <li>&#8203;{port}</li>
          ))}</ul>
        </p>
        <p>
          <span>Max wait:</span>
          <span>{format.humanDuration(server.config.max_wait)}</span>
        </p>
        <p>
          <span>Test target:</span>
          <span>dns+tcp://{server.config.test_dns}</span>
        </p>
        <hr/>
        <p className="score-and-delay">
          <span>Delay / score:</span>
          <span className="current-delay">{format.durationToMills(server.status.delay?.Some) || "-"}</span>
          <span className="split">/</span>
          <span>{server.status.score ? format.numberWithCommas(server.status.score) : "-"}</span>
          <span className="base-score" title="Base score">
            ({format.numberWithCommas(server.config.score_base, true)})</span>
        </p>
        <p>
          <span>Thoughput:</span><FullThroughput bw={throughput}/>
        </p>
        <p>
          <span>Connections:</span>
          {server.status.conn_alive} alive
          <span className="split">/</span>
          {server.status.conn_error} error
          <span className="split">/</span>
          {server.status.conn_total} total
        </p>
        <p className="close-history">
          <span>Close history:</span>
          <ConnectionCloseHistory history={history} size={history_size} />
        </p>
        <p>
          <span>Traffic:</span>
          Up {format.humanFileSize(server.traffic.tx_bytes)}
          <span className="split">+</span>
          Dn {format.humanFileSize(server.traffic.rx_bytes)}
          <span className="split">=</span>
          {format.humanFileSize(server.traffic.rx_bytes + server.traffic.tx_bytes)}
        </p>
      </div>
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
