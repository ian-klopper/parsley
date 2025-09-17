const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, color_index')
    .in('full_name', ['Ian Klopper', 'Beau Dawson']);

  console.log('User color indices:');
  users?.forEach(user => {
    console.log(`${user.full_name}: color_index = ${user.color_index}`);
  });

  // Check if they have the same color_index
  const ian = users?.find(u => u.full_name === 'Ian Klopper');
  const beau = users?.find(u => u.full_name === 'Beau Dawson');

  if (ian && beau) {
    console.log(`\nIan color_index: ${ian.color_index}`);
    console.log(`Beau color_index: ${beau.color_index}`);
    console.log(`Same color: ${ian.color_index === beau.color_index}`);
  }
})();