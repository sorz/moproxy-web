import React, { useState, useEffect, useRef, useCallback } from "react";
import createPersistedState from "use-persisted-state";
import deepEqual from "deep-equal";

import {
  Throughput,
  ServerWithThroughtput,
  useMoproxyStatus,
  useMoproxyVersion,
} from "./backend";
import ServerDetail from "./ServerDetail";

import * as format from "./formatUtils";

const useShowFullTraffic = createPersistedState("show-full-traffic");
const useAutoRefresh = createPersistedState("set-auto-refresh");

export function useDocumentEventListener<K extends keyof DocumentEventMap>(
  event: K,
  callback: (event: DocumentEventMap[K]) => void
) {
  useEffect(() => {
    document.addEventListener(event, callback);
    return () => document.removeEventListener(event, callback);
  }, [event, callback]);
}

function useDocumentVisibility() {
  const [hidden, setHidden] = useState(document.hidden);
  const onChangeCallback = useCallback(() => setHidden(document.hidden), []);
  useDocumentEventListener("visibilitychange", onChangeCallback);
  return hidden;
}

type FullThroughputProps = { bw: Throughput };
export const FullThroughput = ({ bw }: FullThroughputProps) => (
  <>
    <span title="upload">↑</span>&nbsp;
    <span className="tx-speed">
      <ThroughputSpan bps={bw.tx_bps} />
    </span>
    &nbsp;
    <span title="download">↓</span>&nbsp;
    <span className="rx-speed">
      <ThroughputSpan bps={bw.rx_bps} />
    </span>
  </>
);

type ServerRowProps = {
  server: ServerWithThroughtput;
  onClick: (item: ServerWithThroughtput) => void;
  showFullTraffic: boolean;
  selected: boolean;
};
const ServerRow = ({
  server: { server, throughput },
  onClick,
  showFullTraffic,
  selected,
}: ServerRowProps) => {
  const url = format.proxyUrl(server);
  const totalThroughput = throughput.tx_bps + throughput.rx_bps;
  const columnThouughput = totalThroughput ? (
    <ThroughputSpan bps={totalThroughput} />
  ) : (
    <></>
  );

  return (
    <tr className={selected ? "selected" : ""}>
      <td>
        <button title={url} onClick={() => onClick({ server, throughput })}>
          {server.tag}
        </button>
      </td>
      <td>
        <span title="based on average delay or custom method">
          {server.status.score || "-"}
        </span>
      </td>
      <td>
        <span title="TCP handshake included">
          {format.durationToMills(server.status.delay?.Some) || "-"}
        </span>
      </td>
      <td>
        <span title="# current connections">
          {format.humanQuantity(server.status.conn_alive)}
        </span>{" "}
        /&nbsp;
        <span title="# total connections">
          {format.humanQuantity(server.status.conn_total)}
        </span>
      </td>
      <td>
        {showFullTraffic ? (
          <>
            <span title="total sent">
              <ColorfulFileSize bytes={server.traffic.tx_bytes} />
            </span>{" "}
            /&nbsp;
            <span title="total received">
              <ColorfulFileSize bytes={server.traffic.rx_bytes} />
            </span>
          </>
        ) : (
          <>
            <span title="total traffic">
              <ColorfulFileSize
                bytes={server.traffic.tx_bytes + server.traffic.rx_bytes}
              />
            </span>
          </>
        )}
      </td>
      <td>
        <span title="throughput">{columnThouughput}</span>
      </td>
    </tr>
  );
};

type TrafficSwitchProps = { full: boolean; onChange: (full: boolean) => void };
const TrafficSwitch = ({ full, onChange }: TrafficSwitchProps) => (
  <button onClick={() => onChange(!full)}>
    {full ? "Up / Down" : "Traffic"}
  </button>
);

type ThroughputSpanProps = { bps: number };
const ThroughputSpan = ({ bps }: ThroughputSpanProps) => {
  if (bps === 0) return <span className="throughput">-</span>;
  const i = Math.floor(Math.log(bps) / Math.log(1000));
  const value = bps / Math.pow(1000, i);
  const prefix = " kMGTP"[i];

  return (
    <span className="throughput">
      {value.toFixed(i === 0 ? 0 : 1)}
      <span className="unit-prefix">{prefix}</span>
      <span className="unit">bps</span>
    </span>
  );
};

type ColorfulFileSizeProps = { bytes: number };
const ColorfulFileSize = ({ bytes }: ColorfulFileSizeProps) => {
  if (bytes <= 0) return <>0</>;
  if (bytes <= 1024) return <>1</>;
  const kbytes = bytes / 1024;
  const log1024 = Math.log(kbytes) / Math.log(1024);
  let i = Math.floor(log1024);
  if (log1024 - i < Math.log(100) / Math.log(1024) && i > 0) {
    i -= 1;
  }
  const val = Math.round(kbytes / Math.pow(1024, i));
  const unit = i < 1 ? "" : "MGTPEZY"[i - 1];

  if (Math.log10(val) < 3) {
    return (
      <span className={`filesize unit-${unit}`}>
        {val.toFixed()}
        {unit}
      </span>
    );
  } else {
    const valHead = Math.floor(val / 1000);
    const valTail = val - valHead * 1000;
    const headUnit = "MGTPEZY"[i];
    return (
      <span className={`filesize unit-${unit}`}>
        <span className={`filesize unit-${headUnit}`}>{valHead.toFixed()}</span>
        {valTail.toFixed().padStart(3, "0")}
        {unit}
      </span>
    );
  }
};

