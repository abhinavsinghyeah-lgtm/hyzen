import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { brand } from "./config/brand.js";

function applyBrandGlobals() {
  document.documentElement.style.backgroundColor = brand.darkBg;
  document.body.style.backgroundColor = brand.darkBg;
  document.documentElement.style.color = brand.textPrimary;
}

applyBrandGlobals();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

