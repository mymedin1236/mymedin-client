import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { ROLE_LINKS, decorateClientLinks } from "../navLinks";
import Icon from "./Icon";
import { trackTabViewed } from "../utils/analytics";

// Bottom tab bar shown on mobile to switch between sections. When the links
// overflow (e.g. the dentist has many), the bar scrolls horizontally and shows
// a right-edge chevron; tapping it nudges the bar along. Scroll is contained so
// swiping the bar never triggers the browser's back/forward gesture.
export default function MobileNav({ role, myDentistId }) {
  const links = decorateClientLinks(ROLE_LINKS[role] || [], myDentistId);
  const scrollRef = useRef(null);
  const [less, setLess] = useState(false); // more tabs to the left
  const [more, setMore] = useState(false); // more tabs to the right

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    setLess(el.scrollLeft > 4);
    setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [links.length, myDentistId]);

  const nudge = (dir) => scrollRef.current?.scrollBy({ left: dir * 130, behavior: "smooth" });

  return (
    <div className="mobile-nav-wrap">
      {less && (
        <button type="button" className="mobile-nav-arrow left" onClick={() => nudge(-1)} aria-label="Previous tabs">
          <Icon name="chevron_left" />
        </button>
      )}
      <nav className="mobile-nav" ref={scrollRef}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={links.some((o) => o.to !== l.to && o.to.startsWith(`${l.to}/`))}
            className="mobile-nav-item"
            onClick={() => trackTabViewed(l.label, l.to)}
          >
            <Icon name={l.icon} />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
      {more && (
        <button type="button" className="mobile-nav-arrow right" onClick={() => nudge(1)} aria-label="More tabs">
          <Icon name="chevron_right" />
        </button>
      )}
    </div>
  );
}
