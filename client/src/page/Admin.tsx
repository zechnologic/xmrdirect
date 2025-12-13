import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import Layout from "../components/Layout";
import { formatPaymentMethod } from "../utils/formatPaymentMethod";
import { API_BASE_URL } from "../config/api";

interface Trade {
  id: string;
  offer_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  xmr_amount: number;
  status: string;
  multisig_session_id: string | null;
  created_at: number;
  updated_at: number;
  buyer_username: string;
  seller_username: string;
  offer?: {
    payment_method: string;
    currency: string;
    price_per_xmr: number;
  };
}

interface Stats {
  total_trades: number;
  trades_by_status: { status: string; count: number }[];
  total_fiat_volume: number;
  total_xmr_volume: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [escrowRecipient, setEscrowRecipient] = useState("seller");
  const [recipientAddress, setRecipientAddress] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      // Fetch trades
      const tradesResponse = await fetch(`${API_BASE_URL}/admin/trades`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (tradesResponse.status === 403) {
        setError("Access denied. Admin privileges required.");
        setLoading(false);
        return;
      }

      const tradesData = await tradesResponse.json();

      if (!tradesData.success) {
        throw new Error(tradesData.error || "Failed to fetch trades");
      }

      setTrades(tradesData.trades);

      // Fetch stats
      const statsResponse = await fetch(`${API_BASE_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (tradeId: string, status: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/admin/trades/${tradeId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to update status");
      }

      // Update local state
      setTrades(
        trades.map((trade) =>
          trade.id === tradeId ? { ...trade, status } : trade
        )
      );

      setSelectedTrade(null);
      alert("Trade status updated successfully");
      fetchData(); // Refresh to update stats
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleReleaseEscrow = async (tradeId: string, recipient: string, recipientAddress: string) => {
    if (!recipientAddress.trim()) {
      alert("Please enter the recipient's XMR address");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to release escrow funds to the ${recipient} at address ${recipientAddress.substring(0, 12)}...? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/admin/trades/${tradeId}/release-escrow`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ recipient, recipientAddress }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to release escrow");
      }

      alert(data.message);
      setSelectedTrade(null);
      setRecipientAddress(""); // Clear address field
      fetchData(); // Refresh trades
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to release escrow");
    }
  };

  const filteredTrades =
    statusFilter === "all"
      ? trades
      : trades.filter((trade) => trade.status === statusFilter);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "funded":
        return "bg-blue-100 text-blue-800";
      case "payment_sent":
        return "bg-purple-100 text-purple-800";
      case "payment_confirmed":
        return "bg-teal-100 text-teal-800";
      case "releasing":
        return "bg-indigo-100 text-indigo-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "disputed":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">Loading admin panel...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-8">
        <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Total Trades</div>
              <div className="text-2xl font-bold">{stats.total_trades}</div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">
                Total Volume (Fiat)
              </div>
              <div className="text-2xl font-bold">
                ${stats.total_fiat_volume.toLocaleString()}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">
                Total Volume (XMR)
              </div>
              <div className="text-2xl font-bold">
                {stats.total_xmr_volume.toFixed(4)} XMR
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-2">By Status</div>
              <div className="space-y-1">
                {stats.trades_by_status.map((item) => (
                  <div
                    key={item.status}
                    className="text-sm flex justify-between"
                  >
                    <span className="capitalize">{item.status}:</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="all">All Trades</option>
            <option value="pending">Pending</option>
            <option value="funded">Funded</option>
            <option value="payment_sent">Payment Sent</option>
            <option value="payment_confirmed">Payment Confirmed (Ready to Release)</option>
            <option value="releasing">Releasing</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed (Needs Resolution)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Trades Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trade ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Buyer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    XMR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No trades found
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {trade.id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.buyer_username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.seller_username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.amount} {trade.offer?.currency || "USD"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.xmr_amount.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                            trade.status
                          )}`}
                        >
                          {trade.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(trade.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setSelectedTrade(trade);
                            setNewStatus(trade.status);
                            setRecipientAddress(""); // Clear address when opening modal
                          }}
                          className="text-orange-600 hover:text-orange-900 font-medium"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trade Management Modal */}
        {selectedTrade && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Manage Trade</h2>
                <button
                  onClick={() => setSelectedTrade(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                {/* Trade Details */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Trade Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Trade ID:</span>
                      <div className="font-mono">{selectedTrade.id}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <div>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                            selectedTrade.status
                          )}`}
                        >
                          {selectedTrade.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Buyer:</span>
                      <div className="font-medium">
                        {selectedTrade.buyer_username}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Seller:</span>
                      <div className="font-medium">
                        {selectedTrade.seller_username}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Amount:</span>
                      <div>
                        {selectedTrade.amount}{" "}
                        {selectedTrade.offer?.currency || "USD"}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">XMR Amount:</span>
                      <div>{selectedTrade.xmr_amount.toFixed(4)} XMR</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Created:</span>
                      <div>
                        {new Date(selectedTrade.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Payment Method:</span>
                      <div>{selectedTrade.offer?.payment_method ? formatPaymentMethod(selectedTrade.offer.payment_method) : "N/A"}</div>
                    </div>
                  </div>
                </div>

                {/* Update Status */}
                <div>
                  <h3 className="font-semibold mb-3">Update Status</h3>
                  <div className="flex gap-2">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="pending">Pending</option>
                      <option value="funded">Funded</option>
                      <option value="payment_sent">Payment Sent</option>
                      <option value="payment_confirmed">Payment Confirmed</option>
                      <option value="releasing">Releasing</option>
                      <option value="completed">Completed</option>
                      <option value="disputed">Disputed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                      onClick={() =>
                        handleUpdateStatus(selectedTrade.id, newStatus)
                      }
                      className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                    >
                      Update
                    </button>
                  </div>
                </div>

                {/* Release Escrow */}
                {(selectedTrade.status === "payment_confirmed" || selectedTrade.status === "disputed") && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3 text-red-600">
                      Release Escrow {selectedTrade.status === "disputed" && "(Dispute Resolution)"}
                    </h3>
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> This will release the escrowed funds to the selected recipient. This action cannot be undone.
                      </p>
                      {selectedTrade.status === "disputed" && (
                        <p className="text-sm text-yellow-800 mt-2">
                          This trade is in dispute. Choose carefully which party should receive the funds.
                        </p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Release funds to:
                        </label>
                        <select
                          value={escrowRecipient}
                          onChange={(e) => setEscrowRecipient(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        >
                          <option value="seller">Seller ({selectedTrade.seller_username})</option>
                          <option value="buyer">Buyer ({selectedTrade.buyer_username})</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Recipient's XMR Address:
                        </label>
                        <input
                          type="text"
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          placeholder="Enter the recipient's Monero address (starts with 4...)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The {escrowRecipient}'s Monero wallet address where funds will be sent
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleReleaseEscrow(selectedTrade.id, escrowRecipient, recipientAddress)
                        }
                        disabled={!recipientAddress.trim()}
                        className="w-full px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Release {selectedTrade.xmr_amount.toFixed(4)} XMR to {escrowRecipient === "seller" ? selectedTrade.seller_username : selectedTrade.buyer_username}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
