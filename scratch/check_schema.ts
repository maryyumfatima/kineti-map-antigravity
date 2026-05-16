import { supabase } from '../src/lib/supabase';

async function checkSchema() {
  const { data, error } = await supabase.from('patients').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log('Columns:', Object.keys(data[0] || {}));
  }
}

checkSchema();
