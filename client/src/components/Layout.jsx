import { useResource } from '../lib/hooks';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Box, ShoppingBag, ArrowUpRight, Menu, X, Heart, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useShop } from '../stores/store';
import { useSession } from '../lib/session';
export default function Layout() {
  const settings = useResource('/settings');
  const count = useShop((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="ribbon">
        <Link className="brand" to="/" aria-label="Voxel Ventures home">
          <Box />
          <span>
            voxel<span className="brand-small">VENTURES</span>
          </span>
        </Link>
        <nav className={open ? 'nav open' : 'nav'} aria-label="Main navigation">
          <NavLink to="/products">The collection</NavLink>
          <NavLink to="/custom">
            Custom studio <ArrowUpRight size={14} />
          </NavLink>
          <NavLink to="/materials">Materials</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin">Workshop</NavLink>}
        </nav>
        <div className="nav-actions">
          <Link to="/wishlist" aria-label="Wishlist">
            <Heart size={19} />
          </Link>
          <Link to={user ? '/account' : '/login'} aria-label="Your account">
            <UserRound size={19} />
          </Link>
          <Link className="bag" to="/cart" aria-label={'Shopping bag, ' + count + ' items'}>
            <ShoppingBag size={19} />
            <span>{count}</span>
          </Link>
          <button
            className="menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer>
        <div>
          <Link className="brand" to="/">
            <Box />
            <span>
              voxel<span className="brand-small">VENTURES</span>
            </span>
          </Link>
          <p>
            Small layers.
            <br />
            Extraordinary possibilities.
          </p>
        </div>
        <div>
          <Link to="/products">Explore objects</Link>
          <Link to="/custom">Make something yours</Link>
          <Link to="/materials">Material guide</Link>
        </div>
        <div>
          <Link to="/account">Your account</Link>
          <Link to="/orders">Track an order</Link>
          {settings.data?.contactEmail && (
            <a href={'mailto:' + settings.data.contactEmail}>Contact the studio</a>
          )}
          {settings.data?.whatsapp && (
            <a
              href={'https://wa.me/' + settings.data.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chat on WhatsApp ↗
            </a>
          )}
          {user && (
            <button className="text-button" onClick={() => logout()}>
              Sign out
            </button>
          )}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Voxel Ventures · South Africa</span>
          <span>Designed & engineered by Phindile Sandi.</span>
        </div>
      </footer>
    </>
  );
}
