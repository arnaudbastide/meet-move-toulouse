-- Seed roles
INSERT INTO roles (id, name) VALUES (1, 'vendor'), (2, 'user') ON CONFLICT (id) DO NOTHING;