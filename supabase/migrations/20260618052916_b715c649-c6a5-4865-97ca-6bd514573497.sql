GRANT INSERT ON public.vault_backlinks TO anon;
CREATE POLICY "Allow anon insert on vault_backlinks"
  ON public.vault_backlinks
  FOR INSERT
  TO anon
  WITH CHECK (true);