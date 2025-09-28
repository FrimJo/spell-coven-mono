(function(){
  let _resolve;
  window.cvReadyPromise = new Promise((res)=>{ _resolve = res; });
  window.onOpenCvReady = function(){ _resolve(); };
})();
