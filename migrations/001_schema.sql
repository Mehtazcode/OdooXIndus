-- ═══════════════════════════════════════════════════════════════
-- CoreInventory — Full Database Schema
-- PostgreSQL 15 · Self-hosted · No ORM
-- ═══════════════════════════════════════════════════════════════

-- ─── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── CUSTOM ENUMS ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('manager', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE location_type AS ENUM ('input', 'storage', 'output', 'virtual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE operation_type AS ENUM ('receipt', 'delivery', 'transfer', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE operation_status AS ENUM ('draft', 'waiting', 'ready', 'done', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE adjustment_reason AS ENUM ('physical_count', 'damage', 'theft', 'expiry', 'error', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── TABLE: users ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(120) NOT NULL CHECK (trim(name) <> ''),
  email           VARCHAR(255) NOT NULL CHECK (email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'),
  password_hash   TEXT        NOT NULL CHECK (length(password_hash) >= 60),
  role            user_role   NOT NULL DEFAULT 'staff',
  failed_attempts SMALLINT    NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until    TIMESTAMPTZ,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));

-- ─── TABLE: otp_tokens ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_user_active ON otp_tokens (user_id) WHERE used_at IS NULL;

-- ─── TABLE: warehouses ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL UNIQUE CHECK (trim(name) <> ''),
  short_code  VARCHAR(5)  NOT NULL UNIQUE CHECK (short_code ~ '^[A-Z0-9]{2,5}$'),
  address     TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TABLE: locations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID          REFERENCES warehouses(id) ON DELETE RESTRICT,
  parent_id    UUID          REFERENCES locations(id) ON DELETE RESTRICT,
  name         VARCHAR(120)  NOT NULL CHECK (trim(name) <> ''),
  type         location_type NOT NULL,
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, name),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON locations (warehouse_id);

-- ─── TABLE: categories ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE CHECK (trim(name) <> ''),
  code        VARCHAR(20)  UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TABLE: products ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120) NOT NULL CHECK (trim(name) <> ''),
  sku          VARCHAR(60)  NOT NULL UNIQUE CHECK (sku ~ '^[A-Z0-9_\-]{2,60}$'),
  category_id  UUID         NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  uom          VARCHAR(30)  NOT NULL CHECK (trim(uom) <> ''),
  description  TEXT,
  reorder_min  DECIMAL(12,3) CHECK (reorder_min IS NULL OR reorder_min >= 0),
  reorder_max  DECIMAL(12,3) CHECK (reorder_max IS NULL OR reorder_max >= 0),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (reorder_max IS NULL OR reorder_min IS NULL OR reorder_max >= reorder_min)
);
CREATE INDEX IF NOT EXISTS idx_products_sku      ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);

-- ─── TABLE: stock_quants ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_quants (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id  UUID          NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  on_hand_qty  DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (on_hand_qty >= 0),
  reserved_qty DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, location_id),
  CONSTRAINT reserved_lte_on_hand CHECK (reserved_qty <= on_hand_qty)
);
CREATE INDEX IF NOT EXISTS idx_quants_product  ON stock_quants (product_id);
CREATE INDEX IF NOT EXISTS idx_quants_location ON stock_quants (location_id);

-- ─── TABLE: sequences ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sequences (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type  operation_type NOT NULL,
  year            SMALLINT       NOT NULL CHECK (year >= 2020),
  last_value      INTEGER        NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  UNIQUE (operation_type, year)
);

