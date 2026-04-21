USE online_retail;

INSERT INTO users (role_id, first_name, last_name, email, phone, password_hash, is_active)
SELECT r.role_id, 'Admin', 'User', 'admin@storeflow.test', '0710000000',
       '$2a$10$d6fUFLstxfSIDXCqNzfKIel0wJeaQ.pQVOjPukznU023C76I7ldmK', 1
FROM roles r
WHERE r.role_name = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'admin@storeflow.test'
  );

INSERT INTO users (role_id, first_name, last_name, email, phone, password_hash, is_active)
SELECT r.role_id, 'Test', 'Customer', 'user@storeflow.test', '0720000000',
       '$2a$10$HjYZjDUI7jfnWHiEDX0YBuxn0q8UepJ3SCEc.MlsMUalQ3C5oR/mm', 1
FROM roles r
WHERE r.role_name = 'CUSTOMER'
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'user@storeflow.test'
  );

INSERT INTO carts (user_id)
SELECT u.user_id
FROM users u
WHERE u.email IN ('admin@storeflow.test', 'user@storeflow.test')
  AND NOT EXISTS (
    SELECT 1 FROM carts c WHERE c.user_id = u.user_id
  );
