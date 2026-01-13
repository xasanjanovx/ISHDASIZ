import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: adminProfile } = await supabaseClient
      .from('admin_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!adminProfile || adminProfile.role !== 'super_admin') {
      throw new Error('Forbidden: Only super admins can create admins');
    }

    const body = await req.json();
    const { email, password, full_name, role, district_id } = body;

    if (!email || !password || !full_name || !role) {
      throw new Error('Missing required fields');
    }

    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      throw createError || new Error('Failed to create user');
    }

    const { error: profileError } = await supabaseClient
      .from('admin_profiles')
      .insert({
        id: newUser.user.id,
        full_name,
        role,
        district_id: district_id || null,
      });

    if (profileError) {
      await supabaseClient.auth.admin.deleteUser(newUser.user.id);
      throw profileError;
    }

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      },
    );
  }
});
