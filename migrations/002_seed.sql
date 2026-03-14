-- ═══════════════════════════════════════════════════════════════
-- CoreInventory — Seed Data
-- Run AFTER 001_schema.sql
-- ═══════════════════════════════════════════════════════════════

-- Virtual system locations (required for stock moves)
INSERT INTO locations (id, warehouse_id, name, type) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'Vendors',               'virtual'),
  ('00000000-0000-0000-0000-000000000002', NULL, 'Customers',             'virtual'),
  ('00000000-0000-0000-0000-000000000003', NULL, 'Inventory Adjustment',  'virtual')
ON CONFLICT DO NOTHING;

-- Default admin user (password: Admin@123)
-- Hash generated with: bcrypt.hashSync('Admin@123', 12)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Rahul Sharma', 'admin@coreinventory.local',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0OdWn9kpKe', 'manager')
ON CONFLICT DO NOTHING;

-- Warehouses
INSERT INTO warehouses (id, name, short_code, address) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Main Warehouse',      'MWH', 'Plot 12, GIDC Vatva, Ahmedabad'),
  ('a0000002-0000-0000-0000-000000000002', 'Production Facility', 'PRD', 'Survey No. 45, Sanand, Ahmedabad'),
  ('a0000003-0000-0000-0000-000000000003', 'Satellite Store',     'SAT', 'Ring Road, Narol, Ahmedabad')
ON CONFLICT DO NOTHING;

-- Locations for Main Warehouse
INSERT INTO locations (warehouse_id, name, type) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Receiving Zone',  'input'),
  ('a0000001-0000-0000-0000-000000000001', 'Steel Rack A',    'storage'),
  ('a0000001-0000-0000-0000-000000000001', 'Steel Rack B',    'storage'),
  ('a0000001-0000-0000-0000-000000000001', 'Dispatch Bay',    'output'),
  ('a0000002-0000-0000-0000-000000000002', 'Raw Materials',   'input'),
  ('a0000002-0000-0000-0000-000000000002', 'Work In Progress','storage'),
  ('a0000002-0000-0000-0000-000000000002', 'Finished Goods',  'output'),
  ('a0000003-0000-0000-0000-000000000003', 'General Storage', 'storage'),
  ('a0000003-0000-0000-0000-000000000003', 'Cold Room',       'storage')
ON CONFLICT DO NOTHING;

-- Categories
INSERT INTO categories (name, code) VALUES
  ('Steel & Metals', 'STL'),
  ('Plastics',       'PLT'),
  ('Electrical',     'ELC'),
  ('Chemicals',      'CHM'),
  ('Hardware',       'HRD'),
  ('Packaging',      'PKG')
ON CONFLICT DO NOTHING;

-- Products (SKUs auto-uppercased by trigger)
INSERT INTO products (name, sku, category_id, uom, reorder_min, reorder_max) VALUES
  ('Steel Rods 12mm',        'STL-ROD-001', (SELECT id FROM categories WHERE code='STL'), 'kg',    100, 500),
  ('Steel Plates 4mm',       'STL-PLT-002', (SELECT id FROM categories WHERE code='STL'), 'kg',    100, 400),
  ('PVC Sheet 3mm',          'PLT-SHT-001', (SELECT id FROM categories WHERE code='PLT'), 'pcs',    50, 200),
  ('Copper Wire 2.5mm',      'ELC-CBL-001', (SELECT id FROM categories WHERE code='ELC'), 'm',     300,1500),
  ('Hex Bolts M8',           'HRD-BLT-001', (SELECT id FROM categories WHERE code='HRD'), 'pcs', 1000,8000),
  ('Lubricant Oil 5L',       'CHM-OIL-001', (SELECT id FROM categories WHERE code='CHM'), 'liters', 30, 100),
  ('Cardboard Box L',        'PKG-BOX-001', (SELECT id FROM categories WHERE code='PKG'), 'pcs',   100, 500),
  ('GI Pipe 1 inch',         'STL-PIP-001', (SELECT id FROM categories WHERE code='STL'), 'm',      50, 200),
  ('Circuit Breaker 32A',    'ELC-SWT-001', (SELECT id FROM categories WHERE code='ELC'), 'pcs',    50, 200),
  ('Hex Nuts M8',            'HRD-NUT-001', (SELECT id FROM categories WHERE code='HRD'), 'pcs', 2000,10000),
  ('Polypropylene Pellets',  'PLT-PPL-001', (SELECT id FROM categories WHERE code='PLT'), 'kg',    200, 800),
  ('Hydrochloric Acid 35%',  'CHM-ACD-001', (SELECT id FROM categories WHERE code='CHM'), 'liters', 20,  80),
  ('Stretch Wrap Film',      'PKG-WRP-001', (SELECT id FROM categories WHERE code='PKG'), 'rolls',  20,  80),
  ('Angle Iron 50x50',       'STL-ANG-001', (SELECT id FROM categories WHERE code='STL'), 'm',     100, 400),
  ('Wood Screws 50mm',       'HRD-SCR-001', (SELECT id FROM categories WHERE code='HRD'), 'pcs', 2000,15000)
ON CONFLICT DO NOTHING;

-- Initial stock quants
INSERT INTO stock_quants (product_id, location_id, on_hand_qty)
SELECT p.id, l.id, q.qty
FROM (VALUES
  ('STL-ROD-001', 'Steel Rack A',    270),
  ('STL-ROD-001', 'Steel Rack B',    180),
  ('STL-PLT-002', 'Steel Rack A',     55),
  ('STL-PLT-002', 'Steel Rack B',     25),
  ('ELC-CBL-001', 'Steel Rack A',    800),
  ('ELC-CBL-001', 'Steel Rack B',    400),
  ('HRD-BLT-001', 'General Storage',3500),
  ('HRD-BLT-001', 'Steel Rack A',   1500),
  ('CHM-OIL-001', 'General Storage',  18),
  ('PKG-BOX-001', 'General Storage', 120),
  ('PKG-BOX-001', 'Steel Rack A',     80),
  ('ELC-SWT-001', 'Raw Materials',    45),
  ('HRD-NUT-001', 'General Storage',5000),
  ('HRD-NUT-001', 'Steel Rack A',   3000),
  ('PLT-PPL-001', 'Raw Materials',   600),
  ('PKG-WRP-001', 'General Storage',  40),
  ('STL-ANG-001', 'Steel Rack A',    200),
  ('STL-ANG-001', 'Steel Rack B',    120),
  ('HRD-SCR-001', 'General Storage',8000),
  ('HRD-SCR-001', 'Steel Rack A',   4000)
) AS q(sku, loc_name, qty)
JOIN products   p ON p.sku = q.sku
JOIN locations  l ON l.name = q.loc_name
ON CONFLICT (product_id, location_id) DO NOTHING;