-- ─── TABLE: operations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS operations (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        VARCHAR(30)      NOT NULL UNIQUE,
  type             operation_type   NOT NULL,
  status           operation_status NOT NULL DEFAULT 'draft',
  source_location_id UUID           REFERENCES locations(id) ON DELETE RESTRICT,
  dest_location_id UUID             NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  partner_name     VARCHAR(120)     CHECK (partner_name IS NULL OR trim(partner_name) <> ''),
  scheduled_date   DATE             NOT NULL,
  notes            TEXT,
  validated_at     TIMESTAMPTZ,
  validated_by     UUID             REFERENCES users(id) ON DELETE RESTRICT,
  created_by       UUID             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  backorder_of     UUID             REFERENCES operations(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CHECK (
    (validated_at IS NULL AND validated_by IS NULL) OR
    (validated_at IS NOT NULL AND validated_by IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_ops_type_status   ON operations (type, status);
CREATE INDEX IF NOT EXISTS idx_ops_scheduled     ON operations (scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_ops_created_by    ON operations (created_by);

-- ─── TABLE: operation_lines ──────────────────────────────────
CREATE TABLE IF NOT EXISTS operation_lines (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id    UUID              NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  product_id      UUID              NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  demand_qty      DECIMAL(12,3)     NOT NULL CHECK (demand_qty >= 0),
  done_qty        DECIMAL(12,3)     NOT NULL DEFAULT 0 CHECK (done_qty >= 0),
  adj_reason      adjustment_reason,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (operation_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_oplines_operation ON operation_lines (operation_id);
CREATE INDEX IF NOT EXISTS idx_oplines_product   ON operation_lines (product_id);

-- ─── TABLE: stock_moves (IMMUTABLE LEDGER) ───────────────────
CREATE TABLE IF NOT EXISTS stock_moves (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id     UUID          REFERENCES operations(id) ON DELETE RESTRICT,
  operation_line_id UUID         REFERENCES operation_lines(id) ON DELETE RESTRICT,
  product_id       UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  from_location_id UUID          NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id   UUID          NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  qty              DECIMAL(12,3) NOT NULL CHECK (qty > 0),
  moved_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  moved_by         UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_moves_operation ON stock_moves (operation_id);
CREATE INDEX IF NOT EXISTS idx_moves_product   ON stock_moves (product_id);
CREATE INDEX IF NOT EXISTS idx_moves_moved_at  ON stock_moves (moved_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- 1. Auto-update updated_at on every table
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT unnest(ARRAY['users','warehouses','locations','categories','products','stock_quants','operations','operation_lines']) LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t, t);
END LOOP; END $$;

-- 2. Force SKU uppercase
CREATE OR REPLACE FUNCTION fn_sku_uppercase()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.sku = UPPER(NEW.sku); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_sku_uppercase ON products;
CREATE TRIGGER trg_sku_uppercase
  BEFORE INSERT OR UPDATE OF sku ON products
  FOR EACH ROW EXECUTE FUNCTION fn_sku_uppercase();

-- 3. Immutable stock_moves ledger
CREATE OR REPLACE FUNCTION fn_immutable_moves()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'stock_moves rows are immutable — ledger cannot be modified'; END $$;

DROP TRIGGER IF EXISTS trg_immutable_moves ON stock_moves;
CREATE TRIGGER trg_immutable_moves
  BEFORE UPDATE OR DELETE ON stock_moves
  FOR EACH ROW EXECUTE FUNCTION fn_immutable_moves();

-- 4. Operation status machine (enforce valid transitions)
CREATE OR REPLACE FUNCTION fn_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE allowed TEXT[][] := ARRAY[
  ARRAY['draft',    'waiting'],
  ARRAY['draft',    'canceled'],
  ARRAY['waiting',  'ready'],
  ARRAY['waiting',  'done'],
  ARRAY['waiting',  'canceled'],
  ARRAY['ready',    'done'],
  ARRAY['ready',    'canceled']
];
  pair TEXT[];
  ok BOOLEAN := FALSE;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status IN ('done','canceled') THEN
    RAISE EXCEPTION 'Cannot change status of a % operation', OLD.status;
  END IF;
  FOREACH pair SLICE 1 IN ARRAY allowed LOOP
    IF pair[1] = OLD.status::TEXT AND pair[2] = NEW.status::TEXT THEN ok := TRUE; EXIT; END IF;
  END LOOP;
  IF NOT ok THEN
    RAISE EXCEPTION 'Invalid status transition: % → %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_status_transition ON operations;
CREATE TRIGGER trg_status_transition
  BEFORE UPDATE OF status ON operations
  FOR EACH ROW EXECUTE FUNCTION fn_status_transition();

-- 5. Protect virtual locations from deletion
CREATE OR REPLACE FUNCTION fn_protect_virtual()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.type = 'virtual' THEN
    RAISE EXCEPTION 'Virtual locations (%, %) cannot be deleted', OLD.name, OLD.id;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_protect_virtual ON locations;
CREATE TRIGGER trg_protect_virtual
  BEFORE DELETE ON locations
  FOR EACH ROW EXECUTE FUNCTION fn_protect_virtual();

-- 6. Adjustment reason required
CREATE OR REPLACE FUNCTION fn_adj_reason_required()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE op_type operation_type;
BEGIN
  SELECT type INTO op_type FROM operations WHERE id = NEW.operation_id;
  IF op_type = 'adjustment' AND NEW.adj_reason IS NULL THEN
    RAISE EXCEPTION 'adj_reason is required for adjustment operation lines';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_adj_reason ON operation_lines;
CREATE TRIGGER trg_adj_reason
  BEFORE INSERT OR UPDATE ON operation_lines
  FOR EACH ROW EXECUTE FUNCTION fn_adj_reason_required();

-- ═══════════════════════════════════════════════════════════════
-- CORE FUNCTION: next_reference — race-condition-safe ref numbers
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION next_reference(p_type operation_type)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  yr       SMALLINT := EXTRACT(YEAR FROM NOW());
  next_val INTEGER;
  prefix   TEXT;
BEGIN
  INSERT INTO sequences (operation_type, year, last_value)
    VALUES (p_type, yr, 1)
    ON CONFLICT (operation_type, year)
    DO UPDATE SET last_value = sequences.last_value + 1
    RETURNING last_value INTO next_val;

  prefix := CASE p_type
    WHEN 'receipt'    THEN 'REC'
    WHEN 'delivery'   THEN 'DEL'
    WHEN 'transfer'   THEN 'INT'
    WHEN 'adjustment' THEN 'ADJ'
  END;
  RETURN prefix || '/' || yr || '/' || LPAD(next_val::TEXT, 4, '0');
END $$;

-- ═══════════════════════════════════════════════════════════════
-- CORE FUNCTION: validate_operation — THE main stock logic
-- Serializable transaction: all-or-nothing
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION validate_operation(
  p_op_id  UUID,
  p_user_id UUID
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  op           operations%ROWTYPE;
  line         operation_lines%ROWTYPE;
  src_quant    stock_quants%ROWTYPE;
  dst_quant    stock_quants%ROWTYPE;
  avail        DECIMAL(12,3);
  theoretical  DECIMAL(12,3);
  diff         DECIMAL(12,3);
  from_loc_id  UUID;
  to_loc_id    UUID;
  vendor_loc   UUID;
  customer_loc UUID;
  adj_loc      UUID;
BEGIN
  -- Get virtual location IDs
  SELECT id INTO vendor_loc   FROM locations WHERE name='Vendors'              AND type='virtual';
  SELECT id INTO customer_loc FROM locations WHERE name='Customers'             AND type='virtual';
  SELECT id INTO adj_loc      FROM locations WHERE name='Inventory Adjustment'  AND type='virtual';

  -- Lock the operation row (prevents concurrent double-validation)
  SELECT * INTO op FROM operations WHERE id = p_op_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Operation not found'); END IF;
  IF op.status = 'done'     THEN RETURN jsonb_build_object('ok', false, 'error', 'Operation already validated'); END IF;
  IF op.status = 'canceled' THEN RETURN jsonb_build_object('ok', false, 'error', 'Operation is canceled'); END IF;

  -- Must have at least one line with done_qty > 0
  IF NOT EXISTS (SELECT 1 FROM operation_lines WHERE operation_id = p_op_id AND done_qty > 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No done quantities entered. Fill Done Qty for at least one line.');
  END IF;

  -- Check stock availability for delivery / transfer
  IF op.type IN ('delivery', 'transfer') THEN
    FOR line IN SELECT * FROM operation_lines WHERE operation_id = p_op_id AND done_qty > 0 LOOP
      SELECT * INTO src_quant FROM stock_quants
        WHERE product_id = line.product_id AND location_id = op.source_location_id;
      avail := COALESCE(src_quant.on_hand_qty, 0) - COALESCE(src_quant.reserved_qty, 0);
      IF line.done_qty > COALESCE(src_quant.on_hand_qty, 0) THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', format('Insufficient stock for product %s. On hand: %s, Requested: %s',
            line.product_id, COALESCE(src_quant.on_hand_qty, 0), line.done_qty)
        );
      END IF;
    END LOOP;
  END IF;

  -- Execute stock moves
  FOR line IN SELECT * FROM operation_lines WHERE operation_id = p_op_id AND done_qty > 0 LOOP

    IF op.type = 'receipt' THEN
      from_loc_id := vendor_loc;
      to_loc_id   := op.dest_location_id;
      -- Increase destination
      INSERT INTO stock_quants (product_id, location_id, on_hand_qty, reserved_qty)
        VALUES (line.product_id, to_loc_id, line.done_qty, 0)
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET on_hand_qty = stock_quants.on_hand_qty + line.done_qty, updated_at = NOW();

    ELSIF op.type = 'delivery' THEN
      from_loc_id := op.source_location_id;
      to_loc_id   := customer_loc;
      -- Decrease source
      UPDATE stock_quants
        SET on_hand_qty = on_hand_qty - line.done_qty, updated_at = NOW()
        WHERE product_id = line.product_id AND location_id = from_loc_id;

    ELSIF op.type = 'transfer' THEN
      from_loc_id := op.source_location_id;
      to_loc_id   := op.dest_location_id;
      -- Decrease source
      UPDATE stock_quants
        SET on_hand_qty = on_hand_qty - line.done_qty, updated_at = NOW()
        WHERE product_id = line.product_id AND location_id = from_loc_id;
      -- Increase destination
      INSERT INTO stock_quants (product_id, location_id, on_hand_qty, reserved_qty)
        VALUES (line.product_id, to_loc_id, line.done_qty, 0)
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET on_hand_qty = stock_quants.on_hand_qty + line.done_qty, updated_at = NOW();

    ELSIF op.type = 'adjustment' THEN
      theoretical := line.demand_qty;
      diff := line.done_qty - theoretical;
      IF diff > 0 THEN
        from_loc_id := adj_loc;
        to_loc_id   := op.dest_location_id;
        INSERT INTO stock_quants (product_id, location_id, on_hand_qty, reserved_qty)
          VALUES (line.product_id, to_loc_id, line.done_qty, 0)
          ON CONFLICT (product_id, location_id)
          DO UPDATE SET on_hand_qty = line.done_qty, updated_at = NOW();
      ELSIF diff < 0 THEN
        from_loc_id := op.source_location_id;
        to_loc_id   := adj_loc;
        UPDATE stock_quants
          SET on_hand_qty = line.done_qty, updated_at = NOW()
          WHERE product_id = line.product_id AND location_id = from_loc_id;
      ELSE
        CONTINUE; -- no change
      END IF;
    END IF;

    -- Write immutable ledger entry
    IF op.type != 'adjustment' OR diff != 0 THEN
      INSERT INTO stock_moves (operation_id, operation_line_id, product_id, from_location_id, to_location_id, qty, moved_at, moved_by)
        VALUES (p_op_id, line.id, line.product_id, from_loc_id, to_loc_id,
          CASE WHEN op.type = 'adjustment' THEN abs(diff) ELSE line.done_qty END,
          NOW(), p_user_id);
    END IF;

  END LOOP;

  -- Mark operation done
  UPDATE operations SET status = 'done', validated_at = NOW(), validated_by = p_user_id WHERE id = p_op_id;

  RETURN jsonb_build_object('ok', true, 'reference', op.reference);
END $$;
