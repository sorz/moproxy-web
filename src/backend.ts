import { useState, useEffect, useRef } from "react";

type Option<T> = null | { Some: T };

interface HttpProto {
  HTTP: {
    connect_with_payload: boolean;
  };
}

interface SocksV5Proto {
  SOCKSv5: {
    fake_handshaking: boolean;
  };
}

export interface Throughput {
  tx_bps: number;
  rx_bps: number;
}

export interface Duration {
  secs: number;
  nanos: number;
}

interface Traffic {
  tx_bytes: number;
  rx_bytes: number;
}

interface ServerConfig {
  test_dns: string;
  max_wait: Duration;
  capabilities: [string];
  score_base: number;
}

interface ServerStatus {
  delay: Option<Duration>;
  score: number;
  conn_alive: number;
  conn_total: number;
  conn_error: number;
  close_history: number;
}

export interface Server {
  addr: string;
  proto: SocksV5Proto | HttpProto;
  tag: string;
  config: ServerConfig;
  status: ServerStatus;
  traffic: Traffic;
}

export interface ServerWithThroughtput {
  server: Server;
  throughput: Throughput;
}

interface MoproxyStatus {
  servers: [ServerWithThroughtput];
  uptime: Duration;
  throughput: Throughput;
}

export function useMoproxyStatus() {
  const [status, setStatus] = useState<MoproxyStatus>();
  const [updateAt, setUpdateAt] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const refIsLoading = useRef(isLoading);
  refIsLoading.current = isLoading;

  useEffect(() => {
    if (refIsLoading.current) return;
    const fetchStatus = async () => {
      setIsError(false);
      setIsLoading(true);
      refIsLoading.current = true;
      try {
        const uri = process.env.REACT_APP_STATUS_URI || "status";
        const resp = await fetch(uri);
        setStatus(await resp.json());
      } catch (err) {
        setIsError(true);
      } finally {
        setIsLoading(false);
        refIsLoading.current = false;
      }
    };
    fetchStatus();
  }, [updateAt]);

  return { status, isLoading, isError, setUpdateAt };
}

export function useMoproxyVersion() {
  const [version, setVersion] = useState<string>();
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const uri = process.env.REACT_APP_VERSION_URI || "version";
        const resp = await fetch(uri);
        setVersion(await resp.text());
      } catch (err) {
        console.warn("fail to fetch moproxy version", err);
        setVersion(undefined);
      }
    };
    fetchStatus();
  }, []);
  return version;
}
