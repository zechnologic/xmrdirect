import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import Layout from "../components/Layout";
import { formatPaymentMethod } from "../utils/formatPaymentMethod";

interface User {
  id: string;
  username: string;
}

interface MultisigSession {
  id: string;
  status: string;
  threshold: number;
  totalParticipants: number;
  multisigAddress?: string;
  createdAt: number;
}

interface Trade {
  id: string;
  offer_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  xmr_amount: number;
  status: string;
  created_at: number;
  buyer_username: string;
  seller_username: string;
  offer?: {
    payment_method: string;
    currency: string;
  };
}

interface Offer {
  id: string;
  user_id: string;
  offer_type: "buy" | "sell";
  payment_method: string;
  description?: string;
  price_per_xmr: number;
  currency: string;
  min_limit: number;
  max_limit: number;
  country_code?: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<MultisigSession[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token || !userData) {
      navigate("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      // Fetch user's multisig sessions, trades, and offers
      Promise.all([
        fetch("http://localhost:3000/multisig", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("http://localhost:3000/my-trades", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("http://localhost:3000/my-offers", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])
        .then(([sessionsRes, tradesRes, offersRes]) =>
          Promise.all([sessionsRes.json(), tradesRes.json(), offersRes.json()])
        )
        .then(([sessionsData, tradesData, offersData]) => {
          if (sessionsData.success) {
            setSessions(sessionsData.sessions);
          }
          if (tradesData.success) {
            setTrades(tradesData.trades);
          }
          if (offersData.success) {
            setOffers(offersData.offers);
          }
        })
        .catch((error) => console.error("Error fetching data:", error))
        .finally(() => setLoading(false));
    } catch (error) {
      console.error("Error parsing user data:", error);
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!confirm("Are you sure you want to delete this offer?")) {
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`http://localhost:3000/offers/${offerId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setOffers(offers.filter((offer) => offer.id !== offerId));
      }
    } catch (error) {
      console.error("Error deleting offer:", error);
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

  const formatLimit = (min: number, max: number, currency: string) => {
    if (max === 0 || max >= 999999999) {
      return `${min.toLocaleString()} - any amount ${currency}`;
    }
    return `${min.toLocaleString()} - ${max.toLocaleString()} ${currency}`;
  };

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen pt-40 px-4 bg-[#232323] text-orange-600">
        <h2 className="font-bold text-4xl uppercase">Account</h2>
        <p className="mt-4 text-gray-400 max-w-md">
          Manage your account and view your multisig sessions.
        </p>

        <div className="mt-8 max-w-2xl">
          {/* Account Info */}
          <div className="bg-[#2a2a2a] border border-orange-600 p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Account Information</h3>
            <div className="space-y-3">
              <div>
                <span className="text-gray-400">Username: </span>
                <span className="font-semibold">{user.username}</span>
              </div>
              <div>
                <span className="text-gray-400">User ID: </span>
                <span className="font-mono text-sm text-gray-300">
                  {user.id}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-6 px-6 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold"
            >
              Logout
            </button>
          </div>

          {/* My Offers */}
          <div className="bg-[#2a2a2a] border border-orange-600 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                My Offers ({offers.length})
              </h3>
              <Link to="/create-offer">
                <button className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold text-sm">
                  Create New Offer
                </button>
              </Link>
            </div>

            {loading ? (
              <p className="text-gray-400">Loading offers...</p>
            ) : offers.length === 0 ? (
              <p className="text-gray-400">
                No offers yet. Create your first offer to start trading!
              </p>
            ) : (
              <div className="space-y-4">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-[#232323] border border-orange-600/50 p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold uppercase text-sm">
                          {offer.offer_type === "buy" ? "Buying" : "Selling"} XMR
                        </span>
                        <span className="mx-2">•</span>
                        <span className="text-gray-400 text-sm">
                          {formatPaymentMethod(offer.payment_method)}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-semibold uppercase ${
                          offer.is_active
                            ? "bg-green-600 text-white"
                            : "bg-gray-600 text-white"
                        }`}
                      >
                        {offer.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1 mb-3">
                      <div>
                        <span>Price: </span>
                        <span className="text-orange-600 font-semibold">
                          {offer.price_per_xmr.toLocaleString()} {offer.currency}
                        </span>
                        <span> per XMR</span>
                      </div>
                      <div>
                        <span>Limits: </span>
                        <span className="text-gray-300">
                          {formatLimit(
                            offer.min_limit,
                            offer.max_limit,
                            offer.currency
                          )}
                        </span>
                      </div>
                      {offer.description && (
                        <div>
                          <span>Description: </span>
                          <span className="text-gray-300">{offer.description}</span>
                        </div>
                      )}
                      <div>Created: {formatDate(offer.created_at)}</div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/ad/${offer.id}`}>
                        <button className="px-4 py-2 bg-gray-700 text-white hover:bg-gray-600 transition-colors font-semibold text-sm">
                          View
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDeleteOffer(offer.id)}
                        className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors font-semibold text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trades */}
          <div className="bg-[#2a2a2a] border border-orange-600 p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">
              My Trades ({trades.length})
            </h3>

            {loading ? (
              <p className="text-gray-400">Loading trades...</p>
            ) : trades.length === 0 ? (
              <p className="text-gray-400">
                No trades yet. Browse offers to start trading.
              </p>
            ) : (
              <div className="space-y-4">
                {trades.map((trade) => (
                  <div
                    key={trade.id}
                    className="bg-[#232323] border border-orange-600/50 p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold">Trade ID: </span>
                        <span className="font-mono text-sm text-gray-300">
                          {trade.id.slice(0, 16)}...
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-semibold uppercase ${
                          trade.status === "completed"
                            ? "bg-green-600 text-white"
                            : trade.status === "funded"
                            ? "bg-blue-600 text-white"
                            : trade.status === "disputed"
                            ? "bg-red-600 text-white"
                            : trade.status === "cancelled"
                            ? "bg-gray-600 text-white"
                            : "bg-yellow-600 text-white"
                        }`}
                      >
                        {trade.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1 mb-3">
                      <div>
                        <span>Amount: </span>
                        <span className="text-orange-600 font-semibold">
                          {trade.amount.toLocaleString()}{" "}
                          {trade.offer?.currency || ""}
                        </span>
                        <span className="mx-2">→</span>
                        <span className="text-orange-600 font-semibold">
                          {trade.xmr_amount.toFixed(8)} XMR
                        </span>
                      </div>
                      <div>
                        <span>Payment method: </span>
                        <span className="text-gray-300">
                          {trade.offer?.payment_method ? formatPaymentMethod(trade.offer.payment_method) : "Unknown"}
                        </span>
                      </div>
                      <div>
                        <span>Trading with: </span>
                        <span className="text-gray-300">
                          {trade.buyer_id === user?.id
                            ? trade.seller_username
                            : trade.buyer_username}
                        </span>
                      </div>
                      <div>Created: {formatDate(trade.created_at)}</div>
                    </div>
                    <Link to={`/trade/${trade.id}`}>
                      <button className="w-full px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold text-sm">
                        View Trade Details
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Multisig Sessions */}
          <div className="bg-[#2a2a2a] border border-orange-600 p-6">
            <h3 className="text-xl font-semibold mb-4">
              Multisig Sessions ({sessions.length})
            </h3>

            {loading ? (
              <p className="text-gray-400">Loading sessions...</p>
            ) : sessions.length === 0 ? (
              <p className="text-gray-400">
                No multisig sessions yet. Create one to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-[#232323] border border-orange-600/50 p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold">Session ID: </span>
                        <span className="font-mono text-sm text-gray-300">
                          {session.id.slice(0, 16)}...
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-semibold uppercase ${
                          session.status === "ready"
                            ? "bg-green-600 text-white"
                            : session.status === "exchanging"
                            ? "bg-yellow-600 text-white"
                            : "bg-orange-600 text-white"
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>
                        Configuration: {session.threshold}-of-
                        {session.totalParticipants} multisig
                      </div>
                      {session.multisigAddress && (
                        <div>
                          <span>Address: </span>
                          <span className="font-mono text-gray-300">
                            {session.multisigAddress.slice(0, 20)}...
                          </span>
                        </div>
                      )}
                      <div>Created: {formatDate(session.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Account;
