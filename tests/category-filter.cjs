const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright' : 'playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { test, before, after } = require('node:test');
let browser, server;
const url = 'http://127.0.0.1:3017';
const longName = '特别长的分类名称需要完整显示且不能截断';
const categories = [{name:'餐饮',color:'#E8927C'}, {name:'考研',color:'#7E8BC9'}, {name:'购物',color:'#7FB685'}, {name:longName,color:'#6FA8C9'}, {name:'饮水',color:'#D97B66'}];
before(async()=>{
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','3017','--strictPort'],{stdio:'ignore'});
 for(let i=0;i<100;i++){try{await fetch(url);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();server?.kill();});
async function openPage(){
 const page=await browser.newPage({viewport:{width:393,height:852},timezoneId:'Asia/Shanghai'});
 page.setDefaultTimeout(5000);
 await page.goto(url);
 await page.evaluate(({categories})=>{
   const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   const today=fmt(new Date());const prev=new Date();prev.setDate(prev.getDate()-1);
   const items=[['food',90.64,0,today],['exam',55.07,1,today],['shop',18.30,2,today],['tiny',.50,3,today],['water',.01,4,today],['past-food',8,0,fmt(prev)]];
   localStorage.clear();localStorage.setItem('ledger.snapshot.v2',JSON.stringify({categories,budgets:{},expenses:items.map(([id,amount,index,date],i)=>({id,amount,category:categories[index].name,date,note:id,createdAt:i}))}));
 },{categories});
 await page.reload();return page;
}
test('stats category card filters records, same category toggles off, totals stay unchanged',async()=>{
 const page=await openPage();try{
  await page.getByRole('button',{name:'占比',exact:true}).click();
  const stats=page.getByRole('region',{name:'占比页面'});
  const list=stats.getByRole('region',{name:'本期流水'});
  // On the original app this card is plain text, so filtering never happens.
  await stats.getByText('餐饮',{exact:true}).first().click();
  assert.equal(await stats.getByRole('button',{name:'编辑账单',exact:true}).count(),1);
  assert.equal(await list.getByText('food',{exact:true}).count(),1);
  assert.equal(await stats.getByText('¥164.52',{exact:true}).count()>=1,true);
  await stats.getByRole('button',{name:'筛选餐饮',exact:true}).click();
  assert.equal(await list.getByRole('button',{name:'编辑账单',exact:true}).count(),5);
  await stats.getByRole('button',{name:'筛选考研',exact:true}).click();
  await stats.getByRole('button',{name:'全部分类',exact:true}).click();
  assert.equal(await list.getByRole('button',{name:'编辑账单',exact:true}).count(),5);
 }finally{await page.close();}
});
test('all chart names including tiny slices are readable without horizontal overflow',async()=>{
 const page=await openPage();try{
  await page.getByRole('button',{name:'占比',exact:true}).click();
  const stats=page.getByRole('region',{name:'占比页面'});
  for(const width of [320,393,430,768]){
   await page.setViewportSize({width,height:852});
   for(const c of categories){
    const card=stats.getByRole('button',{name:`筛选${c.name}`,exact:true});
    assert.equal(await card.count(),1,`category ${c.name} must have a complete visible legend`);
    await card.scrollIntoViewIfNeeded();
    const name=card.locator('.category-name');
    assert.equal(await name.innerText(),c.name);
    assert(await name.evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1));
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.setViewportSize({width:393,height:852});
  await stats.evaluate(el=>el.scrollTop=0);
  if(process.env.LEDGER_SCREENSHOT)await page.screenshot({path:process.env.LEDGER_SCREENSHOT});
 }finally{await page.close();}
});
test('chart sector click selects category, switching date resets filter, edits update matching list',async()=>{
 const page=await openPage();try{
  await page.getByRole('button',{name:'占比',exact:true}).click();
  const stats=page.getByRole('region',{name:'占比页面'});const list=stats.getByRole('region',{name:'本期流水'});
  await stats.locator('.recharts-sector').first().dispatchEvent('click');
  assert.equal(await list.getByText('food',{exact:true}).count(),1);
  assert.equal(await list.getByRole('button',{name:'编辑账单',exact:true}).count(),1);
  await stats.getByRole('button',{name:'上一期',exact:true}).click();
  assert.equal(await stats.getByRole('button',{name:'全部分类',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await list.getByText('past-food',{exact:true}).count(),1);
  await stats.getByRole('button',{name:'回到本期',exact:true}).click();
  await stats.getByRole('button',{name:'筛选餐饮',exact:true}).click();
  await list.getByRole('button',{name:'编辑账单',exact:true}).click();
  await page.getByLabel('分类',{exact:true}).selectOption('购物');
  await page.getByRole('button',{name:'保存修改',exact:true}).click();
  assert.equal(await list.getByText('food',{exact:true}).count(),0);
  assert.equal(await list.getByRole('button',{name:'编辑账单',exact:true}).count(),0);
 }finally{await page.close();}
});
test('home category click combines category and date filtering with clear option',async()=>{
 const page=await openPage();try{
  const home=page.getByRole('region',{name:'记账页面'});const list=home.getByRole('region',{name:'账单流水'});
  await home.getByRole('button',{name:'餐饮',exact:true}).click();
  assert.equal(await list.getByRole('button',{name:'编辑账单',exact:true}).count(),1);
  await list.getByRole('button',{name:'昨天',exact:true}).click();
  assert.equal(await list.getByText('past-food',{exact:true}).count(),1);
  await list.getByRole('button',{name:'全部',exact:true}).click();
  assert.equal(await list.getByRole('button',{name:'编辑账单',exact:true}).count(),2);
  await list.getByRole('button',{name:'全部分类',exact:true}).click();
  assert.equal(await list.getByRole('button',{name:'编辑账单',exact:true}).count(),6);
 }finally{await page.close();}
});

test('labels remain on the donut, complete and non-overlapping on narrow phones',async()=>{
 const page=await openPage();try{
  await page.getByRole('button',{name:'占比',exact:true}).click();
  const chart=page.getByRole('group',{name:'带分类和百分比的饼图'});
  assert.equal(await chart.count(),1,'the donut itself must display labels, not only the list below');
  for(const width of [320,393,430,768]){
   await page.setViewportSize({width,height:852});
   await chart.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>{
    const el=document.querySelector('.expense-donut');
    return el && Number(el.dataset.layoutWidth)===Math.round(el.clientWidth);
   });
   for(const c of categories){
    const label=chart.getByRole('button',{name:`图中筛选${c.name}`,exact:true});
    assert.equal(await label.locator('.donut-label-name').innerText(),c.name);
    assert.match(await label.locator('.donut-label-percent').innerText(),/^(<0\.1|\d+\.\d)%$/);
   }
   assert.equal(await chart.locator('.donut-label-percent').last().innerText(),'<0.1%');
   await assertChartGeometry(chart);
  }
  await chart.getByRole('button',{name:'图中筛选餐饮',exact:true}).click();
  assert.equal(await page.getByRole('region',{name:'本期流水'}).getByRole('button',{name:'编辑账单',exact:true}).count(),1);
 }finally{await page.close();}
});

async function assertChartGeometry(chart){
 // Measurements after two animation frames include ResizeObserver label-height updates.
 await chart.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const errors=await chart.evaluate(el=>{
  const outer=el.getBoundingClientRect();const labels=[...el.querySelectorAll('.donut-label')];const errors=[];
  labels.forEach((label,i)=>{
   const b=label.getBoundingClientRect();
   if(b.left<outer.left-1||b.right>outer.right+1||b.top<outer.top-1||b.bottom>outer.bottom+1)errors.push('label outside chart '+i);
   if(label.scrollWidth>label.clientWidth+1||label.scrollHeight>label.clientHeight+1)errors.push('clipped label '+i);
   for(const other of labels.slice(i+1)){
    const c=other.getBoundingClientRect();
    if(Math.min(b.right,c.right)-Math.max(b.left,c.left)>1&&Math.min(b.bottom,c.bottom)-Math.max(b.top,c.top)>1)errors.push('labels overlap '+i);
   }
  });
  return errors;
 });
 assert.deepEqual(errors,[]);
}

test('nine crowded categories and twenty long names all keep their chart labels',async()=>{
 const page=await openPage();try{
  for(const count of [1,9,20]){
   await page.evaluate(count=>{
    const d=new Date();const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const names=['餐饮','购物','交通','考研','娱乐','人情','水费','洗澡','其他'];
    const cats=Array.from({length:count},(_,i)=>({name:count===20?`分类${i}特别长的名称不能被省略`:names[i],color:['#E8927C','#7FB685','#7E8BC9'][i%3]}));
    localStorage.setItem('ledger.snapshot.v2',JSON.stringify({categories:cats,budgets:{},expenses:cats.map((c,i)=>({id:String(i),category:c.name,date,amount:i===0?401.58:i===1?97.04:i===2?40:1,note:'',createdAt:i}))}));
   },count);
   await page.reload();await page.getByRole('button',{name:'占比',exact:true}).click();
   await page.setViewportSize({width:320,height:852});
   const chart=page.getByRole('group',{name:'带分类和百分比的饼图'});
   assert.equal(await chart.locator('.donut-label').count(),count);
   await assertChartGeometry(chart);
   await page.addStyleTag({content:'.donut-label { font-size: 18px !important; }'});
   await assertChartGeometry(chart);
   if(count===9 && process.env.LEDGER_LABEL_SCREENSHOT){
    await page.setViewportSize({width:393,height:852});
    await page.screenshot({path:process.env.LEDGER_LABEL_SCREENSHOT});
   }
  }
 }finally{await page.close();}
});
