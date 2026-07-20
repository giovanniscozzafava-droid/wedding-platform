-- (No-op, tenuto per onestà dello storico.) Qui avevo tentato di accendere le email
-- server-side con ALTER DATABASE/ROLE SET app.* → permission denied: il migration role
-- di Supabase gestito non può settare parametri di sistema. Il fix reale (config in
-- tabella + set_config locale) è in 20260720140000_notify_config.sql.
select 1;
