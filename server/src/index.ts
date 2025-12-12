import "dotenv/config";
import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import moneroTs from "monero-ts";
import multisigRouter from "./routes/multisig.js";
import signupRouter from "./routes/signup.js";
import loginRouter from "./routes/login.js";
import offersRouter from "./routes/offers.js";
import tradesRouter from "./routes/trades.js";
import usersRouter from "./routes/users.js";
import adminRouter from "./routes/admin.js";
import walletRouter from "./routes/wallet.js";
import { startDepositMonitor } from "./services/depositMonitor.js";
import { recalculateAllUserReputations } from "./db.js";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Register API routes
app.use(signupRouter);
app.use(loginRouter);
app.use(offersRouter);
app.use(tradesRouter);
app.use(usersRouter);
app.use(adminRouter);
app.use(multisigRouter);
app.use(walletRouter);

app.use(express.static(path.join(__dirname, "../../client/dist")));

// Handle all routes by serving index.html (SPA fallback)
app.use((req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Recalculate user reputations on startup (for migration and data integrity)
  console.log("Recalculating user reputations...");
  recalculateAllUserReputations();

  // Start monitoring deposits for trades
  startDepositMonitor();
});

// main();
// async function main() {
//   console.log(
//     "Sample app using monero-ts v" + moneroTs.MoneroUtils.getVersion()
//   );
//   const daemonUri = "https://node.sethforprivacy.com:443";

//   // connect to a daemon
//   console.log("Connecting to daemon");
//   let daemon = await moneroTs.connectToDaemonRpc(daemonUri);
//   const height = await daemon.getHeight();
//   console.log("Daemon height: " + height);

//   // create wallet from seed phrase using WebAssembly bindings to monero-project
//   console.log("Creating wallet from seed phrase");
//   let walletFull = await moneroTs.createWalletFull({
//     password: "supersecretpassword123",
//     networkType: moneroTs.MoneroNetworkType.MAINNET,
//     seed: "fruit utensils auburn nabbing huts hexagon espionage fainted oxygen tattoo azure dash phase opened rotate owner grunt happens usage velvet rhythm deepest utensils velvet rotate",
//     restoreHeight: height - 1000,
//     server: {
//       uri: daemonUri,
//     },
//   });

//   // synchronize with progress notifications
//   console.log("Synchronizing wallet");
//   await walletFull.sync(
//     new (class extends moneroTs.MoneroWalletListener {
//       async onSyncProgress(
//         height: number,
//         startHeight: number,
//         endHeight: number,
//         percentDone: number,
//         message: string
//       ) {
//         // feed a progress bar?
//       }
//     })()
//   );

//   // synchronize in the background
//   await walletFull.startSyncing(20000);

//   // listen for incoming transfers
//   let fundsReceived = false;
//   await walletFull.addListener(
//     new (class extends moneroTs.MoneroWalletListener {
//       async onOutputReceived(output: moneroTs.MoneroOutputWallet) {
//         let amount = output.getAmount();
//         let txHash = output.getTx().getHash();
//         fundsReceived = true;
//       }
//     })()
//   );

//   // close wallets
//   console.log("Closing wallets");
//   await walletFull.close();
//   console.log("Done running XMR sample app");
//   return true;
// }
