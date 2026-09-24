import { useEffect, useState } from 'react';
import { api } from '../api';

export default function PosView({ outlets }) {
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({}); // menuItemId -> quantity
  const [lastReceipt, setLastReceipt] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!outletId) return;
    setError(null);
    setLastReceipt(null);
    setCart({});
    api.getOutletMenu(outletId).then(setMenu).catch((err) => setError(err.message));
  }, [outletId]);

  function addToCart(menuItemId) {
    setCart((prev) => ({ ...prev, [menuItemId]: (prev[menuItemId] || 0) + 1 }));
  }

  function updateQty(menuItemId, qty) {
    const value = Math.max(0, Number(qty) || 0);
    setCart((prev) => ({ ...prev, [menuItemId]: value }));
  }

  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([menuItemId, qty]) => {
      const item = menu.find((m) => String(m.id) === menuItemId);
      return { menuItemId: Number(menuItemId), quantity: qty, item };
    });

  const total = cartItems.reduce((sum, ci) => sum + (ci.item ? Number(ci.item.price) * ci.quantity : 0), 0);

  async function submitSale() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const sale = await api.createSale(
        outletId,
        cartItems.map(({ menuItemId, quantity }) => ({ menuItemId, quantity }))
      );
      setLastReceipt(sale);
      setCart({});
      // stock changed, refresh menu availability isn't strictly needed here
      // since /menu doesn't return stock, but re-fetch keeps things fresh
      const refreshed = await api.getOutletMenu(outletId);
      setMenu(refreshed);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-2">
      <div>
        <div className="card">
          <label>
            Outlet:{' '}
            <select value={outletId ?? ''} onChange={(e) => setOutletId(Number(e.target.value))}>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Menu</h3>
          {menu.length === 0 && <p className="muted">No items assigned to this outlet yet.</p>}
          {menu.map((item) => (
            <div className="menu-item-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>{' '}
                <span className="muted">Tk {Number(item.price).toFixed(2)}</span>
              </div>
              <button className="secondary" onClick={() => addToCart(item.id)}>
                Add
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Current Order</h3>
          {cartItems.length === 0 && <p className="muted">Cart is empty.</p>}
          {cartItems.map(({ menuItemId, quantity, item }) => (
            <div className="menu-item-row" key={menuItemId}>
              <span>{item?.name || `#${menuItemId}`}</span>
              <input
                type="number"
                min="0"
                style={{ width: 60 }}
                value={quantity}
                onChange={(e) => updateQty(menuItemId, e.target.value)}
              />
            </div>
          ))}
          {cartItems.length > 0 && (
            <>
              <p>
                <strong>Total: Tk {total.toFixed(2)}</strong>
              </p>
              <button className="primary" onClick={submitSale} disabled={submitting}>
                {submitting ? 'Processing...' : 'Complete Sale'}
              </button>
            </>
          )}
        </div>

        {lastReceipt && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Receipt #{lastReceipt.receipt_number}</h3>
            <div className="receipt">
              {lastReceipt.items.map((li) => (
                <div key={li.menuItemId}>
                  {li.quantity} x item #{li.menuItemId} @ {li.unitPrice} = {li.subtotal}
                </div>
              ))}
              <hr />
              Total: Tk {lastReceipt.total_amount}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
