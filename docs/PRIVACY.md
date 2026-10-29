# Public repository privacy rules

- Use fictional names and demonstration content in fixtures and screenshots.
- Never commit source meeting documents, exports, logos, participant details or customer identifiers.
- Never commit `.env` files, private URLs, access tokens or Supabase service-role keys.
- Public client configuration may use an anonymous Supabase key only after row-level security is enabled and tested.
- Add organization branding through runtime configuration or user uploads, not application source.
- Run the sensitive-term audit before each public release.
