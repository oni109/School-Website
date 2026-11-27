/* =====================================================================
   Epiphany Schools — connection settings
   ---------------------------------------------------------------------
   Fill these in to store the school's data in a Supabase database so
   staff and parents can use the portal from any device. Leave them
   empty to run the self-contained demo that keeps data in this browser.

   The publishable key is designed to be public: what each person can
   read or change is enforced by the database's security rules
   (supabase/migrations). NEVER put the service-role key here.
   ===================================================================== */
window.EPS_CONFIG = {
  supabaseUrl: 'https://wmuscsoaqaqpefpwfnpq.supabase.co',
  supabaseKey: 'sb_publishable_4d3NLO0KU_-WY8Fx-ppBdQ_slCs6Igf',
  // Usernames are turned into private login addresses on this domain (never emailed).
  loginDomain: 'users.epiphany-schools.app'
};
