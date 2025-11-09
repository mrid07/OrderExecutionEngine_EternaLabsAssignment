CREATE INDEX IF NOT EXISTS idx_order_history_order_id_created
  ON order_status_history (order_id, created_at);