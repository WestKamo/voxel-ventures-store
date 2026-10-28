import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useShop } from '../stores/store';
import Cart, { Wishlist } from '../pages/Cart';
import { ProductCard } from './UI';
import Auth from '../pages/Auth';
vi.mock('../lib/hooks', () => ({
  useResource: () => ({ data: { currency: 'ZAR' }, loading: false, error: '' }),
}));
const setUser = vi.fn();
vi.mock('../lib/session', () => ({ useSession: () => ({ user: null, setUser, loading: false }) }));
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal()), api: vi.fn() }));
import { api } from '../lib/api';
const product = {
  _id: 'p1',
  name: 'Contour planter',
  slug: 'contour-planter',
  images: [],
  category: { name: 'Living objects' },
  variants: [{ _id: 'v1', sku: 'PLA-G', price: 24900, stock: 5, material: 'PLA' }],
};
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
beforeEach(() => {
  useShop.setState({ items: [], wishlist: [] });
  vi.clearAllMocks();
});
afterEach(cleanup);
describe('shopping flows', () => {
  it('adds, changes quantity and removes persistent cart items', async () => {
    const user = userEvent.setup();
    useShop.getState().add(product, product.variants[0]);
    wrap(<Cart />);
    expect(screen.getByText('Contour planter')).toBeInTheDocument();
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '2');
    expect(useShop.getState().items[0].quantity).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('A little empty. Full of possibility.')).toBeInTheDocument();
  });
  it('wishlist toggle is accessible and preserves the product', async () => {
    const user = userEvent.setup();
    wrap(<ProductCard product={product} />);
    await user.click(screen.getByRole('button', { name: 'Add to wishlist: Contour planter' }));
    expect(useShop.getState().wishlist).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Remove from wishlist: Contour planter' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
  it('empty wishlist links back to the catalogue', () => {
    wrap(<Wishlist />);
    expect(screen.getByRole('link', { name: 'Explore objects' })).toHaveAttribute(
      'href',
      '/products',
    );
  });
});
describe('account flows', () => {
  it('registers with validated fields and updates session', async () => {
    api.mockResolvedValue({ name: 'Test', role: 'customer' });
    const user = userEvent.setup();
    wrap(<Auth mode="register" />);
    await user.type(screen.getByLabelText('Full name'), 'Test Customer');
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Strong-password-123');
    await user.click(screen.getByRole('button', { name: /Create account/ }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: {
            name: 'Test Customer',
            email: 'test@example.com',
            password: 'Strong-password-123',
          },
        }),
      ),
    );
    expect(setUser).toHaveBeenCalled();
  });
  it('shows a meaningful login failure', async () => {
    api.mockRejectedValue(new Error('Invalid email or password'));
    const user = userEvent.setup();
    wrap(<Auth />);
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /Sign in/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
  it('rejects a short registration password before requesting the API', async () => {
    const user = userEvent.setup();
    wrap(<Auth mode="register" />);
    await user.type(screen.getByLabelText('Full name'), 'Test');
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: /Create account/ }));
    expect(await screen.findByText('Use at least 12 characters')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
