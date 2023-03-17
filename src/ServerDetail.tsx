import React, { useCallback } from "react";

import { useDocumentEventListener, FullThroughput } from "./App";
import { ServerWithThroughtput } from "./backend";
import * as format from "./formatUtils";

type ModalProps = { onDismiss: () => void; children: React.ReactNode };
const Modal = ({ onDismiss, children }: ModalProps) => {
  const keyDownCallback = useCallback((e: KeyboardEvent) => e.keyCode === 27 && onDismiss(), [
    onDismiss,
  ]);
  useDocumentEventListener("keydown", keyDownCallback);
  return (
    <div className="modal" role="dialog" onClick={onDismiss}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {children}
        <button className="action-close" onClick={onDismiss} autoFocus>
          CLOSE
        </button>
      </div>
    </div>
  );
};

function bitCount(n: bigint) {
  // Hamming weight
  n = n - ((n >> 1n) & 0x5555555555555555n);
  n = (n & 0x3333333333333333n) + ((n >> 2n) & 0x3333333333333333n);
  n = (((n + (n >> 4n)) & 0xf0f0f0f0f0f0f0fn) * 0x101010101010101n) >> 56n;
  return BigInt.asUintN(8, n);
}

type ConnectionCloseHistoryProps = { history: bigint; size: number };
const ConnectionCloseHistory = ({
  history,
  size,
}: ConnectionCloseHistoryProps) => {
  const errCount = bitCount(history);
  return (
    <div>
      <ul className="close-history-diagram">
        {Array.from({ length: size }, (_, i) => {
          const ok = ((history >> BigInt(i)) & 0x01n) === 0n;
          return (
            <li
              key={i}
              className={ok ? "close-ok" : "close-err"}
              title={ok ? "closed normally" : "closed with error"}
            ></li>
          );
        })}
      </ul>
      <span
        className="close-history-summary"
        title={`${errCount.toString()} error(s) in the lastest ${size} closed connection(s)`}
      >
        {errCount.toString()}
        <span>/{size}</span>
      </span>
    </div>
  );
};

type ServerDetailProps = { onDismiss: () => void; item: ServerWithThroughtput };
const ServerDetail = ({
  onDismiss,
  item: { server, throughput },
}: ServerDetailProps) => {
  const history = BigInt(server.status.close_history);
  const history_size = Math.min(
    64,
    server.status.conn_total - server.status.conn_alive
  );
  const errorConnRate = (
    (server.status.conn_error / server.status.conn_total) *
    100
  ).toFixed(1);
  return (
    <Modal onDismiss={onDismiss}>
      <h3 className="server-tag">
        {server.tag}
        <br />
        <small className="server-url">{format.proxyUrl(server)}</small>
      </h3>
      <div className="server-details">
        { server.config.capabilities.length > 0 &&
          <div className="capabilities">
            <span>Capabilities</span>
            <ul>
              {server.config.capabilities.map((cap) => (
                <li key={cap}>{cap} </li>
              ))}
            </ul>
          </div>
        }
        <div>
          <span>Max wait</span>
          <span>{format.humanDuration(server.config.max_wait)}</span>
        </div>
        <div>
          <span>Test target</span>
          <span>dns+tcp://{server.config.test_dns}</span>
        </div>
        <hr />
        <div className="score-and-delay">
          <span>Delay / score</span>
          <span className="current-delay">
            {format.durationToMills(server.status.delay?.Some) || "-"}
          </span>
          <span className="split">/</span>
          <span>
            {server.status.score
              ? format.numberWithCommas(server.status.score)
              : "-"}
          </span>
          <span className="base-score" title="Base score">
            ({format.numberWithCommas(server.config.score_base, true)})
          </span>
        </div>
        <div className="throughput">
          <span>Thoughput</span>
          <FullThroughput bw={throughput} />
        </div>
        <div>
          <span>Connections</span>
          {format.numberWithCommas(server.status.conn_alive)} alive
          <span className="split">/</span>
          {format.numberWithCommas(server.status.conn_error)} ({errorConnRate}%)
          error
          <span className="split">/</span>
          {format.numberWithCommas(server.status.conn_total)} total
        </div>
        <div className="close-history">
          <span>Close history</span>
          <ConnectionCloseHistory history={history} size={history_size} />
        </div>
        <div>
          <span>Traffic</span>
          Up {format.humanFileSize(server.traffic.tx_bytes)}
          <span className="split">+</span>
          Dn {format.humanFileSize(server.traffic.rx_bytes)}
          <span className="split">=</span>
          {format.humanFileSize(
            server.traffic.rx_bytes + server.traffic.tx_bytes
          )}
        </div>
      </div>
    </Modal>
  );
};
export default ServerDetail;