type ServerTableProps = { servers: [ServerWithThroughtput] };
const ServerTable = ({ servers }: ServerTableProps) => {
  const [showFullTraffic, setShowFullTraffic] = useShowFullTraffic(true);
  const [selectedServer, setSelectedServer] = useState<ServerWithThroughtput>();
  const refSelectedServerTag = useRef(selectedServer?.server.tag);
  const refServers = useRef(servers);
  refSelectedServerTag.current = selectedServer?.server.tag;
  refServers.current = servers;

  const findServerByTag = useCallback(
    (tag: string) => refServers.current?.find((s) => s.server.tag === tag),
    []
  );

  if (selectedServer) {
    const updated = findServerByTag(selectedServer.server.tag);
    if (updated && !deepEqual(selectedServer, updated))
      setSelectedServer(updated);
  }
  const dismiss = useCallback(() => pushSelectedServer(undefined), []);

  // Keyboard shortcut
  const onKeyDownCallback = useCallback((e: KeyboardEvent) => {
    if (!refSelectedServerTag.current) return;
    const keyPrev = new Set(["ArrowUp", "k"]);
    const keyNext = new Set(["ArrowDown", "j"]);

    if (!keyPrev.has(e.key) && !keyNext.has(e.key)) return;
    const origIdx = refServers.current.findIndex(
      (s) => s.server.tag === refSelectedServerTag.current
    );
    if (origIdx === -1) return;
    const newIdx = origIdx + (keyPrev.has(e.key) ? -1 : 1);
    if (newIdx < 0 || newIdx >= refServers.current.length) return;
    pushSelectedServer(refServers.current[newIdx]);
    e.stopPropagation();
    e.preventDefault();
  }, []);
  useDocumentEventListener("keydown", onKeyDownCallback);

  // History management
  function pushSelectedServer(server: ServerWithThroughtput | undefined) {
    if (server === undefined) {
      window.history.pushState("", "", ".");
    } else {
      const tag = server.server.tag;
      window.history.pushState(tag, "", `#${tag}`);
    }
    setSelectedServer(server);
  }

  const tagOnUrl = window.location.hash.slice(1);
  if (tagOnUrl && !selectedServer) {
    setSelectedServer(findServerByTag(tagOnUrl));
  }

  const onPopStateCallback = useCallback(
    (event: PopStateEvent) => {
      const tag = event.state as string;
      const server = findServerByTag(tag);
      setSelectedServer(server);
    },
    [findServerByTag]
  );
  useEffect(() => {
    window.addEventListener("popstate", onPopStateCallback);
    return () => window.removeEventListener("popstate", onPopStateCallback);
  }, [onPopStateCallback]);

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Server</th>
            <th>Score</th>
            <th>Delay</th>
            <th>CUR / TTL</th>
            <th>
              <TrafficSwitch
                full={!!showFullTraffic}
                onChange={(full) => setShowFullTraffic(full)}
              />
            </th>
            <th>⇅</th>
          </tr>
        </thead>
        <tbody id="servers">
          {servers.map((s) => (
            <ServerRow
              server={s}
              key={s.server.tag}
              showFullTraffic={!!showFullTraffic}
              onClick={pushSelectedServer}
              selected={selectedServer?.server.tag === s.server.tag}
            />
          ))}
        </tbody>
      </table>
      {selectedServer && (
        <ServerDetail item={selectedServer} onDismiss={dismiss} />
      )}
    </>
  );
};

type IntervalProps = { millis: number; onTick: () => void };
const Interval = ({ millis, onTick }: IntervalProps) => {
  useEffect(() => {
    const id = setInterval(onTick, millis);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [millis]);
  return <></>;
};

type RefreshControlProps = { isLoading: boolean; onRefresh: () => void };
const RefreshControl = ({ isLoading, onRefresh }: RefreshControlProps) => {
  const [autoRefresh, setAutoRefresh] = useAutoRefresh(true);
  const hidden = useDocumentVisibility();

  function autoRefreshOnChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAutoRefresh(event.target.checked);
  }

  return (
    <>
      <button id="refresh" disabled={isLoading} onClick={onRefresh}>
        Refresh
      </button>
      &nbsp;
      <input
        id="auto-refresh"
        type="checkbox"
        checked={!!autoRefresh}
        onChange={autoRefreshOnChange}
      />
      &nbsp;
      <label htmlFor="auto-refresh">auto</label>
      {autoRefresh && !hidden && <Interval millis={1000} onTick={onRefresh} />}
    </>
  );
};

function App() {
  const version = useMoproxyVersion();
  const { status, isLoading, isError, setUpdateAt } = useMoproxyStatus();

  const totalAliveConns =
    status == null
      ? 0
      : status.servers.reduce((c, s) => c + s.server.status.conn_alive, 0);

  function refresh() {
    setUpdateAt(Date.now());
  }

  return (
    <>
      <h1>moproxy</h1>
      <p>
        moproxy {version && `(${version})`} is running.&nbsp;
        {status?.uptime && format.humanDuration(status.uptime)}.&nbsp;
        {isError && <span title="error on refresh status">[offline]</span>}
      </p>
      <RefreshControl isLoading={isLoading} onRefresh={refresh} />
      <h2>Proxy servers</h2>
      <p>
        Connections:{" "}
        <span id="total-alive-conn">
          {status && format.numberWithCommas(totalAliveConns)}
        </span>
        &nbsp; Throughput: {status && <FullThroughput bw={status.throughput} />}
      </p>
      {status?.servers && <ServerTable servers={status?.servers} />}
    </>
  );
}

export default App;
