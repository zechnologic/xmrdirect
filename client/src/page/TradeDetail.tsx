import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import Layout from "../components/Layout";
import WalletSetupGuide from "../components/WalletSetupGuide";
import { formatPaymentMethod } from "../utils/formatPaymentMethod";
import { API_BASE_URL } from "../config/api";

interface MultisigSession {
  id: string;
  status: "preparing" | "making" | "exchanging" | "ready";
  threshold: number;
  totalParticipants: number;
  multisigAddress?: string;
  exchangeRound: number;
  hasPrepared: {
    service: boolean;
    buyer: boolean;
    seller: boolean;
  };
  hasMade: {
    service: boolean;
    buyer: boolean;
    seller: boolean;
  };
  hasExchanged: {
    service: boolean;
    buyer: boolean;
    seller: boolean;
  };
}

interface Trade {
  id: string;
  offer_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  xmr_amount: number;
  status: "pending" | "funded" | "payment_sent" | "payment_confirmed" | "releasing" | "completed" | "disputed" | "cancelled";
  created_at: number;
  buyer_username: string;
  seller_username: string;
  offer?: {
    payment_method: string;
    currency: string;
    offer_type: string;
  };
  multisig_session?: MultisigSession | null;
}

function TradeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [checkingDeposit, setCheckingDeposit] = useState(false);
  const [depositMessage, setDepositMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token || !userData) {
      navigate("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    setCurrentUserId(parsedUser.id);

    if (id) {
      fetchTrade(id, token);
    }
  }, [id, navigate]);

  // Poll for trade updates during multisig setup
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!id || !token) return;

    // Poll every 3 seconds if multisig setup is in progress
    const shouldPoll = trade?.multisig_session?.status &&
                       ["preparing", "making", "exchanging"].includes(trade.multisig_session.status);

    if (shouldPoll) {
      const intervalId = setInterval(() => {
        fetchTrade(id, token);
      }, 3000);

      return () => clearInterval(intervalId);
    }
  }, [id, trade?.multisig_session?.status]);

  const fetchTrade = async (tradeId: string, token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/trades/${tradeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        setTrade(data.trade);
      } else {
        console.error("Trade not found");
        navigate("/account");
      }
    } catch (error) {
      console.error("Error fetching trade:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const checkDeposit = async () => {
    if (!id) return;

    setCheckingDeposit(true);
    setDepositMessage("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/trades/${id}/check-deposit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        if (data.isUnlocked) {
          setDepositMessage(`✓ Deposit confirmed! Balance: ${data.balance} XMR. Trade status updated to 'funded'.`);
          // Reload trade data
          setTimeout(() => {
            if (token) fetchTrade(id, token);
          }, 1000);
        } else if (data.hasDeposit) {
          setDepositMessage(`Deposit detected but not yet unlocked (${data.balance} XMR). Waiting for confirmations...`);
        } else {
          setDepositMessage(`No deposit detected yet. Balance: ${data.balance} XMR`);
        }
      } else {
        setDepositMessage("Error checking deposit: " + data.error);
      }
    } catch (error) {
      setDepositMessage("Error checking deposit: " + error);
    } finally {
      setCheckingDeposit(false);
    }
  };

  const markPaymentSent = async () => {
    if (!id) return;

    setActionLoading(true);
    setActionMessage("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/trades/${id}/mark-payment-sent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setActionMessage("✓ Payment marked as sent! Waiting for seller to confirm.");
        setTimeout(() => {
          if (token) fetchTrade(id, token);
        }, 1000);
      } else {
        setActionMessage("Error: " + data.error);
      }
    } catch (error) {
      setActionMessage("Error marking payment as sent: " + error);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmPayment = async () => {
    if (!id || !trade) return;

    // Prompt for seller's XMR withdrawal address
    const recipientAddress = prompt(
      "Enter your XMR address to receive the funds:\n\n" +
      `You will receive ${(trade.xmr_amount * 0.995).toFixed(8)} XMR ` +
      `(${trade.xmr_amount} - 0.5% platform fee)`
    );

    if (!recipientAddress || recipientAddress.trim() === "") {
      setActionMessage("XMR address is required to release escrow");
      return;
    }

    setActionLoading(true);
    setActionMessage("Step 1/2: Creating release transaction...");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");

      // Step 1: Initiate release (server creates unsigned transaction)
      const initiateResponse = await fetch(`${API_BASE_URL}/trades/${id}/initiate-release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientAddress }),
      });

      const initiateData = await initiateResponse.json();

      if (!initiateData.success) {
        throw new Error(initiateData.error || "Failed to initiate release");
      }

      setActionMessage("Step 2/2: Signing transaction with your wallet...");

      // Step 2: Sign with seller's browser wallet
      const { getWalletInstance } = await import("../services/moneroWallet");
      const wallet = getWalletInstance();

      const signedHex = await wallet.signMultisigTransaction(initiateData.unsignedTxHex);

      setActionMessage("Step 2/2: Finalizing release...");

      // Step 3: Finalize release (server co-signs and broadcasts)
      const finalizeResponse = await fetch(`${API_BASE_URL}/trades/${id}/finalize-release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sellerSignedHex: signedHex }),
      });

      const finalizeData = await finalizeResponse.json();

      if (finalizeData.success) {
        setActionMessage(
          `✓ Escrow released! ${initiateData.recipientReceives.toFixed(8)} XMR sent to ${recipientAddress}\n` +
          `Transaction: ${finalizeData.txHashes?.[0] || "Broadcast successful"}`
        );
        setTimeout(() => {
          if (token) fetchTrade(id, token);
        }, 2000);
      } else {
        throw new Error(finalizeData.error || "Failed to finalize release");
      }
    } catch (error) {
      setActionMessage("Error: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setActionLoading(false);
    }
  };

  const openDispute = async () => {
    if (!id || !disputeReason.trim()) {
      setActionMessage("Please provide a reason for the dispute");
      return;
    }

    setActionLoading(true);
    setActionMessage("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/trades/${id}/dispute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: disputeReason }),
      });

      const data = await response.json();

      if (data.success) {
        setActionMessage("✓ Dispute opened. An admin will review your case.");
        setShowDisputeForm(false);
        setDisputeReason("");
        setTimeout(() => {
          if (token) fetchTrade(id, token);
        }, 1000);
      } else {
        setActionMessage("Error: " + data.error);
      }
    } catch (error) {
      setActionMessage("Error opening dispute: " + error);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-600 text-white";
      case "funded":
        return "bg-blue-600 text-white";
      case "payment_sent":
        return "bg-purple-600 text-white";
      case "payment_confirmed":
        return "bg-teal-600 text-white";
      case "releasing":
        return "bg-indigo-600 text-white";
      case "disputed":
        return "bg-red-600 text-white";
      case "cancelled":
        return "bg-gray-600 text-white";
      default:
        return "bg-yellow-600 text-white";
    }
  };

  const getMultisigStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-600 text-white";
      case "exchanging":
        return "bg-yellow-600 text-white";
      case "making":
        return "bg-orange-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const getNextStepInstructions = () => {
    if (!trade || !trade.multisig_session) return null;

    const session = trade.multisig_session;
    const userRole = currentUserId === trade.buyer_id ? "buyer" : "seller";

    switch (session.status) {
      case "preparing":
        const hasUserPrepared = session.hasPrepared[userRole];
        if (!hasUserPrepared) {
          return {
            title: "Create Your Wallet",
            message: "Click 'Create New Wallet' below to generate your secure browser-based wallet and begin the multisig setup.",
            status: "warning",
          };
        }
        return {
          title: "Waiting for Other Party",
          message: "You've prepared your wallet. Waiting for the other party to prepare their wallet...",
          status: "info",
        };

      case "making":
        const hasUserMade = session.hasMade[userRole];
        if (!hasUserMade) {
          return {
            title: "Create Multisig Wallet",
            message: "All parties have prepared. Click 'Create Multisig Wallet' below to continue the setup process.",
            status: "warning",
          };
        }
        return {
          title: "Waiting for Other Party",
          message: "You've made your multisig wallet. Waiting for the other party...",
          status: "info",
        };

      case "exchanging":
        const hasUserExchanged = session.hasExchanged[userRole];
        if (!hasUserExchanged) {
          return {
            title: "Finalize Multisig Setup",
            message: "Click 'Exchange Keys' below to complete the final step of the multisig wallet setup.",
            status: "warning",
          };
        }
        return {
          title: "Waiting for Key Exchange",
          message: `You've completed the key exchange. Waiting for the other party...`,
          status: "info",
        };

      case "ready":
        if (userRole === "seller" && trade.status === "pending") {
          return {
            title: "Escrow Ready - Deposit XMR",
            message: `The escrow wallet is ready! As the seller, deposit ${trade.xmr_amount.toFixed(8)} XMR to the escrow address below to begin the trade.`,
            status: "success",
          };
        } else if (userRole === "buyer" && trade.status === "pending") {
          return {
            title: "Escrow Ready - Waiting for Seller",
            message: "The escrow wallet is ready! Waiting for the seller to deposit XMR...",
            status: "info",
          };
        } else if (trade.status === "funded") {
          if (userRole === "buyer") {
            return {
              title: "Send Payment",
              message: `The seller has deposited XMR to escrow. Now send ${trade.amount.toLocaleString()} ${trade.offer?.currency} via ${trade.offer?.payment_method ? formatPaymentMethod(trade.offer.payment_method) : 'the specified payment method'} to the seller, then mark payment as sent.`,
              status: "warning",
            };
          } else {
            return {
              title: "Waiting for Buyer Payment",
              message: `You've deposited XMR to escrow. Waiting for the buyer to send ${trade.amount.toLocaleString()} ${trade.offer?.currency}...`,
              status: "info",
            };
          }
        } else if (trade.status === "payment_sent") {
          if (userRole === "seller") {
            return {
              title: "Confirm Payment Received",
              message: `The buyer has marked payment as sent. Verify you received ${trade.amount.toLocaleString()} ${trade.offer?.currency}, then confirm receipt to release escrow.`,
              status: "warning",
            };
          } else {
            return {
              title: "Waiting for Seller Confirmation",
              message: "Payment marked as sent. Waiting for seller to confirm receipt...",
              status: "info",
            };
          }
        } else if (trade.status === "payment_confirmed") {
          return {
            title: "Escrow Release Pending",
            message: "Payment confirmed! Seller is releasing escrow (2-of-3 multisig - no admin needed).",
            status: "success",
          };
        } else if (trade.status === "releasing") {
          return {
            title: "Releasing Escrow",
            message: "Escrow funds are being released. Transaction is being signed and broadcast...",
            status: "success",
          };
        } else if (trade.status === "completed") {
          return {
            title: "Trade Complete",
            message: "This trade has been completed successfully!",
            status: "success",
          };
        } else if (trade.status === "disputed") {
          return {
            title: "Dispute Under Review",
            message: "A dispute has been opened for this trade. An admin will review and resolve the case.",
            status: "warning",
          };
        }
    }

    return null;
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen pt-40 px-4 bg-[#232323] text-orange-600">
          <div className="text-center">Loading trade...</div>
        </div>
      </Layout>
    );
  }

  if (!trade) {
    return (
      <Layout>
        <div className="min-h-screen pt-40 px-4 bg-[#232323] text-orange-600">
          <div className="text-center">Trade not found</div>
        </div>
      </Layout>
    );
  }

  const userRole = currentUserId === trade.buyer_id ? "buyer" : "seller";
  const counterparty = userRole === "buyer" ? trade.seller_username : trade.buyer_username;
  const nextStep = getNextStepInstructions();

  return (
    <Layout>
      <div className="min-h-screen pt-24 px-4 bg-[#232323] text-orange-600">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-3xl mb-2">Trade Details</h2>
              <p className="text-gray-400">
                Trade ID: <span className="font-mono text-sm">{trade.id}</span>
              </p>
            </div>
            <span className={`px-4 py-2 text-sm font-semibold uppercase ${getStatusColor(trade.status)}`}>
              {trade.status}
            </span>
          </div>

          {/* Next Step Alert */}
          {nextStep && (
            <div
              className={`mb-6 p-6 border-2 ${
                nextStep.status === "warning"
                  ? "bg-orange-900/20 border-orange-600"
                  : nextStep.status === "success"
                  ? "bg-green-900/20 border-green-600"
                  : "bg-blue-900/20 border-blue-600"
              }`}
            >
              <h3 className="font-semibold text-xl mb-2">{nextStep.title}</h3>
              <p className="text-gray-300">{nextStep.message}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trade Information */}
            <div className="space-y-6">
              <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                <h3 className="text-xl font-semibold mb-4">Trade Information</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-400">Your Role: </span>
                    <span className="font-semibold uppercase">{userRole}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Trading with: </span>
                    <Link
                      to={`/user/${counterparty}`}
                      className="font-semibold hover:text-orange-500 transition-colors"
                    >
                      {counterparty}
                    </Link>
                  </div>
                  <div>
                    <span className="text-gray-400">Amount: </span>
                    <span className="font-semibold">
                      {trade.amount.toLocaleString()} {trade.offer?.currency || ""}
                    </span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="font-semibold">
                      {trade.xmr_amount.toFixed(8)} XMR
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Payment Method: </span>
                    <span className="font-semibold">{trade.offer?.payment_method ? formatPaymentMethod(trade.offer.payment_method) : "Unknown"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Created: </span>
                    <span className="font-semibold">{formatDate(trade.created_at)}</span>
                  </div>
                  <div className="pt-3 border-t border-orange-600/30">
                    <Link to={`/ad/${trade.offer_id}`}>
                      <button className="w-full px-4 py-2 bg-gray-700 text-white hover:bg-gray-600 transition-colors font-semibold text-sm">
                        View Original Offer
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Escrow Status */}
            <div className="space-y-6">
              {trade.multisig_session ? (
                <>
                  <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold">Escrow Status</h3>
                      <span
                        className={`px-3 py-1 text-xs font-semibold uppercase ${getMultisigStatusColor(
                          trade.multisig_session.status
                        )}`}
                      >
                        {trade.multisig_session.status}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Configuration */}
                      <div className="text-sm">
                        <span className="text-gray-400">Configuration: </span>
                        <span className="font-semibold">
                          {trade.multisig_session.threshold}-of-{trade.multisig_session.totalParticipants} multisig
                        </span>
                      </div>

                      {/* Escrow Address */}
                      {trade.multisig_session.multisigAddress && (
                        <div className="bg-[#232323] border border-orange-600/50 p-4">
                          <div className="text-sm text-gray-400 mb-2">Escrow Address:</div>
                          <div className="font-mono text-xs text-gray-300 break-all">
                            {trade.multisig_session.multisigAddress}
                          </div>
                        </div>
                      )}

                      {/* Setup Progress */}
                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-gray-400 uppercase">Setup Progress</div>

                        {/* Preparing Phase */}
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              trade.multisig_session.hasPrepared.service &&
                              trade.multisig_session.hasPrepared.buyer &&
                              trade.multisig_session.hasPrepared.seller
                                ? "bg-green-600 text-white"
                                : "bg-gray-600 text-gray-300"
                            }`}
                          >
                            1
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold">Prepare Wallets</div>
                            <div className="text-xs text-gray-400">
                              Service: {trade.multisig_session.hasPrepared.service ? "✓" : "..."} | Buyer:{" "}
                              {trade.multisig_session.hasPrepared.buyer ? "✓" : "..."} | Seller:{" "}
                              {trade.multisig_session.hasPrepared.seller ? "✓" : "..."}
                            </div>
                          </div>
                        </div>

                        {/* Making Phase */}
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              trade.multisig_session.hasMade.service &&
                              trade.multisig_session.hasMade.buyer &&
                              trade.multisig_session.hasMade.seller
                                ? "bg-green-600 text-white"
                                : "bg-gray-600 text-gray-300"
                            }`}
                          >
                            2
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold">Make Multisig</div>
                            <div className="text-xs text-gray-400">
                              Service: {trade.multisig_session.hasMade.service ? "✓" : "..."} | Buyer:{" "}
                              {trade.multisig_session.hasMade.buyer ? "✓" : "..."} | Seller:{" "}
                              {trade.multisig_session.hasMade.seller ? "✓" : "..."}
                            </div>
                          </div>
                        </div>

                        {/* Exchanging Phase */}
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              trade.multisig_session.hasExchanged.service &&
                              trade.multisig_session.hasExchanged.buyer &&
                              trade.multisig_session.hasExchanged.seller
                                ? "bg-green-600 text-white"
                                : "bg-gray-600 text-gray-300"
                            }`}
                          >
                            3
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold">Exchange Keys</div>
                            <div className="text-xs text-gray-400">
                              Service: {trade.multisig_session.hasExchanged.service ? "✓" : "..."} | Buyer:{" "}
                              {trade.multisig_session.hasExchanged.buyer ? "✓" : "..."} | Seller:{" "}
                              {trade.multisig_session.hasExchanged.seller ? "✓" : "..."}
                            </div>
                          </div>
                        </div>

                        {/* Ready */}
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              trade.multisig_session.status === "ready"
                                ? "bg-green-600 text-white"
                                : "bg-gray-600 text-gray-300"
                            }`}
                          >
                            ✓
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold">Escrow Ready</div>
                            <div className="text-xs text-gray-400">
                              {trade.multisig_session.status === "ready"
                                ? "Wallet is ready for deposits"
                                : "Waiting for setup to complete"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Setup Guide */}
                  {trade.multisig_session.status !== "ready" && currentUserId && (
                    <WalletSetupGuide
                      tradeId={trade.id}
                      sessionId={trade.multisig_session.id}
                      currentPhase={trade.multisig_session.status}
                      userRole={userRole as "buyer" | "seller"}
                      userId={currentUserId}
                      hasPrepared={trade.multisig_session.hasPrepared[userRole as "buyer" | "seller"]}
                      hasMade={trade.multisig_session.hasMade[userRole as "buyer" | "seller"]}
                      hasExchanged={trade.multisig_session.hasExchanged[userRole as "buyer" | "seller"]}
                      exchangeRound={trade.multisig_session.exchangeRound}
                      totalRounds={trade.multisig_session.totalParticipants - trade.multisig_session.threshold + 1}
                    />
                  )}

                  {/* Deposit Check */}
                  {trade.multisig_session.status === "ready" && trade.status === "pending" && (
                    <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                      <h3 className="text-xl font-semibold mb-4">Check Deposit Status</h3>
                      <p className="text-gray-300 text-sm mb-4">
                        {userRole === "seller"
                          ? "Deposit the XMR to the escrow address above, then click the button below to verify the deposit."
                          : "Waiting for the seller to deposit XMR to escrow. Click the button below to check the current status."}
                      </p>
                      <button
                        onClick={checkDeposit}
                        disabled={checkingDeposit}
                        className="w-full px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold disabled:opacity-50"
                      >
                        {checkingDeposit ? "Checking deposit status..." : "Check Deposit Status"}
                      </button>
                      {depositMessage && (
                        <div
                          className={`mt-4 p-3 text-sm ${
                            depositMessage.includes("Error")
                              ? "bg-red-900/20 border border-red-600"
                              : depositMessage.includes("✓")
                              ? "bg-green-900/20 border border-green-600"
                              : "bg-blue-900/20 border border-blue-600"
                          }`}
                        >
                          {depositMessage}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Actions */}
                  {trade.status === "funded" && userRole === "buyer" && (
                    <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                      <h3 className="text-xl font-semibold mb-4">Mark Payment Sent</h3>
                      <p className="text-gray-300 text-sm mb-4">
                        After you've sent {trade.amount.toLocaleString()} {trade.offer?.currency} via {trade.offer?.payment_method ? formatPaymentMethod(trade.offer.payment_method) : 'the specified payment method'} to the seller, click the button below to mark payment as sent.
                      </p>
                      <button
                        onClick={markPaymentSent}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
                      >
                        {actionLoading ? "Processing..." : "I Have Sent Payment"}
                      </button>
                    </div>
                  )}

                  {trade.status === "payment_sent" && userRole === "seller" && (
                    <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                      <h3 className="text-xl font-semibold mb-4">Confirm Payment & Release Escrow</h3>
                      <p className="text-gray-300 text-sm mb-4">
                        Verify that you received {trade.amount.toLocaleString()} {trade.offer?.currency} from the buyer.
                        Clicking below will:
                      </p>
                      <ul className="text-gray-300 text-sm mb-4 list-disc list-inside space-y-1">
                        <li>Prompt you for your XMR withdrawal address</li>
                        <li>Sign the release transaction with your wallet</li>
                        <li>Send {(trade.xmr_amount * 0.995).toFixed(8)} XMR to you (0.5% platform fee)</li>
                        <li>Complete the trade automatically (no admin needed!)</li>
                      </ul>
                      <button
                        onClick={confirmPayment}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
                      >
                        {actionLoading ? "Processing..." : "✓ Confirm Payment & Release Escrow"}
                      </button>
                    </div>
                  )}

                  {/* Action Messages */}
                  {actionMessage && (
                    <div
                      className={`bg-[#2a2a2a] border p-6 ${
                        actionMessage.includes("Error")
                          ? "border-red-600"
                          : "border-green-600"
                      }`}
                    >
                      <p
                        className={`text-sm ${
                          actionMessage.includes("Error") ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {actionMessage}
                      </p>
                    </div>
                  )}

                  {/* Dispute Section */}
                  {trade.status !== "completed" && trade.status !== "disputed" && trade.status !== "cancelled" && (
                    <div className="bg-[#2a2a2a] border border-red-600 p-6">
                      <h3 className="text-xl font-semibold mb-4 text-red-400">Open Dispute</h3>
                      {!showDisputeForm ? (
                        <>
                          <p className="text-gray-300 text-sm mb-4">
                            Having issues with this trade? Open a dispute and an admin will review the case.
                          </p>
                          <button
                            onClick={() => setShowDisputeForm(true)}
                            className="w-full px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors font-semibold"
                          >
                            Open Dispute
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-300 text-sm mb-4">
                            Describe the issue with this trade. An administrator will review your case.
                          </p>
                          <textarea
                            value={disputeReason}
                            onChange={(e) => setDisputeReason(e.target.value)}
                            placeholder="Explain the reason for this dispute..."
                            className="w-full px-3 py-2 bg-[#232323] border border-red-600 text-white text-sm focus:outline-none focus:border-red-500 resize-vertical mb-4"
                            rows={4}
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={openDispute}
                              disabled={actionLoading || !disputeReason.trim()}
                              className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors font-semibold disabled:opacity-50"
                            >
                              {actionLoading ? "Submitting..." : "Submit Dispute"}
                            </button>
                            <button
                              onClick={() => {
                                setShowDisputeForm(false);
                                setDisputeReason("");
                              }}
                              className="flex-1 px-4 py-2 bg-gray-700 text-white hover:bg-gray-600 transition-colors font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                  <h3 className="text-xl font-semibold mb-4">Escrow Status</h3>
                  <p className="text-gray-400">No escrow session linked to this trade.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default TradeDetail;
