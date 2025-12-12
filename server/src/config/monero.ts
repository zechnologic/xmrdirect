import moneroTs from "monero-ts";

/**
 * Centralized Monero network configuration
 * Set MONERO_NETWORK=stagenet or MONERO_NETWORK=mainnet in .env
 */

export type MoneroNetwork = "mainnet" | "stagenet";

const NETWORK = (process.env.MONERO_NETWORK || "stagenet") as MoneroNetwork;

export const MONERO_CONFIG = {
  network: NETWORK,
  networkType:
    NETWORK === "stagenet"
      ? moneroTs.MoneroNetworkType.STAGENET
      : moneroTs.MoneroNetworkType.MAINNET,
  nodeUri:
    NETWORK === "stagenet"
      ? "https://stagenet.xmr.ditatompel.com"
      : "http://node.sethforprivacy.com:18089",
  confirmations: NETWORK === "stagenet" ? 2 : 10, // Lower confirmations for stagenet testing
} as const;

console.log(`[Monero Config] Network: ${MONERO_CONFIG.network.toUpperCase()}`);
console.log(`[Monero Config] Node: ${MONERO_CONFIG.nodeUri}`);
console.log(`[Monero Config] Required confirmations: ${MONERO_CONFIG.confirmations}`);
