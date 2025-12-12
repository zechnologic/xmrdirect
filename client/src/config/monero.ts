import moneroTs from "monero-ts";

/**
 * Centralized Monero network configuration for client
 * Uses Vite environment variables (VITE_MONERO_NETWORK)
 */

export type MoneroNetwork = "mainnet" | "stagenet";

const NETWORK = (import.meta.env.VITE_MONERO_NETWORK || "stagenet") as MoneroNetwork;

export const MONERO_CONFIG = {
  network: NETWORK,
  networkType:
    NETWORK === "stagenet"
      ? moneroTs.MoneroNetworkType.STAGENET
      : moneroTs.MoneroNetworkType.MAINNET,
  nodeUri:
    NETWORK === "stagenet"
      ? "http://node.monerodevs.org:38089"
      : "http://node.sethforprivacy.com:18089",
} as const;

console.log(`[Monero Config] Network: ${MONERO_CONFIG.network.toUpperCase()}`);
console.log(`[Monero Config] Node: ${MONERO_CONFIG.nodeUri}`);
