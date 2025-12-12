import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import Layout from "../components/Layout";
import { formatPaymentMethod } from "../utils/formatPaymentMethod";

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
}

interface UserProfile {
  id: string;
  username: string;
  created_at: number;
  statistics: {
    total_trades: number;
    completed_trades: number;
    trading_partners: number;
    feedback_score: number;
    typical_finalization_time: string;
  };
  offers: {
    buy: Offer[];
    sell: Offer[];
  };
  feedback: any[];
}

function User() {
  const { username } = useParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (username) {
      fetchUserProfile(username);
    }
  }, [username]);

  const fetchUserProfile = async (username: string) => {
    try {
      const response = await fetch(`http://localhost:3000/user/${username}`);
      const data = await response.json();

      if (data.success) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMonths = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    if (diffInMonths < 1) return "Less than a month ago";
    if (diffInMonths === 1) return "1 month ago";
    return `${diffInMonths} months ago`;
  };

  const formatLimit = (min: number, max: number, currency: string) => {
    if (max === 0 || max >= 999999999) {
      return `${min.toLocaleString()} - any amount ${currency}`;
    }
    return `${min.toLocaleString()} - ${max.toLocaleString()} ${currency}`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen pt-40 px-4 bg-[#232323] text-orange-600">
          <div className="text-center">Loading profile...</div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="min-h-screen pt-40 px-4 bg-[#232323] text-orange-600">
          <div className="text-center">User not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pt-24 px-4 bg-[#232323] text-orange-600">
        <div className="max-w-6xl mx-auto">
          {/* User Header */}
          <div className="mb-8">
            <h2 className="font-bold text-4xl mb-2">{profile.username}</h2>
            <p className="text-sm text-gray-400">Seen just now</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Information */}
            <div className="lg:col-span-1 space-y-6">
              {/* Statistics */}
              <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                <h3 className="font-semibold text-xl mb-4">Information</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-400">Trades:</div>
                    <div className="font-semibold">
                      {profile.statistics.total_trades}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Trading partners:</div>
                    <div className="font-semibold">
                      {profile.statistics.trading_partners}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Feedback score:</div>
                    <div className="font-semibold">
                      {profile.statistics.feedback_score}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Account created:</div>
                    <div className="font-semibold">
                      {formatDate(profile.created_at)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">
                      Typical trade finalization time:
                    </div>
                    <div className="font-semibold">
                      {profile.statistics.typical_finalization_time}
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Introduction */}
              <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                <h3 className="font-semibold text-lg mb-3">
                  Personal introduction:
                </h3>
                <div className="text-sm text-gray-300 font-mono break-all">
                  {profile.id}
                </div>
              </div>

              {/* Feedback Section */}
              <div className="bg-[#2a2a2a] border border-orange-600 p-6">
                <h3 className="font-semibold text-lg mb-3">Feedback</h3>
                {profile.feedback.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No feedback yet. Be the first to trade with this user.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {profile.feedback.map((fb: any, idx: number) => (
                      <div key={idx} className="border-b border-gray-700 pb-3">
                        <div className="text-xs text-gray-400">{fb.date}</div>
                        <div className="text-sm mt-1">{fb.comment}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Offers */}
            <div className="lg:col-span-2 space-y-6">
              {/* Buy Offers */}
              {profile.offers.buy.length > 0 && (
                <div>
                  <h3 className="font-semibold text-2xl mb-4">
                    Buy Monero online from {profile.username}
                  </h3>
                  <div className="bg-[#2a2a2a] border border-orange-600 overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-5 gap-4 px-6 py-4 bg-[#1a1a1a] border-b border-orange-600/30 font-semibold text-sm">
                      <div>Seller</div>
                      <div>Payment Method</div>
                      <div>Price / XMR</div>
                      <div>Limits</div>
                      <div className="text-right">Action</div>
                    </div>

                    {/* Table Rows */}
                    {profile.offers.buy.map((offer) => (
                      <div
                        key={offer.id}
                        className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-orange-600/10 hover:bg-[#232323] transition-colors text-sm"
                      >
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {offer.country_code && (
                              <span className="text-xs">{offer.country_code}</span>
                            )}
                            {profile.username}
                          </div>
                          <div className="text-xs text-gray-400">
                            ({profile.statistics.total_trades}*;{" "}
                            {profile.statistics.feedback_score}%)
                          </div>
                          <div className="text-xs text-gray-400">
                            Seen just now
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">
                            {formatPaymentMethod(offer.payment_method)}
                          </div>
                          {offer.description && (
                            <div className="text-xs text-gray-400 line-clamp-2">
                              {offer.description}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold">
                            {offer.price_per_xmr.toLocaleString()}{" "}
                            {offer.currency}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm">
                            {formatLimit(
                              offer.min_limit,
                              offer.max_limit,
                              offer.currency
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <Link to={`/ad/${offer.id}`}>
                            <button className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold text-sm">
                              Sell
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sell Offers */}
              {profile.offers.sell.length > 0 && (
                <div>
                  <h3 className="font-semibold text-2xl mb-4">
                    Sell Monero online to {profile.username}
                  </h3>
                  <div className="bg-[#2a2a2a] border border-orange-600 overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-5 gap-4 px-6 py-4 bg-[#1a1a1a] border-b border-orange-600/30 font-semibold text-sm">
                      <div>Buyer</div>
                      <div>Payment Method</div>
                      <div>Price / XMR</div>
                      <div>Limits</div>
                      <div className="text-right">Action</div>
                    </div>

                    {/* Table Rows */}
                    {profile.offers.sell.map((offer) => (
                      <div
                        key={offer.id}
                        className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-orange-600/10 hover:bg-[#232323] transition-colors text-sm"
                      >
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {offer.country_code && (
                              <span className="text-xs">{offer.country_code}</span>
                            )}
                            {profile.username}
                          </div>
                          <div className="text-xs text-gray-400">
                            ({profile.statistics.total_trades}*;{" "}
                            {profile.statistics.feedback_score}%)
                          </div>
                          <div className="text-xs text-gray-400">
                            Seen just now
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold">
                            {formatPaymentMethod(offer.payment_method)}
                          </div>
                          {offer.description && (
                            <div className="text-xs text-gray-400 line-clamp-2">
                              {offer.description}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold">
                            {offer.price_per_xmr.toLocaleString()}{" "}
                            {offer.currency}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm">
                            {formatLimit(
                              offer.min_limit,
                              offer.max_limit,
                              offer.currency
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <Link to={`/ad/${offer.id}`}>
                            <button className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold text-sm">
                              Buy
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.offers.buy.length === 0 &&
                profile.offers.sell.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    This user has no active offers at the moment.
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default User;
