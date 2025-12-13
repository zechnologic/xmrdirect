import { BrowserRouter, Routes, Route } from "react-router";

import Home from "./page/Home.tsx";
import Login from "./page/Login.tsx";
import Signup from "./page/Signup.tsx";
import HowItWorks from "./page/HowItWorks.tsx";
import Privacy from "./page/Privacy.tsx";
import Account from "./page/Account.tsx";
import Offers from "./page/Offers.tsx";
import Ad from "./page/Ad.tsx";
import User from "./page/User.tsx";
import CreateOffer from "./page/CreateOffer.tsx";
import Admin from "./page/Admin.tsx";
import TradeDetail from "./page/TradeDetail.tsx";

// const ProtectedRoute = ({ children }) => {
//   const location = useLocation();
//   const token = localStorage.getItem("token");

//   if (!token) {
//     localStorage.setItem("redirectAfterLogin", location.pathname);
//     return <Navigate to="/login" replace state={{ from: location }} />;
//   }

//   try {
//     const payload = JSON.parse(atob(token.split(".")[1]));
//     const isExpired = payload.exp * 1000 < Date.now();

//     if (isExpired) {
//       localStorage.removeItem("token");
//       return <Navigate to="/login" replace state={{ from: location }} />;
//     }
//   } catch (error) {
//     console.error("Token validation error:", error);
//     localStorage.removeItem("token");
//     return <Navigate to="/login" replace />;
//   }

//   return children;
// };

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/account" element={<Account />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/ad/:id" element={<Ad />} />
        <Route path="/trade/:id" element={<TradeDetail />} />
        <Route path="/user/:username" element={<User />} />
        <Route path="/create-offer" element={<CreateOffer />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
