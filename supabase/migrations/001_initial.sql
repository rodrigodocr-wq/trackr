-- ============================================================
-- TRACKR — Migration inicial
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STORES
-- ============================================================
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_domain TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'support' CHECK (role IN ('admin', 'manager', 'support')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  shopify_customer_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, shopify_customer_id)
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  shopify_order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  product_name TEXT,
  shipping_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','processing','in_transit','out_for_delivery','delivered','cancelled')
  ),
  tracking_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(store_id, shopify_order_id)
);

-- ============================================================
-- TRACKING RECORDS
-- ============================================================
CREATE TABLE tracking_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  tracking_id TEXT UNIQUE NOT NULL,
  current_day INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================================
-- TRACKING EVENTS
-- ============================================================
CREATE TABLE tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_record_id UUID REFERENCES tracking_records(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMAIL LOGS
-- ============================================================
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL,
  email_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
  tracking_duration_days INTEGER DEFAULT 120,
  email_from_name TEXT DEFAULT 'Suporte',
  tracking_page_title TEXT DEFAULT 'Acompanhe seu pedido',
  timeline_milestones JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEFAULT TIMELINE MILESTONES (inserido junto com a store)
-- ============================================================
CREATE OR REPLACE FUNCTION insert_default_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO settings (store_id, timeline_milestones)
  VALUES (NEW.id, '[
    {"day": 1,   "title": "Pedido Confirmado",                    "description": "Seu pedido foi recebido e confirmado."},
    {"day": 3,   "title": "Pedido em Processamento",              "description": "Estamos preparando o seu pedido."},
    {"day": 5,   "title": "Preparação Logística",                 "description": "Seu pedido está sendo preparado para envio."},
    {"day": 8,   "title": "Atualização de Acompanhamento",        "description": "Seu pedido segue em processamento."},
    {"day": 12,  "title": "Verificação de Status",                "description": "Seu pedido está em trânsito."},
    {"day": 16,  "title": "Atualização de Entrega",               "description": "Seu pedido avança em direção ao destino."},
    {"day": 20,  "title": "Acompanhamento em Andamento",          "description": "Seu pedido continua a caminho."},
    {"day": 25,  "title": "Nova Atualização Disponível",          "description": "Seu pedido está progredindo normalmente."},
    {"day": 30,  "title": "Chegando ao Reino Unido",              "description": "Seu pedido está chegando ao Reino Unido."},
    {"day": 35,  "title": "Acompanhamento Ativo",                 "description": "Seu pedido está em distribuição local."},
    {"day": 40,  "title": "Atualização de Entrega",               "description": "Seu pedido está na fase final de entrega."},
    {"day": 45,  "title": "Aviso de Prazo",                       "description": "Seu pedido está quase chegando."},
    {"day": 50,  "title": "Verificação Automática",               "description": "Seu pedido está próximo do seu endereço."},
    {"day": 55,  "title": "Atualização de Status",                "description": "Seu pedido está em rota de entrega."},
    {"day": 60,  "title": "Revisão de Progresso",                 "description": "Seu pedido está chegando a qualquer momento."},
    {"day": 65,  "title": "Atualização Operacional",              "description": "Seu pedido está na sua região."},
    {"day": 70,  "title": "Nova Verificação",                     "description": "Seu pedido saiu para entrega."},
    {"day": 75,  "title": "Atualização de Prazo",                 "description": "Entrega iminente no seu endereço."},
    {"day": 80,  "title": "Acompanhamento Ativo",                 "description": "Seu pedido está chegando."},
    {"day": 85,  "title": "Revisão Automática",                   "description": "Seu pedido está a caminho da sua porta."},
    {"day": 90,  "title": "Verificação de Entrega",               "description": "Seu pedido está chegando ao seu endereço."},
    {"day": 95,  "title": "Atualização Disponível",               "description": "Entrega prevista nos próximos dias."},
    {"day": 100, "title": "Revisão de Prazo",                     "description": "Seu pedido continua a caminho."},
    {"day": 105, "title": "Atualização Final de Acompanhamento",  "description": "Seu pedido está na reta final."},
    {"day": 110, "title": "Entrega Próxima da Janela Final",      "description": "Entrega muito próxima do seu endereço."},
    {"day": 115, "title": "Verificação Final",                    "description": "Seu pedido está chegando agora."}
  ]'::jsonb);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_store_insert
AFTER INSERT ON stores
FOR EACH ROW EXECUTE FUNCTION insert_default_settings();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- tracking_records e tracking_events são públicos (página /track)
CREATE POLICY "Public can read tracking_records"
  ON tracking_records FOR SELECT USING (true);

CREATE POLICY "Public can read tracking_events"
  ON tracking_events FOR SELECT USING (true);

CREATE POLICY "Public can read orders for tracking"
  ON orders FOR SELECT USING (true);

-- Service role tem acesso total (usado pelo backend)
CREATE POLICY "Service role full access on stores"
  ON stores USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on customers"
  ON customers USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on orders"
  ON orders USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on tracking_records"
  ON tracking_records USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on tracking_events"
  ON tracking_events USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on email_logs"
  ON email_logs USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on settings"
  ON settings USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on users"
  ON users USING (true) WITH CHECK (true);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_orders_tracking_id ON orders(tracking_id);
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_tracking_records_tracking_id ON tracking_records(tracking_id);
CREATE INDEX idx_tracking_events_record_id ON tracking_events(tracking_record_id);
CREATE INDEX idx_email_logs_order_id ON email_logs(order_id);
