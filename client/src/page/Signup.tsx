import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import Layout from "../components/Layout";

function Signup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/account");
    }
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Auto-login after signup
        const loginResponse = await fetch("http://localhost:3000/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const loginData = await loginResponse.json();

        if (loginData.success) {
          localStorage.setItem("token", loginData.token);
          localStorage.setItem("user", JSON.stringify(loginData.user));
          navigate("/account");
          window.location.reload(); // Refresh to update nav
        }
      } else {
        setError(data.error || "Signup failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen pt-40 px-4 bg-[#232323] text-orange-600">
        <h2 className="font-bold text-4xl uppercase">Sign up</h2>
        <p className="mt-4 text-gray-400 max-w-md">
          Create your anonymous account. No email required.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 max-w-md">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-600 text-red-200">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="username" className="block mb-2 font-semibold">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-[#2a2a2a] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
              placeholder="Choose a username"
              required
              minLength={3}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block mb-2 font-semibold">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-[#2a2a2a] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
              placeholder="Create a strong password"
              required
              minLength={6}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block mb-2 font-semibold">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-[#2a2a2a] border border-orange-600 text-white focus:outline-none focus:border-orange-500"
              placeholder="Confirm your password"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-white bg-orange-600 hover:bg-orange-700 transition-colors cursor-pointer font-semibold uppercase disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
          <div className="mt-4 text-center">
            <span className="text-gray-400">Already have an account? </span>
            <Link to="/login" className="hover:text-orange-500 transition-colors">
              Login
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export default Signup;
