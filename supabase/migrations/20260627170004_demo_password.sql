-- Password demo nota per il test/demo dell'account Tenuta delle Grazie (alias +tenutadellegrazie).
update auth.users
  set encrypted_password = extensions.crypt('Tenuta2026!', extensions.gen_salt('bf')),
      updated_at = now()
where id = 'bfca21ff-3654-4826-bfb5-5e248d5dee34';
