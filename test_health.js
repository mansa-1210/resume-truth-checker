async function run(){
  try{
    const res = await fetch('http://127.0.0.1:3000/health');
    const json = await res.json();
    console.log('health', res.status, json);
  }catch(e){ console.error('health error', e.message); }
}
run();
