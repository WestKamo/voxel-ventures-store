import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './lib/session';
import Layout from './components/Layout';
import { Loading, ErrorBoundary, Empty } from './components/UI';
const Home = lazy(() => import('./pages/Home'));
const Catalog = lazy(() => import('./pages/Catalog'));
const Product = lazy(() => import('./pages/Product'));
const Auth = lazy(() => import('./pages/Auth'));
const Cart = lazy(() => import('./pages/Cart'));
const Wishlist = lazy(() => import('./pages/Cart').then((m) => ({ default: m.Wishlist })));
const Checkout = lazy(() => import('./pages/Checkout'));
const Custom = lazy(() => import('./pages/Custom'));
const Account = lazy(() => import('./pages/Account'));
const Admin = lazy(() => import('./pages/Admin'));
const Materials = lazy(() => import('./pages/Materials'));
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })));
const OrderDetail = lazy(() => import('./pages/History').then((m) => ({ default: m.OrderDetail })));
const RequestDetail = lazy(() =>
  import('./pages/History').then((m) => ({ default: m.RequestDetail })),
);
export function Protected({ children, admin = false, security = false }) {
  const { user, loading } = useSession();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.forcePasswordChange && !security) return <Navigate to="/account/security" replace />;
  if (admin && user.role !== 'admin') return <Empty title="Administrator access required" />;
  return children;
}
export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="products" element={<Catalog />} />
            <Route path="products/:slug" element={<Product />} />
            <Route path="cart" element={<Cart />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="materials" element={<Materials />} />
            {['login', 'register', 'forgot-password'].map((mode) => (
              <Route key={mode} path={mode} element={<Auth key={mode} mode={mode} />} />
            ))}
            <Route path="reset-password/:token" element={<Auth mode="reset-password" />} />
            <Route
              path="checkout"
              element={
                <Protected>
                  <Checkout />
                </Protected>
              }
            />
            <Route
              path="checkout/custom/:requestId"
              element={
                <Protected>
                  <Checkout />
                </Protected>
              }
            />
            <Route
              path="custom"
              element={
                <Protected>
                  <Custom />
                </Protected>
              }
            />
            <Route
              path="account"
              element={
                <Protected>
                  <Account key="profile" />
                </Protected>
              }
            />
            <Route
              path="account/security"
              element={
                <Protected security>
                  <Account key="security" security />
                </Protected>
              }
            />
            <Route
              path="orders"
              element={
                <Protected>
                  <History />
                </Protected>
              }
            />
            <Route
              path="orders/:id"
              element={
                <Protected>
                  <OrderDetail />
                </Protected>
              }
            />
            <Route
              path="requests"
              element={
                <Protected>
                  <History kind="requests" />
                </Protected>
              }
            />
            <Route
              path="requests/:id"
              element={
                <Protected>
                  <RequestDetail />
                </Protected>
              }
            />
            <Route
              path="admin"
              element={
                <Protected admin>
                  <Admin />
                </Protected>
              }
            />
            <Route
              path="admin/:section"
              element={
                <Protected admin>
                  <Admin />
                </Protected>
              }
            />
            <Route
              path="*"
              element={
                <Empty title="This page hasn’t taken shape.">
                  <a href="/">Return home</a>
                </Empty>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
