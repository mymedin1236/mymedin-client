import { Link } from "react-router-dom";
import Icon from "./Icon";

// Lightweight top bar shown on public (logged-out) discovery pages.
export default function PublicTopbar() {
  return (
    <header className="public-topbar">
      <Link to="/find-dentist" className="topbar-brand icon">
        <Icon name="dentistry" /> MyDentalBooking
      </Link>
      <div className="row gap">
        <Link to="/login" className="btn-secondary" style={{ textDecoration: "none" }}>
          Sign in
        </Link>
        <Link to="/register" className="btn-link" style={{ textDecoration: "none" }}>
          Create account
        </Link>
      </div>
    </header>
  );
}
