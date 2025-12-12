import { useState, useEffect } from "react";
import { Link } from "react-router";
import Layout from "../components/Layout";

function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  return (
    <Layout>
      <div className="min-h-screen pt-40 px-4 bg-[#232323] text-orange-600">
        <h2 className="font-bold text-4xl uppercase">
          p2p monero trading platform
        </h2>
        <h3 className="font-semibold text-xl mt-2">
          Non-custodial Monero trading solution. We don't hold your funds.
        </h3>
        <Link to={isLoggedIn ? "/account" : "/signup"}>
          <button className="mt-4 text-white bg-orange-600 hover:bg-orange-700 transition-colors w-32 h-10 cursor-pointer">
            {isLoggedIn ? "Dashboard" : "Sign up"}
          </button>
        </Link>
      </div>
    </Layout>
  );
}

export default Home;
