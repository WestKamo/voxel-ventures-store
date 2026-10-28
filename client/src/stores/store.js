import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useShop = create(
  persist(
    (set) => ({
      items: [],
      wishlist: [],
      add(product, variant, quantity = 1) {
        set((state) => {
          const found = state.items.find(
            (i) => i.product === product._id && i.variant === variant._id,
          );
          return {
            items: found
              ? state.items.map((i) =>
                  i === found ? { ...i, quantity: Math.min(99, i.quantity + quantity) } : i,
                )
              : [
                  ...state.items,
                  {
                    product: product._id,
                    variant: variant._id,
                    name: product.name,
                    slug: product.slug,
                    sku: variant.sku,
                    price: variant.price,
                    quantity,
                    image: product.images[0],
                  },
                ],
          };
        });
      },
      quantity(product, variant, quantity) {
        set((s) => ({
          items: s.items.map((i) =>
            i.product === product && i.variant === variant
              ? { ...i, quantity: Math.max(1, Math.min(99, quantity)) }
              : i,
          ),
        }));
      },
      remove(product, variant) {
        set((s) => ({
          items: s.items.filter((i) => !(i.product === product && i.variant === variant)),
        }));
      },
      clear() {
        set({ items: [] });
      },
      wish(product) {
        set((s) => ({
          wishlist: s.wishlist.some((p) => p._id === product._id)
            ? s.wishlist.filter((p) => p._id !== product._id)
            : [...s.wishlist, product],
        }));
      },
    }),
    { name: 'voxel-shop-v2', version: 2 },
  ),
);
