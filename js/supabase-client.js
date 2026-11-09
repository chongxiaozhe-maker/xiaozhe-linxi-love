(function () {
  if (window.supabase === undefined || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase library is not loaded.');
    return;
  }
  window.loveSupabase = window.supabase.createClient(
    'https://wophpkmlgsqecmmputlg.supabase.co',
    'sb_publishable_fzPrMlVfXkMEW-b65qWUew_8uDYOJur',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
