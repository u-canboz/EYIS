-- EYIS Database Install Pack — Migration History Reconciliation.
-- Registriert die im Baseline enthaltenen Strukturversionen als bereits angewendet.
-- Ohne diesen Schritt würde ein späteres `supabase db push` die komplette
-- historische Kette erneut ausführen und die Installation zerstören.

CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
SELECT v.version, 'eyis_baseline_1.0.0'
FROM (VALUES
  ('20260825074450'),
  ('20260825074512'),
  ('20260825080717'),
  ('20260825080734'),
  ('20260825080758'),
  ('20260825102705'),
  ('20260825104705'),
  ('20260825104935'),
  ('20260825120552'),
  ('20260825120653'),
  ('20260825120720'),
  ('20260825125500'),
  ('20260825125535'),
  ('20260825143734'),
  ('20260825153537'),
  ('20260825153618'),
  ('20260825153648'),
  ('20260825155019'),
  ('20260825162256'),
  ('20260825162519'),
  ('20260825162621'),
  ('20260825163626'),
  ('20260825163933'),
  ('20260825174112'),
  ('20260825174145'),
  ('20260825182325'),
  ('20260825182452'),
  ('20260825201721'),
  ('20260825210152'),
  ('20260825210220'),
  ('20260825221017'),
  ('20260825231800'),
  ('20260825232248'),
  ('20260825233026'),
  ('20260825235636'),
  ('20260826000125'),
  ('20260826000328'),
  ('20260826080659'),
  ('20260826081124'),
  ('20260826081318'),
  ('20260826081454'),
  ('20260826081544'),
  ('20260826103237'),
  ('20260826120837'),
  ('20260826121430'),
  ('20260827125825'),
  ('20260827134814'),
  ('20260827143331'),
  ('20260827143416'),
  ('20260827143513'),
  ('20260827211754'),
  ('20260828131048'),
  ('20260828180020'),
  ('20260828213156')
) AS v(version)
ON CONFLICT (version) DO NOTHING;
