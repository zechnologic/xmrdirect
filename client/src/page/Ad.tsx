import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import Layout from "../components/Layout";
import { formatPaymentMethod } from "../utils/formatPaymentMethod";

interface Offer {
  id: string;
  user_id: string;
  seller_username: string;
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
}

function Ad() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [xmrAmount, setXmrAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) {
      fetchOffer(id);
    }
  }, [id]);

  useEffect(() => {
    if (amount && offer) {
      const numAmount = parseFloat(amount);
      if (!isNaN(numAmount)) {
        setXmrAmount(numAmount / offer.price_per_xmr);
      } else {
        setXmrAmount(0);
      }
    } else {
      setXmrAmount(0);
    }
  }, [amount, offer]);

  const fetchOffer = async (offerId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/offers/${offerId}`);
      const data = await response.json();

      if (data.success) {
        setOffer(data.offer);
      } else {
        console.error("Offer not found");
        navigate("/offers");
      }
    } catch (error) {
      console.error("Error fetching offer:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTradeRequest = async () => {
    if (!offer) return;

    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("http://localhost:3000/trades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          offer_id: offer.id,
          amount: parseFloat(amount),
          xmr_amount: xmrAmount,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to the new trade detail page
        navigate(`/trade/${data.trade.id}`);
      } else {
        setError(data.error || "Failed to create trade request");
      }
    } catch (error) {
      console.error("Error creating trade:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen pt-40 px-4 bg-[#232323] text-orange-600">
          <div className="text-center">Loading offer...</div>
        </div>
      </Layout>
    );
  }

  if (!offer) {
    return (
      <Layout>
        <div className="min-h-screen pt-40 px-4 bg-[#232323] text-orange-600">
          <div className="text-center">Offer not found</div>
        </div>
      </Layout>
    );
  }

  const actionVerb = offer.offer_type === "buy" ? "Sell" : "Buy";
  const formatLimit = (min: number, max: number, currency: string) => {
    if (max === 0 || max >= 999999999) {
      return `${min.toLocaleString()} - any amount ${currency}`;
    }
    return `${min.toLocaleString()} - ${max.toLocaleString()} ${currency}`;
  };

  return (
    <Layout>
      <div className="min-h-screen pt-24 px-4 bg-[#232323] text-orange-600">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <h2 className="font-bold text-3xl mb-2">
            {actionVerb} Monero using {formatPaymentMethod(offer.payment_method)}
          </h2>
          {offer.description && (
            <p className="text-gray-400 mb-6">{offer.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Offer Details */}
            <div className="space-y-4">
              <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                <h3 className="font-semibold text-xl mb-4">Price</h3>
                <div className="text-3xl font-bold">
                  {offer.price_per_xmr.toLocaleString()} {offer.currency}
                </div>
                <div className="text-sm text-gray-400 mt-1">per XMR</div>
              </div>

              <div className="bg-[#2a2a2a] border border-orange-600 p-6 space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">User:</div>
                  <div className="font-semibold text-lg">
                    <Link
                      to={`/user/${offer.seller_username}`}
                      className="hover:text-orange-500 transition-colors"
                    >
                      {offer.seller_username}
                    </Link>
                  </div>
                  <div className="text-xs text-gray-400">Seen recently</div>
                </div>

                <div>
                  <div className="text-sm text-gray-400 mb-1">
                    Payment method:
                  </div>
                  <div className="font-semibold">{formatPaymentMethod(offer.payment_method)}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-400 mb-1">
                    Trade limits:
                  </div>
                  <div className="font-semibold">
                    {formatLimit(
                      offer.min_limit,
                      offer.max_limit,
                      offer.currency
                    )}
                  </div>
                </div>

                {offer.country_code && (
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Location:</div>
                    <div className="font-semibold">{offer.country_code}</div>
                  </div>
                )}
              </div>

              {/* Terms of Trade */}
              <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                <h3 className="font-semibold text-lg mb-3">
                  Terms of trade with{" "}
                  <Link
                    to={`/user/${offer.seller_username}`}
                    className="hover:text-orange-500 transition-colors"
                  >
                    {offer.seller_username}
                  </Link>
                </h3>
                <div className="text-sm text-gray-300">
                  {offer.description || "No specific terms provided."}
                </div>
              </div>
            </div>

            {/* Right Column - Trade Form */}
            <div className="space-y-4">
              <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                <h3 className="font-semibold text-lg mb-4">
                  How much do you wish to {actionVerb.toLowerCase()}?
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      {offer.currency}
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={offer.min_limit.toString()}
                      className="w-full px-4 py-3 bg-[#232323] border border-orange-600 text-white text-lg focus:outline-none focus:border-orange-500"
                      min={offer.min_limit}
                      max={
                        offer.max_limit >= 999999999 ? undefined : offer.max_limit
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      XMR
                    </label>
                    <div className="w-full px-4 py-3 bg-[#1a1a1a] border border-orange-600/50 text-white text-lg">
                      {xmrAmount.toFixed(8)}
                    </div>
                  </div>

                  {amount && parseFloat(amount) < offer.min_limit && (
                    <div className="text-red-400 text-sm">
                      You have to make a trade for at least {offer.min_limit}{" "}
                      {offer.currency} with this advertisement.
                    </div>
                  )}

                  {error && (
                    <div className="text-red-400 text-sm">{error}</div>
                  )}

                  <button
                    onClick={handleTradeRequest}
                    disabled={
                      !amount ||
                      parseFloat(amount) < offer.min_limit ||
                      (offer.max_limit < 999999999 &&
                        parseFloat(amount) > offer.max_limit) ||
                      submitting
                    }
                    className="w-full py-3 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Creating Request..." : "Open Trade Request"}
                  </button>

                  <div className="text-xs text-gray-400 space-y-2">
                    <p>
                      Please note, the actual XMR amount of the trade may
                      slightly differ from the currently shown amount due to
                      price and exchange rate fluctuations.
                    </p>
                    <p>
                      Network transaction fees associated with settling the
                      trade will be deducted from the trade amount.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                <h3 className="font-semibold text-lg mb-3">Tips</h3>
                <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                  <li>Read the ad carefully and check the terms.</li>
                  <li>
                    Watch for fraudsters! Check the profile feedback and take
                    extra caution with recently created accounts.
                  </li>
                  <li>
                    Note that rounding and price fluctuations might change the
                    final Monero amount.
                  </li>
                  <li>This trade is protected by multisig escrow.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Ad;
