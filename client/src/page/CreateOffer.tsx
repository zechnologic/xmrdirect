import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import Layout from "../components/Layout";

function CreateOffer() {
  const navigate = useNavigate();
  const [offerType, setOfferType] = useState<"buy" | "sell">("sell");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [pricePerXmr, setPricePerXmr] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [minLimit, setMinLimit] = useState("");
  const [maxLimit, setMaxLimit] = useState("");
  const [unlimitedMax, setUnlimitedMax] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          offer_type: offerType,
          payment_method: paymentMethod,
          price_per_xmr: parseFloat(pricePerXmr),
          currency,
          min_limit: parseFloat(minLimit),
          max_limit: unlimitedMax ? 999999999 : parseFloat(maxLimit),
          description,
          country_code: countryCode || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        navigate("/account");
      } else {
        setError(data.error || "Failed to create offer");
      }
    } catch (error) {
      console.error("Error creating offer:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen pt-24 px-4 bg-[#232323] text-orange-600">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-bold text-4xl uppercase mb-2">Create Offer</h2>
          <p className="text-gray-400 mb-8">
            Post your own buy or sell advertisement
          </p>

          <form
            onSubmit={handleSubmit}
            className="bg-[#2a2a2a] border border-orange-600 p-8"
          >
            {/* Offer Type */}
            <div className="mb-6">
              <label className="block mb-3 text-sm font-semibold">
                What do you want to do?
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="sell"
                    checked={offerType === "sell"}
                    onChange={(e) =>
                      setOfferType(e.target.value as "buy" | "sell")
                    }
                    className="w-4 h-4"
                  />
                  <span>Sell XMR (I want to sell Monero)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="buy"
                    checked={offerType === "buy"}
                    onChange={(e) =>
                      setOfferType(e.target.value as "buy" | "sell")
                    }
                    className="w-4 h-4"
                  />
                  <span>Buy XMR (I want to buy Monero)</span>
                </label>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-6">
              <label className="block mb-2 text-sm font-semibold">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#232323] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">Select payment method</option>
                <option value="in_person">In person</option>
                <option value="cash_by_mail">Cash by Mail</option>
              </select>
            </div>

            {/* Price and Currency */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block mb-2 text-sm font-semibold">
                  Price per XMR *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={pricePerXmr}
                  onChange={(e) => setPricePerXmr(e.target.value)}
                  required
                  placeholder="432.60"
                  className="w-full px-4 py-3 bg-[#232323] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold">
                  Currency *
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#232323] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                  <option value="KRW">KRW</option>
                  <option value="SEK">SEK</option>
                  <option value="PLN">PLN</option>
                </select>
              </div>
            </div>

            {/* Trade Limits */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block mb-2 text-sm font-semibold">
                  Minimum Limit *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={minLimit}
                  onChange={(e) => setMinLimit(e.target.value)}
                  required
                  placeholder="20"
                  className="w-full px-4 py-3 bg-[#232323] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold">
                  Maximum Limit *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={maxLimit}
                  onChange={(e) => setMaxLimit(e.target.value)}
                  required={!unlimitedMax}
                  disabled={unlimitedMax}
                  placeholder="5000"
                  className="w-full px-4 py-3 bg-[#232323] border border-orange-600 text-white focus:outline-none focus:border-orange-500 disabled:opacity-50"
                />
                <label className="flex items-center gap-2 mt-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={unlimitedMax}
                    onChange={(e) => setUnlimitedMax(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-400">Unlimited (any amount)</span>
                </label>
              </div>
            </div>

            {/* Country Code */}
            <div className="mb-6">
              <label className="block mb-2 text-sm font-semibold">
                Country (optional)
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full px-4 py-3 bg-[#232323] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">No specific country</option>
                <option value="US">🇺🇸 United States</option>
                <option value="GB">🇬🇧 United Kingdom</option>
                <option value="DE">🇩🇪 Germany</option>
                <option value="CA">🇨🇦 Canada</option>
                <option value="KR">🇰🇷 South Korea</option>
                <option value="SE">🇸🇪 Sweden</option>
                <option value="FR">🇫🇷 France</option>
                <option value="IT">🇮🇹 Italy</option>
                <option value="ES">🇪🇸 Spain</option>
                <option value="PL">🇵🇱 Poland</option>
              </select>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block mb-2 text-sm font-semibold">
                Description / Terms (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe your offer terms, requirements, or any additional information..."
                className="w-full px-4 py-3 bg-[#232323] border border-orange-600 text-white focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>

            {error && <div className="mb-6 text-red-400 text-sm">{error}</div>}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Creating..." : "Create Offer"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/offers")}
                className="px-8 py-3 bg-gray-700 text-white hover:bg-gray-600 transition-colors font-semibold uppercase"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export default CreateOffer;
