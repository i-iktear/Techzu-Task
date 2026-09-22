-- initial schema for POS system
-- single company, multiple outlets, HQ-managed master menu

CREATE TABLE outlets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HQ assigns a menu item to an outlet, optionally overriding price for that outlet
CREATE TABLE outlet_menu_items (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    price_override NUMERIC(10, 2) CHECK (price_override >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (outlet_id, menu_item_id)
);

CREATE INDEX idx_outlet_menu_items_outlet ON outlet_menu_items(outlet_id);
CREATE INDEX idx_outlet_menu_items_menu_item ON outlet_menu_items(menu_item_id);

-- stock is tracked per outlet, per menu item
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (outlet_id, menu_item_id)
);

CREATE INDEX idx_inventory_outlet ON inventory(outlet_id);

-- per-outlet counter used to generate sequential receipt numbers safely
-- under concurrent inserts (row lock on UPDATE handles the race)
CREATE TABLE outlet_receipt_counters (
    outlet_id INTEGER PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
    last_receipt_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    receipt_number INTEGER NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (outlet_id, receipt_number)
);

CREATE INDEX idx_sales_outlet_created ON sales(outlet_id, created_at);

CREATE TABLE sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_menu_item ON sale_items(menu_item_id);
