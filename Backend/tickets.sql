CREATE DATABASE IF NOT EXISTS tickets_db;
USE tickets_db;
-- Crear tabla de tickets
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('open','in_progress','resolved') NOT NULL DEFAULT 'open',
    priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    tags JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_DATE,
    updated_at DATETIME,
    resolved_at DATETIME
);

-- Inserta dataset inicial
INSERT INTO tickets (
  id,
  title,
  description,
  status,
  priority,
  tags,
  created_at,
  updated_at
) VALUES
(
  1,
  'No carga el dashboard',
  'Pantalla en blanco al entrar',
  'open',
  'high',
  JSON_ARRAY('ui'),                  
  '2025-08-01 10:00:00',            
  '2025-08-01 10:00:00'
),
(
  2,
  'Error 500 en /auth',
  'Falla ocasional al iniciar sesión',
  'in_progress',
  'medium',
  JSON_ARRAY('backend', 'auth'),
  '2025-08-02 10:00:00',
  '2025-08-02 12:00:00'
);