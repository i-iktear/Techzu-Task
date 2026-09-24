import { useEffect, useState } from 'react';
import { api } from '../api';

const SUBTABS = ['Master Menu', 'Assign to Outlet', 'Inventory', 'Reports'];

export default function HqView({ outlets }) {
  const [subtab, setSubtab] = useState(SUBTABS[0]);

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {SUBTABS.map((t) => (
          <button key={t} className={subtab === t ? 'active' : ''} onClick={() => setSubtab(t)}>
            {t}
          </button>
        ))}
      </div>

      {subtab === 'Master Menu' && <MasterMenuPanel />}
      {subtab === 'Assign to Outlet' && <AssignPanel outlets={outlets} />}
      {subtab === 'Inventory' && <InventoryPanel outlets={outlets} />}
      {subtab === 'Reports' && <ReportsPanel outlets={outlets} />}
    </div>
  );
}

function MasterMenuPanel() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', basePrice: '' });
  const [error, setError] = useState(null);

  function refresh() {
    api.getMasterMenu().then(setItems).catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.createMasterMenuItem({
        name: form.name,
        basePrice: Number(form.basePrice),
      });
      setForm({ name: '', basePrice: '' });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Master Menu Items</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Base Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>Tk {Number(i.base_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add Menu Item</h3>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8 }}>
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="Base price"
            value={form.basePrice}
            onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
            required
          />
          <button className="primary" type="submit">
            Create
          </button>
        </form>
      </div>
    </div>
  );
}

function AssignPanel({ outlets }) {
  const [masterItems, setMasterItems] = useState([]);
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? null);
  const [menuItemId, setMenuItemId] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [assigned, setAssigned] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.getMasterMenu().then(setMasterItems).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!outletId) return;
    api.getOutletMenu(outletId).then(setAssigned).catch((err) => setError(err.message));
  }, [outletId]);

  async function handleAssign(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.assignMenuItem(outletId, {
        menuItemId: Number(menuItemId),
        priceOverride: priceOverride === '' ? null : Number(priceOverride),
      });
      setMessage('Assigned.');
      const refreshed = await api.getOutletMenu(outletId);
      setAssigned(refreshed);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Assign Menu Item to Outlet</h3>
        {error && <div className="error-banner">{error}</div>}
        {message && <p className="muted">{message}</p>}
        <form onSubmit={handleAssign} style={{ display: 'grid', gap: 8 }}>
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
          <label>
            Menu item:{' '}
            <select value={menuItemId} onChange={(e) => setMenuItemId(e.target.value)} required>
              <option value="" disabled>
                select an item
              </option>
              {masterItems.map((mi) => (
                <option key={mi.id} value={mi.id}>
                  {mi.name} (Tk {Number(mi.base_price).toFixed(2)})
                </option>
              ))}
            </select>
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="Price override (optional)"
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value)}
          />
          <button className="primary" type="submit">
            Assign
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Currently Assigned</h3>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Effective Price</th>
            </tr>
          </thead>
          <tbody>
            {assigned.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>Tk {Number(a.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryPanel({ outlets }) {
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? null);
  const [stock, setStock] = useState([]);
  const [error, setError] = useState(null);

  function refresh() {
    if (!outletId) return;
    api.getInventory(outletId).then(setStock).catch((err) => setError(err.message));
  }

  useEffect(refresh, [outletId]);

  async function handleChange(menuItemId, quantity) {
    setError(null);
    try {
      await api.setStock(outletId, { menuItemId, quantity: Number(quantity) });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
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
      {error && <div className="error-banner">{error}</div>}
      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((s) => (
            <tr key={s.menu_item_id}>
              <td>{s.name}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  defaultValue={s.quantity}
                  style={{ width: 80 }}
                  onBlur={(e) => handleChange(s.menu_item_id, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsPanel({ outlets }) {
  const [revenue, setRevenue] = useState([]);
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? null);
  const [topItems, setTopItems] = useState([]);

  useEffect(() => {
    api.getRevenueByOutlet().then(setRevenue).catch(() => {});
  }, []);

  useEffect(() => {
    if (!outletId) return;
    api.getTopItems(outletId).then(setTopItems).catch(() => {});
  }, [outletId]);

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Revenue by Outlet</h3>
        <table>
          <thead>
            <tr>
              <th>Outlet</th>
              <th>Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {revenue.map((r) => (
              <tr key={r.outlet_id}>
                <td>{r.outlet_name}</td>
                <td>Tk {Number(r.total_revenue).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Top 5 Items</h3>
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
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty Sold</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topItems.map((t) => (
              <tr key={t.menu_item_id}>
                <td>{t.name}</td>
                <td>{t.total_quantity}</td>
                <td>Tk {Number(t.total_revenue).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
