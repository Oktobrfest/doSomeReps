import { createRoot } from "react-dom/client";
import { Navbar } from "../navbar/Navbar";
import type { NavbarProps } from "../navbar/Navbar";
import "../styles/global.css";

function mount() {
  const root = document.getElementById("react-navbar-root");
  const dataEl = document.getElementById("navbar-data");
  if (!root || !dataEl) return;

  try {
    const props: NavbarProps = JSON.parse(dataEl.textContent || "{}");
    createRoot(root).render(<Navbar {...props} />);
  } catch (err) {
    console.error("Error mounting Navbar:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
