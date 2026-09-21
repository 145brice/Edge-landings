const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../server');

test('main hosts show the hub while the website subdomain keeps its own homepage', async () => {
 const server=createApp().listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const read=(host,path='/')=>new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port:server.address().port,path,headers:{Host:host}},response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode,body}));}).on('error',reject));
 try {
  for(const host of ['edgelandings.com','www.edgelandings.com','localhost','websites.edgelandings.com.evil.test']){
   const result=await read(host);assert.equal(result.status,200);assert.match(result.body,/Independent projects/);assert.doesNotMatch(result.body,/audit-form/);
  }
  for(const path of ['/','/index.html','/websites.html']){
   const result=await read('websites.edgelandings.com',path);assert.equal(result.status,200);assert.match(result.body,/A professional website, kept current/);assert.match(result.body,/audit-form/);assert.match(result.body,/aria-label="Edge Landings projects"/);
   assert.ok(result.body.includes('href="https://www.edgelandings.com/"'));
  }
  assert.match((await read('www.edgelandings.com','/websites.html')).body,/audit-form/);
  for(const path of ['/pricing.html','/templates.html','/contact.html','/tax.html','/leads.html','/hub.css']) assert.equal((await read('www.edgelandings.com',path)).status,200);
  const taxPage=(await read('www.edgelandings.com','/tax.html')).body;
  assert.ok(taxPage.includes('href="https://websites.edgelandings.com/"'));
  assert.ok(taxPage.includes('href="https://tax.edgelandings.com/"'));
  assert.ok(taxPage.includes('href="https://leads.edgelandings.com/"'));
  assert.ok(taxPage.includes('href="https://processor.edgelandings.com/"'));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
