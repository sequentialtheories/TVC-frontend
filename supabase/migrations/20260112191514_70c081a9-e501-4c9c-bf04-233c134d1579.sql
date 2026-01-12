-- Insert missing profiles for users who have wallets but no profiles
INSERT INTO public.profiles (id, user_id, email, name, eth_address)
SELECT 
  gen_random_uuid(),
  uw.user_id,
  COALESCE(au.email, 'unknown@example.com'),
  COALESCE(au.raw_user_meta_data->>'name', 'User'),
  uw.wallet_address
FROM user_wallets uw
LEFT JOIN profiles p ON uw.user_id = p.user_id
LEFT JOIN auth.users au ON uw.user_id = au.id
WHERE p.user_id IS NULL;