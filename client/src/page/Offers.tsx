import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import Layout from "../components/Layout";
import { formatPaymentMethod } from "../utils/formatPaymentMethod";
import { API_BASE_URL } from "../config/api";

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

function Offers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters from URL
  const filterType = (searchParams.get("type") || "all") as
    | "all"
    | "buy"
    | "sell";
  const filterCurrency = searchParams.get("currencyCode") || "";
  const filterCountry = searchParams.get("countryCode") || "";
  const filterPaymentMethod = searchParams.get("paymentMethodCode") || "";

  useEffect(() => {
    fetchOffers();
  }, [filterType, filterCurrency, filterCountry, filterPaymentMethod]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (filterType !== "all") {
        params.append("type", filterType);
      }
      if (filterCurrency) {
        params.append("currencyCode", filterCurrency);
      }
      if (filterCountry) {
        params.append("countryCode", filterCountry);
      }
      if (filterPaymentMethod) {
        params.append("paymentMethodCode", filterPaymentMethod);
      }

      const url = `${API_BASE_URL}/offers${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setOffers(data.offers);
      }
    } catch (error) {
      console.error("Error fetching offers:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }

    setSearchParams(newParams);
  };

  const formatLimit = (min: number, max: number, currency: string) => {
    if (max === 0 || max >= 999999999) {
      return `${min.toLocaleString()} - any amount ${currency}`;
    }
    return `${min.toLocaleString()} - ${max.toLocaleString()} ${currency}`;
  };

  return (
    <Layout>
      <div className="min-h-screen pt-16 px-4 bg-[#232323] text-orange-600">
        <div className="max-w-7xl mx-auto py-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-bold text-4xl uppercase mb-2">
                {filterType === "all" ? "All Offers" : `${filterType} Monero`}
              </h2>
              <p className="text-gray-400">
                Browse peer-to-peer Monero trading offers
              </p>
            </div>
            <Link to="/create-offer">
              <button className="px-6 py-3 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold uppercase">
                Create Offer
              </button>
            </Link>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-4 mb-6 border-b border-orange-600/30">
            <button
              onClick={() => updateFilter("type", "")}
              className={`px-4 py-2 font-semibold transition-colors ${
                filterType === "all"
                  ? "border-b-2 border-orange-600 text-orange-600"
                  : "text-gray-400 hover:text-orange-500"
              }`}
            >
              All Offers
            </button>
            <button
              onClick={() => updateFilter("type", "buy")}
              className={`px-4 py-2 font-semibold transition-colors ${
                filterType === "buy"
                  ? "border-b-2 border-orange-600 text-orange-600"
                  : "text-gray-400 hover:text-orange-500"
              }`}
            >
              Buy XMR
            </button>
            <button
              onClick={() => updateFilter("type", "sell")}
              className={`px-4 py-2 font-semibold transition-colors ${
                filterType === "sell"
                  ? "border-b-2 border-orange-600 text-orange-600"
                  : "text-gray-400 hover:text-orange-500"
              }`}
            >
              Sell XMR
            </button>
          </div>

          {/* Additional Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block mb-2 text-sm font-semibold">
                Currency
              </label>
              <select
                value={filterCurrency}
                onChange={(e) => updateFilter("currencyCode", e.target.value)}
                className="w-full px-4 py-2 bg-[#2a2a2a] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">All Currencies</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
                <option value="KRW">KRW</option>
                <option value="SEK">SEK</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm font-semibold">
                Country
              </label>
              <select
                value={filterCountry}
                onChange={(e) => updateFilter("countryCode", e.target.value)}
                className="w-full px-4 py-2 bg-[#2a2a2a] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">All Countries</option>
                <option value="US">🇺🇸 United States</option>
                <option value="GB">🇬🇧 United Kingdom</option>
                <option value="DE">🇩🇪 Germany</option>
                <option value="CA">🇨🇦 Canada</option>
                <option value="KR">🇰🇷 South Korea</option>
                <option value="SE">🇸🇪 Sweden</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm font-semibold">
                Payment Method
              </label>
              <select
                value={filterPaymentMethod}
                onChange={(e) =>
                  updateFilter("paymentMethodCode", e.target.value)
                }
                className="w-full px-4 py-2 bg-[#2a2a2a] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">All Methods</option>
                <option value="in_person">In person</option>
                <option value="cash_by_mail">Cash by Mail</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-400 text-center py-12">
              Loading offers...
            </div>
          ) : offers.length === 0 ? (
            <div className="text-gray-400 text-center py-12">
              No offers available. Be the first to create one!
            </div>
          ) : (
            <div className="bg-[#2a2a2a] border border-orange-600 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-5 gap-4 px-6 py-4 bg-[#1a1a1a] border-b border-orange-600/30 font-semibold">
                <div>Seller</div>
                <div>Payment Method</div>
                <div>Price / XMR</div>
                <div>Limits</div>
                <div className="text-right">Action</div>
              </div>

              {/* Table Rows */}
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-orange-600/10 hover:bg-[#232323] transition-colors"
                >
                  {/* Seller */}
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {offer.country_code && (
                        <span className="text-sm">{offer.country_code}</span>
                      )}
                      <Link
                        to={`/user/${offer.seller_username}`}
                        className="hover:text-orange-500 transition-colors"
                      >
                        {offer.seller_username}
                      </Link>
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {offer.offer_type}ing XMR
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <div className="font-semibold">{formatPaymentMethod(offer.payment_method)}</div>
                    {offer.description && (
                      <div className="text-xs text-gray-400 line-clamp-2">
                        {offer.description}
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div>
                    <div className="font-semibold">
                      {offer.price_per_xmr.toLocaleString()} {offer.currency}
                    </div>
                    <div className="text-xs text-gray-400">per XMR</div>
                  </div>

                  {/* Limits */}
                  <div>
                    <div className="text-sm">
                      {formatLimit(
                        offer.min_limit,
                        offer.max_limit,
                        offer.currency
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="text-right">
                    <Link to={`/ad/${offer.id}`}>
                      <button className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold text-sm">
                        {offer.offer_type === "buy" ? "Sell" : "Buy"}
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Offers;
